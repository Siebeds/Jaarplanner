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

        // FOUR layers, and the class-scoped two are filtered to THIS class (owner ruling 2026-08-03; the full
        // reasoning and the rejected alternatives are on IDekkingOpslag).
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

        // Layer 3 — subdoelen, per subthema. Subthema is scoped per klas AND leeftijd (Art. IX.2), so the KlasId
        // filter is what stops class A claiming dekking for what class B teaches.
        var subdoelen = await _context.Themas
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .SelectMany(t => t.Subthemas
                .Where(st => st.KlasId == klasId)
                .SelectMany(st => st.Subdoelen
                    .Where(sd => sd.Koppeling.Status == KoppelingStatus.Aanvaard
                        || sd.Koppeling.Status == KoppelingStatus.Manueel)
                    .Select(sd => new DekkendeKoppeling(sd.Koppeling.LeerplandoelCode, t.Naam))))
            .ToListAsync(cancellationToken);

        // Layer 4 — activiteit links, one level deeper. Scoped by the SUBTHEMA's klas, not the activiteit's:
        // an activiteit has no klas of its own, it inherits the scope of the subthema it sits in.
        var activiteiten = await _context.Themas
            .AsNoTracking()
            .Where(t => ids.Contains(t.Id))
            .SelectMany(t => t.Subthemas
                .Where(st => st.KlasId == klasId)
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
    public async Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
        IReadOnlyCollection<string>? jaarFasen = null,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Leerplandoelen.AsNoTracking();

        // Null/empty means the whole curriculum, which is what every caller asks for today. See IDekkingOpslag for
        // why that is an open Art. XIV decision rather than a considered answer, and why this seam is implemented
        // and tested despite having no non-null caller yet.
        if (jaarFasen is { Count: > 0 })
        {
            var fasen = jaarFasen.ToList();
            query = query.Where(l => fasen.Contains(l.JaarFase));
        }

        return await query.ToListAsync(cancellationToken);
    }
}
