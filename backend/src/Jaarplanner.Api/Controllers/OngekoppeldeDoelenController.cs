using Jaarplanner.Application.Curriculum;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the "ongekoppelde doelen" gap list (E2-06, FR-4.4): the Op.stap
/// leerplandoelen that are (nog) niet aan een thema gekoppeld. It only binds and delegates to
/// <see cref="IOngekoppeldeDoelenQuery"/>; the "linked" definition (status aanvaard/manueel, Art. V) and
/// the query live in Application/Infrastructure. The result is recomputed per request, so it reflects the
/// current link state and updates as suggestions are accepted/rejected or manual links added (FR-4.4).
/// </summary>
[ApiController]
[Route("api/leerplandoelen/ongekoppeld")]
public sealed class OngekoppeldeDoelenController : ControllerBase
{
    private readonly IOngekoppeldeDoelenQuery _query;

    public OngekoppeldeDoelenController(IOngekoppeldeDoelenQuery query) => _query = query;

    /// <summary>Lists the leerplandoelen not (yet) linked to any thema (FR-4.4).</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OngekoppeldDoelWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _query.HaalOngekoppeldeDoelenAsync(cancellationToken));
}
