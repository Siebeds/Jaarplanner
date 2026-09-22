using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Subdoelplaatsing;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the subdoelplaatsing (FB-057, ADR-0050): the AI's proposals of where a thema's
/// open leerplandoelen go. All rules live in <see cref="ISubdoelplaatsingService"/>.
/// <para>
/// <b>Rights, per leeftijd (P4, D6).</b> Asking is <c>SubdoelplaatsingVragen</c> at the leeftijd in the route, checked in
/// the action as the subthema create does, because the leeftijd is no stored resource. Deciding is
/// <c>SubdoelplaatsingBeslissen</c> at the proposal's leeftijd. Reading is open to every signed-in gebruiker for the open
/// count; the open proposals of a leeftijd are sent only to whoever may decide them there.
/// </para>
/// <para>
/// <b>An unreadable model answer is a 422</b> with an English diagnostic and no change (Art. IV.5), as the other AI
/// triggers answer.
/// </para>
/// </summary>
[ApiController]
public sealed class SubdoelplaatsingController : ControllerBase
{
    private readonly ISubdoelplaatsingService _service;
    private readonly IAuthorizationService _autorisatie;

    public SubdoelplaatsingController(ISubdoelplaatsingService service, IAuthorizationService autorisatie)
    {
        _service = service;
        _autorisatie = autorisatie;
    }

    /// <summary>
    /// Per leeftijd the open count, and the open proposals where the caller may decide them. A leeftijd without a subthema
    /// only where the caller may decide (ADR-0064).
    /// </summary>
    [HttpGet("api/themas/{themaId:guid}/subdoelplaatsing")]
    public async Task<ActionResult<SubdoelplaatsingOverzicht>> HaalOp(Guid themaId, CancellationToken cancellationToken)
    {
        var overzicht = await _service.HaalOpAsync(themaId, cancellationToken);
        var leeftijden = new List<LeeftijdPlaatsing>(overzicht.Leeftijden.Count);
        foreach (var leeftijd in overzicht.Leeftijden)
        {
            var mag = await _autorisatie.MagAsync(
                User, new Leeftijdsinhoud(leeftijd.Leeftijd), Rechtenmatrix.Beleid.SubdoelplaatsingBeslissen);
            if (mag)
            {
                leeftijden.Add(leeftijd);
            }
            else if (leeftijd.HeeftSubthema)
            {
                // ADR-0064: a leeftijd without a subthema is a place to ask, nothing to read, so it goes only to
                // whoever may decide there.
                leeftijden.Add(leeftijd with { MagBeslissen = false, Subdoelvoorstellen = [], Subthemavoorstellen = [] });
            }
        }

        return Ok(overzicht with { Leeftijden = leeftijden });
    }

    /// <summary>Asks the AI where the open goals of one leeftijd go (P2, D2).</summary>
    [HttpPost("api/themas/{themaId:guid}/subdoelplaatsing/{leeftijd}/genereer")]
    public async Task<ActionResult<SubdoelplaatsingResultaat>> Genereer(Guid themaId, string leeftijd, CancellationToken cancellationToken)
    {
        var bron = Leeftijdsinhoud.UitInvoer(leeftijd) ?? throw SchoolcontentValidatieFout.OngeldigeLeeftijd(leeftijd);
        if (!await _autorisatie.MagAsync(User, bron, Rechtenmatrix.Beleid.SubdoelplaatsingVragen))
        {
            return Forbid();
        }

        var resultaat = await _service.StelVoorAsync(themaId, bron.Leeftijd, cancellationToken);
        return resultaat.IsGeslaagd
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    /// <summary>Accepts or rejects a proposal to add a goal to an existing subthema (D5).</summary>
    [HttpPut("api/subdoelvoorstellen/{subdoelvoorstelId:guid}/status")]
    [RechtOp(Rechtenmatrix.Beleid.SubdoelplaatsingBeslissen, Rechtbron.Subdoelvoorstel, "subdoelvoorstelId")]
    public async Task<IActionResult> BeslisSubdoel(
        Guid subdoelvoorstelId,
        [FromBody] SubdoelvoorstelBeslissing beslissing,
        CancellationToken cancellationToken)
    {
        await _service.BeslisSubdoelAsync(subdoelvoorstelId, beslissing.Status, cancellationToken);
        return NoContent();
    }

    /// <summary>Accepts, possibly changed, or rejects a proposed new subthema with its goals (D4).</summary>
    [HttpPut("api/subthemavoorstellen/{subthemavoorstelId:guid}/beslissing")]
    [RechtOp(Rechtenmatrix.Beleid.SubdoelplaatsingBeslissen, Rechtbron.Subthemavoorstel, "subthemavoorstelId")]
    public async Task<IActionResult> BeslisSubthema(
        Guid subthemavoorstelId,
        [FromBody] SubthemavoorstelBeslissing beslissing,
        CancellationToken cancellationToken)
    {
        await _service.BeslisSubthemaAsync(subthemavoorstelId, beslissing, cancellationToken);
        return NoContent();
    }
}
