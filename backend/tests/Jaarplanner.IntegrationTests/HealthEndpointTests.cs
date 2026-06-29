using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Pins the E0-04 acceptance criterion: the API starts and serves a working
/// <c>/health</c> liveness endpoint that returns 200 even when no database is
/// reachable (no Postgres is running in CI/dev for these tests). The DB readiness
/// state lives on a separate <c>/health/ready</c> probe and must not crash the app.
/// </summary>
public class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Health_liveness_returns_200_even_without_a_database()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Health_ready_responds_without_crashing_when_database_is_unreachable()
    {
        var client = _factory.CreateClient();

        // No Postgres is running, so the DbContext readiness check reports Unhealthy (503).
        // The point of this test is that the app stays up and responds rather than crashing.
        var response = await client.GetAsync("/health/ready");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("Unhealthy", await response.Content.ReadAsStringAsync());
    }
}
