using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Generatie.Response;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E3-01 / Art. IV.5: the plan-generation response is <b>validated before use</b>. Either a fully validated
/// placement list, or an explicit diagnostic with nothing usable — never a half-parsed plan.
/// </summary>
public sealed class JaarplanGeneratieResponseParserTests
{
    [Fact]
    public void Envelop_met_geldige_plaatsingen_wordt_aanvaard()
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(
            """
            {"plaatsingen":[
              {"blokStart":"2026-09-01","thema":"Herfst","motivatie":"seizoen past bij september"},
              {"blokStart":"2026-10-06","thema":"Water","motivatie":"regenperiode"}]}
            """);

        Assert.True(resultaat.IsGeldig);
        Assert.Null(resultaat.Fout);
        Assert.Equal(2, resultaat.Plaatsingen.Count);
        Assert.Equal(new DateOnly(2026, 9, 1), resultaat.Plaatsingen[0].BlokStart);
        Assert.Equal("Herfst", resultaat.Plaatsingen[0].ThemaNaam);
        Assert.Equal("seizoen past bij september", resultaat.Plaatsingen[0].Motivatie);
    }

    [Fact]
    public void Een_kale_toplevel_array_wordt_ook_aanvaard()
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(
            """[{"blokStart":"2026-09-01","thema":"Herfst","motivatie":"seizoen"}]""");

        Assert.True(resultaat.IsGeldig);
        Assert.Single(resultaat.Plaatsingen);
    }

    [Fact]
    public void Een_markdown_fence_wordt_afgepeld()
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(
            "```json\n{\"plaatsingen\":[{\"blokStart\":\"2026-09-01\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}]}\n```");

        Assert.True(resultaat.IsGeldig);
        Assert.Single(resultaat.Plaatsingen);
    }

    [Fact]
    public void Een_lege_lijst_is_geldig()
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse("""{"plaatsingen":[]}""");

        Assert.True(resultaat.IsGeldig);
        Assert.Empty(resultaat.Plaatsingen);
    }

    /// <summary>
    /// <b>The rejection that matters most</b> (ADR-0020 §3, and the binding constraint on this story). A model that
    /// names the block by its <i>position</i> — "blok": 3, "periode": "derde themaperiode" — has not answered the
    /// question. Accepting it would persist an ordinal, which re-points when the school edits a vakantie and would
    /// silently relocate the teacher's thema. There is deliberately no fallback from a position to a date.
    /// </summary>
    [Theory]
    [InlineData("""{"plaatsingen":[{"blok":3,"thema":"Herfst","motivatie":"seizoen"}]}""")]
    [InlineData("""{"plaatsingen":[{"ordinaal":3,"thema":"Herfst","motivatie":"seizoen"}]}""")]
    [InlineData("""{"plaatsingen":[{"periode":"derde themaperiode","thema":"Herfst","motivatie":"seizoen"}]}""")]
    [InlineData("""{"plaatsingen":[{"blokStart":"","thema":"Herfst","motivatie":"seizoen"}]}""")]
    public void Een_antwoord_op_blokpositie_wordt_geweigerd(string json)
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(json);

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Plaatsingen);
        Assert.Contains("blokStart", resultaat.Fout);
    }

    /// <summary>
    /// A non-ISO date is rejected, not guessed. "01-09-2026" is 1 September to a Belgian reader and 9 January to an
    /// American one; guessing would put a thema most of a year away from where it was meant.
    /// </summary>
    [Theory]
    [InlineData("01-09-2026")]
    [InlineData("2026/09/01")]
    [InlineData("1 september 2026")]
    [InlineData("2026-13-45")]
    public void Een_niet_ISO_datum_wordt_geweigerd(string datum)
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(
            $"{{\"plaatsingen\":[{{\"blokStart\":\"{datum}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}]}}");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Plaatsingen);
        Assert.Contains("ISO", resultaat.Fout);
    }

    [Theory]
    [InlineData("", "Empty")]
    [InlineData("   ", "Empty")]
    [InlineData("dit is geen JSON {kapot", "Malformed JSON")]
    [InlineData("""{"iets":"anders"}""", "Unrecognised response shape")]
    [InlineData("""42""", "Unrecognised response shape")]
    [InlineData("""{"plaatsingen":[null]}""", "is null")]
    [InlineData("""{"plaatsingen":[{"blokStart":"2026-09-01","motivatie":"x"}]}""", "'thema'")]
    [InlineData("""{"plaatsingen":[{"blokStart":"2026-09-01","thema":"Herfst"}]}""", "'motivatie'")]
    [InlineData("""{"plaatsingen":[{"blokStart":"2026-09-01","thema":" ","motivatie":"x"}]}""", "'thema'")]
    public void Ongeldige_antwoorden_leveren_een_diagnose_en_geen_plaatsingen(string json, string verwachteFout)
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(json);

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Plaatsingen);
        Assert.Contains(verwachteFout, resultaat.Fout);
    }

    /// <summary>Property matching is case-insensitive and unknown extra fields are ignored — conservative repair only.</summary>
    [Fact]
    public void Andere_casing_en_extra_velden_zijn_toegestaan()
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(
            """{"plaatsingen":[{"BlokStart":"2026-09-01","Thema":"Herfst","Motivatie":"seizoen","zekerheid":0.9}]}""");

        Assert.True(resultaat.IsGeldig);
        Assert.Equal("Herfst", Assert.Single(resultaat.Plaatsingen).ThemaNaam);
    }

    /// <summary>One invalid item invalidates the whole response — no partial plan reaches the domain (Art. IV.5).</summary>
    [Fact]
    public void Een_ongeldig_item_maakt_het_hele_antwoord_ongeldig()
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(
            """
            {"plaatsingen":[
              {"blokStart":"2026-09-01","thema":"Herfst","motivatie":"geldig"},
              {"blokStart":"morgen","thema":"Water","motivatie":"ongeldig"}]}
            """);

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Plaatsingen);
    }

    [Fact]
    public void Parse_neemt_ook_een_AiCompletion()
    {
        var resultaat = JaarplanGeneratieResponseParser.Parse(new AiCompletion
        {
            Content = """{"plaatsingen":[{"blokStart":"2026-09-01","thema":"Herfst","motivatie":"seizoen"}]}""",
        });

        Assert.True(resultaat.IsGeldig);
        Assert.Throws<ArgumentNullException>(() => JaarplanGeneratieResponseParser.Parse((AiCompletion)null!));
    }
}
