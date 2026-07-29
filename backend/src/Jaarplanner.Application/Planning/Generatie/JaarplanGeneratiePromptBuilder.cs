using System.Globalization;
using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Generatie.Response;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// Builds the grounded plan-generation prompt (FR-5.1) that <see cref="JaarplanGeneratieService"/> hands to the
/// injectable <c>IAiClient</c>. It turns one <see cref="Klas"/>, its <see cref="Schooljaar"/>'s
/// <b>derived</b> planningsblokken and the school's own thema's into an <see cref="AiRequest"/>. Modelled on
/// <c>MatchingPromptBuilder</c> and holding to the same two properties:
/// <list type="bullet">
/// <item><b>Grounded only on school + Op.stap data (Art. IV.4).</b> Every line of the user prompt is rendered
/// exclusively from the arguments; the system prompt forbids external knowledge and invented thema's. No clock,
/// no environment, no configuration, no I/O.</item>
/// <item><b>Pure and deterministic.</b> Same klas + same blocks + same thema's ⇒ byte-for-byte the same prompt
/// (thema's are ordered by name so caller ordering cannot leak in), which is what makes it snapshot-testable.</item>
/// </list>
/// <para>
/// <b>The blocks are passed in, never computed here.</b> They come from the <see cref="IPlanningsblokIndeling"/>
/// seam, so this builder contains no calendar unit at all: no month name, no week number, no term. It lists the
/// blocks it was handed with their start/end dates and lets the model choose among <i>those</i>. Art. IX.3's
/// "never hard-assume months" is satisfied structurally rather than by convention.
/// </para>
/// <para>
/// <b>The model is asked to answer with block <i>start dates</i>.</b> It is never shown a way to name a block by
/// position, and the requested JSON has no field for one, because an ordinal is not a stable key (ADR-0020 §3).
/// The ordinal <i>is</i> printed alongside each block as a human label ("periode 3"), which is the role ADR-0020
/// assigns it, and the instructions say plainly that the answer must carry the date.
/// </para>
/// <para>
/// <b>Nothing about leerjaar is asked of the model as a constraint.</b> The class's leerjaar is stated as
/// descriptive context only; how a graadklas spanning several leerjaren is handled is an open decision
/// (Art. XIV) and is not pre-empted by a prompt rule.
/// </para>
/// </summary>
public static class JaarplanGeneratiePromptBuilder
{
    // Explicit '\n' newlines everywhere so the built prompt is identical on Windows and Linux CI, keeping the
    // snapshot stable across platforms.
    private const string Nl = "\n";

    /// <summary>
    /// The fixed instruction scaffolding (the model's role + the grounding rules of Art. IV.1/IV.3/IV.4/IV.5).
    /// This is the <b>only</b> non-data text in the request; it carries no school, curriculum or calendar
    /// specifics itself.
    /// </summary>
    public static readonly string SystemPrompt =
        "Je bent een assistent die een leerkracht helpt om een jaarplan voor één klas voor te stellen: je " +
        "verdeelt de thema's van de school over de planningsblokken van het schooljaar." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in het bericht van de gebruiker: de klas, de opgegeven " +
        "planningsblokken en de thema's van de school. Verzin geen thema's en geen planningsblokken." + Nl +
        "- Gebruik geen externe kennis, geen internet en geen andere bronnen." + Nl +
        "- Gebruik enkel thema's waarvan de naam letterlijk voorkomt in de lijst \"Thema's van de school\", en " +
        "enkel planningsblokken waarvan de startdatum letterlijk voorkomt in de lijst \"Planningsblokken\"." + Nl +
        "- Verwijs naar een planningsblok altijd met zijn STARTDATUM, nooit met zijn nummer of naam. Het " +
        "nummer is enkel een label voor de leerkracht en verschuift wanneer de school haar vakanties " +
        "aanpast." + Nl +
        "- Geef bij elk voorstel een korte motivatie in het Nederlands (\"waarom past dit thema hier?\")." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist. Pas niets automatisch toe." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder extra tekst of uitleg eromheen:" + Nl +
        "  {\"plaatsingen\": [{\"blokStart\": \"" + JaarplanGeneratieResponseParser.DatumFormaat +
        "\", \"thema\": \"<themanaam>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Gebruik exact de veldnamen \"plaatsingen\", \"blokStart\", \"thema\" en \"motivatie\". " +
        "\"blokStart\" is een datum in het formaat " + JaarplanGeneratieResponseParser.DatumFormaat +
        " uit de lijst planningsblokken; \"thema\" is een themanaam uit de lijst thema's; \"motivatie\" is " +
        "één zin." + Nl +
        "- Kan je geen enkel thema plaatsen, antwoord dan met een lege lijst: {\"plaatsingen\": []}.";

