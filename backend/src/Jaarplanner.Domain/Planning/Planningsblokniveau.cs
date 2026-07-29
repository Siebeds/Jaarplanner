namespace Jaarplanner.Domain.Planning;

/// <summary>
/// The tier a <see cref="Planningsblok"/> belongs to.
/// <para>
/// The two tiers are the school's <b>real pedagogical cadence</b> (ratified by directie 2026-07-14,
/// Art. IX.3): a coarse <see cref="Themaperiode"/> of 4–6 weeks carrying one thema, subdivided into
/// fine <see cref="Subthemaperiode"/>n of about 2 weeks carrying its subthema's.
/// </para>
/// <para>
/// Deliberately <b>not</b> a calendar unit. There is no <c>Maand</c> member and there must never be one:
/// Art. IX.3 forbids hard-assuming months, and ADR-0013 requires that nothing in generation, the
/// calendar, drag-and-drop or coverage reference a month. The calendar's zoom levels (E3-08) map onto
/// these two tiers — "jaar ↔ periode/blok", never "jaar ↔ maand".
/// </para>
/// </summary>
public enum Planningsblokniveau
{
    /// <summary>The coarse tier: one thema, ~4–6 weeks. The default planning grain.</summary>
    Themaperiode = 0,

    /// <summary>The fine tier: one subthema, ~2 weeks. Subdivides a <see cref="Themaperiode"/>.</summary>
    Subthemaperiode = 1,
}
