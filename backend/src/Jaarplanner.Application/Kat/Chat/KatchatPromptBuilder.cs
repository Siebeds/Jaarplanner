using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// Builds the one request a chat question makes (FB-031, ADR-0066). The model is sent the fixed instructions, the
/// handleiding, the last turns of the conversation and the question as typed (Art. IV.4). Of the school's content it
/// sees only the names and codes an earlier lookup found (FB-093, ADR-0069): it answers a question about the tool from
/// the handleiding, and for a question about the content it only picks the lookup the tool then runs.
/// <para>
/// The system prompt and the handleiding are the stable prefix of every chat request, so a provider can serve them
/// from its cache (TB-043); only the conversation and the question differ. A pure function, snapshot-testable.
/// </para>
/// </summary>
public static class KatchatPromptBuilder
{
    /// <summary>The longest question the chat accepts; the input field stops there.</summary>
    public const int MaxVraagLengte = 500;

    /// <summary>The longest explanation the parser accepts.</summary>
    public const int MaxUitlegLengte = 1500;

    /// <summary>
    /// How many earlier turns of a conversation go along with a question (FB-093, ADR-0069 D1). With the question and the
    /// explanation capped, this keeps the cost of a question bounded.
    /// </summary>
    public const int MaxBeurten = 10;

    private const string Nl = "\n";

    /// <summary>The fixed instructions: the cat's role, its limits and the JSON contract (Art. IV.4, IV.5).</summary>
    public static readonly string SystemPrompt =
        "Je bent Chuck, de kat in Vizier, een webapp waarmee leerkrachten van een Vlaamse katholieke basisschool hun " +
        "jaarplanning maken op de doelen van het leerplan Op.stap. Een gebruiker (een leerkracht of iemand van de " +
        "directie, zonder technische achtergrond) stelt je een vraag. Jij kiest één van drie antwoorden." + Nl +
        Nl +
        "1. \"uitleg\": de vraag gaat over hoe de app werkt (hoe doe ik iets, wat betekent iets, waarom toont de app " +
        "iets). Antwoord dan alleen met wat in de handleiding hieronder staat. Noem de titels van de hoofdstukken " +
        "waarop je antwoord steunt, precies zoals ze in de handleiding staan." + Nl +
        "2. \"opzoeking\": de vraag gaat over de inhoud van de school: welke doelen in een thema zitten, waar een doel " +
        "gebruikt wordt, bij welk subthema een activiteit hoort. Die beantwoord je nooit zelf: je kiest de opzoeking, " +
        "en de app zoekt het antwoord in haar eigen gegevens. De opzoekingen:" + Nl +
        "   - \"doelInThema\" met \"doel\" en \"thema\": zit doel x in thema y?" + Nl +
        "   - \"waarGebruikt\" met \"doel\": waar wordt doel x gebruikt, in welke thema's, subthema's, activiteiten, " +
        "algemene fiches of in welke weken van de agenda?" + Nl +
        "   - \"doelenVanThema\" met \"thema\": welke doelen horen bij thema y?" + Nl +
        "   - \"activiteitInSubthema\" met \"activiteit\" en \"subthema\": zit activiteit a in subthema z?" + Nl +
        "   - \"subthemaVanActiviteit\" met \"activiteit\": bij welk subthema of thema hoort activiteit a?" + Nl +
        "   - \"doelenVanSubthema\" met \"subthema\": welke doelen horen bij subthema z?" + Nl +
        "3. \"onbekend\": de handleiding zegt er niets over, de vraag heeft niets met de app te maken, of het is een " +
        "vraag die geen van de opzoekingen beantwoordt, zoals of een doel gedekt is of hoeveel procent van de doelen " +
        "gedekt is." + Nl +
        Nl +
        "Regels:" + Nl +
        "- Verzin niets. Wat niet in de handleiding staat, weet je niet: kies dan \"onbekend\"." + Nl +
        "- Noem in een uitleg nooit een doel, een doelcode of een feit over het leerplan uit je eigen kennis." + Nl +
        "- Neem bij een opzoeking de woorden van de gebruiker over zoals ze ze schreef: een doelcode, of (een deel " +
        "van) de naam van het doel, het thema, het subthema of de activiteit. Laat woorden als \"doel\", \"thema\" of " +
        "\"activiteit\" en aanhalingstekens weg. Vul alleen de velden in die de opzoeking nodig heeft." + Nl +
        "- De vraag kan verder bouwen op de eerdere beurten van dit gesprek, die vóór de vraag staan. Bij een " +
        "opzoeking staat onder \"gevonden\" welke doelcode en welke namen de app toen vond; dat veld schrijf jij " +
        "nooit. Verwijst de vraag naar iets uit een eerdere beurt (\"en in thema Water?\", \"dat subthema\", \"ze\"), " +
        "vul dan de ontbrekende velden van de opzoeking in met de code of de naam uit die beurt, of antwoord met de " +
        "uitleg waar de vraag op verder bouwt. Weet je niet waarnaar de vraag verwijst, kies dan \"onbekend\"." + Nl +
        "- Een uitleg is kort: hoogstens 120 woorden, in gewoon, volwassen Nederlands, in de ik-vorm, nooit " +
        "kindertaal. Een werkwijze schrijf je als genummerde stappen, elke stap op een eigen regel. Gebruik geen " +
        "gedachtestreepjes." + Nl +
        "- Noem nooit een kind en herhaal nooit iets over een kind, ook niet als de vraag erover gaat." + Nl +
        "- Je wijzigt niets en beslist niets; je legt uit of laat de app opzoeken." + Nl +
        "- Antwoord uitsluitend met geldige JSON in exact één van deze vormen, zonder tekst eromheen:" + Nl +
        "  {\"soort\": \"uitleg\", \"antwoord\": \"<je uitleg>\", \"hoofdstukken\": [\"<titel>\"]}" + Nl +
        "  {\"soort\": \"opzoeking\", \"opzoeking\": {\"vraag\": \"<opzoeking>\", \"doel\": \"<...>\", \"thema\": \"<...>\", " +
        "\"subthema\": \"<...>\", \"activiteit\": \"<...>\"}}" + Nl +
        "  {\"soort\": \"onbekend\"}";

    /// <summary>The request for one question with no conversation before it, over <paramref name="handleiding"/>.</summary>
    public static AiRequest Bouw(string vraag, Handleiding handleiding) => Bouw(vraag, [], handleiding);

    /// <summary>
    /// The request for one question after the turns of <paramref name="gesprek"/> (FB-093, ADR-0069). Only the last
    /// <see cref="MaxBeurten"/> go along, oldest first; what falls out, the model no longer knows. They sit after the
    /// stable prefix, so the prefix stays cacheable.
    /// </summary>
    public static AiRequest Bouw(string vraag, IReadOnlyList<Katbeurt> gesprek, Handleiding handleiding)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(vraag);
        ArgumentNullException.ThrowIfNull(gesprek);
        ArgumentNullException.ThrowIfNull(handleiding);

        return new AiRequest
        {
            SystemPrompt = SystemPrompt,
            VasteContext = "# Handleiding" + Nl + Nl + handleiding.Tekst.Trim() + Nl,
            Gesprek = gesprek.TakeLast(MaxBeurten).Select(b => new AiBeurt(Vraagtekst(b.Vraag), b.Antwoord)).ToList(),
            UserPrompt = Vraagtekst(vraag),
        };
    }

    private static string Vraagtekst(string vraag) => "# Vraag van de gebruiker" + Nl + Nl + vraag.Trim() + Nl;
}
