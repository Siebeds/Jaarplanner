using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Unicode;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// Writes the cat's answer as the model is sent it again in a later question of the same conversation (FB-093,
/// ADR-0069): the JSON of the chat's own contract (Art. IV.5), so the model reads its earlier turns in the form it
/// answers in.
/// <list type="bullet">
/// <item>An explanation goes as it was: the model wrote it from the handleiding.</item>
/// <item>Of a lookup goes only which lookup it was and the names and codes the tool found (the goal's code, the
/// thema, subthema and activiteit), under <c>gevonden</c>; or that it found nothing or several. Never a place, the
/// agenda, a klas, a goal's text or a yes or no: a follow-up needs the subject, and the tool looks up the rest again.</item>
/// </list>
/// A pure function, snapshot-testable.
/// </summary>
public static class Katbeurtschrijver
{
    /// <summary>At most this many names of one kind go along; an activiteit rarely hangs in more subthema's.</summary>
    public const int MaxNamen = 8;

    // The turn goes to the model, not into a page: accents stay readable instead of \u escapes.
    private static readonly JsonSerializerOptions Opties = new() { Encoder = JavaScriptEncoder.Create(UnicodeRanges.All) };

    public static string Schrijf(Katantwoord antwoord)
    {
        ArgumentNullException.ThrowIfNull(antwoord);
        var beurt = antwoord.Soort switch
        {
            Katantwoordsoort.Uitleg => new JsonObject
            {
                ["soort"] = "uitleg",
                ["antwoord"] = antwoord.Uitleg,
                ["hoofdstukken"] = new JsonArray(antwoord.Hoofdstukken.Select(h => (JsonNode?)JsonValue.Create(h)).ToArray()),
            },
            Katantwoordsoort.Onbekend or Katantwoordsoort.Mislukt => new JsonObject { ["soort"] = "onbekend" },
            _ when antwoord.Opzoeking is { } opzoeking => Opzoeking(antwoord, opzoeking),
            _ => new JsonObject { ["soort"] = "onbekend" },
        };
        return beurt.ToJsonString(Opties);
    }

    private static JsonObject Opzoeking(Katantwoord antwoord, Katopzoeking opzoeking)
    {
        var gevonden = new JsonObject();
        switch (antwoord.Soort)
        {
            case Katantwoordsoort.NietGevonden when antwoord.NietGevonden is { } niets:
                gevonden["niets"] = Term(niets.Wat, niets.Term);
                break;
            case Katantwoordsoort.Kies when antwoord.Keuze is { } keuze:
                gevonden["meerdere"] = Term(keuze.Wat, keuze.Term);
                break;
            default:
                Zet(gevonden, "doel", antwoord.Doel?.Code);
                Zet(gevonden, "thema", antwoord.Thema?.Naam);
                Zet(gevonden, "subthema", antwoord.Subthema);
                Zet(gevonden, "activiteit", antwoord.Activiteit?.Naam);
                if (antwoord.Soort == Katantwoordsoort.SubthemaVanActiviteit)
                {
                    gevonden["subthemas"] = Namen(antwoord.Plekken.Select(p => p.Subthema));
                    gevonden["themas"] = Namen(antwoord.Plekken.Select(p => p.Thema));
                }

                break;
        }

        return new JsonObject
        {
            ["soort"] = "opzoeking",
            ["opzoeking"] = new JsonObject { ["vraag"] = JsonNamingPolicy.CamelCase.ConvertName(opzoeking.Vraag.ToString()) },
            ["gevonden"] = gevonden,
        };
    }

    private static JsonObject Term(Katonderwerp wat, string term) =>
        new() { [JsonNamingPolicy.CamelCase.ConvertName(wat.ToString())] = term };

    private static void Zet(JsonObject doel, string naam, string? waarde)
    {
        if (!string.IsNullOrWhiteSpace(waarde))
        {
            doel[naam] = waarde;
        }
    }

    private static JsonArray Namen(IEnumerable<string?> namen) =>
        new(namen
            .Where(n => !string.IsNullOrWhiteSpace(n))
            .Distinct(StringComparer.CurrentCultureIgnoreCase)
            .Take(MaxNamen)
            .Select(n => (JsonNode?)JsonValue.Create(n))
            .ToArray());
}
