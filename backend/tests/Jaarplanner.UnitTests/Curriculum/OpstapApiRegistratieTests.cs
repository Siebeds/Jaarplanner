using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// What <see cref="OpstapApiRegistratie.AddOpstapApi"/> configures on the two typed clients that read KOV's API. The host
/// is pinned by the base URL; a redirect would take the read to whatever host a response names, so neither client follows
/// one (E1-21, antagonist round 1 MINOR 2). Asserted on the handler the real registration builds, not on a copy of it.
/// </summary>
public sealed class OpstapApiRegistratieTests
{
    /// <summary>The typed clients are named after their interface, as <c>AddHttpClient&lt;TClient, TImpl&gt;</c> does.</summary>
    [Theory]
    [InlineData("IMinimumdoelBron")]
    [InlineData("ILeerplandoelBron")]
    public void Geen_van_beide_bronnen_volgt_een_doorverwijzing(string naam)
    {
        var services = new ServiceCollection();
        services.AddOpstapApi(new ConfigurationBuilder().Build());
        using var provider = services.BuildServiceProvider();

        var handler = provider.GetRequiredService<IHttpMessageHandlerFactory>().CreateHandler(naam);
        while (handler is DelegatingHandler tussen)
        {
            handler = tussen.InnerHandler!;
        }

        var primair = Assert.IsType<SocketsHttpHandler>(handler);
        Assert.False(primair.AllowAutoRedirect);
    }
}
