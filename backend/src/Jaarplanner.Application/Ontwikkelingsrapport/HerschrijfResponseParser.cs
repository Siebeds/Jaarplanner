using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>A validated rewrite, or the reason it was refused; never a half-checked one (Art. IV.5).</summary>
public sealed record HerschrijfParseResultaat(bool IsGeldig, string? Tekst, string? Fout)
{
    public static HerschrijfParseResultaat Geldig(string tekst) => new(true, tekst, null);

    public static HerschrijfParseResultaat Ongeldig(string fout) => new(false, null, fout);
}

/// <summary>
/// Validates the model's rewrite against its contract (FB-004, Art. IV.5, ADR-0035 §3.5), the way
/// <c>WoordwebResponseParser</c> does for words.
/// <para><b>Accepted:</b> <c>{ "tekst": "…" }</c>. A leading and trailing markdown fence is stripped, the property
/// matches without regard to case, and unknown fields are ignored.</para>
/// <para><b>Refused, as a whole:</b> blank or malformed JSON, another root shape, a missing or blank text, or one longer
/// than the field takes. Nothing of a refused answer reaches the teacher.</para>
/// <para><b>The placeholders are checked by the caller</b> (<see cref="Naamvervanging.HeeftPreciesDeze"/>): this parser
/// never sees which names were masked, and keeping it that way is what makes it a pure JSON check.</para>
/// <para><b>The diagnostics are English and quote nothing</b> (Art. II.3, ADR-0035 §3.8): they describe the shape of the
/// answer, never a word of it, because a fault can reach a log and the text is pupil data.</para>
/// </summary>
public static class HerschrijfResponseParser
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>Validates the completion's content against <paramref name="maxLengte"/>, the field's own limit.</summary>
    public static HerschrijfParseResultaat Parse(AiCompletion completion, int maxLengte)
    {
        ArgumentNullException.ThrowIfNull(completion);
        return Parse(completion.Content, maxLengte);
    }

    /// <summary>Validates raw JSON content against <paramref name="maxLengte"/>.</summary>
    public static HerschrijfParseResultaat Parse(string? content, int maxLengte)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return HerschrijfParseResultaat.Ongeldig("Empty AI response content.");
        }

        RawHerschrijving? ruw;
        try
        {
            ruw = JsonSerializer.Deserialize<RawHerschrijving>(StripMarkdownFence(content.Trim()), Options);
        }
        catch (JsonException ex)
        {
            return HerschrijfParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (ruw is null)
        {
            return HerschrijfParseResultaat.Ongeldig("Unrecognised response shape: expected an object with a 'tekst' property.");
        }

        if (string.IsNullOrWhiteSpace(ruw.Tekst))
        {
            return HerschrijfParseResultaat.Ongeldig("The response has a missing/blank 'tekst'.");
        }

        var tekst = ruw.Tekst.Trim();
        return tekst.Length > maxLengte
            ? HerschrijfParseResultaat.Ongeldig($"The rewritten text is longer than the {maxLengte} characters the field takes.")
            : HerschrijfParseResultaat.Geldig(tekst);
    }

    private static string StripMarkdownFence(string text)
    {
        if (!text.StartsWith("```", StringComparison.Ordinal))
        {
            return text;
        }

        var firstNewline = text.IndexOf('\n');
        if (firstNewline < 0)
        {
            return text;
        }

        var body = text[(firstNewline + 1)..];
        var lastFence = body.LastIndexOf("```", StringComparison.Ordinal);
        if (lastFence >= 0)
        {
            body = body[..lastFence];
        }

        return body.Trim();
    }

    private sealed record RawHerschrijving
    {
        [JsonPropertyName("tekst")]
        public string? Tekst { get; init; }
    }
}
