using Jaarplanner.Application.Schoolcontent.Beheer;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for class/age-scoped <c>Activiteit</c> CRUD and its goal links
/// (E1-10, FR-3.1/3.2). An activiteit may carry one or more leerdoel links, each persisted with status
/// <c>manueel</c> for a manual link (Art. IV.2). Scoping and validation live in the service/domain.
/// </summary>
[ApiController]
[Route("api/activiteiten")]
public sealed class ActiviteitenController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;

    public ActiviteitenController(ISchoolcontentBeheerService service) => _service = service;

    [HttpPut("{activiteitId:guid}")]
    public async Task<ActionResult<ActiviteitWeergave>> Wijzig(Guid activiteitId, [FromBody] ActiviteitWijzigingInvoer wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigActiviteitAsync(activiteitId, wijziging, cancellationToken));

    [HttpDelete("{activiteitId:guid}")]
    public async Task<IActionResult> Verwijder(Guid activiteitId, CancellationToken cancellationToken)
    {
        await _service.VerwijderActiviteitAsync(activiteitId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{activiteitId:guid}/doelkoppelingen")]
    public async Task<ActionResult<DoelKoppelingWeergave>> KoppelAanDoel(Guid activiteitId, [FromBody] ThemasController.DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.KoppelActiviteitAanDoelAsync(activiteitId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("{activiteitId:guid}/doelkoppelingen/{koppelingId:guid}")]
    public async Task<IActionResult> Ontkoppel(Guid activiteitId, Guid koppelingId, CancellationToken cancellationToken)
    {
        await _service.OntkoppelActiviteitDoelAsync(activiteitId, koppelingId, cancellationToken);
        return NoContent();
    }
}
