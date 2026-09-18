using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Planning.Rooster;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
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
/// <para>
/// <b>The klassen inside a schooljaar</b> are only those the gebruiker may read (FB-013, ADR-0040), the same list
/// <c>GET /api/klassen</c> gives, so no route names a klas the planning routes would refuse. The schooljaar itself,
/// its dates and its closures, is the school's calendar and stays readable to every signed-in gebruiker.
/// </para>
/// </summary>
[ApiController]
[Route("api/schooljaren")]
public sealed class SchooljarenController : ControllerBase
{
    private readonly ISchooljaarBeheerService _service;
    private readonly IPlanningsroosterService _rooster;
    private readonly IKlasBeheerService _klassen;
    private readonly IAuthorizationService _autorisatie;

    public SchooljarenController(
        ISchooljaarBeheerService service,
        IPlanningsroosterService rooster,
        IKlasBeheerService klassen,
        IAuthorizationService autorisatie)
    {
        _service = service;
        _rooster = rooster;
        _klassen = klassen;
        _autorisatie = autorisatie;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SchooljaarWeergave>>> Lijst(CancellationToken cancellationToken)
    {
        var leesbaar = await LeesbareKlasIdsAsync(cancellationToken);
        var jaren = await _service.HaalSchooljarenOpAsync(cancellationToken);
        return Ok(jaren.Select(jaar => Gefilterd(jaar, leesbaar)).ToList());
    }

    /// <summary>One school year with its closures and the classes it contains that the gebruiker may read (Art. IX.3).</summary>
    [HttpGet("{schooljaarId:guid}")]
    public async Task<ActionResult<SchooljaarWeergave>> Detail(Guid schooljaarId, CancellationToken cancellationToken)
    {
        var jaar = await _service.HaalSchooljaarOpAsync(schooljaarId, cancellationToken);
        return Ok(Gefilterd(jaar, await LeesbareKlasIdsAsync(cancellationToken)));
    }

    /// <summary>
    /// The year's frame (FR-6.1): its span and the vacations inside it, which the plan screen's timeline and the agenda
    /// are drawn in. Separate from <c>GET /api/klassen/{klasId}/jaarplan</c>, which carries a class's placements and
    /// lesweken: the frame belongs to the school year, not to any one class.
    /// </summary>
    [HttpGet("{schooljaarId:guid}/rooster")]
    public async Task<ActionResult<PlanningsroosterWeergave>> Rooster(
        Guid schooljaarId,
        CancellationToken cancellationToken) =>
        Ok(await _rooster.HaalRoosterOpAsync(schooljaarId, cancellationToken));

    /// <summary>
    /// Creates a school year with its vakantie-/periodestructuur. Each closure is classified
    /// <c>Vakantie</c> (splits a thema, ADR-0053) or <c>VrijeDag</c> (does not) — data the school owns, never a
    /// threshold in code.
    /// </summary>
    /// <remarks>Admin only (E6-02: the row <c>Beheer</c>, ADR-0030 R2, R3, R16).</remarks>
    [HttpPost]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<ActionResult<SchooljaarWeergave>> Maak(
        [FromBody] SchooljaarCreatie creatie,
        CancellationToken cancellationToken)
    {
        var schooljaar = await _service.MaakSchooljaarAsync(creatie, cancellationToken);

        return CreatedAtAction(nameof(Detail), new { schooljaarId = schooljaar.Id }, schooljaar);
    }

    private async Task<HashSet<Guid>> LeesbareKlasIdsAsync(CancellationToken cancellationToken) =>
        (await _autorisatie.LeesbaarAsync(User, await _klassen.HaalKlassenOpAsync(cancellationToken)))
            .Select(klas => klas.Id)
            .ToHashSet();

    private static SchooljaarWeergave Gefilterd(SchooljaarWeergave jaar, HashSet<Guid> leesbaar) =>
        jaar with { Klassen = jaar.Klassen.Where(klas => leesbaar.Contains(klas.Id)).ToList() };
}
