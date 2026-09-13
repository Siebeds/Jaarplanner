using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IMinimumdoelenQuery"/> over <see cref="AppDbContext"/>.
/// Minimumdoelen have no discipline/domein/subdomein of their own; those are derived from the
/// concorded leerplandoelen (Art. VII.0 / IX.1). A minimumdoel therefore appears in every
/// (discipline, domein, subdomein) bucket that at least one of its concorded leerplandoelen
/// belongs to — which can be more than one bucket.
/// <para>
/// <b>A minimumdoel no loaded leerplandoel concords appears once, without a bucket, after all the others</b> (E1-22).
/// The base query is a <b>left</b> join for that reason. Until E1-22 it was an inner join, and the register then hid
/// every such minimumdoel: all 998 between the minimumdoelen import and the leerplandoelen import, and the six of
/// ADR-0032 decision 5 after it, while the screen said there were none. The facet dimensions (discipline, domein,
/// jaar/fase) exist only through a concorded goal, so they read the concorded rows alone and offer no empty option.
/// </para>
/// <para>
/// Every read is <c>AsNoTracking</c> over read-only reference data (Art. III.1).
/// </para>
/// </summary>
public sealed class MinimumdoelenQuery : IMinimumdoelenQuery
{
    private const string LikeEscape = @"\";

    private readonly AppDbContext _context;

    public MinimumdoelenQuery(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<MinimumdoelenPagina> ZoekAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        var overslaan = Math.Max(0, filter.Overslaan);
        var aantal = Math.Clamp(filter.Aantal, 1, MinimumdoelFilter.MaxPaginaGrootte);

        // The flat left join: minimumdoelen × leerplandoelen (via concordantie). Each (minimumdoel, leerplandoel) pair is
        // one bucket row candidate; a minimumdoel without a concorded goal is one row with no bucket.
        var query = Gefilterd(BasisQuery(), filter);

        var totaal = await query.Select(r => new { r.Ref, r.Domein, r.Subdomein, r.DisciplineNummer }).Distinct().CountAsync(cancellationToken);

        // Materialize the distinct (ref × bucket) combinations with their leerplandoel codes grouped.
        var rijen = await query
            .GroupBy(r => new
            {
                r.Ref,
                r.Leeftijd,
                r.Nr,
                r.Omschrijving,
                r.DisciplineNummer,
                r.Domein,
                r.Subdomein,
                r.Reden,
                r.Doelsets,
            })
            .Select(g => new
            {
                g.Key.Ref,
                g.Key.Leeftijd,
                g.Key.Nr,
                g.Key.Omschrijving,
                g.Key.DisciplineNummer,
                g.Key.Domein,
                g.Key.Subdomein,
                g.Key.Reden,
                g.Key.Doelsets,
                // The whole-number part of the discipline number ("9" of "9.2"), for a numeric order in SQL.
                Hoofd = g.Key.DisciplineNummer == null
                    ? null
                    : g.Key.DisciplineNummer.Contains(".")
                        ? g.Key.DisciplineNummer.Substring(0, g.Key.DisciplineNummer.IndexOf("."))
                        : g.Key.DisciplineNummer,
                Codes = g.Where(r => r.LeerplandoelCode != null).Select(r => r.LeerplandoelCode!).Distinct().ToList(),
            })
            // Rows without a bucket last, explicitly: PostgreSQL sorts NULL last ascending and LINQ to Objects (the
            // in-memory provider) first, so leaving it to the provider would order the two differently.
            .OrderBy(r => r.DisciplineNummer == null)
            // Disciplines in their numeric order (1, 2, …, 9.1, 9.2, 9.3, 10, 11), as DisciplinenummerVergelijker orders
            // the facets: a shorter whole-number part first, then that part, then the full number. As text, "10" sorted
            // before "2" and put Frans between Nederlands and Wiskunde (E1-22, antagonist round 1 MINOR).
            .ThenBy(r => r.Hoofd == null ? 0 : r.Hoofd.Length)
            .ThenBy(r => r.Hoofd)
            .ThenBy(r => r.DisciplineNummer)
            .ThenBy(r => r.Domein)
            .ThenBy(r => r.Subdomein)
            .ThenBy(r => r.Leeftijd)
            .ThenBy(r => r.Nr)
            .Skip(overslaan)
            .Take(aantal)
            .ToListAsync(cancellationToken);

        var disciplineNamen = await DisciplineNamenAsync(cancellationToken);

        var regels = rijen
            .Select(r => new MinimumdoelRegelWeergave(
                r.Ref,
                r.Leeftijd,
                r.Nr,
                r.Omschrijving,
                r.DisciplineNummer,
                r.DisciplineNummer is null ? null : disciplineNamen.GetValueOrDefault(r.DisciplineNummer),
                r.Domein,
                r.Subdomein,
                r.Codes,
                r.Reden,
                r.Doelsets is null ? [] : r.Doelsets.Split(',', StringSplitOptions.RemoveEmptyEntries)))
            .ToList();

        return new MinimumdoelenPagina(regels, totaal, overslaan, aantal);
    }

