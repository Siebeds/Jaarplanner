using Jaarplanner.Application.Curriculum;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IMinimumdoelenQuery"/> over <see cref="AppDbContext"/>.
/// Minimumdoelen have no discipline/domein/subdomein of their own; those are derived from the
/// concorded leerplandoelen (Art. VII.0 / IX.1). A minimumdoel therefore appears in every
/// (discipline, domein, subdomein) bucket that at least one of its concorded leerplandoelen
/// belongs to — which can be more than one bucket.
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

        // Build the flat join: minimumdoelen × leerplandoelen (via concordantie) × disciplines.
        // Each (minimumdoel, leerplandoel) pair represents one bucket row candidate.
        var query = BasisQuery();
        query = Gefilterd(query, filter);

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
                r.DisciplineNaam,
                r.Domein,
                r.Subdomein,
            })
            .Select(g => new
            {
                g.Key.Ref,
                g.Key.Leeftijd,
                g.Key.Nr,
                g.Key.Omschrijving,
                g.Key.DisciplineNummer,
                g.Key.DisciplineNaam,
                g.Key.Domein,
                g.Key.Subdomein,
                Codes = g.Select(r => r.LeerplandoelCode).Distinct().ToList(),
            })
            .OrderBy(r => r.DisciplineNummer)
            .ThenBy(r => r.Domein)
            .ThenBy(r => r.Subdomein)
            .ThenBy(r => r.Leeftijd)
            .ThenBy(r => r.Nr)
            .Skip(overslaan)
            .Take(aantal)
            .ToListAsync(cancellationToken);

        var regels = rijen
            .Select(r => new MinimumdoelRegelWeergave(
                r.Ref,
                r.Leeftijd,
                r.Nr,
                r.Omschrijving,
                r.DisciplineNummer,
                r.DisciplineNaam,
                r.Domein,
                r.Subdomein,
                r.Codes))
            .ToList();

        return new MinimumdoelenPagina(regels, totaal, overslaan, aantal);
    }

    /// <inheritdoc />
    public async Task<MinimumdoelFacettenWeergave> HaalFacettenAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        var disciplineOpties = await BasisQuery()
            .Select(r => r.DisciplineNummer)
            .Distinct()
            .ToListAsync(cancellationToken);

        var disciplineAantallen = await Gefilterd(BasisQuery(), filter with { Discipline = null })
            .Select(r => new { r.Ref, r.Domein, r.Subdomein, r.DisciplineNummer })
            .Distinct()
            .GroupBy(r => r.DisciplineNummer)
            .Select(g => new { Nummer = g.Key, Aantal = g.Count() })
            .ToListAsync(cancellationToken);

        var disciplineNamen = await _context.Disciplines
            .AsNoTracking()
            .Select(d => new { d.Nummer, d.Naam })
            .ToDictionaryAsync(d => d.Nummer, d => d.Naam, cancellationToken);

        var taxonomieOpties = await BasisQuery()
            .Select(r => new { r.Domein, r.Subdomein })
            .Distinct()
            .ToListAsync(cancellationToken);

        var taxonomieAantallen = await Gefilterd(BasisQuery(), filter with { Domein = null, Subdomein = null })
            .Select(r => new { r.Ref, r.Domein, r.Subdomein })
            .Distinct()
            .GroupBy(r => new { r.Domein, r.Subdomein })
            .Select(g => new { g.Key.Domein, g.Key.Subdomein, Aantal = g.Count() })
            .ToListAsync(cancellationToken);

        var taxonomieTelling = taxonomieAantallen.ToDictionary(t => (t.Domein, t.Subdomein), t => t.Aantal);

        // JaarFase for minimumdoelen: derived from the concorded leerplandoelen.
        var jaarFaseOpties = await BasisQuery()
            .Select(r => r.JaarFase)
            .Distinct()
            .ToListAsync(cancellationToken);

        var jaarFaseAantallen = await Gefilterd(BasisQuery(), filter with { JaarFase = null })
            .GroupBy(r => r.JaarFase)
            .Select(g => new { JaarFase = g.Key, Aantal = g.Select(r => r.Ref).Distinct().Count() })
            .ToListAsync(cancellationToken);

        var jaarFaseTelling = jaarFaseAantallen.ToDictionary(j => j.JaarFase, j => j.Aantal);

        var disciplineAantallenDict = disciplineAantallen.ToDictionary(d => d.Nummer, d => d.Aantal);

        var totaal = await _context.Minimumdoelen.AsNoTracking().CountAsync(cancellationToken);

        return new MinimumdoelFacettenWeergave(
            totaal,
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
    /// Base join: minimumdoelen × leerplandoelen (concordance) × disciplines. One row per
    /// (minimumdoel, leerplandoel) pair, carrying the bucket dimensions and the leerplandoel code.
    /// </summary>
    private IQueryable<MinimumdoelRij> BasisQuery() =>
        from m in _context.Minimumdoelen.AsNoTracking()
        join l in _context.Leerplandoelen.AsNoTracking() on m.Ref equals l.MinimumdoelRef
        join d in _context.Disciplines.AsNoTracking() on l.DisciplineNummer equals d.Nummer into ds
        from d in ds.DefaultIfEmpty()
        select new MinimumdoelRij
        {
            Ref = m.Ref,
            Leeftijd = m.Leeftijd,
            Nr = m.Nr,
            Omschrijving = m.Omschrijving,
            DisciplineNummer = l.DisciplineNummer,
            DisciplineNaam = d == null ? null : d.Naam,
            Domein = l.Domein,
            Subdomein = l.Subdomein,
            JaarFase = l.JaarFase,
            LeerplandoelCode = l.Code,
        };

    private IQueryable<MinimumdoelRij> Gefilterd(IQueryable<MinimumdoelRij> query, MinimumdoelFilter filter)
    {
        if (Genormaliseerd(filter.Discipline) is { } discipline)
        {
            query = query.Where(r => r.DisciplineNummer.ToLower() == discipline);
        }

        if (Genormaliseerd(filter.Domein) is { } domein)
        {
            query = query.Where(r => r.Domein.ToLower() == domein);
        }

        if (Genormaliseerd(filter.Subdomein) is { } subdomein)
        {
            query = query.Where(r => r.Subdomein.ToLower() == subdomein);
        }

        if (Genormaliseerd(filter.JaarFase) is { } jaarFase)
        {
            query = query.Where(r => r.JaarFase.ToLower() == jaarFase);
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

    /// <summary>Flat projection of one (minimumdoel × leerplandoel) row from the base join.</summary>
    private sealed class MinimumdoelRij
    {
        public string Ref { get; set; } = null!;
        public string Leeftijd { get; set; } = null!;
        public string Nr { get; set; } = null!;
        public string Omschrijving { get; set; } = null!;
        public string DisciplineNummer { get; set; } = null!;
        public string? DisciplineNaam { get; set; }
        public string Domein { get; set; } = null!;
        public string Subdomein { get; set; } = null!;
        public string JaarFase { get; set; } = null!;
        public string LeerplandoelCode { get; set; } = null!;
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
