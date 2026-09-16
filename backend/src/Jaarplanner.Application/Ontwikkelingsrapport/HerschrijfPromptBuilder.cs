using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// What the AI is told when a teacher asks it to rewrite one text of an ontwikkelingsrapport (FB-004, R21, ADR-0035
/// §3.5). A pure function of its input, like <c>WoordwebPromptBuilder</c>: no clock, no configuration, no I/O, so the
/// prompt is snapshot-testable.
/// <para>
/// <b>The prompt carries that one text and nothing else</b> (Art. IV.4, R21): no rapportdoel title, no gradatie, no
/// subdoelen, no other child and no earlier report. The names of the klas's children are already out of it
/// (<see cref="Naamvervanging"/>); what the model sees are placeholders.
/// </para>
/// <para>
/// <b>It rewrites, it does not write.</b> The model is told to keep the meaning and add no facts, so a teacher never
/// gets a sentence about a child that nobody wrote (Art. IV.1: she decides, and she can only decide about her own
/// meaning).
/// </para>
/// </summary>
public static class HerschrijfPromptBuilder
{
    // Explicit '\n' so the prompt is identical on Windows and Linux CI.
    private const string Nl = "\n";

    /// <summary>The fixed instructions: the model's role, its limits and the JSON contract (Art. IV.1, IV.4, IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je herschrijft één tekst die een leerkracht van een Vlaamse basisschool schreef in het ontwikkelingsrapport " +
        "van een kleuter. Ouders lezen die tekst." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Behoud de betekenis volledig. Voeg niets toe: geen feit, geen oordeel en geen voorbeeld dat er niet staat, " +
        "en laat niets weg." + Nl +
        "- Schrijf verzorgd, warm en helder Nederlands, in de toon van een rapport voor ouders." + Nl +
        "- Blijf ongeveer even lang als de oorspronkelijke tekst." + Nl +
        "- De tekst bevat plaatshouders van de vorm #NAAM1#. Laat elke plaatshouder onveranderd staan. Verzin er geen " +
        "bij en laat er geen weg." + Nl +
        "- Noem geen naam van een kind, van een leerkracht of van een ouder." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact deze vorm, zonder tekst eromheen:" + Nl +
        "  {\"tekst\": \"<de herschreven tekst>\"}";

    /// <summary>Builds the request for one masked text.</summary>
    /// <param name="gemaskeerdeTekst">The teacher's text with the klas's names already replaced.</param>
    public static AiRequest Bouw(string gemaskeerdeTekst)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(gemaskeerdeTekst);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            // No heading and no label: a heading would be a second thing in the prompt, and R21 allows one.
            UserPrompt = gemaskeerdeTekst,
        };
    }
}
