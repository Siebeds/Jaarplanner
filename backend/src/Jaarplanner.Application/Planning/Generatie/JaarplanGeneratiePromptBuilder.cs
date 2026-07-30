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
        Nl +
        "Spreiding (in deze volgorde belangrijk):" + Nl +
        "- Gebruik zoveel mogelijk verschillende planningsblokken in plaats van enkele thema's samen in " +
        "één blok te zetten. Er zijn niet meer thema's dan blokken nodig." + Nl +
        "- Plaats een thema in een blok dat lang genoeg is: de duur van het thema in weken mag niet groter " +
        "zijn dan het aantal weken van het blok." + Nl +
        "- Let op een logische volgorde. Wijst de naam of wijzen de invalshoeken van een thema op een " +
        "seizoen of een moment in het schooljaar, kies dan een blok waarvan de opgegeven datums in dat " +
        "seizoen vallen. Leid dat af uit de themanaam en de datums die hieronder staan; zoek niets op en " +
        "voeg geen kennis van buiten toe." + Nl +
        "- Verdeel de gekoppelde leerplandoelen evenwichtig over het schooljaar. Zet niet alle " +
        "doelenrijke thema's in de eerste blokken." + Nl +
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
    /// <param name="parameters">
    /// What the teacher asked for before the run (FR-5.4). Omitted from the prompt entirely when empty, so a run
    /// without parameters produces byte-for-byte the prompt it produced before this story existed — which is what
    /// keeps the existing snapshot test meaningful rather than merely updated.
    /// </param>
    public static AiRequest Bouw(
        Klas klas,
        Schooljaar schooljaar,
        IReadOnlyCollection<Planningsblok> blokken,
        IReadOnlyCollection<Thema> themas,
        JaarplanGeneratieParameters? parameters = null)
    {
        ArgumentNullException.ThrowIfNull(klas);
        ArgumentNullException.ThrowIfNull(schooljaar);
        ArgumentNullException.ThrowIfNull(blokken);
        ArgumentNullException.ThrowIfNull(themas);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(
                klas, schooljaar, blokken, themas, parameters ?? JaarplanGeneratieParameters.Geen),
        };
    }

    private static string BouwUserPrompt(
        Klas klas,
        Schooljaar schooljaar,
        IReadOnlyCollection<Planningsblok> blokken,
        IReadOnlyCollection<Thema> themas,
        JaarplanGeneratieParameters parameters)
    {
        var sb = new StringBuilder();

        SchrijfKlas(sb, klas, schooljaar);
        sb.Append(Nl);
        SchrijfBlokken(sb, blokken);
        sb.Append(Nl);
        SchrijfThemas(sb, themas);

        // Last, and only when there is something to say. Placed after the data it refers to so the model reads the
        // thema names and block dates before the constraints that cite them.
        if (!parameters.IsLeeg)
        {
            sb.Append(Nl);
            SchrijfParameters(sb, parameters, blokken);
        }

        return sb.ToString();
    }

    /// <summary>
    /// The teacher's own pre-generation instructions (FR-5.4). Note what this section does <b>not</b> contain:
    /// vakanties. They are already expressed in the block list above, because blocks are derived from them and never
    /// span one (ADR-0020) — restating them as prose would invite the model to reason about holidays that the grid
    /// has already removed from consideration.
    /// </summary>
    private static void SchrijfParameters(
        StringBuilder sb,
        JaarplanGeneratieParameters parameters,
        IReadOnlyCollection<Planningsblok> blokken)
    {
        Line(sb, "# Wat de leerkracht vooraf vraagt");
        Line(sb, string.Empty);

        // One line per requested thema, each naming its OWN block. An earlier revision joined them into a single
        // sentence naming one block, which told the model to put several 4–6 week thema's in one themaperiode —
        // contradicting the system prompt's "use as many different blocks as possible" and its own fit rule.
        var startthemas = parameters.GenormaliseerdeStartthemas();
        var geordend = blokken.OrderBy(b => b.Start).ToList();
        for (var i = 0; i < startthemas.Count && i < geordend.Count; i++)
        {
            Line(
                sb,
                $"- Plaats het thema \"{startthemas[i]}\" in het blok met startdatum " +
                $"{Datum(geordend[i].Start)}.");
        }

        foreach (var moment in parameters.VasteMomenten.OrderBy(m => m.Datum).ThenBy(m => m.Naam, StringComparer.Ordinal))
        {
            if (moment.BlokkeertPlaatsing)
            {
                // Stated as a prohibition AND enforced by the service afterwards. The prompt asks so the model can
                // produce a usable plan in one pass; the service enforces so a model that ignores the ask cannot
                // put a thema in a period the teacher already spent.
                Line(
                    sb,
                    $"- Op {Datum(moment.Datum)} is er \"{moment.Naam}\". Plaats GEEN thema in het blok waarin " +
                    "die datum valt: die periode is al bezet.");
            }
            else
            {
                Line(
                    sb,
                    $"- Op {Datum(moment.Datum)} is er \"{moment.Naam}\". Houd er rekening mee dat die periode " +
                    "daardoor minder tijd heeft, maar je mag er wel een thema plaatsen.");
            }
        }
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

        // The count is stated explicitly rather than left to be counted from the list: FR-5.2's first property is
        // "respect the number of available blocks", and a model that has to tally a list to know the denominator
        // is a model that may get the denominator wrong.
        Line(sb, $"Aantal beschikbare blokken: {blokken.Count}");
        Line(sb, string.Empty);

        // Ordered by the stable key (start date) so caller ordering cannot change the prompt.
        foreach (var blok in blokken.OrderBy(b => b.Start))
        {
            // Weeks are printed next to days because the fit rule is expressed in weeks (a thema's DuurWeken).
            // Making the model divide by 7 itself is an arithmetic step that buys nothing.
            Line(
                sb,
                $"- startdatum {Datum(blok.Start)} | einddatum {Datum(blok.Eind)} | {blok.AantalDagen} dagen " +
                $"({Weken(blok.AantalDagen)} weken) | label \"{blok.Niveau} {blok.Ordinaal}\"");
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
            // The count is stated as well as the codes. FR-5.2 asks for an even distribution OF THE GOALS, so the
            // model needs the per-thema weight to balance against; deriving it by counting a comma-separated list
            // is exactly the kind of incidental arithmetic that goes wrong quietly.
            Line(sb, $"  Gekoppelde leerplandoelen ({doelcodes.Count}): {string.Join(", ", doelcodes)}");
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

    /// <summary>
    /// Days as weeks to one decimal, invariant-formatted so the prompt is byte-identical on every platform (a
    /// Dutch locale would render "4,4" and break the snapshot on one OS but not the other).
    /// </summary>
    private static string Weken(int dagen) =>
        (dagen / 7.0).ToString("0.0", CultureInfo.InvariantCulture);

    private static string Datum(DateOnly datum) =>
        datum.ToString(JaarplanGeneratieResponseParser.DatumFormaat, CultureInfo.InvariantCulture);

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
