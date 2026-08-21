using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Curriculum;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the minimumdoelen register behind the "Bekijk minimumdoelen"
/// toggle on the Doelen screen (FR-2.4): browse/filter the decreed minimumdoelen grouped by the
/// (discipline, domein, subdomein) of their concorded leerplandoelen (Art. VII.0 / IX.1).
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
    /// One page of minimumdoelen matching the filter (FR-2.4), ordered (discipline, domein, subdomein,
    /// leeftijd, nr). Every filter is optional; the response carries the total so the caller can page.
    /// </summary>
    /// <param name="zoek">Free text matched against the ref and the omschrijving.</param>
    /// <param name="discipline">A discipline number ("1", "9.2").</param>
    /// <param name="domein">A domein name.</param>
    /// <param name="subdomein">A subdomein name; only meaningful together with <paramref name="domein"/> (Art. VII.0).</param>
    /// <param name="jaarFase">A jaar/fase code from the concorded leerplandoelen.</param>
    /// <param name="overslaan">Paging offset; must be zero or positive.</param>
    /// <param name="aantal">Page size; 1 to <see cref="MinimumdoelFilter.MaxPaginaGrootte"/>.</param>
    [HttpGet]
    public async Task<ActionResult<MinimumdoelenPagina>> Lijst(
        CancellationToken cancellationToken,
        [FromQuery] string? zoek = null,
        [FromQuery] string? discipline = null,
        [FromQuery] string? domein = null,
        [FromQuery] string? subdomein = null,
        [FromQuery] string? jaarFase = null,
        [FromQuery] int overslaan = 0,
        [FromQuery] int aantal = MinimumdoelFilter.StandaardPaginaGrootte)
    {
        if (!ProbeerFilter(zoek, discipline, domein, subdomein, jaarFase, overslaan, aantal, out var filter, out var fout))
        {
            return BadRequest(Probleem(fout!));
        }

        return Ok(await _query.ZoekAsync(filter!, cancellationToken));
    }

    /// <summary>
    /// The filter vocabulary for the minimumdoelen register (FR-2.4). Accepts the same filter parameters
    /// as the list, scoping the counts only. <c>totaalAantalMinimumdoelen</c> stays unfiltered.
    /// </summary>
    [HttpGet("facetten")]
    public async Task<ActionResult<MinimumdoelFacettenWeergave>> Facetten(
        CancellationToken cancellationToken,
        [FromQuery] string? zoek = null,
        [FromQuery] string? discipline = null,
        [FromQuery] string? domein = null,
        [FromQuery] string? subdomein = null,
        [FromQuery] string? jaarFase = null,
        [FromQuery] int overslaan = 0,
        [FromQuery] int aantal = MinimumdoelFilter.StandaardPaginaGrootte)
    {
        if (!ProbeerFilter(zoek, discipline, domein, subdomein, jaarFase, overslaan, aantal, out var filter, out var fout))
        {
            return BadRequest(Probleem(fout!));
        }

        return Ok(await _query.HaalFacettenAsync(filter!, cancellationToken));
    }

    private static bool ProbeerFilter(
        string? zoek,
        string? discipline,
        string? domein,
        string? subdomein,
        string? jaarFase,
        int overslaan,
        int aantal,
        out MinimumdoelFilter? filter,
        out string? fout)
    {
        filter = null;
        fout = null;

        if (overslaan < 0)
        {
            fout = $"'overslaan' cannot be negative (was {overslaan}).";
            return false;
        }

        if (aantal < 1 || aantal > MinimumdoelFilter.MaxPaginaGrootte)
        {
            fout = $"'aantal' must be between 1 and {MinimumdoelFilter.MaxPaginaGrootte} (was {aantal}).";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(subdomein) && string.IsNullOrWhiteSpace(domein))
        {
            fout =
                "'subdomein' requires 'domein': subdomein names are not globally unique (Art. VII.0), " +
                "so a subdomein on its own would match rows from unrelated domeinen.";
            return false;
        }

        filter = new MinimumdoelFilter(zoek, discipline, domein, subdomein, jaarFase, overslaan, aantal);
        return true;
    }

    private static ProblemDetails Probleem(string detail) =>
        new()
        {
            Status = StatusCodes.Status400BadRequest,
            Title = Probleemtitels.OngeldigeAanvraag,
            Detail = detail,
        };
}
