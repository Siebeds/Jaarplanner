using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// Builds the grounded prompts for the goal-first authoring assist (E2-07, Art. IV.8): the
/// <b>step 2</b> hook (candidate leerplandoelen to anchor a whole thema as its 2–3 themadoelen) and
/// the <b>step 6</b> hook (age-differentiated candidate leerplandoelen for a <c>(subthema × leeftijd)</c>
/// as subdoelen). It is the authoring sibling of <c>MatchingPromptBuilder</c> (E2-02) — a separate
/// file with its own prompts, deliberately not sharing that whole-thema matching prompt.
/// <para>
/// <b>Grounded only on school + Op.stap data (Art. IV.4).</b> Every user-prompt line is rendered
/// exclusively from the arguments — the wizard's transient thema/subthema context and the loaded
/// Op.stap leerplandoelen. The system prompt forbids external knowledge and invented codes, and asks
/// for the <b>same structured-JSON contract the E2-03 parser accepts</b>
/// (<c>{"suggesties":[{"code","motivatie"}]}</c>) so the authoring flow can reuse that parser.
/// </para>
/// <para>
/// The builder is a <b>pure, deterministic</b> function of its inputs: leerplandoelen are ordered by
/// their stable code so caller ordering cannot leak in, and nothing else is read (no clock, config or
/// I/O). That makes it snapshot-testable.
/// </para>
/// </summary>
public static class ThemaOpbouwPromptBuilder
{
    // Explicit '\n' newlines everywhere so the built prompt is identical on Windows and Linux CI.
    private const string Nl = "\n";

    private const string GemeenschappelijkeRegels =
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in dit bericht: de schoolcontext en de opgegeven " +
        "Op.stap-leerplandoelen. Gebruik geen externe kennis, geen internet en geen andere bronnen." + Nl +
        "- Verzin geen leerplandoelen, codes of voorbeelden. Stel enkel leerplandoelen voor waarvan de " +
        "code letterlijk voorkomt in de lijst \"Beschikbare Op.stap-leerplandoelen\" hieronder." + Nl +
        "- Geef bij elk voorstel een korte motivatie in het Nederlands (\"waarom past dit doel hier?\")." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist. Pas niets automatisch toe." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder extra tekst eromheen:" + Nl +
        "  {\"suggesties\": [{\"code\": \"<leerplandoelcode>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Gebruik exact de veldnamen \"suggesties\", \"code\" en \"motivatie\"." + Nl +
        "- Vind je geen enkel passend doel, antwoord dan met een lege lijst: {\"suggesties\": []}.";

    /// <summary>
    /// The step 2 system prompt: propose candidate leerplandoelen to become the 2–3 overarching,
    /// school-wide themadoelen that anchor the whole thema (Art. IX.2, IV.8). Fixed scaffolding — no
    /// school or curriculum specifics of its own.
    /// </summary>
    public const string SystemPromptThemadoelen =
        "Je bent een assistent die een leerkracht helpt bij de opbouw van een kennisrijk thema, stap 2: " +
        "het kiezen van 2 à 3 overkoepelende themadoelen voor het hele thema." + Nl +
        "Themadoelen zijn schoolbreed gelijk en worden doorheen het thema verbreed, verdiept en herhaald." + Nl +
        Nl +
        GemeenschappelijkeRegels;

    /// <summary>
    /// The step 6 system prompt: propose age-differentiated candidate leerplandoelen for a single
    /// <c>(subthema × leeftijd)</c> as subdoelen that build up toward the thema's themadoelen
    /// (Art. IX.2, IV.8). Fixed scaffolding — no school or curriculum specifics of its own.
    /// </summary>
    public const string SystemPromptSubdoelen =
        "Je bent een assistent die een leerkracht helpt bij de opbouw van een kennisrijk thema, stap 6: " +
        "het kiezen van concrete, leeftijdsgedifferentieerde subdoelen voor één subthema en leeftijd." + Nl +
        "Subdoelen zijn interdisciplinair en bouwen op richting de themadoelen van het thema." + Nl +
        Nl +
        GemeenschappelijkeRegels;

