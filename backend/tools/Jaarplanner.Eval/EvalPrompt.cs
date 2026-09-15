using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Eval;

/// <summary>How the candidate goals are written out in the prompt.</summary>
public enum DoelWeergave
{
    /// <summary>Code, taxonomy and text only: a fraction of the tokens.</summary>
    Compact,

    /// <summary>
    /// Exactly what production step 6 sends. Since TB-007 that is itself a compact list (code, doelsoort, jaar/fase,
    /// domein, subdomein, text), without examples or explanation.
    /// </summary>
    Volledig,
}

/// <summary>
/// Builds the step 6 request for an eval case on top of the production prompt, so what is measured is what ships.
/// <para>
/// The thema and subthema sections are always the production ones (<see cref="ThemaOpbouwPromptBuilder"/>). For
/// <see cref="DoelWeergave.Compact"/> only the goal list after <see cref="LijstKop"/> is replaced; for
/// <see cref="DoelWeergave.Volledig"/> the production request is used as it is. The one addition in both is a ceiling
/// on the number of suggestions, which production does not set.
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

        var productie = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(
            geval.Thema,
            geval.Subthema,
            goalFormat == DoelWeergave.Volledig ? kandidaten : []);

        var userPrompt = goalFormat == DoelWeergave.Volledig
            ? productie.UserPrompt
            : VervangLijst(productie.UserPrompt, kandidaten);

        var systemPrompt = productie.SystemPrompt + Nl +
            $"- Stel hoogstens {maxSuggestions} leerplandoelen voor. Minder mag, een lege lijst ook.";

        return new AiRequest { SystemPrompt = systemPrompt, UserPrompt = userPrompt };
    }

    private static string VervangLijst(string productiePrompt, IReadOnlyCollection<Leerplandoel> kandidaten)
    {
        var begin = productiePrompt.IndexOf(LijstKop, StringComparison.Ordinal);
        if (begin < 0)
        {
            // The production layout changed; measuring a prompt built on a guess would measure the wrong thing.
            throw new InvalidOperationException(
                $"The production step 6 prompt no longer contains '{LijstKop}'; update EvalPrompt.");
        }

        var sb = new StringBuilder(productiePrompt[..begin]).Append(LijstKop).Append(Nl).Append(Nl);
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
