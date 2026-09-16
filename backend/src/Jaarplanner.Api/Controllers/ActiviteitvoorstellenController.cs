using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Activiteitvoorstellen;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the activiteitvoorstellen (FB-025, ADR-0052): the AI's personal proposals of
/// activiteiten under a subthema. All rules live in <see cref="IActiviteitvoorstelService"/>.
/// <para>
/// <b>Rights (D1, D2).</b> Asking and deciding are <c>EigenActiviteitMaken</c> at the subthema's leeftijd, because an
/// accepted proposal is an own activiteit made there. Reading the caller's own proposals needs a session only, like
/// reading one's own woordweb. That a proposal is the caller's is the service's: it takes the gebruiker from the session,
/// never from the body, and does not find someone else's.
/// </para>
/// <para>
/// <b>An unreadable model answer is a 422</b> with an English diagnostic and no change (Art. IV.5), as the other AI
/// triggers answer.
/// </para>
/// </summary>
[ApiController]
public sealed class ActiviteitvoorstellenController : ControllerBase
{
    private readonly IActiviteitvoorstelService _service;

    public ActiviteitvoorstellenController(IActiviteitvoorstelService service)
    {
        _service = service;
    }

    /// <summary>The caller's open proposals under the subthema.</summary>
    [HttpGet("api/subthemas/{subthemaId:guid}/activiteitvoorstellen")]
    public async Task<ActionResult<IReadOnlyList<ActiviteitvoorstelWeergave>>> HaalOp(Guid subthemaId, CancellationToken cancellationToken) =>
        Aanmelding.GebruikerId(User) is { } gebruikerId
            ? Ok(await _service.HaalOpAsync(subthemaId, gebruikerId, cancellationToken))
            : Forbid();

    /// <summary>Asks the AI for activiteiten under the subthema (D4).</summary>
    [HttpPost("api/subthemas/{subthemaId:guid}/activiteitvoorstellen/genereer")]
    [RechtOp(Rechtenmatrix.Beleid.EigenActiviteitMaken, Rechtbron.Subthema, "subthemaId")]
    public async Task<ActionResult<ActiviteitvoorstelResultaat>> Genereer(Guid subthemaId, CancellationToken cancellationToken)
    {
        var resultaat = await _service.StelVoorAsync(subthemaId, Aanmelder(), cancellationToken);
        return resultaat.IsGeslaagd
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    /// <summary>Accepts, possibly changed, or rejects one of the caller's proposals (D8).</summary>
    [HttpPut("api/activiteitvoorstellen/{activiteitvoorstelId:guid}/beslissing")]
    [RechtOp(Rechtenmatrix.Beleid.EigenActiviteitMaken, Rechtbron.Activiteitvoorstel, "activiteitvoorstelId")]
    public async Task<ActionResult<ActiviteitvoorstelBesluit>> Beslis(
        Guid activiteitvoorstelId,
        [FromBody] ActiviteitvoorstelBeslissing beslissing,
        CancellationToken cancellationToken) =>
        Ok(await _service.BeslisAsync(activiteitvoorstelId, Aanmelder(), beslissing, cancellationToken));

    // A [RechtOp] route has already matched the caller to a gebruiker (the matrix handler refuses a principal without one),
    // so a missing id here is a wiring fault, not a teacher's case.
    private Guid Aanmelder() =>
        Aanmelding.GebruikerId(User) ?? throw new InvalidOperationException("An activiteitvoorstel route ran without a gebruiker id.");
}
