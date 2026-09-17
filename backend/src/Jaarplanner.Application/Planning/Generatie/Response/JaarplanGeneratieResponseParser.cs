using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Planning.Generatie.Response;

/// <summary>
/// Parses and validates the raw <see cref="AiCompletion"/> content of a plan-generation call against the
/// structured-JSON contract, producing a <see cref="JaarplanParseResultaat"/> — validated objects or an explicit
/// failure, <b>never</b> a half-checked plan (Art. IV.5). The planning sibling of
/// <c>DoelMatchResponseParser</c>, kept deliberately in the same shape: stateless and static, no dependencies,
/// no network, no database, trivially unit-testable.
/// <para><b>Accepted contract.</b> Either an envelope
/// <c>{ "plaatsingen": [ { "thema": "...", "startweek": "2026-09-07", "motivatie": "..." }, ... ] }</c> or a bare
/// top-level array of the same items. An empty list is valid (the model proposed nothing). <b>Conservative repair
/// only:</b> a leading/trailing markdown ```` ```json ```` fence is stripped, surrounding whitespace trimmed,
/// property matching is case-insensitive, unknown extra fields are ignored. Nothing is ever fabricated or
/// guessed.</para>
/// <para><b><c>startweek</c> must be an ISO <c>yyyy-MM-dd</c> date, and is required.</b> It names the Monday of a
/// lesweek (ADR-0055); whether it does is the service's check, not the parser's. A non-ISO date is rejected rather than
/// parsed with the ambient culture: "01-09-2026" is September 1st to a Belgian reader and January 9th to an American
/// one, and guessing would put a thema months away from where it was meant.</para>
/// <para><b>Rejected (explicit failure).</b> Blank content, malformed JSON, a root that is neither the envelope
/// nor an array, an envelope missing its <c>plaatsingen</c> array, a <c>null</c> item, or any item with a
/// missing/blank <c>thema</c> or <c>motivatie</c>, or a missing/unparseable <c>startweek</c>.</para>
/// </summary>
public static class JaarplanGeneratieResponseParser
{
    /// <summary>
    /// The one date format accepted for <c>startweek</c>. Exposed so the prompt builder demands exactly the
    /// format the parser accepts — the two drifting apart is the classic way a validated contract stops
    /// validating anything.
    /// </summary>
    public const string DatumFormaat = "yyyy-MM-dd";

    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>Parses + validates the completion. See the type doc for the exact contract.</summary>
    /// <param name="completion">The raw model completion (the E2-01 <c>IAiClient</c> seam); must not be null.</param>
    /// <returns>A validated result or an explicit failure — never a half-parsed plan (Art. IV.5).</returns>
    public static JaarplanParseResultaat Parse(AiCompletion completion)
    {
        ArgumentNullException.ThrowIfNull(completion);

        return Parse(completion.Content);
    }

    /// <summary>Parses + validates raw JSON content directly (convenience overload).</summary>
    public static JaarplanParseResultaat Parse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return JaarplanParseResultaat.Ongeldig("Empty AI response content.");
        }

        var json = StripMarkdownFence(content.Trim());

        RawPlaatsing?[]? ruwe;
        try
        {
            ruwe = Deserialiseer(json);
        }
        catch (JsonException ex)
        {
            return JaarplanParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (ruwe is null)
        {
            return JaarplanParseResultaat.Ongeldig(
                "Unrecognised response shape: expected a 'plaatsingen' array or a top-level array.");
        }

        var plaatsingen = new List<ThemaplaatsingSuggestie>(ruwe.Length);
        for (var i = 0; i < ruwe.Length; i++)
        {
            var item = ruwe[i];
            if (item is null)
            {
                return JaarplanParseResultaat.Ongeldig($"Placement at index {i} is null.");
            }

            if (string.IsNullOrWhiteSpace(item.Thema))
            {
                return JaarplanParseResultaat.Ongeldig($"Placement at index {i} has a missing/blank 'thema'.");
            }

            if (string.IsNullOrWhiteSpace(item.Motivatie))
            {
                return JaarplanParseResultaat.Ongeldig($"Placement at index {i} has a missing/blank 'motivatie'.");
            }

            if (string.IsNullOrWhiteSpace(item.Startweek))
            {
                return JaarplanParseResultaat.Ongeldig($"Placement at index {i} has a missing/blank 'startweek'.");
            }

            if (!DateOnly.TryParseExact(
                    item.Startweek.Trim(),
                    DatumFormaat,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out var startweek))
            {
                return JaarplanParseResultaat.Ongeldig(
                    $"Placement at index {i} has a 'startweek' that is not an ISO {DatumFormaat} date: " +
                    $"'{item.Startweek}'.");
            }

            // The constructor re-validates and normalises — a suggestion object cannot exist invalid.
            plaatsingen.Add(new ThemaplaatsingSuggestie(item.Thema, startweek, item.Motivatie));
        }

        return JaarplanParseResultaat.Geldig(plaatsingen);
    }

    // Accepts both the envelope ({ "plaatsingen": [...] }) and a bare top-level array ([...]). Returns null for
    // any other root shape, which the caller turns into an explicit failure; a JsonException bubbles up for
    // malformed JSON.
    private static RawPlaatsing?[]? Deserialiseer(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        return root.ValueKind switch
        {
            JsonValueKind.Array =>
                JsonSerializer.Deserialize<RawPlaatsing?[]>(root.GetRawText(), Options) ?? [],
            JsonValueKind.Object when root.TryGetProperty("plaatsingen", out var lijst)
                                      && lijst.ValueKind == JsonValueKind.Array =>
                JsonSerializer.Deserialize<RawPlaatsing?[]>(lijst.GetRawText(), Options) ?? [],
            _ => null,
        };
    }

    // Strips a single leading/trailing markdown code fence, which models often wrap JSON in. Conservative: only
    // touches a fence at the very start/end.
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

    // Deserialisation-only DTO for the raw, unvalidated JSON. Never leaves this file: the validated public type is
    // ThemaplaatsingSuggestie.
    private sealed record RawPlaatsing
    {
        [JsonPropertyName("startweek")]
        public string? Startweek { get; init; }

        [JsonPropertyName("thema")]
        public string? Thema { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }
    }
}
