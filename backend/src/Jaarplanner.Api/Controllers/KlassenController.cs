using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
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
/// <para>
/// <b>Rights (E6-02):</b> creating, changing and deleting a klas is the row <c>Beheer</c>, directie only (ADR-0030 R2,
/// R3, R16). That includes the klas's jaarfase, which the klaskiezer lets a teacher set: since slice 3 only directie
/// may send it, and the frontend has to hide the field for anyone else (slice 4). Reads stay open (I9).
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

    /// <summary>
    /// Creates a class <b>inside a school year</b> (Art. IX.3: "Schooljaar — contains multiple klassen"; E3-01).
    /// The route carries the containment, so the body cannot disagree with it and a "rename" can never move a
    /// class to another year. Create the school year first via <c>POST /api/schooljaren</c>.
    /// </summary>
    [HttpPost("/api/schooljaren/{schooljaarId:guid}/klassen")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<ActionResult<KlasWeergave>> Maak(
        Guid schooljaarId,
        [FromBody] KlasCreatie creatie,
        CancellationToken cancellationToken)
    {
        var klas = await _service.MaakKlasAsync(schooljaarId, creatie, cancellationToken);
        return CreatedAtAction(nameof(Detail), new { klasId = klas.Id }, klas);
    }

    [HttpPut("{klasId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<ActionResult<KlasWeergave>> Wijzig(Guid klasId, [FromBody] KlasCreatie wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigKlasAsync(klasId, wijziging, cancellationToken));

    [HttpDelete("{klasId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<IActionResult> Verwijder(Guid klasId, CancellationToken cancellationToken)
    {
        await _service.VerwijderKlasAsync(klasId, cancellationToken);
        return NoContent();
    }
}
