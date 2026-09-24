using System.Net;
using Microsoft.AspNetCore.Hosting;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// The API serves the built frontend (E7-04, ADR-0034): a client route opened cold gets <c>index.html</c>, the bundle's
/// files are served as they are, and neither needs a session. An unknown <c>api/</c> or <c>health/</c> path must not be
/// answered with the page, because a fetch would receive a 200 carrying HTML it cannot parse.
/// <para>
/// Runs against a web root of its own in a temporary folder, so it neither needs a frontend build nor depends on one.
/// </para>
/// </summary>
public sealed class SpaHostingTests : IDisposable
{
    private const string Pagina = "<!doctype html><title>jaarplanner-spa-test</title>";
    private const string Script = "console.log('jaarplanner-spa-test');";
    private const string Manifest = """{ "name": "jaarplanner-spa-test" }""";

    private readonly DirectoryInfo _webroot = Directory.CreateTempSubdirectory("jaarplanner-webroot-");
    private readonly MetWebroot _factory;

    public SpaHostingTests()
    {
        File.WriteAllText(Path.Combine(_webroot.FullName, "index.html"), Pagina);
        Directory.CreateDirectory(Path.Combine(_webroot.FullName, "assets"));
        File.WriteAllText(Path.Combine(_webroot.FullName, "assets", "app.js"), Script);
        File.WriteAllText(Path.Combine(_webroot.FullName, "manifest.webmanifest"), Manifest);
        _factory = new MetWebroot(_webroot.FullName);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/jaarplan")]
    [InlineData("/klassen/3/dekking")]
    [InlineData("/geen-toegang")]
    public async Task Een_route_van_de_frontend_krijgt_de_pagina_zonder_sessie(string pad)
    {
        using var client = _factory.MaakAnoniemeClient();

        using var antwoord = await client.GetAsync(pad);

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        Assert.Equal("text/html", antwoord.Content.Headers.ContentType?.MediaType);
        Assert.Equal(Pagina, await antwoord.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Een_bestand_van_de_bundel_wordt_zonder_sessie_geserveerd()
    {
        using var client = _factory.MaakAnoniemeClient();

        using var antwoord = await client.GetAsync("/assets/app.js");

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        Assert.Equal(Script, await antwoord.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Het_web_app_manifest_wordt_zonder_sessie_en_als_manifest_geserveerd()
    {
        // FB-085: a browser adding the app to a home screen fetches the manifest without credentials, and only reads
        // it when it arrives as a manifest, not as the page the fallback would send.
        using var client = _factory.MaakAnoniemeClient();

        using var antwoord = await client.GetAsync("/manifest.webmanifest");

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        Assert.Equal("application/manifest+json", antwoord.Content.Headers.ContentType?.MediaType);
        Assert.Equal(Manifest, await antwoord.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Een_HEAD_op_een_route_van_de_frontend_krijgt_de_pagina_zonder_sessie()
    {
        using var client = _factory.MaakAnoniemeClient();

        using var antwoord = await client.SendAsync(new HttpRequestMessage(HttpMethod.Head, "/jaarplan"));

        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
    }

    [Theory]
    [InlineData("/api/bestaat-niet")]
    [InlineData("/api")]
    [InlineData("/API/bestaat-niet")]
    [InlineData("//api/bestaat-niet")]
    [InlineData("/health/bestaat-niet")]
    public async Task Een_onbekend_api_of_health_pad_krijgt_de_pagina_niet(string pad)
    {
        using var client = _factory.MaakAnoniemeClient();

        // Absolute, because HttpClient reads a relative "//api/x" as a URL without a scheme whose host is "api", and
        // would then send "/x" to the server instead of the path under test.
        var adres = new Uri(client.BaseAddress!.GetLeftPart(UriPartial.Authority) + pad);
        using var antwoord = await client.GetAsync(adres);

        Assert.NotEqual(HttpStatusCode.OK, antwoord.StatusCode);
        Assert.NotEqual(Pagina, await antwoord.Content.ReadAsStringAsync());
    }

    public void Dispose()
    {
        _factory.Dispose();
        _webroot.Delete(recursive: true);
    }

    private sealed class MetWebroot(string webroot) : JaarplannerApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseWebRoot(webroot);
        }
    }
}
