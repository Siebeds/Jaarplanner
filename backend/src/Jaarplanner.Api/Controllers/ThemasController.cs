using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for school-wide <c>Thema</c> CRUD and the 2–3 <c>Themadoel</c>en
/// per thema (E1-10, FR-3.1/3.2). All logic lives in <see cref="ISchoolcontentBeheerService"/>; the
/// controller only binds, delegates and maps results. Level scoping and the goal-link rules are
/// enforced in the service/domain (Art. IX.2 / IV.2); validation/not-found surface via the shared
/// exception handler in Program.cs.
/// <para>
/// <b>Rights (E6-02, ADR-0030 §3).</b> Every write on the thema itself, its themadoelen and its kernwoordenschat is the
/// row <c>ThemaBewerken</c> (directie, themabeheer; R4, R18). Creating a subthema under it is not: that is the subthema
/// row at the leeftijd in the body (<c>SubthemaBeheren</c>: directie and that leeftijd's hoofdleerkrachten; R5, R21), so
/// themabeheer gets no right here (I22) and the wizard has its own route for it. Reads stay open to every signed-in
/// gebruiker (I9).
/// </para>
/// </summary>
[ApiController]
[Route("api/themas")]
public sealed class ThemasController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;
    private readonly IAuthorizationService _autorisatie;

    public ThemasController(ISchoolcontentBeheerService service, IAuthorizationService autorisatie)
    {
        _service = service;
        _autorisatie = autorisatie;
    }

    /// <summary>Body for adding a manual themadoel/goal link: just the read-only leerplandoel code (Art. III.5).</summary>
    public sealed record DoelKoppelingInvoer(string LeerplandoelCode);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ThemaWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemasOpAsync(cancellationToken));

    [HttpGet("{themaId:guid}")]
    public async Task<ActionResult<ThemaWeergave>> Detail(Guid themaId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemaOpAsync(themaId, cancellationToken));

    /// <summary>
    /// The shared thema-bibliotheek (E1-11, FR-3.3 resolved per-level, Art. IX.2): school-wide themadoelen +
    /// woordenschat per thema, without any class's subthema's.
    /// </summary>
    [HttpGet("bibliotheek")]
    public async Task<ActionResult<IReadOnlyList<ThemaBibliotheekItem>>> Bibliotheek(CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemaBibliotheekOpAsync(cancellationToken));

    /// <summary>
    /// A thema as derived for a given klas (E1-11, Art. IX.2): the shared thema plus only that klas's
    /// subthema's/subdoelen/activiteiten — no other class's derivations.
    /// </summary>
    [HttpGet("{themaId:guid}/voor-klas/{klasId:guid}")]
    public async Task<ActionResult<ThemaWeergave>> VoorKlas(Guid themaId, Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemaVoorKlasAsync(themaId, klasId, cancellationToken));

    [HttpPost]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]
    public async Task<ActionResult<ThemaWeergave>> Maak([FromBody] ThemaCreatie creatie, CancellationToken cancellationToken)
    {
        var thema = await _service.MaakThemaAsync(creatie, cancellationToken);
        return CreatedAtAction(nameof(Detail), new { themaId = thema.Id }, thema);
    }

    [HttpPut("{themaId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]
    public async Task<ActionResult<ThemaWeergave>> Wijzig(Guid themaId, [FromBody] ThemaWijziging wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigThemaAsync(themaId, wijziging, cancellationToken));

    /// <summary>
    /// Deletes a thema with its subthema's, subdoelen and activiteiten, at every leeftijd. The thema row (R4), read as
    /// covering the thema's whole lifecycle: §3 names no separate delete row, and a thema in any klas's planning is refused
    /// by the service anyway. Recorded as an unclean mapping in the E6-02 worklog (slice 3).
    /// </summary>
    [HttpDelete("{themaId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]
    public async Task<IActionResult> Verwijder(Guid themaId, CancellationToken cancellationToken)
    {
        await _service.VerwijderThemaAsync(themaId, cancellationToken);
        return NoContent();
    }

    [HttpPost("{themaId:guid}/themadoelen")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]
    public async Task<ActionResult<ThemadoelWeergave>> VoegThemadoelToe(Guid themaId, [FromBody] DoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.VoegThemadoelToeAsync(themaId, invoer.LeerplandoelCode, cancellationToken));

    [HttpDelete("{themaId:guid}/themadoelen/{themadoelId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]
    public async Task<IActionResult> VerwijderThemadoel(Guid themaId, Guid themadoelId, CancellationToken cancellationToken)
    {
        await _service.VerwijderThemadoelAsync(themaId, themadoelId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Creates a subthema by hand. The row is the subthema's (R5, R21) at the leeftijd in the <b>body</b>, so it is asked
    /// here, after binding, rather than in an attribute.
    /// <para>
    /// A body leeftijd that is no leeftijd is refused before the check, with the write's own 400 and sentence: it can
    /// neither reach the write unchecked nor slip past the check (<see cref="Leeftijdsinhoud.UitInvoer"/> and the write's
    /// validation share one rule). A missing thema is the service's 404, after the check, because the answer of this row
    /// does not depend on the thema.
    /// </para>
    /// </summary>
    [HttpPost("{themaId:guid}/subthemas")]
    public async Task<ActionResult<SubthemaWeergave>> MaakSubthema(Guid themaId, [FromBody] SubthemaCreatie creatie, CancellationToken cancellationToken)
    {
        var bron = Leeftijdsinhoud.UitInvoer(creatie.Leeftijd)
            ?? throw SchoolcontentValidatieFout.OngeldigeLeeftijd(creatie.Leeftijd);
        if (!await _autorisatie.MagAsync(User, bron, Rechtenmatrix.Beleid.SubthemaBeheren))
        {
            return Forbid();
        }

        var subthema = await _service.MaakSubthemaAsync(themaId, creatie, cancellationToken);
        // The subthema is part of the thema aggregate; its full state is read via GET /api/themas/{id}.
        return Created($"/api/themas/{themaId}", subthema);
    }
}
