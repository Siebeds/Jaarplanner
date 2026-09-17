using System.Globalization;
using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Generatie.Response;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// One lesweek as the generation prompt shows it (ADR-0055): its Monday, the thema's that already run in it and stay,
/// and whether any schooldag in it is still free.
/// </summary>
/// <param name="Maandag">The Monday of the lesweek.</param>
/// <param name="Themas">The names of the thema's that already run in this week and stay after the run.</param>
/// <param name="IsVol">True when no schooldag of the week is free.</param>
public sealed record Planweek(DateOnly Maandag, IReadOnlyList<string> Themas, bool IsVol);

/// <summary>
/// Builds the grounded plan-generation prompt (FR-5.1, ADR-0055) that <see cref="JaarplanGeneratieService"/> hands to
/// the <c>IAiClient</c>: the class, the lesweken of its school year with what already stands in them, the vacations,
/// and the school's own thema's. The model answers with thema's and a start week for each; the service works out the
/// days.
/// <list type="bullet">
/// <item><b>Grounded only on school and Op.stap data (Art. IV.4).</b> Every line of the user prompt is rendered from
/// the arguments; the system prompt forbids external knowledge and invented thema's. No clock, no environment, no
/// I/O.</item>
/// <item><b>Pure and deterministic.</b> The same arguments give byte-for-byte the same prompt: weeks are ordered by
/// date and thema's by name, so caller ordering cannot leak in.</item>
/// <item><b>No month names.</b> The weeks are dates; the model reads the season from them (Art. IX.3: never assume
/// months).</item>
/// </list>
/// <para>
/// <b>Nothing about leerjaar is asked of the model as a constraint.</b> The class's leerjaar is descriptive context only;
/// how a graadklas spanning several leerjaren is handled is an open decision (Art. XIV).
/// </para>
/// </summary>
public static class JaarplanGeneratiePromptBuilder
{
    // Explicit '\n' newlines everywhere so the built prompt is identical on Windows and Linux CI.
    private const string Nl = "\n";

    /// <summary>
    /// The fixed instruction scaffolding: the model's role and the grounding rules of Art. IV.1/IV.3/IV.4/IV.5. It
    /// carries no school, curriculum or calendar specifics itself.
    /// </summary>
    public static readonly string SystemPrompt =
        "Je bent een assistent die een leerkracht helpt om een jaarplan voor één klas voor te stellen: je kiest " +
        "thema's van de school en voor elk thema de lesweek waarin het begint." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in het bericht van de gebruiker: de klas, de lesweken, de vakanties en " +
        "de thema's van de school. Verzin geen thema's en geen weken." + Nl +
        "- Gebruik geen externe kennis, geen internet en geen andere bronnen." + Nl +
        "- Gebruik enkel thema's waarvan de naam letterlijk voorkomt in de lijst \"Thema's van de school\", en " +
        "enkel startweken waarvan de datum letterlijk voorkomt in de lijst \"Lesweken\" en die niet bezet zijn." + Nl +
        "- Geef bij elk voorstel een korte motivatie in het Nederlands (\"waarom past dit thema hier?\")." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist. Pas niets automatisch toe." + Nl +
        Nl +
        "Planning (in deze volgorde belangrijk):" + Nl +
        "- Twee thema's lopen nooit tegelijk. Een thema duurt het aantal lesweken dat erbij staat. Laat een thema " +
        "pas beginnen in de week nadat het vorige gedaan is, en niet in een week waarin een thema staat dat blijft." +
        Nl +
        "- Een vakantie telt niet mee: een thema dat erover loopt, gaat na de vakantie verder." + Nl +
        "- Stel geen thema voor dat al in het jaarplan staat, en stel elk thema hoogstens één keer voor." + Nl +
        "- Vul de vrije lesweken zo goed als het gaat. Een week die vrij blijft, is geen probleem; een thema dat " +
        "niet past, laat je weg." + Nl +
        "- Let op een logische volgorde. Wijst de naam of wijzen de invalshoeken van een thema op een seizoen of " +
        "een moment in het schooljaar, kies dan een startweek waarvan de datum in dat seizoen valt. Leid dat af uit " +
        "de themanaam en de datums die hieronder staan; zoek niets op en voeg geen kennis van buiten toe." + Nl +
        "- Verdeel de gekoppelde doelen evenwichtig over het schooljaar. Zet niet alle doelenrijke thema's " +
        "vooraan." + Nl +
        Nl +
        // It asks for selection, not for exhaustion (owner ruling 2026-08-05): the thema list is the school's library,
        // and a class need not teach every thema. The denominator of coverage is the server's (DekkingService), so no
        // target figure is given here: the model would be judging its own coverage (Art. IV.1).
        "Dekking (streef naar volledige dekking over het hele schooljaar):" + Nl +
        "- Zorg dat samen zoveel mogelijk VERSCHILLENDE doelen aan bod komen." + Nl +
        "- Kies daarvoor de combinatie van thema's die samen het meeste dekt. Je hoeft niet elk thema te " +
        "gebruiken: de lijst is de bibliotheek van de school, niet een verplichte inhoud voor deze klas." + Nl +
        "- Twijfel je tussen twee thema's voor dezelfde weken, kies dan het thema met doelen die nog nergens anders " +
        "in het jaarplan voorkomen." + Nl +
        Nl +
        "Antwoordvorm:" + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder extra tekst of uitleg eromheen:" + Nl +
        "  {\"plaatsingen\": [{\"thema\": \"<themanaam>\", \"startweek\": \"" +
        JaarplanGeneratieResponseParser.DatumFormaat + "\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Gebruik exact de veldnamen \"plaatsingen\", \"thema\", \"startweek\" en \"motivatie\". \"startweek\" is " +
        "de maandag van een lesweek uit de lijst, in het formaat " + JaarplanGeneratieResponseParser.DatumFormaat +
        "; \"thema\" is een themanaam uit de lijst thema's; \"motivatie\" is één zin." + Nl +
        "- Kan je geen enkel thema plaatsen, antwoord dan met een lege lijst: {\"plaatsingen\": []}.";

