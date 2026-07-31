using System.Net;
using Jaarplanner.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Pins the <b>single authorisation seam</b> for curriculum reference-data administration (E1-15,
/// Art. VI.1, ADR-0011 §2): the named policy exists, the import endpoints are behind <b>it</b> and not
/// behind an ad-hoc check, and it currently authorises an unauthenticated caller.
/// <para>
/// <b>Why pin a no-op.</b> The policy body is deliberately "allow" while the API has no authentication
/// scheme and no role matrix (E6-01/E6-02, E7-11). A seam that is only a comment is one refactor away
/// from disappearing, and the story that adds real roles would then have nothing to bind to. These
/// tests keep the enforcement point visible and make the day it stops being a no-op obvious: the last
/// test flips from 400 to 401/403, which is the intended outcome and not a regression.
/// </para>
/// </summary>
public sealed class CurriculumbeheerAutorisatieTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CurriculumbeheerAutorisatieTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Het_curriculumbeheerbeleid_is_geregistreerd()
    {
        var provider = _factory.Services.GetRequiredService<IAuthorizationPolicyProvider>();

        var beleid = await provider.GetPolicyAsync(CurriculumbeheerAutorisatie.Beleid);

        Assert.NotNull(beleid);
    }

    /// <summary>
    /// Every Op.stap import endpoint authorises against the one named policy. Asserted on endpoint
    /// metadata rather than on the source text, so moving the attribute (or adding a third import
    /// endpoint without it) fails here.
    /// </summary>
    [Fact]
    public void Elke_opstap_importroute_zit_achter_het_curriculumbeheerbeleid()
    {
        var endpoints = _factory.Services
            .GetRequiredService<EndpointDataSource>()
            .Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.RoutePattern.RawText?.StartsWith("api/opstap-import", StringComparison.Ordinal) == true)
            .ToList();

        Assert.Equal(2, endpoints.Count); // POST (commit) + POST voorbeeld (preview)
        Assert.All(endpoints, endpoint =>
        {
            var beleiden = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
            Assert.Contains(beleiden, b => b.Policy == CurriculumbeheerAutorisatie.Beleid);
        });
    }

    /// <summary>
    /// The seam authorises everyone today, and this is the assertion that says so out loud: an
    /// unauthenticated request reaches the controller and is answered on its <i>content</i> (no file, so
    /// 400), not rejected by the authorisation middleware. When E6-02 binds the policy to the directie
    /// role this must become 401/403 — update the assertion then, deliberately.
    /// </summary>
    [Fact]
    public async Task Zonder_authenticatie_laat_het_beleid_de_aanvraag_vandaag_door()
    {
        using var inhoud = new MultipartFormDataContent();
        inhoud.Add(new StringContent("2"), "disciplineNummer");

        var response = await _factory.CreateClient().PostAsync("/api/opstap-import", inhoud);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.NotEqual(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
