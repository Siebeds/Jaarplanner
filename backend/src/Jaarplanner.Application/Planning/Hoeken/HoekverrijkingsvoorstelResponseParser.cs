using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Planning.Hoeken;

/// <summary>A validated answer: a text with its motivation, or none; or the reason it was refused (Art. IV.5).</summary>
public sealed record HoekverrijkingsvoorstelParseResultaat(bool IsGeldig, string? Tekst, string? Motivatie, string? Fout)
{
    public static HoekverrijkingsvoorstelParseResultaat Geldig(string tekst, string motivatie) => new(true, tekst, motivatie, null);

    public static HoekverrijkingsvoorstelParseResultaat Leeg() => new(true, null, null, null);

    public static HoekverrijkingsvoorstelParseResultaat Ongeldig(string fout) => new(false, null, null, fout);
}

/// <summary>
/// Validates the model's hoekverrijking answer against its contract (FB-028, Art. IV.5).
/// <para><b>Accepted:</b> <c>{ "verrijking": "…", "motivatie": "…" }</c>, or both <c>null</c> (or blank) for "nothing
/// fitting". A leading and trailing markdown fence is stripped, property names match without regard to case and unknown
/// fields are ignored.</para>
/// <para><b>Refused:</b> blank or malformed JSON, another root shape, a text without a motivation, or a text over
/// <see cref="Domain.Planning.Hoekverrijkingsvoorstel.MaxTekstlengte"/> characters.</para>
/// </summary>
public static class HoekverrijkingsvoorstelResponseParser
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>Validates the completion's content.</summary>
    public static HoekverrijkingsvoorstelParseResultaat Parse(AiCompletion completion)
    {
        ArgumentNullException.ThrowIfNull(completion);
        return Parse(completion.Content);
    }

    /// <summary>Validates raw JSON content.</summary>
    public static HoekverrijkingsvoorstelParseResultaat Parse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return HoekverrijkingsvoorstelParseResultaat.Ongeldig("Empty AI response content.");
        }

        Ruw? ruw;
        try
        {
            using var document = JsonDocument.Parse(StripMarkdownFence(content.Trim()));
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return HoekverrijkingsvoorstelParseResultaat.Ongeldig("Unrecognised response shape: expected an object with 'verrijking'.");
            }

            ruw = document.RootElement.Deserialize<Ruw>(Options);
        }
        catch (JsonException ex)
        {
            return HoekverrijkingsvoorstelParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (ruw is null || string.IsNullOrWhiteSpace(ruw.Verrijking))
        {
            return HoekverrijkingsvoorstelParseResultaat.Leeg();
        }

        if (string.IsNullOrWhiteSpace(ruw.Motivatie))
        {
            return HoekverrijkingsvoorstelParseResultaat.Ongeldig("The 'verrijking' has a missing/blank 'motivatie'.");
        }

        var tekst = ruw.Verrijking.Trim();
        if (tekst.Length > Domain.Planning.Hoekverrijkingsvoorstel.MaxTekstlengte)
        {
            return HoekverrijkingsvoorstelParseResultaat.Ongeldig(
                $"The 'verrijking' is {tekst.Length} characters, over the {Domain.Planning.Hoekverrijkingsvoorstel.MaxTekstlengte} limit.");
        }

        return HoekverrijkingsvoorstelParseResultaat.Geldig(tekst, ruw.Motivatie.Trim());
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

    private sealed record Ruw
    {
        [JsonPropertyName("verrijking")]
        public string? Verrijking { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }
    }
}
