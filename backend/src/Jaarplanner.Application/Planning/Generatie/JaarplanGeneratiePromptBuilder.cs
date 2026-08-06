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
        Nl +
        // FR-5.3's asked half (E3-03). It comes AFTER the spreiding rules on purpose: those are stated as
        // "in deze volgorde belangrijk", and a thema crammed into a period too short for it covers its goals on
        // paper only. So coverage is what decides between placements that already fit, never a licence to overfill —
        // which is also why it does not contradict E3-02's "er zijn niet meer thema's dan blokken nodig": that line
        // discourages stacking, and these decide WHICH thema's to use.
        //
        // **It asks for selection, not for exhaustion, and that is an owner ruling (2026-08-05).** The first version
        // said "plaats elk thema minstens één keer", which the antagonist correctly read as asserting that every
        // school-wide thema belongs in every class's year. The owner ruled the opposite: thema's are often aligned
        // across the classes of one leerjaar, but each class — each teacher — may have its own. So the library is an
        // offer, and a plan that leaves a thema unused is not a worse plan.
        //
        // **The consequence this prompt cannot fix, filed rather than papered over:** `Thema` is school-wide
        // (Art. IX.2) and nothing records which thema's belong to which class, so this prompt is handed the WHOLE
        // library for every class. Wording it as an offer is the honest half; the missing half is a per-class
        // selection, which is a data-model question. It is filed as an open decision in backlog/README.md — NOT
        // against Art. XIV's "shared vs per-class" entry, which the constitution lists under *Resolved*: that
        // binary settled where a thema is SCOPED, and this is the different question of which of the school's
        // thema's a given class actually teaches.
        //
        // Nothing here mentions the curriculum, the class's jaar/fase or a target number, and that is deliberate.
        // The model is given the school's thema's with their goal codes and nothing else (Art. IV.4), so the only
        // coverage it can reason about is the union of what it places. The DENOMINATOR — which leerplandoelen this
        // class is measured against — is resolved server-side by DekkingService (owner ruling 2026-08-04) and
        // reported as Dekkingsvooruitzicht. Putting a target in the prompt would ask the model to judge its own
        // coverage, which is the retry loop E3-02 deliberately refused to build (Art. IV.1).
        "Dekking (streef naar volledige dekking over het hele schooljaar):" + Nl +
        "- Zorg dat samen zoveel mogelijk VERSCHILLENDE leerplandoelen aan bod komen." + Nl +
        "- Kies daarvoor de combinatie van thema's die samen het meeste dekt. Je hoeft niet elk thema te " +
        "gebruiken: de lijst is de bibliotheek van de school, niet een verplichte inhoud voor deze klas." + Nl +
        "- Twijfel je tussen twee thema's voor hetzelfde blok, kies dan het thema met leerplandoelen die " +
        "nog nergens anders in het jaarplan voorkomen." + Nl +
        "- Zet hetzelfde thema niet in meerdere blokken als een ander thema doelen zou toevoegen die nog " +
        "niet gedekt zijn." + Nl +
        Nl +
        // Given its own heading by E3-03. These two bullets used to hang off the "Spreiding" list, where they read as
        // spreading rules; a second topical section above them would have made that misfiling worse.
        "Antwoordvorm:" + Nl +
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
        SchrijfBlokken(sb, blokken, schooljaar);
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

        // One line per requested thema, each naming its OWN block by START DATE. Two earlier revisions are worth
        // remembering: the first joined every name into a single sentence naming one block, which told the model to put
        // several 4–6 week thema's in one themaperiode; the second made the request positional, so the target block was
        // an ordinal in different clothing (ADR-0020 §3). The entry now carries the date itself.
        //
        // A requested block start that is not among the blocks handed in is SKIPPED here rather than printed: telling
        // the model to use a date that starts no block would contradict the system prompt's own "use only these
        // blocks" rule. It is not lost — ParameterRapport.VervallenStartthemas reports it, and the setting stays kept.
        var blokStarts = blokken.Select(b => b.Start).ToHashSet();
        foreach (var keuze in parameters.GenormaliseerdeStartthemas().Where(k => blokStarts.Contains(k.BlokStart)))
        {
            Line(
                sb,
                $"- Plaats het thema \"{keuze.ThemaNaam}\" in het blok met startdatum " +
                $"{Datum(keuze.BlokStart)}.");
        }

        foreach (var moment in parameters.GenormaliseerdeVasteMomenten())
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

    private static void SchrijfBlokken(
        StringBuilder sb,
        IReadOnlyCollection<Planningsblok> blokken,
        Schooljaar schooljaar)
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
            //
            // **The weeks figure is the one the te-vol rule uses** (owner ruling, 2026-08-05, on the E3-09 antagonist's
            // QUESTION): open days rounded up, `ceil(TelOpenDagen / 7)`. It was `AantalDagen / 7` to one decimal, so the
            // prompt told the model a 1 sep – 1 okt period was "4,4 weken" while the flag a teacher then reads measures
            // the same period as **5**. Pre-existing since E3-02 and lenient in the safe direction, but this is the
            // input that decides whether the model even tries to fit a thema, so the generator was being steered by a
            // stricter number than the verdict it would be judged against.
            //
            // **The days are still the calendar span, and that is deliberate**: the model is asked to reason about
            // seasons and about "a moment in the school year", for which the real dates are the truth. Only the
            // capacity figure follows the rule.
            Line(
                sb,
                $"- startdatum {Datum(blok.Start)} | einddatum {Datum(blok.Eind)} | {blok.AantalDagen} dagen " +
                $"({WekenCapaciteit(blok, schooljaar)} weken) | label \"{blok.Niveau} {blok.Ordinaal}\"");
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

        // Stated for the same reason the block count is (E3-02): a model that has to tally a list to know how many
        // there are is a model that may tally it wrong. Beside the block count it makes the shape of the choice
        // visible at a glance — twenty thema's for seven periods is a selection problem, five for seven is not —
        // instead of leaving it to be discovered halfway down the list.
        //
        // *Its justification changed with the owner's ruling of 2026-08-05 and the number did not.* It used to be
        // here to make "place every thema" checkable; that instruction is gone, and the count earns its place on the
        // selection reasoning instead. Recorded because a figure whose stated reason has quietly expired is the kind
        // of thing that survives three stories and then gets defended by the wrong argument.
        Line(sb, $"Aantal thema's: {themas.Count}");
        Line(sb, string.Empty);

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
    /// The leerplandoel codes a thema carries <b>on the thema itself</b>: its themadoelen and its accepted/manual
    /// thema-level goal links (status <c>aanvaard</c> or <c>manueel</c>, Art. V.1), ordered and de-duplicated.
    /// Shared with the read view so the prompt and the API report the same set.
    /// <para>
    /// <b>This is a subset of what dekking counts, and the difference is deliberate rather than a bug (E5-01,
    /// 2026-08-03).</b> An earlier revision of this comment called it "the same rule dekking uses". That was true
    /// when no coverage computation existed and is now false: <c>DekkingService</c> counts <b>four</b> link layers,
    /// adding the <c>Subdoel</c> and <c>Activiteit</c> links that hang off a <c>Subthema</c>. It can, because it
    /// computes for <i>one klas</i> and a subthema is scoped per klas and leeftijd (Art. IX.2). This method cannot:
    /// it has only a <see cref="Thema"/>, which is school-wide, so including those layers here would attribute one
    /// class's activiteiten to every class that places the thema, and it would feed the generation prompt goals
    /// belonging to a different class.
    /// </para>
    /// <para>
    /// The visible consequence is that a calendar card may list fewer codes than dekking credits to that thema.
    /// Making the two identical would mean giving this method a klas, i.e. a per-class prompt and a per-class card,
    /// which is a scope question for E4/E5 and not something to settle in a comment. Stated here so the next reader
    /// does not "fix" the discrepancy by widening whichever side they happen to be looking at.
    /// </para>
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
    /// A block's teaching capacity in <b>whole weeks</b>, by the same arithmetic the te-vol verdict uses:
    /// <c>ceil(TelOpenDagen / 7)</c>.
    /// <para>
    /// <b>Shared with <see cref="BlokspreidingWeergave.IsOverbelast"/> by construction, not by coincidence</b> (owner
    /// ruling, 2026-08-05). This used to be <c>AantalDagen / 7</c> to one decimal, which was a *tenth* place where a
    /// period's length in weeks was computed and the only one that steers the model. It is an integer, so it needs no
    /// culture-invariant formatting: the reason the old helper carried a <see cref="CultureInfo"/> was that a Dutch
    /// locale renders "4,4" and would have made the prompt differ per OS.
    /// </para>
    /// </summary>
    private static int WekenCapaciteit(Planningsblok blok, Schooljaar schooljaar) =>
        (int)Math.Ceiling(schooljaar.TelOpenDagen(blok.Start, blok.Eind) / 7.0);

    private static string Datum(DateOnly datum) =>
        datum.ToString(JaarplanGeneratieResponseParser.DatumFormaat, CultureInfo.InvariantCulture);

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
