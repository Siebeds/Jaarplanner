using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// Builds the grounded prompts for the goal-first authoring assist (E2-07, Art. IV.8): the
/// <b>step 2</b> hook (candidate minimumdoelen to anchor a whole thema as its themadoelen, FB-053) and
/// the <b>step 6</b> hook (age-differentiated candidate leerplandoelen for a <c>(subthema × leeftijd)</c>
/// as subdoelen). It is the authoring sibling of <c>MatchingPromptBuilder</c> (E2-02) — a separate
/// file with its own prompts, deliberately not sharing that whole-thema matching prompt.
/// <para>
/// <b>Stable part first</b> (TB-043): the fixed system prompt, then the candidate list as
/// <see cref="AiRequest.VasteContext"/> (the minimumdoelen at step 2, the leerplandoelen at step 6), then the wizard's
/// thema and subthema as <see cref="AiRequest.UserPrompt"/>, so two requests over the same candidates share a
/// byte-identical, cacheable prefix. What differs per thema, such as the refs already chosen, stays in the user prompt.
/// </para>
/// <para>
/// <b>Grounded only on school + Op.stap data (Art. IV.4).</b> Every line is rendered exclusively from the arguments: the
/// wizard's transient thema/subthema context and the loaded Op.stap goals. The system prompts forbid external knowledge
/// and invented codes, and ask for the <b>same structured-JSON contract the E2-03 parser accepts</b>
/// (<c>{"suggesties":[{"code","motivatie"}]}</c>) so the authoring flow can reuse that parser.
/// </para>
/// <para>
/// The builder is a <b>pure, deterministic</b> function of its inputs: goals and chosen refs are ordered by their stable
/// key so caller ordering cannot leak in, and nothing else is read (no clock, config or I/O). That makes it
/// snapshot-testable.
/// </para>
/// </summary>
public static class ThemaOpbouwPromptBuilder
{
    /// <summary>
    /// The most suggestions one assist asks for (TB-043). The number comes from the TB-004 evaluation's variant and may
    /// be adjusted by its measurement; the eval runner swaps <see cref="MaxSuggestiesRegel"/> for its own ceiling.
    /// </summary>
    public const int MaxSuggesties = 8;

    /// <summary>The step-6 rule that sets <see cref="MaxSuggesties"/>, word for word as its system prompt carries it.</summary>
    public const string MaxSuggestiesRegel =
        "- Stel hoogstens 8 leerplandoelen voor, het best passende eerst. Minder mag.";

    /// <summary>The step-2 rule that sets <see cref="MaxSuggesties"/>, for minimumdoelen (FB-053).</summary>
    public const string MaxMinimumdoelenRegel =
        "- Stel hoogstens 8 minimumdoelen voor, het best passende eerst. Minder mag.";

    // Explicit '\n' newlines everywhere so the built prompt is identical on Windows and Linux CI.
    private const string Nl = "\n";

    private const string AntwoordRegels =
        "- Je stelt enkel voor; een mens beslist. Pas niets automatisch toe." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder extra tekst eromheen:" + Nl;

    private const string SlotRegels =
        "- Gebruik exact de veldnamen \"suggesties\", \"code\" en \"motivatie\"." + Nl +
        "- Vind je geen enkel passend doel, antwoord dan met een lege lijst: {\"suggesties\": []}.";

    /// <summary>
    /// The step 2 system prompt: propose minimumdoelen to become the overarching, school-wide themadoelen that anchor
    /// the whole thema (Art. IX.2, IV.8; FB-053). Fixed scaffolding, no school or curriculum specifics of its own.
    /// </summary>
    public const string SystemPromptThemadoelen =
        "Je bent een assistent die themabeheer helpt bij de opbouw van een kennisrijk thema, stap 2: " +
        "het kiezen van minimumdoelen als overkoepelende themadoelen voor het hele thema." + Nl +
        "Themadoelen zijn schoolbreed gelijk en worden doorheen het thema verbreed, verdiept en herhaald." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in deze aanvraag: de lijst \"Beschikbare minimumdoelen\" en de schoolcontext " +
        "van de gebruiker. Gebruik geen externe kennis, geen internet en geen andere bronnen. Verzin geen doelen of codes." + Nl +
        "- Stel enkel minimumdoelen voor waarvan de code letterlijk in de lijst \"Beschikbare minimumdoelen\" staat." + Nl +
        "- Stel geen minimumdoel voor waarvan de code onder \"Niet voorstellen\" staat." + Nl +
        MaxMinimumdoelenRegel + Nl +
        "- Geef bij elk voorstel een motivatie van één korte zin in het Nederlands (\"waarom past dit doel bij dit thema?\")." + Nl +
        AntwoordRegels +
        "  {\"suggesties\": [{\"code\": \"<code van het minimumdoel>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        SlotRegels;

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
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in deze aanvraag: de lijst \"Beschikbare Op.stap-leerplandoelen\" en de " +
        "schoolcontext van de gebruiker. Gebruik geen externe kennis, geen internet en geen andere bronnen." + Nl +
        "- Verzin geen leerplandoelen, codes of voorbeelden. Stel enkel leerplandoelen voor waarvan de " +
        "code letterlijk voorkomt in de lijst \"Beschikbare Op.stap-leerplandoelen\"." + Nl +
        MaxSuggestiesRegel + Nl +
        "- Geef bij elk voorstel een motivatie van één korte zin in het Nederlands (\"waarom past dit doel hier?\")." + Nl +
        AntwoordRegels +
        "  {\"suggesties\": [{\"code\": \"<leerplandoelcode>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        SlotRegels;

