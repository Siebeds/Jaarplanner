using Jaarplanner.Application.Planning.AlgemeneFiches;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for planning an algemene fiche in the agenda (owner, 2026-09-11). All logic lives
/// in <see cref="IAlgemeneFicheplaatsingService"/>. Its own route rather than a field on the weekplanning, for the
/// reason <see cref="HoekplaatsingenController"/> gives.
/// </summary>
[ApiController]
public sealed class AlgemeneFicheplaatsingenController : ControllerBase
{
    private readonly IAlgemeneFicheplaatsingService _service;

    public AlgemeneFicheplaatsingenController(IAlgemeneFicheplaatsingService service) => _service = service;

    [HttpGet("/api/klassen/{klasId:guid}/algemene-ficheplaatsingen")]
    public async Task<ActionResult<IReadOnlyList<AlgemeneFicheplaatsingWeergave>>> Lijst(
        Guid klasId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalVoorBereikAsync(klasId, van, tot, cancellationToken));

    [HttpPost("/api/klassen/{klasId:guid}/algemene-ficheplaatsingen")]
    public async Task<ActionResult<AlgemeneFicheplaatsingWeergave>> Plaats(
        Guid klasId,
        [FromBody] AlgemeneFicheplaatsingInvoer invoer,
        CancellationToken cancellationToken)
    {
        var plaatsing = await _service.PlaatsAsync(klasId, invoer, cancellationToken);
        return Created($"/api/klassen/{klasId}/algemene-ficheplaatsingen", plaatsing);
    }

    [HttpDelete("/api/algemene-ficheplaatsingen/{plaatsingId:guid}")]
    public async Task<IActionResult> Verwijder(Guid plaatsingId, CancellationToken cancellationToken)
    {
        await _service.VerwijderAsync(plaatsingId, cancellationToken);
        return NoContent();
    }

    /// <summary>Moves or resizes ONE occurrence.</summary>
    [HttpPut("/api/algemene-ficheplaatsingen/{plaatsingId:guid}/momenten/{momentId:guid}")]
    public async Task<ActionResult<AlgemeneFicheplaatsingWeergave>> VerplaatsMoment(
        Guid plaatsingId,
        Guid momentId,
        [FromBody] FichemomentVerplaatsing invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerplaatsMomentAsync(
            plaatsingId,
            momentId,
            invoer.Datum,
            invoer.Begin,
            invoer.Einde,
            cancellationToken));

    /// <summary>Where one occurrence should move to.</summary>
    /// <param name="Datum">The day. May be the day it is already on.</param>
    /// <param name="Begin">When it starts.</param>
    /// <param name="Einde">When it ends. Must lie after <paramref name="Begin"/>.</param>
    public sealed record FichemomentVerplaatsing(DateOnly Datum, TimeOnly Begin, TimeOnly Einde);
}
