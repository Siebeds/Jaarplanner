namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// The human-in-the-loop status of a <see cref="DoelKoppeling"/> (Art. IV.2): every link
/// between school content and a leerplandoel — whether AI-proposed or teacher-made — carries
/// a persisted status. The AI only ever produces <see cref="Voorgesteld"/>; the teacher decides
/// <see cref="Aanvaard"/> / <see cref="Geweigerd"/>, and a link the teacher created by hand is
/// <see cref="Manueel"/>. Only <see cref="Aanvaard"/> and <see cref="Manueel"/> count toward
/// coverage (Art. V.1).
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
