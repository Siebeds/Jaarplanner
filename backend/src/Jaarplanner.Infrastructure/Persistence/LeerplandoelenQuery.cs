using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="ILeerplandoelenQuery"/> over <see cref="AppDbContext"/> (E1-16).
/// <para>
/// Every read is <c>AsNoTracking</c> over read-only reference data (Art. III.1): this class has no
/// <c>SaveChanges</c>, no mutator and no write path of any kind.
/// </para>
/// <para>
/// <b>Case-insensitive matching happens in Postgres, and the two mechanisms are not interchangeable.</b>
/// The exact filters (discipline/domein/subdomein/jaarFase) compare <c>lower(col) = lower(@value)</c>, which
/// EF translates from <see cref="string.ToLower()"/>; the free-text search uses <c>ILIKE</c> because it needs
/// a substring match. A .NET <c>OrdinalIgnoreCase</c> comparer is wrong for both: in LINQ-to-Entities it
/// translates to a case-<i>sensitive</i> SQL predicate.
/// </para>
/// <para>
/// <b>The search term is escaped before it becomes an <c>ILIKE</c> pattern.</b> <c>ILIKE</c>'s right-hand
/// side is a pattern, so an unescaped term makes <c>%</c> and <c>_</c> wildcards. This project has already
/// paid for that once: an unescaped class name made "K3_groen" match the existing "K3-groen" and a valid
/// class was refused as a duplicate that did not exist (see <c>KlasBeheerService</c>). Here the symptom
/// would be quieter and worse: a teacher searching for the literal <c>%</c> would get the entire
/// curriculum back and have no way to tell that their term was ignored.
/// </para>
/// <para>
/// <b>None of this is testable on the EF in-memory provider.</b> It has no <c>ILIKE</c>, no collation and no
/// real ordering, so a green in-memory suite would say nothing about the behaviour of this class. Its tests
/// live in <c>Jaarplanner.IntegrationTests/Postgres</c> and run against real PostgreSQL.
/// </para>
/// </summary>
public sealed class LeerplandoelenQuery : ILeerplandoelenQuery
{
    /// <summary>
    /// The escape character for the <c>ILIKE</c> patterns below. Backslash is also Postgres' default, but it
    /// is passed explicitly so the behaviour does not depend on the server's
    /// <c>standard_conforming_strings</c> setting.
    /// </summary>
    private const string LikeEscape = @"\";

    private readonly AppDbContext _context;

    public LeerplandoelenQuery(AppDbContext context)
    {
        _context = context;
    }

    /// <inheritdoc />
    public async Task<LeerplandoelenPagina> ZoekAsync(
        LeerplandoelFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        var overslaan = Math.Max(0, filter.Overslaan);
        var aantal = Math.Clamp(filter.Aantal, 1, LeerplandoelFilter.MaxPaginaGrootte);

        var query = Gefilterd(filter);

        // Two round-trips, both bounded: the count, then the page. Neither grows with the number of rows
        // returned, so this stays two statements whether the filter matches 50 goals or 2 500 (no N+1).
        var totaal = await query.CountAsync(cancellationToken);

        var regels = await query
            .OrderBy(l => l.Domein)
            .ThenBy(l => l.Subdomein)
            .ThenBy(l => l.Code)
            .Skip(overslaan)
            .Take(aantal)
            .Select(l => new LeerplandoelRegelWeergave(
                l.Code,
                l.Doelsoort,
                l.JaarFase,
                l.Domein,
                l.Subdomein,
                l.Tekst,
                l.MinimumdoelRef,
                l.NietMeerInOpstap))
            .ToListAsync(cancellationToken);

        return new LeerplandoelenPagina(regels, totaal, overslaan, aantal);
    }

