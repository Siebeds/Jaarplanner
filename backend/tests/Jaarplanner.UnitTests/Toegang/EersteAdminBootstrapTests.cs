using Jaarplanner.Infrastructure.Toegang;
using Microsoft.Extensions.Configuration;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>Which configuration key names the first admin (ADR-0031 decision 7, ADR-0061 decision 5).</summary>
public sealed class EersteAdminBootstrapTests
{
    private static IConfiguration Configuratie(string? nieuw, string? oud) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                [EersteAdminBootstrap.ConfiguratieSleutel] = nieuw,
                [EersteAdminBootstrap.VorigeConfiguratieSleutel] = oud,
            })
            .Build();

    [Fact]
    public void De_nieuwe_sleutel_wint_van_de_oude() =>
        Assert.Equal("admin@school.be", EersteAdminBootstrap.LeesAdres(Configuratie(" admin@school.be ", "oud@school.be")));

    [Fact]
    public void Zonder_nieuwe_sleutel_telt_de_oude_nog() =>
        Assert.Equal("oud@school.be", EersteAdminBootstrap.LeesAdres(Configuratie(null, "oud@school.be")));

    [Fact]
    public void Een_lege_nieuwe_sleutel_valt_terug_op_de_oude() =>
        Assert.Equal("oud@school.be", EersteAdminBootstrap.LeesAdres(Configuratie("  ", "oud@school.be")));

    [Fact]
    public void Zonder_adres_is_er_geen_bootstrap() =>
        Assert.Null(EersteAdminBootstrap.LeesAdres(Configuratie(null, "")));
}
