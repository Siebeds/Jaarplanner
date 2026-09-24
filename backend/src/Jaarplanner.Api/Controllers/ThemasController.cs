using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Api.Infrastructure.Autorisatie;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for school-wide <c>Thema</c> CRUD and its themadoelen, which are minimumdoelen
/// (E1-10, FR-3.1/3.2, FB-043). All logic lives in <see cref="ISchoolcontentBeheerService"/>; the
/// controller only binds, delegates and maps results. Level scoping and the goal-link rules are
/// enforced in the service/domain (Art. IX.2 / IV.2); validation/not-found surface via the shared
/// exception handler in Program.cs.
/// <para>
/// <b>Rights (E6-02, ADR-0030 §3).</b> Creating and changing the thema, its themadoelen and its kernwoordenschat is the
/// row <c>ThemaBewerken</c> (admin, themabeheer; R4, R18). Deleting it is <c>ThemaVerwijderen</c> (default I26):
/// themabeheer only while the thema holds nothing but what its own open wizard run created. Creating a subthema under
/// it is the subthema row at the leeftijd in the body (<c>SubthemaBeheren</c>: admin and that leeftijd's
/// hoofdleerkrachten; R5, R21), so themabeheer gets no right there (I22) and the wizard has its own route for it. Reads
/// stay open to every signed-in gebruiker: a thema and its subthema's are shared content, not a klas's planning, and
/// <c>voor-klas</c> only narrows them to that klas's leeftijden (FB-013, ADR-0040). The own activiteiten in a thema are
/// the exception: a read shows another gebruiker's own activiteit only to whom <c>EigenActiviteitLezen</c> allows
/// (ADR-0049 D3), so the reads pass the reader's rights to the service.
/// </para>
/// </summary>
[ApiController]
[Route("api/themas")]
public sealed class ThemasController : ControllerBase
{
    private readonly ISchoolcontentBeheerService _service;
    private readonly IAuthorizationService _autorisatie;
    private readonly IRechtenService _rechten;

    public ThemasController(ISchoolcontentBeheerService service, IAuthorizationService autorisatie, IRechtenService rechten)
    {
        _service = service;
        _autorisatie = autorisatie;
        _rechten = rechten;
    }

    /// <summary>Body for adding a manual goal link: just the read-only leerplandoel code (Art. III.5).</summary>
    public sealed record DoelKoppelingInvoer(string LeerplandoelCode);

    /// <summary>Body for linking a minimumdoel as a themadoel: just the read-only minimumdoel's ref (Art. III.5).</summary>
    public sealed record MinimumdoelKoppelingInvoer(string MinimumdoelRef);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<ThemaWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemasOpAsync(await LezerAsync(cancellationToken), cancellationToken));

    [HttpGet("{themaId:guid}")]
    public async Task<ActionResult<ThemaWeergave>> Detail(Guid themaId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemaOpAsync(themaId, await LezerAsync(cancellationToken), cancellationToken));

    /// <summary>
    /// The shared thema-bibliotheek (E1-11, FR-3.3 resolved per-level, Art. IX.2): school-wide themadoelen +
    /// woordenschat per thema, without any class's subthema's.
    /// </summary>
    /// <remarks>With <paramref name="klasId"/>, only the thema's meant for that klas's leeftijd (FB-012, ADR-0069).</remarks>
    [HttpGet("bibliotheek")]
    public async Task<ActionResult<IReadOnlyList<ThemaBibliotheekItem>>> Bibliotheek(
        [FromQuery] Guid? klasId,
        CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemaBibliotheekOpAsync(klasId, cancellationToken));

    /// <summary>
    /// A thema as derived for a given klas (E1-11, Art. IX.2): the shared thema plus only that klas's
    /// subthema's/subdoelen/activiteiten — no other class's derivations.
    /// </summary>
    [HttpGet("{themaId:guid}/voor-klas/{klasId:guid}")]
    public async Task<ActionResult<ThemaWeergave>> VoorKlas(Guid themaId, Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalThemaVoorKlasAsync(themaId, klasId, await LezerAsync(cancellationToken), cancellationToken));

    /// <summary>The reader's rights, or none without a gebruiker id: then only shared activiteiten show.</summary>
    private async Task<Rechten?> LezerAsync(CancellationToken cancellationToken) =>
        Aanmelding.GebruikerId(User) is { } id ? await _rechten.HaalRechtenOpAsync(id, cancellationToken) : null;

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
    /// Deletes a thema with its themadoelen, subthema's, subdoelen and activiteiten, at every leeftijd.
    /// <para>
    /// <b>Admin may; themabeheer only while the thema holds nothing but what its own open wizard run created</b>
    /// (default I26, owner 2026-09-14). Anything else under it was made by hand, and deleting it by hand is admin's and
    /// the hoofdleerkrachten's (R21, R24, R25). A thema that any klas planned or scheduled is refused by the service, for
    /// everyone.
    /// </para>
    /// <para>
    /// <i>Until fix round 1 of slice 3 this was the row <c>ThemaBewerken</c>, which let themabeheer delete any unplanned
    /// thema with everything under it (antagonist, MAJOR A).</i>
    /// </para>
    /// </summary>
    [HttpDelete("{themaId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.ThemaVerwijderen, Rechtbron.Thema, "themaId")]
    public async Task<IActionResult> Verwijder(Guid themaId, CancellationToken cancellationToken)
    {
        await _service.VerwijderThemaAsync(themaId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Links a minimumdoel to the thema as a themadoel (FB-043). The leerplandoelen that concord to it come along without
    /// being chosen. There is no route that adds a leerplandoel as a themadoel any more.
    /// </summary>
    [HttpPost("{themaId:guid}/minimumdoelen")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]
    public async Task<ActionResult<ThemaMinimumdoelWeergave>> KoppelMinimumdoel(Guid themaId, [FromBody] MinimumdoelKoppelingInvoer invoer, CancellationToken cancellationToken) =>
        Ok(await _service.KoppelMinimumdoelAsync(themaId, invoer.MinimumdoelRef ?? string.Empty, cancellationToken));

    /// <summary>Unlinks a minimumdoel from the thema, and with it the leerplandoelen it brought along (FB-043).</summary>
    [HttpDelete("{themaId:guid}/minimumdoelen/{koppelingId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]
    public async Task<IActionResult> OntkoppelMinimumdoel(Guid themaId, Guid koppelingId, CancellationToken cancellationToken)
    {
        await _service.OntkoppelMinimumdoelAsync(themaId, koppelingId, cancellationToken);
        return NoContent();
    }

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
    /// A body leeftijd that is no leeftijd, a missing one included, is refused before the check, with the write's own
    /// 400 and sentence: it can neither reach the write unchecked nor slip past the check
    /// (<see cref="Leeftijdsinhoud.UitInvoer"/> and the write's validation share one rule). That is also why a caller
    /// with no right at all gets that 400 here rather than a 403: without a leeftijd there is no resource to ask about.
    /// A missing thema is the service's 404, after the check, because the answer of this row does not depend on the thema.
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
