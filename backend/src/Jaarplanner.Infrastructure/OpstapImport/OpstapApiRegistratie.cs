using Jaarplanner.Application.Curriculum.Import;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// DI registration for reading KOV's Op.stap API (ADR-0032). Kept in its own file so the API source grows here (E1-21
/// added the curriculum reader, E1-23 will add the scheduled check) without every story editing <c>DependencyInjection.cs</c>.
/// </summary>
public static class OpstapApiRegistratie
{
    /// <summary>
    /// Registers both sources as typed <see cref="HttpClient"/>s, the minimumdoelen (E1-12) and the curriculum (E1-21),
    /// and the two import services that write what they read. Options come from <see cref="OpstapApiOptions.SectionName"/>;
    /// the defaults point at KOV's production API and need no configuration.
    /// <para>
    /// The leerplandoelen import also needs <see cref="IOpstapImportService"/>, which <c>DependencyInjection.cs</c>
    /// registers for the Excel route; both routes write through that one service.
    /// </para>
    /// </summary>
    public static IServiceCollection AddOpstapApi(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<OpstapApiOptions>(configuration.GetSection(OpstapApiOptions.SectionName));
        services.TryAddSingleton(TimeProvider.System);

        services.AddHttpClient<IMinimumdoelBron, OnderwijsdoelenApiBron>(StelIn)
            .ConfigurePrimaryHttpMessageHandler(ZonderDoorverwijzing);
        services.AddHttpClient<ILeerplandoelBron, CurriculumApiBron>(StelIn)
            .ConfigurePrimaryHttpMessageHandler(ZonderDoorverwijzing);

        services.AddScoped<IMinimumdoelImportService, MinimumdoelImportService>();
        services.AddScoped<ILeerplandoelImportService, LeerplandoelImportService>();

        return services;

        static void StelIn(IServiceProvider provider, HttpClient client)
        {
            var opties = provider.GetRequiredService<IOptions<OpstapApiOptions>>().Value;
            client.Timeout = opties.Tijdslimiet;
            client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Jaarplanner/1.0");
        }

        // The configured base URL is the only host either source may read (ADR-0032). A redirect would take the read to
        // whatever host a response names, so none is followed: a 3xx is a non-success status and refuses the read
        // (E1-21, antagonist round 1 MINOR 2).
        static HttpMessageHandler ZonderDoorverwijzing() => new SocketsHttpHandler { AllowAutoRedirect = false };
    }
}
