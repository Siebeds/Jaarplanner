using Jaarplanner.Application.Schoolcontent.Beheer;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a class's algemene fiches and their goal links (owner, 2026-09-11). All logic
/// lives in <see cref="IAlgemeneFicheBeheerService"/>. Shaped like <see cref="HoekenController"/>: the klas travels in
/// the route for reads and creates, and everything after that keys on the fiche alone.
/// </summary>
[ApiController]
public sealed class AlgemeneFichesController : ControllerBase
{
    private readonly IAlgemeneFicheBeheerService _service;

    public AlgemeneFichesController(IAlgemeneFicheBeheerService service) => _service = service;

    [HttpGet("/api/klassen/{klasId:guid}/algemene-fiches")]
    public async Task<ActionResult<IReadOnlyList<AlgemeneFicheWeergave>>> Lijst(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalFichesOpAsync(klasId, cancellationToken));

    [HttpPost("/api/klassen/{klasId:guid}/algemene-fiches")]
    public async Task<ActionResult<AlgemeneFicheWeergave>> Maak(
        Guid klasId,
        [FromBody] AlgemeneFicheInvoer invoer,
        CancellationToken cancellationToken)
    {
        var fiche = await _service.MaakFicheAsync(klasId, invoer, cancellationToken);
        return Created($"/api/klassen/{klasId}/algemene-fiches", fiche);
    }

    [HttpPut("/api/algemene-fiches/{ficheId:guid}")]
    public async Task<ActionResult<AlgemeneFicheWeergave>> Wijzig(
        Guid ficheId,
        [FromBody] AlgemeneFicheInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigFicheAsync(ficheId, invoer, cancellationToken));

    [HttpDelete("/api/algemene-fiches/{ficheId:guid}")]
    public async Task<IActionResult> Verwijder(Guid ficheId, CancellationToken cancellationToken)
    {
        await _service.VerwijderFicheAsync(ficheId, cancellationToken);
        return NoContent();
    }

    /// <summary>Links a goal as a <c>manueel</c> link. Answers with the whole fiche, goal list and all.</summary>
    [HttpPost("/api/algemene-fiches/{ficheId:guid}/doelkoppelingen")]
    public async Task<ActionResult<AlgemeneFicheWeergave>> KoppelAanDoel(
        Guid ficheId,
        [FromBody] ThemasController.DoelKoppelingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.KoppelAanDoelAsync(ficheId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("/api/algemene-fiches/{ficheId:guid}/doelkoppelingen/{koppelingId:guid}")]
    public async Task<ActionResult<AlgemeneFicheWeergave>> Ontkoppel(
        Guid ficheId,
        Guid koppelingId,
        CancellationToken cancellationToken) =>
        Ok(await _service.OntkoppelDoelAsync(ficheId, koppelingId, cancellationToken));
}
