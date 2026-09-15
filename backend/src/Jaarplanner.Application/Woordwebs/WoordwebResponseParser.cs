using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Woordwebs;

/// <summary>One word the model proposed, with its motivation; both non-blank and trimmed.</summary>
public sealed record WoordwebVoorstel(string Woord, string Motivatie);

/// <summary>A validated answer, or the reason it was refused; never a half-checked one (Art. IV.5).</summary>
public sealed record WoordwebParseResultaat(bool IsGeldig, IReadOnlyList<WoordwebVoorstel> Voorstellen, string? Fout)
{
    public static WoordwebParseResultaat Geldig(IReadOnlyList<WoordwebVoorstel> voorstellen) => new(true, voorstellen, null);

    public static WoordwebParseResultaat Ongeldig(string fout) => new(false, [], fout);
}

/// <summary>
/// Validates the model's woordweb answer against its contract (FB-036, Art. IV.5), the way
/// <c>DoelMatchResponseParser</c> does for goals.
/// <para><b>Accepted:</b> <c>{ "woorden": [ { "woord": "…", "motivatie": "…" } ] }</c> or a bare array of such items; an
/// empty list is valid. A leading and trailing markdown fence is stripped, property names match without regard to case
/// and unknown fields are ignored.</para>
/// <para><b>Refused, as a whole:</b> blank or malformed JSON, another root shape, a <c>null</c> item, or an item without a
/// word or a motivation. One bad item refuses the answer, so nothing of a malformed answer is ever stored.</para>
/// <para>Whether a valid word may enter the web (already there, too long, the fifth one) is the web's and the service's
/// question, not this parser's.</para>
/// </summary>
public static class WoordwebResponseParser
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>Validates the completion's content.</summary>
    public static WoordwebParseResultaat Parse(AiCompletion completion)
    {
        ArgumentNullException.ThrowIfNull(completion);
        return Parse(completion.Content);
    }

    /// <summary>Validates raw JSON content.</summary>
    public static WoordwebParseResultaat Parse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return WoordwebParseResultaat.Ongeldig("Empty AI response content.");
        }

        RawWoord?[]? ruwe;
        try
        {
            ruwe = Deserialiseer(StripMarkdownFence(content.Trim()));
        }
        catch (JsonException ex)
        {
            return WoordwebParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (ruwe is null)
        {
            return WoordwebParseResultaat.Ongeldig("Unrecognised response shape: expected a 'woorden' array or a top-level array.");
        }

        var voorstellen = new List<WoordwebVoorstel>(ruwe.Length);
        for (var i = 0; i < ruwe.Length; i++)
        {
            var item = ruwe[i];
            if (item is null)
            {
                return WoordwebParseResultaat.Ongeldig($"Word at index {i} is null.");
            }

            if (string.IsNullOrWhiteSpace(item.Woord))
            {
                return WoordwebParseResultaat.Ongeldig($"Word at index {i} has a missing/blank 'woord'.");
            }

            if (string.IsNullOrWhiteSpace(item.Motivatie))
            {
                return WoordwebParseResultaat.Ongeldig($"Word at index {i} has a missing/blank 'motivatie'.");
            }

            voorstellen.Add(new WoordwebVoorstel(item.Woord.Trim(), item.Motivatie.Trim()));
        }

        return WoordwebParseResultaat.Geldig(voorstellen);
    }

    private static RawWoord?[]? Deserialiseer(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        return root.ValueKind switch
        {
            JsonValueKind.Array => JsonSerializer.Deserialize<RawWoord?[]>(root.GetRawText(), Options) ?? [],
            JsonValueKind.Object when TryGetWoorden(root, out var lijst) =>
                JsonSerializer.Deserialize<RawWoord?[]>(lijst.GetRawText(), Options) ?? [],
            _ => null,
        };
    }

    // The envelope's property matched without regard to case, as the items' properties are.
    private static bool TryGetWoorden(JsonElement root, out JsonElement lijst)
    {
        foreach (var eigenschap in root.EnumerateObject())
        {
            if (string.Equals(eigenschap.Name, "woorden", StringComparison.OrdinalIgnoreCase)
                && eigenschap.Value.ValueKind == JsonValueKind.Array)
            {
                lijst = eigenschap.Value;
                return true;
            }
        }

        lijst = default;
        return false;
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

    private sealed record RawWoord
    {
        [JsonPropertyName("woord")]
        public string? Woord { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }
    }
}
