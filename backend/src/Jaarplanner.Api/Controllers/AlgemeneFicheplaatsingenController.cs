using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Planning.AlgemeneFiches;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for planning an algemene fiche in the agenda (owner, 2026-09-11). All logic lives
/// in <see cref="IAlgemeneFicheplaatsingService"/>. Its own route rather than a field on the weekplanning, for the
/// reason <see cref="HoekplaatsingenController"/> gives.
/// <para>
/// <b>Rights (E6-02):</b> every write is the klas's planning, <c>KlasplanningBewerken</c> (ADR-0030 R7, R15, I21),
/// against the klas in the route or the placement's own klas. The service refuses a fiche of another klas, so a
/// placement can never write into a klas the caller was not checked for.
/// </para>
/// </summary>
[ApiController]
public sealed class AlgemeneFicheplaatsingenController : ControllerBase
{
    private readonly IAlgemeneFicheplaatsingService _service;

    public AlgemeneFicheplaatsingenController(IAlgemeneFicheplaatsingService service) => _service = service;

    [HttpGet("/api/klassen/{klasId:guid}/algemene-ficheplaatsingen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]
    public async Task<ActionResult<IReadOnlyList<AlgemeneFicheplaatsingWeergave>>> Lijst(
        Guid klasId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalVoorBereikAsync(klasId, van, tot, cancellationToken));

    [HttpPost("/api/klassen/{klasId:guid}/algemene-ficheplaatsingen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<AlgemeneFicheplaatsingWeergave>> Plaats(
        Guid klasId,
        [FromBody] AlgemeneFicheplaatsingInvoer invoer,
        CancellationToken cancellationToken)
    {
        var plaatsing = await _service.PlaatsAsync(klasId, invoer, cancellationToken);
        return Created($"/api/klassen/{klasId}/algemene-ficheplaatsingen", plaatsing);
    }

    [HttpDelete("/api/algemene-ficheplaatsingen/{plaatsingId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.AlgemeneFicheplaatsing, "plaatsingId")]
    public async Task<IActionResult> Verwijder(Guid plaatsingId, CancellationToken cancellationToken)
    {
        await _service.VerwijderAsync(plaatsingId, cancellationToken);
        return NoContent();
    }

    /// <summary>Moves or resizes ONE occurrence.</summary>
    [HttpPut("/api/algemene-ficheplaatsingen/{plaatsingId:guid}/momenten/{momentId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.AlgemeneFicheplaatsing, "plaatsingId")]
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
