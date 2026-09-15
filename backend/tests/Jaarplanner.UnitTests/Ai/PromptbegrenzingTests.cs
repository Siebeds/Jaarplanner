using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the prompt ceiling of TB-007: the estimate (four characters a token, rounded up, system prompt included), the
/// inclusive limit, and the Dutch refusal, whose advice depends on whether the candidates span more than one leeftijd.
/// </summary>
public sealed class PromptbegrenzingTests
{
    private static AiRequest Request(int tekens) => new() { SystemPrompt = string.Empty, UserPrompt = new string('x', tekens) };

    private static Leerplandoel Doel(string code, string jaarFase) =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, "Natuur", "Levende natuur", "9", tekst: "herkent bomen.");

    [Theory]
    [InlineData(0, 0)]
    [InlineData(1, 1)]
    [InlineData(4, 1)]
    [InlineData(5, 2)]
    [InlineData(200_000, 50_000)]
    public void Schat_vier_tekens_per_token_naar_boven_afgerond(int tekens, int tokens) =>
        Assert.Equal(tokens, Promptbegrenzing.SchatTokens(Request(tekens)));

    [Fact]
    public void Telt_de_systeemprompt_mee() =>
        Assert.Equal(2, Promptbegrenzing.SchatTokens(new AiRequest { SystemPrompt = "abcd", UserPrompt = "efgh" }));

    [Fact]
    public void De_standaardgrens_is_50000() => Assert.Equal(50_000, new Promptbegrenzing().MaxTokens);

    [Fact]
    public void Een_grens_onder_1_wordt_geweigerd() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => new Promptbegrenzing(0));

    [Fact]
    public void Precies_op_de_grens_gaat_door()
    {
        var fout = Record.Exception(() => new Promptbegrenzing(1_000).Bewaak(Request(4_000), [Doel("A", "K3")]));
        Assert.Null(fout);
    }

    [Fact]
    public void Boven_de_grens_met_meerdere_leeftijden_vraagt_minder_leeftijden()
    {
        var fout = Assert.Throws<PromptTeGrootFout>(
            () => new Promptbegrenzing(1_000).Bewaak(Request(4_001), [Doel("A", "K2"), Doel("B", "K3")]));

        Assert.Equal(
            "Deze aanvraag is te groot voor de AI: 2 doelen, ongeveer 1.001 tokens, en de grens is 1.000. Kies minder leeftijden.",
            fout.Message);
        Assert.Equal(1_001, fout.GeschatteTokens);
        Assert.Equal(1_000, fout.MaxTokens);
    }

    [Fact]
    public void Boven_de_grens_met_een_leeftijd_raadt_geen_leeftijden_af_die_er_niet_zijn()
    {
        // With one leeftijd "kies minder leeftijden" has nothing left to remove; the only remedy is a higher ceiling.
        var fout = Assert.Throws<PromptTeGrootFout>(
            () => new Promptbegrenzing(1_000).Bewaak(Request(4_001), [Doel("A", "K3")]));

        Assert.Equal(
            "Deze aanvraag is te groot voor de AI: 1 doel, ongeveer 1.001 tokens, en de grens is 1.000. Vraag wie de app beheert om de grens te verhogen.",
            fout.Message);
    }
}
