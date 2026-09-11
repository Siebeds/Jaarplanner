using Microsoft.AspNetCore.Mvc;

namespace Jaarplanner.Api.Infrastructure.Authenticatie;

/// <summary>
/// The second layer against cross-site request forgery (ADR-0031 decision 5). <c>SameSite=Lax</c> already keeps the
/// session cookie off cross-site POSTs; on top of that, every state-changing <c>/api</c> request must carry
/// <see cref="Header"/>. A cross-site form cannot set a header, and a cross-site script cannot send one without a CORS
/// preflight, which this API never approves because it registers no CORS policy.
/// <para>
/// <b>The OpenID Connect callbacks are exempt by name.</b> Entra returns the sign-in as a form POST, which can never
/// carry the header. The authentication middleware consumes that callback before this runs anyway, but the exemption
/// is written down so that moving this middleware cannot break the login.
/// </para>
/// <para>
/// The refusal is in English: the frontend always sends the header, so only someone calling the API by hand ever
/// sees it (Art. II.3).
/// </para>
/// </summary>
public sealed class CsrfHeaderControle
{
    /// <summary>The header every state-changing <c>/api</c> request must carry. Its value is not checked.</summary>
    public const string Header = "X-Jaarplanner-Csrf";

    private readonly RequestDelegate _next;

    public CsrfHeaderControle(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext context, IProblemDetailsService problemen)
    {
        var verzoek = context.Request;
        if (IsWijzigend(verzoek.Method)
            && verzoek.Path.StartsWithSegments("/api", StringComparison.OrdinalIgnoreCase)
            && !Aanmelding.IsTerugkeerpad(verzoek.Path)
            && !verzoek.Headers.ContainsKey(Header))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await problemen.WriteAsync(new ProblemDetailsContext
            {
                HttpContext = context,
                ProblemDetails = new ProblemDetails
                {
                    Status = StatusCodes.Status403Forbidden,
                    Title = "Missing anti-forgery header",
                    Detail = $"State-changing requests to /api must carry the {Header} header.",
                },
            });
            return;
        }

        await _next(context);
    }

    private static bool IsWijzigend(string methode) =>
        HttpMethods.IsPost(methode) || HttpMethods.IsPut(methode) || HttpMethods.IsPatch(methode) || HttpMethods.IsDelete(methode);
}
