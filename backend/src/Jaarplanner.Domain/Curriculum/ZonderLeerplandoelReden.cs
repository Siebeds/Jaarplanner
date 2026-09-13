namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// Why no loaded leerplandoel concords a <see cref="Minimumdoel"/>, as far as the last applied leerplandoelen import could
/// tell from its snapshot (E1-22, owner ruling 2026-09-13 "Reden tonen"). Import metadata like
/// <see cref="Minimumdoel.NietMeerInOpstap"/>: derived from KOV's snapshot, written only by the import, never decreed
/// content. When nothing is known (no leerplandoelen import yet, a goal that could be imported but whose discipline was not,
/// anything else) a minimumdoel carries no reason at all, and a screen says only that no loaded leerplandoel refers to it.
/// </summary>
public enum ZonderLeerplandoelReden
{
    /// <summary>In the snapshot, only goals of goal sets the import does not take concord to it (for example zwemdoelen).</summary>
    AlleenOvergeslagenDoelsets = 1,

    /// <summary>No goal in the snapshot concords to it.</summary>
    GeenDoelInOpstap = 2,

    /// <summary>A gemeenschappelijk goal concords to it, and the mapping refused that goal, so it was not imported.</summary>
    DoelNietIngelezen = 3,
}
