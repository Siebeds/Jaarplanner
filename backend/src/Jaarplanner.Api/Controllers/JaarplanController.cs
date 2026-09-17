using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a class's <c>Jaarplan</c> (FR-6, FR-7, ADR-0053). All logic lives in
/// <see cref="JaarplanService"/>; the controller binds, delegates and returns.
/// <para>
/// <c>GET …/jaarplan</c> reads the plan; <c>GET …/jaarplan/voorstel</c> proposes an end for a thema and a begin;
/// <c>POST …/jaarplan/plaatsingen</c> places a thema by hand; <c>PUT …/datums</c> and <c>PUT …/verschuiving</c> give a
/// placement new days; the status and lock PUTs record a decision; <c>DELETE …/plaatsingen/{id}</c> removes a placement,
/// whatever its status or lock, and is also how a proposal is rejected. Every write returns the updated plan.
/// </para>
/// <para>
/// <c>POST …/jaarplan/generatie</c> asks the AI for thema's on the free days of the year (ADR-0055).
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen/{klasId:guid}/jaarplan")]
public sealed class JaarplanController : ControllerBase
{
    private readonly JaarplanService _service;
    private readonly JaarplanGeneratieService _generatie;

    public JaarplanController(JaarplanService service, JaarplanGeneratieService generatie)
    {
        _service = service;
        _generatie = generatie;
    }

    /// <summary>Body for a teacher decision on one placement: the new status (aanvaard / manueel).</summary>
    public sealed record StatusWijziging(KoppelingStatus Status);

    /// <summary>Body for locking/unlocking one placement against (re)generation (Art. IX.3).</summary>
    public sealed record VergrendelingWijziging(bool Vergrendeld);

    /// <summary>
    /// Body for placing a thema by hand: which thema, its first day and, optionally, its last day. Without a last day the
    /// proposed end is used. No status field: a hand-placement is <c>manueel</c> by definition, so letting a client name
    /// its own status would let it claim the AI proposed something (Art. IV.3).
    /// </summary>
    public sealed record HandmatigePlaatsing(Guid ThemaId, DateOnly Van, DateOnly? Tot);

    /// <summary>Body for giving a placement a new first and last day.</summary>
    public sealed record DatumWijziging(DateOnly Van, DateOnly Tot);

    /// <summary>Body for dragging a placement: its new first day. It keeps its number of schooldagen.</summary>
    public sealed record Verschuiving(DateOnly Van);

    /// <summary>
    /// The class's plan: every placement with its days, its run and whether it still fits the year, every lesweek with
    /// whether a thema runs in it, and the balance. A class without a plan yields an empty plan, not a 404.
    /// </summary>
    [HttpGet]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]
    public async Task<ActionResult<JaarplanWeergave>> Detail(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalJaarplanAsync(klasId, cancellationToken));

    /// <summary>
    /// The end the tool proposes for a thema starting on <paramref name="van"/>, and the parts it would store around
    /// vacations. Writes nothing. <b>400</b> when the day is no schooldag, lies outside the year or already belongs to
    /// another thema; <b>404</b> when the class or the thema does not exist.
    /// </summary>
    [HttpGet("voorstel")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<EindvoorstelWeergave>> Voorstel(
        Guid klasId,
        [FromQuery] Guid themaId,
        [FromQuery] DateOnly van,
        CancellationToken cancellationToken) =>
        Ok(await _service.StelEindeVoorAsync(klasId, themaId, van, cancellationToken));

    /// <summary>
    /// Asks the AI for thema's with their days on the free lesweken of the year (FR-5.1, FR-8.1, ADR-0055). Open,
    /// unlocked proposals are replaced; decided and locked placements stay. Returns the run's report with the plan.
    /// <b>422</b> when the model's answer is unreadable (nothing changed); <b>400</b> when the school has no thema's, the
    /// plan has no free lesweek or the request is too large; <b>404</b> for an unknown class.
    /// </summary>
    [HttpPost("generatie")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<JaarplanGeneratieResultaat>> Genereer(Guid klasId, CancellationToken cancellationToken)
    {
        var resultaat = await _generatie.GenereerAsync(klasId, cancellationToken);
        if (!resultaat.IsGeslaagd)
        {
            return UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
        }

        return Ok(resultaat with { Jaarplan = await _service.HaalJaarplanAsync(klasId, cancellationToken) });
    }

    /// <summary>
    /// Places a thema by hand (FR-7.2), split at every vacation, and persists it at once. Creates the plan when the
    /// class has none. <b>400</b> when the days are invalid or already taken by another thema; <b>404</b> when the class
    /// or the thema does not exist.
    /// </summary>
    [HttpPost("plaatsingen")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<JaarplanWeergave>> VoegPlaatsingToe(
        Guid klasId,
        [FromBody] HandmatigePlaatsing plaatsing,
        CancellationToken cancellationToken) =>
        Ok(await _service.PlaatsThemaAsync(
            klasId, plaatsing.ThemaId, plaatsing.Van, plaatsing.Tot, cancellationToken));

    /// <summary>
    /// Gives a placement a new first and last day, split again at every vacation. Nothing is written when the days do
    /// not change. <b>400</b> when the days are invalid or taken; <b>404</b> when the placement does not exist.
    /// </summary>
    [HttpPut("plaatsingen/{plaatsingId:guid}/datums")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<JaarplanWeergave>> WijzigDatums(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] DatumWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigDatumsAsync(klasId, plaatsingId, wijziging.Van, wijziging.Tot, cancellationToken));

    /// <summary>
    /// Drags a placement to a new first day, keeping its number of schooldagen (FR-6.2). A first day that is no schooldag
    /// moves forward to the next one. <b>400</b> when the new days leave the year or are taken.
    /// </summary>
    [HttpPut("plaatsingen/{plaatsingId:guid}/verschuiving")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<JaarplanWeergave>> Verschuif(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] Verschuiving verschuiving,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerschuifAsync(klasId, plaatsingId, verschuiving.Van, cancellationToken));

    /// <summary>
    /// Records the teacher's decision on a proposed placement (Art. IV.1/IV.2): aanvaard or manueel. A proposal is
    /// rejected by deleting it, so <c>geweigerd</c> is a 400.
    /// </summary>
    [HttpPut("plaatsingen/{plaatsingId:guid}/status")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<JaarplanWeergave>> WijzigStatus(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] StatusWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigPlaatsingStatusAsync(klasId, plaatsingId, wijziging.Status, cancellationToken));

    /// <summary>Locks or unlocks a placement against (re)generation — Art. IX.3's <c>vergrendeld</c> flag.</summary>
    [HttpPut("plaatsingen/{plaatsingId:guid}/vergrendeling")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<JaarplanWeergave>> WijzigVergrendeling(
        Guid klasId,
        Guid plaatsingId,
        [FromBody] VergrendelingWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigVergrendelingAsync(klasId, plaatsingId, wijziging.Vergrendeld, cancellationToken));

    /// <summary>
    /// Removes one placement (FR-7), whatever its status or lock — an explicit teacher action is the one actor Art. IV.2
    /// allows to discard a human decision. Only this part goes; the other parts of its thema stay.
    /// </summary>
    [HttpDelete("plaatsingen/{plaatsingId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBewerken, Rechtbron.Klas, "klasId")]
    public async Task<ActionResult<JaarplanWeergave>> VerwijderPlaatsing(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken) =>
        Ok(await _service.VerwijderPlaatsingAsync(klasId, plaatsingId, cancellationToken));
}
