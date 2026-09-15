using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a class's <c>Hoek</c>en (owner, meeting 2026-08-30). All logic lives in
/// <see cref="IHoekBeheerService"/>; validation and not-found surface through the shared exception handler.
/// <para>
/// <b>The klas is in the route for reads and creates, and not in the body.</b> A hoek belongs to exactly one
/// classroom, so the containment travels in the path and a body cannot disagree with it. Update and delete key
/// on the hoek alone, because a corner cannot move to another room: a teacher who wants it there takes it over,
/// which is a copy.
/// </para>
/// <para>
/// <b>Rights (E6-02, FB-013):</b> every write is the klas's planning, <c>KlasplanningBewerken</c> (directie and the
/// klas's own leerkrachten; ADR-0030 R7, R15, I21), against the klas in the route or the hoek's own klas. Reading the
/// list is <c>KlasplanningBekijken</c> (ADR-0040). Taking corners over writes only into the klas in the route, and reads
/// the klas they come from, so that klas must be one the gebruiker may read too: otherwise the copy would show another
/// jaarfase's corners.
/// </para>
/// </summary>
[ApiController]
public sealed class HoekenController : ControllerBase
{
    private readonly IHoekBeheerService _service;
    private readonly IRechtenbronnen _bronnen;
    private readonly IAuthorizationService _autorisatie;

    public HoekenController(IHoekBeheerService service, IRechtenbronnen bronnen, IAuthorizationService autorisatie)
    {
        _service = service;
        _bronnen = bronnen;
        _autorisatie = autorisatie;
    }

    [HttpGet("/api/klassen/{klasId:guid}/hoeken")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]
    public async Task<ActionResult<IReadOnlyList<HoekWeergave>>> Lijst(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalHoekenOpAsync(klasId, cancellationToken));

    [HttpPost("/api/klassen/{klasId:guid}/hoeken")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<HoekWeergave>> Maak(
        Guid klasId,
        [FromBody] HoekInvoer invoer,
        CancellationToken cancellationToken)
    {
        var hoek = await _service.MaakHoekAsync(klasId, invoer, cancellationToken);

        // No GET for a single hoek: the screen reads the class's list and nothing links to one on its own, so a
        // Location header would point at a route built only to satisfy the header.
        return Created($"/api/klassen/{klasId}/hoeken", hoek);
    }

    [HttpPut("/api/hoeken/{hoekId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Hoek, "hoekId")]
    public async Task<ActionResult<HoekWeergave>> Wijzig(
        Guid hoekId,
        [FromBody] HoekInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigHoekAsync(hoekId, invoer, cancellationToken));

    [HttpDelete("/api/hoeken/{hoekId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Hoek, "hoekId")]
    public async Task<IActionResult> Verwijder(Guid hoekId, CancellationToken cancellationToken)
    {
        await _service.VerwijderHoekAsync(hoekId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Copies another class's corners into this one, skipping the names it already has. The response says which
    /// names were skipped, so the screen can name them instead of reporting a bare count.
    /// <para>
    /// The klas they come from is in the body, so its read right is asked here, after binding (FB-013). An unknown
    /// source klas is left to the service, which refuses it with its own sentence.
    /// </para>
    /// </summary>
    [HttpPost("/api/klassen/{klasId:guid}/hoeken/overnemen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<HoekOvername>> NeemOver(
        Guid klasId,
        [FromBody] HoekOvernameVerzoek verzoek,
        CancellationToken cancellationToken)
    {
        if (await _bronnen.VoorKlasinzageAsync(verzoek.VanKlasId, cancellationToken) is { } bron
            && !await _autorisatie.MagAsync(User, bron, Rechtenmatrix.Beleid.KlasplanningBekijken))
        {
            return Forbid();
        }

        return Ok(await _service.NeemHoekenOverAsync(klasId, verzoek.VanKlasId, cancellationToken));
    }
}

/// <summary>Which class to copy corners from. A record rather than a query string, so the body carries the choice.</summary>
public sealed record HoekOvernameVerzoek(Guid VanKlasId);
