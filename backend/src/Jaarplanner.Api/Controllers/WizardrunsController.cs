using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Schoolcontent.Wizard;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// The thema-opbouw wizard's own write actions (E6-02 slice 3, ADR-0030 R29, R32; defaults I18, I22–I25, I27). Thin:
/// the rules of a run live in <see cref="IWizardrunService"/>.
/// <para>
/// <b>No screen calls these yet.</b> E6-05 builds the wizard; these are its server half, reachable over HTTP and tested
/// there, so the screen has a contract to build against rather than a promise.
/// </para>
/// <para>
/// <b>Rights.</b> Starting, finishing and closing a run are the row <c>ThemaOpbouw</c>; creating, editing and deleting
/// content in it are the row <c>Wizardinhoud</c>. Both admit admin and themabeheer only. What a run then allows holds
/// for admin as well, and the service refuses the rest with a 403 carrying a Dutch sentence:
/// <list type="bullet">
/// <item>the run is open (I24);</item>
/// <item>content goes under the run's own thema, and an activiteit it edits or deletes is still there (I25);</item>
/// <item>an edit or delete reaches only what the run created (I25);</item>
/// <item>it carries off nobody else's work (I27): no leeftijd change while someone else's content is under a subthema,
/// and no delete that would take a goal link along unless the caller may link goals at that leeftijd, nor a leeftijd
/// change that would, unless the caller may link goals "at both the old and the new leeftijd" (R19; I27 with the owner's
/// Q4 and Q5 answers of 2026-09-14).</item>
/// </list>
/// </para>
/// <para>
/// <b>Order of answers:</b> 403 for a caller outside the row (before anything is read); a body leeftijd that is no
/// leeftijd is the write's own 400; then 404 for a run that does not exist, 403 for one that has ended, 404 for an item
/// that does not exist, 403 for one the run did not create, 403 for an activiteit no longer under the run's thema, and
/// 403 for an action that would carry off someone else's work or a goal link the caller may not move (I27).
/// </para>
/// </summary>
[ApiController]
[Route("api/thema-opbouw/wizardruns")]
public sealed class WizardrunsController : ControllerBase
{
    private readonly IWizardrunService _service;
    private readonly IRechtenbronnen _bronnen;
    private readonly IAuthorizationService _autorisatie;

    public WizardrunsController(IWizardrunService service, IRechtenbronnen bronnen, IAuthorizationService autorisatie)
    {
        _service = service;
        _bronnen = bronnen;
        _autorisatie = autorisatie;
    }

