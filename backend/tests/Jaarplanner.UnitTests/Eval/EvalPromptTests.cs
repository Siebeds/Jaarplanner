using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Eval;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>The eval runner measures the production step 6 prompt, with only the goal list and the ceiling swapped (TB-004).</summary>
public sealed class EvalPromptTests
{
    [Fact]
    public void Volledig_is_de_productieprompt_met_een_eigen_plafond()
    {
        var geval = EvalTestData.WaterGeval("W-01");
        var kandidaten = EvalTestData.Catalogus().Where(d => d.JaarFase == "K3").ToList();

        var request = EvalPrompt.Build(geval, kandidaten, DoelWeergave.Volledig, maxSuggestions: 5);

        var productie = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(geval.Thema, geval.Subthema, kandidaten);
        Assert.Equal(productie.UserPrompt, request.UserPrompt);
        Assert.Equal(productie.VasteContext, request.VasteContext);
        Assert.Equal(
            productie.SystemPrompt.Replace(
                ThemaOpbouwPromptBuilder.MaxSuggestiesRegel,
                "- Stel hoogstens 5 leerplandoelen voor. Minder mag, een lege lijst ook.",
                StringComparison.Ordinal),
            request.SystemPrompt);
        Assert.DoesNotContain(ThemaOpbouwPromptBuilder.MaxSuggestiesRegel, request.SystemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Compact_houdt_de_schoolcontext_en_schrijft_de_doelen_kort_uit()
    {
        var geval = EvalTestData.WaterGeval("W-01");
        var kandidaten = EvalTestData.Catalogus().Where(d => d.JaarFase == "K3").ToList();

        var request = EvalPrompt.Build(geval, kandidaten, DoelWeergave.Compact, maxSuggestions: 5);

        // The school context is the production rendering, word for word.
        var productie = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(geval.Thema, geval.Subthema, kandidaten);
        Assert.Equal(productie.UserPrompt, request.UserPrompt);
        Assert.Contains("## Subthema: Plassen (leeftijd K3)", request.UserPrompt);

        // The goals are code, taxonomy and text only, in code order.
        Assert.StartsWith(EvalPrompt.LijstKop, request.VasteContext, StringComparison.Ordinal);
        Assert.Contains("- W-01 | Wereldoriëntatie > Natuur | De kleuter onderzoekt water.\n", request.VasteContext);
        Assert.DoesNotContain("Voorbeelden:", request.VasteContext);
        Assert.True(
            request.VasteContext.IndexOf("- W-01", StringComparison.Ordinal)
            < request.VasteContext.IndexOf("- Z-01", StringComparison.Ordinal));
        Assert.Contains("Stel hoogstens 5 leerplandoelen voor. Minder mag, een lege lijst ook.", request.SystemPrompt, StringComparison.Ordinal);
    }
}
