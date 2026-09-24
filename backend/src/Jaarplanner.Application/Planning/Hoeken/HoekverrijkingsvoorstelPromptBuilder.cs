using System.Text;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Planning.Hoeken;

/// <summary>
/// What the AI is told about one hoek and one subthema (FB-028, ADR-0070). Only the school's own data and loaded goals:
/// the thema and subthema with their onderzoeksvragen, the texts of the subthema's decided subdoelen, the corner's name
/// and description, what it holds now, and what the klas rejected. No gebruiker, no klas name and no pupil data.
/// </summary>
/// <param name="ThemaNaam">The thema the subthema hangs under.</param>
/// <param name="SubthemaNaam">The subthema.</param>
/// <param name="Leeftijd">The subthema's jaar/fase code (JK, K2, K3, L1 to L6).</param>
/// <param name="Onderzoeksvragen">The subthema's onderzoeksvragen.</param>
/// <param name="Subdoelen">The texts of its decided subdoelen, without codes: the proposal links no goal.</param>
/// <param name="HoekNaam">The corner.</param>
/// <param name="HoekOmschrijving">What the corner permanently holds, when described.</param>
/// <param name="HuidigeVerrijking">What the corner holds for this subthema now, when anything.</param>
/// <param name="Geweigerd">Texts the klas rejected for this corner and subthema, which the AI must not propose again.</param>
public sealed record HoekverrijkingsvoorstelContext(
    string ThemaNaam,
    string SubthemaNaam,
    string Leeftijd,
    IReadOnlyList<string> Onderzoeksvragen,
    IReadOnlyList<string> Subdoelen,
    string HoekNaam,
    string? HoekOmschrijving,
    string? HuidigeVerrijking,
    IReadOnlyList<string> Geweigerd);

/// <summary>
/// Builds the hoekverrijking request for <see cref="IAiClient"/> (FB-028). A pure function of its input, so it is
/// snapshot-testable and reads no clock, configuration or I/O.
/// <para>
/// <b>An Art. IV.4 exception</b> (owner, 2026-09-24, ADR-0070): the text of a verrijking comes from the model's own
/// knowledge of what goes in a kleuter's corner. It names no goal and no code, and the klas decides it.
/// </para>
/// </summary>
public static class HoekverrijkingsvoorstelPromptBuilder
{
    // Explicit '\n' so the prompt is identical on Windows and Linux CI.
    private const string Nl = "\n";

    /// <summary>The fixed instructions: the model's role, its limits and the JSON contract (Art. IV.1, IV.3, IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je helpt een leerkracht van een Vlaamse basisschool een hoek van haar klas te verrijken tijdens een subthema. " +
        "Een hoek is een vaste plek in de klas (de boekenhoek, de bouwhoek, de zandtafel). Een verrijking is wat ze er " +
        "voor dit subthema bij legt of in verandert: materiaal, boeken, voorwerpen, een opstelling, een uitdaging." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Stel één verrijking voor deze ene hoek voor, in het Nederlands." + Nl +
        "- Hou ze kort en concreet, zoals een leerkracht het op een fiche noteert: wat er in de hoek komt te liggen of " +
        "te gebeuren, in één korte zin of een korte opsomming, samen hoogstens 200 tekens. Schrijf geen les uit." + Nl +
        $"- Hoogstens {Hoekverrijkingsvoorstel.MaxTekstlengte} tekens." + Nl +
        "- Laat ze passen bij het subthema, zijn onderzoeksvragen en subdoelen, bij de leeftijd en bij wat de hoek is." + Nl +
        "- Herhaal de huidige verrijking niet en stel geen geweigerde verrijking opnieuw voor." + Nl +
        "- Geef een korte motivatie in het Nederlands, één korte zin: waarom past dit hier?" + Nl +
        "- Noem geen leerplandoelen, codes of uitspraken over het leerplan." + Nl +
        "- Noem geen personen en geen kinderen." + Nl +
        "- Je stelt enkel voor; de leerkracht beslist." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"verrijking\": \"<tekst>\", \"motivatie\": \"<één zin>\"}" + Nl +
        "- Vind je niets passends, antwoord dan met: {\"verrijking\": null, \"motivatie\": null}.";

    /// <summary>Builds the request for one hoek and one subthema.</summary>
    public static AiRequest Bouw(HoekverrijkingsvoorstelContext context)
    {
        ArgumentNullException.ThrowIfNull(context);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            UserPrompt = BouwUserPrompt(context),
        };
    }

    private static string BouwUserPrompt(HoekverrijkingsvoorstelContext context)
    {
        var sb = new StringBuilder();

        Line(sb, "# Hoek");
        Line(sb, $"Naam: {context.HoekNaam}");
        if (!string.IsNullOrWhiteSpace(context.HoekOmschrijving))
        {
            Line(sb, $"Omschrijving: {context.HoekOmschrijving}");
        }

        Line(sb, string.Empty);
        Line(sb, "# Subthema");
        Line(sb, $"Naam: {context.SubthemaNaam}");
        Line(sb, $"Thema: {context.ThemaNaam}");
        Line(sb, $"Leeftijd: {context.Leeftijd}");
        Lijst(sb, "# Onderzoeksvragen", context.Onderzoeksvragen);
        Lijst(sb, "# Subdoelen", context.Subdoelen);

        Line(sb, string.Empty);
        Line(sb, "# Huidige verrijking van deze hoek voor dit subthema");
        Line(sb, string.IsNullOrWhiteSpace(context.HuidigeVerrijking) ? "(geen)" : context.HuidigeVerrijking);

        Lijst(sb, "# Geweigerd: niet opnieuw voorstellen", context.Geweigerd);

        return sb.ToString();
    }

    private static void Lijst(StringBuilder sb, string kop, IReadOnlyList<string> regels)
    {
        Line(sb, string.Empty);
        Line(sb, kop);
        if (regels.Count == 0)
        {
            Line(sb, "- (geen)");
            return;
        }

        foreach (var regel in regels)
        {
            Line(sb, $"- {regel}");
        }
    }

    private static void Line(StringBuilder sb, string text) => sb.Append(text).Append(Nl);
}
