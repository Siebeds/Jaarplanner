using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IThemaDoelenoverzichtQuery"/> (FB-009).
/// <para>
/// Three round-trips whatever the size of the thema: the thema with its subtree, the leerplandoelen it links, and the
/// minimumdoelen those concord to. The per-row detail endpoint is not used for this: it runs seven queries per code.
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
        // Doelsuggesties, subdoel koppelingen and activiteit doelkoppelingen are owned, so they load with their owner.
        var thema = await _context.Themas
            .AsNoTracking()
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .FirstOrDefaultAsync(t => t.Id == themaId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout("Dit thema bestaat niet meer. Iemand anders heeft het verwijderd.");

        // Every decided link as (leeftijd, code, place). A null leeftijd means "the leerplandoel's own jaar/fase", which is
        // only known once the leerplandoel is read: the themadoelen and doelsuggesties hang on the whole thema.
        var vondsten = new List<(string? Leeftijd, string Code, DoelPlaats Plaats)>();
        var themadoelCodes = thema.Themadoelen
            .Where(td => Beslist(td.Koppeling.Status))
            .Select(td => td.Koppeling.LeerplandoelCode)
            .Distinct(StringComparer.Ordinal);
        foreach (var code in themadoelCodes)
        {
            vondsten.Add((null, code, new DoelPlaats(DoelPlaatsSoort.Themadoel, null)));
        }

        // An accepted doelsuggestie is its own place: accepting one changes its status and makes it no themadoel, and the
        // 2–3 themadoelen are kept apart from the suggesties (Art. IX.2). A code that is both shows both.
        var suggestieCodes = thema.Doelsuggesties
            .Where(k => Beslist(k.Status))
            .Select(k => k.LeerplandoelCode)
            .Distinct(StringComparer.Ordinal);
        foreach (var code in suggestieCodes)
        {
            vondsten.Add((null, code, new DoelPlaats(DoelPlaatsSoort.Doelsuggestie, null)));
        }

        foreach (var subthema in thema.Subthemas)
        {
            foreach (var subdoel in subthema.Subdoelen.Where(s => Beslist(s.Koppeling.Status)))
            {
                vondsten.Add((subthema.Leeftijd, subdoel.Koppeling.LeerplandoelCode, new DoelPlaats(DoelPlaatsSoort.Subdoel, subthema.Naam)));
            }

            foreach (var activiteit in subthema.Activiteiten)
            {
                foreach (var koppeling in activiteit.Doelkoppelingen.Where(k => Beslist(k.Status)))
                {
                    vondsten.Add((subthema.Leeftijd, koppeling.LeerplandoelCode, new DoelPlaats(DoelPlaatsSoort.Activiteit, activiteit.Naam)));
                }
            }
        }

        var codes = vondsten.Select(v => v.Code).Distinct(StringComparer.Ordinal).ToList();
        var doelen = await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => codes.Contains(l.Code))
            .Select(l => new Doelregel(l.Code, l.Doelsoort, l.Tekst, l.JaarFase, l.NietMeerInOpstap, l.MinimumdoelRef))
            .ToDictionaryAsync(l => l.Code, StringComparer.Ordinal, cancellationToken);

        var refs = doelen.Values.Select(d => d.MinimumdoelRef).OfType<string>().Distinct(StringComparer.Ordinal).ToList();
        var minimumdoelen = await _context.Minimumdoelen
            .AsNoTracking()
            .Where(m => refs.Contains(m.Ref))
            .Select(m => new Minimumdoelregel(m.Ref, m.Leeftijd, m.Nr, m.Omschrijving))
            .ToDictionaryAsync(m => m.Ref, StringComparer.Ordinal, cancellationToken);

        var leeftijden = vondsten
            // A link can only be made to a stored leerplandoel and none is ever deleted (Art. III.4), so this drops nothing
            // today; it keeps a missing row from turning the whole overview into a 500.
            .Where(v => doelen.ContainsKey(v.Code))
            .GroupBy(v => v.Leeftijd ?? doelen[v.Code].JaarFase, StringComparer.Ordinal)
            .OrderBy(g => JaarfaseRang.GetValueOrDefault(g.Key, int.MaxValue))
            .ThenBy(g => g.Key, StringComparer.Ordinal)
            .Select(g => Leeftijd(g.Key, g.ToList(), doelen, minimumdoelen))
            .ToList();

        return new ThemaDoelenoverzicht(thema.Id, leeftijden);
    }

    private static LeeftijdDoelen Leeftijd(
        string leeftijd,
        List<(string? Leeftijd, string Code, DoelPlaats Plaats)> vondsten,
        Dictionary<string, Doelregel> doelen,
        Dictionary<string, Minimumdoelregel> minimumdoelen)
    {
        var leerplandoelen = vondsten
            .GroupBy(v => v.Code, StringComparer.Ordinal)
            .Select(g =>
            {
                var doel = doelen[g.Key];
                var plaatsen = g.Select(v => v.Plaats)
                    .OrderBy(p => p.Soort)
                    .ThenBy(p => p.Naam, StringComparer.CurrentCulture)
                    .ToList();
                return new OverzichtLeerplandoel(doel.Code, doel.Doelsoort, doel.Tekst, doel.NietMeerInOpstap, doel.MinimumdoelRef, plaatsen);
            })
            .OrderBy(l => l.Code, CodeVolgorde.Instance)
            .ToList();

        var bereikt = leerplandoelen
            .Where(l => l.MinimumdoelRef is not null && minimumdoelen.ContainsKey(l.MinimumdoelRef))
            .GroupBy(l => l.MinimumdoelRef!, StringComparer.Ordinal)
            .Select(g =>
            {
                var md = minimumdoelen[g.Key];
                return new OverzichtMinimumdoel(md.Ref, md.Leeftijd, md.Nr, md.Omschrijving, g.Select(l => l.Code).ToList());
            })
            .OrderBy(m => m.Ref, CodeVolgorde.Instance)
            .ToList();

        return new LeeftijdDoelen(leeftijd, leerplandoelen, bereikt);
    }

    private static bool Beslist(KoppelingStatus status) =>
        status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel;

    private sealed record Doelregel(
        string Code, Doelsoort Doelsoort, string Tekst, string JaarFase, bool NietMeerInOpstap, string? MinimumdoelRef);

    private sealed record Minimumdoelregel(string Ref, string Leeftijd, string Nr, string Omschrijving);

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
