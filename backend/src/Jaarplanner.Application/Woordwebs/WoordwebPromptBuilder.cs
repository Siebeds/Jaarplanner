using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Woordwebs;

/// <summary>
/// What the AI is told about one woordweb (FB-036, ADR-0043 W6). Only the school's own data: the subthema's name,
/// leeftijd and onderzoeksvragen, its thema's name and invalshoeken, and the words of this one web. No other web, no
/// gebruiker's name and no pupil data ever reaches it: a woordweb holds none.
/// </summary>
/// <param name="ThemaNaam">The thema the subthema hangs under.</param>
/// <param name="Invalshoeken">The thema's invalshoeken, when it has them.</param>
/// <param name="SubthemaNaam">The subthema.</param>
/// <param name="Leeftijd">The subthema's jaar/fase code (JK, K2, K3, L1 to L6).</param>
/// <param name="Onderzoeksvragen">Each onderzoeksvraag with its probleemstelling, when it has one.</param>
/// <param name="WoordenInWeb">The words that stand in the web (typed or accepted).</param>
/// <param name="OpenVoorstellen">Words proposed earlier that still await a decision.</param>
/// <param name="Geweigerd">Words the teacher rejected, which the AI must not propose again.</param>
public sealed record WoordwebContext(
    string ThemaNaam,
    string? Invalshoeken,
    string SubthemaNaam,
    string Leeftijd,
    IReadOnlyList<(string Vraag, string? Probleemstelling)> Onderzoeksvragen,
    IReadOnlyList<string> WoordenInWeb,
    IReadOnlyList<string> OpenVoorstellen,
    IReadOnlyList<string> Geweigerd);

/// <summary>
/// Builds the woordweb request for <see cref="IAiClient"/> (FB-036). A pure function of its input, like
/// <c>MatchingPromptBuilder</c>, so it is snapshot-testable and reads no clock, configuration or I/O.
/// <para>
/// <b>The one prompt that does not forbid the model's own knowledge</b> (Art. IV.4's woordweb exception, ADR-0043 W6):
/// it asks for words from the model's knowledge of the language, where the goal prompts forbid invented vocabulary.
/// What it may return is narrow all the same: words with a motivation, never a goal, a code or a claim about the
/// curriculum, and the teacher accepts each one by hand.
/// </para>
/// </summary>
public static class WoordwebPromptBuilder
{
    /// <summary>The most words one request proposes (default D1).</summary>
    public const int MaxVoorstellen = 5;

    // Explicit '\n' so the prompt is identical on Windows and Linux CI.
    private const string Nl = "\n";

    /// <summary>The fixed instructions: the model's role, its limits and the JSON contract (Art. IV.1, IV.3, IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je helpt een leerkracht van een Vlaamse basisschool (kleuter en lager) brainstormen over een subthema. Je " +
        "stelt woorden voor voor haar woordweb: losse woorden die bij het subthema passen en die kinderen van die " +
        "leeftijd kunnen leren, gebruiken of onderzoeken." + Nl +
        Nl +
        "Regels:" + Nl +
        $"- Stel hoogstens {MaxVoorstellen} woorden voor." + Nl +
        "- Elk voorstel is één woord of een korte woordgroep van hoogstens drie woorden, in het Nederlands." + Nl +
        "- Stel geen woord voor dat al in het woordweb staat, al voorgesteld is of geweigerd werd." + Nl +
        "- Geef bij elk woord een korte motivatie in het Nederlands, één zin: waarom past dit woord bij dit subthema?" + Nl +
        "- Stel alleen woorden voor; geen leerplandoelen, codes of uitspraken over het leerplan." + Nl +
        "- Noem geen personen en geen kinderen." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist over elk woord." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"woorden\": [{\"woord\": \"<woord>\", \"motivatie\": \"<één zin>\"}]}" + Nl +
        "- Vind je niets passends, antwoord dan met een lege lijst: {\"woorden\": []}.";

    /// <summary>Builds the request for one web.</summary>
    public static AiRequest Bouw(WoordwebContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(context),
        };
    }

    /// <summary>The context of one web, from its subthema and thema.</summary>
    public static WoordwebContext ContextVoor(Woordweb woordweb, Subthema subthema, Thema thema)
    {
        ArgumentNullException.ThrowIfNull(woordweb);
        ArgumentNullException.ThrowIfNull(subthema);
        ArgumentNullException.ThrowIfNull(thema);

        var woorden = woordweb.Woorden.OrderBy(w => w.Volgnummer).ToList();
        return new WoordwebContext(
            thema.Naam,
            thema.Invalshoeken,
            subthema.Naam,
            subthema.Leeftijd,
            subthema.Onderzoeksvragen.Select(ov => (ov.Vraag, ov.Probleemstelling)).ToList(),
            woorden.Where(w => w.StaatInWeb).Select(w => w.Woord).ToList(),
            woorden.Where(w => w.Status == KoppelingStatus.Voorgesteld).Select(w => w.Woord).ToList(),
            woorden.Where(w => w.Status == KoppelingStatus.Geweigerd).Select(w => w.Woord).ToList());
    }

    private static string BouwUserPrompt(WoordwebContext context)
    {
        var sb = new StringBuilder();

        Line(sb, "# Subthema");
        Line(sb, $"Naam: {context.SubthemaNaam}");
        Line(sb, $"Leeftijd: {context.Leeftijd}");
        foreach (var (vraag, probleemstelling) in context.Onderzoeksvragen)
        {
            Line(sb, $"Onderzoeksvraag: {vraag}");
            if (!string.IsNullOrWhiteSpace(probleemstelling))
            {
                Line(sb, $"Probleemstelling: {probleemstelling}");
            }
        }

        Line(sb, string.Empty);
        Line(sb, "# Thema");
        Line(sb, $"Naam: {context.ThemaNaam}");
        if (!string.IsNullOrWhiteSpace(context.Invalshoeken))
        {
            Line(sb, $"Invalshoeken: {context.Invalshoeken}");
        }

        Lijst(sb, "# Woorden in het woordweb", context.WoordenInWeb);
        Lijst(sb, "# Al voorgesteld, nog niet beslist", context.OpenVoorstellen);
        Lijst(sb, "# Geweigerd: niet opnieuw voorstellen", context.Geweigerd);

        return sb.ToString();
    }

    private static void Lijst(StringBuilder sb, string kop, IReadOnlyList<string> woorden)
    {
        Line(sb, string.Empty);
        Line(sb, kop);
        if (woorden.Count == 0)
        {
            Line(sb, "- (geen)");
            return;
        }

        foreach (var woord in woorden)
        {
            Line(sb, $"- {woord}");
        }
    }

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
