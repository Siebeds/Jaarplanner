using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Eval;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>The eval runner measures the production step 6 prompt, with only the goal list swapped (TB-004).</summary>
public sealed class EvalPromptTests
{
    [Fact]
    public void Volledig_is_de_productieprompt_met_een_plafond()
    {
        var geval = EvalTestData.WaterGeval("W-01");
        var kandidaten = EvalTestData.Catalogus().Where(d => d.JaarFase == "K3").ToList();

        var request = EvalPrompt.Build(geval, kandidaten, DoelWeergave.Volledig, maxSuggestions: 8);

        var productie = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(geval.Thema, geval.Subthema, kandidaten);
        Assert.Equal(productie.UserPrompt, request.UserPrompt);
        Assert.StartsWith(ThemaOpbouwPromptBuilder.SystemPromptSubdoelen, request.SystemPrompt, StringComparison.Ordinal);
        Assert.EndsWith("Stel hoogstens 8 leerplandoelen voor. Minder mag, een lege lijst ook.", request.SystemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Compact_houdt_de_schoolcontext_en_schrijft_de_doelen_kort_uit()
    {
        var geval = EvalTestData.WaterGeval("W-01");
        var kandidaten = EvalTestData.Catalogus().Where(d => d.JaarFase == "K3").ToList();

        var request = EvalPrompt.Build(geval, kandidaten, DoelWeergave.Compact, maxSuggestions: 5);

        // The school context is the production rendering, word for word.
        var zonderDoelen = ThemaOpbouwPromptBuilder.BouwSubdoelRequest(geval.Thema, geval.Subthema, []).UserPrompt;
        var context = zonderDoelen[..zonderDoelen.IndexOf(EvalPrompt.LijstKop, StringComparison.Ordinal)];
        Assert.StartsWith(context, request.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("## Subthema: Plassen (leeftijd K3)", request.UserPrompt);

        // The goals are code, taxonomy and text only, in code order.
        Assert.Contains("- W-01 | Wereldoriëntatie > Natuur | De kleuter onderzoekt water.\n", request.UserPrompt);
        Assert.DoesNotContain("Voorbeelden:", request.UserPrompt);
        Assert.True(
            request.UserPrompt.IndexOf("- W-01", StringComparison.Ordinal)
            < request.UserPrompt.IndexOf("- Z-01", StringComparison.Ordinal));
        Assert.EndsWith("Stel hoogstens 5 leerplandoelen voor. Minder mag, een lege lijst ook.", request.SystemPrompt, StringComparison.Ordinal);
    }
}
