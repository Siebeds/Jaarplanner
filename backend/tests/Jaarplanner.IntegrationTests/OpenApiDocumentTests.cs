using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Guards the <c>Microsoft.OpenApi</c> transitive pin in <c>Jaarplanner.Api.csproj</c> (E7-12).
/// <para>
/// The pin substitutes an assembly that <c>Microsoft.AspNetCore.OpenApi</c> 10.0.5 was compiled
/// against at 2.0.0 with 2.11.0, to clear GHSA-v5pm-xwqc-g5wc. Nothing else can catch a break in
/// that substitution: the Api project never references <c>Microsoft.OpenApi</c> types itself, so
/// an incompatible API surface would not fail the build — it would surface only at runtime, as a
/// <c>MissingMethodException</c>/<c>TypeLoadException</c> the first time a document is generated.
/// Before this test the pin's safety rested on a one-off manual check; now CI defends it.
/// </para>
/// <para>
/// <c>MapOpenApi()</c> is registered only when the environment is Development (Program.cs), hence
/// the explicit override — the default for <see cref="WebApplicationFactory{T}"/> here is not.
/// </para>
/// </summary>
public class OpenApiDocumentTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public OpenApiDocumentTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task OpenApi_document_is_generated_with_the_pinned_Microsoft_OpenApi_version()
    {
        var client = _factory
            .WithWebHostBuilder(builder => builder.UseEnvironment("Development"))
            .CreateClient();

        var response = await client.GetAsync("/openapi/v1.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        // Parse rather than string-match: the failure mode being guarded against is the document
        // generator throwing or emitting nothing, not a particular spec version being rendered.
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.True(
            document.RootElement.TryGetProperty("openapi", out var versie),
            "The generated document has no \"openapi\" version property, so it is not an OpenAPI document.");
        Assert.False(string.IsNullOrWhiteSpace(versie.GetString()));
        Assert.True(
            document.RootElement.TryGetProperty("paths", out _),
            "The generated document has no \"paths\" object.");
    }
}
