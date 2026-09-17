using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IThemaDoelenoverzichtQuery"/> (FB-009, TB-048).
/// <para>
/// Three round-trips at most whatever the size of the thema: the thema with its subtree, the leerplandoelen of its
/// minimumdoelen, and the other leerplandoelen it links. The per-row detail endpoint is not used for this: it runs seven
/// queries per code.
/// </para>
/// </summary>
public sealed class ThemaDoelenoverzichtQuery : IThemaDoelenoverzichtQuery
{
    private static readonly Dictionary<string, int> JaarfaseRang =
        Jaarfasen.Alle.Select((fase, index) => (fase, index)).ToDictionary(p => p.fase, p => p.index, StringComparer.Ordinal);

    private readonly AppDbContext _context;

    public ThemaDoelenoverzichtQuery(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<ThemaDoelenoverzicht> HaalOpAsync(Guid themaId, CancellationToken cancellationToken = default)
    {
        // Subdoel koppelingen and activiteit doelkoppelingen are owned, so they load with their owner.
        var thema = await _context.Themas
            .AsNoTracking()
            .Include(t => t.Minimumdoelen)
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .AsSplitQuery()
            .FirstOrDefaultAsync(t => t.Id == themaId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout("Dit thema bestaat niet meer. Iemand anders heeft het verwijderd.");

        // The list itself: every leerplandoel the concordance puts under one of the thema's minimumdoelen (TB-048).
        var refs = thema.Minimumdoelen.Select(m => m.MinimumdoelRef).Distinct(StringComparer.Ordinal).ToList();
        var vanMinimumdoelen = refs.Count == 0
            ? []
            : await _context.Leerplandoelen
                .AsNoTracking()
                .Where(l => l.MinimumdoelRef != null && refs.Contains(l.MinimumdoelRef))
                .Select(l => new Doelregel(l.Code, l.Doelsoort, l.Tekst, l.JaarFase, l.NietMeerInOpstap, l.MinimumdoelRef))
                .ToListAsync(cancellationToken);
        var codesVanMinimumdoelen = vanMinimumdoelen.Select(d => d.Code).ToHashSet(StringComparer.Ordinal);

        // Beside it, every decided link under the thema whose leerplandoel is not in that list, as (leeftijd, code, place).
        // A null leeftijd means "the leerplandoel's own jaar/fase", only known once it is read: a themadoel hangs on the
        // whole thema.
        var vondsten = new List<(string? Leeftijd, string Code, DoelPlaats Plaats)>();
        var themadoelCodes = thema.Themadoelen
            .Where(td => Beslist(td.Koppeling.Status))
            .Select(td => td.Koppeling.LeerplandoelCode)
            .Distinct(StringComparer.Ordinal);
        foreach (var code in themadoelCodes)
        {
            vondsten.Add((null, code, new DoelPlaats(DoelPlaatsSoort.Themadoel, null)));
        }

        foreach (var subthema in thema.Subthemas)
        {
            foreach (var subdoel in subthema.Subdoelen.Where(s => Beslist(s.Koppeling.Status)))
            {
                vondsten.Add((subthema.Leeftijd, subdoel.Koppeling.LeerplandoelCode, new DoelPlaats(DoelPlaatsSoort.Subdoel, subthema.Naam)));
            }

            // Shared activiteiten only: an own activiteit counts for its owner's klas where it is planned, not for the
            // thema (ADR-0049 D7, D9).
            foreach (var activiteit in subthema.Activiteiten.Where(a => !a.IsEigen))
            {
                foreach (var koppeling in activiteit.Doelkoppelingen.Where(k => Beslist(k.Status)))
                {
                    vondsten.Add((subthema.Leeftijd, koppeling.LeerplandoelCode, new DoelPlaats(DoelPlaatsSoort.Activiteit, activiteit.Naam)));
                }
            }
        }

        vondsten.RemoveAll(v => codesVanMinimumdoelen.Contains(v.Code));
        var codes = vondsten.Select(v => v.Code).Distinct(StringComparer.Ordinal).ToList();
        var buitenDoelen = codes.Count == 0
            ? []
            : await _context.Leerplandoelen
                .AsNoTracking()
                .Where(l => codes.Contains(l.Code))
                .Select(l => new Doelregel(l.Code, l.Doelsoort, l.Tekst, l.JaarFase, l.NietMeerInOpstap, l.MinimumdoelRef))
                .ToListAsync(cancellationToken);
        var doelen = buitenDoelen.ToDictionary(d => d.Code, StringComparer.Ordinal);

        var lijstPerLeeftijd = vanMinimumdoelen
            .GroupBy(d => d.JaarFase, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => g.OrderBy(d => d.Code, CodeVolgorde.Instance).Select(d => Regel(d, [])).ToList(),
                StringComparer.Ordinal);
        var buitenPerLeeftijd = vondsten
            // A link can only be made to a stored leerplandoel and none is ever deleted (Art. III.4), so this drops nothing
            // today; it keeps a missing row from turning the whole overview into a 500.
            .Where(v => doelen.ContainsKey(v.Code))
            .GroupBy(v => v.Leeftijd ?? doelen[v.Code].JaarFase, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => Buiten(g.ToList(), doelen), StringComparer.Ordinal);

        var leeftijden = lijstPerLeeftijd.Keys
            .Union(buitenPerLeeftijd.Keys, StringComparer.Ordinal)
            .OrderBy(l => JaarfaseRang.GetValueOrDefault(l, int.MaxValue))
            .ThenBy(l => l, StringComparer.Ordinal)
            .Select(l => new LeeftijdDoelen(
                l,
                lijstPerLeeftijd.GetValueOrDefault(l) ?? [],
                buitenPerLeeftijd.GetValueOrDefault(l) ?? []))
            .ToList();

        return new ThemaDoelenoverzicht(thema.Id, leeftijden);
    }

    private static List<OverzichtLeerplandoel> Buiten(
        List<(string? Leeftijd, string Code, DoelPlaats Plaats)> vondsten,
        Dictionary<string, Doelregel> doelen) =>
        vondsten
            .GroupBy(v => v.Code, StringComparer.Ordinal)
            .Select(g => Regel(
                doelen[g.Key],
                g.Select(v => v.Plaats)
                    .OrderBy(p => p.Soort)
                    .ThenBy(p => p.Naam, StringComparer.CurrentCulture)
                    .ToList()))
            .OrderBy(l => l.Code, CodeVolgorde.Instance)
            .ToList();

    private static OverzichtLeerplandoel Regel(Doelregel doel, IReadOnlyList<DoelPlaats> plaatsen) =>
        new(doel.Code, doel.Doelsoort, doel.Tekst, doel.NietMeerInOpstap, doel.MinimumdoelRef, plaatsen);

    private static bool Beslist(KoppelingStatus status) =>
        status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel;

    private sealed record Doelregel(
        string Code, Doelsoort Doelsoort, string Tekst, string JaarFase, bool NietMeerInOpstap, string? MinimumdoelRef);

    /// <summary>
    /// Codes in the order a reader counts them: runs of digits compare as numbers, so <c>3.1.GK2.10</c> follows
    /// <c>3.1.GK2.9</c> instead of preceding <c>3.1.GK2.2</c>.
    /// </summary>
    private sealed class CodeVolgorde : IComparer<string>
    {
        public static readonly CodeVolgorde Instance = new();

        public int Compare(string? x, string? y)
        {
            if (ReferenceEquals(x, y))
            {
                return 0;
            }

            if (x is null)
            {
                return -1;
            }

            if (y is null)
            {
                return 1;
            }

            int i = 0, j = 0;
            while (i < x.Length && j < y.Length)
            {
                if (char.IsDigit(x[i]) && char.IsDigit(y[j]))
                {
                    int beginX = i, beginY = j;
                    while (i < x.Length && char.IsDigit(x[i]))
                    {
                        i++;
                    }

                    while (j < y.Length && char.IsDigit(y[j]))
                    {
                        j++;
                    }

                    var getalX = x[beginX..i].TrimStart('0');
                    var getalY = y[beginY..j].TrimStart('0');
                    var verschil = getalX.Length != getalY.Length
                        ? getalX.Length.CompareTo(getalY.Length)
                        : string.CompareOrdinal(getalX, getalY);
                    if (verschil != 0)
                    {
                        return verschil;
                    }
                }
                else
                {
                    var verschil = x[i].CompareTo(y[j]);
                    if (verschil != 0)
                    {
                        return verschil;
                    }

                    i++;
                    j++;
                }
            }

            return (x.Length - i).CompareTo(y.Length - j);
        }
    }
}
