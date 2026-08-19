namespace Jaarplanner.Application.Dekking;

/// <summary>
/// Why an in-scope leerplandoel is <b>not</b> covered, and therefore where closing it has to happen
/// (E5-05, FR-9, Art. V.3).
/// <para>
/// <b>This is the whole of E5-05.</b> Listing the missing goals is Art. V.3 and E5-03 built it; this type is the
/// story's own criterion, <i>"a gap can be traced to where it should be planned"</i>. A teacher looking at a red row
/// in September cannot act on it without knowing which of five completely different situations they are in: one is
/// resolved on the kalender by answering a proposal, one by undoing a rejection they made themselves, one needs a
/// thema placed, one needs a doelsuggestie decided on <c>/themas</c>, and one cannot be closed by planning at all
/// because the school has no content for that goal.
/// </para>
/// <para>
/// <b>The five are ordered by how close the goal is to being covered</b>, and the classification takes the first
/// that applies. That ordering is not cosmetic: a doel can sit in several of these states at once (thema A carries
/// it and is placed as a proposal, thema B carries it and is nowhere), and the honest thing to report is the
/// cheapest route to closing it rather than every route at once.
/// </para>
/// <para>
/// <b>Two different rejections live in this type and they must not be confused</b>, which is why they are named
/// here together. A rejected <c>DoelKoppeling</c> — the teacher said this thema does not teach this goal — is
/// <b>not a cause at all</b>: the candidate read excludes those links, so a thema carrying only a rejected link
/// falls through to <see cref="GeenThema"/>. That is why <see cref="GeenThema"/>'s copy may say "no thema covers
/// this goal" and may never say "no thema is linked to it". A rejected <c>Themaplaatsing</c> — the teacher said not
/// this thema, not in this period — <b>is</b> a cause, <see cref="PlaatsingGeweigerd"/>, because that decision is
/// visible on the kalender and reversible there.
/// </para>
/// </summary>
public enum Lacuneoorzaak
{
    /// <summary>
    /// A thema that carries this goal <b>is</b> in the plan, as a proposal the teacher has not answered yet.
    /// <para>
    /// The cheapest of the five: accepting that placement covers the goal, with nothing else to change. This set is
    /// exactly <c>Dekkingsvooruitzicht.AantalMogelijkGedekt</c> minus <c>AantalGedekt</c> — the doelen E3-03 counts
    /// as "would be covered if you accepted the plan" and deliberately did not list, because listing them is this
    /// story's job. <c>DekkingsserviceTests</c> pins the two against each other, since the whole value of the figure
    /// is that a teacher can find out which doelen it is about.
    /// </para>
    /// </summary>
    WachtOpBeslissing = 0,

    /// <summary>
    /// A thema that carries this goal stands in a real period of this plan and the teacher <b>rejected</b> that
    /// placement, so it covers nothing.
    /// <para>
    /// <b>This cause exists because the antagonist's ronde 1 proved the alternative was a lie on screen (2026-08-19).</b>
    /// It used to be folded into <see cref="NietIngepland"/> on the stated ground that the remedy was identical, and
    /// that ground was false in both directions. A rejected placement is <b>drawn in its period column</b>
    /// (<c>plaatsingenIn</c> excludes stale placements and not rejected ones), so the folded copy told a teacher a
    /// thema sat in no period while a card for it was visible in one. And the remedy differs: this one is closed with
    /// <i>Weigering terugdraaien</i> on the card, while <c>Themakiezer</c> deliberately <b>disables</b> that thema in
    /// exactly the period the teacher is looking at — so the folded route sent them to a control that refuses them.
    /// </para>
    /// <para>
    /// A rejected placement that is <b>also</b> stale is not this cause but <see cref="NietIngepland"/>, and the
    /// boundary is the render rule rather than a preference: a stale card is not drawn in a period, so "sits in no
    /// period" is true of it. <c>DekkingServiceTests</c> drives both sides of that boundary.
    /// </para>
    /// </summary>
    PlaatsingGeweigerd = 1,

    /// <summary>
    /// A thema that carries this goal exists and the teacher has decided its link, but the thema sits in no period
    /// of this plan.
    /// <para>
    /// "Sits in no period" folds two states together, because the remedy really is identical for both and because
    /// the sentence is true of both: never placed at all, or placed against a period that no longer exists (a stale
    /// placement, which the kalender does not draw in any period). The third state this used to fold in — placed and
    /// rejected — was split out into <see cref="PlaatsingGeweigerd"/>; see there for why.
    /// </para>
    /// </summary>
    NietIngepland = 2,

    /// <summary>
    /// No thema carries a decided link to this goal, but at least one has a <c>voorgesteld</c> doelsuggestie for it.
    /// <para>
    /// The decision is a link decision rather than a planning one, so it happens on <c>/themas</c> (FR-4.2) and not
    /// on the kalender. Planning the thema would not help while the link stays undecided: only
    /// <c>aanvaard</c>/<c>manueel</c> links count for dekking (Art. V.1), which is what stops the AI granting
    /// coverage (Art. IV.1).
    /// </para>
    /// </summary>
    KoppelingNietBeslist = 3,

    /// <summary>
    /// No thema covers this goal at all, decided or proposed.
    /// <para>
    /// <b>The only one of the five that planning cannot close</b>, and the only one that is genuinely about the
    /// school's content rather than about this class's year plan. It is also the honest end of Art. V.2: if the
    /// school teaches nothing that maps onto a decreed goal, a coverage overview that implied otherwise would be
    /// the exact false proof this article exists to prevent.
    /// </para>
    /// </summary>
    GeenThema = 4,
}
