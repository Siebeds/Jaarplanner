using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the Op.stap leerplandoel register behind the Doelen screen
/// (E1-16, FR-2.4): browse/search the imported curriculum, read the filter vocabulary, and open one doel in
/// full. It binds, validates the query string and delegates to <see cref="ILeerplandoelenQuery"/>; the
/// filtering, searching, paging and grouping all live in Application/Infrastructure.
/// <para>
/// <b>Read-only, by construction.</b> There is no POST, PUT, PATCH or DELETE here and no service that could
/// take one: the curriculum is decreed reference data whose only sanctioned writer is the Op.stap import
/// (Art. III.1). In particular nothing on this surface can set <c>NietMeerInOpstap</c>.
/// </para>
/// <para>
/// <b>Bad input is a 400, never a 500.</b> Two traps are handled explicitly. <c>doelsoort</c> is bound as a
/// <b>string</b> and parsed here rather than declared as the enum: ASP.NET Core happily binds any integer to
/// an enum parameter, which is exactly how <c>?niveau=99</c> reached the domain and produced a 500 in E3-06.
/// And the paging values are range-checked, so <c>?aantal=100000</c> is refused instead of being served.
/// </para>
/// <para>
/// <b>Route shape.</b> <c>facetten</c> and the sibling <c>ongekoppeld</c> (E2-06, its own controller) are
/// literal segments, and ASP.NET Core's route precedence prefers a literal over the <c>{code}</c> parameter,
/// so they are reachable even though a leerplandoel code could in principle read the same. A code arriving
/// with a slash in it is not addressable this way; Op.stap codes do not contain one.
/// </para>
/// </summary>
[ApiController]
[Route("api/leerplandoelen")]
public sealed class LeerplandoelenController : ControllerBase
{
    private readonly ILeerplandoelenQuery _query;

    public LeerplandoelenController(ILeerplandoelenQuery query) => _query = query;

    /// <summary>
    /// One page of leerplandoelen (E1-16 clause 1/2). Every filter is optional; the page is ordered
    /// <c>(domein, subdomein, code)</c> and the response carries the total the filter matches so the caller
    /// can page without guessing where the end is.
    /// </summary>
    /// <param name="zoek">Free text, matched against the code and the goal text.</param>
    /// <param name="discipline">A discipline number ("1", "9.2").</param>
    /// <param name="domein">A domein name.</param>
    /// <param name="subdomein">A subdomein name; only meaningful together with <paramref name="domein"/> (Art. VII.0).</param>
    /// <param name="doelsoort">A doelsoort by enum name or Op.stap short code ("Minimumdoel" or "MD").</param>
    /// <param name="jaarFase">A jaar/fase code (JK, K2, K3, L1–L6, or a fase for P/S).</param>
    /// <param name="overslaan">Paging offset; must be zero or positive.</param>
    /// <param name="aantal">Page size; 1 to <see cref="LeerplandoelFilter.MaxPaginaGrootte"/>.</param>
    [HttpGet]
    public async Task<ActionResult<LeerplandoelenPagina>> Lijst(
        CancellationToken cancellationToken,
        [FromQuery] string? zoek = null,
        [FromQuery] string? discipline = null,
        [FromQuery] string? domein = null,
        [FromQuery] string? subdomein = null,
        [FromQuery] string? doelsoort = null,
        [FromQuery] string? jaarFase = null,
        [FromQuery] int overslaan = 0,
        [FromQuery] int aantal = LeerplandoelFilter.StandaardPaginaGrootte)
    {
        if (overslaan < 0)
        {
            return BadRequest($"'overslaan' cannot be negative (was {overslaan}).");
        }

        if (aantal < 1 || aantal > LeerplandoelFilter.MaxPaginaGrootte)
        {
            return BadRequest(
                $"'aantal' must be between 1 and {LeerplandoelFilter.MaxPaginaGrootte} (was {aantal}).");
        }

        if (!ProbeerDoelsoort(doelsoort, out var gekozenDoelsoort))
        {
            return BadRequest($"'{doelsoort}' is not a known doelsoort.");
        }

        var filter = new LeerplandoelFilter(
            zoek,
            discipline,
            domein,
            subdomein,
            gekozenDoelsoort,
            jaarFase,
            overslaan,
            aantal);

        return Ok(await _query.ZoekAsync(filter, cancellationToken));
    }

    /// <summary>
    /// The filter vocabulary, derived from the loaded rows (E1-16 clause 2), plus the unfiltered total. The
    /// total is what lets the UI distinguish "no curriculum imported yet" from "your filters exclude
    /// everything" — two states that must not be collapsed into one message.
    /// </summary>
    [HttpGet("facetten")]
    public async Task<ActionResult<LeerplandoelFacettenWeergave>> Facetten(CancellationToken cancellationToken) =>
        Ok(await _query.HaalFacettenAsync(cancellationToken));

    /// <summary>
    /// One leerplandoel in full (E1-16 clause 3): every imported field, its concordance, and the school
    /// content that links to it with each link's status. A code no leerplandoel carries is a <b>404</b>, so a
    /// stale or mistyped deep link gets an honest answer rather than an empty detail pane.
    /// </summary>
    [HttpGet("{code}")]
    public async Task<ActionResult<LeerplandoelDetailWeergave>> Detail(
        string code,
        CancellationToken cancellationToken)
    {
        var doel = await _query.HaalDetailAsync(code, cancellationToken);

        return doel is null ? NotFound() : Ok(doel);
    }

    /// <summary>
    /// Parses the <c>doelsoort</c> query value, accepting either the enum name the API serialises
    /// ("Minimumdoel") or the official Op.stap short code ("MD", "+"). An absent/blank value means "no
    /// filter"; anything else is rejected so the caller gets a 400.
    /// <para>
    /// <see cref="Enum.TryParse{TEnum}(string, bool, out TEnum)"/> alone is not enough: it accepts the
    /// <i>numeric</i> form of any integer, so "99" would parse into an undefined <see cref="Doelsoort"/> and
    /// travel on as a filter that matches nothing. Hence the <see cref="Enum.IsDefined{TEnum}"/> check.
    /// </para>
    /// </summary>
    private static bool ProbeerDoelsoort(string? waarde, out Doelsoort? doelsoort)
    {
        doelsoort = null;

        if (string.IsNullOrWhiteSpace(waarde))
        {
            return true;
        }

        var genormaliseerd = waarde.Trim();

        if (DoelsoortCodes.TryFromCode(genormaliseerd, out var uitCode))
        {
            doelsoort = uitCode;
            return true;
        }

        if (Enum.TryParse<Doelsoort>(genormaliseerd, ignoreCase: true, out var uitNaam)
            && Enum.IsDefined(uitNaam))
        {
            doelsoort = uitNaam;
            return true;
        }

        return false;
    }
}
