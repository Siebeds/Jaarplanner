using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Planning.Rooster;
using Jaarplanner.Domain.Planning;
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
    private readonly IPlanningsroosterService _rooster;

    public SchooljarenController(ISchooljaarBeheerService service, IPlanningsroosterService rooster)
    {
        _service = service;
        _rooster = rooster;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SchooljaarWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalSchooljarenOpAsync(cancellationToken));

    /// <summary>One school year with its closures and the classes it contains (Art. IX.3).</summary>
    [HttpGet("{schooljaarId:guid}")]
    public async Task<ActionResult<SchooljaarWeergave>> Detail(Guid schooljaarId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalSchooljaarOpAsync(schooljaarId, cancellationToken));

    /// <summary>
    /// The year's <b>derived planning grid</b> (E3-06, FR-6.1): every block of the requested tier, plus the
    /// vakanties that separate them. This is what the calendar renders the ribbon from.
    /// <para>
    /// Separate from <c>GET /api/klassen/{klasId}/jaarplan</c> on purpose: that returns a class's
    /// <i>placements</i>, and a calendar built from placements alone cannot show an <b>empty</b> period — so a
    /// teacher could not see where there is room, and E3-09's "nergens gepland" tray would have no ribbon to
    /// sit against. The grid belongs to the school year, not to any one class, so it is read here.
    /// </para>
    /// </summary>
    /// <param name="niveau">
    /// Which tier to derive: <c>Themaperiode</c> (default, the "hele jaar" view) or <c>Subthemaperiode</c>
    /// (E3-08's "per periode" zoom). Deliberately a tier, never a calendar unit (Art. IX.3, ADR-0013).
    /// </param>
    [HttpGet("{schooljaarId:guid}/rooster")]
    public async Task<ActionResult<PlanningsroosterWeergave>> Rooster(
        Guid schooljaarId,
        CancellationToken cancellationToken,
        [FromQuery] Planningsblokniveau niveau = Planningsblokniveau.Themaperiode)
    {
        // ASP.NET Core binds ANY integer to an enum parameter without complaint, so `?niveau=99` bound to
        // (Planningsblokniveau)99, passed model validation, and only blew up deep in the indeling seam as an
        // unmapped ArgumentOutOfRangeException — a 500 on a public GET for what is plainly a bad request.
        // (`?niveau=Maand` was always a clean 400; only the numeric form slipped through.) Checked here rather
        // than in the service because it is a binding concern, and the seam's guard stays as the backstop.
        if (!Enum.IsDefined(niveau))
        {
            return BadRequest(new ProblemDetails
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "Onbekend planningsblokniveau",
                Detail = $"'{niveau}' is geen geldig niveau. Kies {nameof(Planningsblokniveau.Themaperiode)} " +
                         $"of {nameof(Planningsblokniveau.Subthemaperiode)}.",
            });
        }

        return Ok(await _rooster.HaalRoosterOpAsync(schooljaarId, niveau, cancellationToken));
    }

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
