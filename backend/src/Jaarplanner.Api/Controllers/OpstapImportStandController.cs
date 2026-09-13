using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum.Import;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// The state of the Op.stap import (E1-22): how many minimumdoelen are stored and which leerplandoelen snapshot was
/// applied last. The import screen reads it to order its flow (minimumdoelen first) and to decide whether the Excel
/// upload is still offered (Art. VII.2). Why this is its own read and not the preview's <c>vorigeVersie</c> is on
/// <see cref="IOpstapImportStandQuery"/>.
/// <para>
/// Behind the same <see cref="CurriculumbeheerAutorisatie.Beleid"/> policy as the imports it describes, because only the
/// import screen uses it. Read-only; it never calls KOV.
/// </para>
/// </summary>
[ApiController]
[Authorize(Policy = CurriculumbeheerAutorisatie.Beleid)]
[Route("api/opstap-import/stand")]
public sealed class OpstapImportStandController : ControllerBase
{
    private readonly IOpstapImportStandQuery _query;

    public OpstapImportStandController(IOpstapImportStandQuery query) => _query = query;

    /// <summary>The number of stored minimumdoelen and the last applied leerplandoelen snapshot, or null.</summary>
    [HttpGet]
    public async Task<ActionResult<OpstapImportStand>> Stand(CancellationToken cancellationToken) =>
        Ok(await _query.HaalOpAsync(cancellationToken));
}
