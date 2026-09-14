using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IMinimumdoelenQuery"/>: the minimumdoelen register in the decree's own ordering
/// (TB-010), leergebied › rubriek › subrubriek as KOV's onderwijsdoelen endpoint delivers it with every minimumdoel.
/// <para>
/// <b>Each minimumdoel is one row.</b> Until TB-010 the register borrowed the (discipline, domein, subdomein) of the
/// concorded leerplandoelen, so a minimumdoel taught in two subdomeinen was listed twice and one no loaded goal concords
/// had no place of its own (E1-22 gave those a group). The decree's ordering belongs to the minimumdoel, so neither
/// happens. A minimumdoel whose ordering is not known, which is every row imported before TB-010 until the next
/// minimumdoelen import, is listed after the others.
/// </para>
/// <para>
/// <b>Filtering happens in SQL, ordering in memory.</b> The decree's order is the order of its numbers (<c>1.1.9</c>
/// before <c>1.1.10</c>, and the leergebied numbered 10 last), which SQL cannot sort as text. The table holds about a
/// thousand short rows, so the order is computed from all of them on each call rather than stored.
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

        var rijen = await Tak(Gefilterd(filter), filter)
            .Select(m => new Rij(
                m.Ref,
                m.Leeftijd,
                m.Nr,
                m.Omschrijving,
                m.Leergebied,
                m.Rubriek,
                m.Subrubriek,
                m.ZonderLeerplandoelReden,
                m.ZonderLeerplandoelDoelsets))
            .ToListAsync(cancellationToken);

        var volgorde = await VolgordeAsync(cancellationToken);
        rijen.Sort(volgorde);
        var pagina = rijen.Skip(overslaan).Take(aantal).ToList();

        var refs = pagina.Select(r => r.Ref).ToList();
        var koppelingen = await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => l.MinimumdoelRef != null && refs.Contains(l.MinimumdoelRef))
            .Select(l => new { Ref = l.MinimumdoelRef!, l.JaarFase })
            .ToListAsync(cancellationToken);
        var fasenPerRef = koppelingen
            .GroupBy(k => k.Ref, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Select(k => k.JaarFase).ToList(), StringComparer.Ordinal);

        var regels = pagina
            .Select(r =>
            {
                var fasen = fasenPerRef.GetValueOrDefault(r.Ref) ?? [];
                // The import's reason is about a minimumdoel no stored goal refers to, so it is shown only then.
                var zonder = fasen.Count == 0;
                return new MinimumdoelRegelWeergave(
                    r.Ref,
                    r.Leeftijd,
                    r.Nr,
                    r.Omschrijving,
                    r.Leergebied,
                    r.Rubriek,
                    r.Subrubriek,
                    fasen.Count,
                    OrdenJaarFasen(fasen.Distinct(StringComparer.Ordinal)),
                    zonder ? r.Reden : null,
                    zonder ? Doelsets(r.Doelsets) : []);
            })
            .ToList();

        return new MinimumdoelenPagina(regels, rijen.Count, overslaan, aantal);
    }

    /// <inheritdoc />
    public async Task<MinimumdoelFacettenWeergave> HaalFacettenAsync(
        MinimumdoelFilter filter,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(filter);

        var zonderTak = filter.ZonderTak();
        var treffers = await Gefilterd(zonderTak)
            .Select(m => new { m.Leergebied, m.Rubriek, m.Subrubriek })
            .ToListAsync(cancellationToken);
        var leeftijdAantallen = await Gefilterd(zonderTak with { Leeftijd = null })
            .GroupBy(m => m.Leeftijd)
            .Select(g => new { Leeftijd = g.Key, Aantal = g.Count() })
            .ToDictionaryAsync(g => g.Leeftijd, g => g.Aantal, StringComparer.Ordinal, cancellationToken);
        var leeftijdOpties = await _context.Minimumdoelen.AsNoTracking().Select(m => m.Leeftijd).Distinct().ToListAsync(cancellationToken);
        var totaal = await _context.Minimumdoelen.AsNoTracking().CountAsync(cancellationToken);
        var volgorde = await VolgordeAsync(cancellationToken);

        var leergebieden = treffers
            .Where(t => t.Leergebied is not null && t.Rubriek is not null)
            .GroupBy(t => t.Leergebied!, StringComparer.Ordinal)
            .OrderBy(g => g.Key, volgorde.Leergebieden())
            .Select(leergebied => new LeergebiedFacet(
                leergebied.Key,
                leergebied.Count(),
                [.. leergebied
                    .GroupBy(t => t.Rubriek!, StringComparer.Ordinal)
                    .OrderBy(g => g.Key, volgorde.Rubrieken(leergebied.Key))
                    .Select(rubriek => new RubriekFacet(
                        rubriek.Key,
                        rubriek.Count(),
                        rubriek.Count(t => t.Subrubriek is null),
                        [.. rubriek
                            .Where(t => t.Subrubriek is not null)
                            .GroupBy(t => t.Subrubriek!, StringComparer.Ordinal)
                            .OrderBy(g => g.Key, volgorde.Subrubrieken(leergebied.Key, rubriek.Key))
                            .Select(sub => new SubrubriekFacet(sub.Key, sub.Count()))]))]))
            .ToList();

        return new MinimumdoelFacettenWeergave(
            totaal,
            treffers.Count,
            treffers.Count(t => t.Leergebied is null),
            leergebieden,
            [.. leeftijdOpties
                .OrderBy(LeeftijdRang)
                .ThenBy(l => l, StringComparer.Ordinal)
                .Select(l => new LeeftijdFacet(l, leeftijdAantallen.GetValueOrDefault(l)))]);
    }

    /// <inheritdoc />
    public async Task<MinimumdoelDetailWeergave?> HaalDetailAsync(
        string minimumdoelRef,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(minimumdoelRef))
        {
            return null;
        }

        var sleutel = minimumdoelRef.Trim();
        var minimumdoel = await _context.Minimumdoelen
            .AsNoTracking()
            .SingleOrDefaultAsync(m => m.Ref == sleutel, cancellationToken);
        if (minimumdoel is null)
        {
            return null;
        }

        var doelen = await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => l.MinimumdoelRef == minimumdoel.Ref)
            .Select(l => new { l.Code, l.Tekst, l.JaarFase, l.DisciplineNummer, l.Domein, l.Subdomein, l.NietMeerInOpstap })
            .ToListAsync(cancellationToken);
        var disciplineNamen = await _context.Disciplines
            .AsNoTracking()
            .Select(d => new { d.Nummer, d.Naam })
            .ToDictionaryAsync(d => d.Nummer, d => d.Naam, cancellationToken);

        var perFase = doelen
            .GroupBy(d => d.JaarFase, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.OrderBy(d => d.Code, DisciplinenummerVergelijker.Instantie).ToList(), StringComparer.Ordinal);
        var fasen = Jaarfasen.Alle.Concat(OrdenJaarFasen(perFase.Keys).Where(f => !Jaarfasen.Alle.Contains(f)));
        var zonder = doelen.Count == 0;

        return new MinimumdoelDetailWeergave(
            minimumdoel.Ref,
            minimumdoel.Leeftijd,
            minimumdoel.Nr,
            minimumdoel.Omschrijving,
            minimumdoel.Leergebied,
            minimumdoel.Rubriek,
            minimumdoel.Subrubriek,
            minimumdoel.Soort,
            minimumdoel.NietMeerInOpstap,
            doelen.Count,
            [.. fasen.Select(fase => new JaarFaseLeerplandoelen(
                fase,
                [.. (perFase.GetValueOrDefault(fase) ?? []).Select(d => new GeconcordeerdLeerplandoel(
                    d.Code,
                    d.Tekst,
                    disciplineNamen.GetValueOrDefault(d.DisciplineNummer),
                    d.Domein,
                    d.Subdomein,
                    d.NietMeerInOpstap))]))],
            zonder ? minimumdoel.ZonderLeerplandoelReden : null,
            zonder ? Doelsets(minimumdoel.ZonderLeerplandoelDoelsets) : []);
    }

    /// <summary>
    /// The filter's own dimensions. The concordance dimensions become one EXISTS over the leerplandoelen, so a minimumdoel
    /// matches when a single concorded goal satisfies all of them, the way the leerplandoelen register reads them. A
    /// minimumdoel no stored goal concords to therefore drops out under any of them and stays under a search.
    /// </summary>
    private IQueryable<Minimumdoel> Gefilterd(MinimumdoelFilter filter)
    {
        var query = _context.Minimumdoelen.AsNoTracking();

        if (Genormaliseerd(filter.Leeftijd) is { } leeftijd)
        {
            query = query.Where(m => m.Leeftijd.ToLower() == leeftijd);
        }

        var discipline = Genormaliseerd(filter.Discipline);
        var domein = Genormaliseerd(filter.Domein);
        var subdomein = Genormaliseerd(filter.Subdomein);
        var jaarFase = Genormaliseerd(filter.JaarFase);
        if (discipline is not null || domein is not null || subdomein is not null || jaarFase is not null)
        {
            var doelen = _context.Leerplandoelen.AsNoTracking().Where(l => l.MinimumdoelRef != null);
            if (discipline is not null)
            {
                doelen = doelen.Where(l => l.DisciplineNummer.ToLower() == discipline);
            }

            if (domein is not null)
            {
                doelen = doelen.Where(l => l.Domein.ToLower() == domein);
            }

            if (subdomein is not null)
            {
                doelen = doelen.Where(l => l.Subdomein.ToLower() == subdomein);
            }

            if (jaarFase is not null)
            {
                doelen = doelen.Where(l => l.JaarFase.ToLower() == jaarFase);
            }

            query = query.Where(m => doelen.Any(l => l.MinimumdoelRef == m.Ref));
        }

        if (!string.IsNullOrWhiteSpace(filter.Zoekterm))
        {
            var escaped = EfFunctions.Like_EscapePattern(filter.Zoekterm.Trim(), LikeEscape);
            var pattern = $"%{escaped}%";
            query = query.Where(m =>
                EF.Functions.ILike(m.Ref, pattern, LikeEscape) ||
                EF.Functions.ILike(m.Omschrijving, pattern, LikeEscape));
        }

        return query;
    }

    /// <summary>One branch of the tree, when the filter names one; the list reads it, the facets do not.</summary>
    private static IQueryable<Minimumdoel> Tak(IQueryable<Minimumdoel> query, MinimumdoelFilter filter)
    {
        if (filter.ZonderOrdening)
        {
            return query.Where(m => m.Leergebied == null);
        }

        if (Genormaliseerd(filter.Leergebied) is { } leergebied)
        {
            query = query.Where(m => m.Leergebied != null && m.Leergebied.ToLower() == leergebied);
        }

        if (Genormaliseerd(filter.Rubriek) is { } rubriek)
        {
            query = query.Where(m => m.Rubriek != null && m.Rubriek.ToLower() == rubriek);
        }

        if (filter.ZonderSubrubriek)
        {
            query = query.Where(m => m.Subrubriek == null);
        }
        else if (Genormaliseerd(filter.Subrubriek) is { } subrubriek)
        {
            query = query.Where(m => m.Subrubriek != null && m.Subrubriek.ToLower() == subrubriek);
        }

        return query;
    }

    /// <summary>
    /// The decree's order, read from every stored minimumdoel so that it does not shift under a filter: a branch sits
    /// where its lowest number sits (<c>Nederlands</c> holds the numbers starting with 1, <c>Frans</c> those with 10).
    /// </summary>
    private async Task<Volgorde> VolgordeAsync(CancellationToken cancellationToken)
    {
        var geordend = await _context.Minimumdoelen
            .AsNoTracking()
            .Where(m => m.Leergebied != null && m.Rubriek != null)
            .Select(m => new { m.Nr, Leergebied = m.Leergebied!, Rubriek = m.Rubriek!, m.Subrubriek })
            .ToListAsync(cancellationToken);

        string Laagste<T>(IEnumerable<T> groep, Func<T, string> nr) => groep.Select(nr).Min(DisciplinenummerVergelijker.Instantie)!;

        return new Volgorde(
            geordend.GroupBy(m => m.Leergebied, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => Laagste(g, m => m.Nr), StringComparer.Ordinal),
            geordend.GroupBy(m => (m.Leergebied, m.Rubriek))
                .ToDictionary(g => g.Key, g => Laagste(g, m => m.Nr)),
            geordend.Where(m => m.Subrubriek is not null)
                .GroupBy(m => (m.Leergebied, m.Rubriek, m.Subrubriek!))
                .ToDictionary(g => g.Key, g => Laagste(g, m => m.Nr)));
    }

    /// <summary>Kleuter before lager, in <see cref="Jaarfasen.Alle"/>'s order; anything else after, as text.</summary>
    private static List<string> OrdenJaarFasen(IEnumerable<string> fasen) =>
        [.. fasen
            .OrderBy(f => Jaarfasen.Alle.Contains(f) ? Jaarfasen.Alle.ToList().IndexOf(f) : int.MaxValue)
            .ThenBy(f => f, StringComparer.Ordinal)];

    private static int LeeftijdRang(string leeftijd)
    {
        var rang = MinimumdoelFilter.Leeftijden.ToList().IndexOf(leeftijd);
        return rang < 0 ? int.MaxValue : rang;
    }

    private static IReadOnlyList<string> Doelsets(string? doelsets) =>
        doelsets is null ? [] : doelsets.Split(',', StringSplitOptions.RemoveEmptyEntries);

    private static string? Genormaliseerd(string? waarde) =>
        string.IsNullOrWhiteSpace(waarde) ? null : waarde.Trim().ToLower();

    /// <summary>The columns of a minimumdoel the list reads.</summary>
    private sealed record Rij(
        string Ref,
        string Leeftijd,
        string Nr,
        string Omschrijving,
        string? Leergebied,
        string? Rubriek,
        string? Subrubriek,
        ZonderLeerplandoelReden? Reden,
        string? Doelsets);

    /// <summary>
    /// The register's order: the ordered minimumdoelen by leergebied, rubriek and subrubriek (each where its lowest number
    /// sits, the minimumdoelen without a subrubriek first), then leeftijd (K-, 4-, 6-) and number; the unordered ones last,
    /// by leeftijd and number.
    /// </summary>
    private sealed class Volgorde(
        Dictionary<string, string> leergebieden,
        Dictionary<(string, string), string> rubrieken,
        Dictionary<(string, string, string), string> subrubrieken) : IComparer<Rij>
    {
        public IComparer<string> Leergebieden() =>
            Comparer<string>.Create((a, b) => Vergelijk(leergebieden.GetValueOrDefault(a), a, leergebieden.GetValueOrDefault(b), b));

        public IComparer<string> Rubrieken(string leergebied) =>
            Comparer<string>.Create((a, b) =>
                Vergelijk(rubrieken.GetValueOrDefault((leergebied, a)), a, rubrieken.GetValueOrDefault((leergebied, b)), b));

        public IComparer<string> Subrubrieken(string leergebied, string rubriek) =>
            Comparer<string>.Create((a, b) =>
                Vergelijk(
                    subrubrieken.GetValueOrDefault((leergebied, rubriek, a)),
                    a,
                    subrubrieken.GetValueOrDefault((leergebied, rubriek, b)),
                    b));

        public int Compare(Rij? x, Rij? y)
        {
            if (ReferenceEquals(x, y))
            {
                return 0;
            }

            if (x is null || y is null)
            {
                return x is null ? -1 : 1;
            }

            var geordend = (x.Leergebied is null).CompareTo(y.Leergebied is null);
            if (geordend != 0)
            {
                return geordend;
            }

            if (x.Leergebied is not null && y.Leergebied is not null)
            {
                var tak = Leergebieden().Compare(x.Leergebied, y.Leergebied);
                if (tak == 0)
                {
                    tak = Rubrieken(x.Leergebied).Compare(x.Rubriek!, y.Rubriek!);
                }

                if (tak == 0)
                {
                    tak = (x.Subrubriek is not null).CompareTo(y.Subrubriek is not null);
                }

                if (tak == 0 && x.Subrubriek is not null && y.Subrubriek is not null)
                {
                    tak = Subrubrieken(x.Leergebied, x.Rubriek!).Compare(x.Subrubriek, y.Subrubriek);
                }

                if (tak != 0)
                {
                    return tak;
                }
            }

            var leeftijd = LeeftijdRang(x.Leeftijd).CompareTo(LeeftijdRang(y.Leeftijd));
            return leeftijd != 0 ? leeftijd : DisciplinenummerVergelijker.Instantie.Compare(x.Nr, y.Nr);
        }

        private static int Vergelijk(string? laagsteA, string a, string? laagsteB, string b)
        {
            var volgens = DisciplinenummerVergelijker.Instantie.Compare(laagsteA ?? string.Empty, laagsteB ?? string.Empty);
            return volgens != 0 ? volgens : string.CompareOrdinal(a, b);
        }
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
