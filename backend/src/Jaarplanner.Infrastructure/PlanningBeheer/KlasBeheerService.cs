using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.PlanningBeheer;

/// <summary>
/// EF Core implementation of <see cref="IKlasBeheerService"/> over <see cref="AppDbContext"/>.
/// <para>
/// <b>Name uniqueness is enforced in the database, not just here.</b> The school-content Excel import
/// resolves a class by its <b>name</b>, so two same-named classes would make that resolution arbitrary.
/// The in-memory pre-check below produces the friendly Dutch 400; the unique index added alongside this
/// service is what actually holds under concurrency (two simultaneous POSTs both pass the check, then
/// one <c>SaveChanges</c> loses) — a <see cref="DbUpdateException"/> from that race is translated to the
/// same validation fault rather than surfacing as a 500.
/// </para>
/// </summary>
public sealed class KlasBeheerService : IKlasBeheerService
{
    private readonly AppDbContext _context;

    public KlasBeheerService(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<IReadOnlyList<KlasWeergave>> HaalKlassenOpAsync(CancellationToken cancellationToken = default)
    {
        // One grouped count instead of N+1: the subthema tallies for every class in a single query.
        var subthemaAantallen = await _context.Subthemas
            .GroupBy(s => s.KlasId)
            .Select(g => new { KlasId = g.Key, Aantal = g.Count() })
            .ToDictionaryAsync(x => x.KlasId, x => x.Aantal, cancellationToken);

        var klassen = await _context.Klassen
            .OrderBy(k => k.Leerjaar)
            .ThenBy(k => k.Naam)
            .ToListAsync(cancellationToken);

        return klassen
            .Select(k => new KlasWeergave(
                k.Id,
                k.SchooljaarId,
                k.Naam,
                k.Leerjaar,
                subthemaAantallen.TryGetValue(k.Id, out var aantal) ? aantal : 0,
                JaarFasenVoor(k.Leerjaar)))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> HaalKlasOpAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);
        var aantal = await _context.Subthemas.CountAsync(s => s.KlasId == klasId, cancellationToken);

        return new KlasWeergave(klas.Id, klas.SchooljaarId, klas.Naam, klas.Leerjaar, aantal, JaarFasenVoor(klas.Leerjaar));
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> MaakKlasAsync(
        Guid schooljaarId,
        KlasCreatie creatie,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);

        var naam = VereisNaam(creatie.Naam);
        await VereisVrijeNaamAsync(naam, uitgezonderd: null, cancellationToken);

        // A klas must live in an existing school year (Art. IX.3 containment, E3-01). Checked here so a bad id is
        // a friendly 404 rather than an opaque FK violation, and created THROUGH the schooljaar so the containment
        // is expressed by the aggregate that owns it.
        var schooljaar = await _context.Schooljaren
            .FirstOrDefaultAsync(s => s.Id == schooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {schooljaarId} is niet gevonden.");

        var klas = schooljaar.VoegKlasToe(naam, creatie.Leerjaar);

        // Registered explicitly as Added. This used to be load-bearing: reaching a new entity only through a
        // navigation of an already-tracked principal made EF apply its "key is set, so it must already exist"
        // heuristic and mark the Klas *Modified*, which failed with a concurrency error because there is no such
        // row yet.
        //
        // Since 2026-08-03 that heuristic no longer fires: AppDbContext declares every Guid key
        // ValueGeneratedNever, model-wide, so the change tracker reads a new child as Added on its own (see the
        // rule's own comment for why the workaround-per-service approach kept missing collections). The line
        // stays because it is correct and free, and because it states the intent at the call site; it is no
        // longer the thing that makes the insert work.
        _context.Klassen.Add(klas);
        await BewaarAsync(naam, cancellationToken);

        return new KlasWeergave(
            klas.Id, klas.SchooljaarId, klas.Naam, klas.Leerjaar, AantalSubthemas: 0, JaarFasenVoor(klas.Leerjaar));
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> WijzigKlasAsync(Guid klasId, KlasCreatie wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);

        var klas = await VindKlasAsync(klasId, cancellationToken);
        await VereisVrijeNaamAsync(wijziging.Naam, uitgezonderd: klasId, cancellationToken);

        // The domain owns the invariant (Klas.Wijzig validates naam once) — the service does not
        // re-implement it, and does not write through EF property metadata, which is a technique
        // reserved for keeping read-only curriculum content unmutatable (Art. III.1).
        klas.Wijzig(wijziging.Naam, wijziging.Leerjaar);
        await BewaarAsync(klas.Naam, cancellationToken);

        var aantal = await _context.Subthemas.CountAsync(s => s.KlasId == klasId, cancellationToken);

        return new KlasWeergave(klas.Id, klas.SchooljaarId, klas.Naam, klas.Leerjaar, aantal, JaarFasenVoor(klas.Leerjaar));
    }

    /// <inheritdoc />
    public async Task VerwijderKlasAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);

