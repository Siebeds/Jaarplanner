using Jaarplanner.Application.Curriculum.Import;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// DI registration for reading KOV's Op.stap API (ADR-0032). Kept in its own file so the API source grows here (E1-21
/// adds the curriculum reader, E1-23 the scheduled check) without every story editing <c>DependencyInjection.cs</c>.
/// </summary>
public static class OpstapApiRegistratie
{
    /// <summary>
    /// Registers the minimumdoelen source as a typed <see cref="HttpClient"/> and the import service that writes what it
    /// reads (E1-12). Options come from <see cref="OpstapApiOptions.SectionName"/>; the defaults point at KOV's
    /// production API and need no configuration.
    /// </summary>
    public static IServiceCollection AddOpstapApi(this IServiceCollection services, IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);

        services.Configure<OpstapApiOptions>(configuration.GetSection(OpstapApiOptions.SectionName));

        services.AddHttpClient<IMinimumdoelBron, OnderwijsdoelenApiBron>((provider, client) =>
        {
            var opties = provider.GetRequiredService<IOptions<OpstapApiOptions>>().Value;
            client.Timeout = opties.Tijdslimiet;
            client.DefaultRequestHeaders.Accept.ParseAdd("application/json");
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Jaarplanner/1.0");
        });

        services.AddScoped<IMinimumdoelImportService, MinimumdoelImportService>();

        return services;
    }
}
