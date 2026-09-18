using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authentication;

namespace Jaarplanner.Api.Infrastructure.Authenticatie;

/// <summary>
/// The development sign-in (ADR-0031 decision 6): a local page listing every <c>Gebruiker</c>, and a link per person
/// that signs you in as them with the <b>same cookie</b> Entra would have led to. So everything after the sign-in
/// (the invitation check on each request, 401/403, the anti-forgery header) runs the production path.
/// <para>
/// <b>Three locks.</b> It is only mapped in <see cref="AuthenticatieModus.Ontwikkeling"/>; that mode refuses to start
/// outside the Development environment; and every request must come from loopback, with no non-loopback entry in
/// <c>X-Forwarded-For</c>. The Vite proxy sends that header (<c>xfwd</c>), so a device on the local network that
/// reaches a Vite server started with <c>--host</c> is refused rather than arriving as loopback.
/// </para>
/// <para>
/// English on purpose: only a developer ever sees this page (Art. II.3).
/// </para>
/// </summary>
public static class OntwikkelAanmelding
{
    /// <summary>The page, and the prefix of the per-person sign-in links.</summary>
    public const string Pad = "/api/aanmelden/ontwikkeling";

    /// <summary>The header a proxy uses to say who the real client is.</summary>
    public const string DoorgestuurdVoorHeader = "X-Forwarded-For";

    public static void MapOntwikkelAanmelding(this IEndpointRouteBuilder app)
    {
        var groep = app.MapGroup(Pad)
            .AllowAnonymous()
            .ExcludeFromDescription()
            .AddEndpointFilter(async (context, next) => IsLokaal(context.HttpContext)
                ? await next(context)
                : Results.Problem(
                    statusCode: StatusCodes.Status403Forbidden,
                    title: "Development sign-in is loopback-only",
                    detail: "Open the app on this machine through http://localhost."));

        groep.MapGet(string.Empty, async (string? terugNaar, IToegangService toegang, CancellationToken cancellationToken) =>
            Results.Content(
                Pagina(await toegang.HaalGebruikersOpAsync(cancellationToken), LokaalPad.Veilig(terugNaar)),
                "text/html; charset=utf-8"));

        groep.MapGet("{gebruikerId:guid}", async (
            Guid gebruikerId,
            string? terugNaar,
            HttpContext http,
            IToegangService toegang,
            CancellationToken cancellationToken) =>
        {
            var gebruiker = await toegang.HaalGebruikerOpAsync(gebruikerId, cancellationToken);
            if (gebruiker is null)
            {
                return Results.NotFound();
            }

            await http.SignInAsync(Aanmelding.CookieSchema, Aanmelding.MaakPrincipal(gebruiker, "Ontwikkeling"));
            return Results.Redirect(LokaalPad.Veilig(terugNaar));
        });
    }

    /// <summary>
    /// Loopback, and every forwarded client loopback too. A missing remote address counts as not local: an in-process
    /// test server has none, and the safe reading of "unknown" is "refuse".
    /// </summary>
    public static bool IsLokaal(HttpContext context)
    {
        if (context.Connection.RemoteIpAddress is not { } adres || !IPAddress.IsLoopback(Normaal(adres)))
        {
            return false;
        }

        foreach (var waarde in context.Request.Headers[DoorgestuurdVoorHeader])
        {
            foreach (var deel in (waarde ?? string.Empty).Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
            {
                if (!IPAddress.TryParse(deel, out var doorgestuurd) || !IPAddress.IsLoopback(Normaal(doorgestuurd)))
                {
                    return false;
                }
            }
        }

        return true;
    }

    private static IPAddress Normaal(IPAddress adres) => adres.IsIPv4MappedToIPv6 ? adres.MapToIPv4() : adres;

    private static string Pagina(IReadOnlyList<GebruikerWeergave> gebruikers, string terugNaar)
    {
        var html = HtmlEncoder.Default;
        var pagina = new StringBuilder();
        pagina.Append("<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Development sign-in</title></head>");
        pagina.Append("<body style=\"font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5\">");
        pagina.Append("<h1>Development sign-in</h1><p>Local development only. Choose who to be.</p>");

        if (gebruikers.Count == 0)
        {
            pagina.Append("<p>No users exist yet. Apply the migrations, then set <code>Authenticatie:EersteAdmin</code> and restart the API.</p>");
        }
        else
        {
            pagina.Append("<ul>");
            foreach (var gebruiker in gebruikers)
            {
                var link = $"{Pad}/{gebruiker.Id}?terugNaar={Uri.EscapeDataString(terugNaar)}";
                pagina.Append("<li><a href=\"").Append(html.Encode(link)).Append("\">")
                    .Append(html.Encode(gebruiker.Naam)).Append("</a> (")
                    .Append(html.Encode(gebruiker.Email)).Append(')')
                    .Append(gebruiker.IsAdmin ? ", admin" : string.Empty)
                    .Append("</li>");
            }

            pagina.Append("</ul>");
        }

        pagina.Append("</body></html>");
        return pagina.ToString();
    }
}
