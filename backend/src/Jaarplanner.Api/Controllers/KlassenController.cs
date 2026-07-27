using Jaarplanner.Application.Planning.Beheer;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for <c>Klas</c> CRUD (Art. IX.3). All logic lives in
/// <see cref="IKlasBeheerService"/>; validation/not-found surface via the shared exception handler.
/// <para>
/// Without this endpoint a fresh deployment had no way to create a class, so every class-scoped
/// subthema/activiteit was rejected or silently dropped on import, and E3's per-class jaarplan
/// generation had nothing to generate for.
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen")]
public sealed class KlassenController : ControllerBase
{
    private readonly IKlasBeheerService _service;

    public KlassenController(IKlasBeheerService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<KlasWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalKlassenOpAsync(cancellationToken));

    [HttpGet("{klasId:guid}")]
    public async Task<ActionResult<KlasWeergave>> Detail(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalKlasOpAsync(klasId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<KlasWeergave>> Maak([FromBody] KlasCreatie creatie, CancellationToken cancellationToken)
    {
        var klas = await _service.MaakKlasAsync(creatie, cancellationToken);
        return CreatedAtAction(nameof(Detail), new { klasId = klas.Id }, klas);
    }

    [HttpPut("{klasId:guid}")]
    public async Task<ActionResult<KlasWeergave>> Wijzig(Guid klasId, [FromBody] KlasCreatie wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigKlasAsync(klasId, wijziging, cancellationToken));

    [HttpDelete("{klasId:guid}")]
    public async Task<IActionResult> Verwijder(Guid klasId, CancellationToken cancellationToken)
    {
        await _service.VerwijderKlasAsync(klasId, cancellationToken);
        return NoContent();
    }
}
