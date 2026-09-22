using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Application.Kat;
using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for the cat's deurmat (TB-057, ADR-0059 K4): what it brought the signed-in
/// gebruiker. FB-071 is what draws it.
/// <para>
/// <b>It declares no policy, and that is the point.</b> Every route here is about the caller's own deurmat, so there
/// is no resource in the route to check a row against; <see cref="IDeurmatService"/> filters on the caller's id and
/// puts every row to <c>Rechtenmatrix</c> itself (Art. VI.1). A signal of someone else's is answered as a missing
/// one.
/// </para>
/// </summary>
[ApiController]
public sealed class DeurmatController : ControllerBase
{
    private readonly IDeurmatService _deurmat;

    public DeurmatController(IDeurmatService deurmat) => _deurmat = deurmat;

    /// <summary>What the cat brought the caller: what it noticed, and the proposals waiting for her.</summary>
    [HttpGet("api/deurmat")]
    public async Task<ActionResult<Deurmat>> Haal(CancellationToken cancellationToken)
    {
        if (Aanmelding.GebruikerId(User) is not { } gebruikerId)
        {
            return Forbid();
        }

        return Ok(await _deurmat.HaalAsync(gebruikerId, cancellationToken));
    }

    /// <summary>Records that the caller saw one of her signals.</summary>
    [HttpPost("api/deurmat/signalen/{signaalId:guid}/gezien")]
    public async Task<IActionResult> Gezien(Guid signaalId, CancellationToken cancellationToken)
    {
        if (Aanmelding.GebruikerId(User) is not { } gebruikerId)
        {
            return Forbid();
        }

        await _deurmat.MarkeerGezienAsync(gebruikerId, signaalId, cancellationToken);
        return NoContent();
    }

    /// <summary>Puts one of her signals away until the next schooldag (ADR-0059 D4).</summary>
    [HttpPost("api/deurmat/signalen/{signaalId:guid}/later")]
    public async Task<IActionResult> Later(Guid signaalId, CancellationToken cancellationToken)
    {
        if (Aanmelding.GebruikerId(User) is not { } gebruikerId)
        {
            return Forbid();
        }

        await _deurmat.StelUitAsync(gebruikerId, signaalId, cancellationToken);
        return NoContent();
    }
}
