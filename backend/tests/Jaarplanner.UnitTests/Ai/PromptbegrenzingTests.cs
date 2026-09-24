using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

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
    public void Telt_de_vaste_context_mee() =>
        Assert.Equal(
            3,
            Promptbegrenzing.SchatTokens(new AiRequest { SystemPrompt = "abcd", VasteContext = "efgh", UserPrompt = "ijkl" }));

    [Fact]
    public void Telt_het_gesprek_mee() =>
        Assert.Equal(
            4,
            Promptbegrenzing.SchatTokens(new AiRequest { SystemPrompt = "abcd", UserPrompt = "efgh", Gesprek = [new AiBeurt("ijkl", "mnop")] }));

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
            "Deze aanvraag is te groot voor de AI: de tekst van 2 doelen is meer dan één aanvraag mag bevatten (ongeveer 1.001 tokens, de grens is 1.000). Kies minder leeftijden.",
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
            "Deze aanvraag is te groot voor de AI: de tekst van 1 doel is meer dan één aanvraag mag bevatten (ongeveer 1.001 tokens, de grens is 1.000). Die grens is een instelling op de server: vraag wie de app technisch beheert om ze te verhogen.",
            fout.Message);
    }

    [Fact]
    public void Boven_de_grens_voor_een_woordweb_noemt_zijn_woorden_en_de_serverinstelling()
    {
        var web = new Woordweb(Guid.NewGuid(), Guid.NewGuid());
        web.VoegWoordenToe(["wind", "regen"]);

        var fout = Assert.Throws<PromptTeGrootFout>(() => new Promptbegrenzing(1_000).Bewaak(Request(4_001), web));

        Assert.Equal(
            "Deze aanvraag is te groot voor de AI: de tekst van 2 woorden is meer dan één aanvraag mag bevatten (ongeveer 1.001 tokens, de grens is 1.000). Die grens is een instelling op de server: vraag wie de app technisch beheert om ze te verhogen.",
            fout.Message);
    }

    [Fact]
    public void Een_woordweb_op_de_grens_gaat_door() =>
        new Promptbegrenzing(1_000).Bewaak(Request(4_000), new Woordweb(Guid.NewGuid(), Guid.NewGuid()));
}
