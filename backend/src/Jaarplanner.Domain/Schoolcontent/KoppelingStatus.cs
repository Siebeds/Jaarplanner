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
