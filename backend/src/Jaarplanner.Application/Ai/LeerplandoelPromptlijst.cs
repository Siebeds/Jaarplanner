using System.Text;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Ai;

/// <summary>
/// The candidate goal list of every grounded goal prompt: the matching prompt (E2-02) and both authoring prompts (E2-07).
/// Kept in one place, so no two prompts write the same goal two ways.
/// <para>
/// <b>The stable part of the request</b> (TB-043). The builders send it as <see cref="AiRequest.VasteContext"/>, right
/// after the system prompt and before any school content, so two requests over the same candidates share a prefix a
/// provider can serve from its cache. It is therefore a function of the candidates alone: nothing about a thema, not even
/// which goals it already links, may enter it.
/// </para>
/// <para>
/// <b>Compact.</b> Per goal only its code, doelsoort, jaarfase, domein, subdomein and text (TB-007): voorbeelden,
/// toelichting, woordenschat, cluster and the minimumdoel reference stay out. Domein and subdomein are written once, as a
/// heading over their goals, and a doelsoort or jaarfase that every candidate shares is written once above the list
/// instead of on every line (TB-043). Whether the model matches as well on the short form is what the TB-004 evaluation
/// measures.
/// </para>
/// <para>
/// Ordered by domein, subdomein and then the stable code, so caller ordering cannot leak into the prompt and it stays
/// snapshot-testable and byte-identical across requests. Every value comes from the loaded Op.stap goal itself
/// (Art. IV.4).
/// </para>
/// </summary>
internal static class LeerplandoelPromptlijst
{
    /// <summary>The heading of the list. The system prompts refer to it by this name.</summary>
    public const string Kop = "# Beschikbare Op.stap-leerplandoelen";

    private const string Nl = "\n";

    /// <summary>The list for <paramref name="leerdoelen"/>: the heading and the goals, grouped by domein and subdomein.</summary>
    public static string Bouw(IReadOnlyCollection<Leerplandoel> leerdoelen)
    {
        ArgumentNullException.ThrowIfNull(leerdoelen);

        var sb = new StringBuilder();
        sb.Append(Kop).Append(Nl).Append(Nl);
        if (leerdoelen.Count == 0)
        {
            sb.Append("- (geen leerplandoelen aangeleverd)").Append(Nl);
            return sb.ToString();
        }

        var doelsoorten = leerdoelen.Select(d => d.Doelsoort.ToCode()).Distinct(StringComparer.Ordinal).ToList();
        var jaarFasen = leerdoelen.Select(d => d.JaarFase).Distinct(StringComparer.Ordinal).ToList();
        var eenDoelsoort = doelsoorten.Count == 1;
        var eenJaarFase = jaarFasen.Count == 1;

        var gedeeld = new List<string>();
        if (eenDoelsoort)
        {
            gedeeld.Add($"doelsoort {doelsoorten[0]}");
        }

        if (eenJaarFase)
        {
            gedeeld.Add($"jaarfase {jaarFasen[0]}");
        }

        if (gedeeld.Count > 0)
        {
            sb.Append($"Voor alle doelen hieronder: {string.Join(", ", gedeeld)}.").Append(Nl).Append(Nl);
        }

        var groepen = leerdoelen
            .GroupBy(d => (d.Domein, d.Subdomein))
            .OrderBy(g => g.Key.Domein, StringComparer.Ordinal)
            .ThenBy(g => g.Key.Subdomein, StringComparer.Ordinal);

        var eersteGroep = true;
        foreach (var groep in groepen)
        {
            if (!eersteGroep)
            {
                sb.Append(Nl);
            }

            eersteGroep = false;
            sb.Append($"## {groep.Key.Domein} > {groep.Key.Subdomein}").Append(Nl);
            foreach (var doel in groep.OrderBy(d => d.Code, StringComparer.Ordinal))
            {
                var eigen = new List<string>();
                if (!eenDoelsoort)
                {
                    eigen.Add(doel.Doelsoort.ToCode());
                }

                if (!eenJaarFase)
                {
                    eigen.Add(doel.JaarFase);
                }

                var kenmerken = eigen.Count > 0 ? $" ({string.Join(", ", eigen)})" : string.Empty;
                sb.Append($"- {doel.Code}{kenmerken}: {doel.Tekst}").Append(Nl);
            }
        }

        return sb.ToString();
    }
}