    /// <inheritdoc />
    public async Task<LeerplandoelDetailWeergave?> HaalDetailAsync(
        string code,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var genormaliseerd = code.Trim().ToLower();

        // The discipline name and the concorded minimumdoel are joined in the same statement rather than
        // fetched afterwards: both are optional, and a null must mean "no such row" rather than "we did not
        // look". `disciplines` is seeded reference data, but a goal whose discipline number has no row is
        // possible (Art. III.1 forbids inventing one), so the join is a left join.
        var doel = await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => l.Code.ToLower() == genormaliseerd)
            .Select(l => new
            {
                Doel = l,
                DisciplineNaam = _context.Disciplines
                    .Where(d => d.Nummer == l.DisciplineNummer)
                    .Select(d => d.Naam)
                    .FirstOrDefault(),
                Minimumdoel = _context.Minimumdoelen
                    .Where(m => m.Ref == l.MinimumdoelRef)
                    .Select(m => new MinimumdoelWeergave(m.Ref, m.Leeftijd, m.Nr, m.Omschrijving))
                    .FirstOrDefault(),
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (doel is null)
        {
            return null;
        }

        var koppelingen = await HaalKoppelingenAsync(doel.Doel.Code, cancellationToken);

        return new LeerplandoelDetailWeergave(
            doel.Doel.Code,
            doel.Doel.Doelsoort,
            doel.Doel.JaarFase,
            doel.Doel.DisciplineNummer,
            doel.DisciplineNaam,
            doel.Doel.Domein,
            doel.Doel.Subdomein,
            doel.Doel.Cluster,
            doel.Doel.Tekst,
            doel.Doel.Voorbeelden,
            doel.Doel.Toelichting,
            doel.Doel.Woordenschat,
            doel.Doel.MinimumdoelRef,
            doel.Minimumdoel,
            doel.Doel.NietMeerInOpstap,
            koppelingen);
    }

    /// <inheritdoc />
    public async Task<LeerplandoelFacettenWeergave> HaalFacettenAsync(
        CancellationToken cancellationToken = default)
    {
        // Grouped in the database, one statement per dimension: four bounded aggregates rather than
        // materialising the curriculum to count it in memory.
        var disciplines = await _context.Leerplandoelen
            .AsNoTracking()
            .GroupBy(l => l.DisciplineNummer)
            .Select(g => new
            {
                Nummer = g.Key,
                Aantal = g.Count(),
            })
            .ToListAsync(cancellationToken);

        var disciplineNamen = await _context.Disciplines
            .AsNoTracking()
            .Select(d => new { d.Nummer, d.Naam })
            .ToListAsync(cancellationToken);

        var taxonomie = await _context.Leerplandoelen
            .AsNoTracking()
            .GroupBy(l => new { l.Domein, l.Subdomein })
            .Select(g => new
            {
                g.Key.Domein,
                g.Key.Subdomein,
                Aantal = g.Count(),
            })
            .ToListAsync(cancellationToken);

        var doelsoorten = await _context.Leerplandoelen
            .AsNoTracking()
            .GroupBy(l => l.Doelsoort)
            .Select(g => new { Doelsoort = g.Key, Aantal = g.Count() })
            .ToListAsync(cancellationToken);

        var jaarFasen = await _context.Leerplandoelen
            .AsNoTracking()
            .GroupBy(l => l.JaarFase)
            .Select(g => new { JaarFase = g.Key, Aantal = g.Count() })
            .ToListAsync(cancellationToken);

        var totaal = doelsoorten.Sum(d => d.Aantal);

        return new LeerplandoelFacettenWeergave(
            totaal,
            [.. disciplines
                .Select(d => new DisciplineFacet(
                    d.Nummer,
                    disciplineNamen.FirstOrDefault(n => n.Nummer == d.Nummer)?.Naam,
                    d.Aantal))
                // Discipline numbers are strings with a 9.x split, so an ordinal sort is the only ordering
                // that is stable without assuming the numbering scheme (Art. VII.0).
                .OrderBy(d => d.Nummer, StringComparer.Ordinal)],
            [.. taxonomie
                .GroupBy(t => t.Domein)
                .Select(g => new DomeinFacet(
                    g.Key,
                    g.Sum(t => t.Aantal),
                    [.. g.Select(t => new SubdomeinFacet(t.Subdomein, t.Aantal))
                        .OrderBy(s => s.Subdomein, StringComparer.CurrentCulture)]))
                .OrderBy(d => d.Domein, StringComparer.CurrentCulture)],
            [.. doelsoorten
                .Select(d => new DoelsoortFacet(d.Doelsoort, d.Aantal))
                // Enum order, which is the official MD/G/+/P/S/A order of Art. VII.1 — not alphabetical,
                // which would put the decreed minimumdoelen in the middle of the list.
                .OrderBy(d => d.Doelsoort)],
            [.. jaarFasen
                .Select(j => new JaarFaseFacet(j.JaarFase, j.Aantal))
                .OrderBy(j => j.JaarFase, StringComparer.Ordinal)]);
    }

    /// <summary>
    /// Applies the filter dimensions. Each is skipped when absent, so the predicate a default filter
    /// produces is "no predicate at all" rather than a chain of tautologies.
    /// </summary>
    private IQueryable<Leerplandoel> Gefilterd(LeerplandoelFilter filter)
    {
        IQueryable<Leerplandoel> query = _context.Leerplandoelen.AsNoTracking();

        if (Genormaliseerd(filter.Discipline) is { } discipline)
        {
            query = query.Where(l => l.DisciplineNummer.ToLower() == discipline);
        }

        if (Genormaliseerd(filter.Domein) is { } domein)
        {
            query = query.Where(l => l.Domein.ToLower() == domein);
        }

        if (Genormaliseerd(filter.Subdomein) is { } subdomein)
        {
            query = query.Where(l => l.Subdomein.ToLower() == subdomein);
        }

        if (filter.Doelsoort is { } doelsoort)
        {
            query = query.Where(l => l.Doelsoort == doelsoort);
        }

        if (Genormaliseerd(filter.JaarFase) is { } jaarFase)
        {
            query = query.Where(l => l.JaarFase.ToLower() == jaarFase);
        }

        if (!string.IsNullOrWhiteSpace(filter.Zoekterm))
        {
            // One field, two haystacks: a teacher who knows the code types the code, and one who does not
            // types a word from the goal. Splitting them into two inputs would make the register ask the
            // teacher which kind of search they are doing.
            var patroon = $"%{LikePatroonVeilig(filter.Zoekterm.Trim())}%";
            query = query.Where(l =>
                EF.Functions.ILike(l.Code, patroon, LikeEscape) ||
                EF.Functions.ILike(l.Tekst, patroon, LikeEscape));
        }

        return query;
    }

    /// <summary>
    /// Loads every school-content link to this code, across the four owned link tables (Art. IX.2). Four
    /// bounded statements, one per layer — not a per-thema loop, and not sensitive to how many thema's exist.
    /// <para>
    /// Every status is included, <c>voorgesteld</c> and <c>geweigerd</c> too; see
    /// <see cref="DoelKoppelingWeergave"/> for why this is wider than the Art. V coverage definition.
    /// </para>
    /// </summary>
    private async Task<List<DoelKoppelingWeergave>> HaalKoppelingenAsync(
        string code,
        CancellationToken cancellationToken)
    {
        // Every link is reached through Themas, because the thema name is what a teacher recognises and
        // each link layer hangs off a thema (directly, or via a subthema).
        var themadoelen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Themadoelen
                .Where(td => td.Koppeling.LeerplandoelCode == code)
                .Select(td => new DoelKoppelingWeergave(
                    KoppelingHerkomst.Themadoel,
                    t.Naam,
                    null,
                    td.Koppeling.Status)))
            .ToListAsync(cancellationToken);

        var suggesties = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Doelsuggesties
                .Where(k => k.LeerplandoelCode == code)
                .Select(k => new DoelKoppelingWeergave(
                    KoppelingHerkomst.Doelsuggestie,
                    t.Naam,
                    null,
                    k.Status)))
            .ToListAsync(cancellationToken);

