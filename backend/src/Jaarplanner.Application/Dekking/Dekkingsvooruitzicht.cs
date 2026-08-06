namespace Jaarplanner.Application.Dekking;

/// <summary>
/// What a jaarplan <b>would</b> cover if the teacher accepted every proposal standing in it, beside what it covers
/// today (E3-03, FR-5.3).
/// <para>
/// <b>Why this type has to exist at all, and it is the whole of E3-03's honesty problem.</b> FR-5.3 says generation
/// <i>streeft naar volledige dekking</i>, and the story's acceptance criterion asked for "a freshly generated plan
/// reports high coverage". A freshly generated plan reports <b>zero</b> covered, by design and permanently: every
/// placement a run creates is <c>voorgesteld</c> (Art. IV.2) and only <c>aanvaard</c>/<c>manueel</c> placements count
/// as taught (Art. V.1), precisely so the AI cannot grant coverage (Art. IV.1). Measuring the criterion literally
/// would therefore have required either weakening Art. V.1 or reporting a number that is always 0 and calling it a
/// failure of the model.
/// </para>
/// <para>
/// <b>So the figure this record carries is explicitly a <i>vooruitzicht</i>, never a dekking.</b>
/// <see cref="AantalMogelijkGedekt"/> counts what acceptance would cover; <see cref="AantalGedekt"/> is the real,
/// decided figure, computed by exactly the same rules the dekkingsoverzicht uses. The two are reported side by side
/// so no caller can present the potential one as proof of anything: Art. V.2 forbids claiming coverage that cannot
/// be proven, and a proposal proves nothing until a human stands behind it.
/// </para>
/// <para>
/// <b>What it is <i>for</i>, since it proves nothing:</b> it tells a teacher whether the proposal they were just
/// handed is worth accepting, and it makes the model's aim measurable. A run that could at best reach a third of the
/// class's doelen is a run whose prompt or thema-bibliotheek is the problem, and until this figure existed nobody
/// could see that without accepting the whole plan first.
/// </para>
/// <para>
/// <b>Advisory, like every other generation report</b> (Art. IV.1). Nothing here vetoes a run, retries it or scores
/// it. There is no target percentage and no green tick: "volledige dekking" is the direction FR-5.3 names, and how
/// close is close enough for a given school year is the school's judgement, exactly as with
/// <c>Spreidingsrapport</c>. A percentage is deliberately absent for a second reason too: E5-03 owns the
/// dekkingspercentage, and a second one computed here could drift from it.
/// </para>
/// </summary>
/// <param name="Bereik">
/// Which leerplandoelen the figures are over (owner ruling 2026-08-04) — the class's own jaar/fase by default. It
/// reports what was <b>applied</b>, not what was asked for; see <paramref name="IsTerugvalNaarHeelCurriculum"/>.
/// Every consumer that prints a total has to render this beside it, because the same class has two legitimate
/// denominators.
/// </param>
/// <param name="GemetenJaarFasen">
/// The jaar/fase codes actually measured against, or empty for the whole curriculum, so a screen can name the scope
/// in the school's own vocabulary rather than in the abstract.
/// <para>
/// <b>A kleutergroep's narrowing is honoured</b> (owner ruling 2026-08-04): the caller passes the chosen code and
/// this reports what was applied. <i>An earlier revision refused to accept one and justified it by claiming the
/// chooser "lives on the dekkingsoverzicht". That was simply false — E3-09 put a <c>Jaarfasekiezer</c> on the
/// kalender, driving the live dekking line on the same screen as this panel — and the consequence was two figures
/// over two different denominators a few pixels apart. Kept as a note because the mistake was not in the code but
/// in a claim about where a control lives, which no test can contradict.</i>
/// </para>
/// </param>
/// <param name="IsTerugvalNaarHeelCurriculum">
/// <c>true</c> when the class's own jaar/fase was wanted but could not be derived (the unresolved graadklas /
/// menggroep half of Art. XIV), so the whole curriculum was measured instead. The scope is widened rather than
/// narrowed and declared rather than hidden, because a narrower-than-intended denominator would overstate the
/// outlook.
/// </param>
/// <param name="AantalBuitenBereik">
/// How many loaded leerplandoelen fall outside <paramref name="Bereik"/>; 0 when the whole curriculum is measured.
/// Present so the narrowing cannot be silent: a smaller denominator flatters the figure, which is the one direction
/// it must never move by itself.
/// </param>
/// <param name="IsBetrouwbaar">
/// <c>false</c> when at least one stale placement is unresolved, in which case <b>both</b> figures are withheld
/// (directie 2026-07-28). The outlook is held to the same standard as the real figure on purpose: a plan whose
/// placements point at periods that no longer exist cannot honestly say what accepting them would achieve either.
/// </param>
/// <param name="AantalOnopgelosteVervallenPlaatsingen">
/// How many stale placements are unresolved — stale <i>and</i> not rejected. The same narrowing
/// <c>DekkingService</c> applies to the real figure, for the same reason: a rejected placement contributes nothing
/// either way, so its staleness cannot change any of these numbers.
/// </param>
/// <param name="AantalGedekt">
/// How many in-scope leerplandoelen are covered <b>today</b>, by the placements the teacher has already accepted or
/// placed by hand; <c>null</c> when <paramref name="IsBetrouwbaar"/> is <c>false</c>. Right after a first generation
/// this is 0, and that is the correct answer rather than a defect.
/// </param>
/// <param name="AantalMogelijkGedekt">
/// How many in-scope leerplandoelen would be covered if the teacher accepted every <b>placement</b> proposal now
/// standing in the plan; <c>null</c> when <paramref name="IsBetrouwbaar"/> is <c>false</c>.
/// <para>
/// It is a ceiling, not a forecast: rejected placements are excluded (the teacher has already decided) and so are
/// stale ones (they sit in no period). It can never be lower than <paramref name="AantalGedekt"/> at one moment,
/// because the set it counts over contains that one. (The two figures come from two non-transactional reads, so a
/// link deleted between them could in principle cross that; nothing guards it and nothing here promises otherwise.)
/// </para>
/// <para>
/// <b>It widens the PLACEMENT status set and nothing else, and that boundary is the correction of a real defect
/// (antagonist round 1, 2026-08-05).</b> The links a thema carries are still counted only when they are
/// <c>aanvaard</c>/<c>manueel</c>, because <c>IDekkingOpslag</c> filters them there for every caller. So a
/// leerplandoel attached to a placed thema through a still-<c>voorgesteld</c> doelsuggestie — the ordinary state
/// right after FR-4 matching — does <b>not</b> count here. That is defensible (nobody has decided that link either)
/// but it makes this a ceiling over <i>placements</i>, not over "everything the teacher could say yes to", and the
/// first version of the copy claimed the second: it told a teacher the doel sat in no planned thema at all, which
/// could be false. The rendered sentence now states only what this number can carry.
/// </para>
/// <para>
/// <b>Nullable for the same reason as <paramref name="AantalGedekt"/>, and the type is what enforces it</b> — a
/// boolean beside a populated number would let any caller print the number anyway, and this repo has learned that a
/// flag which only asks to be honoured is eventually not.
/// </para>
/// </param>
/// <param name="AantalLeerplandoelen">
/// The denominator: how many leerplandoelen are in scope. Always present, because it is a property of the loaded
/// curriculum rather than of this plan.
/// <para>
/// <b>It can legitimately be 0</b> — a class scoped to L3 while only kleuterdoelen are imported. A caller must not
/// render that as "alles gedekt": 0 of 0 means "we cannot measure this class yet".
/// </para>
/// </param>
public sealed record Dekkingsvooruitzicht(
    Dekkingsbereik Bereik,
    IReadOnlyList<string> GemetenJaarFasen,
    bool IsTerugvalNaarHeelCurriculum,
    int AantalBuitenBereik,
    bool IsBetrouwbaar,
    int AantalOnopgelosteVervallenPlaatsingen,
    int? AantalGedekt,
    int? AantalMogelijkGedekt,
    int AantalLeerplandoelen)
{
    /// <summary>
    /// How many in-scope leerplandoelen are still not covered once every standing <b>placement</b> proposal is
    /// accepted; <c>null</c> when the figures are withheld.
    /// <para>
    /// This is the number FR-5.3 is really about: accepting the plan's proposals cannot reduce it. Closing it needs a
    /// different thema, or a goal link, or the acknowledgement that the school's current content does not cover this
    /// class's curriculum.
    /// </para>
    /// <para>
    /// <b>What it is NOT, corrected after antagonist round 1:</b> it is not "no thema in this plan carries these
    /// doelen". A placed thema may carry one through a doelsuggestie the teacher has not accepted yet, and accepting
    /// <i>that</i> would reduce this number — so the earlier phrasing, and the sentence rendered from it, could both
    /// be false in the ordinary state right after AI matching. The number is unchanged; what it may be said to mean
    /// is narrower.
    /// </para>
    /// <para>
    /// <b>Which</b> doelen they are is deliberately not listed here: that is the gap-analyse (E5-05) over the
    /// dekkingsoverzicht's own per-doel list, and a second list composed on the generation panel could disagree.
    /// </para>
    /// </summary>
    public int? AantalOnbereikbaar =>
        AantalMogelijkGedekt is null ? null : AantalLeerplandoelen - AantalMogelijkGedekt;

    // REMOVED: `AantalWinstBijAanvaarden` (= AantalMogelijkGedekt - AantalGedekt), antagonist round 3.
    //
    // It was computed here, serialised, typed on the frontend and asserted across three test layers, and no screen
    // ever read it. The choice the audit put was "render it or drop it", and dropping is the one that does not invent
    // a new sentence on the anchor screen inside a fix round: both operands travel on this same payload, so any
    // consumer that wants the difference can subtract, and a figure nothing reads is a figure nothing protects.
    // If a screen ever wants it, it comes back with the copy that justifies it.
}
