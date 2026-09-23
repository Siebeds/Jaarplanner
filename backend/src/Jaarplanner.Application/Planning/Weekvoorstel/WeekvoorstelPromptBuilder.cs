using System.Globalization;
using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Planning.Weekvoorstel;

/// <summary>
/// Builds the request for a weekvoorstel (FB-027, ADR-0067). A pure function of its input, like the other builders, so
/// it is snapshot-testable.
/// <para>
/// <b>The model chooses, the tool fits</b> (owner, 2026-09-15; W2): it picks which activiteiten, in which order and on
/// which day, and gives no hour. The free stretches are shown so it does not pick more than a day can hold; the hour is
/// the tool's.
/// </para>
/// </summary>
public static class WeekvoorstelPromptBuilder
{
    /// <summary>The heading of the candidates; the system prompt refers to it.</summary>
    public const string ActiviteitenKop = "# Activiteiten waaruit je kiest";

    /// <summary>The heading of the days; the system prompt refers to it.</summary>
    public const string DagenKop = "# Schooldagen van de week, met de vrije momenten";

    private const string Nl = "\n";
    private const string Datumvorm = "yyyy-MM-dd";
    private const string Uurvorm = "HH\\:mm";

    /// <summary>The fixed instructions: the model's role, its limits and the JSON contract (Art. I.2, IV.1, IV.3 to IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je helpt een leerkracht van een Vlaamse basisschool (kleuter en lager) haar week te plannen. Ze werkt met " +
        "de activiteiten van het subthema dat deze week loopt. Kies welke activiteiten ze deze week doet, in welke " +
        "volgorde en op welke dag." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Kies uitsluitend activiteiten uit \"" + ActiviteitenKop + "\", met hun sleutel (A1, A2, ...). Elke " +
        "activiteit hoogstens één keer." + Nl +
        "- Kies voor elke activiteit een dag uit de dagen waarop ze kan, als datum (2026-09-28)." + Nl +
        "- Geef de activiteiten in de volgorde waarin ze het best na elkaar komen: de tool zet ze op elke dag in die " +
        "volgorde op het eerste vrije moment. Het uur kies je niet." + Nl +
        "- Kies niet meer dan in de vrije momenten past: een lesuur duurt " + Vrijmoment.MinutenPerLesuur +
        " minuten, en een activiteit loopt niet door de middagpauze." + Nl +
        "- Geef bij elke activiteit een korte motivatie in het Nederlands, één zin: waarom op die dag, in die volgorde?" + Nl +
        "- Noem geen personen en geen kinderen. Verzin geen activiteiten en geen leerplandoelen." + Nl +
        "- Je stelt enkel voor; de leerkracht aanvaardt of weigert elk voorstel." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"activiteiten\": [{\"activiteit\": \"<A1>\", \"dag\": \"<2026-09-28>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Past er niets, antwoord dan met {\"activiteiten\": []}. Forceer niets.";

    /// <summary>Builds the request for one klas and one week.</summary>
    public static AiRequest Bouw(WeekvoorstelContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(context),
        };
    }

    private static string BouwUserPrompt(WeekvoorstelContext context)
    {
        var sb = new StringBuilder();

        if (context.Leeftijd is { } leeftijd)
        {
            sb.Append("Leeftijd van de klas: ").Append(leeftijd).Append(Nl).Append(Nl);
        }

        sb.Append(ActiviteitenKop).Append(Nl).Append(Nl);
        foreach (var kandidaat in context.Kandidaten)
        {
            sb.Append(kandidaat.Sleutel).Append(": ").Append(kandidaat.Naam).Append(Nl);
            sb.Append("  Subthema: ").Append(kandidaat.SubthemaNaam).Append(Nl);
            if (kandidaat.Soort is { } soort)
            {
                sb.Append("  Soort: ").Append(soort).Append(Nl);
            }

            sb.Append("  Lengte: ").Append(kandidaat.LengteInLesuren)
                .Append(kandidaat.LengteInLesuren == 1 ? " lesuur" : " lesuren").Append(Nl);
            if (kandidaat.VerwachteUitkomsten is { } uitkomsten)
            {
                sb.Append("  Wat de kinderen doen: ").Append(uitkomsten).Append(Nl);
            }

            sb.Append("  Kan op: ").Append(string.Join(", ", kandidaat.Dagen.Order().Select(Datum))).Append(Nl);
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

            sb.Append("- ").Append(Datum(dag.Datum));
            sb.Append(" (").Append(Schooldaguren.Dagnaam(dag.Datum.DayOfWeek)).Append("), vrij: ");
            sb.Append(string.Join(", ", vrij.Select(v =>
                $"{v.Begin.ToString(Uurvorm, CultureInfo.InvariantCulture)}-{v.Einde.ToString(Uurvorm, CultureInfo.InvariantCulture)}")));
            sb.Append(Nl);
        }

        return sb.ToString();
    }

    private static string Datum(DateOnly datum) => datum.ToString(Datumvorm, CultureInfo.InvariantCulture);
}
