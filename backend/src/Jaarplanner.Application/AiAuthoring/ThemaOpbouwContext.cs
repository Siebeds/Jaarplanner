namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// The <b>transient</b> thema context the thema-opbouw wizard sends when it asks for AI assist
/// (E2-07, Art. IV.8). It is deliberately not the persisted <c>Thema</c> aggregate: goal-first
/// authoring runs <b>while the teacher is still building</b> the thema (steps 1–2), so the thema may
/// not yet be saved. The wizard passes the in-progress attributes here; nothing is read from or
/// written to the database by the assist (Art. IV.1/IV.2 — advisory only).
/// <para>
/// Every field is school-owned autonomous content (Art. III): the thema name, its angles, the
/// two-tier woordenschat, and any themadoel codes already chosen. This is the <b>only</b> school
/// data that reaches the prompt for the whole-thema (step 2) grounding (Art. IV.4).
/// </para>
/// </summary>
public sealed record ThemaOpbouwContext
{
    /// <summary>The (working) thema name. Required — a thema is authored around a strong theme.</summary>
    public required string Naam { get; init; }

    /// <summary>Optional angles of approach for the thema (invalshoeken).</summary>
    public string? Invalshoeken { get; init; }

    /// <summary>The intended themaperiode duration in weeks (≈ 4–6); optional while authoring.</summary>
    public int? DuurWeken { get; init; }

    /// <summary>Kernwoordenschat (basiswoorden) — school-wide; optional while authoring.</summary>
    public IReadOnlyCollection<string>? Kernwoordenschat { get; init; }

    /// <summary>Rijke (thema)woordenschat — school-wide; optional while authoring.</summary>
    public IReadOnlyCollection<string>? RijkeWoordenschat { get; init; }

    /// <summary>
    /// The leerplandoel codes already chosen as the 2–3 overarching themadoelen (step 2 output). At
    /// step 6 these anchor the subdoel suggestions ("build up toward the themadoelen", Art. IX.2) and
    /// are excluded from the returned candidates so the wizard never re-proposes an anchor.
    /// </summary>
    public IReadOnlyCollection<string>? GekozenThemadoelCodes { get; init; }
}
