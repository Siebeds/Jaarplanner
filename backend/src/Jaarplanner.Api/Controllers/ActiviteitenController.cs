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

    /// <summary>
    /// Moves the activiteit to another subthema (E4-08, FR-7.2) with its attributes and goal links intact.
    /// A separate route from <c>PUT {activiteitId}</c> on purpose: the edit payload carries the activiteit's
    /// own fields, while this one carries its <b>place</b>, and folding the parent into the edit form would
    /// make every rename able to re-parent silently.
    /// </summary>
    [HttpPut("{activiteitId:guid}/subthema")]
    public async Task<ActionResult<ActiviteitWeergave>> Verplaats(Guid activiteitId, [FromBody] ActiviteitVerplaatsingInvoer verplaatsing, CancellationToken cancellationToken) =>
        Ok(await _service.VerplaatsActiviteitAsync(activiteitId, verplaatsing.DoelSubthemaId, cancellationToken));

    [HttpPost("{activiteitId:guid}/doelkoppelingen")]
    public async Task<ActionResult<DoelKoppelingWeergave>> KoppelAanDoel(Guid activiteitId, [FromBody] ThemasController.DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.KoppelActiviteitAanDoelAsync(activiteitId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("{activiteitId:guid}/doelkoppelingen/{koppelingId:guid}")]
    public async Task<IActionResult> Ontkoppel(Guid activiteitId, Guid koppelingId, CancellationToken cancellationToken)
    {
        await _service.OntkoppelActiviteitDoelAsync(activiteitId, koppelingId, cancellationToken);
        return NoContent();
    }

    /// <summary>Links or unlinks an activiteit to an onderzoeksvraag. Send null to clear.</summary>
    [HttpPut("{activiteitId:guid}/onderzoeksvraag")]
    public async Task<ActionResult<ActiviteitWeergave>> KoppelAanOnderzoeksvraag(
        Guid activiteitId,
        [FromBody] OnderzoeksvraagKoppelingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.KoppelActiviteitAanOnderzoeksvraagAsync(activiteitId, invoer.OnderzoeksvraagId, cancellationToken));

    /// <summary>Payload for linking/unlinking an activiteit to an onderzoeksvraag.</summary>
    public sealed record OnderzoeksvraagKoppelingInvoer(Guid? OnderzoeksvraagId);
}
