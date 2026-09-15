using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for what each hoek of a class holds while a subthema runs (FB-020, ADR-0041). All
/// logic lives in <see cref="IHoekverrijkingService"/>.
/// <para>
/// <b>Rights:</b> writing is the klas's planning, <c>KlasplanningBewerken</c> against the klas in the route, the right
/// that places a hoek and stores a subthema window, which a save may do on the way. Reading is <c>KlasplanningBekijken</c>
/// on the klas, as every read of one klas's planning is since FB-013 (ADR-0040).
/// </para>
/// </summary>
[ApiController]
public sealed class HoekverrijkingenController : ControllerBase
{
    private readonly IHoekverrijkingService _service;

    public HoekverrijkingenController(IHoekverrijkingService service) => _service = service;

    /// <summary>Every stored subthemaperiode of the klas touching the range, with its verrijkingen.</summary>
    [HttpGet("/api/klassen/{klasId:guid}/hoekverrijkingen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]
    public async Task<ActionResult<IReadOnlyList<SubthemaperiodeVerrijkingen>>> Lijst(
        Guid klasId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalVoorBereikAsync(klasId, van, tot, cancellationToken));

    /// <summary>
    /// Writes the verrijkingen of one subthemaperiode, storing the window first when the agenda drew the subthema from
    /// its activiteiten alone. A PUT: the body states what each named hoek holds, and sending it twice changes nothing.
    /// </summary>
    [HttpPut("/api/klassen/{klasId:guid}/hoekverrijkingen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<SubthemaperiodeVerrijkingen>> Bewaar(
        Guid klasId,
        [FromBody] HoekverrijkingenInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.BewaarAsync(klasId, invoer, cancellationToken));

    /// <summary>
    /// How many verrijkingen deleting this subthema would take along, across every klas, for the confirmation that
    /// says so before the delete (owner, 2026-09-15). Read by whoever may delete the subthema, the one person the
    /// confirmation is for: it counts rows of klassen that person may not otherwise read.
    /// </summary>
    [HttpGet("/api/subthemas/{subthemaId:guid}/hoekverrijkingen/aantal")]
    [RechtOp(Rechtenmatrix.Beleid.SubthemaBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<ActionResult<Hoekverrijkingaantal>> AantalVoorSubthema(
        Guid subthemaId,
        CancellationToken cancellationToken) =>
        Ok(new Hoekverrijkingaantal(await _service.TelVoorSubthemaAsync(subthemaId, cancellationToken)));
}
