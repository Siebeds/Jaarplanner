using System.Text.Encodings.Web;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// The integration tests' stand-in for a session (ADR-0031 decision 6). Every request is authenticated as
/// <see cref="StandaardGebruikerId"/> unless it asks otherwise: <see cref="AnoniemHeader"/> makes it anonymous, and
/// <see cref="GebruikerHeader"/> names a seeded <c>Gebruiker</c>.
/// <para>
/// <b>Why authenticated by default.</b> 152 call sites create a client, and all of them test something other than
/// the login. Making each one sign in would bury what they test; the login itself is tested where it is the subject,
/// and <c>ElkeRouteVraagtEenSessieTests</c> sends every route anonymously to prove none of them is open.
/// </para>
/// <para>
/// The principal is built by <see cref="Aanmelding.MaakPrincipal"/>, the same function the real sign-ins use, so a
/// controller sees exactly the claims it would see in production.
/// </para>
/// </summary>
public static class TestAuthenticatie
{
    /// <summary>The scheme name.</summary>
    public const string Schema = "Test";

    /// <summary>Send this header (any value) to be anonymous.</summary>
    public const string AnoniemHeader = "X-Test-Anoniem";

    /// <summary>Send this header with a <c>Gebruiker</c> id to be that person.</summary>
    public const string GebruikerHeader = "X-Test-Gebruiker";

    /// <summary>Who a request is when it says nothing. No row exists for it, so <c>/api/ik</c> answers 401.</summary>
    public static readonly Guid StandaardGebruikerId = Guid.Parse("7e57a000-0000-4000-8000-000000000001");

    /// <summary>Registers the scheme and makes it the default for everything the cookie was the default for.</summary>
    public static void Registreer(IServiceCollection services)
    {
        services.AddAuthentication().AddScheme<AuthenticationSchemeOptions, Handler>(Schema, _ => { });
        services.PostConfigure<AuthenticationOptions>(o =>
        {
            o.DefaultScheme = Schema;
            o.DefaultAuthenticateScheme = Schema;
            o.DefaultChallengeScheme = Schema;
            o.DefaultForbidScheme = Schema;
        });
    }

    private sealed class Handler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public Handler(IOptionsMonitor<AuthenticationSchemeOptions> options, ILoggerFactory logger, UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (Request.Headers.ContainsKey(AnoniemHeader))
            {
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var gebruikerId = Request.Headers.TryGetValue(GebruikerHeader, out var waarde) && Guid.TryParse(waarde, out var id)
                ? id
                : StandaardGebruikerId;

            var principal = Aanmelding.MaakPrincipal(
                new GebruikerWeergave(gebruikerId, "Test", "test@jaarplanner.local", IsDirectie: true),
                Schema);
            return Task.FromResult(AuthenticateResult.Success(new AuthenticationTicket(principal, Schema)));
        }
    }
}
