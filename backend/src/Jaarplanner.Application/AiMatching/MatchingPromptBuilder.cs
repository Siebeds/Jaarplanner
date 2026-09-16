using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// Builds the grounded matching prompt (E2-02) that <see cref="DoelMatchingService"/> hands to the
/// injectable <see cref="IAiClient"/> (E2-01). It turns a school <see cref="Thema"/> (with its
/// themadoelen/subthema's/activiteiten) plus the relevant, already-loaded Op.stap leerplandoelen
/// (and, optionally, their concorded minimumdoelen) into an <see cref="AiRequest"/>.
/// <para>
/// <b>Stable part first</b> (TB-043). The request is the fixed <see cref="SystemPrompt"/>, then the candidate goal list
/// as <see cref="AiRequest.VasteContext"/>, then the thema as <see cref="AiRequest.UserPrompt"/>. The first two depend
/// only on the candidates, so two thema's whose subthema's share a leeftijd send a byte-identical prefix that the
/// provider can serve from its cache. The codes the thema already links, or that were rejected on it, are named in the
/// user prompt as "niet voorstellen" and never taken out of the list, which would make the list differ per thema.
/// </para>
/// <para>
/// <b>Grounded only on school + Op.stap data (Art. IV.4).</b> Every line of the stable context and the user prompt is
/// rendered <b>exclusively</b> from the arguments (the school's own content and the loaded Op.stap goals), and the
/// system prompt explicitly forbids external knowledge, invented codes and invented examples. Nothing else is read: no
/// clock, no environment, no configuration, no I/O.
/// </para>
/// <para>
/// The builder is a <b>pure, deterministic</b> function of its inputs: given the same thema and the
/// same set of leerplandoelen it produces byte-for-byte the same prompt (leerplandoelen, minimumdoelen and excluded
/// codes are ordered by their stable key so caller ordering cannot leak in), which is what
/// makes it snapshot-testable. It only constructs the prompt; requesting the model, validating the
/// structured-JSON response (E2-03) and persisting suggestions as <c>DoelKoppeling</c> (E2-04) are
/// separate stories.
/// </para>
/// </summary>
public static class MatchingPromptBuilder
{
    /// <summary>
    /// The most suggestions one run asks for (TB-043). The number comes from the TB-004 evaluation's variant and may be
    /// adjusted by its measurement.
    /// </summary>
    public const int MaxSuggesties = 8;

    /// <summary>The rule that sets <see cref="MaxSuggesties"/>, word for word as <see cref="SystemPrompt"/> carries it.</summary>
    public const string MaxSuggestiesRegel =
        "- Stel hoogstens 8 leerplandoelen voor, het best passende eerst. Minder mag.";

    /// <summary>The heading of the user prompt's section with the codes the model must not propose.</summary>
    public const string NietVoorstellenKop = "# Niet voorstellen";

    // Explicit '\n' newlines everywhere so the built prompt is identical on Windows and Linux CI,
    // keeping the snapshot stable across platforms.
    private const string Nl = "\n";

    /// <summary>
    /// The fixed instruction scaffolding (the model's role + the grounding rules of Art. IV.4/IV.1/
    /// IV.3/IV.5). This is the <b>only</b> non-data text in the request; it carries no school or
    /// curriculum specifics itself.
    /// </summary>
    public const string SystemPrompt =
        "Je bent een assistent die een leerkracht helpt om Op.stap-leerplandoelen te koppelen aan " +
        "de eigen thema's en activiteiten van de school." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in deze aanvraag: de lijst \"Beschikbare Op.stap-leerplandoelen\" " +
        "hieronder, en de schoolcontent (thema, themadoelen, subthema's, activiteiten) in het bericht van de " +
        "gebruiker." + Nl +
        "- Gebruik geen externe kennis, geen internet en geen andere bronnen. Verzin geen " +
        "leerplandoelen, codes, voorbeelden of woordenschat." + Nl +
        "- Stel enkel leerplandoelen voor waarvan de code letterlijk voorkomt in de lijst " +
        "\"Beschikbare Op.stap-leerplandoelen\" hieronder." + Nl +
        "- Stel geen leerplandoel voor waarvan de code in het bericht van de gebruiker onder " +
        "\"Niet voorstellen\" staat." + Nl +
        MaxSuggestiesRegel + Nl +
        "- Geef bij elk voorstel een motivatie van één korte zin in het Nederlands (\"waarom past dit doel " +
        "hier?\")." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist. Pas niets automatisch toe." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder extra tekst of uitleg " +
        "eromheen:" + Nl +
        "  {\"suggesties\": [{\"code\": \"<leerplandoelcode>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Gebruik exact de veldnamen \"suggesties\", \"code\" en \"motivatie\". \"code\" is een " +
        "leerplandoelcode uit de lijst \"Beschikbare Op.stap-leerplandoelen\"; \"motivatie\" is één zin." + Nl +
        "- Vind je geen enkel passend doel, antwoord dan met een lege lijst: {\"suggesties\": []}.";

