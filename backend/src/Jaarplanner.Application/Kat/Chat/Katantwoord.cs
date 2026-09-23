namespace Jaarplanner.Application.Kat.Chat;

/// <summary>What kind of answer the cat gives (FB-031, ADR-0066). The sentence is not in it: the frontend composes it
/// from these fields and <c>nl.json</c>, except for <see cref="Uitleg"/>, whose text the model wrote from the handleiding.</summary>
public enum Katantwoordsoort
{
    /// <summary>An explanation of the tool, from the handleiding: <see cref="Katantwoord.Uitleg"/> and its chapters.</summary>
    Uitleg,

    /// <summary>The handleiding says nothing about it, or it has nothing to do with the tool: the cat says he does not know.</summary>
    Onbekend,

    /// <summary>The model's answer was unusable; nothing was looked up. The gebruiker may ask again.</summary>
    Mislukt,

    /// <summary>A doel, thema, subthema or activiteit the question named does not exist, or not for this gebruiker.</summary>
    NietGevonden,

    /// <summary>A term fits several: the gebruiker picks one of <see cref="Katantwoord.Keuze"/>, and the lookup runs again.</summary>
    Kies,

    /// <summary>The answer to a <see cref="Katvraag.DoelInThema"/>.</summary>
    DoelInThema,

    /// <summary>The answer to a <see cref="Katvraag.WaarGebruikt"/>.</summary>
    WaarGebruikt,

    /// <summary>The answer to a <see cref="Katvraag.DoelenVanThema"/>.</summary>
    DoelenVanThema,

    /// <summary>The answer to a <see cref="Katvraag.ActiviteitInSubthema"/>.</summary>
    ActiviteitInSubthema,

    /// <summary>The answer to a <see cref="Katvraag.SubthemaVanActiviteit"/>.</summary>
    SubthemaVanActiviteit,
}

/// <summary>What a term names.</summary>
public enum Katonderwerp
{
    Doel,
    Thema,
    Subthema,
    Activiteit,
}

/// <summary>A goal as the answer names it: its code, which catalogue it is from, and its text.</summary>
public sealed record Katdoel(string Code, Katdoelsoort Soort, string Tekst);

/// <summary>The two catalogues a goal can come from.</summary>
public enum Katdoelsoort
{
    Leerplandoel,
    Minimumdoel,
}

/// <summary>A thema or an activiteit the answer is about.</summary>
public sealed record Katnaam(Guid Id, string Naam);

/// <summary>A term that named nothing.</summary>
public sealed record Katniets(Katonderwerp Wat, string Term);

/// <summary>A term that named several: the candidates, each with the value that names it exactly (<see cref="Katkandidaat.Id"/>).</summary>
public sealed record Katkeuze(Katonderwerp Wat, string Term, IReadOnlyList<Katkandidaat> Kandidaten);

/// <summary>One candidate: <see cref="Id"/> is a goal's code or a content's id, <see cref="Detail"/> what tells it apart.</summary>
public sealed record Katkandidaat(string Id, string Label, string? Detail);

/// <summary>Where a goal sits, or where an activiteit hangs.</summary>
public enum Katpleksoort
{
    /// <summary>A themadoel of the thema.</summary>
    Themadoel,

    /// <summary>A subdoel of a subthema, at its leeftijd.</summary>
    Subdoel,

    /// <summary>A goal of an activiteit, or the activiteit itself under its subthema.</summary>
    Activiteit,

    /// <summary>A goal of a klas's algemene fiche.</summary>
    AlgemeneFiche,
}

/// <summary>
/// One place in the content a goal sits, or an activiteit hangs. <see cref="Verwijzing"/> is the screen that shows it;
/// <see cref="Doel"/> is filled where a list of goals is the answer.
/// </summary>
public sealed record Katplek(
    Katpleksoort Soort,
    Guid ThemaId,
    string Thema,
    Guid? SubthemaId = null,
    string? Subthema = null,
    string? Leeftijd = null,
    string? Activiteit = null,
    string? Fiche = null,
    string? Klas = null,
    Katdoel? Doel = null,
    string? Verwijzing = null);

/// <summary>What was placed in a klas's agenda.</summary>
public enum Katagendasoort
{
    Thema,
    Subthema,
    Activiteit,
    AlgemeneFiche,
}

/// <summary>
/// One placement in the agenda of a klas the gebruiker may read, that carries the goal. <see cref="Voorstel"/> for a
/// placement the AI proposed and nobody decided yet. Following <see cref="Verwijzing"/> needs <see cref="KlasId"/>
/// selected first.
/// </summary>
public sealed record Katagendaplek(
    Guid KlasId,
    string Klas,
    Katagendasoort Soort,
    string Naam,
    DateOnly Van,
    DateOnly Tot,
    bool Voorstel,
    string Verwijzing);

/// <summary>
/// The cat's answer to one question (FB-031, ADR-0066). Only the fields its <see cref="Soort"/> uses are filled; the
/// lists are empty otherwise. Nothing of it is stored (ADR-0059 D6).
/// </summary>
public sealed record Katantwoord
{
    /// <summary>At most this many agenda placements are returned; <see cref="AgendaTotaal"/> says how many there are.</summary>
    public const int MaxAgendaplekken = 40;

    public required Katantwoordsoort Soort { get; init; }

    /// <summary>For <see cref="Katantwoordsoort.Uitleg"/>: the model's explanation, from the handleiding.</summary>
    public string? Uitleg { get; init; }

    /// <summary>For <see cref="Katantwoordsoort.Uitleg"/>: the chapters of the handleiding it rests on.</summary>
    public IReadOnlyList<string> Hoofdstukken { get; init; } = [];

    /// <summary>The lookup that ran, so a <see cref="Katantwoordsoort.Kies"/> can run it again with the chosen candidate.</summary>
    public Katopzoeking? Opzoeking { get; init; }

    public Katniets? NietGevonden { get; init; }

    public Katkeuze? Keuze { get; init; }

    public Katdoel? Doel { get; init; }

    public Katnaam? Thema { get; init; }

    public Katnaam? Activiteit { get; init; }

    /// <summary>The subthema the question named, as the tool found it (for <see cref="Katvraag.ActiviteitInSubthema"/>).</summary>
    public string? Subthema { get; init; }

    /// <summary>For a yes-or-no question: the answer.</summary>
    public bool? Ja { get; init; }

    /// <summary>The decided places (<c>aanvaard</c> or <c>manueel</c>).</summary>
    public IReadOnlyList<Katplek> Plekken { get; init; } = [];

    /// <summary>The proposed places (<c>voorgesteld</c>), named apart; a rejected one is never named.</summary>
    public IReadOnlyList<Katplek> Voorstellen { get; init; } = [];

    /// <summary>For <see cref="Katantwoordsoort.WaarGebruikt"/>: the placements in the agenda of the klassen she may read.</summary>
    public IReadOnlyList<Katagendaplek> Agenda { get; init; } = [];

    /// <summary>How many agenda placements there are in all; more than <see cref="Agenda"/> holds when over the maximum.</summary>
    public int AgendaTotaal { get; init; }

    public static Katantwoord Van(Katantwoordsoort soort) => new() { Soort = soort };

    /// <summary>Only the kind of answer: what it says stays out of every log (ADR-0059 D6).</summary>
    public override string ToString() => $"{nameof(Katantwoord)} {Soort}";
}
