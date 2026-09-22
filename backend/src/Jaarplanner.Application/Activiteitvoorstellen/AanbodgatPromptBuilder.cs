using System.Globalization;
using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Activiteitvoorstellen;

/// <summary>
/// A subthema of the thema at the klas's leeftijd, under the short key the model answers with (<c>S1</c>, <c>S2</c>, …),
/// so no database id reaches the prompt.
/// </summary>
/// <param name="Sleutel">The key the model names it by.</param>
/// <param name="Id">Which subthema it is.</param>
/// <param name="Naam">Its name.</param>
/// <param name="Onderzoeksvragen">Its onderzoeksvragen, so a proposal can answer one.</param>
/// <param name="BestaandeActiviteiten">What is already under it, so the model does not repeat it.</param>
public sealed record PromptSubthema(
    string Sleutel,
    Guid Id,
    string Naam,
    IReadOnlyList<PromptOnderzoeksvraag> Onderzoeksvragen,
    IReadOnlyList<BestaandeActiviteit> BestaandeActiviteiten);

/// <summary>
/// What the AI is told for one klas, one thema and one discipline with an aanbod-gat (FB-070, ADR-0060 D3). Only the
/// school's own data and loaded Op.stap goals (Art. IV.4): the thema, its subthema's at the klas's leeftijd with their
/// onderzoeksvragen and the activiteiten already there, and the discipline's leerplandoelen in the gap. No gebruiker,
/// no klas name and no pupil data.
/// </summary>
/// <param name="ThemaNaam">The thema that is about to start.</param>
/// <param name="Leeftijd">The jaar/fase the subthema's are written for.</param>
/// <param name="DisciplineNaam">The discipline the goals come from, as the model should speak of it.</param>
/// <param name="Subthemas">Where a proposal may go; at least one, or there is nothing to ask.</param>
/// <param name="Dagen">
/// The schooldagen of the thema's period the model may choose from, with the school's hours and what is already
/// planned on each (ADR-0062 M1). It names one of these days and an hour on it; the tool corrects a moment the school
/// cannot give (D1) and refuses a day that is not here (D2).
/// </param>
/// <param name="Gatdoelen">
/// The candidate goals: the discipline's leerplandoelen in the klas's aanbod-gat. <b>This is the whole difference with
/// the asked-for flow</b> (ADR-0056 D6, superseded here by ADR-0060 D1): these are deliberately no subdoel of any
/// subthema, which is why an own activiteit is the only way they can reach this klas's dekking.
/// </param>
/// <param name="GeweigerdeNamen">Names of proposals this klas already rejected, so the cat does not bring them back.</param>
/// <param name="Aantal">How many proposals to ask for (G3: two or three).</param>
public sealed record AanbodgatContext(
    string ThemaNaam,
    string Leeftijd,
    string DisciplineNaam,
    IReadOnlyList<PromptSubthema> Subthemas,
    IReadOnlyList<Leerplandoel> Gatdoelen,
    IReadOnlyList<string> GeweigerdeNamen,
    int Aantal,
    IReadOnlyList<Schooldagvenster> Dagen);

/// <summary>
/// Builds the request the cat sends for an aanbod-gat. A pure function of its input, like the other builders, so it is
/// snapshot-testable.
/// <para>
/// <b>The model makes up content, never a goal</b> (Art. IV.4): the activiteit's name, soort, expected outcomes and
/// length are its own, every code it links is one listed under <see cref="DoelenKop"/>, and it picks which subthema a
/// proposal goes under and <b>on which day and at what hour</b> it runs (ADR-0062 M1, Art. IV.5). The days it may
/// choose from are listed with their free stretches under <see cref="DagenKop"/>; a moment the school cannot give is
/// corrected by the tool rather than refused (ADR-0062 D1).
/// </para>
/// <para>
/// <b>It may say nothing fits</b> (G4). The motivation has to say why the goal belongs in <i>this</i> thema, and an
/// empty array is the honest answer when none does.
/// </para>
/// </summary>
public static class AanbodgatPromptBuilder
{
    /// <summary>The heading of the candidate goals; the system prompt refers to it.</summary>
    public const string DoelenKop = "# Leerplandoelen die nog nergens in het aanbod van de klas zitten";

    /// <summary>The heading of the subthema's; the system prompt refers to it.</summary>
    public const string SubthemasKop = "# Subthema's van het thema";

    /// <summary>The heading of the days it may choose from; the system prompt refers to it.</summary>
    public const string DagenKop = "# Schooldagen van de themaperiode, met de vrije momenten";

    private const string Nl = "\n";

    /// <summary>How a date reaches the model and comes back: ISO, so nothing depends on a culture.</summary>
    private const string Datumvorm = "yyyy-MM-dd";

    /// <summary>How an hour reaches the model: 24-hour, zero-padded.</summary>
    private const string Uurvorm = "HH\\:mm";

