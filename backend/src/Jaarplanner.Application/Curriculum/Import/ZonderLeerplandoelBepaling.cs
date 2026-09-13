using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// Decides, from one snapshot, why no loaded leerplandoel concords a minimumdoel (E1-22, owner ruling 2026-09-13 "Reden
/// tonen"). Pure: the snapshot in, a reason per ref out, so the rule is tested without a database or KOV.
/// <para>
/// <b>It says only what the snapshot proves (the E5-03 rule).</b> In order:
/// <list type="number">
/// <item>a mapped (importable) leerplandoel concords to it → <b>no reason</b>. Either it is loaded, and the minimumdoel is
/// not without a leerplandoel, or its discipline was not imported (a selection, an unknown discipline), which is not a
/// fact about the minimumdoel;</item>
/// <item>a goal of the imported set concords to it and the mapping refused that goal → <see cref="ZonderLeerplandoelReden.DoelNietIngelezen"/>;</item>
/// <item>only goals of sets the import does not take concord to it → <see cref="ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets"/>, naming the sets;</item>
/// <item>no goal of the snapshot concords to it → <see cref="ZonderLeerplandoelReden.GeenDoelInOpstap"/>.</item>
/// </list>
/// </para>
/// </summary>
public static class ZonderLeerplandoelBepaling
{
    /// <summary>The reason for one minimumdoel, and with <see cref="ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets"/> the sets.</summary>
    /// <param name="Reden">Null when no reason is known or needed.</param>
    /// <param name="Doelsets">KOV's marks, sorted and comma-separated (<c>V,Z</c>); null unless the reason names sets.</param>
    public readonly record struct Uitkomst(ZonderLeerplandoelReden? Reden, string? Doelsets);

    /// <summary>Decides the reason for each of <paramref name="minimumdoelRefs"/> against <paramref name="bron"/>.</summary>
    public static IReadOnlyDictionary<string, Uitkomst> Bepaal(IEnumerable<string> minimumdoelRefs, LeerplandoelBronResultaat bron)
    {
        ArgumentNullException.ThrowIfNull(minimumdoelRefs);
        ArgumentNullException.ThrowIfNull(bron);

        var importeerbaar = bron.Disciplines
            .SelectMany(d => d.Leerplandoelen)
            .Select(l => l.MinimumdoelRef)
            .OfType<string>()
            .ToHashSet(StringComparer.Ordinal);
        var verwijzingen = bron.Verwijzingen
            .GroupBy(v => v.MinimumdoelRef, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.ToList(), StringComparer.Ordinal);

        var uitkomsten = new Dictionary<string, Uitkomst>(StringComparer.Ordinal);
        foreach (var minimumdoelRef in minimumdoelRefs)
        {
            uitkomsten[minimumdoelRef] = importeerbaar.Contains(minimumdoelRef)
                ? new Uitkomst(null, null)
                : verwijzingen.TryGetValue(minimumdoelRef, out var goals)
                    ? goals.Any(v => v.Geweigerd)
                        ? new Uitkomst(ZonderLeerplandoelReden.DoelNietIngelezen, null)
                        : new Uitkomst(
                            ZonderLeerplandoelReden.AlleenOvergeslagenDoelsets,
                            string.Join(",", goals.Select(v => v.Doelset).Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal)))
                    : new Uitkomst(ZonderLeerplandoelReden.GeenDoelInOpstap, null);
        }

        return uitkomsten;
    }
}
