namespace Jaarplanner.Application.AiAuthoring;

/// <summary>
/// The goal-first authoring assist (E2-07, Art. IV.8) — the backend seam the thema-opbouw wizard
/// calls for AI suggestions at <b>step 2</b> (themadoelen for the whole thema) and <b>step 6</b>
/// (subdoelen for a <c>(subthema × leeftijd)</c>). It wires the flow end-to-end behind the injectable
/// <c>IAiClient</c> (E2-01) and <see cref="ILeerdoelCatalogus"/> (E2-07) seams, so it runs against
/// fakes with <b>no network and no database</b> in tests (Art. IV.6).
/// <para>
/// Both operations are <b>advisory only</b>: they return transient suggestions and <b>never</b>
/// persist or auto-create a themadoel/subdoel (Art. IV.1/IV.2). The wizard persists an accepted
/// suggestion via the existing beheer endpoints (E1/E6). Suggestions are grounded solely on the
/// wizard's transient context + the loaded Op.stap goals (Art. IV.4).
/// </para>
/// </summary>
public interface IThemaOpbouwAssistService
{
    /// <summary>Step 2: proposes candidate leerplandoelen to anchor the whole thema as themadoelen.</summary>
    Task<ThemaOpbouwAdviesResultaat> StelThemadoelenVoorAsync(
        ThemadoelSuggestieVerzoek verzoek,
        CancellationToken cancellationToken = default);

    /// <summary>Step 6: proposes age-differentiated candidate leerplandoelen for a subthema as subdoelen.</summary>
    Task<ThemaOpbouwAdviesResultaat> StelSubdoelenVoorAsync(
        SubdoelSuggestieVerzoek verzoek,
        CancellationToken cancellationToken = default);
}

/// <summary>The step-2 request: the thema being authored + an optional leerdoel-selection filter.</summary>
public sealed record ThemadoelSuggestieVerzoek
{
    /// <summary>The (transient) thema context to ground on. Required.</summary>
    public required ThemaOpbouwContext Thema { get; init; }

    /// <summary>Optional filter bounding which Op.stap leerplandoelen are offered as candidates; defaults to all.</summary>
    public LeerdoelSelectie? Selectie { get; init; }
}

/// <summary>The step-6 request: the thema + subthema being authored + an optional leerdoel-selection filter.</summary>
public sealed record SubdoelSuggestieVerzoek
{
    /// <summary>The (transient) thema context to ground on. Required.</summary>
    public required ThemaOpbouwContext Thema { get; init; }

    /// <summary>The (transient) subthema context (with its required leeftijd) to ground on. Required.</summary>
    public required SubthemaOpbouwContext Subthema { get; init; }

    /// <summary>Optional filter bounding which Op.stap leerplandoelen are offered as candidates; defaults to all.</summary>
    public LeerdoelSelectie? Selectie { get; init; }
}
