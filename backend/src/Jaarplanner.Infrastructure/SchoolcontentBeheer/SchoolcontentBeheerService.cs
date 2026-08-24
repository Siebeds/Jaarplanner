using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.SchoolcontentBeheer;

/// <summary>
/// EF Core implementation of <see cref="ISchoolcontentBeheerService"/> over <see cref="AppDbContext"/>
/// (E1-10, FR-3.1/3.2). It is the CRUD sibling of the import service: it drives the same domain mutators
/// (<c>Thema.VoegThemadoelToe</c>, <c>Subthema.VoegSubdoelToe</c>, <c>Activiteit.VoegDoelkoppelingToe</c>, …)
/// rather than reaching into the entities, so every invariant — the 2–3 themadoel bound, the required
/// klas/leeftijd scope — is enforced in one place (the domain, Art. IX.2).
/// <para>
/// <b>Level scoping (Art. IX.2).</b> Thema/Themadoel inputs carry no klas/leeftijd (school-wide).
/// Subthema creation requires a real <c>KlasId</c> that resolves to a persisted <c>Klas</c> and a
/// non-blank leeftijd; the domain ctor rejects an empty klas, and this service additionally verifies the
/// klas exists. A subthema can therefore never become school-wide.
/// </para>
/// <para>
/// <b>Goal links (Art. III + IV.2).</b> Every link references a read-only <c>Leerplandoel</c> by its
/// stable code; the service verifies the code exists before linking (no phantom link, Art. III.5) and
/// never mutates curriculum data. A manually created link is persisted with status <c>manueel</c>.
/// </para>
/// </summary>
public sealed class SchoolcontentBeheerService : ISchoolcontentBeheerService
{
    private readonly AppDbContext _context;

    public SchoolcontentBeheerService(AppDbContext context) => _context = context;

    // --- Thema (school-scoped). ---

    public async Task<ThemaWeergave> MaakThemaAsync(ThemaCreatie creatie, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);

        Thema thema;
        try
        {
            thema = new Thema(creatie.Naam, creatie.DuurWeken, creatie.Invalshoeken);
        }
        catch (Exception ex) when (ex is ArgumentException or ArgumentOutOfRangeException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        if (creatie.Kernwoordenschat is not null)
        {
            thema.StelKernwoordenschatIn(creatie.Kernwoordenschat);
        }

        if (creatie.RijkeWoordenschat is not null)
        {
            thema.StelRijkeWoordenschatIn(creatie.RijkeWoordenschat);
        }

        _context.Themas.Add(thema);
        await _context.SaveChangesAsync(cancellationToken);

        return MapThema(thema);
    }

    public async Task<IReadOnlyList<ThemaWeergave>> HaalThemasOpAsync(CancellationToken cancellationToken = default)
    {
        var themas = await ThemasMetSubtreeQuery()
            .OrderBy(t => t.Naam)
            .ToListAsync(cancellationToken);

        return themas.Select(MapThema).ToList();
    }

    public async Task<ThemaWeergave> HaalThemaOpAsync(Guid themaId, CancellationToken cancellationToken = default)
    {
        var thema = await LaadThemaAsync(themaId, cancellationToken);
        return MapThema(thema);
    }

    // --- Gedeelde thema-bibliotheek + per-klas afleiding (E1-11, FR-3.3 resolved per-level, Art. IX.2). ---

    public async Task<IReadOnlyList<ThemaBibliotheekItem>> HaalThemaBibliotheekOpAsync(CancellationToken cancellationToken = default)
    {
        // The bibliotheek view is the school-wide layer ONLY: themadoelen + woordenschat, no subthema's.
        // We deliberately do NOT Include the subthema's so a class's per-class derivations can never leak
        // into the shared-library view (no cross-class bleed, Art. IX.2 / Gap A.5). AantalAfgeleideKlassen
        // is a distinct-class count over the subthema's, computed in SQL without materialising their content.
        var themas = await _context.Themas
            .AsNoTracking()
            .Include(t => t.Themadoelen)
            .OrderBy(t => t.Naam)
            .Select(t => new
            {
                Thema = t,
                AantalAfgeleideKlassen = t.Subthemas.Select(s => s.KlasId).Distinct().Count(),
                // Counts, not content. The same reasoning that already allows AantalAfgeleideKlassen
                // here: a number tells the reader how much has been built on this thema without
                // exposing any class's subthema's, activiteiten or goal choices (Art. IX.2).
                // School-wide totals on purpose, because this IS the school-wide library view.
                AantalSubthemas = t.Subthemas.Count,
                AantalActiviteiten = t.Subthemas.SelectMany(s => s.Activiteiten).Count(),
                AantalDoelkoppelingen =
                    t.Themadoelen.Count
                    + t.Subthemas.SelectMany(s => s.Subdoelen).Count()
                    + t.Subthemas.SelectMany(s => s.Activiteiten).SelectMany(a => a.Doelkoppelingen).Count(),
            })
            .ToListAsync(cancellationToken);

        return themas
            .Select(x => MapBibliotheekItem(
                x.Thema,
                x.AantalAfgeleideKlassen,
                x.AantalSubthemas,
                x.AantalActiviteiten,
                x.AantalDoelkoppelingen))
            .ToList();
    }

