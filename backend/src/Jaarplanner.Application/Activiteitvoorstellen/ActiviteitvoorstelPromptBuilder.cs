using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Activiteitvoorstellen;

/// <summary>
/// An onderzoeksvraag of the subthema, under the short key the model answers with (<c>V1</c>, <c>V2</c>, …), so no
/// database id reaches the prompt.
/// </summary>
public sealed record PromptOnderzoeksvraag(string Sleutel, Guid Id, string Vraag);

/// <summary>An activiteit already under the subthema, by name and soort, so the model does not repeat it.</summary>
public sealed record BestaandeActiviteit(string Naam, ActiviteitType? ActiviteitType);

/// <summary>
/// What the AI is told for one subthema and one asker (FB-025, ADR-0054). Only the school's own data: the thema, the
/// subthema with its onderzoeksvragen and decided subdoelen, the activiteiten already there (the shared ones and the
/// asker's own) and the names she rejected. No gebruiker and no pupil data.
/// </summary>
public sealed record ActiviteitvoorstelContext(
    string ThemaNaam,
    string SubthemaNaam,
    string Leeftijd,
    int DuurWeken,
    IReadOnlyList<PromptOnderzoeksvraag> Onderzoeksvragen,
    IReadOnlyList<Leerplandoel> Subdoelen,
    IReadOnlyList<BestaandeActiviteit> BestaandeActiviteiten,
    IReadOnlyList<string> GeweigerdeNamen,
    int Aantal);

/// <summary>
/// Builds the activiteitvoorstellen request for <see cref="IAiClient"/>. A pure function of its input, like the other
/// builders, so it is snapshot-testable.
/// <para>
/// <b>The third prompt that lets the model use its own knowledge</b> (Art. IV.4, ADR-0054 A1): for an activiteit's name,
/// soort, expected outcomes and length. Every goal it links must be one of the subdoelen listed, by its exact code, and
/// it writes no lesson material (Art. I.2).
/// </para>
/// </summary>
public static class ActiviteitvoorstelPromptBuilder
{
    /// <summary>The heading of the subdoelen; the system prompt refers to it.</summary>
    public const string SubdoelenKop = "# Subdoelen van het subthema";

    private const string Nl = "\n";

    /// <summary>The soorten the model may name, exactly as the enum spells them.</summary>
    public static readonly string Soorten = string.Join(", ", Enum.GetNames<ActiviteitType>());

    /// <summary>The fixed instructions: the model's role, its limits and the JSON contract (Art. I.2, IV.1, IV.3 to IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je helpt een leerkracht van een Vlaamse basisschool (kleuter en lager) om activiteiten te bedenken binnen een " +
        "subthema van een kennisrijk thema. Elke activiteit werkt aan een of meer subdoelen van dat subthema." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Bedenk nieuwe, uitvoerbare activiteiten voor kinderen van de gegeven leeftijd, passend bij het subthema en " +
        "zijn onderzoeksvragen. Die mag je zelf bedenken." + Nl +
        "- Geef elke activiteit een korte naam, een soort, een beschrijving van wat de kinderen doen en wat er van hen " +
        $"verwacht wordt (hoogstens {Activiteitvoorstel.MaxUitkomstlengte / 2} tekens), en een lengte van " +
        $"{Activiteitvoorstel.MinLesuren} tot {Activiteitvoorstel.MaxLesuren} lesuren (meestal 1)." + Nl +
        $"- De soort is een van: {Soorten}; of null als geen past." + Nl +
        "- Geef bij elke activiteit de subdoelen waaraan ze werkt: uitsluitend codes die letterlijk voorkomen onder \"" +
        SubdoelenKop + "\", minstens één." + Nl +
        "- Werkt een activiteit aan een onderzoeksvraag, geef dan haar sleutel (V1, V2, ...); anders null." + Nl +
        "- Herhaal geen activiteit die er al is, en geen naam die geweigerd werd." + Nl +
        "- Maak geen lesmateriaal: geen werkbladen, geen uitgeschreven lessen of lesverloop, geen teksten om voor te " +
        "lezen. Beschrijf alleen de activiteit." + Nl +
        "- Geef bij elke activiteit een korte motivatie in het Nederlands, één zin: waarom past ze bij deze subdoelen?" + Nl +
        "- Noem geen personen en geen kinderen. Verzin geen leerplandoelen of codes." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist over elk voorstel." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"activiteiten\": [{\"naam\": \"<naam>\", \"soort\": \"<soort of null>\", \"verwachteUitkomsten\": " +
        "\"<wat de kinderen doen en wat verwacht wordt>\", \"lengteInLesuren\": 1, \"onderzoeksvraag\": \"<V1 of null>\", " +
        "\"doelen\": [\"<subdoelcode>\"], \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Past niets, antwoord dan met {\"activiteiten\": []}.";

    /// <summary>Builds the request for one subthema.</summary>
    public static AiRequest Bouw(ActiviteitvoorstelContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(context),
        };
    }

    private static string BouwUserPrompt(ActiviteitvoorstelContext context)
    {
        var sb = new StringBuilder();

        sb.Append("Stel hoogstens ").Append(context.Aantal).Append(" activiteiten voor.").Append(Nl).Append(Nl);

        sb.Append("# Thema").Append(Nl);
        sb.Append("Naam: ").Append(context.ThemaNaam).Append(Nl).Append(Nl);

        sb.Append("# Subthema").Append(Nl);
        sb.Append("Naam: ").Append(context.SubthemaNaam).Append(Nl);
        sb.Append("Leeftijd: ").Append(context.Leeftijd).Append(Nl);
        sb.Append("Duur: ").Append(context.DuurWeken).Append(" weken").Append(Nl);
        foreach (var vraag in context.Onderzoeksvragen)
        {
            sb.Append("Onderzoeksvraag ").Append(vraag.Sleutel).Append(": ").Append(vraag.Vraag).Append(Nl);
        }

        sb.Append(Nl).Append(SubdoelenKop).Append(Nl).Append(Nl);
        foreach (var doel in context.Subdoelen.OrderBy(d => d.Code, StringComparer.Ordinal))
        {
            sb.Append("- ").Append(doel.Code).Append(" | ").Append(doel.Domein).Append(" > ").Append(doel.Subdomein).Append(Nl);
            sb.Append("  Tekst: ").Append(doel.Tekst).Append(Nl);
        }

        sb.Append(Nl).Append("# Activiteiten die er al zijn (niet herhalen)").Append(Nl);
        if (context.BestaandeActiviteiten.Count == 0)
        {
            sb.Append("- (geen)").Append(Nl);
        }

        foreach (var activiteit in context.BestaandeActiviteiten.OrderBy(a => a.Naam, StringComparer.Ordinal))
        {
            sb.Append("- ").Append(activiteit.Naam);
            if (activiteit.ActiviteitType is { } soort)
            {
                sb.Append(" (").Append(soort).Append(')');
            }

            sb.Append(Nl);
        }

        var namen = context.GeweigerdeNamen.Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.Ordinal).ToList();
        if (namen.Count > 0)
        {
            sb.Append(Nl).Append("# Geweigerde activiteiten (niet opnieuw voorstellen)").Append(Nl);
            foreach (var naam in namen)
            {
                sb.Append("- ").Append(naam).Append(Nl);
            }
        }

        return sb.ToString();
    }
}
