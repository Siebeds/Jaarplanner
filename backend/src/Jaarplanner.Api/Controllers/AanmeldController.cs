using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Signing in, signing out, and who is signed in (E6-01, ADR-0031 decision 4). Thin: the rules live in
/// <see cref="Aanmelding"/> and <see cref="IToegangService"/>.
/// </summary>
[ApiController]
[Route("api")]
public sealed class AanmeldController : ControllerBase
{
    private readonly IToegangService _toegang;
    private readonly IOptions<AuthenticatieOpties> _opties;

    public AanmeldController(IToegangService toegang, IOptions<AuthenticatieOpties> opties)
    {
        _toegang = toegang;
        _opties = opties;
    }

    /// <summary>
    /// Starts a sign-in and returns the browser to <paramref name="terugNaar"/> afterwards, if that is a local path
    /// (<see cref="LokaalPad"/>). The only route that ever challenges Entra; in development it goes to the
    /// development sign-in instead.
    /// </summary>
    [HttpGet("aanmelden")]
    [AllowAnonymous]
    public IActionResult Aanmelden([FromQuery] string? terugNaar)
    {
        var doel = LokaalPad.Veilig(terugNaar);
        if (_opties.Value.Modus == AuthenticatieModus.Ontwikkeling)
        {
            return Redirect($"{OntwikkelAanmelding.Pad}?terugNaar={Uri.EscapeDataString(doel)}");
        }

        return Challenge(new AuthenticationProperties { RedirectUri = doel }, Aanmelding.EntraSchema);
    }

    /// <summary>
    /// Ends the session and says where the browser should go next: the Entra sign-out, so the Entra session ends too,
    /// or the root in development. Anonymous, so a sign-out never fails on a session that already expired.
    /// </summary>
    [HttpPost("afmelden")]
    [AllowAnonymous]
    public async Task<ActionResult<AfmeldWeergave>> Afmelden()
    {
        await HttpContext.SignOutAsync(Aanmelding.CookieSchema);

        var opties = _opties.Value;
        var volgende = opties.Modus == AuthenticatieModus.Entra
            ? Aanmelding.EntraAfmeldAdres(opties.Entra, Request)
            : "/";
        return Ok(new AfmeldWeergave(volgende));
    }

    /// <summary>The person behind this session. 401 when the session names nobody who still exists.</summary>
    [HttpGet("ik")]
    public async Task<ActionResult<GebruikerWeergave>> Ik(CancellationToken cancellationToken)
    {
        if (Aanmelding.GebruikerId(User) is not { } gebruikerId)
        {
            return Unauthorized();
        }

        var gebruiker = await _toegang.HaalGebruikerOpAsync(gebruikerId, cancellationToken);
        return gebruiker is null ? Unauthorized() : Ok(gebruiker);
    }
}

/// <summary>Where the browser goes after signing out.</summary>
/// <param name="DoorsturenNaar">An absolute Entra sign-out address, or <c>/</c> in development.</param>
public sealed record AfmeldWeergave(string DoorsturenNaar);
