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
    private readonly IRechtenService _rechten;
    private readonly IOptions<AuthenticatieOpties> _opties;

    public AanmeldController(IToegangService toegang, IRechtenService rechten, IOptions<AuthenticatieOpties> opties)
    {
        _toegang = toegang;
        _rechten = rechten;
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

    /// <summary>
    /// The person behind this session, with the rights they hold today (E6-02), so the frontend can hide what they
    /// cannot do. The server still decides every action itself. 401 when the session names nobody who still exists.
    /// </summary>
    [HttpGet("ik")]
    public async Task<ActionResult<IkWeergave>> Ik(CancellationToken cancellationToken)
    {
        if (Aanmelding.GebruikerId(User) is not { } gebruikerId)
        {
            return Unauthorized();
        }

        var gebruiker = await _toegang.HaalGebruikerOpAsync(gebruikerId, cancellationToken);
        if (gebruiker is null)
        {
            return Unauthorized();
        }

        var rechten = await _rechten.HaalRechtenOpAsync(gebruikerId, cancellationToken);
        return Ok(new IkWeergave(
            gebruiker.Id,
            gebruiker.Naam,
            gebruiker.Email,
            rechten.IsDirectie,
            rechten.HeeftThemabeheer,
            rechten.HoofdleerkrachtLeeftijden,
            rechten.LeerkrachtLeeftijden,
            rechten.EigenKlasIds));
    }
}

/// <summary>Where the browser goes after signing out.</summary>
/// <param name="DoorsturenNaar">An absolute Entra sign-out address, or <c>/</c> in development.</param>
public sealed record AfmeldWeergave(string DoorsturenNaar);

/// <summary>
/// <c>GET /api/ik</c>: who is signed in, and the relations the ADR-0030 §3 columns are made of. Raw relations, not
/// per-action answers: directie may do everything whatever the lists say, and a gebruiker holds the union of all of
/// them. The frontend uses this to hide controls only; the server enforces.
/// </summary>
/// <param name="IsDirectie">"Directie": every action.</param>
/// <param name="HeeftThemabeheer">"TB".</param>
/// <param name="HoofdleerkrachtLeeftijden">"HL": the jaarfasen they are hoofdleerkracht of in a schooljaar that has not ended.</param>
/// <param name="LeerkrachtLeeftijden">"LK leeftijd": the stated jaarfasen of their klassen in a schooljaar that has not ended.</param>
/// <param name="EigenKlasIds">"LK eigen": every klas they hold a klastoewijzing on.</param>
public sealed record IkWeergave(
    Guid Id,
    string Naam,
    string Email,
    bool IsDirectie,
    bool HeeftThemabeheer,
    IReadOnlyList<string> HoofdleerkrachtLeeftijden,
    IReadOnlyList<string> LeerkrachtLeeftijden,
    IReadOnlyList<Guid> EigenKlasIds);