    /// <summary>Builds the grounded <see cref="AiRequest"/> for generating a plan proposal for one class.</summary>
    /// <param name="klas">The class the plan is for: its own data only. No pupil data reaches this prompt (Art. VI.2).</param>
    /// <param name="schooljaar">The school year, for its label, span and vacations.</param>
    /// <param name="weken">Every lesweek of the year, with what stays in it after the run.</param>
    /// <param name="themas">The school's own thema's (Art. IX.2): the only content the model may place.</param>
    /// <param name="alGepland">The names of the thema's that stay in the plan after the run.</param>
    public static AiRequest Bouw(
        Klas klas,
        Schooljaar schooljaar,
        IReadOnlyCollection<Planweek> weken,
        IReadOnlyCollection<Thema> themas,
        IReadOnlyCollection<string> alGepland)
    {
        ArgumentNullException.ThrowIfNull(klas);
        ArgumentNullException.ThrowIfNull(schooljaar);
        ArgumentNullException.ThrowIfNull(weken);
        ArgumentNullException.ThrowIfNull(themas);
        ArgumentNullException.ThrowIfNull(alGepland);

        var sb = new StringBuilder();
        SchrijfKlas(sb, klas, schooljaar);
        sb.Append(Nl);
        SchrijfWeken(sb, weken);
        sb.Append(Nl);
        SchrijfVakanties(sb, schooljaar);
        sb.Append(Nl);
        SchrijfAlGepland(sb, alGepland);
        sb.Append(Nl);
        SchrijfThemas(sb, themas);

        return new AiRequest { SystemPrompt = SystemPrompt, UserPrompt = sb.ToString() };
    }

    private static void SchrijfKlas(StringBuilder sb, Klas klas, Schooljaar schooljaar)
    {
        Line(sb, "# Klas");
        Line(sb, string.Empty);
        Line(sb, $"Naam: {klas.Naam}");
        Line(sb, $"Leerjaar/leeftijdsgroep: {klas.Leerjaar}");
        Line(sb, $"Schooljaar: {schooljaar.Naam} ({Datum(schooljaar.Start)} t/m {Datum(schooljaar.Eind)})");
    }

    private static void SchrijfWeken(StringBuilder sb, IReadOnlyCollection<Planweek> weken)
    {
        Line(sb, "# Lesweken");
        Line(sb, string.Empty);
        Line(sb, "Elke lesweek met de datum van haar maandag. Kies een startweek die niet bezet is.");
        Line(sb, string.Empty);

        if (weken.Count == 0)
        {
            Line(sb, "- (geen lesweken)");
            return;
        }

        // Stated rather than left to be counted: a model that has to tally a list may tally it wrong.
        Line(sb, $"Aantal lesweken: {weken.Count}, waarvan vrij: {weken.Count(w => w.Themas.Count == 0)}");
        Line(sb, string.Empty);

        foreach (var week in weken.OrderBy(w => w.Maandag))
        {
            var themas = string.Join(", ", week.Themas.Order(StringComparer.Ordinal));
            var staat = week.Themas.Count == 0 ? "vrij"
                : week.IsVol ? $"bezet ({themas})"
                : $"deels vrij ({themas} staat er al)";
            Line(sb, $"- {Datum(week.Maandag)}: {staat}");
        }
    }