    public async Task<ThemaWeergave> HaalThemaVoorKlasAsync(Guid themaId, Guid klasId, CancellationToken cancellationToken = default)
    {
        await VereisKlasAsync(klasId, cancellationToken);

        // The shared thema (school-wide layer) plus ONLY this klas's subthema-derivations and their
        // subtree. Filtering the subthema Include by KlasId guarantees class A's subthema's never appear
        // under class B even though both derive from the same shared thema (Art. IX.2). Read-only graph.
        var thema = await _context.Themas
            .AsNoTracking()
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas.Where(s => s.KlasId == klasId)).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas.Where(s => s.KlasId == klasId)).ThenInclude(s => s.Activiteiten)
            .FirstOrDefaultAsync(t => t.Id == themaId, cancellationToken);

        if (thema is null)
        {
            throw new SchoolcontentNietGevondenFout("Dit thema bestaat niet meer. Iemand anders heeft het verwijderd.");
        }

        return MapThema(thema);
    }

    public async Task<ThemaWeergave> WijzigThemaAsync(Guid themaId, ThemaWijziging wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);
        var thema = await LaadThemaAsync(themaId, cancellationToken);

        try
        {
            thema.WijzigNaam(wijziging.Naam);
            thema.WerkBasisGegevensBij(wijziging.DuurWeken, wijziging.Invalshoeken);
        }
        catch (Exception ex) when (ex is ArgumentException or ArgumentOutOfRangeException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        if (wijziging.Kernwoordenschat is not null)
        {
            thema.StelKernwoordenschatIn(wijziging.Kernwoordenschat);
        }

        if (wijziging.RijkeWoordenschat is not null)
        {
            thema.StelRijkeWoordenschatIn(wijziging.RijkeWoordenschat);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return MapThema(thema);
    }

    public async Task VerwijderThemaAsync(Guid themaId, CancellationToken cancellationToken = default)
    {
        var thema = await LaadThemaAsync(themaId, cancellationToken);

        // A thema placed in any class's jaarplan cannot be deleted: `themaplaatsingen.ThemaId` is a RESTRICT FK
        // (JaarplanConfiguration), so without this the delete threw a raw 23503 that no handler maps — an unhandled
        // 500 for an ordinary user action. The FK already prevented dangling rows; the "clear diagnostics" it was
        // documented as buying did not exist until this guard. Thema's are school-WIDE, so the blocking plan may
        // belong to a class the deleting teacher never looks at, which is exactly why the count must be reported.
        var aantalPlaatsingen = await AantalThemaplaatsingenAsync(themaId, cancellationToken);
        if (aantalPlaatsingen > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Thema '{thema.Naam}' staat nog {aantalPlaatsingen} keer in een jaarplan en kan niet verwijderd " +
                "worden. Verwijder het thema eerst uit die jaarplannen.");
        }

        // E9-03: that same cascade reaches the activiteiten, whose `activiteitplaatsingen.ActiviteitId` is a RESTRICT
        // FK — so a thema whose activiteiten are scheduled onto days threw a raw 23503 two levels below this call.
        // Reported separately from the placement count above, because the remediation is a different screen: a teacher
        // told one combined figure would clear the year view and still be refused.
        var aantalIngepland = await AantalActiviteitplaatsingenVoorThemaAsync(themaId, cancellationToken);
        if (aantalIngepland > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Thema '{thema.Naam}' heeft nog {aantalIngepland} activiteit(en) in de weekplanning staan en kan " +
                "niet verwijderd worden. Haal die activiteiten eerst uit de weekplanning.");
        }

        // The EF cascade (ThemaConfiguration) deletes themadoelen + subthema's (and, through the
        // subthema cascade, subdoelen + activiteiten + their owned goal links) with the thema.
        _context.Themas.Remove(thema);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// How many jaarplan placements reference this thema, across every class.
    /// <para>
    /// <b>Counted in memory on purpose.</b> The owned collection loads with its owner, so loading the plans and
    /// counting is correct on both the Npgsql and the in-memory provider and needs no raw SQL. The volume makes it a
    /// non-issue: one plan per class, a primary school has a few dozen classes, and this runs only on an explicit
    /// thema delete.
    /// </para>
    /// <para>
    /// <b>Why not a server-side query — the precise reason.</b> Not because the type is owned: EF Core does translate
    /// <c>Any()</c>/<c>Count()</c> over an owned <i>collection navigation</i> into a SQL subquery. What owning forbids
    /// is querying the type <i>independently of its owner</i> (there is no <c>DbSet&lt;Themaplaatsing&gt;</c>). The
    /// actual blocker here is local: <see cref="Jaarplan.Plaatsingen"/> is <c>Ignore</c>d in
    /// <c>JaarplanConfiguration</c> because it returns a freshly materialised ordered list, so the only navigation is
    /// a bare backing field LINQ cannot address.
    /// </para>
    /// <para>
    /// So if a later story needs a real query, the minimal change is to expose a <i>mapped</i> collection navigation
    /// alongside the ordered projection — <b>keeping the type owned</b>, because un-owning would surrender the
    /// ownership cascade the <c>Klas</c> delete guard relies on. An earlier revision of this comment prescribed
    /// un-owning; that was an oversized remedy for a misdiagnosed cause. E5 may not need it at all: per-class dekking
    /// loads one jaarplan aggregate, which yields the placed thema ids for free. See E5-01 in the backlog.
    /// </para>
    /// </summary>
    private async Task<int> AantalThemaplaatsingenAsync(Guid themaId, CancellationToken cancellationToken)
    {
        // AsNoTracking: a pure read taken immediately before a delete in the same unit of work — tracking these
        // aggregates would add change-detection cost and put unrelated entities in the ChangeTracker.
        var plannen = await _context.Jaarplannen.AsNoTracking().ToListAsync(cancellationToken);

        return plannen.Sum(plan => plan.Plaatsingen.Count(p => p.ThemaId == themaId));
    }

    // --- Themadoel (school-scoped; 2–3 per thema). ---

    public async Task<ThemadoelWeergave> VoegThemadoelToeAsync(Guid themaId, string leerplandoelCode, CancellationToken cancellationToken = default)
    {
        var thema = await LaadThemaAsync(themaId, cancellationToken);
        var code = await VereisLeerplandoelAsync(leerplandoelCode, cancellationToken);

        Themadoel themadoel;
        try
        {
            // Manual link → status manueel (Art. IV.2); no AI motivation.
            themadoel = thema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Manueel));
        }
        catch (InvalidOperationException ex)
        {
            // Upper-bound (4th themadoel) breach — a structural rule, surfaced as a 400 (Art. IX.2).
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        // Mark the new child Added explicitly. This was the workaround for the mapping defect fixed model-wide
        // on 2026-08-03 (AppDbContext: every Guid key is ValueGeneratedNever), so it is belt-and-braces now
        // rather than the thing that makes the insert work. Kept because it is free and states the intent; note
        // that the collections which had *no* such line — Subthema and Activiteit — are precisely the ones that
        // answered 500 on a re-import for four days.
        _context.Themadoelen.Add(themadoel);
        await _context.SaveChangesAsync(cancellationToken);
        return MapThemadoel(themadoel);
    }

    public async Task VerwijderThemadoelAsync(Guid themaId, Guid themadoelId, CancellationToken cancellationToken = default)
    {
        var thema = await LaadThemaAsync(themaId, cancellationToken);
        var themadoel = thema.Themadoelen.FirstOrDefault(td => td.Id == themadoelId)
            ?? throw new SchoolcontentNietGevondenFout("Dit themadoel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.");

        thema.VerwijderThemadoel(themadoel);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // --- Subthema (class/age-scoped). ---

    public async Task<SubthemaWeergave> MaakSubthemaAsync(Guid themaId, SubthemaCreatie creatie, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);
        var thema = await LaadThemaAsync(themaId, cancellationToken);
        await VereisKlasAsync(creatie.KlasId, cancellationToken);

        Subthema subthema;
        try
        {
            // The domain ctor enforces the structural scope: non-empty klas + non-blank leeftijd (Art. IX.2).
            subthema = thema.VoegSubthemaToe(creatie.Naam, creatie.DuurWeken, creatie.KlasId, creatie.Leeftijd);
        }
        catch (Exception ex) when (ex is ArgumentException or ArgumentOutOfRangeException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        foreach (var ov in creatie.Onderzoeksvragen ?? [])
        {
            if (!string.IsNullOrWhiteSpace(ov.Vraag))
            {
                subthema.VoegOnderzoeksvraagToe(ov.Vraag, ov.Probleemstelling);
            }
        }

        _context.Subthemas.Add(subthema);
        await _context.SaveChangesAsync(cancellationToken);
        return MapSubthema(subthema);
    }

    public async Task<SubthemaWeergave> WijzigSubthemaAsync(Guid subthemaId, SubthemaWijzigingInvoer wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        await VereisKlasAsync(wijziging.KlasId, cancellationToken);

        try
        {
            subthema.WijzigNaam(wijziging.Naam);
            subthema.WerkBasisGegevensBij(wijziging.DuurWeken);
            // Re-scoping stays structural: a subthema can never become school-wide (Art. IX.2).
            subthema.WijzigScope(wijziging.KlasId, wijziging.Leeftijd);
        }
        catch (Exception ex) when (ex is ArgumentException or ArgumentOutOfRangeException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        // Reconcile onderzoeksvragen: replace the whole collection with the payload.
        foreach (var existing in subthema.Onderzoeksvragen.ToList())
        {
            subthema.VerwijderOnderzoeksvraag(existing);
            _context.Onderzoeksvragen.Remove(existing);
        }

        foreach (var ov in wijziging.Onderzoeksvragen ?? [])
        {
            if (!string.IsNullOrWhiteSpace(ov.Vraag))
            {
                subthema.VoegOnderzoeksvraagToe(ov.Vraag, ov.Probleemstelling);
            }
        }

        await _context.SaveChangesAsync(cancellationToken);
        return MapSubthema(subthema);
    }

    public async Task VerwijderSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken = default)
    {
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);

        // E9-03: the cascade below reaches the activiteiten, and `activiteitplaatsingen.ActiviteitId` is a RESTRICT FK
        // — so deleting a subthema whose activiteiten are scheduled onto days threw a raw 23503 that no handler maps,
        // i.e. an unhandled 500 for an ordinary teacher action. Exactly the shape `VerwijderThemaAsync` already guards
        // against for themaplaatsingen, and it is guarded the same way rather than differently.
        //
        // **The Restrict is deliberate and this guard is what makes it honest** (Art. IV.2): scheduling work is a
        // persisted human decision, so it is refused loudly rather than emptied silently. The remediation is real —
        // DELETE /api/klassen/{klasId}/jaarplan/weekplanning/{id} takes a placement off its day.
        var aantalIngepland = await AantalActiviteitplaatsingenVoorSubthemaAsync(subthemaId, cancellationToken);
        if (aantalIngepland > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Subthema '{subthema.Naam}' heeft nog {aantalIngepland} activiteit(en) in de weekplanning staan en " +
                "kan niet verwijderd worden. Haal die activiteiten eerst uit de weekplanning.");
        }

        // Removing the subthema cascades to its subdoelen + activiteiten (SubthemaConfiguration); it never
        // touches the school-wide thema attributes (level scoping, Art. IX.2).
        _context.Subthemas.Remove(subthema);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// How many day-level placements hang off the activiteiten of this subthema (E9-03).
    /// <para>
    /// A server-side count, unlike <see cref="AantalThemaplaatsingenAsync"/> which counts in memory: that one has to,
    /// because <c>Themaplaatsing</c> is an owned type with no queryable navigation. <c>Activiteitplaatsing</c> is a
    /// plain entity with its own <c>DbSet</c> precisely so counts like this are one query — see the note on
    /// <c>AppDbContext.Activiteitplaatsingen</c>.
    /// </para>
    /// </summary>
    private Task<int> AantalActiviteitplaatsingenVoorSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken) =>
        _context.Activiteitplaatsingen
            .CountAsync(
                p => _context.Activiteiten.Any(a => a.Id == p.ActiviteitId && a.SubthemaId == subthemaId),
                cancellationToken);

    /// <summary>
    /// The same count one level up: every day-level placement under any subthema of this thema (E9-03).
    /// <para>
    /// Needed because a thema delete cascades through its subthema's to their activiteiten, so the Restrict FK is
    /// reachable from here too — two levels away from the row that actually refuses.
    /// </para>
    /// </summary>
    private Task<int> AantalActiviteitplaatsingenVoorThemaAsync(Guid themaId, CancellationToken cancellationToken) =>
        _context.Activiteitplaatsingen
            .CountAsync(
                p => _context.Activiteiten.Any(a =>
                    a.Id == p.ActiviteitId
                    && _context.Subthemas.Any(s => s.Id == a.SubthemaId && s.ThemaId == themaId)),
                cancellationToken);

    public async Task<SubdoelWeergave> KoppelSubthemaAanDoelAsync(Guid subthemaId, string leerplandoelCode, CancellationToken cancellationToken = default)
    {
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        var code = await VereisLeerplandoelAsync(leerplandoelCode, cancellationToken);

        if (subthema.Subdoelen.Any(sd => string.Equals(sd.Koppeling.LeerplandoelCode, code, StringComparison.Ordinal)))
        {
            throw new SchoolcontentValidatieFout($"Subthema is al gekoppeld aan leerdoel '{code}'.");
        }

        // The subdoel carries the link at the subthema's own leeftijd (the per-(subthema × leeftijd)
        // link carrier in the model, Art. IX.2). Manual link → status manueel (Art. IV.2).
        var subdoel = subthema.VoegSubdoelToe(subthema.Leeftijd, new DoelKoppeling(code, KoppelingStatus.Manueel));

        _context.Subdoelen.Add(subdoel);
        await _context.SaveChangesAsync(cancellationToken);
        return MapSubdoel(subdoel);
    }

    public async Task OntkoppelSubdoelAsync(Guid subthemaId, Guid subdoelId, CancellationToken cancellationToken = default)
    {
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        var subdoel = subthema.Subdoelen.FirstOrDefault(sd => sd.Id == subdoelId)
            ?? throw new SchoolcontentNietGevondenFout("Dit subdoel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.");

        subthema.VerwijderSubdoel(subdoel);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // --- Activiteit (class/age-scoped). ---

    public async Task<ActiviteitWeergave> MaakActiviteitAsync(Guid subthemaId, ActiviteitCreatie creatie, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);
        VereisGeldigeLengte(creatie.LengteInLesuren);
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);

        Activiteit activiteit;
        try
        {
            activiteit = subthema.VoegActiviteitToe(creatie.Naam, creatie.ActiviteitType, creatie.Hoek, creatie.VerwachteUitkomsten);
            activiteit.KiesKleur(creatie.Kleur);
            activiteit.StelLengteIn(creatie.LengteInLesuren);
        }
        catch (Exception ex) when (ex is ArgumentException or ArgumentOutOfRangeException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        if (creatie.OnderzoeksvraagId is { } ovId)
        {
            ValideerOnderzoeksvraagHoortBijSubthema(ovId, subthema);
            activiteit.KoppelAanOnderzoeksvraag(ovId);
        }

        _context.Activiteiten.Add(activiteit);
        await _context.SaveChangesAsync(cancellationToken);
        return MapActiviteit(activiteit);
    }

    public async Task<ActiviteitWeergave> WijzigActiviteitAsync(Guid activiteitId, ActiviteitWijzigingInvoer wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);
        VereisGeldigeLengte(wijziging.LengteInLesuren);
        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);

        try
        {
            activiteit.WijzigNaam(wijziging.Naam);
            activiteit.WerkGegevensBij(wijziging.ActiviteitType, wijziging.Hoek, wijziging.VerwachteUitkomsten);
            // A separate call by design: WerkGegevensBij is also the import's overwrite path, which
            // carries no colour. Here the caller is a teacher, so a null means "no colour" and is
            // applied as such.
            activiteit.KiesKleur(wijziging.Kleur);
            activiteit.StelLengteIn(wijziging.LengteInLesuren);
        }
        catch (Exception ex) when (ex is ArgumentException or ArgumentOutOfRangeException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        if (wijziging.OnderzoeksvraagId is { } ovId)
        {
            var subthema = await LaadSubthemaAsync(activiteit.SubthemaId, cancellationToken);
            ValideerOnderzoeksvraagHoortBijSubthema(ovId, subthema);
            activiteit.KoppelAanOnderzoeksvraag(ovId);
        }
        else
        {
            activiteit.KoppelAanOnderzoeksvraag(null);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return MapActiviteit(activiteit);
    }

    public async Task VerwijderActiviteitAsync(Guid activiteitId, CancellationToken cancellationToken = default)
    {
        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);

        // The activiteitplaatsingen FK is Restrict (ActiviteitplaatsingConfiguration), so without this guard the
        // delete of a scheduled activiteit surfaces as a raw FK violation — an opaque 500 on an ordinary teacher
        // action. That is the exact trap the Klas guard's own comment records having shipped once: a Restrict whose
        // remediation is not reachable is worse than no Restrict at all.
        //
        // Refusing rather than cascading is the deliberate half (Art. IV.2): scheduling work is a persisted human
        // decision, and the alternative silently empties days a teacher filled. The remediation this message names
        // is REAL — DELETE /api/klassen/{klasId}/jaarplan/activiteitplaatsingen/{id} takes a placement off its day.
        //
        // Queried directly rather than through the Jaarplan aggregate, which is the whole reason
        // Activiteitplaatsing is a plain entity instead of an owned collection: counting one activiteit's
        // placements through an owned collection would mean loading every plan in the school.
        var ingeplandeDagen = await _context.Activiteitplaatsingen
            .CountAsync(p => p.ActiviteitId == activiteitId, cancellationToken);
        if (ingeplandeDagen > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Activiteit '{activiteit.Naam}' staat nog op {ingeplandeDagen} dag(en) in de weekplanning en kan " +
                "niet verwijderd worden. Haal ze eerst uit de weekplanning.");
        }

        _context.Activiteiten.Remove(activiteit);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<ActiviteitWeergave> VerplaatsActiviteitAsync(Guid activiteitId, Guid doelSubthemaId, CancellationToken cancellationToken = default)
    {
        // The links are loaded first and for two reasons: the response carries them, and loading them here is
        // what makes the "they survive a move" claim observable in the answer rather than only in the database.
        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);

        // The source is derived, never accepted from the caller: an activiteit knows which subthema it sits in,
        // so there is no way to submit a mismatched pair.
        var bron = await LaadSubthemaAsync(activiteit.SubthemaId, cancellationToken);

        // A 400 rather than the loader's 404, and the distinction is what lets the UI answer correctly without
        // reading Dutch prose: the *addressed* resource here is the activiteit, so a 404 always means "your
        // activiteit is gone" and the screen can act on it exactly as it does after a delete. A destination that
        // vanished meanwhile is a *referenced* resource, so it is a validation refusal the picker shows while
        // staying open with a refreshed list. Same shape as VereisKlasAsync, which refuses a missing klas the
        // same way rather than 404ing the subthema being created.
        var doel = await _context.Subthemas
            .Include(s => s.Activiteiten)
            .FirstOrDefaultAsync(s => s.Id == doelSubthemaId, cancellationToken)
            // The sentence states the fact and **not** the remedy, which is a correction a browser pass forced.
            // It used to end "Kies een ander subthema.", and when the vanished destination was the klas's last
            // one the panel then read that instruction directly above "Deze klas heeft geen ander subthema om de
            // activiteit naar te verhuizen": an instruction pointing at nothing, which is the same class of
            // defect as the one this round fixed one line over. The server owns the diagnosis, the screen owns
            // what to do about it, and only the screen knows whether an alternative exists.
            ?? throw new SchoolcontentValidatieFout("Dit subthema bestaat niet meer.");

        try
        {
            // The klas boundary and the two no-op refusals live in the domain (Art. IX.2), so every caller
            // meets them, and their Dutch sentences travel out as a 400 the form renders.
            bron.VerplaatsActiviteitNaar(activiteit, doel);
        }
        catch (Exception ex) when (ex is ArgumentException or ArgumentOutOfRangeException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return MapActiviteit(activiteit);
    }

    public async Task<IReadOnlyList<SubthemaBestemming>> HaalSubthemaBestemmingenAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        // Verified rather than assumed, and the reason is a product one (antagonist round 1). Without it an
        // unknown or deleted klas answers an empty list, and the picker reads an empty list as "this klas has
        // nowhere to move to" and hides the control. That renders an infrastructure state as a statement about
        // the school's content. A refusal makes the screen say it could not load the destinations instead.
        await VereisKlasAsync(klasId, cancellationToken);

        // Projected to an anonymous type and mapped to the record afterwards, deliberately: ordering happens in
        // SQL under the database collation (a Dutch name sorted by .NET's ordinal comparer puts "Ijs" in the
        // wrong place), while the record construction stays out of the translation. Same SelectMany-over-
        // Subthemas shape EfDekkingOpslag already proves translatable on PostgreSQL.
        var rijen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .Where(s => s.KlasId == klasId)
                .Select(s => new
                {
                    s.Id,
                    s.Naam,
                    s.Leeftijd,
                    ThemaId = t.Id,
                    ThemaNaam = t.Naam,
                }))
            .OrderBy(r => r.ThemaNaam)
            // ThemaId breaks the tie because `Thema.Naam` carries no unique index: two thema's may share a naam,
            // and without this their rows interleave by subthema naam, so a reader (or an export) sees one
            // thema's subthema's split around another's.
            //
            // **It is no longer what the picker's correctness depends on** (round 2, MINOR 6). The first fix for
            // this paired the tie-break with a client that grouped by *consecutive* ThemaId, where interleaving
            // produced two groups carrying the same id and label; the client now groups on a keyed map, so
            // adjacency is irrelevant there and this clause is about the order rows arrive in, which is still
            // worth getting right and is what the integration test pins.
            .ThenBy(r => r.ThemaId)
            .ThenBy(r => r.Naam)
            .ThenBy(r => r.Leeftijd)
            .ToListAsync(cancellationToken);

        return rijen
            .Select(r => new SubthemaBestemming(r.Id, r.Naam, r.Leeftijd, r.ThemaId, r.ThemaNaam))
            .ToList();
    }

    public async Task<DoelKoppelingWeergave> KoppelActiviteitAanDoelAsync(Guid activiteitId, string leerplandoelCode, CancellationToken cancellationToken = default)
    {
        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);
        var code = await VereisLeerplandoelAsync(leerplandoelCode, cancellationToken);

        if (activiteit.Doelkoppelingen.Any(k => string.Equals(k.LeerplandoelCode, code, StringComparison.Ordinal)))
        {
            throw new SchoolcontentValidatieFout($"Activiteit is al gekoppeld aan leerdoel '{code}'.");
        }

        var koppeling = new DoelKoppeling(code, KoppelingStatus.Manueel);
        activiteit.VoegDoelkoppelingToe(koppeling);

        await _context.SaveChangesAsync(cancellationToken);
        return MapKoppeling(koppeling);
    }

    public async Task OntkoppelActiviteitDoelAsync(Guid activiteitId, Guid koppelingId, CancellationToken cancellationToken = default)
    {
        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);
        var koppeling = activiteit.Doelkoppelingen.FirstOrDefault(k => k.Id == koppelingId)
            ?? throw new SchoolcontentNietGevondenFout("Deze koppeling is er niet meer. Vernieuw de pagina om te zien wat er nu staat.");

        activiteit.VerwijderDoelkoppeling(koppeling);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // --- Onderzoeksvraag (per subthema). ---

    public async Task<OnderzoeksvraagWeergave> VoegOnderzoeksvraagToeAsync(Guid subthemaId, OnderzoeksvraagCreatie creatie, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);

        Onderzoeksvraag ov;
        try
        {
            ov = subthema.VoegOnderzoeksvraagToe(creatie.Vraag, creatie.Probleemstelling);
        }
        catch (Exception ex) when (ex is ArgumentException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return MapOnderzoeksvraag(ov);
    }

    public async Task<OnderzoeksvraagWeergave> WijzigOnderzoeksvraagAsync(Guid subthemaId, Guid ovId, OnderzoeksvraagCreatie invoer, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(invoer);
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        var ov = subthema.Onderzoeksvragen.FirstOrDefault(v => v.Id == ovId)
            ?? throw new SchoolcontentNietGevondenFout("Deze onderzoeksvraag bestaat niet meer. Vernieuw de pagina om te zien wat er nu staat.");

        try
        {
            ov.Wijzig(invoer.Vraag, invoer.Probleemstelling);
        }
        catch (Exception ex) when (ex is ArgumentException)
        {
            throw new SchoolcontentValidatieFout(ex.Message);
        }

        await _context.SaveChangesAsync(cancellationToken);
        return MapOnderzoeksvraag(ov);
    }

    public async Task VerwijderOnderzoeksvraagAsync(Guid subthemaId, Guid ovId, CancellationToken cancellationToken = default)
    {
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        var ov = subthema.Onderzoeksvragen.FirstOrDefault(v => v.Id == ovId)
            ?? throw new SchoolcontentNietGevondenFout("Deze onderzoeksvraag bestaat niet meer. Vernieuw de pagina om te zien wat er nu staat.");

        // Clear the FK on any activiteiten that reference this onderzoeksvraag (SetNull semantics — an
        // activiteit losing its tag is not data loss of the activiteit itself).
        foreach (var activiteit in subthema.Activiteiten.Where(a => a.OnderzoeksvraagId == ovId))
        {
            activiteit.KoppelAanOnderzoeksvraag(null);
        }

        subthema.VerwijderOnderzoeksvraag(ov);
        _context.Onderzoeksvragen.Remove(ov);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<ActiviteitWeergave> KoppelActiviteitAanOnderzoeksvraagAsync(Guid activiteitId, Guid? onderzoeksvraagId, CancellationToken cancellationToken = default)
    {
        var activiteit = await LaadActiviteitAsync(activiteitId, cancellationToken);

        if (onderzoeksvraagId is { } ovId)
        {
            var subthema = await LaadSubthemaAsync(activiteit.SubthemaId, cancellationToken);
            ValideerOnderzoeksvraagHoortBijSubthema(ovId, subthema);
        }

        activiteit.KoppelAanOnderzoeksvraag(onderzoeksvraagId);
        await _context.SaveChangesAsync(cancellationToken);
        return MapActiviteit(activiteit);
    }

    private static void ValideerOnderzoeksvraagHoortBijSubthema(Guid onderzoeksvraagId, Subthema subthema)
    {
        if (!subthema.Onderzoeksvragen.Any(v => v.Id == onderzoeksvraagId))
        {
            // The onderzoeksvraag must belong to the same subthema as the activiteit (structural invariant,
            // Art. IX.2). The sentence says what the reader can do: pick a vraag that belongs to this subthema.
            throw new SchoolcontentValidatieFout(
                "De onderzoeksvraag hoort niet bij dit subthema. Kies een onderzoeksvraag die bij hetzelfde subthema hoort.");
        }
    }

    // --- Loading helpers (graph-loaded so the read views are complete and the domain mutators see the subtree). ---

    private IQueryable<Thema> ThemasMetSubtreeQuery() =>
        _context.Themas
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .Include(t => t.Subthemas).ThenInclude(s => s.Onderzoeksvragen);

    private async Task<Thema> LaadThemaAsync(Guid themaId, CancellationToken cancellationToken)
    {
        var thema = await ThemasMetSubtreeQuery().FirstOrDefaultAsync(t => t.Id == themaId, cancellationToken);
        return thema ?? throw new SchoolcontentNietGevondenFout("Dit thema bestaat niet meer. Iemand anders heeft het verwijderd.");
    }

    private async Task<Subthema> LaadSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken)
    {
        var subthema = await _context.Subthemas
            .Include(s => s.Subdoelen)
            .Include(s => s.Activiteiten)
            .Include(s => s.Onderzoeksvragen)
            .FirstOrDefaultAsync(s => s.Id == subthemaId, cancellationToken);
        return subthema ?? throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");
    }

    private async Task<Activiteit> LaadActiviteitAsync(Guid activiteitId, CancellationToken cancellationToken)
    {
        var activiteit = await _context.Activiteiten
            .Include(a => a.Doelkoppelingen)
            .FirstOrDefaultAsync(a => a.Id == activiteitId, cancellationToken);
        return activiteit ?? throw new SchoolcontentNietGevondenFout("Deze activiteit bestaat niet meer. Iemand anders heeft ze verwijderd.");
    }

    /// <summary>
    /// Verifies the leerplandoel code exists (Art. III.5) and returns its trimmed form. Read-only —
    /// curriculum data is never mutated by linking (Art. III.1).
    /// <para>
    /// <b>Exact match, and that is a policy rather than an accident.</b> <c>l.Code == code</c> translates to
    /// SQL <c>=</c> under the database collation, so it is case-sensitive. The E2-08 matching flow reads a
    /// code case-<i>insensitively</i> when a teacher types it into a free-text field
    /// (<c>DoelMatchingService.ZoekIngetypteLeerdoelAsync</c>, see the "Case policy" on that class) — a different
    /// question from this one: the codes arriving here come from an import file or an API payload, where a
    /// mis-cased decreed identifier is a data defect worth surfacing, not a typo to smooth over. The
    /// asymmetry is recorded here so the next reader does not read either side as an oversight; deciding
    /// whether the import path should also fold case belongs to the import stories (E1), not to E2-08.
    /// </para>
    /// </summary>
    private async Task<string> VereisLeerplandoelAsync(string leerplandoelCode, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(leerplandoelCode))
        {
            throw new SchoolcontentValidatieFout("Een leerdoelcode is verplicht.");
        }

        var code = leerplandoelCode.Trim();
        var bestaat = await _context.Leerplandoelen.AsNoTracking().AnyAsync(l => l.Code == code, cancellationToken);
        if (!bestaat)
        {
            // Art. III.5 (a leerplandoel's code is its stable identity, so an unknown one is refused rather
            // than created) is the rule; the sentence deliberately does not cite it. This message is read by a
            // teacher linking a goal, and an article number is not something they can act on. It also carries
            // no em dash (Art. II.5). Recorded here because E1-14 landing 2 is the first screen to render it.
            throw new SchoolcontentValidatieFout(
                $"Leerplandoel '{code}' staat niet bij de ingeladen Op.stap-doelen, dus er is niets gekoppeld.");
        }

        return code;
    }

    /// <summary>Verifies the klas exists; class scoping is structural for a subthema (Art. IX.2).</summary>
    private async Task VereisKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        if (klasId == Guid.Empty)
        {
            // Art. IX.2 makes the class scope structural for a subthema. Same reasoning as above: the rule
            // stays in the comment, the sentence says what the reader has to do.
            throw new SchoolcontentValidatieFout("Een subthema hoort altijd bij één klas. Kies eerst een klas.");
        }

        var bestaat = await _context.Klassen.AsNoTracking().AnyAsync(k => k.Id == klasId, cancellationToken);
        if (!bestaat)
        {
            // The id is deliberately left out: a raw GUID is not a sentence a teacher can act on, and the
            // caller already knows which id it sent. Same correction as the 404-on-delete case in the UI.
            throw new SchoolcontentValidatieFout("Die klas bestaat niet meer. Kies een klas uit de lijst.");
        }
    }

    // --- Mapping to read views. ---

    private static ThemaWeergave MapThema(Thema thema) => new(
        thema.Id,
        thema.Naam,
        thema.DuurWeken,
        thema.Invalshoeken,
        thema.Kernwoordenschat.ToList(),
        thema.RijkeWoordenschat.ToList(),
        thema.HeeftVoldoendeThemadoelen,
        thema.Themadoelen.Select(MapThemadoel).ToList(),
        thema.Subthemas.Select(MapSubthema).ToList());

    private static ThemaBibliotheekItem MapBibliotheekItem(
        Thema thema,
        int aantalAfgeleideKlassen,
        int aantalSubthemas,
        int aantalActiviteiten,
        int aantalDoelkoppelingen) => new(
        thema.Id,
        thema.Naam,
        thema.DuurWeken,
        thema.Invalshoeken,
        thema.Kernwoordenschat.ToList(),
        thema.RijkeWoordenschat.ToList(),
        thema.HeeftVoldoendeThemadoelen,
        thema.Themadoelen.Select(MapThemadoel).ToList(),
        aantalAfgeleideKlassen,
        aantalSubthemas,
        aantalActiviteiten,
        aantalDoelkoppelingen);

    private static ThemadoelWeergave MapThemadoel(Themadoel themadoel) =>
        new(themadoel.Id, MapKoppeling(themadoel.Koppeling));

    private static SubthemaWeergave MapSubthema(Subthema subthema) => new(
        subthema.Id,
        subthema.ThemaId,
        subthema.Naam,
        subthema.DuurWeken,
        subthema.KlasId,
        subthema.Leeftijd,
        subthema.Onderzoeksvragen.Select(MapOnderzoeksvraag).ToList(),
        subthema.Subdoelen.Select(MapSubdoel).ToList(),
        subthema.Activiteiten.Select(MapActiviteit).ToList());

    private static OnderzoeksvraagWeergave MapOnderzoeksvraag(Onderzoeksvraag ov) =>
        new(ov.Id, ov.Vraag, ov.Probleemstelling);

    private static SubdoelWeergave MapSubdoel(Subdoel subdoel) =>
        new(subdoel.Id, subdoel.Leeftijd, MapKoppeling(subdoel.Koppeling));

    /// <summary>
    /// Refuses a length a teacher could not have meant, in Dutch and before the aggregate sees it.
    ///
    /// <para>
    /// The aggregate's own guard throws an English <see cref="ArgumentOutOfRangeException"/> whose
    /// message the catch below forwards verbatim, so without this a teacher would read
    /// "(Parameter 'lengteInLesuren')". Same division of labour as the weekplanning service: the
    /// aggregate refuses programmer error, the service refuses teacher input (Art. II.3).
    /// </para>
    /// </summary>
    private static void VereisGeldigeLengte(int lengteInLesuren)
    {
        if (lengteInLesuren < 1)
        {
            throw new SchoolcontentValidatieFout(
                "Een activiteit duurt minstens één lesuur. Kies een aantal van 1 of meer.");
        }
    }

    private static ActiviteitWeergave MapActiviteit(Activiteit activiteit) => new(
        activiteit.Id,
        activiteit.Naam,
        activiteit.ActiviteitType,
        activiteit.Hoek,
        activiteit.VerwachteUitkomsten,
        activiteit.OnderzoeksvraagId,
        activiteit.Kleur,
        activiteit.LengteInLesuren,
        activiteit.Doelkoppelingen.Select(MapKoppeling).ToList());

    private static DoelKoppelingWeergave MapKoppeling(DoelKoppeling koppeling) =>
        new(koppeling.Id, koppeling.LeerplandoelCode, koppeling.Status, koppeling.AiMotivatie);
}
