namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The outcome of one plan-generation run for one class (FR-5.1). Like <c>DoelMatchResultaat</c> it is a
/// <b>result type, not an exception</b>: a malformed AI response is a routine, expected case (models drift,
/// Art. IV.5) that the caller must handle, and on failure <b>nothing is persisted</b> — not even the placements
/// that happened to be valid, because a half-applied year plan is worse than none.
/// <para>
/// On success it reports the resulting proposal plus what was safely skipped: thema names the model returned that
/// the school does not own, block start dates that are not the start of any derived block, and exact duplicates.
/// None of those is ever invented into existence (Art. IV.4). Nothing is auto-accepted (Art. IV.1) — every new
/// placement is <c>voorgesteld</c>.
/// </para>
/// </summary>
public sealed record JaarplanGeneratieResultaat
{
    private static readonly IReadOnlyList<string> LeegTekst = [];

    private JaarplanGeneratieResultaat(
        bool isGeslaagd,
        string? fout,
        JaarplanWeergave? jaarplan,
        int aantalNieuw,
        int aantalBehouden,
        IReadOnlyList<string> onbekendeThemas,
        IReadOnlyList<string> onbekendeBlokken,
        IReadOnlyList<string> duplicaten)
    {
        IsGeslaagd = isGeslaagd;
        Fout = fout;
        Jaarplan = jaarplan;
        AantalNieuw = aantalNieuw;
        AantalBehouden = aantalBehouden;
        OnbekendeThemas = onbekendeThemas;
        OnbekendeBlokken = onbekendeBlokken;
        Duplicaten = duplicaten;
    }

    /// <summary><c>true</c> when the AI response was valid and a (possibly empty) proposal was persisted.</summary>
    public bool IsGeslaagd { get; }

    /// <summary>A short, English diagnostic when the AI response was invalid; <c>null</c> on success.</summary>
    public string? Fout { get; }

    /// <summary>The resulting reviewable plan; <c>null</c> on failure (nothing was persisted).</summary>
    public JaarplanWeergave? Jaarplan { get; }

    /// <summary>How many placements this run added, each as <c>voorgesteld</c> (Art. IV.2).</summary>
    public int AantalNieuw { get; }

    /// <summary>
    /// How many pre-existing placements this run left untouched because they were locked or already decided on by
    /// the teacher (Art. IX.3 <c>vergrendeld</c>, Art. IV.1).
    /// </summary>
    public int AantalBehouden { get; }

    /// <summary>Thema names the model returned that the school does not own — skipped, never fabricated (Art. IV.4).</summary>
    public IReadOnlyList<string> OnbekendeThemas { get; }

    /// <summary>
    /// Block start dates the model returned that are not the start of any derived block — skipped rather than
    /// snapped to the nearest block, because snapping would silently put a thema in a period nobody chose.
    /// </summary>
    public IReadOnlyList<string> OnbekendeBlokken { get; }

    /// <summary>Placements the plan already held identically (kept locked/decided ones) — skipped for idempotency.</summary>
    public IReadOnlyList<string> Duplicaten { get; }

    /// <summary>Builds a success result.</summary>
    public static JaarplanGeneratieResultaat Geslaagd(
        JaarplanWeergave jaarplan,
        int aantalNieuw,
        int aantalBehouden,
        IReadOnlyList<string> onbekendeThemas,
        IReadOnlyList<string> onbekendeBlokken,
        IReadOnlyList<string> duplicaten) =>
        new(isGeslaagd: true,
            fout: null,
            jaarplan,
            aantalNieuw,
            aantalBehouden,
            onbekendeThemas ?? LeegTekst,
            onbekendeBlokken ?? LeegTekst,
            duplicaten ?? LeegTekst);

    /// <summary>Builds a failure result — nothing persisted, no partial plan (Art. IV.5).</summary>
    public static JaarplanGeneratieResultaat Mislukt(string fout) =>
        new(isGeslaagd: false,
            fout,
            jaarplan: null,
            aantalNieuw: 0,
            aantalBehouden: 0,
            LeegTekst,
            LeegTekst,
            LeegTekst);
}
