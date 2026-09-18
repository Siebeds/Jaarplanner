using System.Security.Claims;
using Azure.Identity;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Jaarplanner.Api.Infrastructure.Authenticatie;

/// <summary>
/// The login, in one place (E6-01, ADR-0031): the session cookie, the Entra sign-in that issues it, the rule that
/// every route needs it, and the development sign-in that replaces Entra on a developer's machine.
/// <para>
/// <b>What this does not decide is who may do what.</b> After E6-01 every invited person can do everything except the
/// curriculum import; the ADR-0030 matrix is E6-02's, and it binds onto the principal made here, which carries nothing
/// but the <see cref="GebruikerClaim"/>. Rights are looked up, never stored in the cookie, so a change admin makes
/// is not waiting for a session to expire.
/// </para>
/// </summary>
public static class Aanmelding
{
    /// <summary>The session cookie's scheme. The default for authenticating, challenging and forbidding.</summary>
    public const string CookieSchema = CookieAuthenticationDefaults.AuthenticationScheme;

    /// <summary>The Entra scheme. Only ever challenged by <c>GET /api/aanmelden</c>.</summary>
    public const string EntraSchema = OpenIdConnectDefaults.AuthenticationScheme;

    /// <summary>Where Entra returns the sign-in. Under <c>/api</c> so the one proxy rule covers it.</summary>
    public const string TerugkeerPad = "/api/signin-oidc";

    /// <summary>The handler's signed-out callback, moved under <c>/api</c> with the other one. The app does not rely on it.</summary>
    public const string AfmeldTerugkeerPad = "/api/signout-callback-oidc";

    /// <summary>The frontend page a refused login lands on.</summary>
    public const string GeenToegangPad = "/geen-toegang";

    /// <summary>The frontend page a sign-in that did not complete lands on.</summary>
    public const string AanmeldenMisluktPad = "/aanmelden-mislukt";

    /// <summary>The one claim a session carries: the id of the <c>Gebruiker</c>.</summary>
    public const string GebruikerClaim = "jaarplanner:gebruiker";

    /// <summary>
    /// Registers the cookie, the Entra sign-in when <see cref="AuthenticatieModus.Entra"/>, the fallback policy that
    /// makes every endpoint require a session, and the Key Vault protection of the Data Protection keys, which is
    /// required outside Development. Returns the options, because the pipeline needs to know which sign-in to map.
    /// </summary>
    public static AuthenticatieOpties AddJaarplannerAuthenticatie(this WebApplicationBuilder builder)
    {
        var sectie = builder.Configuration.GetSection(AuthenticatieOpties.Sectie);
        var opties = sectie.Get<AuthenticatieOpties>() ?? new AuthenticatieOpties();

        if (opties.Modus == AuthenticatieModus.Ontwikkeling && !builder.Environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                "Authenticatie:Modus 'Ontwikkeling' is only allowed in the Development environment. Configure Entra (ADR-0031).");
        }

        if (opties.SessieUren <= 0)
        {
            throw new InvalidOperationException("Authenticatie:SessieUren must be a positive number of hours.");
        }

        builder.Services.Configure<AuthenticatieOpties>(sectie);

        var authenticatie = builder.Services
            .AddAuthentication(o =>
            {
                // The cookie answers every challenge with 401 and every refusal with 403. The Entra scheme is never
                // a default: an /api fetch that got redirected to login.microsoftonline.com would only see an error.
                o.DefaultScheme = CookieSchema;
                o.DefaultChallengeScheme = CookieSchema;
                o.DefaultForbidScheme = CookieSchema;
                o.DefaultSignInScheme = CookieSchema;
                o.DefaultSignOutScheme = CookieSchema;
            })
            .AddCookie(CookieSchema, o => ConfigureerCookie(o, builder.Environment, opties));

        if (opties.Modus == AuthenticatieModus.Entra)
        {
            var tenantId = ValideerEntra(opties.Entra);
            authenticatie.AddOpenIdConnect(EntraSchema, o => ConfigureerEntra(o, opties.Entra, tenantId));
        }

