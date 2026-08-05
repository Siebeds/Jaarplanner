using Jaarplanner.Application.Dekking;

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
        int aantalVervangen,
        IReadOnlyList<string> onbekendeThemas,
        IReadOnlyList<string> onbekendeBlokken,
        IReadOnlyList<string> duplicaten,
        IReadOnlyList<string> afgewezen,
        Spreidingsrapport? spreiding,
        ParameterRapport? parameters)
    {
        IsGeslaagd = isGeslaagd;
        Fout = fout;
        Jaarplan = jaarplan;
        AantalNieuw = aantalNieuw;
        AantalBehouden = aantalBehouden;
        AantalVervangen = aantalVervangen;
        OnbekendeThemas = onbekendeThemas;
        OnbekendeBlokken = onbekendeBlokken;
        Duplicaten = duplicaten;
        Afgewezen = afgewezen;
        Spreiding = spreiding;
        Parameters = parameters;
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

    /// <summary>
    /// How many superseded proposals this run <b>discarded</b> — the untouched, unlocked <c>voorgesteld</c>
    /// placements the previous run had left, cleared before the new ones are added.
    /// <para>
    /// Reported because a run that places nothing has still changed the plan when this is non-zero. Without it
    /// the UI said "er is niets gewijzigd" after wiping a teacher's whole previous proposal, which is a false
    /// statement about their own data (found in the E3-02 code review).
    /// </para>
    /// </summary>
    public int AantalVervangen { get; }

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

    /// <summary>
    /// How the resulting plan is spread over the year (E3-02, FR-5.2) — blocks used vs available, goals per
    /// block, and any block whose thema's need more weeks than it spans. <c>null</c> on failure, because nothing
    /// was persisted and there is no plan to measure.
    /// <para>
    /// <b>Advisory.</b> An uneven spread does not fail the run: the report states the fact and the teacher
    /// decides (Art. IV.1). It carries no pass/fail verdict — see <see cref="Spreidingsrapport"/> for why a
    /// threshold is deliberately absent.
    /// </para>
    /// </summary>
    public Spreidingsrapport? Spreiding { get; }

    /// <summary>
    /// What became of the teacher's pre-generation parameters (E3-04, FR-5.4) — which requested start thema's the
    /// plan honoured, and which placements the service refused because a vast moment holds their period.
    /// <c>null</c> on failure, and <see cref="ParameterRapport.Geen"/> when the teacher supplied nothing.
    /// <para>
    /// <b>Advisory in the same sense as <see cref="Spreiding"/>.</b> A declined preference does not fail the run and
    /// never triggers a retry: the teacher sees that the model did not comply and decides (Art. IV.1).
    /// </para>
    /// </summary>
    public ParameterRapport? Parameters { get; }

    /// <summary>
    /// What the resulting plan <b>would</b> cover if the teacher accepted every proposal in it, beside what it covers
    /// today (E3-03, FR-5.3). <c>null</c> on failure, and <c>null</c> on a path that did not ask for it.
    /// <para>
    /// <b>Set by the caller after the run rather than produced by the generation service.</b> The coverage rules live
    /// in <c>DekkingService</c> — one owner for which link layers count, which placement statuses count and which
    /// goals are in scope — and that service reads the plan through <c>IJaarplanLezer</c>, which
    /// <c>JaarplanGeneratieService</c> itself implements, so a generator depending on it under constructor injection
    /// would close the loop. A second, leaner coverage computation beside the generator is the alternative that was
    /// rejected outright: that is precisely the divergence this codebase has already paid for twice (the te-vol
    /// threshold, the four link layers).
    /// </para>
    /// <para>
    /// <b>The cycle rules out one alternative, not all of them, and saying otherwise would overstate the case</b>
    /// (antagonist round 1). A third Application-layer type depending on both services has no cycle at all. It was not
    /// built because it would be a class whose entire body is these two calls, on a project whose architecture note
    /// says to favour clarity over ceremony — that is a judgement about ceremony, not a constraint. The controller
    /// applies no rule; it asks and attaches.
    /// </para>
    /// <para>
    /// <b>Consequence a new generation path must handle:</b> an endpoint that runs a generation and does not attach
    /// this leaves the panel's dekking section out. That fails visibly rather than silently, but it is an obligation —
    /// noted against E4-04/E4-05 in <c>backlog/E4-bewerking-hergeneratie.md</c>.
    /// </para>
    /// <para>
    /// <b>Advisory like every other report here</b> (Art. IV.1): it never fails a run, never retries one and carries no
    /// target. And it is a prospect, never proof — see <see cref="Dekkingsvooruitzicht"/> for why a fresh plan covers
    /// nothing at all and why that is correct.
    /// </para>
    /// </summary>
    public Dekkingsvooruitzicht? Vooruitzicht { get; init; }

    /// <summary>Builds a success result.</summary>
    public static JaarplanGeneratieResultaat Geslaagd(
        JaarplanWeergave jaarplan,
        int aantalNieuw,
        int aantalBehouden,
        int aantalVervangen,
        IReadOnlyList<string> onbekendeThemas,
        IReadOnlyList<string> onbekendeBlokken,
        IReadOnlyList<string> duplicaten,
        IReadOnlyList<string> afgewezen,
        Spreidingsrapport spreiding,
        ParameterRapport? parameters = null) =>
        new(isGeslaagd: true,
            fout: null,
            jaarplan,
            aantalNieuw,
            aantalBehouden,
            aantalVervangen,
            onbekendeThemas ?? LeegTekst,
            onbekendeBlokken ?? LeegTekst,
            duplicaten ?? LeegTekst,
            afgewezen ?? LeegTekst,
            spreiding,
            parameters ?? ParameterRapport.Geen);

    /// <summary>Builds a failure result — nothing persisted, no partial plan (Art. IV.5).</summary>
    public static JaarplanGeneratieResultaat Mislukt(string fout) =>
        new(isGeslaagd: false,
            fout,
            jaarplan: null,
            aantalNieuw: 0,
            aantalBehouden: 0,
            aantalVervangen: 0,
            LeegTekst,
            LeegTekst,
            LeegTekst,
            LeegTekst,
            spreiding: null,
            parameters: null);
}
