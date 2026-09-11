using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Api.Infrastructure.Authenticatie;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Authenticatie;

/// <summary>
/// Pins ADR-0031 decision 2 on the <b>whole</b> route surface: no endpoint is anonymous unless it is on
/// <see cref="AnoniemToegestaan"/>, and every other one answers 401 to a request without a session.
/// <para>
/// <b>Enumerated from the endpoint data source, not from a route prefix.</b> ADR-0022's test filtered on
/// <c>api/opstap-import</c> and would never have noticed a new controller that forgot its attribute. This one sends a
/// request to every route the app maps, so a controller added next month is covered the day it is added.
/// </para>
/// </summary>
public sealed class ElkeRouteVraagtEenSessieTests : IClassFixture<JaarplannerApiFactory>
{
    /// <summary>
    /// Every route that may be reached without a session, and why:
    /// <list type="bullet">
    /// <item>the two health checks, which a load balancer calls;</item>
    /// <item>signing in and signing out;</item>
    /// <item>the development sign-in, which exists only in Development (and the tests run in Development);</item>
    /// <item>the OpenAPI document, Development only.</item>
    /// </list>
    /// </summary>
    private static readonly string[] AnoniemToegestaan =
    [
        "GET health",
        "GET health/ready",
        "GET api/aanmelden",
        "POST api/afmelden",
        // The group's own route: MapGroup plus MapGet("") keeps the group's trailing slash in the pattern.
        "GET api/aanmelden/ontwikkeling/",
        "GET api/aanmelden/ontwikkeling/{gebruikerId:guid}",
        "GET openapi/{documentName}.json",
    ];

    private readonly JaarplannerApiFactory _factory;

    public ElkeRouteVraagtEenSessieTests(JaarplannerApiFactory factory) => _factory = factory;

    [Fact]
    public void Alleen_de_bekende_routes_zijn_anoniem()
    {
        var anoniem = Endpoints()
            .Where(e => e.Metadata.GetMetadata<IAllowAnonymous>() is not null)
            .SelectMany(Sleutels)
            .Order(StringComparer.Ordinal)
            .ToList();

        Assert.Equal(AnoniemToegestaan.Order(StringComparer.Ordinal), anoniem);
    }

    [Fact]
    public async Task Elke_andere_route_antwoordt_401_zonder_sessie()
    {
        using var client = _factory.MaakAnoniemeClient();
        var beschermd = Endpoints().Where(e => e.Metadata.GetMetadata<IAllowAnonymous>() is null).ToList();

        var fouten = new List<string>();
        var verzonden = 0;
        foreach (var endpoint in beschermd)
        {
            foreach (var methode in Methoden(endpoint))
            {
                var url = "/" + VulIn(endpoint.RoutePattern);
                using var verzoek = new HttpRequestMessage(new HttpMethod(methode), url);
                using var antwoord = await client.SendAsync(verzoek);
                verzonden++;
                if (antwoord.StatusCode != HttpStatusCode.Unauthorized)
                {
                    fouten.Add($"{methode} {url} answered {(int)antwoord.StatusCode}");
                }
            }
        }

        Assert.Empty(fouten);

        // A guard on the guard: an enumeration that silently found nothing would pass the assertion above.
        Assert.True(verzonden >= 90, $"Expected to exercise the whole API surface, sent only {verzonden} requests.");
    }

    [Fact]
    public async Task Een_wijzigend_verzoek_zonder_antivervalsingsheader_wordt_geweigerd()
    {
        using var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Remove(CsrfHeaderControle.Header);

        using var antwoord = await client.PostAsync("/api/schooljaren", JsonContent.Create(new { }));

        Assert.Equal(HttpStatusCode.Forbidden, antwoord.StatusCode);
    }

    /// <summary>
    /// Not followed: the redirect goes to the development sign-in, which refuses an in-process test server for having
    /// no loopback address. That refusal is a 403 too, and following it would make this test prove the wrong thing.
    /// </summary>
    [Fact]
    public async Task Een_lezend_verzoek_heeft_geen_antivervalsingsheader_nodig()
    {
        using var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        client.DefaultRequestHeaders.Remove(CsrfHeaderControle.Header);

        using var antwoord = await client.GetAsync("/api/aanmelden?terugNaar=/agenda");

        Assert.Equal(HttpStatusCode.Redirect, antwoord.StatusCode);
    }

    private IEnumerable<RouteEndpoint> Endpoints() =>
        _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>();

    private static IEnumerable<string> Methoden(RouteEndpoint endpoint) =>
        endpoint.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"];

    private static IEnumerable<string> Sleutels(RouteEndpoint endpoint) =>
        Methoden(endpoint).Select(m => $"{m} {endpoint.RoutePattern.RawText?.TrimStart('/')}");

    /// <summary>
    /// A concrete URL that matches <paramref name="patroon"/>, so the request reaches routing and then authorisation.
    /// A value that failed a route constraint would answer 404, and the test would name the route that did.
    /// </summary>
    private static string VulIn(RoutePattern patroon) =>
        string.Join('/', patroon.PathSegments.Select(segment => string.Concat(segment.Parts.Select(deel => deel switch
        {
            RoutePatternLiteralPart letterlijk => letterlijk.Content,
            RoutePatternSeparatorPart scheiding => scheiding.Content,
            RoutePatternParameterPart parameter => Voorbeeld(parameter),
            _ => "x",
        }))));

    private static string Voorbeeld(RoutePatternParameterPart parameter)
    {
        var beperkingen = parameter.ParameterPolicies.Select(p => p.Content ?? string.Empty).ToList();
        if (beperkingen.Contains("guid")) return Guid.NewGuid().ToString();
        if (beperkingen.Contains("int") || beperkingen.Contains("long")) return "1";
        if (beperkingen.Contains("datetime")) return "2026-09-01";
        if (beperkingen.Contains("bool")) return "true";
        return "x";
    }
}
