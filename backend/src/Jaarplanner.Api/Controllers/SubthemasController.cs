using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for age-scoped <c>Subthema</c> CRUD, its activiteiten and its
/// goal links (E1-10, FR-3.1/3.2). Linking a subthema to a leerdoel creates a manual subdoel carrying
/// the link (the per-(subthema × leeftijd) link carrier in the model, Art. IX.2; status <c>manueel</c>,
/// Art. IV.2). Scoping and validation live in the service/domain.
/// <para>
/// <b>Rights (E6-02, ADR-0030 §3), each against the subthema's leeftijd.</b> The subthema itself, its fields and its
/// onderzoeksvragen: <c>SubthemaBeheren</c> (directie, HL; R5, R21, I16). Its subdoelen: <c>SubdoelenBeheren</c>
/// (directie, HL; R24). A new activiteit under it: <c>GedeeldeActiviteitBewerken</c> (directie, HL, every leerkracht
/// with a klas of that leeftijd; R17, R23), plus <c>DoelenKoppelen</c> (directie, HL; R19) when the create carries goal
/// codes. Themabeheer holds none of these (I22): the wizard has its own routes.
/// </para>
/// </summary>
[ApiController]
[Route("api/subthemas")]
public sealed class SubthemasController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;
    private readonly IRechtenbronnen _bronnen;
    private readonly IAuthorizationService _autorisatie;

    public SubthemasController(ISchoolcontentBeheerService service, IRechtenbronnen bronnen, IAuthorizationService autorisatie)
    {
        _service = service;
        _bronnen = bronnen;
        _autorisatie = autorisatie;
    }

    /// <summary>
    /// Lists the subthema's at the ages one klas teaches, across every thema (E4-08), which is what a move's
    /// destination picker needs: the ruling of 2026-08-30 lets an activiteit cross a thema but not a leeftijd.
    /// The klas is in the route rather than in a query string because it is the scope of the answer, not a
    /// filter on it (Art. IX.2).
    /// <para>
    /// An unknown klas is a <b>400</b>, not a 404: the addressed resource is this list and it exists, while the
    /// klas is referenced. See the service for the whole reasoning; the short version is that a 404 would tell
    /// the picker its own route is gone, and an empty list would tell a teacher her school has no content.
    /// </para>
    /// </summary>
    [HttpGet("voor-klas/{klasId:guid}")]
    public async Task<ActionResult<IReadOnlyList<SubthemaBestemming>>> VoorKlas(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalSubthemaBestemmingenAsync(klasId, cancellationToken));

    /// <summary>
    /// Edits a subthema. The attribute asks the subthema row at its stored leeftijd; a re-scope needs it at the new
    /// leeftijd too (I13), which is asked here. When the leeftijd does not change, that second question is the first one
    /// again.
    /// <para>
    /// Every field of this payload follows the subthema row (I16). R28's streefwoordenschat is not a field of a subthema
    /// yet (E10-01 adds it), so no update here is "only the streefwoordenschat" and the
    /// <c>StreefwoordenschatAanpassen</c> row has no route.
    /// </para>
    /// </summary>
    [HttpPut("{subthemaId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.SubthemaBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<ActionResult<SubthemaWeergave>> Wijzig(Guid subthemaId, [FromBody] SubthemaWijzigingInvoer wijziging, CancellationToken cancellationToken)
    {
        var nieuw = Leeftijdsinhoud.UitInvoer(wijziging.Leeftijd)
            ?? throw SchoolcontentValidatieFout.OngeldigeLeeftijd(wijziging.Leeftijd);
        if (!await _autorisatie.MagAsync(User, nieuw, Rechtenmatrix.Beleid.SubthemaBeheren))
        {
            return Forbid();
        }

        return Ok(await _service.WijzigSubthemaAsync(subthemaId, wijziging, cancellationToken));
    }

    [HttpDelete("{subthemaId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.SubthemaBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<IActionResult> Verwijder(Guid subthemaId, CancellationToken cancellationToken)
    {
        await _service.VerwijderSubthemaAsync(subthemaId, cancellationToken);
        return NoContent();
    }

    /// <summary>Creates a subdoel: a manual goal link on the subthema (R24).</summary>
    [HttpPost("{subthemaId:guid}/doelkoppelingen")]
    [RechtOp(Rechtenmatrix.Beleid.SubdoelenBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<ActionResult<SubdoelWeergave>> KoppelAanDoel(Guid subthemaId, [FromBody] ThemasController.DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.KoppelSubthemaAanDoelAsync(subthemaId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("{subthemaId:guid}/subdoelen/{subdoelId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.SubdoelenBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<IActionResult> Ontkoppel(Guid subthemaId, Guid subdoelId, CancellationToken cancellationToken)
    {
        await _service.OntkoppelSubdoelAsync(subthemaId, subdoelId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Creates an activiteit by hand. The signed-in gebruiker is its maker (ADR-0030 R26), never the body.
    /// <para>
    /// Goal codes in the create are goal links by hand on a shared activiteit, which is R19's row and not the content
    /// row: a leerkracht of that leeftijd may create the activiteit but not link its goals, so a create that carries codes
    /// needs <c>DoelenKoppelen</c> as well. Any code counts, a blank one too: that is a request to link, which the
    /// service refuses afterwards, and failing closed here costs nothing.
    /// </para>
    /// </summary>
    [HttpPost("{subthemaId:guid}/activiteiten")]
    [RechtOp(Rechtenmatrix.Beleid.GedeeldeActiviteitBewerken, Rechtbron.Subthema, "subthemaId")]
    public async Task<ActionResult<ActiviteitWeergave>> MaakActiviteit(Guid subthemaId, [FromBody] ActiviteitCreatie creatie, CancellationToken cancellationToken)
    {
        if (creatie.LeerplandoelCodes is { Count: > 0 })
        {
            var bron = await _bronnen.VoorSubthemaAsync(subthemaId, cancellationToken)
                ?? throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");
            if (!await _autorisatie.MagAsync(User, bron, Rechtenmatrix.Beleid.DoelenKoppelen))
            {
                return Forbid();
            }
        }

        var activiteit = await _service.MaakActiviteitAsync(subthemaId, Aanmelding.GebruikerId(User), creatie, cancellationToken);
        return Created($"/api/activiteiten/{activiteit.Id}", activiteit);
    }

    // --- Onderzoeksvragen per subthema: fields of the subthema, so its row (I16). ---

    [HttpPost("{subthemaId:guid}/onderzoeksvragen")]
    [RechtOp(Rechtenmatrix.Beleid.SubthemaBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<ActionResult<OnderzoeksvraagWeergave>> VoegOnderzoeksvraagToe(Guid subthemaId, [FromBody] OnderzoeksvraagCreatie creatie, CancellationToken cancellationToken)
    {
        var ov = await _service.VoegOnderzoeksvraagToeAsync(subthemaId, creatie, cancellationToken);
        return Created($"/api/subthemas/{subthemaId}/onderzoeksvragen/{ov.Id}", ov);
    }

    [HttpPut("{subthemaId:guid}/onderzoeksvragen/{ovId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.SubthemaBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<ActionResult<OnderzoeksvraagWeergave>> WijzigOnderzoeksvraag(Guid subthemaId, Guid ovId, [FromBody] OnderzoeksvraagCreatie invoer, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigOnderzoeksvraagAsync(subthemaId, ovId, invoer, cancellationToken));

    [HttpDelete("{subthemaId:guid}/onderzoeksvragen/{ovId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.SubthemaBeheren, Rechtbron.Subthema, "subthemaId")]
    public async Task<IActionResult> VerwijderOnderzoeksvraag(Guid subthemaId, Guid ovId, CancellationToken cancellationToken)
    {
        await _service.VerwijderOnderzoeksvraagAsync(subthemaId, ovId, cancellationToken);
        return NoContent();
    }
}
