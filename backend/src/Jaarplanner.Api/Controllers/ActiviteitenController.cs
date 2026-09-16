using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Activiteitdoelen;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for age-scoped <c>Activiteit</c> CRUD and its goal links
/// (E1-10, FR-3.1/3.2). An activiteit may carry one or more leerdoel links, each persisted with status
/// <c>manueel</c> for a manual link (Art. IV.2). Scoping and validation live in the service/domain.
/// <para>
/// <b>Rights (E6-02, ADR-0030 §3), each against the activiteit as <see cref="Activiteitbron"/>.</b> Its content (every
/// field but its goal links, I15, the onderzoeksvraag tag included): <c>GedeeldeActiviteitBewerken</c> (directie, HL,
/// every leerkracht of that leeftijd; R17, R23). Its goal links, and asking and deciding the AI's goal proposals (FB-026):
/// <c>DoelenKoppelen</c> (directie, HL; R19). Deleting it:
/// <c>ActiviteitVerwijderen</c> (HL; the maker while no decided goal is linked; R25, R26, R33, ADR-0052 D5). Moving it:
/// <c>ActiviteitVerplaatsen</c> (HL; a leerkracht of that leeftijd while no decided goal is linked; I19), and the domain keeps
/// the move at the same leeftijd, so the destination needs no second check.
/// </para>
/// <para>
/// <b>An own activiteit (ADR-0049)</b> goes through the same rows, and the resource makes only its owner (and directie)
/// pass them (D4). Using one as an own copy is <c>EigenActiviteitGebruiken</c> (D5).
/// </para>
/// </summary>
[ApiController]
[Route("api/activiteiten")]
public sealed class ActiviteitenController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;
    private readonly IActiviteitDoelsuggestieService _doelsuggesties;

    public ActiviteitenController(ISchoolcontentBeheerService service, IActiviteitDoelsuggestieService doelsuggesties)
    {
        _service = service;
        _doelsuggesties = doelsuggesties;
    }

    [HttpPut("{activiteitId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.GedeeldeActiviteitBewerken, Rechtbron.Activiteit, "activiteitId")]
    public async Task<ActionResult<ActiviteitWeergave>> Wijzig(Guid activiteitId, [FromBody] ActiviteitWijzigingInvoer wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigActiviteitAsync(activiteitId, wijziging, cancellationToken));

    [HttpDelete("{activiteitId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.ActiviteitVerwijderen, Rechtbron.Activiteit, "activiteitId")]
    public async Task<IActionResult> Verwijder(Guid activiteitId, CancellationToken cancellationToken)
    {
        await _service.VerwijderActiviteitAsync(activiteitId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Moves the activiteit to another subthema (E4-08, FR-7.2) with its attributes and goal links intact. The
    /// destination may be under another thema but must be at the same <b>leeftijd</b> (owner ruling, 2026-08-30);
    /// the domain refuses the rest as a Dutch 400.
    /// A separate route from <c>PUT {activiteitId}</c> on purpose: the edit payload carries the activiteit's
    /// own fields, while this one carries its <b>place</b>, and folding the parent into the edit form would
    /// make every rename able to re-parent silently.
    /// </summary>
    [HttpPut("{activiteitId:guid}/subthema")]
    [RechtOp(Rechtenmatrix.Beleid.ActiviteitVerplaatsen, Rechtbron.Activiteit, "activiteitId")]
    public async Task<ActionResult<ActiviteitWeergave>> Verplaats(Guid activiteitId, [FromBody] ActiviteitVerplaatsingInvoer verplaatsing, CancellationToken cancellationToken) =>
        Ok(await _service.VerplaatsActiviteitAsync(activiteitId, verplaatsing.DoelSubthemaId, cancellationToken));

    [HttpPost("{activiteitId:guid}/doelkoppelingen")]
    [RechtOp(Rechtenmatrix.Beleid.DoelenKoppelen, Rechtbron.Activiteit, "activiteitId")]
    public async Task<ActionResult<DoelKoppelingWeergave>> KoppelAanDoel(Guid activiteitId, [FromBody] ThemasController.DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.KoppelActiviteitAanDoelAsync(activiteitId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("{activiteitId:guid}/doelkoppelingen/{koppelingId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.DoelenKoppelen, Rechtbron.Activiteit, "activiteitId")]
    public async Task<IActionResult> Ontkoppel(Guid activiteitId, Guid koppelingId, CancellationToken cancellationToken)
    {
        await _service.OntkoppelActiviteitDoelAsync(activiteitId, koppelingId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Asks the AI for goals of the activiteit's leeftijd (FB-026, ADR-0052), replacing its open proposals. Whoever may
    /// link its goals may ask. An unreadable model answer is a 422 with an English diagnostic and no change (Art. IV.5).
    /// </summary>
    [HttpPost("{activiteitId:guid}/doelsuggesties/genereer")]
    [RechtOp(Rechtenmatrix.Beleid.DoelenKoppelen, Rechtbron.Activiteit, "activiteitId")]
    public async Task<ActionResult<ActiviteitDoelsuggestieResultaat>> GenereerDoelsuggesties(Guid activiteitId, CancellationToken cancellationToken)
    {
        var resultaat = await _doelsuggesties.StelVoorAsync(activiteitId, cancellationToken);
        return resultaat.IsGeslaagd
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    /// <summary>Accepts or rejects one proposed goal link (FB-026). Whoever may link the activiteit's goals decides.</summary>
    [HttpPut("{activiteitId:guid}/doelkoppelingen/{koppelingId:guid}/status")]
    [RechtOp(Rechtenmatrix.Beleid.DoelenKoppelen, Rechtbron.Activiteit, "activiteitId")]
    public async Task<IActionResult> BeslisDoelvoorstel(
        Guid activiteitId,
        Guid koppelingId,
        [FromBody] DoelvoorstelBeslissing beslissing,
        CancellationToken cancellationToken)
    {
        await _doelsuggesties.BeslisAsync(activiteitId, koppelingId, beslissing.Status, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Makes the caller an own copy of an own activiteit (ADR-0049 E2, D5). The copy's owner is the signed-in gebruiker,
    /// never an id from the body.
    /// </summary>
    [HttpPost("{activiteitId:guid}/kopie")]
    [RechtOp(Rechtenmatrix.Beleid.EigenActiviteitGebruiken, Rechtbron.Activiteit, "activiteitId")]
    public async Task<ActionResult<ActiviteitWeergave>> Kopieer(Guid activiteitId, CancellationToken cancellationToken)
    {
        var gebruikerId = Aanmelding.GebruikerId(User)
            ?? throw new InvalidOperationException("A request past the rights check carries a gebruiker id.");
        var kopie = await _service.KopieerActiviteitAsync(activiteitId, gebruikerId, cancellationToken);
        return Created($"/api/activiteiten/{kopie.Id}", kopie);
    }

    /// <summary>Links or unlinks an activiteit to an onderzoeksvraag. Send null to clear. A content field (I15).</summary>
    [HttpPut("{activiteitId:guid}/onderzoeksvraag")]
    [RechtOp(Rechtenmatrix.Beleid.GedeeldeActiviteitBewerken, Rechtbron.Activiteit, "activiteitId")]
    public async Task<ActionResult<ActiviteitWeergave>> KoppelAanOnderzoeksvraag(
        Guid activiteitId,
        [FromBody] OnderzoeksvraagKoppelingInvoer invoer,
        CancellationToken cancellationToken) =>
        Ok(await _service.KoppelActiviteitAanOnderzoeksvraagAsync(activiteitId, invoer.OnderzoeksvraagId, cancellationToken));

    /// <summary>Payload for linking/unlinking an activiteit to an onderzoeksvraag.</summary>
    public sealed record OnderzoeksvraagKoppelingInvoer(Guid? OnderzoeksvraagId);
}
