using Jaarplanner.Application.Planning.Hoeken;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for placing a hoek on the agenda (owner, meeting 2026-08-30). All logic lives
/// in <see cref="IHoekplaatsingService"/>.
/// <para>
/// <b>Its own route rather than a field on the weekplanning.</b> The agenda fetches this alongside its days,
/// which is one more request and the price of keeping hoeken out of the jaarplan read model. What that buys is
/// in <c>Hoekplaatsing</c>'s own documentation: a (re)generation cannot reach what it cannot see.
/// </para>
/// </summary>
[ApiController]
public sealed class HoekplaatsingenController : ControllerBase
{
    private readonly IHoekplaatsingService _service;

    public HoekplaatsingenController(IHoekplaatsingService service) => _service = service;

    /// <summary>Every placement overlapping the range, so the calendar can draw the days on screen.</summary>
    [HttpGet("/api/klassen/{klasId:guid}/hoekplaatsingen")]
    public async Task<ActionResult<IReadOnlyList<HoekplaatsingWeergave>>> Lijst(
        Guid klasId,
        [FromQuery] DateOnly van,
        [FromQuery] DateOnly tot,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalVoorBereikAsync(klasId, van, tot, cancellationToken));

    [HttpPost("/api/klassen/{klasId:guid}/hoekplaatsingen")]
    public async Task<ActionResult<HoekplaatsingWeergave>> Plaats(
        Guid klasId,
        [FromBody] HoekplaatsingInvoer invoer,
        CancellationToken cancellationToken)
    {
        var plaatsing = await _service.PlaatsAsync(klasId, invoer, cancellationToken);
        return Created($"/api/klassen/{klasId}/hoekplaatsingen", plaatsing);
    }

    [HttpDelete("/api/hoekplaatsingen/{plaatsingId:guid}")]
    public async Task<IActionResult> Verwijder(Guid plaatsingId, CancellationToken cancellationToken)
    {
        await _service.VerwijderAsync(plaatsingId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Moves or resizes ONE appearance of a placed hoek (owner, 2026-08-31; clock times since ADR-0027).
    /// <para>
    /// A PUT on the appearance rather than a PATCH on the placement, because the whole resource being addressed
    /// is a day and a stretch of time and all three are sent every time. Moving the whole run is a different verb
    /// and is not this route.
    /// </para>
    /// </summary>
    [HttpPut("/api/hoekplaatsingen/{plaatsingId:guid}/momenten/{momentId:guid}")]
    public async Task<ActionResult<HoekplaatsingWeergave>> VerplaatsMoment(
        Guid plaatsingId,
        Guid momentId,
        [FromBody] HoekmomentVerplaatsing invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerplaatsMomentAsync(
            plaatsingId, momentId, invoer.Datum, invoer.Begin, invoer.Einde, cancellationToken));

    /// <summary>
    /// Gives every appearance of a placed hoek the same hours (owner, 2026-09-11). Each stays on its own day; moving
    /// the run to other days is not this route.
    /// </summary>
    [HttpPut("/api/hoekplaatsingen/{plaatsingId:guid}/uren")]
    public async Task<ActionResult<HoekplaatsingWeergave>> ZetUren(
        Guid plaatsingId,
        [FromBody] Hoekuren invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.ZetUrenAsync(plaatsingId, invoer.Begin, invoer.Einde, cancellationToken));

    /// <summary>Adds an enrichment: what is in the corner over these days.</summary>
    [HttpPost("/api/hoekplaatsingen/{plaatsingId:guid}/verrijkingen")]
    public async Task<ActionResult<HoekplaatsingWeergave>> VoegVerrijkingToe(
        Guid plaatsingId,
        [FromBody] HoekverrijkingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.VoegVerrijkingToeAsync(plaatsingId, invoer.Van, invoer.Tot, invoer.Tekst, cancellationToken));

    /// <summary>Rewrites one enrichment, moving its window if asked.</summary>
    [HttpPut("/api/hoekplaatsingen/{plaatsingId:guid}/verrijkingen/{verrijkingId:guid}")]
    public async Task<ActionResult<HoekplaatsingWeergave>> WijzigVerrijking(
        Guid plaatsingId,
        Guid verrijkingId,
        [FromBody] HoekverrijkingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigVerrijkingAsync(
            plaatsingId,
            verrijkingId,
            invoer.Van,
            invoer.Tot,
            invoer.Tekst,
            cancellationToken));

    /// <summary>Removes one enrichment.</summary>
    [HttpDelete("/api/hoekplaatsingen/{plaatsingId:guid}/verrijkingen/{verrijkingId:guid}")]
    public async Task<ActionResult<HoekplaatsingWeergave>> VerwijderVerrijking(
        Guid plaatsingId,
        Guid verrijkingId,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerwijderVerrijkingAsync(plaatsingId, verrijkingId, cancellationToken));

    /// <summary>Where one appearance should move to.</summary>
    /// <param name="Datum">The day it happens on. May be the day it is already on.</param>
    /// <param name="Begin">When the corner opens that day, as <c>HH:mm:ss</c>.</param>
    /// <param name="Einde">When it closes. Must lie after <paramref name="Begin"/>.</param>
    public sealed record HoekmomentVerplaatsing(DateOnly Datum, TimeOnly Begin, TimeOnly Einde);

    /// <summary>The hours every day of a run should have.</summary>
    /// <param name="Begin">When the corner opens, as <c>HH:mm:ss</c>.</param>
    /// <param name="Einde">When it closes. Must lie after <paramref name="Begin"/>.</param>
    public sealed record Hoekuren(TimeOnly Begin, TimeOnly Einde);

    /// <summary>What is in the corner, over which days.</summary>
    /// <param name="Van">First day of the enrichment, inclusive. Must fall inside the placement.</param>
    /// <param name="Tot">Last day, inclusive.</param>
    /// <param name="Tekst">What she wrote. The aggregate refuses blank.</param>
    public sealed record HoekverrijkingInvoer(DateOnly Van, DateOnly Tot, string Tekst);
}
