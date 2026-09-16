using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Subdoelplaatsing;

/// <summary>One placement as the model wrote it; fields are trimmed and may be <c>null</c>.</summary>
public sealed record RuwePlaatsing(string? Code, string? Subthema, string? Motivatie);

/// <summary>One new subthema as the model wrote it; fields are trimmed and may be <c>null</c>.</summary>
public sealed record RuwNieuwSubthema(string? Sleutel, string? Naam, string? Onderzoeksvraag, int? DuurWeken, string? Motivatie);

/// <summary>A readable answer, or the reason it was refused as a whole (Art. IV.5).</summary>
public sealed record SubdoelplaatsingParseResultaat(
    bool IsGeldig,
    IReadOnlyList<RuwePlaatsing> Plaatsingen,
    IReadOnlyList<RuwNieuwSubthema> NieuweSubthemas,
    string? Fout)
{
    public static SubdoelplaatsingParseResultaat Geldig(IReadOnlyList<RuwePlaatsing> plaatsingen, IReadOnlyList<RuwNieuwSubthema> nieuwe) =>
        new(true, plaatsingen, nieuwe, null);

    public static SubdoelplaatsingParseResultaat Ongeldig(string fout) => new(false, [], [], fout);
}

/// <summary>
/// Reads the model's subdoelplaatsing answer (FB-057). <b>Shape only:</b> the answer as a whole is refused when it is
/// blank, not JSON, not an object with the two arrays (a missing array counts as empty), or holds a <c>null</c> item.
/// Whether an item's code, subthema, name or length is acceptable is <see cref="SubdoelplaatsingValidator"/>'s
/// question, which drops a bad item and keeps the rest (ADR-0050 D7). A markdown fence is stripped, names match without
/// regard to case and unknown fields are ignored.
/// </summary>
public static class SubdoelplaatsingResponseParser
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
    };

    /// <summary>Reads the completion's content.</summary>
    public static SubdoelplaatsingParseResultaat Parse(AiCompletion completion)
    {
        ArgumentNullException.ThrowIfNull(completion);
        return Parse(completion.Content);
    }

    /// <summary>Reads raw JSON content.</summary>
    public static SubdoelplaatsingParseResultaat Parse(string? content)
    {
        if (string.IsNullOrWhiteSpace(content))
        {
            return SubdoelplaatsingParseResultaat.Ongeldig("Empty AI response content.");
        }

        Envelop? envelop;
        try
        {
            using var document = JsonDocument.Parse(StripMarkdownFence(content.Trim()));
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return SubdoelplaatsingParseResultaat.Ongeldig("Unrecognised response shape: expected an object with 'plaatsingen' and 'nieuweSubthemas'.");
            }

            envelop = document.RootElement.Deserialize<Envelop>(Options);
        }
        catch (JsonException ex)
        {
            return SubdoelplaatsingParseResultaat.Ongeldig($"Malformed JSON: {ex.Message}");
        }

        if (envelop is null)
        {
            return SubdoelplaatsingParseResultaat.Ongeldig("Unrecognised response shape.");
        }

        var plaatsingen = envelop.Plaatsingen ?? [];
        var nieuwe = envelop.NieuweSubthemas ?? [];
        if (Array.IndexOf(plaatsingen, null) is var p and >= 0)
        {
            return SubdoelplaatsingParseResultaat.Ongeldig($"Placement at index {p} is null.");
        }

        if (Array.IndexOf(nieuwe, null) is var n and >= 0)
        {
            return SubdoelplaatsingParseResultaat.Ongeldig($"New subthema at index {n} is null.");
        }

        return SubdoelplaatsingParseResultaat.Geldig(
            plaatsingen.Select(r => new RuwePlaatsing(Schoon(r!.Code), Schoon(r.Subthema), Schoon(r.Motivatie))).ToList(),
            nieuwe.Select(r => new RuwNieuwSubthema(Schoon(r!.Sleutel), Schoon(r.Naam), Schoon(r.Onderzoeksvraag), r.DuurWeken, Schoon(r.Motivatie))).ToList());
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
        [JsonPropertyName("plaatsingen")]
        public RuwItem?[]? Plaatsingen { get; init; }

        [JsonPropertyName("nieuweSubthemas")]
        public RuwSubthema?[]? NieuweSubthemas { get; init; }
    }

    private sealed record RuwItem
    {
        [JsonPropertyName("code")]
        public string? Code { get; init; }

        [JsonPropertyName("subthema")]
        public string? Subthema { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }
    }

    private sealed record RuwSubthema
    {
        [JsonPropertyName("sleutel")]
        public string? Sleutel { get; init; }

        [JsonPropertyName("naam")]
        public string? Naam { get; init; }

        [JsonPropertyName("onderzoeksvraag")]
        public string? Onderzoeksvraag { get; init; }

        [JsonPropertyName("duurWeken")]
        public int? DuurWeken { get; init; }

        [JsonPropertyName("motivatie")]
        public string? Motivatie { get; init; }
    }
}
