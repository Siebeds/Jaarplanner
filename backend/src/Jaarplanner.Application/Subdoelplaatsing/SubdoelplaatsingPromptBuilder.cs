using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Subdoelplaatsing;

/// <summary>A themadoel of the thema, as the prompt names it.</summary>
public sealed record PromptMinimumdoel(string Ref, string Omschrijving);

/// <summary>A subdoel an existing subthema already holds.</summary>
public sealed record PromptSubdoel(string Code, string Tekst);

/// <summary>
/// An existing subthema of the leeftijd, under the short key the model answers with (<c>S1</c>, <c>S2</c>, …), so no
/// database id reaches the prompt and a mistyped id cannot land on another subthema.
/// </summary>
public sealed record PromptSubthema(
    string Sleutel,
    Guid Id,
    string Naam,
    int DuurWeken,
    IReadOnlyList<string> Onderzoeksvragen,
    IReadOnlyList<PromptSubdoel> Subdoelen);

/// <summary>A placement a person rejected earlier: this goal in this existing subthema (ADR-0050 D3).</summary>
public sealed record GeweigerdePlaatsing(string Code, Guid SubthemaId);

/// <summary>
/// What the AI is told for one thema and leeftijd (FB-057, ADR-0050). Only the school's own data and the loaded
/// Op.stap goals: the thema, its minimumdoelen, the subthema's of that leeftijd, the open goals, and what was rejected.
/// No gebruiker and no pupil data.
/// </summary>
public sealed record SubdoelplaatsingContext(
    string ThemaNaam,
    string? Invalshoeken,
    string Leeftijd,
    IReadOnlyList<PromptMinimumdoel> Minimumdoelen,
    IReadOnlyList<PromptSubthema> Subthemas,
    IReadOnlyList<Leerplandoel> OpenDoelen,
    IReadOnlyList<GeweigerdePlaatsing> GeweigerdePlaatsingen,
    IReadOnlyList<string> GeweigerdeNamen);

/// <summary>
/// Builds the subdoelplaatsing request for <see cref="IAiClient"/>. A pure function of its input, like the other
/// builders, so it is snapshot-testable.
/// <para>
/// <b>The second prompt that lets the model use its own knowledge</b> (Art. IV.4, ADR-0050 P5), and only for the name and
/// onderzoeksvraag of a new subthema. Every goal it places must be one of the open goals listed, by its exact code.
/// </para>
/// </summary>
public static class SubdoelplaatsingPromptBuilder
{
    /// <summary>The most new subthema's one request may propose (ADR-0050 D2).</summary>
    public const int MaxNieuweSubthemas = 3;

    /// <summary>The heading of the open goals; the system prompt refers to it.</summary>
    public const string OpenDoelenKop = "# Open leerplandoelen";

    private const string Nl = "\n";

    /// <summary>The fixed instructions: the model's role, its limits and the JSON contract (Art. IV.1, IV.3 to IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je helpt een Vlaamse basisschool (kleuter en lager) om leerplandoelen een plaats te geven in de subthema's van " +
        "een thema. Het thema heeft minimumdoelen als themadoelen; de open leerplandoelen hieronder horen bij die " +
        "minimumdoelen en staan nog in geen enkel subthema van deze leeftijd." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Stel voor elk open leerplandoel dat ergens past één plaats voor: een bestaand subthema (met zijn sleutel S1, " +
        "S2, ...) of een nieuw subthema dat je zelf voorstelt (met een eigen sleutel N1, N2, ...). Een doel dat nergens " +
        "past, laat je weg." + Nl +
        "- Gebruik voor een doel uitsluitend een code die letterlijk voorkomt onder \"" + OpenDoelenKop + "\", en elke " +
        "code hoogstens één keer." + Nl +
        "- Verkies een bestaand subthema als het doel daar inhoudelijk bij past." + Nl +
        $"- Stel hoogstens {MaxNieuweSubthemas} nieuwe subthema's voor, alleen als er doelen zijn die samen een eigen " +
        "subthema verdienen. Geef elk nieuw subthema een korte naam, één onderzoeksvraag voor kinderen van deze " +
        "leeftijd en een lengte van 1 tot 6 weken (meestal 2). Die naam en onderzoeksvraag mag je zelf bedenken." + Nl +
        "- Een nieuw subthema krijgt geen naam die al bestaat of die geweigerd werd." + Nl +
        "- Stel geen plaatsing voor die geweigerd werd." + Nl +
        "- Geef bij elke plaatsing en elk nieuw subthema een korte motivatie in het Nederlands, één zin." + Nl +
        "- Noem geen personen en geen kinderen. Verzin geen leerplandoelen of codes." + Nl +
        "- Je stelt enkel voor; een leerkracht beslist over elk voorstel." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"plaatsingen\": [{\"code\": \"<leerplandoelcode>\", \"subthema\": \"<S1 of N1>\", \"motivatie\": \"<één zin>\"}]," + Nl +
        "   \"nieuweSubthemas\": [{\"sleutel\": \"N1\", \"naam\": \"<naam>\", \"onderzoeksvraag\": \"<vraag>\", " +
        "\"duurWeken\": 2, \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Past niets, antwoord dan met {\"plaatsingen\": [], \"nieuweSubthemas\": []}.";

    /// <summary>Builds the request for one thema and leeftijd.</summary>
    public static AiRequest Bouw(SubdoelplaatsingContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(context),
        };
    }

