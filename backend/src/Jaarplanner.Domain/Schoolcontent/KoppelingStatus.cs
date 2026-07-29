namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// The human-in-the-loop status vocabulary of Art. IV.2 — <c>voorgesteld / aanvaard / geweigerd / manueel</c>.
/// Every AI-touched link carries one, persisted: the AI only ever produces <see cref="Voorgesteld"/>; the
/// teacher decides <see cref="Aanvaard"/> / <see cref="Geweigerd"/>, and something the teacher created by hand
/// is <see cref="Manueel"/>. Only <see cref="Aanvaard"/> and <see cref="Manueel"/> count toward coverage
/// (Art. V.1).
/// <para>
/// Used by <see cref="DoelKoppeling"/> (school content ↔ leerplandoel, Art. IX.2) and by
/// <c>Themaplaatsing</c> (thema ↔ planningsblok, Art. IX.3). It is deliberately <b>one</b> enum: the
/// constitution names one status vocabulary, and a second copy in the planning namespace would be four
/// identical members waiting to drift apart. It lives here because this is where the first consumer put it;
/// the type is domain-wide, not schoolcontent-specific.
/// </para>
/// <para>
/// <b>One divergence between the two consumers, written down because it is not obvious from the member names.</b>
/// <see cref="Geweigerd"/> means slightly more on a <c>Themaplaatsing</c> than on a <see cref="DoelKoppeling"/>:
/// </para>
/// <list type="bullet">
/// <item>On a <see cref="DoelKoppeling"/> it is purely negative — the link exists but "does not count" toward
/// dekking (Art. V.1). It blocks nothing else.</item>
/// <item>On a <c>Themaplaatsing</c> it <b>additionally occupies the slot</b>. A rejected placement is kept, because
/// a human decision is not the generator's to discard (Art. IV.1), and it therefore suppresses the AI from
/// re-proposing that thema in that block. Generation reports this as <c>Afgewezen</c> rather than <c>Duplicaten</c>
/// so the teacher's own decision is never mislabelled as AI repetition.</item>
/// </list>
/// <para>
/// Consequence, deliberately left open at E3-01: there is no path to remove a rejected placement, so the
/// suppression is permanent for now. A delete path is E3-07's scope (see the E3-01 worklog).
/// </para>
/// </summary>
public enum KoppelingStatus
{
    /// <summary>voorgesteld — AI-proposed, awaiting a teacher decision (never auto-applied; Art. IV.1).</summary>
    Voorgesteld = 0,

    /// <summary>aanvaard — the teacher accepted the suggestion; counts toward coverage (Art. V.1).</summary>
    Aanvaard = 1,

    /// <summary>geweigerd — the teacher rejected the suggestion; does not count toward coverage.</summary>
    Geweigerd = 2,

    /// <summary>manueel — a teacher-created link (not AI-originated); counts toward coverage (Art. V.1).</summary>
    Manueel = 3,
}
