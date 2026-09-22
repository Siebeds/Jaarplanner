using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Activiteitvoorstellen;

/// <summary>One activiteit as the model wrote it; text fields are trimmed and may be <c>null</c>.</summary>
/// <param name="Subthema">
/// The key of the subthema it goes under (<c>S1</c>, <c>S2</c>, …), which only the cat's prompt asks for (ADR-0060 D3,
/// Art. IV.5). A proposal asked for under one subthema carries none, and that flow's validator ignores it.
/// </param>
/// <param name="Dag">
/// The day it proposes, as the model wrote it (ISO, <c>2026-09-28</c>), or <c>null</c>. Only the cat's prompt asks for
/// it (ADR-0062 M1, Art. IV.5). Text, not a <see cref="DateOnly"/>: reading it is the validator's, which knows which
/// days were offered (ADR-0062 D2).
/// </param>
/// <param name="Beginuur">The hour it proposes on that day (<c>09:15</c>), or <c>null</c>. Text, for the same reason.</param>
public sealed record RuweActiviteit(
    string? Naam,
    string? Soort,
    string? VerwachteUitkomsten,
    int? LengteInLesuren,
    string? Onderzoeksvraag,
    IReadOnlyList<string> Doelen,
    string? Motivatie,
    string? Subthema = null,
    string? Dag = null,
    string? Beginuur = null);

/// <summary>A readable answer, or the reason it was refused as a whole (Art. IV.5).</summary>
public sealed record ActiviteitvoorstelParseResultaat(bool IsGeldig, IReadOnlyList<RuweActiviteit> Activiteiten, string? Fout)
{
    public static ActiviteitvoorstelParseResultaat Geldig(IReadOnlyList<RuweActiviteit> activiteiten) => new(true, activiteiten, null);

    public static ActiviteitvoorstelParseResultaat Ongeldig(string fout) => new(false, [], fout);
}

/// <summary>
/// Reads the model's activiteitvoorstellen answer (FB-025). <b>Shape only:</b> the answer as a whole is refused when it is
/// blank, not JSON, not an object, or holds a <c>null</c> item; a missing array counts as empty. Whether an item's name,
/// soort, length or codes are acceptable is <see cref="ActiviteitvoorstelValidator"/>'s question, which drops a bad item
/// and keeps the rest (ADR-0056 D6, D7). A markdown fence is stripped, names match without regard to case, unknown
/// fields are ignored, and a blank code in <c>doelen</c> is left out.
/// </summary>
public static class ActiviteitvoorstelResponseParser
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    /// <summary>Reads the completion's content.</summary>
    public static ActiviteitvoorstelParseResultaat Parse(AiCompletion completion)
    {
        ArgumentNullException.ThrowIfNull(completion);
        return Parse(completion.Content);
    }

    /// <summary>Reads raw JSON content.</summary>
    public static ActiviteitvoorstelParseResultaat Parse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return ActiviteitvoorstelParseResultaat.Ongeldig("Empty AI response content.");
        }

        Envelop? envelop;
        try
        {
            using var document = JsonDocument.Parse(StripMarkdownFence(content.Trim()));
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return ActiviteitvoorstelParseResultaat.Ongeldig("Unrecognised response shape: expected an object with 'activiteiten'.");
            }

            envelop = document.RootElement.Deserialize<Envelop>(Options);
        }
        catch (JsonException ex)
        {
            return ActiviteitvoorstelParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (envelop is null)
        {
            return ActiviteitvoorstelParseResultaat.Ongeldig("Unrecognised response shape.");
        }

        var activiteiten = envelop.Activiteiten ?? [];
        if (Array.IndexOf(activiteiten, null) is var i and >= 0)
        {
            return ActiviteitvoorstelParseResultaat.Ongeldig($"Activiteit at index {i} is null.");
        }

        return ActiviteitvoorstelParseResultaat.Geldig(activiteiten
            .Select(a => new RuweActiviteit(
                Schoon(a!.Naam),
                Schoon(a.Soort),
                Schoon(a.VerwachteUitkomsten),
                a.LengteInLesuren,
                Schoon(a.Onderzoeksvraag),
                (a.Doelen ?? []).Select(Schoon).OfType<string>().ToList(),
                Schoon(a.Motivatie),
                Schoon(a.Subthema),
                Schoon(a.Dag),
                Schoon(a.Beginuur)))
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
        [JsonPropertyName("naam")]
        public string? Naam { get; init; }

        [JsonPropertyName("soort")]
        public string? Soort { get; init; }

        [JsonPropertyName("verwachteUitkomsten")]
        public string? VerwachteUitkomsten { get; init; }

        [JsonPropertyName("lengteInLesuren")]
        public int? LengteInLesuren { get; init; }

        [JsonPropertyName("onderzoeksvraag")]
        public string? Onderzoeksvraag { get; init; }

        [JsonPropertyName("doelen")]
        public string?[]? Doelen { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }

        [JsonPropertyName("subthema")]
        public string? Subthema { get; init; }

        [JsonPropertyName("dag")]
        public string? Dag { get; init; }

        [JsonPropertyName("beginuur")]
        public string? Beginuur { get; init; }
    }
}
