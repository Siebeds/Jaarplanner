namespace Jaarplanner.Application.Dekking;

/// <summary>
/// Why an in-scope leerplandoel is <b>not</b> covered, and therefore where closing it has to happen
/// (E5-05, FR-9, Art. V.3).
/// <para>
/// <b>This is the whole of E5-05.</b> Listing the missing goals is Art. V.3 and E5-03 built it; this type is the
/// story's own criterion, <i>"a gap can be traced to where it should be planned"</i>. A teacher looking at a red row
/// in September cannot act on it without knowing which of four completely different situations they are in: one is
/// resolved on the kalender in two clicks, one needs a thema placed, one needs a doelsuggestie decided on
/// <c>/themas</c>, and one cannot be closed by planning at all because the school has no content for that goal.
/// </para>
/// <para>
/// <b>The four are ordered by how close the goal is to being covered</b>, and the classification takes the first
/// that applies. That ordering is not cosmetic: a doel can sit in several of these states at once (thema A carries
/// it and is placed as a proposal, thema B carries it and is nowhere), and the honest thing to report is the
/// cheapest route to closing it rather than every route at once.
/// </para>
/// <para>
/// <b>A rejected link is not a cause.</b> A <c>geweigerd</c> <c>DoelKoppeling</c> is a decision the teacher already
/// made, so a thema carrying only a rejected link to this goal does not appear in any of these states and the doel
/// falls through to <see cref="GeenThema"/>. That is why <see cref="GeenThema"/>'s copy may say "no thema covers
/// this goal" but may never say "no thema is linked to it" — the second would be false in exactly that case.
/// </para>
/// </summary>
public enum Lacuneoorzaak
{
    /// <summary>
    /// A thema that carries this goal <b>is</b> in the plan, as a proposal the teacher has not answered yet.
    /// <para>
    /// The cheapest of the four: accepting that placement covers the goal, with nothing else to change. This set is
    /// exactly <c>Dekkingsvooruitzicht.AantalMogelijkGedekt</c> minus <c>AantalGedekt</c> — the doelen E3-03 counts
    /// as "would be covered if you accepted the plan" and deliberately did not list, because listing them is this
    /// story's job. <c>DekkingsserviceTests</c> pins the two against each other, since the whole value of the figure
    /// is that a teacher can find out which doelen it is about.
    /// </para>
    /// </summary>
    WachtOpBeslissing = 0,

    /// <summary>
    /// A thema that carries this goal exists and the teacher has decided its link, but the thema sits in no period
    /// of this plan.
    /// <para>
    /// "Sits in no period" folds three states together, deliberately, because the remedy is identical for all
    /// three: never placed, placed and rejected, or placed against a period that no longer exists. Splitting them
    /// would put a distinction on screen that changes nothing a teacher does next.
    /// </para>
    /// </summary>
    NietIngepland = 1,

    /// <summary>
    /// No thema carries a decided link to this goal, but at least one has a <c>voorgesteld</c> doelsuggestie for it.
    /// <para>
    /// The decision is a link decision rather than a planning one, so it happens on <c>/themas</c> (FR-4.2) and not
    /// on the kalender. Planning the thema would not help while the link stays undecided: only
    /// <c>aanvaard</c>/<c>manueel</c> links count for dekking (Art. V.1), which is what stops the AI granting
    /// coverage (Art. IV.1).
    /// </para>
    /// </summary>
    KoppelingNietBeslist = 2,

    /// <summary>
    /// No thema covers this goal at all, decided or proposed.
    /// <para>
    /// <b>The only one of the four that planning cannot close</b>, and the only one that is genuinely about the
    /// school's content rather than about this class's year plan. It is also the honest end of Art. V.2: if the
    /// school teaches nothing that maps onto a decreed goal, a coverage overview that implied otherwise would be
    /// the exact false proof this article exists to prevent.
    /// </para>
    /// </summary>
    GeenThema = 3,
}
