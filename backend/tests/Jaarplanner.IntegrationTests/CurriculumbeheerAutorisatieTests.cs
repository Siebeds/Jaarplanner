using System.Net;
using System.Reflection;
using Jaarplanner.Api.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Pins the <b>single authorisation seam</b> for curriculum reference-data administration (E1-15, Art. VI.1,
/// ADR-0011 §2): the named policy exists, the import endpoints are behind <b>it</b> and not behind an ad-hoc check,
/// since E6-01 it requires a session, and since E6-02 it admits directie only (ADR-0030 §3, Op.stap row).
/// <para>
/// <b>The two flips ADR-0022 predicted.</b> Until E6-01 the policy authorised everyone. ADR-0031 amended ADR-0022 §1: a
/// policy of its own is not reached by the fallback, so it requires a signed-in person itself, and an anonymous request
/// is refused with 401. E6-02 added the role half: the policy is the matrix's Curriculumbeheer row.
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

    /// <summary>
    /// The same seam, read from the controllers rather than from the mapped endpoints (E6-02 slice 1, fix round 2):
    /// every controller whose route is under <c>api/opstap-import</c> names the policy, and none opens itself or one of
    /// its actions with <c>[AllowAnonymous]</c>. Named, so a new Op.stap controller is added here on purpose.
    /// </summary>
    [Fact]
    public void Elke_controller_onder_de_opstap_importroute_noemt_het_curriculumbeheerbeleid()
    {
        var controllers = typeof(Program).Assembly.GetTypes()
            .Where(t => typeof(ControllerBase).IsAssignableFrom(t) && !t.IsAbstract)
            .Where(t => t.GetCustomAttributes<RouteAttribute>(inherit: true)
                .Any(r => r.Template.StartsWith("api/opstap-import", StringComparison.Ordinal)))
            .ToList();

        Assert.Equal(
            [
                "OpstapImportController",
                "OpstapImportStandController",
                "OpstapLeerplandoelenImportController",
                "OpstapMinimumdoelenImportController",
            ],
            controllers.Select(c => c.Name).Order(StringComparer.Ordinal).ToArray());
        Assert.All(controllers, controller =>
        {
            Assert.Contains(
                controller.GetCustomAttributes<AuthorizeAttribute>(inherit: true),
                a => a.Policy == CurriculumbeheerAutorisatie.Beleid);
            Assert.Empty(controller.GetCustomAttributes<AllowAnonymousAttribute>(inherit: true));
            Assert.All(
                controller.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly),
                actie => Assert.Empty(actie.GetCustomAttributes<AllowAnonymousAttribute>(inherit: true)));
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
    /// Directie reaches the controller, which answers on the request's <i>content</i> (no file, so 400). The default
    /// test identity is directie (<see cref="TestAuthenticatie"/>). That everyone else gets 403 since E6-02, including a
    /// gebruiker with themabeheer, a hoofdleerkracht and a leerkracht, is pinned against PostgreSQL in
    /// <c>RechtenEndpointsTests</c>, because those rights live in the database.
    /// </summary>
    [Fact]
    public async Task Directie_komt_door_het_beleid_tot_bij_de_controller()
    {
        using var inhoud = new MultipartFormDataContent();
        inhoud.Add(new StringContent("2"), "disciplineNummer");

        var response = await _factory.CreateClient().PostAsync("/api/opstap-import", inhoud);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
