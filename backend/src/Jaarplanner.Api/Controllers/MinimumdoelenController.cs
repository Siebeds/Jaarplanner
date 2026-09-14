using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the minimumdoelen register behind the Minimumdoelen view of the Doelen screen
/// (FR-2.4): the decreed minimumdoelen in the decree's own ordering, leergebied › rubriek › subrubriek (TB-010), and one
/// minimumdoel with the leerplandoelen that concord to it.
/// <para>
/// <b>Read-only, by construction.</b> There is no POST, PUT, PATCH or DELETE here: minimumdoelen are
/// decreed reference data whose only sanctioned writer is the Op.stap import (Art. III.1).
/// </para>
/// </summary>
[ApiController]
[Route("api/minimumdoelen")]
public sealed class MinimumdoelenController : ControllerBase
{
    private readonly IMinimumdoelenQuery _query;

    public MinimumdoelenController(IMinimumdoelenQuery query) => _query = query;

    /// <summary>
    /// One page of minimumdoelen matching the filter, in the tree's order. Every filter is optional; the response carries
    /// the total so the caller can page. The branch parameters (<paramref name="leergebied"/> down to
    /// <paramref name="zonderOrdening"/>) select one branch of the tree.
    /// </summary>
    /// <param name="zoek">Free text matched against the ref and the omschrijving.</param>
    /// <param name="leeftijd">A leeftijd code: <c>K-</c>, <c>4-</c> or <c>6-</c>.</param>
    /// <param name="discipline">A discipline number ("1", "9.2") of a concorded leerplandoel.</param>
    /// <param name="domein">A domein name of a concorded leerplandoel.</param>
    /// <param name="subdomein">A subdomein name; only meaningful together with <paramref name="domein"/> (Art. VII.0).</param>
    /// <param name="jaarFase">A jaar/fase code of a concorded leerplandoel.</param>
    /// <param name="leergebied">The branch's leergebied.</param>
    /// <param name="rubriek">The branch's rubriek; requires <paramref name="leergebied"/>.</param>
    /// <param name="subrubriek">The branch's subrubriek; requires <paramref name="rubriek"/>.</param>
    /// <param name="zonderSubrubriek">Only the minimumdoelen directly under <paramref name="rubriek"/>, which it requires.</param>
    /// <param name="zonderOrdening">Only the minimumdoelen whose ordering is not known; excludes the other branch parameters.</param>
    /// <param name="overslaan">Paging offset; must be zero or positive.</param>
    /// <param name="aantal">Page size; 1 to <see cref="MinimumdoelFilter.MaxPaginaGrootte"/>.</param>
    [HttpGet]
    public async Task<ActionResult<MinimumdoelenPagina>> Lijst(
        CancellationToken cancellationToken,
        [FromQuery] string? zoek = null,
        [FromQuery] string? leeftijd = null,
        [FromQuery] string? discipline = null,
        [FromQuery] string? domein = null,
        [FromQuery] string? subdomein = null,
        [FromQuery] string? jaarFase = null,
        [FromQuery] string? leergebied = null,
        [FromQuery] string? rubriek = null,
        [FromQuery] string? subrubriek = null,
        [FromQuery] bool zonderSubrubriek = false,
        [FromQuery] bool zonderOrdening = false,
        [FromQuery] int overslaan = 0,
        [FromQuery] int aantal = MinimumdoelFilter.StandaardPaginaGrootte)
    {
        var filter = new MinimumdoelFilter(
            zoek, discipline, domein, subdomein, jaarFase, overslaan, aantal,
            leeftijd, leergebied, rubriek, subrubriek, zonderSubrubriek, zonderOrdening);
        if (Fout(filter) is { } fout)
        {
            return BadRequest(Probleem(fout));
        }

        return Ok(await _query.ZoekAsync(filter, cancellationToken));
    }

