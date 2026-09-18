using System.Net;
using System.Net.Http.Json;
using System.Web;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;

namespace Jaarplanner.IntegrationTests.Authenticatie;

/// <summary>
/// The two sign-in modes as the app starts them (ADR-0031 decisions 1, 4 and 6), without a tenant and without a
/// network: Entra's discovery document is replaced by a static one, which is the only thing swapped.
/// </summary>
public sealed class AanmeldModusTests
{
    private const string Tenant = "11111111-2222-3333-4444-555555555555";

    [Fact]
    public void De_ontwikkellogin_weigert_te_starten_buiten_Development()
    {
        using var factory = new Fabriek(Environments.Production, new() { ["Authenticatie:Modus"] = "Ontwikkeling" });

        var fout = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("Ontwikkeling", fout.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Buiten_Development_is_een_Key_Vault_sleutel_voor_de_sessiesleutels_verplicht()
    {
        using var factory = new Fabriek(Environments.Production, EntraInstellingen());

        var fout = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("KeyVaultSleutel", fout.ToString(), StringComparison.Ordinal);
    }

    /// <summary>
    /// A sign-in that does not complete (here: the correlation cookie is gone) must not surface as the framework's
    /// English 500. Run through the configured event exactly as the handler would, since provoking a real failed
    /// callback needs a real round trip to Entra.
    /// </summary>
    [Fact]
    public async Task Een_onvoltooide_Entra_aanmelding_landt_op_de_Nederlandse_pagina()
    {
        using var factory = new Fabriek(Environments.Development, EntraInstellingen());
        _ = factory.CreateClient();
        await using var scope = factory.Services.CreateAsyncScope();
        var opties = factory.Services.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(Aanmelding.EntraSchema);
        var schema = await factory.Services.GetRequiredService<IAuthenticationSchemeProvider>().GetSchemeAsync(Aanmelding.EntraSchema);
        var http = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        var context = new RemoteFailureContext(http, schema!, opties, new AuthenticationFailureException("Correlation failed."));

        await opties.Events.RemoteFailure(context);

        Assert.True(context.Result?.Handled);
        Assert.Equal(Aanmelding.AanmeldenMisluktPad, http.Response.Headers.Location.ToString());
        Assert.Equal(Aanmelding.AanmeldenMisluktPad, opties.AccessDeniedPath.Value);
    }

    [Fact]
    public void Entra_zonder_clientgeheim_weigert_te_starten()
    {
        using var factory = new Fabriek(Environments.Development, EntraInstellingen(clientSecret: null));

        var fout = Assert.ThrowsAny<Exception>(() => factory.CreateClient());

        Assert.Contains("ClientSecret", fout.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void Entra_vraagt_enkel_openid_en_profile_en_keert_terug_onder_api()
    {
        using var factory = new Fabriek(Environments.Development, EntraInstellingen());
        _ = factory.CreateClient();

        var opties = factory.Services.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(Aanmelding.EntraSchema);

        Assert.Equal(Aanmelding.TerugkeerPad, opties.CallbackPath.Value);
        Assert.Equal(["openid", "profile"], opties.Scope.Order());
        Assert.False(opties.MapInboundClaims);
        Assert.False(opties.SaveTokens);
        Assert.True(opties.UsePkce);
        Assert.Equal($"https://login.microsoftonline.com/{Tenant}/v2.0", opties.Authority);
    }

    [Fact]
    public async Task Met_Entra_krijgt_een_api_aanvraag_zonder_sessie_401_en_geen_omleiding()
    {
        using var factory = new Fabriek(Environments.Development, EntraInstellingen());
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        using var antwoord = await client.GetAsync("/api/klassen");

        Assert.Equal(HttpStatusCode.Unauthorized, antwoord.StatusCode);
        Assert.Null(antwoord.Headers.Location);
    }

    [Fact]
    public async Task Aanmelden_stuurt_naar_Entra_met_de_terugkeer_onder_api()
    {
        using var factory = new Fabriek(Environments.Development, EntraInstellingen());
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        using var antwoord = await client.GetAsync("/api/aanmelden?terugNaar=/agenda");

        Assert.Equal(HttpStatusCode.Redirect, antwoord.StatusCode);
        var doel = antwoord.Headers.Location!;
        Assert.Equal("login.voorbeeld.test", doel.Host);
        var query = HttpUtility.ParseQueryString(doel.Query);
        Assert.EndsWith(Aanmelding.TerugkeerPad, query["redirect_uri"], StringComparison.Ordinal);
        Assert.Equal("openid profile", query["scope"]);
        Assert.Equal("code", query["response_type"]);
    }

    [Fact]
    public async Task Afmelden_met_Entra_stuurt_door_naar_de_Entra_afmelding_met_terugkeer_naar_de_afgemeld_pagina()
    {
        using var factory = new Fabriek(Environments.Development, EntraInstellingen());
        using var client = factory.CreateClient();

        using var antwoord = await client.PostAsync("/api/afmelden", content: null);
        var weergave = await antwoord.Content.ReadFromJsonAsync<AfmeldDto>();

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        var doel = new Uri(weergave!.DoorsturenNaar);
        Assert.Equal($"https://login.microsoftonline.com/{Tenant}/oauth2/v2.0/logout", doel.GetLeftPart(UriPartial.Path));
        Assert.Equal($"http://localhost{Aanmelding.AfgemeldPad}", HttpUtility.ParseQueryString(doel.Query)["post_logout_redirect_uri"]);
        Assert.Equal(Aanmelding.WisSitegegevens, string.Join(", ", antwoord.Headers.GetValues("Clear-Site-Data")));
    }

    [Fact]
    public async Task Afmelden_in_de_ontwikkelmodus_stuurt_rechtstreeks_naar_de_afgemeld_pagina()
    {
        using var factory = new Fabriek(Environments.Development, new() { ["Authenticatie:Modus"] = "Ontwikkeling" });
        using var client = factory.CreateClient();

        using var antwoord = await client.PostAsync("/api/afmelden", content: null);
        var weergave = await antwoord.Content.ReadFromJsonAsync<AfmeldDto>();

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        Assert.Equal("/afgemeld", weergave!.DoorsturenNaar);
        Assert.Equal("\"cache\", \"cookies\", \"storage\"", string.Join(", ", antwoord.Headers.GetValues("Clear-Site-Data")));
    }

    private static Dictionary<string, string?> EntraInstellingen(string? clientSecret = "test-only-not-a-secret") => new()
    {
        ["Authenticatie:Modus"] = "Entra",
        ["Authenticatie:Entra:TenantId"] = Tenant,
        ["Authenticatie:Entra:ClientId"] = "22222222-0000-0000-0000-000000000000",
        ["Authenticatie:Entra:ClientSecret"] = clientSecret,
    };

    private sealed record AfmeldDto(string DoorsturenNaar);

    /// <summary>
    /// A host in the given environment with the given settings, on the real cookie (no test scheme), and with Entra's
    /// discovery document replaced by a static one so a challenge needs no network.
    /// </summary>
    private sealed class Fabriek : JaarplannerApiFactory
    {
        private readonly string _omgeving;
        private readonly Dictionary<string, string?> _instellingen;

        public Fabriek(string omgeving, Dictionary<string, string?> instellingen)
        {
            _omgeving = omgeving;
            _instellingen = instellingen;
            GebruikTestAuthenticatie = false;
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseEnvironment(_omgeving);
            foreach (var (sleutel, waarde) in _instellingen)
            {
                builder.UseSetting(sleutel, waarde);
            }

            builder.ConfigureTestServices(services =>
                services.PostConfigure<OpenIdConnectOptions>(Aanmelding.EntraSchema, o =>
                {
                    var configuratie = new OpenIdConnectConfiguration
                    {
                        AuthorizationEndpoint = "https://login.voorbeeld.test/authorize",
                        EndSessionEndpoint = "https://login.voorbeeld.test/logout",
                        Issuer = $"https://login.microsoftonline.com/{Tenant}/v2.0",
                    };
                    o.Configuration = configuratie;
                    o.ConfigurationManager = new StaticConfigurationManager<OpenIdConnectConfiguration>(configuratie);
                }));
        }
    }
}
