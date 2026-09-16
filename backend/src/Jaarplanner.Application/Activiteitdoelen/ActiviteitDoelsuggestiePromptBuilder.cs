using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching.Response;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Activiteitdoelen;

/// <summary>
/// What the AI is told about one activiteit (FB-026, ADR-0054). Only the school's own content and the loaded Op.stap goals
/// of the activiteit's leeftijd; no gebruiker, no owner and no pupil data.
/// </summary>
/// <param name="Kandidaten">Every goal of the leeftijd still in Op.stap: the stable part of the prompt (TB-043).</param>
/// <param name="NietVoorstellen">The codes already on the activiteit, in any status, the rejected ones included.</param>
/// <param name="MaxVoorstellen">The most proposals one run keeps (configuration).</param>
public sealed record ActiviteitDoelsuggestieContext(
    string ActiviteitNaam,
    string? Soort,
    string? Hoek,
    string? VerwachteUitkomsten,
    string? Onderzoeksvraag,
    string SubthemaNaam,
    string ThemaNaam,
    string Leeftijd,
    IReadOnlyList<Leerplandoel> Kandidaten,
    IReadOnlyCollection<string> NietVoorstellen,
    int MaxVoorstellen);

/// <summary>
/// Builds the request for <see cref="IAiClient"/>. A pure function of its input, so it is snapshot-testable. The system
/// prompt and the goal list depend only on the leeftijd's goals and the maximum, so two activiteiten of one leeftijd share
/// a prefix the provider can cache (TB-043); what is already on the activiteit is named in the user prompt.
/// The answer has the shape of the thema doelsuggesties (<see cref="DoelMatchResponseParser"/>).
/// </summary>
public static class ActiviteitDoelsuggestiePromptBuilder
{
    /// <summary>The heading of the codes the model must not propose.</summary>
    public const string NietVoorstellenKop = "# Niet voorstellen";

    private const string Nl = "\n";

    /// <summary>The fixed instructions for a maximum of <paramref name="max"/> proposals (Art. IV.1, IV.3 to IV.5).</summary>
    public static string SystemPrompt(int max) =>
        "Je helpt een leerkracht van een Vlaamse basisschool (kleuter en lager) om Op.stap-leerplandoelen te koppelen aan " +
        "één activiteit van de school." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in deze aanvraag: de lijst \"Beschikbare Op.stap-leerplandoelen\" hieronder en " +
        "de activiteit in het bericht van de gebruiker. Gebruik geen externe bronnen." + Nl +
        "- Stel enkel leerplandoelen voor waarvan de code letterlijk in die lijst staat, en die de activiteit echt helpt " +
        "bereiken. Verzin geen doelen of codes." + Nl +
        "- Stel geen leerplandoel voor waarvan de code onder \"Niet voorstellen\" staat." + Nl +
        $"- Stel hoogstens {max} leerplandoelen voor, het best passende eerst. Minder mag." + Nl +
        "- Geef bij elk voorstel een motivatie van één korte zin in het Nederlands (\"waarom past dit doel bij deze " +
        "activiteit?\"). Noem geen personen en geen kinderen." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"suggesties\": [{\"code\": \"<leerplandoelcode>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Past geen enkel doel, antwoord dan met {\"suggesties\": []}.";

    /// <summary>Builds the request for one activiteit.</summary>
    public static AiRequest Bouw(ActiviteitDoelsuggestieContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt(context.MaxVoorstellen),
            VasteContext = LeerplandoelPromptlijst.Bouw(context.Kandidaten),
            UserPrompt = BouwUserPrompt(context),
        };
    }

    private static string BouwUserPrompt(ActiviteitDoelsuggestieContext context)
    {
        var sb = new StringBuilder();
        sb.Append("# Activiteit").Append(Nl);
        sb.Append("Naam: ").Append(context.ActiviteitNaam).Append(Nl);
        Optioneel(sb, "Soort", context.Soort);
        Optioneel(sb, "Hoek", context.Hoek);
        Optioneel(sb, "Verwachte uitkomsten", context.VerwachteUitkomsten);
        Optioneel(sb, "Onderzoeksvraag", context.Onderzoeksvraag);
        sb.Append("Subthema: ").Append(context.SubthemaNaam).Append(Nl);
        sb.Append("Thema: ").Append(context.ThemaNaam).Append(Nl);
        sb.Append("Leeftijd: ").Append(context.Leeftijd).Append(Nl);

        var codes = context.NietVoorstellen
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim())
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();
        if (codes.Count > 0)
        {
            sb.Append(Nl).Append(NietVoorstellenKop).Append(Nl).Append(Nl);
            sb.Append("Al gekoppeld of geweigerd: ").Append(string.Join(", ", codes)).Append(Nl);
        }

        return sb.ToString();
    }

    private static void Optioneel(StringBuilder sb, string label, string? waarde)
    {
        if (!string.IsNullOrWhiteSpace(waarde))
        {
            sb.Append(label).Append(": ").Append(waarde.Trim()).Append(Nl);
        }
    }
}
