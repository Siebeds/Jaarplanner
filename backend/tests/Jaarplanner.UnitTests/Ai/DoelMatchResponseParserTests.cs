using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching.Response;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the E2-03 structured-JSON response contract + validation (Art. IV.5): the parser turns a raw
/// <see cref="AiCompletion"/> into <b>either</b> validated <see cref="DoelMatchSuggestie"/> objects
/// <b>or</b> an explicit failure — invalid AI output never yields a suggestion object. These tests
/// are the "Done when" evidence for E2-03.
/// </summary>
public sealed class DoelMatchResponseParserTests
{
    // ---- Valid input -> validated objects ------------------------------------------------------

    [Fact]
    public void Valid_envelope_json_produces_validated_suggestions()
    {
        var content = """
        { "suggesties": [
            { "code": "NL-2", "motivatie": "Sluit aan bij het thema Herfst." },
            { "code": "WI-1", "motivatie": "Tellen komt in de activiteit voor." }
        ] }
        """;

        var resultaat = DoelMatchResponseParser.Parse(new AiCompletion { Content = content });

        Assert.True(resultaat.IsGeldig);
        Assert.Null(resultaat.Fout);
        Assert.Collection(
            resultaat.Suggesties,
            s => Assert.Equal("NL-2", s.Code),
            s => Assert.Equal("WI-1", s.Code));
        Assert.Equal("Sluit aan bij het thema Herfst.", resultaat.Suggesties[0].Motivatie);
    }

    [Fact]
    public void Bare_top_level_array_is_accepted()
    {
        var content = """[ { "code": "MU-3", "motivatie": "Ritme past bij dansactiviteit." } ]""";

        var resultaat = DoelMatchResponseParser.Parse(content);

        Assert.True(resultaat.IsGeldig);
        var suggestie = Assert.Single(resultaat.Suggesties);
        Assert.Equal("MU-3", suggestie.Code);
    }

    [Fact]
    public void Empty_suggesties_array_is_valid_with_zero_suggestions()
    {
        // The model legitimately found no matches — a valid, non-error outcome.
        var resultaat = DoelMatchResponseParser.Parse("""{ "suggesties": [] }""");

        Assert.True(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
        Assert.Null(resultaat.Fout);
    }

    [Fact]
    public void Unknown_extra_fields_are_tolerated()
    {
        var content = """
        { "suggesties": [
            { "code": "NL-2", "motivatie": "Past.", "confidence": 0.9, "extra": "ignored" }
        ], "model": "gpt" }
        """;

        var resultaat = DoelMatchResponseParser.Parse(content);

        Assert.True(resultaat.IsGeldig);
        var suggestie = Assert.Single(resultaat.Suggesties);
        Assert.Equal("NL-2", suggestie.Code);
    }

    // ---- Conservative repair -------------------------------------------------------------------

    [Fact]
    public void Markdown_fenced_json_is_repaired_and_accepted()
    {
        var content = "```json\n{ \"suggesties\": [ { \"code\": \"NL-2\", \"motivatie\": \"Past.\" } ] }\n```";

        var resultaat = DoelMatchResponseParser.Parse(content);

        Assert.True(resultaat.IsGeldig);
        Assert.Equal("NL-2", Assert.Single(resultaat.Suggesties).Code);
    }

    [Fact]
    public void Multiline_motivatie_is_collapsed_to_one_line()
    {
        var content = """{ "suggesties": [ { "code": "NL-2", "motivatie": "Regel een.\n  Regel twee." } ] }""";

        var resultaat = DoelMatchResponseParser.Parse(content);

        Assert.True(resultaat.IsGeldig);
        Assert.Equal("Regel een. Regel twee.", Assert.Single(resultaat.Suggesties).Motivatie);
    }

    // ---- Invalid input -> explicit failure, no suggestions -------------------------------------

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Blank_content_is_rejected(string? content)
    {
        var resultaat = DoelMatchResponseParser.Parse(content);

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
        Assert.NotNull(resultaat.Fout);
    }

    [Fact]
    public void Malformed_json_is_rejected()
    {
        var resultaat = DoelMatchResponseParser.Parse("{ this is not json ");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
        Assert.NotNull(resultaat.Fout);
    }

    [Fact]
    public void Object_without_suggesties_array_is_rejected()
    {
        var resultaat = DoelMatchResponseParser.Parse("""{ "resultaat": "ok" }""");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public void Missing_code_field_is_rejected()
    {
        var resultaat = DoelMatchResponseParser.Parse("""{ "suggesties": [ { "motivatie": "Past." } ] }""");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
        Assert.NotNull(resultaat.Fout);
    }

    [Fact]
    public void Empty_code_field_is_rejected()
    {
        var resultaat = DoelMatchResponseParser.Parse(
            """{ "suggesties": [ { "code": "   ", "motivatie": "Past." } ] }""");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public void Missing_motivatie_field_is_rejected()
    {
        var resultaat = DoelMatchResponseParser.Parse("""{ "suggesties": [ { "code": "NL-2" } ] }""");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public void Empty_motivatie_field_is_rejected()
    {
        var resultaat = DoelMatchResponseParser.Parse(
            """{ "suggesties": [ { "code": "NL-2", "motivatie": "" } ] }""");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public void Null_item_in_array_is_rejected()
    {
        var resultaat = DoelMatchResponseParser.Parse("""{ "suggesties": [ null ] }""");

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public void One_bad_item_rejects_the_whole_response_so_no_partial_domain_state()
    {
        // Art. IV.5: invalid output must not reach the domain even partially — a single bad item
        // fails the whole parse rather than silently dropping it.
        var content = """
        { "suggesties": [
            { "code": "NL-2", "motivatie": "Past." },
            { "code": "", "motivatie": "Leeg." }
        ] }
        """;

        var resultaat = DoelMatchResponseParser.Parse(content);

        Assert.False(resultaat.IsGeldig);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public void Parse_rejects_a_null_completion()
    {
        Assert.Throws<ArgumentNullException>(() => DoelMatchResponseParser.Parse((AiCompletion)null!));
    }

    // ---- Type-level invariant ------------------------------------------------------------------

    [Theory]
    [InlineData("", "Past.")]
    [InlineData("NL-2", "")]
    [InlineData("  ", "  ")]
    public void Suggestie_constructor_enforces_required_fields(string code, string motivatie)
    {
        Assert.Throws<ArgumentException>(() => new DoelMatchSuggestie(code, motivatie));
    }
}
