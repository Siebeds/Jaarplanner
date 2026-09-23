using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for whether the school shows Chuck (FB-071, ADR-0065).
/// <para>
/// <b>Rights:</b> reading is open to every session, because every screen draws him or not. Changing it is the row
/// <c>Beheer</c>, admin only: it is a decision for the school, taken once the onderwijsadviseur has approved him
/// (owner ruling 2026-09-22), of the same kind as the school's hours that row already covers.
/// </para>
/// </summary>
[ApiController]
[Route("api/kat/instelling")]
public sealed class KatinstellingController : ControllerBase
{
    private readonly IKatinstellingService _service;

    public KatinstellingController(IKatinstellingService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<KatinstellingWeergave>> Haal(CancellationToken cancellationToken) =>
        Ok(await _service.HaalOpAsync(cancellationToken));

    [HttpPut]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<ActionResult<KatinstellingWeergave>> Zet(
        [FromBody] KatinstellingWeergave invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.ZetAsync(invoer, cancellationToken));
}