    private static void SchrijfVakanties(StringBuilder sb, Schooljaar schooljaar)
    {
        Line(sb, "# Vakanties");
        Line(sb, string.Empty);

        if (schooljaar.Vakanties.Count == 0)
        {
            Line(sb, "- (geen vakanties)");
            return;
        }

        foreach (var vakantie in schooljaar.Vakanties.OrderBy(v => v.Start))
        {
            Line(sb, $"- {vakantie.Naam}: {Datum(vakantie.Start)} t/m {Datum(vakantie.Eind)}");
        }
    }

    private static void SchrijfAlGepland(StringBuilder sb, IReadOnlyCollection<string> alGepland)
    {
        Line(sb, "# Thema's die al in het jaarplan staan en blijven");
        Line(sb, string.Empty);

        if (alGepland.Count == 0)
        {
            Line(sb, "- (geen)");
            return;
        }

        foreach (var naam in alGepland.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal))
        {
            Line(sb, $"- {naam}");
        }
    }

    private static void SchrijfThemas(StringBuilder sb, IReadOnlyCollection<Thema> themas)
    {
        Line(sb, "# Thema's van de school");
        Line(sb, string.Empty);

        if (themas.Count == 0)
        {
            Line(sb, "- (geen thema's aangeleverd)");
            return;
        }

        Line(sb, $"Aantal thema's: {themas.Count}");
        Line(sb, string.Empty);

        foreach (var thema in themas.OrderBy(t => t.Naam, StringComparer.Ordinal))
        {
            SchrijfThema(sb, thema);
        }
    }

    private static void SchrijfThema(StringBuilder sb, Thema thema)
    {
        Line(sb, $"- Thema: {thema.Naam} (duur {thema.DuurWeken} lesweken)");
        if (thema.Invalshoeken is not null)
        {
            Line(sb, $"  Invalshoeken: {thema.Invalshoeken}");
        }

        if (thema.Kernwoordenschat.Count > 0)
        {
            Line(sb, $"  Kernwoordenschat: {string.Join(", ", thema.Kernwoordenschat)}");
        }

        // The minimumdoelen the thema aims at, its themadoelen (FB-053): what a thema covers for a klas (Art. V.1).
        var minimumdoelen = thema.Minimumdoelen
            .Select(m => m.MinimumdoelRef)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(r => r, StringComparer.Ordinal)
            .ToList();
        if (minimumdoelen.Count > 0)
        {
            Line(sb, $"  Themadoelen, minimumdoelen ({minimumdoelen.Count}): {string.Join(", ", minimumdoelen)}");
        }

        // Only the goals the teacher stands behind (aanvaard/manueel, Art. V.1): a voorgesteld suggestion is not yet a
        // goal of this thema, and a geweigerd one never was.
        var doelcodes = ThemaDoelcodes(thema);
        if (doelcodes.Count > 0)
        {
            Line(sb, $"  Gekoppelde leerplandoelen ({doelcodes.Count}): {string.Join(", ", doelcodes)}");
        }
    }

    /// <summary>
    /// The leerplandoel codes a thema carries <b>on the thema itself</b>: the decided themadoelen the FR-1 import wrote
    /// (status <c>aanvaard</c> or <c>manueel</c>), ordered and de-duplicated. Shared with the read view so the prompt and
    /// the API report the same set. A thema's minimumdoelen are written separately.
    /// <para>
    /// <b>This is not the rule dekking uses.</b> Since ADR-0047 <c>DekkingService</c> counts no themadoel that links a
    /// leerplandoel, counts a thema's minimumdoelen through the thema's placement, and counts subdoel and activiteit
    /// links only through their own subthema's placement, which it can because it computes for <i>one klas</i>. This
    /// method has only a school-wide <see cref="Thema"/>, so a calendar card may list fewer codes than dekking credits to
    /// that thema. Stated here so the next reader does not "fix" the discrepancy by widening one side.
    /// </para>
    /// </summary>
    public static IReadOnlyList<string> ThemaDoelcodes(Thema thema)
    {
        ArgumentNullException.ThrowIfNull(thema);

        return thema.Themadoelen
            .Select(td => td.Koppeling)
            .Where(k => k.Status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel)
            .Select(k => k.LeerplandoelCode)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(code => code, StringComparer.Ordinal)
            .ToList();
    }

    private static string Datum(DateOnly datum) =>
        datum.ToString(JaarplanGeneratieResponseParser.DatumFormaat, CultureInfo.InvariantCulture);

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
