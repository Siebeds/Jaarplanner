using Jaarplanner.Application.AiAuthoring;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) exposing the goal-first authoring assist hooks the thema-opbouw
/// wizard calls (E2-07, Art. IV.8, Gap A.7): AI suggestions at <b>step 2</b> (themadoelen for the
/// whole thema) and <b>step 6</b> (subdoelen for a subthema × leeftijd). The wizard UI itself lives
/// in E1/E6 beheer; this controller only provides the callable backend seam.
/// <para>
/// All logic lives in <see cref="IThemaOpbouwAssistService"/>; the controller only binds, delegates
/// and returns the advisory result. Both hooks are <b>advisory only</b> — they return transient
/// suggestions and never persist or auto-create a themadoel/subdoel (Art. IV.1/IV.2). A malformed AI
/// response is a routine, expected case (Art. IV.5): it comes back as <c>200 OK</c> with a result
/// whose <c>isGeslaagd = false</c> and a diagnostic <c>fout</c>, mirroring the result-type philosophy
/// of the matching flow — running the assist succeeded even when the model's output was unusable.
/// </para>
/// </summary>
[ApiController]
[Route("api/thema-opbouw")]
public sealed class ThemaOpbouwController : ControllerBase
{
    private readonly IThemaOpbouwAssistService _service;

    public ThemaOpbouwController(IThemaOpbouwAssistService service) => _service = service;

    /// <summary>Step 2: request advisory themadoel suggestions for the thema being authored.</summary>
    [HttpPost("themadoel-suggesties")]
    public async Task<ActionResult<ThemaOpbouwAdviesResultaat>> Themadoelen(
        [FromBody] ThemadoelSuggestieVerzoek verzoek,
        CancellationToken cancellationToken) =>
        Ok(await _service.StelThemadoelenVoorAsync(verzoek, cancellationToken));

    /// <summary>Step 6: request advisory subdoel suggestions for the subthema (× leeftijd) being authored.</summary>
    [HttpPost("subdoel-suggesties")]
    public async Task<ActionResult<ThemaOpbouwAdviesResultaat>> Subdoelen(
        [FromBody] SubdoelSuggestieVerzoek verzoek,
        CancellationToken cancellationToken) =>
        Ok(await _service.StelSubdoelenVoorAsync(verzoek, cancellationToken));
}