    /// <inheritdoc />
    public async Task<MinimumdoelFacettenWeergave> HaalFacettenAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        var disciplineOpties = await Geconcordeerd(BasisQuery())
            .Select(r => r.DisciplineNummer!)
            .Distinct()
            .ToListAsync(cancellationToken);

        var disciplineAantallen = await Geconcordeerd(Gefilterd(BasisQuery(), filter with { Discipline = null }))
            .Select(r => new { r.Ref, r.Domein, r.Subdomein, r.DisciplineNummer })
            .Distinct()
            .GroupBy(r => r.DisciplineNummer!)
            .Select(g => new { Nummer = g.Key, Aantal = g.Count() })
            .ToListAsync(cancellationToken);

        var disciplineNamen = await DisciplineNamenAsync(cancellationToken);

        var taxonomieOpties = await Geconcordeerd(BasisQuery())
            .Select(r => new { Domein = r.Domein!, Subdomein = r.Subdomein! })
            .Distinct()
            .ToListAsync(cancellationToken);

        var taxonomieAantallen = await Geconcordeerd(Gefilterd(BasisQuery(), filter with { Domein = null, Subdomein = null }))
            .Select(r => new { r.Ref, Domein = r.Domein!, Subdomein = r.Subdomein! })
            .Distinct()
            .GroupBy(r => new { r.Domein, r.Subdomein })
            .Select(g => new { g.Key.Domein, g.Key.Subdomein, Aantal = g.Count() })
            .ToListAsync(cancellationToken);

        var taxonomieTelling = taxonomieAantallen.ToDictionary(t => (t.Domein, t.Subdomein), t => t.Aantal);

        // JaarFase for minimumdoelen: derived from the concorded leerplandoelen.
        var jaarFaseOpties = await Geconcordeerd(BasisQuery())
            .Select(r => r.JaarFase!)
            .Distinct()
            .ToListAsync(cancellationToken);

        var jaarFaseAantallen = await Geconcordeerd(Gefilterd(BasisQuery(), filter with { JaarFase = null }))
            .GroupBy(r => r.JaarFase!)
            .Select(g => new { JaarFase = g.Key, Aantal = g.Select(r => r.Ref).Distinct().Count() })
            .ToListAsync(cancellationToken);

        var jaarFaseTelling = jaarFaseAantallen.ToDictionary(j => j.JaarFase, j => j.Aantal);

        var disciplineAantallenDict = disciplineAantallen.ToDictionary(d => d.Nummer, d => d.Aantal);

        var totaal = await _context.Minimumdoelen.AsNoTracking().CountAsync(cancellationToken);

        // Minimumdoelen, not rows: a minimumdoel in two buckets counts once, one without a bucket counts too (E1-22).
        var treffers = Gefilterd(BasisQuery(), filter);
        var aantalTreffers = await treffers.Select(r => r.Ref).Distinct().CountAsync(cancellationToken);
        var aantalZonderLeerplandoel = await treffers
            .Where(r => r.LeerplandoelCode == null)
            .Select(r => r.Ref)
            .Distinct()
            .CountAsync(cancellationToken);

