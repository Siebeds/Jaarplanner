using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.AiMatching.Response;

/// <summary>
/// Parses and validates the raw <see cref="AiCompletion"/> content (a JSON string) against the
/// structured-JSON match contract, and produces a <see cref="DoelMatchParseResultaat"/> —
/// validated objects or an explicit failure, <b>never</b> a half-checked object (Art. IV.5).
/// <para>
/// The stateless, static shape is intentional: the parser holds no dependencies and touches no
/// network or database, so it needs no DI registration and is trivially unit-testable. It treats
/// goal codes as <b>opaque</b> — it validates required-field shape, not existence against the
/// loaded curriculum (that is E2-04's concern).
/// </para>
/// <para><b>Accepted contract.</b> Either an envelope
/// <c>{ "suggesties": [ { "code": "...", "motivatie": "..." }, ... ] }</c> or a bare top-level array
/// <c>[ { "code": "...", "motivatie": "..." } ]</c>. An empty list is valid (the model found no
/// matches). <b>Conservative repair only:</b> a leading/trailing markdown ```` ```json ```` fence is
/// stripped and surrounding whitespace trimmed; property matching is case-insensitive; unknown extra
/// fields are ignored. Nothing is ever fabricated.</para>
/// <para><b>Rejected (explicit failure).</b> Blank content, non-JSON / malformed JSON, a root that is
/// neither the envelope nor an array, an envelope missing its <c>suggesties</c> array, a
/// <c>null</c> item, or any item with a missing/blank <c>code</c> or <c>motivatie</c>.</para>
/// </summary>
public static class DoelMatchResponseParser
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>Parses + validates the completion. See the type doc for the exact contract.</summary>
    /// <param name="completion">The raw model completion (E2-01 seam); must not be null.</param>
    /// <returns>A validated result or an explicit failure — never a half-parsed object (Art. IV.5).</returns>
    public static DoelMatchParseResultaat Parse(AiCompletion completion)
    {
        ArgumentNullException.ThrowIfNull(completion);
        return Parse(completion.Content);
    }

    /// <summary>Parses + validates raw JSON content directly (convenience overload).</summary>
    public static DoelMatchParseResultaat Parse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return DoelMatchParseResultaat.Ongeldig("Empty AI response content.");
        }

        var json = StripMarkdownFence(content.Trim());

        RawSuggestie?[]? ruwe;
        try
        {
            ruwe = Deserialiseer(json);
        }
        catch (JsonException ex)
        {
            return DoelMatchParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (ruwe is null)
        {
            return DoelMatchParseResultaat.Ongeldig(
                "Unrecognised response shape: expected a 'suggesties' array or a top-level array.");
        }

        var suggesties = new List<DoelMatchSuggestie>(ruwe.Length);
        for (var i = 0; i < ruwe.Length; i++)
        {
            var item = ruwe[i];
            if (item is null)
            {
                return DoelMatchParseResultaat.Ongeldig($"Suggestion at index {i} is null.");
            }

            if (string.IsNullOrWhiteSpace(item.Code))
            {
                return DoelMatchParseResultaat.Ongeldig($"Suggestion at index {i} has a missing/blank 'code'.");
            }

            if (string.IsNullOrWhiteSpace(item.Motivatie))
            {
                return DoelMatchParseResultaat.Ongeldig($"Suggestion at index {i} has a missing/blank 'motivatie'.");
            }

            // The constructor re-validates and normalises — a suggestion object cannot exist invalid.
            suggesties.Add(new DoelMatchSuggestie(item.Code, item.Motivatie));
        }

        return DoelMatchParseResultaat.Geldig(suggesties);
    }

    // Accepts both the envelope ({ "suggesties": [...] }) and a bare top-level array ([...]).
    // Returns null for any other root shape (e.g. a JSON object without a suggesties array), which
    // the caller turns into an explicit failure. A JsonException bubbles up for malformed JSON.
    private static RawSuggestie?[]? Deserialiseer(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        return root.ValueKind switch
        {
            JsonValueKind.Array =>
                JsonSerializer.Deserialize<RawSuggestie?[]>(root.GetRawText(), Options) ?? [],
            JsonValueKind.Object when root.TryGetProperty("suggesties", out var lijst)
                                      && lijst.ValueKind == JsonValueKind.Array =>
                JsonSerializer.Deserialize<RawSuggestie?[]>(lijst.GetRawText(), Options) ?? [],
            _ => null,
        };
    }

    // Strips a single leading/trailing markdown code fence (```json ... ``` or ``` ... ```), which
    // models often wrap JSON in. Conservative: only touches a fence at the very start/end.
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

    // Deserialisation-only DTO for the raw, unvalidated JSON. Never leaves this file: the validated
    // public type is DoelMatchSuggestie. Tolerates unknown extra fields (ignored by default).
    private sealed record RawSuggestie
    {
        [JsonPropertyName("code")]
        public string? Code { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }
    }
}
