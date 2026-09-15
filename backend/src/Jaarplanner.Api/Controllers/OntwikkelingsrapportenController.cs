using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the ontwikkelingsrapport of one child at one evaluatiemoment (FB-003, FR-13.3).
/// All logic lives in <see cref="IOntwikkelingsrapportService"/>. Under the leerling, since a report is always one
/// child's, and the moment in the route held to 1..3, so any other number is a 404 before anything runs.
/// <para>
/// <b>Rights (ADR-0030 §3 footnote ⁶, ADR-0035 §3.3), both on the child's klas.</b> Reading is
/// <c>OntwikkelingsrapportLezen</c>: directie, and the klas's own K3 leerkrachten, also after its schooljaar (R26); no
/// leerkracht of another klas (R17). Every write is <c>RapportInvullen</c>: directie always, and those leerkrachten only
/// during the schooljaar. The leerling is resolved before the check, so an unknown child is a 404 first.
/// </para>
/// <para>
/// <b>Pupil data (Art. VI.7).</b> Nothing here logs; the read is <c>no-store</c>, like the list of children, so no copy of
/// a report stays in a browser or proxy cache; request-body logging is off for the whole app.
/// </para>
/// </summary>
[ApiController]
[Route("api/leerlingen/{leerlingId:guid}/rapporten/{moment:int:range(1,3)}")]
public sealed class OntwikkelingsrapportenController : ControllerBase
{
    private readonly IOntwikkelingsrapportService _service;

    public OntwikkelingsrapportenController(IOntwikkelingsrapportService service) => _service = service;

    [HttpGet]
    [RechtOp(Rechtenmatrix.Beleid.OntwikkelingsrapportLezen, Rechtbron.Leerling, "leerlingId")]
    [ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<ActionResult<RapportWeergave>> Detail(Guid leerlingId, int moment, CancellationToken cancellationToken) =>
        Ok(await _service.HaalRapportOpAsync(leerlingId, moment, cancellationToken));

    [HttpPut("rapportdoelen/{rapportdoelId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    public async Task<ActionResult<BeoordelingWeergave>> BewaarBeoordeling(
        Guid leerlingId,
        int moment,
        Guid rapportdoelId,
        [FromBody] BeoordelingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.BewaarBeoordelingAsync(leerlingId, moment, rapportdoelId, invoer, cancellationToken));

    [HttpPut("besluit")]
    [RechtOp(Rechtenmatrix.Beleid.RapportInvullen, Rechtbron.Leerling, "leerlingId")]
    public async Task<ActionResult<BesluitWeergave>> BewaarBesluit(
        Guid leerlingId,
        int moment,
        [FromBody] BesluitInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.BewaarBesluitAsync(leerlingId, moment, invoer, cancellationToken));
}