    /// <summary>
    /// Builds the grounded <see cref="AiRequest"/> for generating a plan proposal for one class.
    /// </summary>
    /// <param name="klas">The class the plan is for (its own data only — no pupil data exists, Art. VI.2).</param>
    /// <param name="schooljaar">The school year, for its label and span.</param>
    /// <param name="blokken">
    /// The planningsblokken <b>already derived</b> by the <see cref="IPlanningsblokIndeling"/> seam — the only
    /// slots the model may choose from.
    /// </param>
    /// <param name="themas">The school's own thema's (Art. IX.2) — the only content the model may place.</param>
    /// <returns>The grounded request (system + user prompt), ready for the AI client seam.</returns>
    public static AiRequest Bouw(
        Klas klas,
        Schooljaar schooljaar,
        IReadOnlyCollection<Planningsblok> blokken,
        IReadOnlyCollection<Thema> themas)
    {
        ArgumentNullException.ThrowIfNull(klas);
        ArgumentNullException.ThrowIfNull(schooljaar);
        ArgumentNullException.ThrowIfNull(blokken);
        ArgumentNullException.ThrowIfNull(themas);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(klas, schooljaar, blokken, themas),
        };
    }

    private static string BouwUserPrompt(
        Klas klas,
        Schooljaar schooljaar,
        IReadOnlyCollection<Planningsblok> blokken,
        IReadOnlyCollection<Thema> themas)
    {
        var sb = new StringBuilder();

        SchrijfKlas(sb, klas, schooljaar);
        sb.Append(Nl);
        SchrijfBlokken(sb, blokken);
        sb.Append(Nl);
        SchrijfThemas(sb, themas);

        return sb.ToString();
    }

    private static void SchrijfKlas(StringBuilder sb, Klas klas, Schooljaar schooljaar)
    {
        Line(sb, "# Klas");
        Line(sb, string.Empty);
        Line(sb, $"Naam: {klas.Naam}");
        Line(sb, $"Leerjaar/leeftijdsgroep: {klas.Leerjaar}");
        Line(sb, $"Schooljaar: {schooljaar.Naam} ({Datum(schooljaar.Start)} t/m {Datum(schooljaar.Eind)})");
    }

    private static void SchrijfBlokken(StringBuilder sb, IReadOnlyCollection<Planningsblok> blokken)
    {
        Line(sb, "# Planningsblokken");
        Line(sb, string.Empty);
        Line(sb, "Kies enkel uit deze blokken en verwijs ernaar met de startdatum.");
        Line(sb, string.Empty);

        if (blokken.Count == 0)
        {
            Line(sb, "- (geen planningsblokken beschikbaar)");
            return;
        }

        // Ordered by the stable key (start date) so caller ordering cannot change the prompt.
        foreach (var blok in blokken.OrderBy(b => b.Start))
        {
            Line(
                sb,
                $"- startdatum {Datum(blok.Start)} | einddatum {Datum(blok.Eind)} | {blok.AantalDagen} dagen " +
                $"| label \"{blok.Niveau} {blok.Ordinaal}\"");
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

        // Ordered by name so caller ordering cannot change the prompt.
        foreach (var thema in themas.OrderBy(t => t.Naam, StringComparer.Ordinal))
        {
            SchrijfThema(sb, thema);
        }
    }

    private static void SchrijfThema(StringBuilder sb, Thema thema)
    {
        Line(sb, $"- Thema: {thema.Naam} (duur {thema.DuurWeken} weken)");
        if (thema.Invalshoeken is not null)
        {
            Line(sb, $"  Invalshoeken: {thema.Invalshoeken}");
        }

        if (thema.Kernwoordenschat.Count > 0)
        {
            Line(sb, $"  Kernwoordenschat: {string.Join(", ", thema.Kernwoordenschat)}");
        }

        // Only the goals the teacher actually stands behind (aanvaard/manueel, Art. V.1) — a `voorgesteld`
        // suggestion is not yet a goal of this thema, and a `geweigerd` one never was. Feeding the model
        // unconfirmed links would let the AI reason about goals the teacher has rejected.
        var doelcodes = ThemaDoelcodes(thema);
        if (doelcodes.Count > 0)
        {
            Line(sb, $"  Gekoppelde leerplandoelen: {string.Join(", ", doelcodes)}");
        }
    }

    /// <summary>
    /// The leerplandoel codes a thema actually carries: its themadoelen and its accepted/manual goal links
    /// (status <c>aanvaard</c> or <c>manueel</c> — the same rule dekking uses, Art. V.1), ordered and
    /// de-duplicated. Shared with the read view so the prompt and the API report the same set.
    /// </summary>
    public static IReadOnlyList<string> ThemaDoelcodes(Thema thema)
    {
        ArgumentNullException.ThrowIfNull(thema);

        return thema.Themadoelen
            .Select(td => td.Koppeling)
            .Concat(thema.Doelsuggesties)
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