    /// <summary>
    /// Builds the grounded step-2 request: candidate themadoelen for the whole thema from
    /// <paramref name="thema"/> and the loaded <paramref name="leerdoelen"/>.
    /// </summary>
    public static AiRequest BouwThemadoelRequest(
        ThemaOpbouwContext thema,
        IReadOnlyCollection<Leerplandoel> leerdoelen)
    {
        ArgumentNullException.ThrowIfNull(thema);
        ArgumentNullException.ThrowIfNull(leerdoelen);

        var sb = new StringBuilder();
        SchrijfThema(sb, thema);
        sb.Append(Nl);
        SchrijfLeerplandoelen(sb, leerdoelen);

        return new AiRequest { SystemPrompt = SystemPromptThemadoelen, UserPrompt = sb.ToString() };
    }

    /// <summary>
    /// Builds the grounded step-6 request: candidate subdoelen for the given <paramref name="subthema"/>
    /// (with its <paramref name="thema"/> context and the loaded <paramref name="leerdoelen"/>).
    /// </summary>
    public static AiRequest BouwSubdoelRequest(
        ThemaOpbouwContext thema,
        SubthemaOpbouwContext subthema,
        IReadOnlyCollection<Leerplandoel> leerdoelen)
    {
        ArgumentNullException.ThrowIfNull(thema);
        ArgumentNullException.ThrowIfNull(subthema);
        ArgumentNullException.ThrowIfNull(leerdoelen);

        var sb = new StringBuilder();
        SchrijfThema(sb, thema);
        sb.Append(Nl);
        SchrijfSubthema(sb, subthema);
        sb.Append(Nl);
        SchrijfLeerplandoelen(sb, leerdoelen);

        return new AiRequest { SystemPrompt = SystemPromptSubdoelen, UserPrompt = sb.ToString() };
    }

    private static void SchrijfThema(StringBuilder sb, ThemaOpbouwContext thema)
    {
        Line(sb, "# Thema (in opbouw)");
        Line(sb, string.Empty);
        Line(sb, $"## Thema: {thema.Naam}");
        if (thema.DuurWeken is { } duur)
        {
            Line(sb, $"Duur (weken): {duur}");
        }

        if (!string.IsNullOrWhiteSpace(thema.Invalshoeken))
        {
            Line(sb, $"Invalshoeken: {thema.Invalshoeken}");
        }

        SchrijfWoordenlijst(sb, "Kernwoordenschat", thema.Kernwoordenschat);
        SchrijfWoordenlijst(sb, "Rijke woordenschat", thema.RijkeWoordenschat);

        var gekozen = Genormaliseerd(thema.GekozenThemadoelCodes);
        if (gekozen.Count > 0)
        {
            Line(sb, $"Reeds gekozen themadoelen: {string.Join(", ", gekozen)}");
        }
    }

    private static void SchrijfSubthema(StringBuilder sb, SubthemaOpbouwContext subthema)
    {
        Line(sb, "# Subthema (in opbouw)");
        Line(sb, string.Empty);
        Line(sb, $"## Subthema: {subthema.Naam} (leeftijd {subthema.Leeftijd})");
        if (subthema.DuurWeken is { } duur)
        {
            Line(sb, $"Duur (weken): {duur}");
        }

        var ovLijst = subthema.Onderzoeksvragen is { Count: > 0 } lijst
            ? lijst
            : BuildLegacyOnderzoeksvragen(subthema);

        var nummer = 1;
        foreach (var ov in ovLijst)
        {
            if (ovLijst.Count > 1)
            {
                Line(sb, $"Onderzoeksvraag {nummer++}: {ov.Vraag}");
            }
            else
            {
                Line(sb, $"Onderzoeksvraag: {ov.Vraag}");
            }

            if (!string.IsNullOrWhiteSpace(ov.Probleemstelling))
            {
                Line(sb, $"Probleemstelling: {ov.Probleemstelling}");
            }
        }

        var activiteiten = (subthema.Activiteiten ?? [])
            .Where(a => a is not null && !string.IsNullOrWhiteSpace(a.Naam))
            .ToList();
        if (activiteiten.Count > 0)
        {
            Line(sb, "Activiteiten:");
            foreach (var activiteit in activiteiten)
            {
                SchrijfActiviteit(sb, activiteit);
            }
        }
    }

