using Jaarplanner.Application.Schoolcontent.Beheer;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for class/age-scoped <c>Subthema</c> CRUD, its activiteiten and its
/// goal links (E1-10, FR-3.1/3.2). Linking a subthema to a leerdoel creates a manual subdoel carrying
/// the link (the per-(subthema × leeftijd) link carrier in the model, Art. IX.2; status <c>manueel</c>,
/// Art. IV.2). Scoping and validation live in the service/domain.
/// </summary>
[ApiController]
[Route("api/subthemas")]
public sealed class SubthemasController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;

    public SubthemasController(ISchoolcontentBeheerService service) => _service = service;

    /// <summary>
    /// Lists one klas's subthema's across every thema (E4-08), which is what a move's destination picker needs:
    /// the ruling of 2026-08-05 lets an activiteit cross a thema but not a klas. The klas is in the route rather
    /// than in a query string because it is the scope of the answer, not a filter on it (Art. IX.2).
    /// </summary>
    [HttpGet("voor-klas/{klasId:guid}")]
    public async Task<ActionResult<IReadOnlyList<SubthemaBestemming>>> VoorKlas(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalSubthemaBestemmingenAsync(klasId, cancellationToken));

    [HttpPut("{subthemaId:guid}")]
    public async Task<ActionResult<SubthemaWeergave>> Wijzig(Guid subthemaId, [FromBody] SubthemaWijzigingInvoer wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigSubthemaAsync(subthemaId, wijziging, cancellationToken));

    [HttpDelete("{subthemaId:guid}")]
    public async Task<IActionResult> Verwijder(Guid subthemaId, CancellationToken cancellationToken)
    {
        await _service.VerwijderSubthemaAsync(subthemaId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{subthemaId:guid}/doelkoppelingen")]
    public async Task<ActionResult<SubdoelWeergave>> KoppelAanDoel(Guid subthemaId, [FromBody] ThemasController.DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.KoppelSubthemaAanDoelAsync(subthemaId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("{subthemaId:guid}/subdoelen/{subdoelId:guid}")]
    public async Task<IActionResult> Ontkoppel(Guid subthemaId, Guid subdoelId, CancellationToken cancellationToken)
    {
        await _service.OntkoppelSubdoelAsync(subthemaId, subdoelId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{subthemaId:guid}/activiteiten")]
    public async Task<ActionResult<ActiviteitWeergave>> MaakActiviteit(Guid subthemaId, [FromBody] ActiviteitCreatie creatie, CancellationToken cancellationToken)
    {
        var activiteit = await _service.MaakActiviteitAsync(subthemaId, creatie, cancellationToken);
        return Created($"/api/activiteiten/{activiteit.Id}", activiteit);
    }
}
