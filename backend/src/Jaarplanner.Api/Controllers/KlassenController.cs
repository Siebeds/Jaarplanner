using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for <c>Klas</c> CRUD (Art. IX.3). All logic lives in
/// <see cref="IKlasBeheerService"/>; validation/not-found surface via the shared exception handler.
/// <para>
/// Without this endpoint a fresh deployment had no way to create a class, so every class-scoped
/// subthema/activiteit was rejected or silently dropped on import, and E3's per-class jaarplan
/// generation had nothing to generate for.
/// </para>
/// <para>
/// <b>Rights (E6-02):</b> creating, changing and deleting a klas is the row <c>Beheer</c>, directie only (ADR-0030 R2,
/// R3, R16). That includes the klas's jaarfase, which the klaskiezer lets a teacher set: since slice 3 only directie
/// may send it, and the frontend has to hide the field for anyone else (slice 4).
/// </para>
/// <para>
/// <b>Reads (FB-013, ADR-0040):</b> the row <c>KlasplanningBekijken</c>. The list holds only the klassen it lets the
/// gebruiker read, so the klaskiezer offers nothing the planning routes would refuse, and one klas is refused like its
/// planning.
/// </para>
/// </summary>
[ApiController]
[Route("api/klassen")]
public sealed class KlassenController : ControllerBase
{
    private readonly IKlasBeheerService _service;
    private readonly IAuthorizationService _autorisatie;

    public KlassenController(IKlasBeheerService service, IAuthorizationService autorisatie)
    {
        _service = service;
        _autorisatie = autorisatie;
    }

    /// <summary>
    /// Every klas the gebruiker may read (FB-013): each is asked the row <c>KlasplanningBekijken</c> on its own
    /// <see cref="Klasinzage"/>, the same question its planning routes ask, so the list and the routes cannot disagree.
    /// The rights are read once per request (<c>RechtenService</c>), so the loop costs no query per klas.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<KlasWeergave>>> Lijst(CancellationToken cancellationToken) =>
        Ok(await _autorisatie.LeesbaarAsync(User, await _service.HaalKlassenOpAsync(cancellationToken)));

    /// <summary>
    /// Every klas whose ontwikkelingsrapporten the gebruiker may read (FB-008), for the report's own klas choice: the K3
    /// klassen of every schooljaar, each asked <c>OntwikkelingsrapportLezen</c>. Not <see cref="Lijst"/>, which is the
    /// planning's: Leerlingzorg reads no klas's planning (R18), and a hoofdleerkracht of K3 reads no report (R17).
    /// </summary>
    [HttpGet("/api/rapportklassen")]
    public async Task<ActionResult<IReadOnlyList<KlasWeergave>>> Rapportklassen(CancellationToken cancellationToken) =>
        Ok(await _autorisatie.RapportleesbaarAsync(User, await _service.HaalKlassenOpAsync(cancellationToken)));

    [HttpGet("{klasId:guid}")]
    [RechtOp(Rechtenmatrix.Beleid.KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]
    public async Task<ActionResult<KlasWeergave>> Detail(Guid klasId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalKlasOpAsync(klasId, cancellationToken));

    /// <summary>
    /// Creates a class <b>inside a school year</b> (Art. IX.3: "Schooljaar — contains multiple klassen"; E3-01).
    /// The route carries the containment, so the body cannot disagree with it and a "rename" can never move a
    /// class to another year. Create the school year first via <c>POST /api/schooljaren</c>.
    /// </summary>
    [HttpPost("/api/schooljaren/{schooljaarId:guid}/klassen")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<ActionResult<KlasWeergave>> Maak(
        Guid schooljaarId,
        [FromBody] KlasCreatie creatie,
        CancellationToken cancellationToken)
    {
        var klas = await _service.MaakKlasAsync(schooljaarId, creatie, cancellationToken);
        return CreatedAtAction(nameof(Detail), new { klasId = klas.Id }, klas);
    }

    [HttpPut("{klasId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<ActionResult<KlasWeergave>> Wijzig(Guid klasId, [FromBody] KlasCreatie wijziging, CancellationToken cancellationToken) =>
        Ok(await _service.WijzigKlasAsync(klasId, wijziging, cancellationToken));

    [HttpDelete("{klasId:guid}")]
    [Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]
    public async Task<IActionResult> Verwijder(Guid klasId, CancellationToken cancellationToken)
    {
        await _service.VerwijderKlasAsync(klasId, cancellationToken);
        return NoContent();
    }
}
