using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// Builds the grounded prompt for a thema's doelsuggesties (FB-053, ADR-0049): which minimumdoelen fit the thema as
/// themadoel. <see cref="DoelMatchingService"/> hands it to the injectable <see cref="IAiClient"/>.
/// <para>
/// <b>Stable part first</b> (TB-043). The request is the fixed <see cref="SystemPrompt"/>, then the candidate list
/// (<see cref="MinimumdoelPromptlijst"/>) as <see cref="AiRequest.VasteContext"/>, then the thema as
/// <see cref="AiRequest.UserPrompt"/>. The first two depend only on the candidates, so two thema's whose leeftijden meet
/// the same mijlpalen send a byte-identical prefix the provider can serve from its cache. The refs the thema must not get
/// proposed are named in the user prompt under "Niet voorstellen" and never taken out of the list, which would make the
/// list differ per thema.
/// </para>
/// <para>
/// <b>Grounded only on school + Op.stap data (Art. IV.4).</b> Every line comes from the arguments; nothing else is read
/// (no clock, configuration or I/O). The builder is pure and deterministic: the same thema and candidates give the same
/// bytes, so it is snapshot-testable.
/// </para>
/// </summary>
public static class MatchingPromptBuilder
{
    /// <summary>
    /// The most proposals a run asks for and keeps (TB-043, ADR-0049 D3). The number comes from the TB-004 evaluation's
    /// variant and may be adjusted by its measurement.
    /// </summary>
    public const int MaxSuggesties = 8;

    /// <summary>The rule that sets <see cref="MaxSuggesties"/>, word for word as <see cref="SystemPrompt"/> carries it.</summary>
    public const string MaxSuggestiesRegel =
        "- Stel hoogstens 8 minimumdoelen voor, het best passende eerst. Minder mag.";

    /// <summary>The heading of the user prompt's section with the refs the model must not propose.</summary>
    public const string NietVoorstellenKop = "# Niet voorstellen";

    // Explicit '\n' newlines everywhere so the built prompt is identical on Windows and Linux CI.
    private const string Nl = "\n";

    /// <summary>
    /// The fixed instruction scaffolding: the model's role and the rules of Art. IV.1, IV.3, IV.4 and IV.5. It carries no
    /// school or curriculum specifics.
    /// </summary>
    public const string SystemPrompt =
        "Je bent een assistent die themabeheer van een basisschool helpt om minimumdoelen te kiezen als themadoelen " +
        "van een eigen thema. Een themadoel is een overkoepelend doel dat het hele thema verankert, over alle " +
        "leeftijden heen." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Gebruik uitsluitend de gegevens in deze aanvraag: de lijst \"Beschikbare minimumdoelen\", en het thema met " +
        "zijn subthema's en activiteiten van de gebruiker." + Nl +
        "- Gebruik geen externe kennis, geen internet en geen andere bronnen. Verzin geen doelen of codes." + Nl +
        "- Stel enkel minimumdoelen voor waarvan de code letterlijk in de lijst \"Beschikbare minimumdoelen\" staat." + Nl +
        "- Stel geen minimumdoel voor waarvan de code onder \"Niet voorstellen\" staat." + Nl +
        MaxSuggestiesRegel + Nl +
        "- Geef bij elk voorstel een motivatie van één korte zin in het Nederlands (\"waarom past dit doel bij dit thema?\")." + Nl +
        "- Je stelt enkel voor; een mens beslist. Pas niets automatisch toe." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder extra tekst eromheen:" + Nl +
        "  {\"suggesties\": [{\"code\": \"<code van het minimumdoel>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Gebruik exact de veldnamen \"suggesties\", \"code\" en \"motivatie\"." + Nl +
        "- Past geen enkel doel, antwoord dan met een lege lijst: {\"suggesties\": []}.";

    /// <summary>
    /// Builds the grounded request for <paramref name="thema"/> over the candidate <paramref name="minimumdoelen"/>.
    /// </summary>
    /// <param name="thema">The school thema, with its subthema's, onderzoeksvragen and activiteiten loaded.</param>
    /// <param name="minimumdoelen">The candidates: the minimumdoelen of the mijlpalen the run is for.</param>
    /// <param name="nietVoorstellen">
    /// The refs a run must not propose (a themadoel, an open or a rejected proposal); written in the user prompt.
    /// </param>
    public static AiRequest Bouw(
        Thema thema,
        IReadOnlyCollection<Minimumdoel> minimumdoelen,
        IReadOnlyCollection<string> nietVoorstellen)
    {
        ArgumentNullException.ThrowIfNull(thema);
        ArgumentNullException.ThrowIfNull(minimumdoelen);
        ArgumentNullException.ThrowIfNull(nietVoorstellen);

        var sb = new StringBuilder();
        SchrijfThema(sb, thema);
        SchrijfNietVoorstellen(sb, nietVoorstellen);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            VasteContext = MinimumdoelPromptlijst.Bouw(minimumdoelen),
            UserPrompt = sb.ToString(),
        };
    }

    private static void SchrijfThema(StringBuilder sb, Thema thema)
    {
        Line(sb, $"# Thema: {thema.Naam}");
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
        Line(sb, "## Subthema's");
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
            Line(sb, subthema.Onderzoeksvragen.Count > 1
                ? $"  Onderzoeksvraag {nummer++}: {ov.Vraag}"
                : $"  Onderzoeksvraag: {ov.Vraag}");

            if (ov.Probleemstelling is not null)
            {
                Line(sb, $"  Probleemstelling: {ov.Probleemstelling}");
            }
        }

        if (subthema.Activiteiten.Count > 0)
        {
            Line(sb, "  Activiteiten:");
            foreach (var activiteit in subthema.Activiteiten)
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
        }
    }

    // Omitted when there is nothing to exclude, as TB-043 does for the leerplandoel flows.
    private static void SchrijfNietVoorstellen(StringBuilder sb, IReadOnlyCollection<string> refs)
    {
        var lijst = refs
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Select(r => r.Trim())
            .Distinct(StringComparer.Ordinal)
            .OrderBy(r => r, StringComparer.Ordinal)
            .ToList();
        if (lijst.Count == 0)
        {
            return;
        }

        Line(sb, string.Empty);
        Line(sb, NietVoorstellenKop);
        Line(sb, string.Empty);
        Line(sb, $"Al themadoel, al voorgesteld of geweigerd: {string.Join(", ", lijst)}");
    }

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
