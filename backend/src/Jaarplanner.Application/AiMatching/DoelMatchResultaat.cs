namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// The outcome of one doelsuggestie run for a thema (FB-053, FR-4). A <b>result type, not an exception</b>: a malformed
/// AI response is a routine case (Art. IV.5) the caller must handle, and on failure <b>nothing is stored</b>.
/// <para>
/// On success it reports what was stored (each a <c>voorgesteld</c> proposal, Art. IV.2) and what was skipped: refs the
/// model returned that are not among the candidates (never fabricated, Art. III.5), and refs already a themadoel or
/// already proposed. Nothing is ever accepted by the run (Art. IV.1).
/// </para>
/// </summary>
public sealed record DoelMatchResultaat
{
    private static readonly IReadOnlyList<DoelMatchSuggestieWeergave> LeegBewaard = [];
    private static readonly IReadOnlyList<string> LeegCodes = [];

    private DoelMatchResultaat(
        bool isGeslaagd,
        string? fout,
        IReadOnlyList<DoelMatchSuggestieWeergave> bewaard,
        IReadOnlyList<string> overgeslagenOnbekend,
        IReadOnlyList<string> overgeslagenDuplicaat,
        int aantalKandidaten)
    {
        IsGeslaagd = isGeslaagd;
        Fout = fout;
        Bewaard = bewaard;
        OvergeslagenOnbekend = overgeslagenOnbekend;
        OvergeslagenDuplicaat = overgeslagenDuplicaat;
        AantalKandidaten = aantalKandidaten;
    }

    /// <summary><c>true</c> when the AI response was valid and (zero or more) proposals were stored.</summary>
    public bool IsGeslaagd { get; }

    /// <summary>A short, English diagnostic when the AI response was invalid; <c>null</c> on success.</summary>
    public string? Fout { get; }

    /// <summary>The proposals stored as <c>voorgesteld</c> (Art. IV.2). Empty on failure.</summary>
    public IReadOnlyList<DoelMatchSuggestieWeergave> Bewaard { get; }

    /// <summary>Refs the model returned that are not among the candidates: skipped, not fabricated (Art. III.5).</summary>
    public IReadOnlyList<string> OvergeslagenOnbekend { get; }

    /// <summary>Refs the model returned that are already a themadoel or already proposed: skipped (ADR-0049 D1).</summary>
    public IReadOnlyList<string> OvergeslagenDuplicaat { get; }

    /// <summary>
    /// How many minimumdoelen the run offered the model, so the screen can say what it searched: "0" is a loading
    /// problem, not an AI answer.
    /// </summary>
    public int AantalKandidaten { get; }

    /// <summary>The leeftijden the run was for: the caller's choice, or else those of the thema's subthema's (TB-007).</summary>
    public IReadOnlyList<string> JaarFasen { get; init; } = LeegCodes;

    /// <summary>The mijlpalen those leeftijden meet, whose minimumdoelen were the candidates (ADR-0049 O3).</summary>
    public IReadOnlyList<string> Mijlpalen { get; init; } = LeegCodes;

    /// <summary>Builds a success result.</summary>
    public static DoelMatchResultaat Geslaagd(
        IReadOnlyList<DoelMatchSuggestieWeergave> bewaard,
        IReadOnlyList<string> overgeslagenOnbekend,
        IReadOnlyList<string> overgeslagenDuplicaat,
        int aantalKandidaten) =>
        new(isGeslaagd: true, fout: null,
            bewaard ?? LeegBewaard,
            overgeslagenOnbekend ?? LeegCodes,
            overgeslagenDuplicaat ?? LeegCodes,
            aantalKandidaten);

    /// <summary>Builds a failure result: nothing stored (Art. IV.5).</summary>
    public static DoelMatchResultaat Mislukt(string fout, int aantalKandidaten = 0) =>
        new(isGeslaagd: false, fout, LeegBewaard, LeegCodes, LeegCodes, aantalKandidaten);
}