        // Every endpoint that does not say otherwise needs a session (ADR-0031 decision 2). A policy of its own, such
        // as Curriculumbeheer, replaces this rather than adding to it, so each named policy must require it too.
        builder.Services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        // The Data Protection keys live in the database (Infrastructure registers that). Outside Development they must
        // also be wrapped with a Key Vault key: the cookie carries only a Gebruiker id, so unwrapped keys would let a
        // copy of the database mint a session for anyone, admin included. Refused at startup rather than trusted to
        // be remembered, like every other setting this design cannot run safely without (antagonist, E6-01 code round).
        var sleutel = builder.Configuration["DataProtection:KeyVaultSleutel"];
        if (!string.IsNullOrWhiteSpace(sleutel))
        {
            builder.Services.AddDataProtection().ProtectKeysWithAzureKeyVault(new Uri(sleutel), new DefaultAzureCredential());
        }
        else if (!builder.Environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                "DataProtection:KeyVaultSleutel is required outside Development: without it the session keys lie unencrypted in the database (ADR-0031 decision 5).");
        }

        return opties;
    }

    /// <summary>
    /// The pipeline half, in order: authenticate, refuse a state-changing request without the anti-forgery header,
    /// authorise. The development sign-in is mapped only in <see cref="AuthenticatieModus.Ontwikkeling"/>, so in any
    /// other mode its routes do not exist at all.
    /// </summary>
    public static WebApplication UseJaarplannerAuthenticatie(this WebApplication app, AuthenticatieOpties opties)
    {
        app.UseAuthentication();
        app.UseMiddleware<CsrfHeaderControle>();
        app.UseAuthorization();

        if (opties.Modus == AuthenticatieModus.Ontwikkeling)
        {
            app.MapOntwikkelAanmelding();
        }

        return app;
    }

    /// <summary>The principal a session carries: the <c>Gebruiker</c> id, and nothing that could go stale.</summary>
    public static ClaimsPrincipal MaakPrincipal(GebruikerWeergave gebruiker, string bron) =>
        new(new ClaimsIdentity([new Claim(GebruikerClaim, gebruiker.Id.ToString())], authenticationType: bron));

    /// <summary>The <c>Gebruiker</c> id a principal carries, or <c>null</c>.</summary>
    public static Guid? GebruikerId(ClaimsPrincipal? principal) =>
        Guid.TryParse(principal?.FindFirst(GebruikerClaim)?.Value, out var id) ? id : null;

    /// <summary>Whether <paramref name="pad"/> is one of the two OpenID Connect callbacks.</summary>
    public static bool IsTerugkeerpad(PathString pad) =>
        pad.Equals(TerugkeerPad, StringComparison.OrdinalIgnoreCase)
        || pad.Equals(AfmeldTerugkeerPad, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// The Entra sign-out address, returning to the app's root. The browser has to go there itself: a sign-out that
    /// only ends the cookie leaves the Entra session alive, and on a shared classroom computer the next teacher would
    /// be signed in silently as this one.
    /// </summary>
    public static string EntraAfmeldAdres(EntraOpties entra, HttpRequest verzoek) =>
        $"{entra.Instance.TrimEnd('/')}/{entra.TenantId}/oauth2/v2.0/logout"
        + $"?post_logout_redirect_uri={Uri.EscapeDataString($"{verzoek.Scheme}://{verzoek.Host}/")}";

    private static void ConfigureerCookie(CookieAuthenticationOptions o, IWebHostEnvironment omgeving, AuthenticatieOpties opties)
    {
        // The __Host- prefix needs Secure, which a developer's http://localhost cannot always give.
        var ontwikkeling = omgeving.IsDevelopment();
        o.Cookie.Name = ontwikkeling ? "jaarplanner" : "__Host-jaarplanner";
        o.Cookie.HttpOnly = true;
        o.Cookie.SameSite = SameSiteMode.Lax;
        o.Cookie.SecurePolicy = ontwikkeling ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        o.Cookie.Path = "/";
        o.ExpireTimeSpan = TimeSpan.FromHours(opties.SessieUren);
        o.SlidingExpiration = true;

        o.Events.OnRedirectToLogin = context => SchrijfProbleemAsync(
            context.HttpContext, StatusCodes.Status401Unauthorized, Probleemtitels.NietAangemeld, "Meld je aan om verder te gaan.");
        o.Events.OnRedirectToAccessDenied = context => SchrijfGeenToegangAsync(context.HttpContext);
        o.Events.OnValidatePrincipal = ValideerSessieAsync;
    }

    /// <summary>
    /// Every request: does the person behind this session still exist? One primary-key read, and it is what makes a
    /// removal by admin take effect immediately instead of when the cookie expires.
    /// </summary>
    private static async Task ValideerSessieAsync(CookieValidatePrincipalContext context)
    {
        var toegang = context.HttpContext.RequestServices.GetRequiredService<IToegangService>();
        if (GebruikerId(context.Principal) is not { } gebruikerId
            || await toegang.HaalGebruikerOpAsync(gebruikerId, context.HttpContext.RequestAborted) is null)
        {
            context.RejectPrincipal();
            await context.HttpContext.SignOutAsync(CookieSchema);
        }
    }

    private static Guid ValideerEntra(EntraOpties entra)
    {
        if (!Guid.TryParse(entra.TenantId, out var tenantId) || tenantId == Guid.Empty)
        {
            throw new InvalidOperationException(
                "Authenticatie:Entra:TenantId must be the school's Entra tenant id (a GUID), or set Authenticatie:Modus to 'Ontwikkeling' in Development.");
        }

        if (string.IsNullOrWhiteSpace(entra.ClientId))
        {
            throw new InvalidOperationException("Authenticatie:Entra:ClientId is required.");
        }

        if (string.IsNullOrWhiteSpace(entra.ClientSecret))
        {
            throw new InvalidOperationException(
                "Authenticatie:Entra:ClientSecret is required (user-secrets locally, Key Vault in the cloud; never in the repo).");
        }

        return tenantId;
    }

    private static void ConfigureerEntra(OpenIdConnectOptions o, EntraOpties entra, Guid tenantId)
    {
        o.Authority = entra.Authority(tenantId);
        o.ClientId = entra.ClientId;
        o.ClientSecret = entra.ClientSecret;
        o.ResponseType = OpenIdConnectResponseType.Code;
        o.UsePkce = true;
        o.CallbackPath = TerugkeerPad;
        o.SignedOutCallbackPath = AfmeldTerugkeerPad;
        o.SignInScheme = CookieSchema;

        // `profile` is enough for preferred_username and name; `email` is not requested because nothing reads it.
        o.Scope.Clear();
        o.Scope.Add("openid");
        o.Scope.Add("profile");

        // Keep Entra's claim names (tid, oid, acct) instead of the legacy mapped URIs, and keep no tokens: the API calls
        // nothing on the person's behalf, so a stored token would be risk without use.
        o.MapInboundClaims = false;
        o.SaveTokens = false;
        o.GetClaimsFromUserInfoEndpoint = false;

        o.Events.OnTokenValidated = context => BeoordeelAanmeldingAsync(context, tenantId);

        // A sign-in that does not complete would otherwise surface as an English 500 in a top-level page. That covers
        // cancelled consent, an error returned by Entra and an expired correlation cookie, but not only those: the
        // handler also routes here anything thrown while it processes the token, the invitation gate's own database
        // call included. So the page it lands on says only that signing in did not work, never whose side failed.
        // The reason goes to the log.
        o.AccessDeniedPath = AanmeldenMisluktPad;
        o.Events.OnRemoteFailure = context =>
        {
            context.HttpContext.RequestServices
                .GetRequiredService<ILoggerFactory>()
                .CreateLogger(typeof(Aanmelding))
                .LogWarning(context.Failure, "An Entra sign-in did not complete.");
            context.HandleResponse();
            context.Response.Redirect(AanmeldenMisluktPad);
            return Task.CompletedTask;
        };
    }

    /// <summary>
    /// The invitation gate (ADR-0031 decision 3). Entra has proved who this is; the app decides whether they get a
    /// session. On a refusal no cookie is written and the browser goes to <see cref="GeenToegangPad"/>, where the
    /// person reads one Dutch sentence whatever the reason; the reason goes to the log.
    /// </summary>
    private static async Task BeoordeelAanmeldingAsync(TokenValidatedContext context, Guid schoolTenantId)
    {
        var claims = context.Principal;
        var identiteit = new EntraIdentiteit(
            TenantId: LeesGuid(claims, "tid"),
            ObjectId: LeesGuid(claims, "oid"),
            Upn: claims?.FindFirst("preferred_username")?.Value,
            Naam: claims?.FindFirst("name")?.Value,
            // Fail closed: a registration that does not emit `acct` lets nobody in, rather than letting guests in.
            IsLid: claims?.FindFirst("acct")?.Value == "0");

        var toegang = context.HttpContext.RequestServices.GetRequiredService<IToegangService>();
        var resultaat = await toegang.MeldAanMetEntraAsync(identiteit, schoolTenantId, context.HttpContext.RequestAborted);

        if (resultaat.Gebruiker is { } gebruiker)
        {
            context.Principal = MaakPrincipal(gebruiker, EntraSchema);
            return;
        }

        context.HttpContext.RequestServices
            .GetRequiredService<ILoggerFactory>()
            .CreateLogger(typeof(Aanmelding))
            .LogWarning(
                "Refused an Entra login: {Weigering}. For GeenLid, check that the app registration emits the 'acct' optional claim.",
                resultaat.Weigering);

        context.HandleResponse();
        context.Response.Redirect(GeenToegangPad);
    }

    private static Guid? LeesGuid(ClaimsPrincipal? claims, string type) =>
        Guid.TryParse(claims?.FindFirst(type)?.Value, out var waarde) ? waarde : null;

    private static async Task SchrijfProbleemAsync(HttpContext context, int status, string titel, string detail)
    {
        context.Response.StatusCode = status;
        var problemen = context.RequestServices.GetRequiredService<IProblemDetailsService>();
        await problemen.WriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = new ProblemDetails { Status = status, Title = titel, Detail = detail },
        });
    }

    /// <summary>The detail of an authorisation refusal: the one sentence every rights 403 carries.</summary>
    public const string GeenToegangDetail = "Je hebt geen toegang tot deze actie.";

    /// <summary>
    /// The 403 of an authorisation refusal, in the shape and sentence the cookie answers with (E6-02). Public so the
    /// integration tests' stand-in scheme answers identically, which lets E6-02's sweep tell a rights refusal from any
    /// other 403 (the anti-forgery check, a wizard run's state) by its detail.
    /// </summary>
    public static Task SchrijfGeenToegangAsync(HttpContext context) =>
        SchrijfProbleemAsync(context, StatusCodes.Status403Forbidden, Probleemtitels.GeenToegang, GeenToegangDetail);
}
