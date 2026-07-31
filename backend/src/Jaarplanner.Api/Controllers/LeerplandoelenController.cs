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
    /// <summary>
    /// The one place the link-visibility decision is taken (E1-16, Art. XIV seam).
    /// <para>
    /// <b>This value records the present no-authentication reality; it is not a ruling on FR-10.2</b>
    /// ("teacher visibility: school-wide / per graad / narrower", still open). There is no authenticated user
    /// (E6-01, gated by E7-11), so the API cannot know which klas the reader teaches, and narrowing to "your
    /// klas" would narrow to no klas at all: a doel used by one class's activiteit would be reported as used
    /// nowhere, which is a false statement a teacher would act on. Every class-scoped row therefore names its
    /// klas instead, so nothing reads as school-wide.
    /// </para>
    /// <para>
    /// When the role matrix lands (E6-02), this constant becomes the place the decision is applied: change the
    /// value, or bind it from configuration the way <c>Opstap:DisciplineSelectie</c> / ADR-0019 isolates the
    /// disciplines-first choice. Nothing else in the query has to move.
    /// </para>
    /// </summary>
    private const Koppelingzichtbaarheid Zichtbaarheid = Koppelingzichtbaarheid.Alles;

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
        if (!ProbeerFilter(zoek, discipline, domein, subdomein, doelsoort, jaarFase, overslaan, aantal,
                out var filter, out var fout))
        {
            return BadRequest(fout);
        }

        return Ok(await _query.ZoekAsync(filter!, cancellationToken));
    }

    /// <summary>
    /// The filter vocabulary, derived from the loaded rows (E1-16 clause 2), plus the unfiltered total.
    /// <para>
    /// It accepts the <b>same filter parameters</b> as the list, and they scope the <b>counts</b> only: each
    /// dimension is counted under the rest of the filter, so a number states what picking that option would
    /// actually yield, while the option sets stay put. Before this, picking Discipline = Wiskunde still offered
    /// "Natuur (3)" and delivered nothing (antagonist finding 12). The paging parameters are accepted and
    /// ignored, since facets are aggregates; they are still validated, so one bad request does not behave
    /// differently on two endpoints.
    /// </para>
    /// <para>
    /// <c>totaalAantalDoelen</c> stays <b>unfiltered</b>: it is what lets the UI distinguish "no curriculum
    /// imported yet" from "your filters exclude everything", two states that must not be collapsed.
    /// </para>
    /// </summary>
    [HttpGet("facetten")]
    public async Task<ActionResult<LeerplandoelFacettenWeergave>> Facetten(
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
        if (!ProbeerFilter(zoek, discipline, domein, subdomein, doelsoort, jaarFase, overslaan, aantal,
                out var filter, out var fout))
        {
            return BadRequest(fout);
        }

        return Ok(await _query.HaalFacettenAsync(filter!, cancellationToken));
    }

    /// <summary>
    /// One leerplandoel in full (E1-16 clause 3): every imported field, its concordance, and the school
    /// content that links to it with each link's status and, for a class-scoped link, its klas. A code no
    /// leerplandoel carries is a <b>404</b>, so a stale or mistyped deep link gets an honest answer rather than
    /// an empty detail pane.
    /// <para>
    /// The link visibility is passed explicitly from <see cref="Zichtbaarheid"/> — the single place that
    /// decision is taken. Read its documentation before changing it: it records today's absence of
    /// authentication and is not an answer to FR-10.2.
    /// </para>
    /// </summary>
    [HttpGet("{code}")]
    public async Task<ActionResult<LeerplandoelDetailWeergave>> Detail(
        string code,
        CancellationToken cancellationToken)
    {
        var doel = await _query.HaalDetailAsync(code, Zichtbaarheid, cancellationToken);

        return doel is null ? NotFound() : Ok(doel);
    }

    /// <summary>
    /// Validates and binds the query string into a <see cref="LeerplandoelFilter"/>, or explains why not so the
    /// caller can answer 400. Shared by both read endpoints, so the two cannot drift into accepting different
    /// input.
    /// <para>
    /// The <b>subdomein-without-domein</b> refusal is the load-bearing one. Art. VII.0 makes
    /// <c>(domein, subdomein)</c> the grouping key precisely because subdomein names are not globally unique:
    /// Muzische vorming repeats <i>Bouwstenen</i> under Muziek, Beeld, Drama and Dans, so a bare
    /// <c>?subdomein=Bouwstenen</c> silently sums four unrelated sets into one total. Rejecting it here rather
    /// than dropping it in one client is what makes the contract true for every caller; the frontend also
    /// omits it, but a guard that lives only in a client is not a guard.
    /// </para>
    /// </summary>
    private static bool ProbeerFilter(
        string? zoek,
        string? discipline,
        string? domein,
        string? subdomein,
        string? doelsoort,
        string? jaarFase,
        int overslaan,
        int aantal,
        out LeerplandoelFilter? filter,
        out string? fout)
    {
        filter = null;
        fout = null;

        if (overslaan < 0)
        {
            fout = $"'overslaan' cannot be negative (was {overslaan}).";
            return false;
        }

        if (aantal < 1 || aantal > LeerplandoelFilter.MaxPaginaGrootte)
        {
            fout = $"'aantal' must be between 1 and {LeerplandoelFilter.MaxPaginaGrootte} (was {aantal}).";
            return false;
        }

        if (!ProbeerDoelsoort(doelsoort, out var gekozenDoelsoort))
        {
            fout = $"'{doelsoort}' is not a known doelsoort.";
            return false;
        }

        if (!string.IsNullOrWhiteSpace(subdomein) && string.IsNullOrWhiteSpace(domein))
        {
            fout =
                "'subdomein' requires 'domein': subdomein names are not globally unique (Art. VII.0), " +
                "so a subdomein on its own would match rows from unrelated domeinen.";
            return false;
        }

        filter = new LeerplandoelFilter(
            zoek,
            discipline,
            domein,
            subdomein,
            gekozenDoelsoort,
            jaarFase,
            overslaan,
            aantal);

        return true;
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