    private static string BouwUserPrompt(SubdoelplaatsingContext context)
    {
        var sb = new StringBuilder();

        sb.Append("# Thema").Append(Nl);
        sb.Append("Naam: ").Append(context.ThemaNaam).Append(Nl);
        if (!string.IsNullOrWhiteSpace(context.Invalshoeken))
        {
            sb.Append("Invalshoeken: ").Append(context.Invalshoeken).Append(Nl);
        }

        sb.Append("Leeftijd: ").Append(context.Leeftijd).Append(Nl).Append(Nl);

        sb.Append("# Themadoelen (minimumdoelen)").Append(Nl);
        foreach (var md in context.Minimumdoelen.OrderBy(m => m.Ref, StringComparer.Ordinal))
        {
            sb.Append("- ").Append(md.Ref).Append(": ").Append(md.Omschrijving).Append(Nl);
        }

        sb.Append(Nl).Append("# Bestaande subthema's van deze leeftijd").Append(Nl);
        if (context.Subthemas.Count == 0)
        {
            sb.Append("- (geen)").Append(Nl);
        }

        foreach (var subthema in context.Subthemas)
        {
            sb.Append("- ").Append(subthema.Sleutel).Append(": ").Append(subthema.Naam)
                .Append(" (").Append(subthema.DuurWeken).Append(" weken)").Append(Nl);
            foreach (var vraag in subthema.Onderzoeksvragen)
            {
                sb.Append("  Onderzoeksvraag: ").Append(vraag).Append(Nl);
            }

            foreach (var doel in subthema.Subdoelen.OrderBy(d => d.Code, StringComparer.Ordinal))
            {
                sb.Append("  Subdoel: ").Append(doel.Code).Append(" | ").Append(doel.Tekst).Append(Nl);
            }
        }

        sb.Append(Nl).Append(OpenDoelenKop).Append(Nl).Append(Nl);
        foreach (var doel in context.OpenDoelen.OrderBy(d => d.Code, StringComparer.Ordinal))
        {
            sb.Append("- ").Append(doel.Code).Append(" | ").Append(doel.Domein).Append(" > ").Append(doel.Subdomein).Append(Nl);
            sb.Append("  Tekst: ").Append(doel.Tekst).Append(Nl);
        }

        var sleutels = context.Subthemas.ToDictionary(s => s.Id, s => s.Sleutel);
        var geweigerd = context.GeweigerdePlaatsingen
            .Where(g => sleutels.ContainsKey(g.SubthemaId))
            .Select(g => $"{g.Code} in {sleutels[g.SubthemaId]}")
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();
        if (geweigerd.Count > 0)
        {
            sb.Append(Nl).Append("# Geweigerde plaatsingen (niet opnieuw voorstellen)").Append(Nl);
            foreach (var regel in geweigerd)
            {
                sb.Append("- ").Append(regel).Append(Nl);
            }
        }

        var namen = context.GeweigerdeNamen.Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.Ordinal).ToList();
        if (namen.Count > 0)
        {
            sb.Append(Nl).Append("# Geweigerde namen van nieuwe subthema's (niet opnieuw voorstellen)").Append(Nl);
            foreach (var naam in namen)
            {
                sb.Append("- ").Append(naam).Append(Nl);
            }
        }

        return sb.ToString();
    }
}
