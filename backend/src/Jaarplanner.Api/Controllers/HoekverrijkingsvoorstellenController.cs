using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the AI's proposal of a verrijking per hoek (FB-028, ADR-0070). All rules live in
/// <see cref="IHoekverrijkingsvoorstelService"/>.
/// <para>
/// <b>Rights:</b> every route is <c>KlasplanningBewerken</c> on the klas in the route (owner, 2026-09-24: a proposal
/// belongs to the klas, and whoever may plan it, and admin, sees and decides it). Reading is under the same row: a
/// reader of the agenda sees the verrijkingen, not what is still undecided.
/// </para>
/// <para><b>An unreadable model answer is a 422</b> with an English diagnostic and no change (Art. IV.5).</para>
/// </summary>
[ApiController]
public sealed class HoekverrijkingsvoorstellenController : ControllerBase
{
    private readonly IHoekverrijkingsvoorstelService _service;

    public HoekverrijkingsvoorstellenController(IHoekverrijkingsvoorstelService service) => _service = service;

    /// <summary>Every open proposal for a hoek of the klas.</summary>
    [HttpGet("/api/klassen/{klasId:guid}/hoekverrijkingsvoorstellen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<IReadOnlyList<HoekverrijkingsvoorstelWeergave>>> Lijst(
        Guid klasId,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalOpAsync(klasId, cancellationToken));

    /// <summary>Asks the AI for a verrijking of one hoek while one subthema runs.</summary>
    [HttpPost("/api/klassen/{klasId:guid}/hoeken/{hoekId:guid}/verrijkingsvoorstel")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<HoekverrijkingsvoorstelResultaat>> Genereer(
        Guid klasId,
        Guid hoekId,
        [FromBody] HoekverrijkingsvoorstelVraag vraag,
        CancellationToken cancellationToken)
    {
        var resultaat = await _service.StelVoorAsync(klasId, hoekId, vraag.SubthemaId, cancellationToken);
        return resultaat.IsGeslaagd
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    /// <summary>Accepts, possibly changed, or rejects a proposal; accepting writes the corner's verrijking.</summary>
    [HttpPut("/api/klassen/{klasId:guid}/hoekverrijkingsvoorstellen/{voorstelId:guid}/beslissing")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<HoekverrijkingsvoorstelBesluit>> Beslis(
        Guid klasId,
        Guid voorstelId,
        [FromBody] HoekverrijkingsvoorstelBeslissing beslissing,
        CancellationToken cancellationToken) =>
        Ok(await _service.BeslisAsync(klasId, voorstelId, beslissing, cancellationToken));
}

/// <summary>Body of a request: the subthema the corner's verrijking is for.</summary>
public sealed record HoekverrijkingsvoorstelVraag(Guid SubthemaId);
