using System.Text.Json;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>What the model decided a question is.</summary>
public enum Katbesluitsoort
{
    Uitleg,
    Opzoeking,
    Onbekend,
    Mislukt,
}

/// <summary>What the model decided a question is: an explanation, a lookup to run, or something it does not know.</summary>
public sealed record Katbesluit(Katbesluitsoort Soort, string? Uitleg, IReadOnlyList<string> Hoofdstukken, Katopzoeking? Opzoeking)
{
    public static readonly Katbesluit Onbekend = new(Katbesluitsoort.Onbekend, null, [], null);

    public static readonly Katbesluit Mislukt = new(Katbesluitsoort.Mislukt, null, [], null);
}

/// <summary>
/// Validates the model's chat turn against its contract (FB-031, ADR-0066, Art. IV.5). It never throws on the model's
/// content: an unusable answer is <see cref="Katbesluit.Mislukt"/>, and nothing is looked up.
/// <list type="bullet">
/// <item><c>uitleg</c> needs a non-blank answer within <see cref="KatchatPromptBuilder.MaxUitlegLengte"/> and at least
/// one chapter the handleiding has. An explanation that names no chapter of it is not grounded in it, so the cat says it
/// does not know rather than pass it on (Art. IV.4); chapters it does not have are dropped.</item>
/// <item><c>opzoeking</c> needs a known lookup with every term it needs, none too long.</item>
/// <item><c>onbekend</c> needs nothing.</item>
/// </list>
/// A leading and trailing markdown fence is stripped; names match without regard to case; unknown fields are ignored.
/// </summary>
public static class KatchatAntwoordParser
{
    public static Katbesluit Parse(string? content, Handleiding handleiding)
    {
        ArgumentNullException.ThrowIfNull(handleiding);
        if (string.IsNullOrWhiteSpace(content))
        {
            return Katbesluit.Mislukt;
        }

        try
        {
            using var document = JsonDocument.Parse(ZonderOmheining(content.Trim()));
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return Katbesluit.Mislukt;
            }

            return Tekst(root, "soort")?.ToLowerInvariant() switch
            {
                "uitleg" => Uitleg(root, handleiding),
                "opzoeking" => Opzoeking(root),
                "onbekend" => Katbesluit.Onbekend,
                _ => Katbesluit.Mislukt,
            };
        }
        catch (JsonException)
        {
            return Katbesluit.Mislukt;
        }
    }

    private static Katbesluit Uitleg(JsonElement root, Handleiding handleiding)
    {
        // No em dash reaches a teacher (Art. II.5): the prompt asks for none, and this makes sure.
        var antwoord = Tekst(root, "antwoord")?.Replace(" — ", ": ", StringComparison.Ordinal)
            .Replace("—", ", ", StringComparison.Ordinal)
            .Trim();
        if (string.IsNullOrEmpty(antwoord) || antwoord.Length > KatchatPromptBuilder.MaxUitlegLengte)
        {
            return Katbesluit.Mislukt;
        }

        var hoofdstukken = new List<string>();
        if (Eigenschap(root, "hoofdstukken") is { ValueKind: JsonValueKind.Array } lijst)
        {
            foreach (var item in lijst.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String
                    && handleiding.Hoofdstuk(item.GetString()!) is { } titel
                    && !hoofdstukken.Contains(titel))
                {
                    hoofdstukken.Add(titel);
                }
            }
        }

        return hoofdstukken.Count == 0
            ? Katbesluit.Onbekend
            : new Katbesluit(Katbesluitsoort.Uitleg, antwoord, hoofdstukken, null);
    }

    private static Katbesluit Opzoeking(JsonElement root)
    {
        if (Eigenschap(root, "opzoeking") is not { ValueKind: JsonValueKind.Object } ruw
            || Tekst(ruw, "vraag") is not { } naam
            || !Enum.TryParse<Katvraag>(naam.Trim(), ignoreCase: true, out var vraag)
            || !Enum.IsDefined(vraag)
            || int.TryParse(naam, out _))
        {
            return Katbesluit.Mislukt;
        }

        var opzoeking = new Katopzoeking(
            vraag,
            Term(ruw, "doel"),
            Term(ruw, "thema"),
            Term(ruw, "subthema"),
            Term(ruw, "activiteit"));

        return opzoeking.IsVolledig
            ? new Katbesluit(Katbesluitsoort.Opzoeking, null, [], opzoeking)
            : Katbesluit.Mislukt;
    }

    private static string? Term(JsonElement ruw, string naam) =>
        Tekst(ruw, naam)?.Trim() is { Length: > 0 } term ? term : null;

    private static string? Tekst(JsonElement element, string naam) =>
        Eigenschap(element, naam) is { ValueKind: JsonValueKind.String } waarde ? waarde.GetString() : null;

    private static JsonElement? Eigenschap(JsonElement element, string naam)
    {
        foreach (var eigenschap in element.EnumerateObject())
        {
            if (string.Equals(eigenschap.Name, naam, StringComparison.OrdinalIgnoreCase))
            {
                return eigenschap.Value;
            }
        }

        return null;
    }

    private static string ZonderOmheining(string tekst)
    {
        if (!tekst.StartsWith("```", StringComparison.Ordinal))
        {
            return tekst;
        }

        var eersteRegel = tekst.IndexOf('\n');
        var slot = tekst.LastIndexOf("```", StringComparison.Ordinal);
        return eersteRegel >= 0 && slot > eersteRegel ? tekst[(eersteRegel + 1)..slot].Trim() : tekst;
    }
}
