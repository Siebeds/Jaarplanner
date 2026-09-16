using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Eval;

/// <summary>How the candidate goals are written out in the prompt.</summary>
public enum DoelWeergave
{
    /// <summary>Code, taxonomy and text only, one line a goal: the shortest form the eval measures.</summary>
    Compact,

    /// <summary>
    /// Exactly what production step 6 sends. Since TB-007 that is itself a compact list (code, doelsoort, jaarfase,
    /// domein, subdomein, text), without examples or explanation, and since TB-043 grouped under domein and subdomein.
    /// </summary>
    Volledig,
}

/// <summary>
/// Builds the step 6 request for an eval case on top of the production prompt, so what is measured is what ships.
/// <para>
/// The system prompt and the thema and subthema sections (the user prompt) are always the production ones
/// (<see cref="ThemaOpbouwPromptBuilder"/>). For <see cref="DoelWeergave.Compact"/> only the goal list, the request's
/// <see cref="AiRequest.VasteContext"/>, is replaced; for <see cref="DoelWeergave.Volledig"/> the production request is
/// used as it is. The one change in both is the ceiling on the number of suggestions: the production rule
/// (<see cref="ThemaOpbouwPromptBuilder.MaxSuggestiesRegel"/>) is swapped for the run's own.
/// </para>
/// </summary>
public static class EvalPrompt
{
    /// <summary>The heading that starts the goal list in the production prompt.</summary>
    internal const string LijstKop = "# Beschikbare Op.stap-leerplandoelen";

    private const string Nl = "\n";

    /// <summary>Builds the request for <paramref name="geval"/> over <paramref name="kandidaten"/>.</summary>
    public static AiRequest Build(
        EvalGeval geval,
        IReadOnlyCollection<Leerplandoel> kandidaten,
        DoelWeergave goalFormat,
        int maxSuggestions)
    {
        ArgumentNullException.ThrowIfNull(geval);
        ArgumentNullException.ThrowIfNull(kandidaten);
        ArgumentOutOfRangeException.ThrowIfLessThan(maxSuggestions, 1);

        var productie = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(geval.Thema, geval.Subthema, kandidaten);

        if (!productie.SystemPrompt.Contains(ThemaOpbouwPromptBuilder.MaxSuggestiesRegel, StringComparison.Ordinal))
        {
            // The production layout changed; measuring a prompt built on a guess would measure the wrong thing.
            throw new InvalidOperationException(
                "The production step 6 system prompt no longer contains its ceiling rule; update EvalPrompt.");
        }

        var systemPrompt = productie.SystemPrompt.Replace(
            ThemaOpbouwPromptBuilder.MaxSuggestiesRegel,
            $"- Stel hoogstens {maxSuggestions} leerplandoelen voor. Minder mag, een lege lijst ook.",
            StringComparison.Ordinal);

        return productie with
        {
            SystemPrompt = systemPrompt,
            VasteContext = goalFormat == DoelWeergave.Volledig ? productie.VasteContext : CompacteLijst(kandidaten),
        };
    }

    private static string CompacteLijst(IReadOnlyCollection<Leerplandoel> kandidaten)
    {
        var sb = new StringBuilder().Append(LijstKop).Append(Nl).Append(Nl);
        if (kandidaten.Count == 0)
        {
            sb.Append("- (geen leerplandoelen aangeleverd)").Append(Nl);
            return sb.ToString();
        }

        foreach (var doel in kandidaten.OrderBy(d => d.Code, StringComparer.Ordinal))
        {
            var taxonomie = doel.Cluster is null
                ? $"{doel.Domein} > {doel.Subdomein}"
                : $"{doel.Domein} > {doel.Subdomein} > {doel.Cluster}";
            sb.Append("- ").Append(doel.Code).Append(" | ").Append(taxonomie).Append(" | ").Append(doel.Tekst).Append(Nl);
        }

        return sb.ToString();
    }
}