    /// <summary>
    /// Builds the grounded <see cref="AiRequest"/> for matching the given <paramref name="thema"/>
    /// against the given candidate <paramref name="leerdoelen"/>.
    /// </summary>
    /// <param name="thema">The school thema whose themadoelen/subthema's/activiteiten need goal matches.</param>
    /// <param name="leerdoelen">The relevant, already-loaded Op.stap leerplandoelen to choose from.</param>
    /// <param name="minimumdoelen">
    /// Optional minimumdoelen (Op.stap data), written as a section of their own after the goal list in the stable
    /// context; defaults to none, which is what the matching service passes. The compact goal list (TB-007) does not
    /// name each goal's <c>minimumdoelRef</c>, so the section is context only and is not tied to the listed goals.
    /// </param>
    /// <returns>The grounded request (system prompt, stable goal list, thema), ready for <see cref="IAiClient"/>.</returns>
    public static AiRequest Bouw(
        Thema thema,
        IReadOnlyCollection<Leerplandoel> leerdoelen,
        IReadOnlyCollection<Minimumdoel>? minimumdoelen = null)
    {
        ArgumentNullException.ThrowIfNull(thema);
        ArgumentNullException.ThrowIfNull(leerdoelen);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            VasteContext = BouwVasteContext(leerdoelen, minimumdoelen ?? []),
            UserPrompt = BouwUserPrompt(thema),
        };
    }

    // The stable part: a function of the candidates alone (TB-043).
    private static string BouwVasteContext(
        IReadOnlyCollection<Leerplandoel> leerdoelen,
        IReadOnlyCollection<Minimumdoel> minimumdoelen)
    {
        var sb = new StringBuilder(LeerplandoelPromptlijst.Bouw(leerdoelen));

        if (minimumdoelen.Count > 0)
        {
            sb.Append(Nl);
            SchrijfMinimumdoelen(sb, minimumdoelen);
        }

        return sb.ToString();
    }

    private static string BouwUserPrompt(Thema thema)
    {
        var sb = new StringBuilder();

        SchrijfSchoolcontent(sb, thema);
        SchrijfNietVoorstellen(sb, thema);

        return sb.ToString();
    }

    private static void SchrijfSchoolcontent(StringBuilder sb, Thema thema)
    {
        Line(sb, "# Schoolcontent");
        Line(sb, string.Empty);
        Line(sb, $"## Thema: {thema.Naam}");
        Line(sb, $"Duur (weken): {thema.DuurWeken}");
        if (thema.Invalshoeken is not null)
        {
            Line(sb, $"Invalshoeken: {thema.Invalshoeken}");
        }

        if (thema.Kernwoordenschat.Count > 0)
        {
            Line(sb, $"Kernwoordenschat: {string.Join(", ", thema.Kernwoordenschat)}");
        }

        if (thema.RijkeWoordenschat.Count > 0)
        {
            Line(sb, $"Rijke woordenschat: {string.Join(", ", thema.RijkeWoordenschat)}");
        }

        Line(sb, string.Empty);
        Line(sb, "### Themadoelen (reeds gekoppelde leerplandoelen)");
        if (thema.Themadoelen.Count == 0)
        {
            Line(sb, "- (nog geen)");
        }
        else
        {
            foreach (var themadoel in thema.Themadoelen)
            {
                Line(sb, $"- {BeschrijfKoppeling(themadoel.Koppeling)}");
            }
        }

        Line(sb, string.Empty);
        Line(sb, "### Subthema's");
        if (thema.Subthemas.Count == 0)
        {
            Line(sb, "- (nog geen)");
            return;
        }

        foreach (var subthema in thema.Subthemas)
        {
            SchrijfSubthema(sb, subthema);
        }
    }

    private static void SchrijfSubthema(StringBuilder sb, Subthema subthema)
    {
        Line(sb, $"- Subthema: {subthema.Naam} (leeftijd {subthema.Leeftijd}, duur {subthema.DuurWeken} wk)");
        var nummer = 1;
        foreach (var ov in subthema.Onderzoeksvragen)
        {
            if (subthema.Onderzoeksvragen.Count > 1)
            {
                Line(sb, $"  Onderzoeksvraag {nummer++}: {ov.Vraag}");
            }
            else
            {
                Line(sb, $"  Onderzoeksvraag: {ov.Vraag}");
            }

            if (ov.Probleemstelling is not null)
            {
                Line(sb, $"  Probleemstelling: {ov.Probleemstelling}");
            }
        }

        // Shared activiteiten only: an own activiteit is one gebruiker's content, not the thema's (ADR-0049 D9).
        var gedeeld = subthema.Activiteiten.Where(a => !a.IsEigen).ToList();
        if (gedeeld.Count > 0)
        {
            Line(sb, "  Activiteiten:");
            foreach (var activiteit in gedeeld)
            {
                SchrijfActiviteit(sb, activiteit);
            }
        }
    }

    private static void SchrijfActiviteit(StringBuilder sb, Activiteit activiteit)
    {
        // No soort, no brackets: an empty "()" would read as a soort the model has to guess at (FB-050).
        Line(sb, activiteit.ActiviteitType is { } type
            ? $"  - {activiteit.Naam} ({type.ToCode()})"
            : $"  - {activiteit.Naam}");
        if (activiteit.Hoek is not null)
        {
            Line(sb, $"    Hoek: {activiteit.Hoek}");
        }

        if (activiteit.VerwachteUitkomsten is not null)
        {
            Line(sb, $"    Verwachte uitkomsten: {activiteit.VerwachteUitkomsten}");
        }
    }

    // The codes this thema already links (a themadoel, or a doelsuggestie of any status, the rejected ones included),
    // which the model is told not to propose (TB-043). They stay in the goal list, which must not differ per thema; the
    // duplicate check in DoelMatchingService remains the safety net. Without such codes the section is left out.
    private static void SchrijfNietVoorstellen(StringBuilder sb, Thema thema)
    {
        var codes = thema.Themadoelen.Select(td => td.Koppeling.LeerplandoelCode)
            .Concat(thema.Doelsuggesties.Select(k => k.LeerplandoelCode))
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Select(c => c.Trim())
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();
        if (codes.Count == 0)
        {
            return;
        }

        Line(sb, string.Empty);
        Line(sb, NietVoorstellenKop);
        Line(sb, string.Empty);
        Line(sb, $"Al gekoppeld of geweigerd: {string.Join(", ", codes)}");
    }

    private static void SchrijfMinimumdoelen(StringBuilder sb, IReadOnlyCollection<Minimumdoel> minimumdoelen)
    {
        Line(sb, "# Minimumdoelen (concordantie)");
        Line(sb, string.Empty);

        // Order by the stable ref so the prompt is identical regardless of caller ordering.
        foreach (var md in minimumdoelen.OrderBy(m => m.Ref, StringComparer.Ordinal))
        {
            Line(sb, $"- {md.Ref}: {md.Omschrijving}");
        }
    }

    private static string BeschrijfKoppeling(DoelKoppeling koppeling)
    {
        var regel = $"{koppeling.LeerplandoelCode} (status {koppeling.Status})";
        return koppeling.AiMotivatie is null
            ? regel
            : $"{regel} — {koppeling.AiMotivatie}";
    }

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
