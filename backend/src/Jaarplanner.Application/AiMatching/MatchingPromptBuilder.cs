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
/// <b>Grounded only on school + Op.stap data (Art. IV.4).</b> Every line of the user prompt is
/// rendered <b>exclusively</b> from the arguments — the school's own content and the loaded Op.stap
/// goals — and the system prompt explicitly forbids external knowledge, invented codes and invented
/// examples. Nothing else is read: no clock, no environment, no configuration, no I/O.
/// </para>
/// <para>
/// The builder is a <b>pure, deterministic</b> function of its inputs: given the same thema and the
/// same set of leerplandoelen it produces byte-for-byte the same prompt (leerplandoelen and
/// minimumdoelen are ordered by their stable key so caller ordering cannot leak in), which is what
/// makes it snapshot-testable. It only constructs the prompt; requesting the model, validating the
/// structured-JSON response (E2-03) and persisting suggestions as <c>DoelKoppeling</c> (E2-04) are
/// separate stories.
/// </para>
/// </summary>
public static class MatchingPromptBuilder
{
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
        "- Gebruik uitsluitend de gegevens die in het bericht van de gebruiker staan: de " +
        "schoolcontent (thema, themadoelen, subthema's, activiteiten) en de opgegeven Op.stap-" +
        "leerplandoelen en -minimumdoelen." + Nl +
        "- Gebruik geen externe kennis, geen internet en geen andere bronnen. Verzin geen " +
        "leerplandoelen, codes, voorbeelden of woordenschat." + Nl +
        "- Stel enkel leerplandoelen voor waarvan de code letterlijk voorkomt in de lijst " +
        "\"Beschikbare Op.stap-leerplandoelen\" hieronder." + Nl +
        "- Geef bij elk voorstel een korte motivatie in het Nederlands (\"waarom past dit doel " +
        "hier?\")." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist. Pas niets automatisch toe." + Nl +
        "- Antwoord met gestructureerde JSON (per voorstel: leerplandoelcode + motivatie).";

    /// <summary>
    /// Builds the grounded <see cref="AiRequest"/> for matching the given <paramref name="thema"/>
    /// against the given candidate <paramref name="leerdoelen"/>.
    /// </summary>
    /// <param name="thema">The school thema whose themadoelen/subthema's/activiteiten need goal matches.</param>
    /// <param name="leerdoelen">The relevant, already-loaded Op.stap leerplandoelen to choose from.</param>
    /// <param name="minimumdoelen">
    /// Optional concorded minimumdoelen (Op.stap data) that give the model the eindterm omschrijving
    /// behind a leerplandoel's <c>minimumdoelRef</c>; defaults to none.
    /// </param>
    /// <returns>The grounded request (system + user prompt), ready for <see cref="IAiClient"/>.</returns>
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
            UserPrompt = BouwUserPrompt(thema, leerdoelen, minimumdoelen ?? []),
        };
    }

    private static string BouwUserPrompt(
        Thema thema,
        IReadOnlyCollection<Leerplandoel> leerdoelen,
        IReadOnlyCollection<Minimumdoel> minimumdoelen)
    {
        var sb = new StringBuilder();

        SchrijfSchoolcontent(sb, thema);
        sb.Append(Nl);
        SchrijfLeerplandoelen(sb, leerdoelen);

        if (minimumdoelen.Count > 0)
        {
            sb.Append(Nl);
            SchrijfMinimumdoelen(sb, minimumdoelen);
        }

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
        if (subthema.Probleemstelling is not null)
        {
            Line(sb, $"  Probleemstelling: {subthema.Probleemstelling}");
        }

        if (subthema.Onderzoeksvraag is not null)
        {
            Line(sb, $"  Onderzoeksvraag: {subthema.Onderzoeksvraag}");
        }

        if (subthema.Activiteiten.Count > 0)
        {
            Line(sb, "  Activiteiten:");
            foreach (var activiteit in subthema.Activiteiten)
            {
                SchrijfActiviteit(sb, activiteit);
            }
        }
    }

    private static void SchrijfActiviteit(StringBuilder sb, Activiteit activiteit)
    {
        Line(sb, $"  - {activiteit.Naam} ({activiteit.ActiviteitType.ToCode()})");
        if (activiteit.Hoek is not null)
        {
            Line(sb, $"    Hoek: {activiteit.Hoek}");
        }

        if (activiteit.VerwachteUitkomsten is not null)
        {
            Line(sb, $"    Verwachte uitkomsten: {activiteit.VerwachteUitkomsten}");
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
