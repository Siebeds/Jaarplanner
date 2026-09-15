using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the children of a K3 klas (FB-001, FR-13.1). All logic lives in
/// <see cref="ILeerlingBeheerService"/>. Shaped like <see cref="AlgemeneFichesController"/>: the klas in the route for the
/// list and the create, the leerling alone after that.
/// <para>
/// <b>Rights (ADR-0030 §3 footnote ⁶, ADR-0035 §3.3).</b> <b>The read is gated too</b>, unlike every other GET in the app:
/// I9 does not reach a child (R17), so the list is <c>OntwikkelingsrapportLezen</c> (directie, and the klas's own K3
/// leerkrachten with no end date). Every write is <c>LeerlingenBeheren</c> (directie, and those leerkrachten only during
/// the klas's schooljaar, R26). Both resolve the klas before the check, so an unknown klas or child is a 404 first.
/// </para>
/// <para>
/// <b>Pupil data (Art. VI.7).</b> Nothing here logs, and nothing it throws names a child (ADR-0035 §3.8). Request-body
/// logging is off for the whole app, so the names in a POST or PUT reach no log either.
/// </para>
/// </summary>
[ApiController]
public sealed class LeerlingenController : ControllerBase
{
    private readonly ILeerlingBeheerService _service;

    public LeerlingenController(ILeerlingBeheerService service) => _service = service;

    /// <summary>
    /// The children of a klas. <c>no-store</c>, so neither the browser nor a proxy keeps a copy of the names outside the
    /// app: the same rule ADR-0035 §3.6 sets for the kindtekening, applied to the first pupil data a route serves.
    /// </summary>
    [HttpGet("/api/klassen/{klasId:guid}/leerlingen")]
    [RechtOp(Rechtenmatrix.Beleid.OntwikkelingsrapportLezen, Rechtbron.Rapportklas, "klasId")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<IReadOnlyList<LeerlingWeergave>>> Lijst(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalLeerlingenOpAsync(klasId, cancellationToken));

    [HttpPost("/api/klassen/{klasId:guid}/leerlingen")]
    [RechtOp(Rechtenmatrix.Beleid.LeerlingenBeheren, Rechtbron.Rapportklas, "klasId")]
    public async Task<ActionResult<LeerlingWeergave>> Maak(
        Guid klasId,
        [FromBody] LeerlingInvoer invoer,
        CancellationToken cancellationToken)
    {
        var leerling = await _service.MaakLeerlingAsync(klasId, invoer, cancellationToken);
        return Created($"/api/klassen/{klasId}/leerlingen", leerling);
    }

    [HttpPut("/api/leerlingen/{leerlingId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.LeerlingenBeheren, Rechtbron.Leerling, "leerlingId")]
    public async Task<ActionResult<LeerlingWeergave>> Wijzig(
        Guid leerlingId,
        [FromBody] LeerlingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigLeerlingAsync(leerlingId, invoer, cancellationToken));

    [HttpDelete("/api/leerlingen/{leerlingId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.LeerlingenBeheren, Rechtbron.Leerling, "leerlingId")]
    public async Task<IActionResult> Verwijder(Guid leerlingId, CancellationToken cancellationToken)
    {
        await _service.VerwijderLeerlingAsync(leerlingId, cancellationToken);
        return NoContent();
    }
}
