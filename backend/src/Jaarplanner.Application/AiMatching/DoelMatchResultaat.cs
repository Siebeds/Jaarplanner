namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// The outcome of an end-to-end goal-match run for one thema (E2-04, FR-4). Like the parse result it
/// is a <b>result type, not an exception</b>: a malformed AI response is a routine, expected case
/// (models drift, Art. IV.5) that the caller must handle — on failure <b>nothing is persisted</b>.
/// <para>
/// On success it reports what was persisted (each a <c>voorgesteld</c> <c>DoelKoppeling</c>,
/// Art. IV.2) and what was safely skipped: codes the model returned that do not exist in the loaded
/// leerplandoel set (never fabricated, Art. III.5/IV.4) and codes already linked to the thema
/// (idempotent re-runs). Nothing is ever auto-accepted (Art. IV.1).
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

    /// <summary><c>true</c> when the AI response was valid and (zero or more) suggestions were persisted.</summary>
    public bool IsGeslaagd { get; }

    /// <summary>A short, English diagnostic when the AI response was invalid; <c>null</c> on success.</summary>
    public string? Fout { get; }

    /// <summary>The suggestions persisted as <c>voorgesteld</c> (Art. IV.2). Empty on failure.</summary>
    public IReadOnlyList<DoelMatchSuggestieWeergave> Bewaard { get; }

    /// <summary>Codes the model returned that are not in the loaded leerplandoel set — skipped, not fabricated (Art. III.5).</summary>
    public IReadOnlyList<string> OvergeslagenOnbekend { get; }

    /// <summary>Codes the model returned that were already linked to the thema — skipped for idempotency.</summary>
    public IReadOnlyList<string> OvergeslagenDuplicaat { get; }

    /// <summary>
    /// How many Op.stap leerplandoelen the run actually considered — the size of the candidate set the
    /// selection resolved to (E2-08). Reported so the teacher can <i>see</i> the scope their run used
    /// instead of trusting an invisible default: "0 kandidaten" is a loading problem, not an AI problem,
    /// and the two are indistinguishable from an empty suggestion list (Art. XIV — disciplines-first is
    /// still open, so the scope of a run must never be silent).
    /// </summary>
    public int AantalKandidaten { get; }

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

    /// <summary>Builds a failure result — nothing persisted (Art. IV.5).</summary>
    public static DoelMatchResultaat Mislukt(string fout, int aantalKandidaten = 0) =>
        new(isGeslaagd: false, fout, LeegBewaard, LeegCodes, LeegCodes, aantalKandidaten);
}
