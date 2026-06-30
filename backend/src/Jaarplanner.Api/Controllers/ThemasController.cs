using Jaarplanner.Application.Schoolcontent.Beheer;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for school-wide <c>Thema</c> CRUD and the 2–3 <c>Themadoel</c>en
/// per thema (E1-10, FR-3.1/3.2). All logic lives in <see cref="ISchoolcontentBeheerService"/>; the
/// controller only binds, delegates and maps results. Level scoping and the goal-link rules are
/// enforced in the service/domain (Art. IX.2 / IV.2); validation/not-found surface via the shared
/// exception handler in Program.cs.
/// </summary>
[ApiController]
[Route("api/themas")]
public sealed class ThemasController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;

    public ThemasController(ISchoolcontentBeheerService service) => _service = service;

    /// <summary>Body for adding a manual themadoel/goal link: just the read-only leerplandoel code (Art. III.5).</summary>
    public sealed record DoelKoppelingInvoer(string LeerplandoelCode);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ThemaWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemasOpAsync(cancellationToken));

    [HttpGet("{themaId:guid}")]
    public async Task<ActionResult<ThemaWeergave>> Detail(Guid themaId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemaOpAsync(themaId, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ThemaWeergave>> Maak([FromBody] ThemaCreatie creatie, CancellationToken cancellationToken)
    {
        var thema = await _service.MaakThemaAsync(creatie, cancellationToken);
        return CreatedAtAction(nameof(Detail), new { themaId = thema.Id }, thema);
    }

    [HttpPut("{themaId:guid}")]
    public async Task<ActionResult<ThemaWeergave>> Wijzig(Guid themaId, [FromBody] ThemaWijziging wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigThemaAsync(themaId, wijziging, cancellationToken));

    [HttpDelete("{themaId:guid}")]
    public async Task<IActionResult> Verwijder(Guid themaId, CancellationToken cancellationToken)
    {
        await _service.VerwijderThemaAsync(themaId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{themaId:guid}/themadoelen")]
    public async Task<ActionResult<ThemadoelWeergave>> VoegThemadoelToe(Guid themaId, [FromBody] DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.VoegThemadoelToeAsync(themaId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("{themaId:guid}/themadoelen/{themadoelId:guid}")]
    public async Task<IActionResult> VerwijderThemadoel(Guid themaId, Guid themadoelId, CancellationToken cancellationToken)
    {
        await _service.VerwijderThemadoelAsync(themaId, themadoelId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{themaId:guid}/subthemas")]
    public async Task<ActionResult<SubthemaWeergave>> MaakSubthema(Guid themaId, [FromBody] SubthemaCreatie creatie, CancellationToken cancellationToken)
    {
        var subthema = await _service.MaakSubthemaAsync(themaId, creatie, cancellationToken);
        // The subthema is part of the thema aggregate; its full state is read via GET /api/themas/{id}.
        return Created($"/api/themas/{themaId}", subthema);
    }
}
