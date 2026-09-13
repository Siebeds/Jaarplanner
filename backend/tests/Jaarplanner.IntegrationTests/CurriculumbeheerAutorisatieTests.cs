using System.Net;
using Jaarplanner.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Pins the <b>single authorisation seam</b> for curriculum reference-data administration (E1-15, Art. VI.1,
/// ADR-0011 §2): the named policy exists, the import endpoints are behind <b>it</b> and not behind an ad-hoc check,
/// and since E6-01 it requires a session.
/// <para>
/// <b>The flip ADR-0022 predicted.</b> Until E6-01 the policy authorised everyone and the last test here asserted that
/// an anonymous request reached the controller (400). ADR-0031 amends ADR-0022 §1: a policy of its own is not reached
/// by the fallback, so it now requires a signed-in person itself, and an anonymous request is refused with 401. The
/// role half (directie) is still E6-02's, which is why a signed-in request still reaches the controller.
/// </para>
/// </summary>
public sealed class CurriculumbeheerAutorisatieTests : IClassFixture<JaarplannerApiFactory>
{
    private readonly JaarplannerApiFactory _factory;

    public CurriculumbeheerAutorisatieTests(JaarplannerApiFactory factory) => _factory = factory;

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

        // Named rather than counted, so the next import route is added here on purpose: the Excel import (E1-15), the
        // minimumdoelen import from KOV's API (E1-12) and the leerplandoelen import from it (E1-21), each a commit and a
        // preview, and the read of the import state the screen orders its flow by (E1-22).
        Assert.Equal(
            [
                "api/opstap-import",
                "api/opstap-import/leerplandoelen",
                "api/opstap-import/leerplandoelen/voorbeeld",
                "api/opstap-import/minimumdoelen",
                "api/opstap-import/minimumdoelen/voorbeeld",
                "api/opstap-import/stand",
                "api/opstap-import/voorbeeld",
            ],
            endpoints.Select(e => e.RoutePattern.RawText!).Order(StringComparer.Ordinal).ToArray());
        Assert.All(endpoints, endpoint =>
        {
            var beleiden = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
            Assert.Contains(beleiden, b => b.Policy == CurriculumbeheerAutorisatie.Beleid);
        });
    }

    [Fact]
    public async Task Zonder_sessie_weigert_het_beleid_de_aanvraag()
    {
        using var inhoud = new MultipartFormDataContent();
        inhoud.Add(new StringContent("2"), "disciplineNummer");

        var response = await _factory.MaakAnoniemeClient().PostAsync("/api/opstap-import", inhoud);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    /// <summary>
    /// A signed-in person reaches the controller, which answers on the request's <i>content</i> (no file, so 400).
    /// When E6-02 binds the policy to directie, a signed-in leerkracht must get 403 here instead: update this then.
    /// </summary>
    [Fact]
    public async Task Met_sessie_laat_het_beleid_de_aanvraag_vandaag_door()
    {
        using var inhoud = new MultipartFormDataContent();
        inhoud.Add(new StringContent("2"), "disciplineNummer");

        var response = await _factory.CreateClient().PostAsync("/api/opstap-import", inhoud);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
