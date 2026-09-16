using System.Text;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Ai;

/// <summary>
/// The candidate minimumdoel list a thema-level prompt starts with (FB-053, ADR-0050): the thema page's doelsuggesties
/// and the wizard's themadoel step.
/// <para>
/// <b>Compact and grouped.</b> Per mijlpaal a heading, under it per <c>leergebied &gt; rubriek &gt; subrubriek</c> a
/// heading, and under that one line per goal, <c>- &lt;ref&gt;: &lt;omschrijving&gt;</c>. The decree's ordering is said
/// once per group instead of once per goal.
/// </para>
/// <para>
/// <b>Byte-identical for the same goals.</b> The mijlpalen come in their decreed order (<c>K-</c>, <c>4-</c>, <c>6-</c>),
/// the groups ordinally with a goal without ordering last, and the goals ordinally by ref, so caller ordering cannot leak
/// in. That makes it snapshot-testable, and lets the list later become a cached prompt prefix. Every value comes from the
/// loaded minimumdoel itself (Art. IV.4).
/// </para>
/// </summary>
public static class MinimumdoelPromptlijst
{
    /// <summary>The heading of the list. The system prompts refer to it by this name.</summary>
    public const string Kop = "# Beschikbare minimumdoelen";

    private const string Nl = "\n";

    private static readonly string[] Mijlpaalvolgorde =
        [Jaarfasen.MijlpaalKleuter, Jaarfasen.MijlpaalVierdeLeerjaar, Jaarfasen.MijlpaalZesdeLeerjaar];

    /// <summary>The list as one string.</summary>
    public static string Bouw(IReadOnlyCollection<Minimumdoel> minimumdoelen)
    {
        var sb = new StringBuilder();
        Schrijf(sb, minimumdoelen);
        return sb.ToString();
    }

    /// <summary>Writes the heading and every goal, grouped, to <paramref name="sb"/>.</summary>
    public static void Schrijf(StringBuilder sb, IReadOnlyCollection<Minimumdoel> minimumdoelen)
    {
        ArgumentNullException.ThrowIfNull(sb);
        ArgumentNullException.ThrowIfNull(minimumdoelen);

        sb.Append(Kop).Append(Nl);
        if (minimumdoelen.Count == 0)
        {
            sb.Append(Nl).Append("- (geen minimumdoelen aangeleverd)").Append(Nl);
            return;
        }

        var unieke = minimumdoelen
            .GroupBy(m => m.Ref, StringComparer.Ordinal)
            .Select(g => g.First());

        foreach (var mijlpaal in unieke
            .GroupBy(m => m.Leeftijd, StringComparer.Ordinal)
            .OrderBy(g => Rang(g.Key))
            .ThenBy(g => g.Key, StringComparer.Ordinal))
        {
            sb.Append(Nl).Append($"## Mijlpaal {mijlpaal.Key}").Append(Nl);

            foreach (var groep in mijlpaal
                .GroupBy(Ordening, StringComparer.Ordinal)
                .OrderBy(g => g.Key.Length == 0)
                .ThenBy(g => g.Key, StringComparer.Ordinal))
            {
                sb.Append(Nl).Append($"### {(groep.Key.Length == 0 ? "(zonder ordening)" : groep.Key)}").Append(Nl);
                foreach (var doel in groep.OrderBy(m => m.Ref, StringComparer.Ordinal))
                {
                    sb.Append($"- {doel.Ref}: {EenRegel(doel.Omschrijving)}").Append(Nl);
                }
            }
        }
    }

    private static int Rang(string mijlpaal)
    {
        var index = Array.IndexOf(Mijlpaalvolgorde, mijlpaal);
        return index < 0 ? Mijlpaalvolgorde.Length : index;
    }

    // "Nederlands > Lezen > Vlot en vloeiend lezen"; empty for a goal imported before the ordering was stored.
    private static string Ordening(Minimumdoel doel) =>
        string.Join(" > ", new[] { doel.Leergebied, doel.Rubriek, doel.Subrubriek }.Where(n => !string.IsNullOrWhiteSpace(n)));

    // A line break inside a decreed text would read as a new list entry.
    private static string EenRegel(string tekst) =>
        string.Join(' ', tekst.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries));
}
