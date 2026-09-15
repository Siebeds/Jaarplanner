using Jaarplanner.Api.Infrastructure.Autorisatie;
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
/// every leerkracht of that leeftijd; R17, R23). Its goal links: <c>DoelenKoppelen</c> (directie, HL; R19). Deleting it:
/// <c>ActiviteitVerwijderen</c> (HL; the maker while no goal is linked; R25, R26, R33). Moving it:
/// <c>ActiviteitVerplaatsen</c> (HL; a leerkracht of that leeftijd while no goal is linked; I19), and the domain keeps
/// the move at the same leeftijd, so the destination needs no second check.
/// </para>
/// </summary>
[ApiController]
[Route("api/activiteiten")]
public sealed class ActiviteitenController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;

    public ActiviteitenController(ISchoolcontentBeheerService service) => _service = service;

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
