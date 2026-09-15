using Jaarplanner.Application.Woordwebs;

namespace Jaarplanner.UnitTests.Woordwebs;

/// <summary>
/// The woordweb answer contract (FB-036, Art. IV.5): a valid answer becomes words with motivations, and anything else is
/// refused as a whole, so nothing of a malformed answer reaches the web.
/// </summary>
public sealed class WoordwebResponseParserTests
{
    [Fact]
    public void Het_envelop_geeft_de_woorden_met_hun_motivatie_getrimd()
    {
        var resultaat = WoordwebResponseParser.Parse(
            """{"woorden": [{"woord": " wolk ", "motivatie": " Wolken brengen regen. "}, {"woord": "donder", "motivatie": "Hoort bij onweer."}]}""");

        Assert.True(resultaat.IsGeldig);
        Assert.Equal(
            [new WoordwebVoorstel("wolk", "Wolken brengen regen."), new WoordwebVoorstel("donder", "Hoort bij onweer.")],
            resultaat.Voorstellen);
    }

    [Fact]
    public void Een_losse_lijst_en_andere_hoofdletters_in_de_veldnamen_worden_aanvaard()
    {
        var resultaat = WoordwebResponseParser.Parse("""[{"Woord": "wolk", "MOTIVATIE": "Een reden."}]""");

        Assert.True(resultaat.IsGeldig);
        Assert.Equal("wolk", Assert.Single(resultaat.Voorstellen).Woord);
    }

    [Fact]
    public void Een_envelop_met_een_andere_hoofdletter_wordt_aanvaard()
    {
        var resultaat = WoordwebResponseParser.Parse("""{"Woorden": [{"woord": "wolk", "motivatie": "Een reden."}]}""");

        Assert.True(resultaat.IsGeldig);
        Assert.Single(resultaat.Voorstellen);
    }

    [Fact]
    public void Een_lege_lijst_is_een_geldig_antwoord()
    {
        var resultaat = WoordwebResponseParser.Parse("""{"woorden": []}""");

        Assert.True(resultaat.IsGeldig);
        Assert.Empty(resultaat.Voorstellen);
    }

    [Fact]
    public void Een_markdown_omheining_wordt_weggehaald()
    {
        var resultaat = WoordwebResponseParser.Parse("```json\n{\"woorden\": [{\"woord\": \"wolk\", \"motivatie\": \"Een reden.\"}]}\n```");

        Assert.True(resultaat.IsGeldig);
        Assert.Single(resultaat.Voorstellen);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("geen json")]
    [InlineData("""{"woorden": [""")]
    [InlineData("""{"suggesties": []}""")]
    [InlineData("""{"woorden": "wolk"}""")]
    [InlineData("\"wolk\"")]
    [InlineData("""{"woorden": [null]}""")]
    [InlineData("""{"woorden": [{"woord": "wolk"}]}""")]
    [InlineData("""{"woorden": [{"motivatie": "Een reden."}]}""")]
    [InlineData("""{"woorden": [{"woord": " ", "motivatie": "Een reden."}]}""")]
    [InlineData("""{"woorden": [{"woord": "wolk", "motivatie": "Een reden."}, {"woord": "regen", "motivatie": ""}]}""")]
    public void Een_antwoord_buiten_het_contract_wordt_in_zijn_geheel_geweigerd(string? inhoud)
    {
        var resultaat = WoordwebResponseParser.Parse(inhoud);

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Voorstellen);
        Assert.False(string.IsNullOrWhiteSpace(resultaat.Fout));
    }
}
