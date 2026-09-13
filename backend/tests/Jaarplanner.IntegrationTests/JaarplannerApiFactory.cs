using Jaarplanner.Api.Infrastructure.Authenticatie;
using Jaarplanner.Infrastructure.Toegang;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// The base every API test host derives from (E6-01). It does three things to the production wiring and nothing else:
/// <list type="bullet">
/// <item>it authenticates through <see cref="TestAuthenticatie"/> instead of a cookie, unless
/// <see cref="GebruikTestAuthenticatie"/> is off, which is how the tests of the real sign-in run;</item>
/// <item>every client it creates sends the anti-forgery header, as the frontend's <c>apiFetch</c> does;</item>
/// <item>it blanks <c>Authenticatie:EersteDirectie</c>, which <c>appsettings.Development.json</c> sets for a developer's
/// machine, so no test run writes a directie row at startup (the Demo:Seed lesson in that file);</item>
/// <item>it keeps the session cookie's Data Protection keys in memory, unless
/// <see cref="SessiesleutelsInDatabase"/> is on.</item>
/// </list>
/// A subclass that overrides <see cref="ConfigureWebHost"/> must call the base first.
/// <para>
/// <b>Why the keys stay in memory by default.</b> A host that does not replace the database inherits the developer's
/// user-secrets and so talks to their <i>own</i> development database. The first Entra-mode test did exactly that: its
/// sign-in challenge went to read the key ring from <c>data_protection_keys</c> in the owner's database, and would
/// have written a key there had the table existed. A first fix swapped in the ephemeral provider and still left Data
/// Protection's startup read of the key ring pointed at that database, so the repository itself is what is replaced
/// (<see cref="GeheugenSleutelopslag"/>). Only a host with a throwaway database of its own
/// (<c>PostgresApiFactory</c>) turns the database path on, so the real persistence is still what the session tests use.
/// </para>
/// </summary>
public class JaarplannerApiFactory : WebApplicationFactory<Program>
{
    /// <summary>Whether requests authenticate through <see cref="TestAuthenticatie"/>. Off to test the real session.</summary>
    public bool GebruikTestAuthenticatie { get; init; } = true;

    /// <summary>
    /// Whether the Data Protection keys go to the database, as in production. Only for a host whose database is a
    /// throwaway one of its own.
    /// </summary>
    public bool SessiesleutelsInDatabase { get; init; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(EersteDirectieBootstrap.ConfiguratieSleutel, string.Empty);

        if (GebruikTestAuthenticatie)
        {
            builder.ConfigureTestServices(TestAuthenticatie.Registreer);
        }

        if (!SessiesleutelsInDatabase)
        {
            // The repository, not the ephemeral provider: see GeheugenSleutelopslag for the read the provider leaves.
            builder.ConfigureTestServices(services =>
                services.Configure<KeyManagementOptions>(o => o.XmlRepository = new GeheugenSleutelopslag()));
        }
    }

    protected override void ConfigureClient(HttpClient client)
    {
        base.ConfigureClient(client);
        client.DefaultRequestHeaders.Add(CsrfHeaderControle.Header, "1");
    }

    /// <summary>A client whose requests carry no session, but do carry the anti-forgery header.</summary>
    public HttpClient MaakAnoniemeClient()
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthenticatie.AnoniemHeader, "1");
        return client;
    }

    /// <summary>A client whose requests are made as the <c>Gebruiker</c> <paramref name="gebruikerId"/>.</summary>
    public HttpClient MaakClientVoor(Guid gebruikerId)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthenticatie.GebruikerHeader, gebruikerId.ToString());
        return client;
    }
}
