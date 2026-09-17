namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// A thema the model proposed that the run did not place (ADR-0055), with the reason as one of the constants on
/// <see cref="NietGeplaatstThema"/>. The client composes the Dutch sentence (Art. II.3).
/// </summary>
/// <param name="ThemaNaam">
/// The thema's name as the school has it, or as the model wrote it when <see cref="Reden"/> is
/// <see cref="OnbekendThema"/>. The screen does not show that last one: it is not school data.
/// </param>
/// <param name="Reden">Why the thema was not placed.</param>
public sealed record NietGeplaatstThema(string ThemaNaam, string Reden)
{
    /// <summary>The model named a thema the school does not have (Art. IV.4: never fabricated).</summary>
    public const string OnbekendThema = "OnbekendThema";

    /// <summary>The thema already stands in the plan, or the model proposed it twice.</summary>
    public const string AlGepland = "AlGepland";

    /// <summary>The start week is no lesweek of the class's school year.</summary>
    public const string GeenLesweek = "GeenLesweek";

    /// <summary>The weeks the model chose hold no free stretch of at least one lesweek.</summary>
    public const string GeenPlaats = "GeenPlaats";
}

/// <summary>
/// The outcome of one generation run (FR-5.1, ADR-0055). A run whose model answer is unreadable fails and changed
/// nothing (Art. IV.5); a run that succeeds says how many thema's it proposed, how many stayed, how many open proposals
/// it replaced, and which proposals it could not place.
/// </summary>
public sealed record JaarplanGeneratieResultaat
{
    private JaarplanGeneratieResultaat(
        bool isGeslaagd,
        string? fout,
        int aantalNieuw,
        int aantalBehouden,
        int aantalVervangen,
        IReadOnlyList<NietGeplaatstThema> nietGeplaatst)
    {
        IsGeslaagd = isGeslaagd;
        Fout = fout;
        AantalNieuw = aantalNieuw;
        AantalBehouden = aantalBehouden;
        AantalVervangen = aantalVervangen;
        NietGeplaatst = nietGeplaatst;
    }

    /// <summary>True when the model's answer was readable and the run was applied.</summary>
    public bool IsGeslaagd { get; }

    /// <summary>An English diagnostic of the unreadable answer; null on success (operator-facing, Art. II.3).</summary>
    public string? Fout { get; }

    /// <summary>The thema's placed as new proposals. A thema split around a vacation counts once.</summary>
    public int AantalNieuw { get; }

    /// <summary>The thema runs that stayed: decided or locked.</summary>
    public int AantalBehouden { get; }

    /// <summary>The thema runs of open, unlocked proposals the run removed before placing its own.</summary>
    public int AantalVervangen { get; }

    /// <summary>The proposals the run did not place, in the order it considered them.</summary>
    public IReadOnlyList<NietGeplaatstThema> NietGeplaatst { get; }

    /// <summary>The plan after the run, for the screen; set by the caller that reads it. Null on failure.</summary>
    public JaarplanWeergave? Jaarplan { get; init; }

    /// <summary>A successful run.</summary>
    public static JaarplanGeneratieResultaat Geslaagd(
        int aantalNieuw,
        int aantalBehouden,
        int aantalVervangen,
        IReadOnlyList<NietGeplaatstThema> nietGeplaatst) =>
        new(true, null, aantalNieuw, aantalBehouden, aantalVervangen, nietGeplaatst);

    /// <summary>A run whose model answer was unreadable: nothing was stored.</summary>
    public static JaarplanGeneratieResultaat Mislukt(string fout) =>
        new(false, fout, 0, 0, 0, []);
}
