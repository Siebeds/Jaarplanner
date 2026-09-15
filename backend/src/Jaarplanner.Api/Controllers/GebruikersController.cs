using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Directie's beheer of gebruikers and their rights (E6-04, FA FR-12.2). Thin (Art. VIII): the rules live in
/// <see cref="IGebruikerBeheerService"/>, and its faults become ProblemDetails in <c>GebruikerbeheerExceptionHandler</c>.
/// <para>
/// <b>Every route is directie only</b>: the ADR-0030 §3 row "Gebruikers, klassen en schooljaren beheren, leerkrachten
/// aan klassen koppelen, hoofdleerkrachten aanstellen, themabeheer en het directierecht toekennen" (R2, R3, R16), the
/// <see cref="Rechtenmatrix.Beleid.Beheer"/> policy, which also requires a session. A gebruiker without the directie
/// right gets 403, a request without a session 401.
/// </para>
/// <para>
/// Grants are <c>PUT</c> and revocations <c>DELETE</c> on the right itself, both idempotent, and each answers the
/// gebruiker as they are afterwards, so a screen can show the result without a second read.
/// </para>
/// </summary>
[ApiController]
[Route("api/gebruikers")]
[Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
public sealed class GebruikersController : ControllerBase
{
    private readonly IGebruikerBeheerService _service;

    public GebruikersController(IGebruikerBeheerService service) => _service = service;

    /// <summary>Every gebruiker with their rights, klassen and appointments, and the schooljaren that have ended.</summary>
    [HttpGet]
    public async Task<ActionResult<GebruikersOverzicht>> Overzicht(CancellationToken cancellationToken) =>
        Ok(await _service.HaalOverzichtOpAsync(cancellationToken));

    [HttpGet("{gebruikerId:guid}")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> Detail(Guid gebruikerId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalGebruikerOpAsync(gebruikerId, cancellationToken));

    /// <summary>Invites a person by their Microsoft sign-in name (ADR-0031 decision 3). 409 when it exists already.</summary>
    [HttpPost]
    public async Task<ActionResult<GebruikerBeheerWeergave>> NodigUit(
        [FromBody] GebruikerUitnodiging uitnodiging,
        CancellationToken cancellationToken)
    {
        var gebruiker = await _service.NodigUitAsync(uitnodiging, cancellationToken);
        return CreatedAtAction(nameof(Detail), new { gebruikerId = gebruiker.Id }, gebruiker);
    }

    /// <summary>Removes a gebruiker (I17). 409 for the last directie (ADR-0031 decision 7).</summary>
    [HttpDelete("{gebruikerId:guid}")]
    public async Task<IActionResult> Verwijder(Guid gebruikerId, CancellationToken cancellationToken)
    {
        await _service.VerwijderAsync(gebruikerId, cancellationToken);
        return NoContent();
    }

    [HttpPut("{gebruikerId:guid}/directierecht")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> GeefDirectierecht(Guid gebruikerId, CancellationToken cancellationToken) =>
        Ok(await _service.GeefDirectierechtAsync(gebruikerId, cancellationToken));

    /// <summary>409 for the last directie (ADR-0031 decision 7).</summary>
    [HttpDelete("{gebruikerId:guid}/directierecht")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> NeemDirectierechtAf(Guid gebruikerId, CancellationToken cancellationToken) =>
        Ok(await _service.NeemDirectierechtAfAsync(gebruikerId, cancellationToken));

    [HttpPut("{gebruikerId:guid}/themabeheer")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> GeefThemabeheer(Guid gebruikerId, CancellationToken cancellationToken) =>
        Ok(await _service.GeefThemabeheerAsync(gebruikerId, cancellationToken));

    [HttpDelete("{gebruikerId:guid}/themabeheer")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> NeemThemabeheerAf(Guid gebruikerId, CancellationToken cancellationToken) =>
        Ok(await _service.NeemThemabeheerAfAsync(gebruikerId, cancellationToken));

    /// <summary>Gives Leerlingzorg (ADR-0035 R18, FB-008): reading every ontwikkelingsrapport.</summary>
    [HttpPut("{gebruikerId:guid}/leerlingzorg")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> GeefLeerlingzorg(Guid gebruikerId, CancellationToken cancellationToken) =>
        Ok(await _service.GeefLeerlingzorgAsync(gebruikerId, cancellationToken));

    [HttpDelete("{gebruikerId:guid}/leerlingzorg")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> NeemLeerlingzorgAf(Guid gebruikerId, CancellationToken cancellationToken) =>
        Ok(await _service.NeemLeerlingzorgAfAsync(gebruikerId, cancellationToken));

    /// <summary>Makes the gebruiker a leerkracht of the klas (R15).</summary>
    [HttpPut("{gebruikerId:guid}/klassen/{klasId:guid}")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> WijsKlasToe(Guid gebruikerId, Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.WijsKlasToeAsync(gebruikerId, klasId, cancellationToken));

    [HttpDelete("{gebruikerId:guid}/klassen/{klasId:guid}")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> HaalKlasWeg(Guid gebruikerId, Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalKlasWegAsync(gebruikerId, klasId, cancellationToken));

    /// <summary>Appoints the gebruiker hoofdleerkracht of a jaarfase in a schooljaar (R5, I20).</summary>
    [HttpPut("{gebruikerId:guid}/hoofdleerkracht/{schooljaarId:guid}/{jaarfase}")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> StelAan(
        Guid gebruikerId,
        Guid schooljaarId,
        string jaarfase,
        CancellationToken cancellationToken) =>
        Ok(await _service.StelAanAlsHoofdleerkrachtAsync(gebruikerId, schooljaarId, jaarfase, cancellationToken));

    [HttpDelete("{gebruikerId:guid}/hoofdleerkracht/{schooljaarId:guid}/{jaarfase}")]
    public async Task<ActionResult<GebruikerBeheerWeergave>> TrekIn(
        Guid gebruikerId,
        Guid schooljaarId,
        string jaarfase,
        CancellationToken cancellationToken) =>
        Ok(await _service.TrekAanstellingInAsync(gebruikerId, schooljaarId, jaarfase, cancellationToken));
}
