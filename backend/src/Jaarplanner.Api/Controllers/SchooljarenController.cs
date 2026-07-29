using Jaarplanner.Application.Planning.Beheer;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for <c>Schooljaar</c> creation and reading (Art. IX.3, E3-01). All logic lives
/// in <see cref="ISchooljaarBeheerService"/>; validation/not-found surface via the shared exception handler.
/// <para>
/// It exists because E3-01 made a <c>Schooljaar</c> a <b>required</b> container for a <c>Klas</c>, and a required
/// container with no creation path would have made class creation — and therefore jaarplan generation —
/// unreachable. Deliberately create/read only: editing a year's vakanties reshapes the derived grid and can strand
/// jaarplan placements, which must raise a review signal rather than move anything (directie 2026-07-28); that
/// signal is E3-07/E3-09, and full schooljaarbeheer stays <b>E6-03</b>.
/// </para>
/// </summary>
[ApiController]
[Route("api/schooljaren")]
public sealed class SchooljarenController : ControllerBase
{
    private readonly ISchooljaarBeheerService _service;

    public SchooljarenController(ISchooljaarBeheerService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SchooljaarWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalSchooljarenOpAsync(cancellationToken));

    /// <summary>One school year with its closures and the classes it contains (Art. IX.3).</summary>
    [HttpGet("{schooljaarId:guid}")]
    public async Task<ActionResult<SchooljaarWeergave>> Detail(Guid schooljaarId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalSchooljaarOpAsync(schooljaarId, cancellationToken));

    /// <summary>
    /// Creates a school year with its vakantie-/periodestructuur. Each closure is classified
    /// <c>Vakantie</c> (breaks a planning period) or <c>VrijeDag</c> (does not) — data the school owns, never a
    /// threshold in code (ADR-0020 §5).
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<SchooljaarWeergave>> Maak(
        [FromBody] SchooljaarCreatie creatie,
        CancellationToken cancellationToken)
    {
        var schooljaar = await _service.MaakSchooljaarAsync(creatie, cancellationToken);

        return CreatedAtAction(nameof(Detail), new { schooljaarId = schooljaar.Id }, schooljaar);
    }
}