    /// <summary>Adapts the legacy single Probleemstelling/Onderzoeksvraag fields to the multi-ov list shape.</summary>
    private static IReadOnlyList<OnderzoeksvraagOpbouwContext> BuildLegacyOnderzoeksvragen(SubthemaOpbouwContext subthema)
    {
        if (!string.IsNullOrWhiteSpace(subthema.Onderzoeksvraag))
        {
            return [new OnderzoeksvraagOpbouwContext { Vraag = subthema.Onderzoeksvraag, Probleemstelling = subthema.Probleemstelling }];
        }

        return [];
    }

    private static void SchrijfActiviteit(StringBuilder sb, ActiviteitOpbouwContext activiteit)
    {
        var kop = string.IsNullOrWhiteSpace(activiteit.Type)
            ? $"- {activiteit.Naam.Trim()}"
            : $"- {activiteit.Naam.Trim()} ({activiteit.Type!.Trim()})";
        Line(sb, kop);
        if (!string.IsNullOrWhiteSpace(activiteit.Hoek))
        {
            Line(sb, $"  Hoek: {activiteit.Hoek}");
        }

        if (!string.IsNullOrWhiteSpace(activiteit.VerwachteUitkomsten))
        {
            Line(sb, $"  Verwachte uitkomsten: {activiteit.VerwachteUitkomsten}");
        }
    }

    private static void SchrijfLeerplandoelen(StringBuilder sb, IReadOnlyCollection<Leerplandoel> leerdoelen)
    {
        Line(sb, "# Beschikbare Op.stap-leerplandoelen");
        Line(sb, string.Empty);
        if (leerdoelen.Count == 0)
        {
            Line(sb, "- (geen leerplandoelen aangeleverd)");
            return;
        }

        // Order by the stable code so the prompt is identical regardless of caller ordering.
        foreach (var doel in leerdoelen.OrderBy(d => d.Code, StringComparer.Ordinal))
        {
            SchrijfLeerplandoel(sb, doel);
        }
    }

    private static void SchrijfLeerplandoel(StringBuilder sb, Leerplandoel doel)
    {
        var taxonomie = doel.Cluster is null
            ? $"{doel.Domein} > {doel.Subdomein}"
            : $"{doel.Domein} > {doel.Subdomein} > {doel.Cluster}";
        Line(sb, $"- {doel.Code} | {doel.Doelsoort.ToCode()} | {doel.JaarFase} | {taxonomie}");
        Line(sb, $"  Tekst: {doel.Tekst}");
        if (doel.Voorbeelden is not null)
        {
            Line(sb, $"  Voorbeelden: {doel.Voorbeelden}");
        }

        if (doel.Toelichting is not null)
        {
            Line(sb, $"  Toelichting: {doel.Toelichting}");
        }

        if (doel.Woordenschat is not null)
        {
            Line(sb, $"  Woordenschat: {doel.Woordenschat}");
        }

        if (doel.MinimumdoelRef is not null)
        {
            Line(sb, $"  Minimumdoel: {doel.MinimumdoelRef}");
        }
    }

    private static void SchrijfWoordenlijst(StringBuilder sb, string label, IReadOnlyCollection<string>? woorden)
    {
        var lijst = Genormaliseerd(woorden);
        if (lijst.Count > 0)
        {
            Line(sb, $"{label}: {string.Join(", ", lijst)}");
        }
    }

    private static List<string> Genormaliseerd(IReadOnlyCollection<string>? woorden) =>
        (woorden ?? [])
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim())
            .ToList();

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
