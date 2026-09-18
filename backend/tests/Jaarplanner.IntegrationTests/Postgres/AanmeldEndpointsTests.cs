using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Toegang;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The real session, end to end against PostgreSQL (E6-01, ADR-0031): the development sign-in issues the cookie, the
/// cookie is checked against the database on every request, and the Entra sign-in's gate turns claims into a session
/// or into the refusal page. No test scheme here: <see cref="JaarplannerApiFactory.GebruikTestAuthenticatie"/> is off.
/// </summary>
public sealed class AanmeldEndpointsTests : IAsyncLifetime
{
    private static readonly Guid School = Guid.Parse("11111111-2222-3333-4444-555555555555");

    private PostgresTestDatabase _db = null!;
    private WebApplicationFactory<Program> _factory = null!;
    private Gebruiker _admin = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("aanmelden");
        _admin = new Gebruiker("admin@school.be", "Admin", isAdmin: true);
        await using (var context = _db.MaakContext())
        {
            context.Gebruikers.Add(_admin);
            await context.SaveChangesAsync();
        }

        // An in-process test server has no remote address, and the development sign-in refuses exactly that. This
        // filter makes every request arrive from loopback, as a browser on the developer's own machine does.
        _factory = new PostgresApiFactory(_db.ConnectionString) { GebruikTestAuthenticatie = false }
            .WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
                services.AddSingleton<IStartupFilter, VanafLoopback>()));
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Zonder_sessie_antwoordt_ik_401()
    {
        using var client = Client();

        using var antwoord = await client.GetAsync("/api/ik");

        Assert.Equal(HttpStatusCode.Unauthorized, antwoord.StatusCode);
    }

    [PostgresFact]
    public async Task Aanmelden_stuurt_in_ontwikkeling_naar_de_ontwikkellogin_met_een_veilig_terugkeeradres()
    {
        using var client = Client();

        using var antwoord = await client.GetAsync("/api/aanmelden?terugNaar=//evil.example");

        Assert.Equal(HttpStatusCode.Redirect, antwoord.StatusCode);
        Assert.Equal($"{OntwikkelAanmelding.Pad}?terugNaar=%2F", antwoord.Headers.Location!.OriginalString);
    }

    [PostgresFact]
    public async Task De_ontwikkellogin_toont_de_gebruikers_en_meldt_aan_met_een_echte_sessie()
    {
        using var client = Client();

        var pagina = await client.GetStringAsync($"{OntwikkelAanmelding.Pad}?terugNaar=/agenda");
        Assert.Contains("Admin", pagina, StringComparison.Ordinal);
        Assert.Contains($"{OntwikkelAanmelding.Pad}/{_admin.Id}", pagina, StringComparison.Ordinal);

        using var aanmelding = await client.GetAsync($"{OntwikkelAanmelding.Pad}/{_admin.Id}?terugNaar=/agenda");
        Assert.Equal(HttpStatusCode.Redirect, aanmelding.StatusCode);
        Assert.Equal("/agenda", aanmelding.Headers.Location!.OriginalString);

        var ik = await client.GetFromJsonAsync<GebruikerWeergave>("/api/ik");
        Assert.Equal(_admin.Id, ik!.Id);
        Assert.True(ik.IsAdmin);
    }

    [PostgresFact]
    public async Task De_sessie_vervalt_meteen_als_de_gebruiker_verwijderd_wordt()
    {
        using var client = Client();
        await MeldAanAsync(client);
        using (var voordien = await client.GetAsync("/api/klassen"))
        {
            Assert.Equal(HttpStatusCode.OK, voordien.StatusCode);
        }

        await using (var context = _db.MaakContext())
        {
            await context.Gebruikers.Where(g => g.Id == _admin.Id).ExecuteDeleteAsync();
        }

        // Not /api/ik: that endpoint answers 401 by itself for a Gebruiker that no longer exists, so a test asking it
        // passed with the per-request check deleted (antagonist, E6-01 code round, MAJOR). /api/klassen looks nobody
        // up, so only the cookie's own validation can refuse it, and the refusal must also delete the cookie.
        using var antwoord = await client.GetAsync("/api/klassen");
        Assert.Equal(HttpStatusCode.Unauthorized, antwoord.StatusCode);
        Assert.Contains(antwoord.Headers.GetValues("Set-Cookie"), c => c.StartsWith("jaarplanner=;", StringComparison.Ordinal));
    }

    [PostgresFact]
    public async Task Met_een_sessie_maar_zonder_antivervalsingsheader_wordt_een_wijziging_geweigerd()
    {
        using var client = Client();
        await MeldAanAsync(client);
        client.DefaultRequestHeaders.Remove(CsrfHeaderControle.Header);

        using var antwoord = await client.PostAsJsonAsync("/api/schooljaren", new { naam = "2026-2027", start = "2026-09-01", eind = "2027-06-30" });

        Assert.Equal(HttpStatusCode.Forbidden, antwoord.StatusCode);
    }

    [PostgresFact]
    public async Task Met_een_sessie_en_de_header_gaat_een_wijziging_door()
    {
        using var client = Client();
        await MeldAanAsync(client);

        using var antwoord = await client.PostAsJsonAsync("/api/schooljaren", new { naam = "2026-2027", start = "2026-09-01", eind = "2027-06-30" });

        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
    }

    [PostgresFact]
    public async Task Afmelden_beeindigt_de_sessie()
    {
        using var client = Client();
        await MeldAanAsync(client);

        using var afmelding = await client.PostAsync("/api/afmelden", content: null);
        var weergave = await afmelding.Content.ReadFromJsonAsync<AfmeldDto>();

        Assert.Equal(HttpStatusCode.OK, afmelding.StatusCode);
        Assert.Equal("/afgemeld", weergave!.DoorsturenNaar);
        using var ik = await client.GetAsync("/api/ik");
        Assert.Equal(HttpStatusCode.Unauthorized, ik.StatusCode);
    }

    [PostgresFact]
    public async Task De_ontwikkellogin_weigert_een_doorgestuurde_client_van_buiten_deze_machine()
    {
        using var client = Client();
        client.DefaultRequestHeaders.Add(OntwikkelAanmelding.DoorgestuurdVoorHeader, "192.168.1.20");

        using var antwoord = await client.GetAsync(OntwikkelAanmelding.Pad);

        Assert.Equal(HttpStatusCode.Forbidden, antwoord.StatusCode);
    }

    [PostgresFact]
    public async Task Entra_een_uitgenodigd_lid_krijgt_een_sessie_die_naar_de_gebruiker_wijst()
    {
        await NodigUitAsync("an@school.be");
        using var entra = EntraFactory();

        var context = await BeoordeelAsync(entra, Claims(upn: "AN@school.be", acct: "0"));

        Assert.Null(context.Result);
        var gebruikerId = Aanmelding.GebruikerId(context.Principal);
        Assert.NotNull(gebruikerId);
        await using var db = _db.MaakContext();
        Assert.NotNull((await db.Gebruikers.SingleAsync(g => g.Id == gebruikerId)).EntraObjectId);
    }

    [PostgresFact]
    public async Task Entra_een_token_zonder_acct_krijgt_geen_sessie_maar_de_weigeringspagina()
    {
        await NodigUitAsync("an@school.be");
        using var entra = EntraFactory();

        var context = await BeoordeelAsync(entra, Claims(upn: "an@school.be", acct: null));

        Assert.True(context.Result?.Handled);
        Assert.Equal(Aanmelding.GeenToegangPad, context.Response.Headers.Location.ToString());
        await using var db = _db.MaakContext();
        Assert.Null((await db.Gebruikers.SingleAsync(g => g.Email == "an@school.be")).EntraObjectId);
    }

    [PostgresFact]
    public async Task Entra_een_gast_krijgt_geen_sessie()
    {
        await NodigUitAsync("an@school.be");
        using var entra = EntraFactory();

        var context = await BeoordeelAsync(entra, Claims(upn: "an@school.be", acct: "1"));

        Assert.True(context.Result?.Handled);
        Assert.Equal(Aanmelding.GeenToegangPad, context.Response.Headers.Location.ToString());
    }

    private HttpClient Client() =>
        _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });

    private async Task MeldAanAsync(HttpClient client)
    {
        using var aanmelding = await client.GetAsync($"{OntwikkelAanmelding.Pad}/{_admin.Id}?terugNaar=/");
        Assert.Equal(HttpStatusCode.Redirect, aanmelding.StatusCode);
    }

    private async Task NodigUitAsync(string email)
    {
        await using var context = _db.MaakContext();
        context.Gebruikers.Add(new Gebruiker(email, naam: string.Empty, isAdmin: false));
        await context.SaveChangesAsync();
    }

    /// <summary>The same database, in Entra mode, so the configured sign-in event is the one under test.</summary>
    private WebApplicationFactory<Program> EntraFactory() =>
        new PostgresApiFactory(_db.ConnectionString) { GebruikTestAuthenticatie = false }
            .WithWebHostBuilder(builder =>
            {
                builder.UseSetting("Authenticatie:Modus", "Entra");
                builder.UseSetting("Authenticatie:Entra:TenantId", School.ToString());
                builder.UseSetting("Authenticatie:Entra:ClientId", "22222222-0000-0000-0000-000000000000");
                builder.UseSetting("Authenticatie:Entra:ClientSecret", "test-only-not-a-secret");
            });

    private static ClaimsPrincipal Claims(string upn, string? acct)
    {
        var claims = new List<Claim>
        {
            new("tid", School.ToString()),
            new("oid", Guid.NewGuid().ToString()),
            new("preferred_username", upn),
            new("name", "An Peeters"),
        };
        if (acct is not null)
        {
            claims.Add(new Claim("acct", acct));
        }

        return new ClaimsPrincipal(new ClaimsIdentity(claims, "Entra"));
    }

    /// <summary>Runs the configured <c>OnTokenValidated</c> exactly as the OpenID Connect handler would after a sign-in.</summary>
    private static async Task<TokenValidatedContext> BeoordeelAsync(WebApplicationFactory<Program> factory, ClaimsPrincipal principal)
    {
        _ = factory.CreateClient();
        await using var scope = factory.Services.CreateAsyncScope();
        var opties = factory.Services.GetRequiredService<IOptionsMonitor<OpenIdConnectOptions>>().Get(Aanmelding.EntraSchema);
        var schema = await factory.Services.GetRequiredService<IAuthenticationSchemeProvider>().GetSchemeAsync(Aanmelding.EntraSchema);

        var http = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
        var context = new TokenValidatedContext(http, schema!, opties, principal, new AuthenticationProperties());
        await opties.Events.TokenValidated(context);
        return context;
    }

    private sealed record AfmeldDto(string DoorsturenNaar);

    private sealed class VanafLoopback : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, volgende) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Loopback;
                return volgende(context);
            });
            next(app);
        };
    }
}
