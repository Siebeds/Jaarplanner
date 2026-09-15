using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the school's hours per weekday (FB-023, ADR-0038). All logic lives in
/// <see cref="ISchoolurenService"/>; a refusal surfaces as a Dutch 400 through the shared exception handler.
/// <para>
/// <b>Rights:</b> reading is open to every session, because every agenda draws the hours. Replacing them is the row
/// <c>Beheer</c>, directie only: the owner ruled on 2026-09-15 that directie sets them, and they are school
/// organisation of the same kind as the schooljaren that row already covers (ADR-0030 R2, R3, R16).
/// </para>
/// </summary>
[ApiController]
[Route("api/schooluren")]
public sealed class SchoolurenController : ControllerBase
{
    private readonly ISchoolurenService _service;

    public SchoolurenController(ISchoolurenService service) => _service = service;

    [HttpGet]
    public async Task<ActionResult<SchoolurenWeergave>> Haal(CancellationToken cancellationToken) =>
        Ok(await _service.HaalOpAsync(cancellationToken));

    /// <summary>Replaces the whole set. A weekday left out of the body has no hours afterwards.</summary>
    [HttpPut]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<ActionResult<SchoolurenWeergave>> Vervang(
        [FromBody] SchoolurenInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.VervangAsync(invoer, cancellationToken));
}
