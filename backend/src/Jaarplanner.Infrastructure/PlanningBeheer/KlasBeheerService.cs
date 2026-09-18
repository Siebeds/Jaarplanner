using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Ontwikkelingsrapport;
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
        // One grouped count instead of N+1, now keyed on LEEFTIJD rather than on klas.
        //
        // A subthema stopped naming a klas on 2026-08-30 (Art. IX.2), so "how many subthema's does this class
        // have" has no row to count any more. What the klassenlijst can still answer, and what a reader of it
        // actually wants, is how much content this class INHERITS from the age it teaches. Two K3 classes now
        // report the same number, which is the correct answer and would have been wrong yesterday.
        var perLeeftijd = await _context.Subthemas
            .GroupBy(s => s.Leeftijd)
            .Select(g => new { Leeftijd = g.Key, Aantal = g.Count() })
            .ToDictionaryAsync(x => x.Leeftijd, x => x.Aantal, cancellationToken);

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
                TelVoor(k, perLeeftijd),
                JaarFasenVoor(k),
                k.Jaarfase,
                MogelijkeJaarfasenVoor(k),
                Leerling.KlasKanLeerlingenHebben(k.Jaarfase)))
            .ToList();
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> HaalKlasOpAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);
        var aantal = await TelSubthemasAsync(klas, cancellationToken);

        return new KlasWeergave(
            klas.Id,
            klas.SchooljaarId,
            klas.Naam,
            klas.Leerjaar,
            aantal,
            JaarFasenVoor(klas),
            klas.Jaarfase,
            MogelijkeJaarfasenVoor(klas),
            Leerling.KlasKanLeerlingenHebben(klas.Jaarfase));
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> MaakKlasAsync(
        Guid schooljaarId,
        KlasCreatie creatie,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);

        var naam = VereisNaam(creatie.Naam);
        VereisGeldigeJaarfase(creatie.Jaarfase);
        await VereisVrijeNaamAsync(naam, uitgezonderd: null, cancellationToken);

        // A klas must live in an existing school year (Art. IX.3 containment, E3-01). Checked here so a bad id is
        // a friendly 404 rather than an opaque FK violation, and created THROUGH the schooljaar so the containment
        // is expressed by the aggregate that owns it.
        var schooljaar = await _context.Schooljaren
            .FirstOrDefaultAsync(s => s.Id == schooljaarId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Schooljaar {schooljaarId} is niet gevonden.");

        var klas = schooljaar.VoegKlasToe(naam, creatie.Jaarfase!);

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
            klas.Id,
            klas.SchooljaarId,
            klas.Naam,
            klas.Leerjaar,
            AantalSubthemas: 0,
            JaarFasenVoor(klas),
            klas.Jaarfase,
            MogelijkeJaarfasenVoor(klas),
            Leerling.KlasKanLeerlingenHebben(klas.Jaarfase));
    }

    /// <inheritdoc />
    public async Task<KlasWeergave> WijzigKlasAsync(Guid klasId, KlasCreatie wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);

        var klas = await VindKlasAsync(klasId, cancellationToken);
        VereisGeldigeJaarfase(wijziging.Jaarfase);
        await VereisVrijeNaamAsync(wijziging.Naam, uitgezonderd: klasId, cancellationToken);

        // A klas with children in the ontwikkelingsrapport stays one that grants K3 (FB-001, D9). Otherwise the children
        // would stay in the table and fall out of every route: the matrix gives a leerkracht no rapportklas that is not
        // K3, so nobody but admin could see, rename or delete them, and nothing on screen would say they exist. The
        // name is the klas's, which is no pupil data; the count is all that is said about the children.
        if (!Leerling.KlasKanLeerlingenHebben(wijziging.Jaarfase))
        {
            var kinderen = await _context.Leerlingen.CountAsync(l => l.KlasId == klasId, cancellationToken);
            if (kinderen > 0)
            {
                throw new SchoolcontentValidatieFout(
                    $"Klas '{klas.Naam}' heeft nog {kinderen} kind(eren) in het ontwikkelingsrapport. Een klas met " +
                    "kinderen blijft een klas van de derde kleuter. Verwijder die kinderen eerst bij Ontwikkelingsrapport.");
            }
        }

        // The domain owns the invariant (Klas.Wijzig validates naam once) — the service does not
        // re-implement it, and does not write through EF property metadata, which is a technique
        // reserved for keeping read-only curriculum content unmutatable (Art. III.1).
        klas.Wijzig(wijziging.Naam, wijziging.Jaarfase!);
        await BewaarAsync(klas.Naam, cancellationToken);

        var aantal = await TelSubthemasAsync(klas, cancellationToken);

        return new KlasWeergave(
            klas.Id,
            klas.SchooljaarId,
            klas.Naam,
            klas.Leerjaar,
            aantal,
            JaarFasenVoor(klas),
            klas.Jaarfase,
            MogelijkeJaarfasenVoor(klas),
            Leerling.KlasKanLeerlingenHebben(klas.Jaarfase));
    }

    /// <inheritdoc />
    public async Task VerwijderKlasAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);

        // **THE SUBTHEMA GUARD IS GONE, AND IT WAS REMOVED RATHER THAN LOST** (Art. IX.2 as amended 2026-08-30).
        // It refused the delete while any subthema named this klas, because the FK was `Restrict` and deleting
        // would have orphaned one class's content. A subthema now names an age. Deleting a class takes nothing
        // from it: the subthema's, their activiteiten and their goal links all survive, and the next class at
        // that age inherits them. There is nothing left to protect, so refusing would only be a habit.
        //
        // What still refuses is the guard below, and it is the one that always mattered more: a class's own
        // JAARPLAN, with the placements a teacher decided on. That work belongs to nobody else and cascades away
        // with the row.

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
        // **THIS IS NOW THE GUARD A TEACHER MEETS, and it used to be a backstop.** Until 2026-08-30 a subthema
        // guard stood above it and fired first in every ordinary case, because an activiteitplaatsing needs an
        // activiteit, which needs a subthema, which named this very klas. That guard went with the class scope
        // (Art. IX.2), so the ordinary route now arrives here: a klas whose only work is a day planning is refused
        // by this sentence and by no other. The comment that called it unreachable was true for eleven days and is
        // corrected rather than deleted, because "unreachable" is exactly the claim that invites a simplification.
        //
        // **E1-19 is HALF dissolved by the same amendment, and the half that is left is what keeps this guard
        // load-bearing. The story is still `[ ]`.** It existed because `Subthema.WijzigScope` could re-scope a
        // subthema to another klas and leave this plan holding a placement whose activiteit belonged elsewhere.
        // There is no class to re-scope to any more, so that clause is unfalsifiable rather than fixed: nothing
        // was built, a field was deleted somewhere else. What re-scoping still does is change the AGE, and a plan
        // may then hold a placement for an activiteit its klas no longer teaches — the same orphan wearing
        // different clothes, refused here in the same way and remediated by the same endpoint. An earlier version
        // of this comment said "E1-19 is closed", which the backlog entry written the same hour contradicts in
        // capitals; the word is corrected rather than deleted, because "closed" sitting above a guard is an
        // invitation to remove it.
        //
        // The remediation is real: DELETE /api/klassen/{klasId}/jaarplan/weekplanning/{id} removes the placement,
        // and `WeekplanningService.ProjecteerAsync` applies no klas filter, so the teacher can still see the thing
        // she is told to remove. Adding one (an obvious hardening) would turn this message into the trap
        // `ActiviteitplaatsingConfiguration` records shipping once already: a Restrict whose remediation does not
        // exist. Pinned end to end by the Postgres test named above, which deletes the placement over the API and
        // then completes the klas delete.
        var beslotenDagen = jaarplan?.MenselijkBeslotenActiviteitplaatsingen.Count ?? 0;
        if (beslotenDagen > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Klas '{klas.Naam}' heeft een jaarplan met {beslotenDagen} ingeplande activiteit(en) en kan niet " +
                "verwijderd worden. Haal die activiteiten eerst uit de weekplanning van deze klas.");
        }

        // The children in the klas's ontwikkelingsrapport (FB-001). `leerlingen` holds the klas by a Restrict FK
        // (LeerlingConfiguration), so without this guard the delete fails as a raw 23503. Refused rather than cascaded,
        // because a child takes their reports along (from FB-003), and deleting those is a deliberate act of its own: a
        // leerling at a time on the report screen (D8), or a whole schooljaar by admin (D7). The remediation is real:
        // DELETE /api/leerlingen/{leerlingId} removes one. The count only: the klas name is no pupil data, a child's is.
        var kinderen = await _context.Leerlingen.CountAsync(l => l.KlasId == klasId, cancellationToken);
        if (kinderen > 0)
        {
            throw new SchoolcontentValidatieFout(
                $"Klas '{klas.Naam}' heeft nog {kinderen} kind(eren) in het ontwikkelingsrapport en kan niet verwijderd " +
                "worden. Verwijder die kinderen eerst bij Ontwikkelingsrapport.");
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
    /// <summary>
    /// Refuses a jaar/fase a class cannot claim, before the aggregate does.
    /// <para>
    /// The aggregate's own guard throws a bare <c>ArgumentException</c> that no handler maps, so it reached a teacher
    /// as an unhandled 500 (measured, 2026-08-25). Both use <c>Jaarfasen.WatIsErMisMet</c>, so the rule exists once
    /// and only the reaction differs.
    /// </para>
    /// </summary>
    private static void VereisGeldigeJaarfase(string? jaarfase)
    {
        var mis = Jaarfasen.WatIsErMisMet(jaarfase);
        if (mis is not null)
        {
            throw new SchoolcontentValidatieFout(mis);
        }
    }

    private static IReadOnlyList<string> JaarFasenVoor(Klas klas) =>
        Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase) ?? [];

    /// <summary>
    /// The codes a form may offer for a class's leeftijd: <b>all nine, always</b>.
    /// <para>
    /// <b>It used to depend on the leerjaar and is now constant, which is the visible half of the 2026-08-30
    /// ruling.</b> While the leerjaar was stated first, an L1 to L6 class had nothing left to choose (its ordinal
    /// already named the code) and only a kleutergroep was asked, so this answered a set for one case and empty for
    /// the other. The leerjaar is now DERIVED from the leeftijd, so the leeftijd is what every class is asked and
    /// every code is on offer.
    /// </para>
    /// <para>
    /// Still served from here rather than spelled out in the browser, for the reason it always was: <c>Jaarfasen</c>
    /// is domain vocabulary, and a list of nine strings in TypeScript would be a second answer to what a class may
    /// teach.
    /// </para>
    /// </summary>
    private static IReadOnlyList<string> MogelijkeJaarfasenVoor(Klas klas) => Jaarfasen.Alle;

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
    /// <summary>
    /// How many subthema's a klas inherits: the ones at the ages it teaches.
    /// <para>
    /// A class whose ages cannot be derived (the graadklas, Art. XIV) counts <b>every</b> subthema, matching what
    /// its thema view will actually show it. A count that disagreed with the screen it labels would be worse than
    /// no count.
    /// </para>
    /// </summary>
    private async Task<int> TelSubthemasAsync(Klas klas, CancellationToken cancellationToken)
    {
        var codes = Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase);
        return codes is null
            ? await _context.Subthemas.CountAsync(cancellationToken)
            : await _context.Subthemas.CountAsync(s => codes.Contains(s.Leeftijd), cancellationToken);
    }

    /// <summary>The same tally as <see cref="TelSubthemasAsync"/>, read out of one grouped query.</summary>
    private static int TelVoor(Klas klas, IReadOnlyDictionary<string, int> perLeeftijd)
    {
        var codes = Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase);
        return codes is null
            ? perLeeftijd.Values.Sum()
            : codes.Sum(code => perLeeftijd.TryGetValue(code, out var aantal) ? aantal : 0);
    }

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
