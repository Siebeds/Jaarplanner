using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the one K3 sterrenschaal (FB-002, FR-13.2, ADR-0035 R5, R7). All logic lives in
/// <see cref="IRapportsetService"/>; <see cref="RapportdoelenController"/> is its sibling for the set.
/// <para>
/// <b>Rights (ADR-0030 §3 footnote ⁶, ADR-0035 §3.3).</b> Every write is <c>RapportsetBewerken</c>: a K3 leerkracht, a
/// gebruiker with a klastoewijzing on a K3 klas in a running schooljaar (R6, D4), and <b>not directie</b>, the one row
/// directie does not pass (R31). The row needs no resource, since the scale is one for all of K3.
/// <b>The reads are open to every signed-in gebruiker</b> through the fallback policy: the scale is not pupil data, and
/// directie and a hoofdleerkracht of K3 view it (FB-002 AC5).
/// </para>
/// </summary>
[ApiController]
[Route("api/gradaties")]
public sealed class GradatiesController : ControllerBase
{
    private readonly IRapportsetService _service;

    public GradatiesController(IRapportsetService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<GradatieWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalGradatiesOpAsync(cancellationToken));

    /// <summary>The six colours a star may take, in order, each exactly as <c>kleur</c> serialises.</summary>
    [HttpGet("kleuren")]
    public ActionResult<IReadOnlyList<Sterkleur>> Kleuren() => Ok(_service.HaalKleurenOp());

    [HttpPost]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<ActionResult<GradatieWeergave>> Maak([FromBody] GradatieInvoer invoer, CancellationToken cancellationToken)
    {
        var gradatie = await _service.MaakGradatieAsync(invoer, cancellationToken);
        return Created("/api/gradaties", gradatie);
    }

    [HttpPut("volgorde")]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<IActionResult> Orden([FromBody] VolgordeInvoer invoer, CancellationToken cancellationToken)
    {
        await _service.OrdenGradatiesAsync(invoer, cancellationToken);
        return NoContent();
    }

    [HttpPut("{gradatieId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<ActionResult<GradatieWeergave>> Wijzig(
        Guid gradatieId,
        [FromBody] GradatieInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigGradatieAsync(gradatieId, invoer, cancellationToken));

    [HttpDelete("{gradatieId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]
    public async Task<IActionResult> Verwijder(Guid gradatieId, CancellationToken cancellationToken)
    {
        await _service.VerwijderGradatieAsync(gradatieId, cancellationToken);
        return NoContent();
    }
}
