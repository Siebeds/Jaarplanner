using System.Text;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Ai;

/// <summary>
/// The candidate goal list every grounded prompt ends with: the matching prompt (E2-02) and both authoring prompts
/// (E2-07). Kept in one place, so no two prompts write the same goal two ways.
/// <para>
/// <b>Compact</b> (TB-007): per goal its code, doelsoort, jaar/fase, domein and subdomein on one line and its text on the
/// next. Voorbeelden, toelichting, woordenschat, cluster and the minimumdoel reference stay out. With them the K3 goals of
/// the Op.stap import alone came to about 54,000 tokens, over the <see cref="Promptbegrenzing"/> ceiling; without them
/// they are about 22,000. Whether the model matches as well on the short form is what the TB-004 evaluation measures.
/// </para>
/// <para>
/// Ordered by the stable code, so caller ordering cannot leak into the prompt and it stays snapshot-testable. Every value
/// comes from the loaded Op.stap goal itself (Art. IV.4).
/// </para>
/// </summary>
internal static class LeerplandoelPromptlijst
{
    /// <summary>The heading of the list. The system prompts refer to it by this name.</summary>
    public const string Kop = "# Beschikbare Op.stap-leerplandoelen";

    private const string Nl = "\n";

    /// <summary>Writes the heading and one entry per goal to <paramref name="sb"/>.</summary>
    public static void Schrijf(StringBuilder sb, IReadOnlyCollection<Leerplandoel> leerdoelen)
    {
        sb.Append(Kop).Append(Nl).Append(Nl);
        if (leerdoelen.Count == 0)
        {
            sb.Append("- (geen leerplandoelen aangeleverd)").Append(Nl);
            return;
        }

        foreach (var doel in leerdoelen.OrderBy(d => d.Code, StringComparer.Ordinal))
        {
            sb.Append($"- {doel.Code} | {doel.Doelsoort.ToCode()} | {doel.JaarFase} | {doel.Domein} > {doel.Subdomein}")
                .Append(Nl);
            sb.Append($"  Tekst: {doel.Tekst}").Append(Nl);
        }
    }
}
