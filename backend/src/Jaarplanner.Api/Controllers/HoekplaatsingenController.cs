using Jaarplanner.Application.Planning.Hoeken;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for placing a hoek on the agenda (owner, meeting 2026-08-30). All logic lives
/// in <see cref="IHoekplaatsingService"/>.
/// <para>
/// <b>Its own route rather than a field on the weekplanning.</b> The agenda fetches this alongside its days,
/// which is one more request and the price of keeping hoeken out of the jaarplan read model. What that buys is
/// in <c>Hoekplaatsing</c>'s own documentation: a (re)generation cannot reach what it cannot see.
/// </para>
/// </summary>
[ApiController]
public sealed class HoekplaatsingenController : ControllerBase
{
    private readonly IHoekplaatsingService _service;

    public HoekplaatsingenController(IHoekplaatsingService service) => _service = service;

    /// <summary>Every placement overlapping the range, so the calendar can draw the days on screen.</summary>
    [HttpGet("/api/klassen/{klasId:guid}/hoekplaatsingen")]
    public async Task<ActionResult<IReadOnlyList<HoekplaatsingWeergave>>> Lijst(
        Guid klasId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalVoorBereikAsync(klasId, van, tot, cancellationToken));

    [HttpPost("/api/klassen/{klasId:guid}/hoekplaatsingen")]
    public async Task<ActionResult<HoekplaatsingWeergave>> Plaats(
        Guid klasId,
        [FromBody] HoekplaatsingInvoer invoer,
        CancellationToken cancellationToken)
    {
        var plaatsing = await _service.PlaatsAsync(klasId, invoer, cancellationToken);
        return Created($"/api/klassen/{klasId}/hoekplaatsingen", plaatsing);
    }

    [HttpDelete("/api/hoekplaatsingen/{plaatsingId:guid}")]
    public async Task<IActionResult> Verwijder(Guid plaatsingId, CancellationToken cancellationToken)
    {
        await _service.VerwijderAsync(plaatsingId, cancellationToken);
        return NoContent();
    }
}