    /// <summary>
    /// The tree under the filter with a count per leergebied, rubriek and subrubriek, and a count per leeftijd under the
    /// rest of the filter. Accepts the list's filter; the branch parameters are ignored, since the tree is every branch.
    /// <c>totaalAantalMinimumdoelen</c> stays unfiltered.
    /// </summary>
    [HttpGet("facetten")]
    public async Task<ActionResult<MinimumdoelFacettenWeergave>> Facetten(
        CancellationToken cancellationToken,
        [FromQuery] string? zoek = null,
        [FromQuery] string? leeftijd = null,
        [FromQuery] string? discipline = null,
        [FromQuery] string? domein = null,
        [FromQuery] string? subdomein = null,
        [FromQuery] string? jaarFase = null)
    {
        var filter = new MinimumdoelFilter(zoek, discipline, domein, subdomein, jaarFase, Leeftijd: leeftijd);
        if (Fout(filter) is { } fout)
        {
            return BadRequest(Probleem(fout));
        }

        return Ok(await _query.HaalFacettenAsync(filter, cancellationToken));
    }

    /// <summary>
    /// One minimumdoel in full, with the stored leerplandoelen that concord to it per jaar/fase (TB-010). A ref no
    /// minimumdoel carries is a <b>404</b>, as for a leerplandoel, so a stale link gets an honest answer.
    /// </summary>
    [HttpGet("{minimumdoelRef}")]
    public async Task<ActionResult<MinimumdoelDetailWeergave>> Detail(
        string minimumdoelRef,
        CancellationToken cancellationToken)
    {
        var minimumdoel = await _query.HaalDetailAsync(minimumdoelRef, cancellationToken);

        return minimumdoel is null ? NotFound() : Ok(minimumdoel);
    }

    /// <summary>
    /// Why the filter cannot be answered, or null. English: a malformed query string is an operator diagnostic, not
    /// something a teacher can act on (Art. II.3 as amended 2026-07-30).
    /// </summary>
    private static string? Fout(MinimumdoelFilter filter)
    {
        if (filter.Overslaan < 0)
        {
            return $"'overslaan' cannot be negative (was {filter.Overslaan}).";
        }

        if (filter.Aantal < 1 || filter.Aantal > MinimumdoelFilter.MaxPaginaGrootte)
        {
            return $"'aantal' must be between 1 and {MinimumdoelFilter.MaxPaginaGrootte} (was {filter.Aantal}).";
        }

        if (!string.IsNullOrWhiteSpace(filter.Subdomein) && string.IsNullOrWhiteSpace(filter.Domein))
        {
            return "'subdomein' requires 'domein': subdomein names are not globally unique (Art. VII.0), " +
                "so a subdomein on its own would match rows from unrelated domeinen.";
        }

        if (!string.IsNullOrWhiteSpace(filter.Leeftijd) && !MinimumdoelFilter.Leeftijden.Contains(filter.Leeftijd.Trim()))
        {
            return $"'leeftijd' must be one of {string.Join(", ", MinimumdoelFilter.Leeftijden)} (was '{filter.Leeftijd}').";
        }

        var heeftLeergebied = !string.IsNullOrWhiteSpace(filter.Leergebied);
        var heeftRubriek = !string.IsNullOrWhiteSpace(filter.Rubriek);
        var heeftSubrubriek = !string.IsNullOrWhiteSpace(filter.Subrubriek);
        if (filter.ZonderOrdening && (heeftLeergebied || heeftRubriek || heeftSubrubriek || filter.ZonderSubrubriek))
        {
            return "'zonderOrdening' selects the minimumdoelen without a leergebied, so it takes no other branch parameter.";
        }

        if (heeftRubriek && !heeftLeergebied)
        {
            return "'rubriek' requires 'leergebied': a branch is named from the top.";
        }

        if ((heeftSubrubriek || filter.ZonderSubrubriek) && !heeftRubriek)
        {
            return "'subrubriek' and 'zonderSubrubriek' require 'rubriek': a branch is named from the top.";
        }

        if (heeftSubrubriek && filter.ZonderSubrubriek)
        {
            return "'subrubriek' and 'zonderSubrubriek' exclude each other.";
        }

        return null;
    }

    private static ProblemDetails Probleem(string detail) =>
        new()
        {
            Status = StatusCodes.Status400BadRequest,
            Title = Probleemtitels.OngeldigeAanvraag,
            Detail = detail,
        };
}
