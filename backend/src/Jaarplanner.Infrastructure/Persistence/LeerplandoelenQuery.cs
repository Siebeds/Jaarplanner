using System.Linq.Expressions;
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
        Koppelingzichtbaarheid zichtbaarheid,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        var genormaliseerd = code.Trim().ToLower();

        // The discipline name and the concorded minimumdoel are resolved in the same statement rather than
        // fetched afterwards, so a null means "no such row" instead of "we did not look".
        //
        // Both are LEFT joins, and neither null is reachable today: `DisciplineNummer` is required with a
        // Restrict FK to `disciplines.Nummer`, and `MinimumdoelRef` is a Restrict FK to `minimumdoelen.Ref`,
        // so a goal naming a discipline or a minimumdoel that has no row cannot be committed at all. (An
        // earlier revision of this comment claimed an unknown discipline number "is possible"; it is not, and
        // that was the mirror image of the minimumdoel branch this story flagged correctly.) The joins stay
        // left rather than inner because an inner join would silently DROP such a goal from the register if a
        // schema change ever made it possible, and losing a curriculum row is worse than showing one with a
        // missing name.
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

        var koppelingen = await HaalKoppelingenAsync(doel.Doel.Code, zichtbaarheid, cancellationToken);
        var gerelateerdeDoelen = await HaalGerelateerdeDoelenAsync(doel.Doel.Code, doel.Doel.MinimumdoelRef, cancellationToken);

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
            koppelingen,
            gerelateerdeDoelen);
    }

    /// <summary>
    /// Other leerplandoelen concorded to the same minimumdoel as <paramref name="code"/> (excluding itself),
    /// so the detail screen can show "which other goals does this government target also cover?". Empty when
    /// <paramref name="minimumdoelRef"/> is null — an unconcorded goal has nothing to relate through.
    /// </summary>
    private async Task<IReadOnlyList<GerelateerdLeerplandoelWeergave>> HaalGerelateerdeDoelenAsync(
        string code,
        string? minimumdoelRef,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(minimumdoelRef))
        {
            return [];
        }

        return await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => l.MinimumdoelRef == minimumdoelRef && l.Code != code)
            .OrderBy(l => l.JaarFase)
            .ThenBy(l => l.Code)
            .Select(l => new GerelateerdLeerplandoelWeergave(l.Code, l.Tekst, l.JaarFase, l.Domein, l.Subdomein))
            .ToListAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<LeerplandoelFacettenWeergave> HaalFacettenAsync(
        LeerplandoelFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        // Two aggregates per dimension: the OPTION SET from the whole curriculum, and the COUNT under the rest
        // of the filter. Keeping them apart is the point of this shape (antagonist finding 12):
        //
        //   * options from all rows  -> a select never loses entries while a teacher is using it, so the
        //     control does not shift under the pointer;
        //   * counts under "the rest of the filter" (every dimension except the one being counted) -> a number
        //     answers "how many would I get if I picked this?", which is the only reading under which it is
        //     true. Counting under the WHOLE filter instead would show the chosen option with its count and
        //     every sibling at 0, which is technically true and useless.
        //
        // A zero-count option is returned as 0 rather than dropped; whether it should disappear entirely is a
        // directie question and is not decided here.
        //
        // The statement count is FIXED and independent of how many leerplandoelen exist, which is the property
        // that matters on a table meant to hold the whole curriculum. Deliberately not one giant query: bounded
        // statements are readable, and this endpoint is hit once per filter change on read-only reference data.
        //
        // It is **ten** round trips: four option sets (discipline, taxonomie, doelsoort, jaarFase), four grouped
        // count aggregates, one name lookup over `Disciplines`, and the unfiltered total. By shape: four
        // Distinct() projections, four GroupBy aggregates, one dictionary and one Count.
        //
        // The number is pinned by `Facetten_zijn_een_vast_aantal_statements`, not by this comment, because a
        // figure in a comment drifts — and this one drifted twice. It first said "nine … all grouped
        // aggregates". The correction said "ten: five option sets … three Distinct() projections", which was
        // right about the total and wrong about the composition in both halves: the fifth "option set" is the
        // discipline-name lookup, and there are four Distinct() projections, not three. Twice is the argument
        // for the test.
        var disciplineOpties = await AlleWaardenAsync(l => l.DisciplineNummer, cancellationToken);
        var disciplineAantallen = await AantallenAsync(
            ZonderDimensie(filter, Facetdimensie.Discipline), l => l.DisciplineNummer, cancellationToken);

        var disciplineNamen = await _context.Disciplines
            .AsNoTracking()
            .Select(d => new { d.Nummer, d.Naam })
            .ToDictionaryAsync(d => d.Nummer, d => d.Naam, cancellationToken);

        // The taxonomy is one dimension, grouped by the composite (domein, subdomein) key (Art. VII.0). Its
        // counts exclude BOTH domein and subdomein, so a domein's number says what choosing it would yield,
        // and a subdomein's number is already restricted to its own domein by the grouping itself.
        var taxonomieOpties = await _context.Leerplandoelen
            .AsNoTracking()
            .Select(l => new { l.Domein, l.Subdomein })
            .Distinct()
            .ToListAsync(cancellationToken);

        var taxonomieAantallen = await Gefilterd(ZonderDimensie(filter, Facetdimensie.Taxonomie))
            .GroupBy(l => new { l.Domein, l.Subdomein })
            .Select(g => new { g.Key.Domein, g.Key.Subdomein, Aantal = g.Count() })
            .ToListAsync(cancellationToken);

        var taxonomieTelling = taxonomieAantallen.ToDictionary(
            t => (t.Domein, t.Subdomein),
            t => t.Aantal);

        var doelsoortOpties = await AlleWaardenAsync(l => l.Doelsoort, cancellationToken);
        var doelsoortAantallen = await AantallenAsync(
            ZonderDimensie(filter, Facetdimensie.Doelsoort), l => l.Doelsoort, cancellationToken);

        var jaarFaseOpties = await AlleWaardenAsync(l => l.JaarFase, cancellationToken);
        var jaarFaseAantallen = await AantallenAsync(
            ZonderDimensie(filter, Facetdimensie.JaarFase), l => l.JaarFase, cancellationToken);

        // Deliberately UNFILTERED: this figure's only job is to tell "nothing imported" from "filtered to
        // nothing", and scoping it to the filter would destroy that distinction.
        var totaal = await _context.Leerplandoelen.AsNoTracking().CountAsync(cancellationToken);

        return new LeerplandoelFacettenWeergave(
            totaal,
            [.. disciplineOpties
                .Select(nummer => new DisciplineFacet(
                    nummer,
                    disciplineNamen.GetValueOrDefault(nummer),
                    disciplineAantallen.GetValueOrDefault(nummer)))
                .OrderBy(d => d.Nummer, DisciplinenummerVergelijker.Instantie)],
            [.. taxonomieOpties
                .GroupBy(t => t.Domein)
                .Select(g =>
                {
                    var subdomeinen = g
                        .Select(t => new SubdomeinFacet(
                            t.Subdomein,
                            taxonomieTelling.GetValueOrDefault((t.Domein, t.Subdomein))))
                        .OrderBy(s => s.Subdomein, StringComparer.CurrentCulture)
                        .ToList();

                    // The domein count is the sum of its own subdomeinen, so the tree can never disagree with
                    // its leaves (a Postgres test asserts exactly that).
                    return new DomeinFacet(g.Key, subdomeinen.Sum(s => s.Aantal), subdomeinen);
                })
                .OrderBy(d => d.Domein, StringComparer.CurrentCulture)],
            [.. doelsoortOpties
                .Select(soort => new DoelsoortFacet(soort, doelsoortAantallen.GetValueOrDefault(soort)))
                // Enum order, which is the official MD/G/+/P/S/A order of Art. VII.1 — not alphabetical,
                // which would put the decreed minimumdoelen in the middle of the list.
                .OrderBy(d => d.Doelsoort)],
            [.. jaarFaseOpties
                .Select(fase => new JaarFaseFacet(fase, jaarFaseAantallen.GetValueOrDefault(fase)))
                .OrderBy(j => j.JaarFase, StringComparer.Ordinal)]);
    }

    /// <summary>The dimensions a facet count is computed "without", so each number answers its own question.</summary>
    private enum Facetdimensie
    {
        Discipline,
        Taxonomie,
        Doelsoort,
        JaarFase,
    }

    /// <summary>
    /// The filter minus one dimension. <see cref="Facetdimensie.Taxonomie"/> drops <c>Domein</c> and
    /// <c>Subdomein</c> together, because Art. VII.0 makes them one composite dimension: dropping only the
    /// subdomein would count a domein's options against its own domein filter and return that domein's total
    /// for each of them.
    /// </summary>
    private static LeerplandoelFilter ZonderDimensie(LeerplandoelFilter filter, Facetdimensie dimensie) =>
        dimensie switch
        {
            Facetdimensie.Discipline => filter with { Discipline = null },
            Facetdimensie.Taxonomie => filter with { Domein = null, Subdomein = null },
            Facetdimensie.Doelsoort => filter with { Doelsoort = null },
            Facetdimensie.JaarFase => filter with { JaarFasen = null },
            _ => filter,
        };

    /// <summary>
    /// Every distinct value of one column across the <b>whole</b> curriculum: the stable option set, so a
    /// filter control never loses entries as it is used.
    /// </summary>
    private Task<List<TWaarde>> AlleWaardenAsync<TWaarde>(
        Expression<Func<Leerplandoel, TWaarde>> kolom,
        CancellationToken cancellationToken) =>
        _context.Leerplandoelen
            .AsNoTracking()
            .Select(kolom)
            .Distinct()
            .ToListAsync(cancellationToken);

    /// <summary>How many rows each value of one column has under the given filter. Values absent from the
    /// result are genuinely zero, which is why callers read it with <c>GetValueOrDefault</c>.</summary>
    private async Task<Dictionary<TWaarde, int>> AantallenAsync<TWaarde>(
        LeerplandoelFilter filter,
        Expression<Func<Leerplandoel, TWaarde>> kolom,
        CancellationToken cancellationToken)
        where TWaarde : notnull =>
        await Gefilterd(filter)
            .GroupBy(kolom)
            .Select(g => new { Waarde = g.Key, Aantal = g.Count() })
            .ToDictionaryAsync(g => g.Waarde, g => g.Aantal, cancellationToken);

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

        // Matched as "any of". Normalised into a plain List first, because the comparison is case-insensitive and
        // `Contains` over a materialised list is what EF translates into a SQL `IN`; the sibling in
        // `EfDekkingOpslag` does the same for the coverage scope.
        if (filter.JaarFasen is { Count: > 0 })
        {
            var fasen = filter.JaarFasen
                .Select(Genormaliseerd)
                .OfType<string>()
                .ToList();

            // Every entry was blank, which is "no filter" rather than "match nothing". A list of one empty string
            // would otherwise return zero rows and read to a teacher as an empty curriculum.
            if (fasen.Count > 0)
            {
                query = query.Where(l => fasen.Contains(l.JaarFase.ToLower()));
            }
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
        Koppelingzichtbaarheid zichtbaarheid,
        CancellationToken cancellationToken)
    {
        // Every link is reached through Themas, because the thema name is what a teacher recognises and
        // each link layer hangs off a thema (directly, or via a subthema).
        //
        // The two school-scoped layers (Art. IX.2) are always read: they belong to the school, not to a klas,
        // so no visibility question arises for them.
        var themadoelen = await _context.Themas
            .AsNoTracking()
            .SelectMany(t => t.Themadoelen
                .Where(td => td.Koppeling.LeerplandoelCode == code)
                .Select(td => new DoelKoppelingWeergave(
                    KoppelingHerkomst.Themadoel,
                    t.Naam,
                    null,
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
                    null,
                    k.Status)))
            .ToListAsync(cancellationToken);

        List<DoelKoppelingWeergave> subdoelen = [];
        List<DoelKoppelingWeergave> activiteiten = [];

        // The class/age-scoped layers are gated by the seam, and each row NAMES ITS KLAS. Both halves matter:
        // withholding them entirely would report a doel used by one class's activiteit as used nowhere (a
        // false statement a teacher would act on), while showing them unlabelled would let one class's
        // planning read as a school-wide fact. See Koppelingzichtbaarheid for the open FR-10.2 decision this
        // isolates rather than answers.
        if (zichtbaarheid == Koppelingzichtbaarheid.Alles)
        {
            subdoelen = await _context.Themas
                .AsNoTracking()
                .SelectMany(t => t.Subthemas
                    .SelectMany(st => st.Subdoelen
                        .Where(sd => sd.Koppeling.LeerplandoelCode == code)
                        .Select(sd => new DoelKoppelingWeergave(
                            KoppelingHerkomst.Subdoel,
                            t.Naam,
                            st.Naam,
                            // The subthema's own column now, where this used to be a correlated subquery into
                            // klassen. A subthema names its leeftijd directly (Art. IX.2 as amended 2026-08-30),
                            // so the join, its translation risk and its "klas row has gone" null are all gone
                            // with it.
                            st.Leeftijd,
                            sd.Koppeling.Status))))
                .ToListAsync(cancellationToken);

            activiteiten = await _context.Themas
                .AsNoTracking()
                .SelectMany(t => t.Subthemas
                    .SelectMany(st => st.Activiteiten
                        .SelectMany(a => a.Doelkoppelingen
                            .Where(k => k.LeerplandoelCode == code)
                            .Select(k => new DoelKoppelingWeergave(
                                KoppelingHerkomst.Activiteit,
                                t.Naam,
                                a.Naam,
                                st.Leeftijd,
                                k.Status)))))
                .ToListAsync(cancellationToken);
        }

        return
        [
            .. themadoelen
                .Concat(suggesties)
                .Concat(subdoelen)
                .Concat(activiteiten)
                .OrderBy(k => k.ThemaNaam, StringComparer.CurrentCulture)
                .ThenBy(k => k.Herkomst)
                .ThenBy(k => k.Leeftijd, StringComparer.Ordinal)
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
