using Jaarplanner.Application.Dekking;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Dekking;

/// <summary>
/// EF Core implementation of <see cref="IDekkingOpslag"/> (E5-01, Art. VIII layering).
/// <para>
/// <b>Every read is untracked and mutates nothing.</b> Coverage is computed, never stored (Art. V.1), and the
/// curriculum it reads is read-only reference data (Art. III.1).
/// </para>
/// </summary>
public sealed class EfDekkingOpslag : IDekkingOpslag
{
    private readonly AppDbContext _context;

    public EfDekkingOpslag(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<DekkendeKoppeling>> HaalDekkendeKoppelingenAsync(
        Guid klasId,
        IReadOnlyCollection<Guid> themaIds,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(themaIds);

        if (themaIds.Count == 0)
        {
            // No placed thema means no coverage, and asking the database to prove it is wasted work. Returning
            // early also keeps the generated SQL free of an empty IN () list, which Npgsql renders as a
            // never-true predicate rather than an error — correct, but only by accident.
            return [];
        }

        // Materialised so EF parameterises one list rather than re-enumerating the caller's collection per query.
        var ids = themaIds.Distinct().ToList();

        // The AGES this class teaches, which is how a class reaches its subthema's since the 2026-08-30 amendment
        // to Art. IX.2. `null` means the ages cannot be derived (the graadklas ordinal, Art. XIV) and the layers
        // below then include every subthema rather than none — a class we cannot scope must not be reported as
        // covering nothing, which is the one direction a coverage figure may never move by itself.
        var codes = (await Klasleeftijden.VoorKlasAsync(_context, klasId, cancellationToken)).Waarden;

        // FOUR layers, and the age-scoped two are filtered to THIS class's ages (owner ruling 2026-08-03, and
        // its scoping mechanism amended 2026-08-30; the full reasoning and the rejected alternatives are on
        // IDekkingOpslag).
        //
        // Every layer is reached through Themas so the thema NAME comes back with the code: Art. V.4 wants the
        // overview exportable as proof of coverage, and a proof that cannot say through which thema a goal is
        // covered is an assertion, not evidence.
        //
        // The aanvaard/manueel filter is written inline in each of the four, which is duplication EF forces: a
        // call to a shared predicate method does not translate to SQL. It is pinned by DekkingLagenPostgresTests
        // instead of by extraction — see IDekkingOpslag for why that is E1-17's problem and not this story's.
        //
        // FOUR SEPARATE ROUND TRIPS, unioned in memory, and that is a correction rather than a preference. The
        // first version of this method built one IQueryable with `.Concat(...).Distinct()` over the four and let
        // Npgsql translate a single UNION. It does not: EF throws "Unable to translate set operation after client
        // projection has been applied", because each branch already projects into the DekkendeKoppeling record.
        // Projecting later and unioning first does not help either — the union then has to carry the owned
        // collections themselves. So the union moves client-side, which is exactly what
        // LeerplandoelenQuery.HaalKoppelingenAsync already does for these same four layers.
        //
        // This is the defect the E2-06 antagonist carry-forward predicted, and it is worth being precise about why
        // it was invisible until a real database ran it: the EF in-memory provider evaluates the whole expression
        // in LINQ, so the one-query version PASSED there and threw only against PostgreSQL. That carry-forward
        // asked for exactly this test, and it earned its place on the first run.
        //
        // The cost is bounded and small: four statements over one class's placed thema's, on a primary-school
        // dataset. E1-16's facet query deliberately accepts ten for a comparable reason.

        // Layer 1 — themadoelen. School-wide (Art. IX.2): they belong to the thema, so they count for every class
        // that places it.
        var themadoelen = await _context.Themas
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .SelectMany(t => t.Themadoelen
                .Where(td => td.Koppeling.Status == KoppelingStatus.Aanvaard
                    || td.Koppeling.Status == KoppelingStatus.Manueel)
                .Select(td => new DekkendeKoppeling(td.Koppeling.LeerplandoelCode, t.Naam)))
            .ToListAsync(cancellationToken);

        // Layer 2 — the thema's accepted/adjusted AI doelsuggesties. Also school-wide. This is the layer
        // OpstapImportService.KoppelingAantallenAsync omits, which is the defect E1-17 owns; it is included here.
        var suggesties = await _context.Themas
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .SelectMany(t => t.Doelsuggesties
                .Where(k => k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)
                .Select(k => new DekkendeKoppeling(k.LeerplandoelCode, t.Naam)))
            .ToListAsync(cancellationToken);

        // Layer 3 — subdoelen, per subthema. A subthema is scoped by leeftijd (Art. IX.2), so the leeftijd filter
        // is what stops an L3 class claiming dekking for what a kleuterklas teaches. It no longer separates two
        // classes of the SAME age, and it is not meant to: they share this content by design now.
        var subdoelen = await _context.Themas
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Subdoelen
                    .Where(sd => sd.Koppeling.Status == KoppelingStatus.Aanvaard
                        || sd.Koppeling.Status == KoppelingStatus.Manueel)
                    .Select(sd => new DekkendeKoppeling(sd.Koppeling.LeerplandoelCode, t.Naam))))
            .ToListAsync(cancellationToken);

