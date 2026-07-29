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
        IReadOnlyList<string> duplicaten,
        IReadOnlyList<string> afgewezen)
    {
        IsGeslaagd = isGeslaagd;
        Fout = fout;
        Jaarplan = jaarplan;
        AantalNieuw = aantalNieuw;
        AantalBehouden = aantalBehouden;
        OnbekendeThemas = onbekendeThemas;
        OnbekendeBlokken = onbekendeBlokken;
        Duplicaten = duplicaten;
        Afgewezen = afgewezen;
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

    /// <summary>
    /// Placements the plan already held identically as a <b>still-standing</b> proposal or an accepted/adjusted one
    /// — skipped for idempotency. This reports genuine AI repetition: the model proposed something already there.
    /// </summary>
    public IReadOnlyList<string> Duplicaten { get; }

    /// <summary>
    /// Placements the model proposed that the teacher has explicitly <b>rejected</b> in that exact block — reported
    /// separately from <see cref="Duplicaten"/> on purpose.
    /// <para>
    /// A <c>geweigerd</c> placement is kept (a human decision is not the generator's to discard, Art. IV.1) and
    /// therefore still occupies its slot, so re-proposing it is suppressed. But labelling that a "duplicate" would
    /// tell the teacher the AI repeated itself, when what actually happened is that <i>their own</i> rejection is
    /// holding. Those are different facts and a teacher may act differently on each.
    /// </para>
    /// <para>
    /// The lifecycle consequence is real and deliberately <b>not</b> resolved here: nothing can remove a rejected
    /// placement, so it suppresses that thema/block indefinitely. A delete path is E3-07's scope; see the E3-01
    /// worklog and <c>KoppelingStatus</c>'s documentation for the divergence this creates against
    /// <c>DoelKoppeling</c>.
    /// </para>
    /// </summary>
    public IReadOnlyList<string> Afgewezen { get; }

    /// <summary>Builds a success result.</summary>
    public static JaarplanGeneratieResultaat Geslaagd(
        JaarplanWeergave jaarplan,
        int aantalNieuw,
        int aantalBehouden,
        IReadOnlyList<string> onbekendeThemas,
        IReadOnlyList<string> onbekendeBlokken,
        IReadOnlyList<string> duplicaten,
        IReadOnlyList<string> afgewezen) =>
        new(isGeslaagd: true,
            fout: null,
            jaarplan,
            aantalNieuw,
            aantalBehouden,
            onbekendeThemas ?? LeegTekst,
            onbekendeBlokken ?? LeegTekst,
            duplicaten ?? LeegTekst,
            afgewezen ?? LeegTekst);

    /// <summary>Builds a failure result — nothing persisted, no partial plan (Art. IV.5).</summary>
    public static JaarplanGeneratieResultaat Mislukt(string fout) =>
        new(isGeslaagd: false,
            fout,
            jaarplan: null,
            aantalNieuw: 0,
            aantalBehouden: 0,
            LeegTekst,
            LeegTekst,
            LeegTekst,
            LeegTekst);
}
