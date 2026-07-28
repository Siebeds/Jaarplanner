namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// Options that make the planning grain <b>data-driven</b> (ADR-0013, Art. IX.3 / XIV): bound from the
/// configuration section <c>Planning:Blokindeling</c> (appsettings, environment, user-secrets, Key Vault —
/// any standard .NET config source), so the grain can change <b>without a code change</b>.
/// <para>
/// <b>The default lives here, in configuration space — not in planning logic.</b> When the section is
/// absent these values are what an unconfigured deployment resolves to, and they encode the directie
/// decision of 2026-07-14: a themaperiode of 5 weeks (the midpoint of the ratified 4–6 range) subdivided
/// into subthemaperioden of 2 weeks. E3-05's acceptance criterion is precisely this: "the block unit is
/// configurable behind a seam; default is documented, not compiled-in."
/// </para>
/// <para>
/// <b>Weeks, deliberately — never months.</b> There is no month option and there must not be one
/// (Art. IX.3 forbids assuming months; ADR-0013 forbids referencing them anywhere in planning). A school
/// wanting a different cadence sets a different number of weeks.
/// </para>
/// <para>
/// Per Art. IX.3 the vakantie-/periodestructuur belongs to the <c>Schooljaar</c>; these options govern only
/// how long a block is, and the schooljaar's vacations govern where blocks break.
/// </para>
/// </summary>
public sealed class PlanningsblokOptions
{
    /// <summary>Configuration section name: <c>Planning:Blokindeling</c>.</summary>
    public const string SectionName = "Planning:Blokindeling";

    /// <summary>
    /// Length of a coarse themaperiode in weeks. Defaults to 5 — the midpoint of the ratified 4–6 week
    /// range (directie 2026-07-14). Overridable purely by configuration.
    /// </summary>
    public int ThemaperiodeWeken { get; init; } = 5;

    /// <summary>
    /// Length of a fine subthemaperiode in weeks. Defaults to 2, per the ratified ~2 week cadence.
    /// Overridable purely by configuration.
    /// </summary>
    public int SubthemaperiodeWeken { get; init; } = 2;

    /// <summary>
    /// The shortest tail (in days) that still becomes its own block. A teaching stretch's remainder shorter
    /// than this is absorbed into the preceding block rather than becoming a stub of a few days — a
    /// two-day "period" is not something a teacher can plan a thema into. Defaults to 5 (a school week).
    /// </summary>
    public int MinimumBlokDagen { get; init; } = 5;
}
