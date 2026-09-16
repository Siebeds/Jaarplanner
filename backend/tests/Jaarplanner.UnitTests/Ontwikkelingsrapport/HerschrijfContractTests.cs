using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Ontwikkelingsrapport;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// The prompt and the answer of an AI rewrite (FB-004, Art. IV.4, IV.5, ADR-0035 §3.5): that nothing but the one text
/// goes out, and that an answer outside the contract is refused whole.
/// </summary>
public sealed class HerschrijfPromptBuilderTests
{
    [Fact]
    public void De_user_prompt_is_de_tekst_en_verder_niets()
    {
        // R21: no rapportdoel title, no gradatie, no subdoelen, no other child, no earlier report. The whole prompt is
        // the masked text, so this assertion is the rule.
        const string gemaskeerd = "#NAAM1# tekende deze periode vaak een roos.";

        Assert.Equal(gemaskeerd, HerschrijfPromptBuilder.Bouw(gemaskeerd).UserPrompt);
    }

    [Fact]
    public void De_system_prompt_verbiedt_toevoegen_en_vraagt_de_plaatshouders_te_bewaren()
    {
        var prompt = HerschrijfPromptBuilder.SystemPrompt;

        Assert.Contains("Behoud de betekenis volledig", prompt, StringComparison.Ordinal);
        Assert.Contains("#NAAM1#", prompt, StringComparison.Ordinal);
        Assert.Contains("{\"tekst\": \"<de herschreven tekst>\"}", prompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_lege_tekst_bereikt_het_model_nooit() =>
        Assert.Throws<ArgumentException>(() => HerschrijfPromptBuilder.Bouw("   "));
}

/// <summary>
/// <see cref="HerschrijfResponseParser"/>: a valid rewrite, or nothing (Art. IV.5). Its diagnostics are English and
/// quote no text, since a fault can reach a log and a rapporttekst is pupil data.
/// </summary>
public sealed class HerschrijfResponseParserTests
{
    private const int Max = 2000;

    [Fact]
    public void Leest_de_tekst_uit_het_afgesproken_object()
    {
        var resultaat = HerschrijfResponseParser.Parse("{\"tekst\": \"  Het kind speelt graag buiten.  \"}", Max);

        Assert.True(resultaat.IsGeldig);
        Assert.Equal("Het kind speelt graag buiten.", resultaat.Tekst);
    }

    [Fact]
    public void Leest_ook_door_een_markdown_hek_heen()
    {
        var resultaat = HerschrijfResponseParser.Parse("```json\n{\"TEKST\": \"Zij speelt graag.\"}\n```", Max);

        Assert.True(resultaat.IsGeldig);
        Assert.Equal("Zij speelt graag.", resultaat.Tekst);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("geen json")]
    [InlineData("[\"een lijst\"]")]
    [InlineData("{\"woorden\": []}")]
    [InlineData("{\"tekst\": \"\"}")]
    [InlineData("{\"tekst\": \"   \"}")]
    [InlineData("{\"tekst\": null}")]
    public void Weigert_alles_wat_niet_het_contract_is(string? inhoud)
    {
        var resultaat = HerschrijfResponseParser.Parse(inhoud, Max);

        Assert.False(resultaat.IsGeldig);
        Assert.Null(resultaat.Tekst);
        Assert.NotNull(resultaat.Fout);
    }

    [Fact]
    public void Weigert_een_tekst_die_langer_is_dan_het_veld()
    {
        var resultaat = HerschrijfResponseParser.Parse($"{{\"tekst\": \"{new string('a', Max + 1)}\"}}", Max);

        Assert.False(resultaat.IsGeldig);
        // The diagnostic names the limit, never a character of the answer.
        Assert.Contains(Max.ToString(System.Globalization.CultureInfo.InvariantCulture), resultaat.Fout!, StringComparison.Ordinal);
    }

    [Fact]
    public void Leest_een_completion_even_goed_als_ruwe_json()
    {
        var resultaat = HerschrijfResponseParser.Parse(
            new AiCompletion { Content = "{\"tekst\": \"Zij speelt graag.\"}" },
            Max);

        Assert.True(resultaat.IsGeldig);
    }
}