    /// <summary>Starts a run: creates the new thema, and the run that built it, with the caller as its starter.</summary>
    [HttpPost]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaOpbouw)]
    public async Task<ActionResult<WizardrunWeergave>> Start([FromBody] ThemaCreatie creatie, CancellationToken cancellationToken)
    {
        var run = await _service.StartAsync(creatie, Aanmelding.GebruikerId(User), cancellationToken);
        return CreatedAtAction(nameof(Detail), new { runId = run.Id }, run);
    }

    /// <summary>The run: its thema, when it last wrote, whether it is open, and what it created. A read, open to every signed-in gebruiker like the thema it builds.</summary>
    [HttpGet("{runId:guid}")]
    public async Task<ActionResult<WizardrunWeergave>> Detail(Guid runId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalOpAsync(runId, cancellationToken));

    /// <summary>Creates a subthema under the run's thema, at any leeftijd.</summary>
    [HttpPost("{runId:guid}/subthemas")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<ActionResult<SubthemaWeergave>> MaakSubthema(
        Guid runId, [FromBody] SubthemaCreatie creatie, CancellationToken cancellationToken)
    {
        VereisLeeftijd(creatie.Leeftijd);
        var subthema = await _service.MaakSubthemaAsync(runId, creatie, cancellationToken);
        return Created($"/api/themas/{subthema.ThemaId}", subthema);
    }

    /// <summary>
    /// Edits a subthema this run created (I25). A new leeftijd is refused while someone else's content is under it, and,
    /// while an activiteit under it carries a goal link, unless the caller may link goals "at both the old and the new
    /// leeftijd" (I27 with the owner's Q4 and Q5 answers).
    /// </summary>
    [HttpPut("{runId:guid}/subthemas/{subthemaId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<ActionResult<SubthemaWeergave>> WijzigSubthema(
        Guid runId, Guid subthemaId, [FromBody] SubthemaWijzigingInvoer wijziging, CancellationToken cancellationToken)
    {
        VereisLeeftijd(wijziging.Leeftijd);
        // The caller travels along for I27: a leeftijd change that carries a goal link needs their goal-link right.
        return Ok(await _service.WijzigSubthemaAsync(runId, subthemaId, wijziging, Aanmelding.GebruikerId(User), cancellationToken));
    }

    /// <summary>
    /// Deletes a subthema this run created, as long as everything under it is the run's too (I25), and, while an
    /// activiteit under it carries a goal link, only for a caller who may link goals at its leeftijd (I27).
    /// </summary>
    [HttpDelete("{runId:guid}/subthemas/{subthemaId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<IActionResult> VerwijderSubthema(Guid runId, Guid subthemaId, CancellationToken cancellationToken)
    {
        // The caller travels along for I27: a delete that would take a goal link needs their goal-link right.
        await _service.VerwijderSubthemaAsync(runId, subthemaId, Aanmelding.GebruikerId(User), cancellationToken);
        return NoContent();
    }

    /// <summary>Creates a subdoel (a manual goal link) on a subthema of the run's thema (R27's wizard twin, R32).</summary>
    [HttpPost("{runId:guid}/subthemas/{subthemaId:guid}/subdoelen")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<ActionResult<SubdoelWeergave>> MaakSubdoel(
        Guid runId, Guid subthemaId, [FromBody] ThemasController.DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.MaakSubdoelAsync(runId, subthemaId, invoer.LeerplandoelCode, cancellationToken));

    /// <summary>Deletes a subdoel this run created (I25).</summary>
    [HttpDelete("{runId:guid}/subthemas/{subthemaId:guid}/subdoelen/{subdoelId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<IActionResult> VerwijderSubdoel(Guid runId, Guid subthemaId, Guid subdoelId, CancellationToken cancellationToken)
    {
        await _service.VerwijderSubdoelAsync(runId, subthemaId, subdoelId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Creates an activiteit on a subthema of the run's thema, with the caller as its maker (I18).
    /// <para>
    /// Goal codes in the create are goal links by hand on a shared activiteit (R19), which the wizard row does not grant:
    /// R32 names subthema's, subdoelen and activiteiten, not their links. So a create that carries codes also needs
    /// <c>DoelenKoppelen</c> at the subthema's leeftijd, exactly as on the ordinary route; a themabeheer holder who is
    /// also that leeftijd's hoofdleerkracht has it (§3's union rule).
    /// </para>
    /// </summary>
    [HttpPost("{runId:guid}/subthemas/{subthemaId:guid}/activiteiten")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<ActionResult<ActiviteitWeergave>> MaakActiviteit(
        Guid runId, Guid subthemaId, [FromBody] ActiviteitCreatie creatie, CancellationToken cancellationToken)
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

        var activiteit = await _service.MaakActiviteitAsync(
            runId, subthemaId, Aanmelding.GebruikerId(User), creatie, cancellationToken);
        return Created($"/api/activiteiten/{activiteit.Id}", activiteit);
    }

    /// <summary>Edits an activiteit this run created and that is still under the run's thema (I25).</summary>
    [HttpPut("{runId:guid}/activiteiten/{activiteitId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<ActionResult<ActiviteitWeergave>> WijzigActiviteit(
        Guid runId, Guid activiteitId, [FromBody] ActiviteitWijzigingInvoer wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigActiviteitAsync(runId, activiteitId, wijziging, cancellationToken));

    /// <summary>
    /// Deletes an activiteit this run created and that is still under the run's thema (I25), and, while a goal is linked
    /// to it, only for a caller who may link goals at its leeftijd (I27).
    /// </summary>
    [HttpDelete("{runId:guid}/activiteiten/{activiteitId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Wizardinhoud)]
    public async Task<IActionResult> VerwijderActiviteit(Guid runId, Guid activiteitId, CancellationToken cancellationToken)
    {
        // The caller travels along for I27: deleting an activiteit a goal is linked to needs their goal-link right.
        await _service.VerwijderActiviteitAsync(runId, activiteitId, Aanmelding.GebruikerId(User), cancellationToken);
        return NoContent();
    }

    /// <summary>Finishes the run (I24). Its thema follows the ordinary rights from then on (I23).</summary>
    [HttpPost("{runId:guid}/afronden")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaOpbouw)]
    public async Task<ActionResult<WizardrunWeergave>> RondAf(Guid runId, CancellationToken cancellationToken) =>
        Ok(await _service.RondAfAsync(runId, cancellationToken));

    /// <summary>Closes the run without finishing it (I24). Its thema follows the ordinary rights from then on (I23).</summary>
    [HttpPost("{runId:guid}/sluiten")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaOpbouw)]
    public async Task<ActionResult<WizardrunWeergave>> Sluit(Guid runId, CancellationToken cancellationToken) =>
        Ok(await _service.SluitAsync(runId, cancellationToken));

    /// <summary>
    /// A leeftijd the wizard receives goes through the one rule for a leeftijd from outside the database, and a
    /// refusal is the write's own 400 and sentence, before the run is read. The write validates it again.
    /// </summary>
    private static void VereisLeeftijd(string? leeftijd)
    {
        if (Leeftijdsinhoud.UitInvoer(leeftijd) is null)
        {
            throw SchoolcontentValidatieFout.OngeldigeLeeftijd(leeftijd);
        }
    }
}
