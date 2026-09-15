namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// Who wrote a text of the ontwikkelingsrapport: the text of a <see cref="Rapportbeoordeling"/> or the algemeen besluit
/// (Art. IX.4, Art. IV.2 as amended for the rewrite, ADR-0035 §3.5).
/// <para>
/// <b>Two values, not the four of <c>KoppelingStatus</c>.</b> A rewrite proposal is never stored, so a text is never
/// <c>voorgesteld</c>; and a <c>geweigerd</c> rewrite is a mark beside the text, not the text's own status, because the
/// saved text stays as it was (R23). That mark arrives with FB-004.
/// </para>
/// <para>
/// Stored and serialised by name, like <c>KoppelingStatus</c> and <c>Sterkleur</c>, so reordering the members never
/// changes what a stored row means.
/// </para>
/// </summary>
public enum Tekststatus
{
    /// <summary>manueel: the teacher typed the text, or edited an AI proposal before saving it.</summary>
    Manueel = 0,

    /// <summary>aanvaard: an AI rewrite saved unchanged (FB-004). Nothing sets it before then.</summary>
    Aanvaard = 1,
}