    /// <summary>
    /// Builds the grounded step-2 request (FB-053): candidate minimumdoelen as themadoelen for the whole thema. The
    /// candidate list (<see cref="MinimumdoelPromptlijst"/>) is the stable context; the thema and the refs already
    /// chosen, under "Niet voorstellen", are the user prompt.
    /// </summary>
    public static AiRequest BouwThemadoelRequest(
        ThemaOpbouwContext thema,
        IReadOnlyCollection<Minimumdoel> minimumdoelen)
    {
        ArgumentNullException.ThrowIfNull(thema);
        ArgumentNullException.ThrowIfNull(minimumdoelen);

        var sb = new StringBuilder();
        SchrijfThema(sb, thema, themadoelen: null);
        var gekozen = Gekozen(thema);
        if (gekozen.Count > 0)
        {
            Line(sb, string.Empty);
            Line(sb, "# Niet voorstellen");
            Line(sb, string.Empty);
            Line(sb, $"Al gekozen: {string.Join(", ", gekozen)}");
        }

        return new AiRequest
        {
            SystemPrompt = SystemPromptThemadoelen,
            VasteContext = MinimumdoelPromptlijst.Bouw(minimumdoelen),
            UserPrompt = sb.ToString(),
        };
    }

    /// <summary>
    /// Builds the grounded step-6 request: candidate subdoelen for the given <paramref name="subthema"/>
    /// (with its <paramref name="thema"/> context and the loaded <paramref name="leerdoelen"/>, the stable context). The
    /// thema's chosen minimumdoelen are written with their text from <paramref name="themadoelen"/>, so the subdoelen
    /// build up toward them (FB-053).
    /// </summary>
    public static AiRequest BouwSubdoelRequest(
        ThemaOpbouwContext thema,
        SubthemaOpbouwContext subthema,
        IReadOnlyCollection<Leerplandoel> leerdoelen,
        IReadOnlyCollection<Minimumdoel>? themadoelen = null)
    {
        ArgumentNullException.ThrowIfNull(thema);
        ArgumentNullException.ThrowIfNull(subthema);
        ArgumentNullException.ThrowIfNull(leerdoelen);

        var sb = new StringBuilder();
        SchrijfThema(sb, thema, themadoelen ?? []);
        sb.Append(Nl);
        SchrijfSubthema(sb, subthema);

        return new AiRequest
        {
            SystemPrompt = SystemPromptSubdoelen,
            VasteContext = LeerplandoelPromptlijst.Bouw(leerdoelen),
            UserPrompt = sb.ToString(),
        };
    }

    // `themadoelen` null: step 2, whose chosen refs are the user prompt's "Niet voorstellen" section. Otherwise step 6: the chosen minimumdoelen
    // with their text, or the bare ref for one no loaded minimumdoel carries.
    private static void SchrijfThema(StringBuilder sb, ThemaOpbouwContext thema, IReadOnlyCollection<Minimumdoel>? themadoelen)
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

        if (themadoelen is null)
        {
            return;
        }

        var gekozen = Gekozen(thema);
        if (gekozen.Count == 0)
        {
            return;
        }

        var perRef = themadoelen
            .GroupBy(m => m.Ref, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);
        Line(sb, "Themadoelen (minimumdoelen):");
        foreach (var nr in gekozen)
        {
            Line(sb, perRef.TryGetValue(nr, out var doel) ? $"- {doel.Ref}: {doel.Omschrijving}" : $"- {nr}");
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

    private static void SchrijfWoordenlijst(StringBuilder sb, string label, IReadOnlyCollection<string>? woorden)
    {
        var lijst = Genormaliseerd(woorden);
        if (lijst.Count > 0)
        {
            Line(sb, $"{label}: {string.Join(", ", lijst)}");
        }
    }

    // The chosen themadoel refs, trimmed, once each, in ordinal order so the prompt does not depend on the wizard's order.
    private static List<string> Gekozen(ThemaOpbouwContext thema) =>
        Genormaliseerd(thema.GekozenThemadoelCodes)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(r => r, StringComparer.Ordinal)
            .ToList();

    private static List<string> Genormaliseerd(IReadOnlyCollection<string>? woorden) =>
        (woorden ?? [])
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim())
            .ToList();

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
