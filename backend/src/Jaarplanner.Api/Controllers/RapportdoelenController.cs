using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the one K3 set of rapportdoelen (FB-002, FR-13.2, ADR-0035 R3, R4, R7). All
/// logic lives in <see cref="IRapportsetService"/>, including which subdoelen a rapportdoel may bundle (D11, D12).
/// <para>
/// <b>Rights</b> as on <see cref="GradatiesController"/>: every write is <c>RapportsetBewerken</c> (the K3 leerkrachten
/// during a running schooljaar, not admin, R31), and the reads are open to every signed-in gebruiker, because the set
/// is not pupil data and admin and a hoofdleerkracht of K3 view it (FB-002 AC5).
/// </para>
/// </summary>
[ApiController]
[Route("api/rapportdoelen")]
public sealed class RapportdoelenController : ControllerBase
{
    private readonly IRapportsetService _service;

    public RapportdoelenController(IRapportsetService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RapportdoelWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalRapportdoelenOpAsync(cancellationToken));

    /// <summary>Every subdoel a rapportdoel may bundle: decided, under a K3 subthema. The picker's list.</summary>
    [HttpGet("kandidaten")]
    public async Task<ActionResult<IReadOnlyList<RapportdoelSubdoelWeergave>>> Kandidaten(CancellationToken cancellationToken) =>
        Ok(await _service.HaalKandidatenOpAsync(cancellationToken));

    [HttpPost]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<ActionResult<RapportdoelWeergave>> Maak([FromBody] RapportdoelInvoer invoer, CancellationToken cancellationToken)
    {
        var rapportdoel = await _service.MaakRapportdoelAsync(invoer, cancellationToken);
        return Created("/api/rapportdoelen", rapportdoel);
    }

    [HttpPut("volgorde")]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<IActionResult> Orden([FromBody] VolgordeInvoer invoer, CancellationToken cancellationToken)
    {
        await _service.OrdenRapportdoelenAsync(invoer, cancellationToken);
        return NoContent();
    }

    [HttpPut("{rapportdoelId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<ActionResult<RapportdoelWeergave>> Wijzig(
        Guid rapportdoelId,
        [FromBody] RapportdoelInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigRapportdoelAsync(rapportdoelId, invoer, cancellationToken));

    [HttpDelete("{rapportdoelId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<IActionResult> Verwijder(Guid rapportdoelId, CancellationToken cancellationToken)
    {
        await _service.VerwijderRapportdoelAsync(rapportdoelId, cancellationToken);
        return NoContent();
    }
}
