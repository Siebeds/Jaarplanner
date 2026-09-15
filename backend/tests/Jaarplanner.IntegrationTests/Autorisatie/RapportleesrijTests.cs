using Jaarplanner.Api.Infrastructure.Autorisatie;
using Jaarplanner.Application.Toegang;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Autorisatie;

/// <summary>
/// The report's read row stays a read (FB-008, ADR-0035 D5): <c>OntwikkelingsrapportLezen</c> is the one row Leerlingzorg
/// passes, and Leerlingzorg downloads nothing. A download or any other route that declared this row would hand the
/// right more than R18 gives it, so the row sits on exactly the two reads below. A route added later (FB-006's download,
/// say) that reuses it fails here until it declares a row of its own.
/// <para>
/// <b>Enumerated from the endpoint data source</b>, like <c>ElkeRouteVraagtEenSessieTests</c>, so the check covers
/// every route the app maps, whether it declares the row through <c>[RechtOp]</c> or <c>[Authorize(Policy = …)]</c>.
/// </para>
/// </summary>
public sealed class RapportleesrijTests : IClassFixture<JaarplannerApiFactory>
{
    /// <summary>The children of a klas, and one child's report at one moment: what reading a report is.</summary>
    private static readonly string[] Leesroutes =
    [
        "GET api/klassen/{klasId:guid}/leerlingen",
        "GET api/leerlingen/{leerlingId:guid}/rapporten/{moment:int:range(1,3)}",
    ];

    private readonly JaarplannerApiFactory _factory;

    public RapportleesrijTests(JaarplannerApiFactory factory) => _factory = factory;

    [Fact]
    public void De_leesrij_van_het_rapport_staat_alleen_op_de_twee_leesroutes()
    {
        const string rij = Rechtenmatrix.Beleid.OntwikkelingsrapportLezen;

        var routes = _factory.Services.GetRequiredService<EndpointDataSource>().Endpoints
            .OfType<RouteEndpoint>()
            .Where(e => e.Metadata.GetOrderedMetadata<RechtOpAttribute>().Any(r => r.Beleid == rij)
                || e.Metadata.GetOrderedMetadata<IAuthorizeData>().Any(a => a.Policy == rij))
            .SelectMany(e => (e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods ?? ["GET"])
                .Select(methode => $"{methode} {e.RoutePattern.RawText?.TrimStart('/')}"))
            .Order(StringComparer.Ordinal)
            .ToList();

        Assert.Equal(Leesroutes.Order(StringComparer.Ordinal), routes);
    }
}