        // Report the blocking references as a 400 with a count, rather than letting the Restrict FK
        // surface as an opaque 500 (in the spirit of ADR-0006 §4 — clear diagnostics rather than raw plumbing).
        var aantal = await _context.Subthemas.CountAsync(s => s.KlasId == klasId, cancellationToken);
        if (aantal > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Klas '{klas.Naam}' heeft nog {aantal} subthema('s) en kan niet verwijderd worden. " +
                "Verwijder of verplaats eerst die klasgebonden inhoud.");
        }

        // The jaarplan is a CASCADE dependent (JaarplanConfiguration), so without this guard deleting the class
        // would silently destroy the plan and every Themaplaatsing in it — including ones the teacher explicitly
        // accepted and explicitly locked. A persisted human decision is the human's to discard (Art. IV.2), so the
        // delete is refused while any placement is one, and the count is reported the way the subthema guard does.
        // Loading it also tracks it, which is what makes the cascade below happen through the change tracker rather
        // than only through the database's own ON DELETE.
        //
        // The remediation this message names is REAL: DELETE /api/klassen/{klasId}/jaarplan/plaatsingen/{id} removes
        // a placement whatever its status or lock. The first version of this guard shipped without that endpoint, so
        // one accepted placement made the class undeletable forever and this message instructed the impossible.
        //
        // **The `Include` is load-bearing and its absence is silent** — the defect the 2026-08-20 audit measured
        // against real PostgreSQL rather than argued. `Themaplaatsing` is an EF *owned* collection and arrives with its
        // owner; `Activiteitplaatsing` is a **regular navigation** and does not. Without this line the day-level guard
        // below reads an empty backing list, counts 0, never fires, and the class delete cascades straight through to
        // `activiteitplaatsingen` at the database level — destroying exactly the scheduling work that guard exists to
        // refuse. Measured: no-include 0 versus with-include 1 on the same row.
        //
        // Why the tests did not see it, stated plainly because the first version of this comment got it wrong in a way
        // that pointed at the expensive gate: `KlasVerwijderenTests` **does** exercise this method — it builds a real
        // `KlasBeheerService` over the in-memory provider — and it missed this for the dull reason that **not one of its
        // cases ever placed an activiteit**. Every one of them adds a `Themaplaatsing` only. Since it seeds through a
        // separate context, in-memory would not have populated a non-owned navigation either, so a single added case
        // fails in milliseconds. That case now exists
        // (`KlasVerwijderenTests.Klas_met_een_ingeplande_activiteit_kan_niet_verwijderd_worden`), alongside the
        // Postgres one that also pins the E1-19 route and the real DB cascade
        // (`WeekplanningEndpointsTests.Een_klas_zonder_subthemas_maar_met_dagplanning_kan_niet_verwijderd_worden`).
        //
        // *An earlier version of this paragraph called the unit test a domain test and concluded that only an
        // integration test could catch a missing `Include`. Both halves were false, and the second is the harmful one:
        // believing it is how the next missing navigation ships.*
        //
        // `AsSplitQuery` because `Jaarplan` already auto-loads its **owned** `_plaatsingen`, so a second collection
        // navigation in one statement is a cartesian product — tens of themaplaatsingen times hundreds of
        // activiteitplaatsingen — for a guard that wants two counts. No semantic change; it is two round trips instead
        // of one multiplied row set.
        var jaarplan = await _context.Jaarplannen
            .Include("_activiteitplaatsingen")
            .AsSplitQuery()
            .FirstOrDefaultAsync(j => j.KlasId == klasId, cancellationToken);
        var besloten = jaarplan?.MenselijkBeslotenPlaatsingen.Count ?? 0;
        if (besloten > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Klas '{klas.Naam}' heeft een jaarplan met {besloten} beoordeelde of vergrendelde " +
                "themaplaatsing(en) en kan niet verwijderd worden. Verwijder die themaplaatsingen eerst uit " +
                "het jaarplan van deze klas.");
        }

        // The same guard for the day-level half of the plan (E9-03). Without it, the cascade above destroys every
        // activiteit a teacher scheduled onto a day while carefully protecting the thema placements beside them —
        // two different answers to "is this the human's to discard?" about two halves of one plan (Art. IV.2).
        //
        // Counted and reported separately rather than folded into the figure above, because the remediation is a
        // different screen and a different endpoint: a teacher told "3 plaatsingen" who then finds two of them in
        // the year view and none of the third has been sent looking for something the sentence never described.
        //
        // **⚠ A BACKSTOP, NOT THE GUARD A TEACHER WILL MEET — established by a failing test, not by reading.** The
        // subthema guard above fires FIRST in every ordinary case, and it always will: an activiteitplaatsing requires
        // an activiteit, which requires a subthema, whose KlasId must equal this plan's klas (the invariant
        // `Jaarplan.PlaatsActiviteit` enforces). So a class with a scheduled activiteit necessarily has a subthema, and
        // the count below is unreachable by that route. The integration test that expected this message got the
        // subthema one instead, which is how this was found.
        //
        // It is kept rather than deleted because there IS one route that reaches it: **E1-19**, the open hole where
        // `Subthema.WijzigScope` re-scopes a subthema (and every activiteit in it) to another klas, leaving this plan
        // holding a placement whose activiteit now belongs elsewhere. That route also breaks the class-boundary
        // invariant, so closing E1-19 is what makes this dead rather than merely unreachable — and until then, a
        // silent cascade here would destroy scheduling work. Do not "simplify" this away without closing E1-19 first.
        // **The remediation this sentence names is load-bearing and only conditionally true.** In the E1-19 state where
        // this guard actually fires, the activiteit's subthema belongs to another klas — and the week view still shows
        // the placement only because `WeekplanningService.ProjecteerAsync` applies **no klas filter** and `Bevraag`
        // resolves the activiteit by id whatever its subthema now says. Adding a klas filter to the week view (an
        // obvious hardening) would turn this message into the trap `ActiviteitplaatsingConfiguration` records shipping
        // once already: a Restrict whose remediation does not exist. Pinned end to end by the Postgres test named above,
        // which deletes the orphaned placement over the API and then completes the klas delete.
        var beslotenDagen = jaarplan?.MenselijkBeslotenActiviteitplaatsingen.Count ?? 0;
        if (beslotenDagen > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Klas '{klas.Naam}' heeft een jaarplan met {beslotenDagen} ingeplande activiteit(en) en kan niet " +
                "verwijderd worden. Haal die activiteiten eerst uit de weekplanning van deze klas.");
        }

        _context.Klassen.Remove(klas);
        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// The Op.stap jaar/fase codes a class teaches (E9-07), from the one rule that already decides it.
    /// <para>
    /// <b>Delegates to <see cref="Jaarfasen.VoorLeerjaar"/> rather than restating the mapping</b>, because
    /// <c>DekkingService</c> measures <c>Dekkingsbereik.EigenJaarFase</c> against that same function. Two copies would
    /// be two answers to "what does this class teach?", and they would drift the moment the graadklas/menggroep
    /// decision (Art. XIV) moves one of them.
    /// </para>
    /// <para>
    /// <b><c>null</c> becomes an empty list, and the contract says what that means</b>: not "teaches nothing" but "we
    /// cannot derive it" — the unresolved graadklas case. A caller must widen rather than narrow to nothing.
    /// </para>
    /// </summary>
    private static IReadOnlyList<string> JaarFasenVoor(int leerjaar) => Jaarfasen.VoorLeerjaar(leerjaar) ?? [];

    private async Task<Klas> VindKlasAsync(Guid klasId, CancellationToken cancellationToken)
    {
        var klas = await _context.Klassen.FirstOrDefaultAsync(k => k.Id == klasId, cancellationToken);

        return klas ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
    }

    private static string VereisNaam(string? naam)
    {
        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new SchoolcontentValidatieFout("Een klas heeft een naam nodig.");
        }

        return naam.Trim();
    }

    /// <summary>
    /// Rejects a name already taken by another class, compared case-insensitively <b>in the database</b>.
    /// <para>
    /// Uses <c>lower(naam) = lower(@naam)</c> (EF translates <see cref="string.ToLower()"/> to SQL
    /// <c>lower</c>), deliberately <b>not</b> <c>ILIKE</c>. <c>ILIKE</c>'s second argument is a LIKE
    /// <i>pattern</i>, so passing an unescaped class name straight from the request body made <c>%</c> and
    /// <c>_</c> act as wildcards: creating "K3_groen" matched an existing "K3-groen" and was refused as a
    /// duplicate that does not exist. A .NET <c>OrdinalIgnoreCase</c> comparer is equally wrong — in
    /// LINQ-to-Entities it translates to a case-<i>sensitive</i> SQL predicate.
    /// </para>
    /// <para>
    /// This is the friendly-message path; the database's own functional unique index on
    /// <c>lower(naam)</c> is what actually holds under a concurrent race.
    /// </para>
    /// </summary>
    private async Task VereisVrijeNaamAsync(string? naam, Guid? uitgezonderd, CancellationToken cancellationToken)
    {
        var genormaliseerd = VereisNaam(naam).ToLower();

        var bezet = await _context.Klassen
            .Where(k => uitgezonderd == null || k.Id != uitgezonderd)
            .AnyAsync(k => k.Naam.ToLower() == genormaliseerd, cancellationToken);

        if (bezet)
        {
            throw new SchoolcontentValidatieFout($"Er bestaat al een klas met de naam '{naam!.Trim()}'.");
        }
    }

    /// <summary>
    /// Saves, translating a unique-index violation on the class name into the same friendly validation
    /// fault the pre-check raises. Covers the concurrent-POST race the pre-check cannot.
    /// </summary>
    private async Task BewaarAsync(string naam, CancellationToken cancellationToken)
    {
        try
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniekeNaamSchending(ex))
        {
            throw new SchoolcontentValidatieFout($"Er bestaat al een klas met de naam '{naam}'.");
        }
    }

    private static bool IsUniekeNaamSchending(DbUpdateException ex) =>
        ex.InnerException is Npgsql.PostgresException { SqlState: "23505" } pg &&
        pg.ConstraintName?.Contains("klassen", StringComparison.OrdinalIgnoreCase) == true;
}
