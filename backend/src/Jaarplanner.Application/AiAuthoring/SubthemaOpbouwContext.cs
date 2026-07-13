namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// The <b>transient</b> subthema context the wizard sends at step 6 (subdoelselectie, Art. IV.8) —
/// a subthema being authored for one class/age. Subdoelen are concrete and <b>age-differentiated</b>
/// per <c>(subthema × leeftijd)</c> (Art. IX.2), so the <see cref="Leeftijd"/> is required and steers
/// the suggestions. As with <see cref="ThemaOpbouwContext"/> this is not the persisted aggregate: the
/// subthema may not be saved yet, and the assist is advisory only (Art. IV.1/IV.2).
/// </summary>
public sealed record SubthemaOpbouwContext
{
    /// <summary>The (working) subthema name. Required.</summary>
    public required string Naam { get; init; }

    /// <summary>The age this subthema/subdoel is scoped to (e.g. "1K", "3K", "L4"). Required (Art. IX.2).</summary>
    public required string Leeftijd { get; init; }

    /// <summary>The subthemaperiode duration in weeks (≈ 2); optional while authoring.</summary>
    public int? DuurWeken { get; init; }

    /// <summary>The driving problem statement of the kennisrijk subthema; optional.</summary>
    public string? Probleemstelling { get; init; }

    /// <summary>The driving research question of the kennisrijk subthema; optional.</summary>
    public string? Onderzoeksvraag { get; init; }

    /// <summary>The (planned) activiteiten that realise this subthema; optional grounding context.</summary>
    public IReadOnlyCollection<ActiviteitOpbouwContext>? Activiteiten { get; init; }
}

/// <summary>
/// A single (planned) activiteit as the wizard describes it during authoring. Free-text
/// <see cref="Type"/> keeps the transient wizard input decoupled from the persisted
/// <c>ActiviteitType</c> enum — the assist only reads it as extra grounding context.
/// </summary>
public sealed record ActiviteitOpbouwContext
{
    /// <summary>The activiteit name. Required.</summary>
    public required string Naam { get; init; }

    /// <summary>An optional free-text activity type/soort as the teacher describes it.</summary>
    public string? Type { get; init; }

    /// <summary>The optional hoek the activiteit is set in.</summary>
    public string? Hoek { get; init; }

    /// <summary>The optional expected outcomes of the activiteit.</summary>
    public string? VerwachteUitkomsten { get; init; }
}