        // Layer 4 — activiteit links, one level deeper. Scoped by the SUBTHEMA's leeftijd, not the activiteit's:
        // an activiteit has no age of its own, it inherits the scope of the subthema it sits in.
        var activiteiten = await _context.Themas
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Activiteiten
                    .SelectMany(a => a.Doelkoppelingen
                        .Where(k => k.Status == KoppelingStatus.Aanvaard
                            || k.Status == KoppelingStatus.Manueel)
                        .Select(k => new DekkendeKoppeling(k.LeerplandoelCode, t.Naam)))))
            .ToListAsync(cancellationToken);

        // Distinct because the same thema may carry the same code in two layers (a themadoel the teacher also
        // accepted as a suggestion). That duplication would not inflate the coverage figure, which counts doelen,
        // but it would name the thema twice in the evidence list and read as two separate reasons.
        return themadoelen
            .Concat(suggesties)
            .Concat(subdoelen)
            .Concat(activiteiten)
            .Distinct()
            .ToList();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<KandidaatKoppeling>> HaalKandidaatKoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        // THE SAME FOUR LAYERS AND THE SAME CLASS SCOPING as HaalDekkendeKoppelingenAsync above (owner ruling
        // 2026-08-03), and the same four round trips for the same untranslatable-UNION reason. What differs is only
        // what is let through:
        //
        //   * no thema-id filter, because "the thema that carries this goal is in no period" is one of the
        //     things the gap-analyse exists to say, and a query restricted to placed thema's could never say it;
        //   * `voorgesteld` links are included beside the decided ones, flagged rather than mixed, because "the link
        //     itself is still undecided" is another of them.
        //
        // `geweigerd` is excluded in every layer. That is a status decision this read makes and IDekkingOpslag
        // records the consequence it imposes on the copy: a goal linked only by rejected links reaches the screen as
        // "no thema covers this", which is true, and must never be worded as "no thema is linked to this", which is
        // not.
        //
        // The predicate is written out four times because EF cannot translate a call to a shared one. That is E1-17's
        // problem rather than this story's; what this story owes is that these four agree with the covering read's
        // four, which DekkingLagenPostgresTests asserts directly rather than leaving to inspection.

        // Same age scoping as the covering read above, and the same meaning for `null`: cannot be derived, so
        // widen. See the note there.
        var codes = (await Klasleeftijden.VoorKlasAsync(_context, klasId, cancellationToken)).Waarden;

        // Layer 1 — themadoelen, school-wide.
        var themadoelen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Themadoelen
                .Where(td => td.Koppeling.Status != KoppelingStatus.Geweigerd)
                .Select(td => new KandidaatKoppeling(
                    td.Koppeling.LeerplandoelCode,
                    t.Id,
                    t.Naam,
                    td.Koppeling.Status == KoppelingStatus.Aanvaard
                        || td.Koppeling.Status == KoppelingStatus.Manueel)))
            .ToListAsync(cancellationToken);

        // Layer 2 — the thema's AI doelsuggesties, school-wide. Undecided ones are the whole point here: this is the
        // layer that produces the KoppelingNietBeslist cause, the state a thema is in right after FR-4 matching.
        var suggesties = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Doelsuggesties
                .Where(k => k.Status != KoppelingStatus.Geweigerd)
                .Select(k => new KandidaatKoppeling(
                    k.LeerplandoelCode,
                    t.Id,
                    t.Naam,
                    k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)))
            .ToListAsync(cancellationToken);

        // Layer 3 — subdoelen, scoped to the subthema's at this class's ages (Art. IX.2).
        var subdoelen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Subdoelen
                    .Where(sd => sd.Koppeling.Status != KoppelingStatus.Geweigerd)
                    .Select(sd => new KandidaatKoppeling(
                        sd.Koppeling.LeerplandoelCode,
                        t.Id,
                        t.Naam,
                        sd.Koppeling.Status == KoppelingStatus.Aanvaard
                            || sd.Koppeling.Status == KoppelingStatus.Manueel))))
            .ToListAsync(cancellationToken);

        // Layer 4 — activiteit links, scoped by the SUBTHEMA's leeftijd, as above.
        var activiteiten = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .Where(st => codes == null || codes.Contains(st.Leeftijd))
                .SelectMany(st => st.Activiteiten
                    .SelectMany(a => a.Doelkoppelingen
                        .Where(k => k.Status != KoppelingStatus.Geweigerd)
                        .Select(k => new KandidaatKoppeling(
                            k.LeerplandoelCode,
                            t.Id,
                            t.Naam,
                            k.Status == KoppelingStatus.Aanvaard || k.Status == KoppelingStatus.Manueel)))))
            .ToListAsync(cancellationToken);

        // Distinct, like the covering read, because one thema may carry one code in two layers. Here the duplication
        // would matter more than there: the same thema name twice in a cause line reads as two separate reasons.
        //
        // A code carried by one thema BOTH as a decided link and as an undecided suggestion survives as two rows,
        // deliberately: they are different facts, and DekkingService's classification takes the decided one first, so
        // collapsing them would have to pick a winner here — in the layer that knows least about why.
        return themadoelen
            .Concat(suggesties)
            .Concat(subdoelen)
            .Concat(activiteiten)
            .Distinct()
            .ToList();
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
        IReadOnlyCollection<string>? jaarFasen = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Leerplandoelen.AsNoTracking();

        // Null/empty means the whole curriculum. Since the owner ruling of 2026-08-04 that is the explicit
        // Dekkingsbereik.HeelCurriculum choice (and the fallback for a class whose jaar/fase cannot be derived)
        // rather than the only available answer; the default now passes real codes. See IDekkingOpslag.
        if (jaarFasen is { Count: > 0 })
        {
            var fasen = jaarFasen.ToList();
            query = query.Where(l => fasen.Contains(l.JaarFase));
        }

        return await query.ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public Task<int> TelAlleLeerplandoelenAsync(CancellationToken cancellationToken = default) =>
        _context.Leerplandoelen.AsNoTracking().CountAsync(cancellationToken);

    /// <inheritdoc />
    public async Task<Klasscope?> HaalKlasscopeAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        // Projected to a nullable int rather than loading the Klas: this needs one column, and materialising the
        // entity would put a mutable aggregate in reach of a read-only computation.
        //
        // The `(int?)` projection is load-bearing. Without it `FirstOrDefaultAsync` on an `int` sequence yields 0 for
        // "no such class" — and 0 is a VALID leerjaar here, the kleutergroep, so a missing class would silently be
        // measured against JK/K2/K3 instead of falling back to the whole curriculum.
        //
        // It is defensive rather than covered by an endpoint test, and that is worth stating rather than implying:
        // DekkingService reads the jaarplan first and a missing class 404s there, so the only way to reach this
        // branch is a class deleted BETWEEN the two reads. The `null` path itself is pinned at the port boundary by
        // DekkingServiceTests (`Leerjaar = null`); what has no test is the race that produces it.
        // Two columns now, in one projection, and still not the entity. A nullable STRUCT keeps the
        // "no such class" signal the `(int?)` cast used to carry: `FirstOrDefaultAsync` on a
        // `Klasscope` sequence would yield `default` for a missing class, and `default.Leerjaar` is 0,
        // which is a VALID leerjaar here. So the projection is to `Klasscope?` rather than `Klasscope`.
        return await _context.Klassen
            .AsNoTracking()
            .Where(k => k.Id == klasId)
            .Select(k => (Klasscope?)new Klasscope(k.Leerjaar, k.Jaarfase))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