        var subdoelen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .SelectMany(st => st.Subdoelen
                    .Where(sd => sd.Koppeling.LeerplandoelCode == code)
                    .Select(sd => new DoelKoppelingWeergave(
                        KoppelingHerkomst.Subdoel,
                        t.Naam,
                        st.Naam,
                        sd.Koppeling.Status))))
            .ToListAsync(cancellationToken);

        var activiteiten = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Subthemas
                .SelectMany(st => st.Activiteiten
                    .SelectMany(a => a.Doelkoppelingen
                        .Where(k => k.LeerplandoelCode == code)
                        .Select(k => new DoelKoppelingWeergave(
                            KoppelingHerkomst.Activiteit,
                            t.Naam,
                            a.Naam,
                            k.Status)))))
            .ToListAsync(cancellationToken);

        return
        [
            .. themadoelen
                .Concat(suggesties)
                .Concat(subdoelen)
                .Concat(activiteiten)
                .OrderBy(k => k.ThemaNaam, StringComparer.CurrentCulture)
                .ThenBy(k => k.Herkomst)
                .ThenBy(k => k.Onderdeel, StringComparer.CurrentCulture),
        ];
    }

    /// <summary>Trims, case-folds, and turns a blank value into null so the caller can skip the dimension.</summary>
    private static string? Genormaliseerd(string? waarde) =>
        string.IsNullOrWhiteSpace(waarde) ? null : waarde.Trim().ToLowerInvariant();

    /// <summary>
    /// Escapes the LIKE metacharacters so the term is matched literally. The backslash goes first: escaping
    /// it after <c>%</c>/<c>_</c> would re-escape the escape characters this method just inserted.
    /// </summary>
    private static string LikePatroonVeilig(string term) => term
        .Replace(@"\", @"\\", StringComparison.Ordinal)
        .Replace("%", @"\%", StringComparison.Ordinal)
        .Replace("_", @"\_", StringComparison.Ordinal);
}
