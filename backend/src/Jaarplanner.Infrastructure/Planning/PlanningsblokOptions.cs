namespace Jaarplanner.Infrastructure.Planning;

/// <summary>
/// Options that make the planning grain <b>data-driven</b> (ADR-0013, Art. IX.3 / XIV): bound from the
/// configuration section <c>Planning:Blokindeling</c> (appsettings, environment, user-secrets, Key Vault —
/// any standard .NET config source), so the grain can change <b>without a code change</b>.
/// <para>
/// <b>The default is documented in <c>appsettings.json</c>, not only here.</b> The property initialisers
/// below are the fallback an unconfigured deployment resolves to, but a compiled-in fallback alone does not
/// satisfy E3-05's "default is documented, not compiled-in" — a deployer could not discover the section name
/// or the property names without reading Infrastructure source. So <c>appsettings.json</c> carries the
/// section with its values and a comment, exactly as <c>Opstap:DisciplineSelectie</c> does. The values encode
/// the directie decision of 2026-07-14: a themaperiode of 5 weeks (midpoint of the ratified 4–6 range)
/// subdivided into subthemaperioden of 2 weeks.
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
    /// Length of a fine subthemaperiode in weeks. Defaults to 2, per the ratified ~2 week cadence. Must not
    /// exceed <see cref="ThemaperiodeWeken"/>, since the fine tier subdivides the coarse one.
    /// Overridable purely by configuration.
    /// </summary>
    public int SubthemaperiodeWeken { get; init; } = 2;

    // There is deliberately no "minimum block length" knob. An earlier version had one, to absorb the short
    // tail left by chopping target-length blocks off the front of a teaching stretch. Blocks are now
    // distributed evenly across each stretch, so no tail is produced and the knob had nothing to do — and the
    // policy it encoded (absorb backwards below N days) was an invented answer to a pedagogical question that
    // belongs to directie, not to this class.
}