        return new MinimumdoelFacettenWeergave(
            totaal,
            aantalTreffers,
            aantalZonderLeerplandoel,
            [.. disciplineOpties
                .Select(nummer => new DisciplineFacet(
                    nummer,
                    disciplineNamen.GetValueOrDefault(nummer),
                    disciplineAantallenDict.GetValueOrDefault(nummer)))
                .OrderBy(d => d.Nummer, DisciplinenummerVergelijker.Instantie)],
            [.. taxonomieOpties
                .GroupBy(t => t.Domein)
                .Select(g =>
                {
                    var subdomeinen = g
                        .Select(t => new SubdomeinFacet(t.Subdomein, taxonomieTelling.GetValueOrDefault((t.Domein, t.Subdomein))))
                        .OrderBy(s => s.Subdomein, StringComparer.CurrentCulture)
                        .ToList();
                    return new DomeinFacet(g.Key, subdomeinen.Sum(s => s.Aantal), subdomeinen);
                })
                .OrderBy(d => d.Domein, StringComparer.CurrentCulture)],
            [.. jaarFaseOpties
                .Select(fase => new JaarFaseFacet(fase, jaarFaseTelling.GetValueOrDefault(fase)))
                .OrderBy(j => j.JaarFase, StringComparer.Ordinal)]);
    }

    /// <summary>
    /// Base left join: minimumdoelen × leerplandoelen (concordance). One row per (minimumdoel, leerplandoel) pair carrying
    /// the bucket dimensions and the leerplandoel code, and one row with all of those null for a minimumdoel no loaded
    /// leerplandoel concords. Discipline names are looked up afterwards (<see cref="DisciplineNamenAsync"/>): thirteen
    /// rows, and a second outer join here would hang off a leerplandoel that may not exist.
    /// </summary>
    private IQueryable<MinimumdoelRij> BasisQuery() =>
        from m in _context.Minimumdoelen.AsNoTracking()
        join l in _context.Leerplandoelen.AsNoTracking() on m.Ref equals l.MinimumdoelRef into ls
        from l in ls.DefaultIfEmpty()
        select new MinimumdoelRij
        {
            Ref = m.Ref,
            Leeftijd = m.Leeftijd,
            Nr = m.Nr,
            Omschrijving = m.Omschrijving,
            DisciplineNummer = l == null ? null : l.DisciplineNummer,
            Domein = l == null ? null : l.Domein,
            Subdomein = l == null ? null : l.Subdomein,
            JaarFase = l == null ? null : l.JaarFase,
            LeerplandoelCode = l == null ? null : l.Code,
            // The import's reason travels only on the row without a bucket, which is the only row it is about.
            Reden = l == null ? m.ZonderLeerplandoelReden : null,
            Doelsets = l == null ? m.ZonderLeerplandoelDoelsets : null,
        };

    /// <summary>Only the rows that carry a concorded leerplandoel: the rows every facet dimension is made of.</summary>
    private static IQueryable<MinimumdoelRij> Geconcordeerd(IQueryable<MinimumdoelRij> query) =>
        query.Where(r => r.LeerplandoelCode != null);

    private Task<Dictionary<string, string>> DisciplineNamenAsync(CancellationToken cancellationToken) =>
        _context.Disciplines
            .AsNoTracking()
            .Select(d => new { d.Nummer, d.Naam })
            .ToDictionaryAsync(d => d.Nummer, d => d.Naam, cancellationToken);

    /// <summary>
    /// Applies the filter. A discipline, domein, subdomein or jaar/fase condition is false on a row without a bucket, so
    /// such a minimumdoel drops out under those filters and stays under a search, which matches its ref and text.
    /// </summary>
    private IQueryable<MinimumdoelRij> Gefilterd(IQueryable<MinimumdoelRij> query, MinimumdoelFilter filter)
    {
        if (Genormaliseerd(filter.Discipline) is { } discipline)
        {
            query = query.Where(r => r.DisciplineNummer != null && r.DisciplineNummer.ToLower() == discipline);
        }

        if (Genormaliseerd(filter.Domein) is { } domein)
        {
            query = query.Where(r => r.Domein != null && r.Domein.ToLower() == domein);
        }

        if (Genormaliseerd(filter.Subdomein) is { } subdomein)
        {
            query = query.Where(r => r.Subdomein != null && r.Subdomein.ToLower() == subdomein);
        }

        if (Genormaliseerd(filter.JaarFase) is { } jaarFase)
        {
            query = query.Where(r => r.JaarFase != null && r.JaarFase.ToLower() == jaarFase);
        }

        if (!string.IsNullOrWhiteSpace(filter.Zoekterm))
        {
            var escaped = EfFunctions.Like_EscapePattern(filter.Zoekterm.Trim(), LikeEscape);
            var pattern = $"%{escaped}%";
            query = query.Where(r =>
                EF.Functions.ILike(r.Ref, pattern, LikeEscape) ||
                EF.Functions.ILike(r.Omschrijving, pattern, LikeEscape));
        }

        return query;
    }

    private static string? Genormaliseerd(string? waarde) =>
        string.IsNullOrWhiteSpace(waarde) ? null : waarde.Trim().ToLower();

    /// <summary>
    /// Flat projection of one row from the base join: a (minimumdoel × leerplandoel) pair, or a minimumdoel alone with
    /// every leerplandoel-derived field null.
    /// </summary>
    private sealed class MinimumdoelRij
    {
        public string Ref { get; set; } = null!;
        public string Leeftijd { get; set; } = null!;
        public string Nr { get; set; } = null!;
        public string Omschrijving { get; set; } = null!;
        public string? DisciplineNummer { get; set; }
        public string? Domein { get; set; }
        public string? Subdomein { get; set; }
        public string? JaarFase { get; set; }
        public string? LeerplandoelCode { get; set; }
        public ZonderLeerplandoelReden? Reden { get; set; }
        public string? Doelsets { get; set; }
    }
}

/// <summary>
/// EF Core LIKE-pattern escape helper — centralised so the escape character is not repeated.
/// </summary>
file static class EfFunctions
{
    internal static string Like_EscapePattern(string term, string escape) =>
        term.Replace(escape, escape + escape)
            .Replace("%", escape + "%")
            .Replace("_", escape + "_");
}