    /// <summary>The fixed instructions: the model's role, its limits and the JSON contract (Art. I.2, IV.1, IV.3 to IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je helpt een leerkracht van een Vlaamse basisschool (kleuter en lager). Haar klas raakt één discipline bijna " +
        "niet: de leerplandoelen hieronder zitten nergens in haar aanbod. Er start binnenkort een thema. Bedenk " +
        "activiteiten die binnen dat thema aan die doelen werken." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Bedenk nieuwe, uitvoerbare activiteiten voor kinderen van de gegeven leeftijd, die echt in dít thema passen. " +
        "De activiteiten mag je zelf bedenken." + Nl +
        "- Zet elke activiteit onder één subthema: geef zijn sleutel (S1, S2, ...) uit \"" + SubthemasKop + "\"." + Nl +
        "- Geef elke activiteit een korte naam, een soort, een beschrijving van wat de kinderen doen en wat er van hen " +
        $"verwacht wordt (hoogstens {Activiteitvoorstel.MaxUitkomstlengte / 2} tekens), en een lengte van " +
        $"{Activiteitvoorstel.MinLesuren} tot {Activiteitvoorstel.MaxLesuren} lesuren (meestal 1)." + Nl +
        $"- De soort is een van: {ActiviteitvoorstelPromptBuilder.Soorten}; of null als geen past." + Nl +
        "- Geef bij elke activiteit de doelen waaraan ze werkt: uitsluitend codes die letterlijk voorkomen onder \"" +
        DoelenKop + "\", minstens één." + Nl +
        "- Werkt een activiteit aan een onderzoeksvraag van dat subthema, geef dan haar sleutel (V1, V2, ...); anders null." + Nl +
        "- Herhaal geen activiteit die er al is, en geen naam die geweigerd werd." + Nl +
        "- Maak geen lesmateriaal: geen werkbladen, geen uitgeschreven lessen of lesverloop, geen teksten om voor te " +
        "lezen. Beschrijf alleen de activiteit." + Nl +
        "- Geef bij elke activiteit een korte motivatie in het Nederlands, één zin: waarom past dit doel in dít thema?" + Nl +
        "- Noem geen personen en geen kinderen. Verzin geen leerplandoelen of codes." + Nl +
        "- Kies voor elke activiteit een dag en een beginuur: een dag uit \"" + DagenKop + "\", als datum (2026-09-28), " +
        "en een beginuur binnen een vrij moment van die dag (09:15). Kies de dag die pedagogisch het best past, en zet " +
        "twee activiteiten niet op hetzelfde uur." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist over elk voorstel en mag het moment zelf verzetten." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"activiteiten\": [{\"naam\": \"<naam>\", \"subthema\": \"<S1>\", \"soort\": \"<soort of null>\", " +
        "\"verwachteUitkomsten\": \"<wat de kinderen doen en wat verwacht wordt>\", \"lengteInLesuren\": 1, " +
        "\"onderzoeksvraag\": \"<V1 of null>\", \"doelen\": [\"<doelcode>\"], \"dag\": \"<2026-09-28>\", " +
        "\"beginuur\": \"<09:15>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Past geen enkel doel in dit thema, antwoord dan met {\"activiteiten\": []}. Forceer niets.";

    /// <summary>Builds the request for one klas, one thema and one discipline.</summary>
    public static AiRequest Bouw(AanbodgatContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(context),
        };
    }

    private static string BouwUserPrompt(AanbodgatContext context)
    {
        var sb = new StringBuilder();

        sb.Append("Stel hoogstens ").Append(context.Aantal).Append(" activiteiten voor.").Append(Nl).Append(Nl);

        sb.Append("# Thema dat binnenkort start").Append(Nl);
        sb.Append("Naam: ").Append(context.ThemaNaam).Append(Nl);
        sb.Append("Leeftijd: ").Append(context.Leeftijd).Append(Nl);
        sb.Append("Discipline met het gat: ").Append(context.DisciplineNaam).Append(Nl).Append(Nl);

        sb.Append(SubthemasKop).Append(Nl).Append(Nl);
        foreach (var subthema in context.Subthemas)
        {
            sb.Append(subthema.Sleutel).Append(": ").Append(subthema.Naam).Append(Nl);
            foreach (var vraag in subthema.Onderzoeksvragen)
            {
                sb.Append("  Onderzoeksvraag ").Append(vraag.Sleutel).Append(": ").Append(vraag.Vraag).Append(Nl);
            }

            sb.Append("  Activiteiten die er al zijn (niet herhalen): ");
            sb.Append(subthema.BestaandeActiviteiten.Count == 0
                ? "(geen)"
                : string.Join(", ", subthema.BestaandeActiviteiten
                    .Select(a => a.Naam)
                    .Order(StringComparer.Ordinal)));
            sb.Append(Nl);
        }

        sb.Append(Nl).Append(DoelenKop).Append(Nl).Append(Nl);
        foreach (var doel in context.Gatdoelen.OrderBy(d => d.Code, StringComparer.Ordinal))
        {
            sb.Append("- ").Append(doel.Code).Append(" | ").Append(doel.Domein).Append(" > ").Append(doel.Subdomein).Append(Nl);
            sb.Append("  Tekst: ").Append(doel.Tekst).Append(Nl);
        }

        sb.Append(Nl).Append(DagenKop).Append(Nl).Append(Nl);
        foreach (var dag in context.Dagen)
        {
            var vrij = Vrijmoment.VrijeStukken(dag);
            if (vrij.Count == 0)
            {
                // A day with no room is left out rather than listed as full: a day the model may not use is noise.
                continue;
            }

            sb.Append("- ").Append(dag.Datum.ToString(Datumvorm, CultureInfo.InvariantCulture));
            sb.Append(" (").Append(Schooldaguren.Dagnaam(dag.Datum.DayOfWeek)).Append("), vrij: ");
            sb.Append(string.Join(", ", vrij.Select(v =>
                $"{v.Begin.ToString(Uurvorm, CultureInfo.InvariantCulture)}-{v.Einde.ToString(Uurvorm, CultureInfo.InvariantCulture)}")));
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
