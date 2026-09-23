using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Planning.Weekvoorstel;

/// <summary>One pick as the model wrote it; every field is trimmed and may be <c>null</c>.</summary>
/// <param name="Activiteit">The candidate's key (<c>A1</c>, …).</param>
/// <param name="Dag">The day it names, as written (ISO). Text: reading it is <see cref="Weekinpassing"/>'s, which knows the days.</param>
/// <param name="Motivatie">Why that day and that order.</param>
public sealed record RuweWeekkeuze(string? Activiteit, string? Dag, string? Motivatie);

/// <summary>A readable answer, or the reason it was refused as a whole (Art. IV.5).</summary>
public sealed record WeekvoorstelParseResultaat(bool IsGeldig, IReadOnlyList<RuweWeekkeuze> Keuzes, string? Fout)
{
    public static WeekvoorstelParseResultaat Geldig(IReadOnlyList<RuweWeekkeuze> keuzes) => new(true, keuzes, null);

    public static WeekvoorstelParseResultaat Ongeldig(string fout) => new(false, [], fout);
}

/// <summary>
/// Reads the model's weekvoorstel answer (FB-027). <b>Shape only</b>, as the other parsers: the answer as a whole is
/// refused when it is blank, not JSON, not an object, or holds a <c>null</c> item; a missing array counts as empty.
/// Whether a key, a day or a motivation is usable is <see cref="Weekinpassing"/>'s question, which drops one pick and
/// keeps the rest (ADR-0067 D4). A markdown fence is stripped and names match without regard to case.
/// </summary>
public static class WeekvoorstelResponseParser
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>Reads the completion's content.</summary>
    public static WeekvoorstelParseResultaat Parse(AiCompletion completion)
    {
        ArgumentNullException.ThrowIfNull(completion);
        return Parse(completion.Content);
    }

    /// <summary>Reads raw JSON content.</summary>
    public static WeekvoorstelParseResultaat Parse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return WeekvoorstelParseResultaat.Ongeldig("Empty AI response content.");
        }

        Envelop? envelop;
        try
        {
            using var document = JsonDocument.Parse(StripMarkdownFence(content.Trim()));
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return WeekvoorstelParseResultaat.Ongeldig("Unrecognised response shape: expected an object with 'activiteiten'.");
            }

            envelop = document.RootElement.Deserialize<Envelop>(Options);
        }
        catch (JsonException ex)
        {
            return WeekvoorstelParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (envelop is null)
        {
            return WeekvoorstelParseResultaat.Ongeldig("Unrecognised response shape.");
        }

        var keuzes = envelop.Activiteiten ?? [];
        if (Array.IndexOf(keuzes, null) is var i and >= 0)
        {
            return WeekvoorstelParseResultaat.Ongeldig($"Activiteit at index {i} is null.");
        }

        return WeekvoorstelParseResultaat.Geldig(keuzes
            .Select(k => new RuweWeekkeuze(Schoon(k!.Activiteit), Schoon(k.Dag), Schoon(k.Motivatie)))
            .ToList());
    }

    private static string? Schoon(string? waarde) => string.IsNullOrWhiteSpace(waarde) ? null : waarde.Trim();

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

    private sealed record Envelop
    {
        [JsonPropertyName("activiteiten")]
        public RuwItem?[]? Activiteiten { get; init; }
    }

    private sealed record RuwItem
    {
        [JsonPropertyName("activiteit")]
        public string? Activiteit { get; init; }

        [JsonPropertyName("dag")]
        public string? Dag { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }
    }
}
