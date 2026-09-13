using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Contract tests against KOV's <b>live</b> API for the curriculum (E1-21), beside
/// <see cref="OnderwijsdoelenLiveContractTests"/>. Skipped unless <c>JAARPLANNER_LIVE_OPSTAP=1</c>, because a unit run
/// must not depend on a third party's uptime.
/// <para>
/// <b>The source comes from <see cref="OpstapApiRegistratie.AddOpstapApi"/></b>, not from a hand-built client, so what
/// the registration configures on the typed <see cref="HttpClient"/> (timeout, headers) is what these requests use. That
/// also answers the note E1-12 left before its <c>[x]</c>: no request through the registered source had reached KOV.
/// </para>
/// <para>
/// <b>Exact figures, deliberately.</b> A numbered snapshot does not change once published (that is what pinning one
/// relies on, ADR-0032 decision 6), so snapshot 1.2's census is asserted exactly. If one of these numbers moves, KOV
/// republished a version under the same number, and the import's promise that an apply writes what was reviewed would no
/// longer hold: that is worth a red run.
/// </para>
/// </summary>
public sealed class CurriculumApiLiveContractTests
{
    private static ServiceProvider Registratie()
    {
        var services = new ServiceCollection();
        services.AddOpstapApi(new ConfigurationBuilder().Build());
        return services.BuildServiceProvider();
    }

    [LiveOpstapFact]
    public async Task Snapshot_1_2_komt_via_de_echte_registratie_zonder_problemen_binnen()
    {
        await using var provider = Registratie();
        var bron = provider.GetRequiredService<ILeerplandoelBron>();

        var resultaat = await bron.HaalOpAsync("1.2");

        Assert.Equal("1.2", resultaat.Versie);
        Assert.Equal("8f470a12-231f-5817-7a8b-6582195e2583", resultaat.Hash);
        Assert.NotNull(resultaat.Wijzigingslog);
        Assert.Empty(resultaat.Problemen);
        Assert.Equal(
            ["1", "2", "3", "4", "5", "6", "7", "8", "9.1", "9.2", "9.3", "10", "11"],
            resultaat.Disciplines.Select(d => d.DisciplineNummer).ToArray());
        Assert.Equal(
            [new DoelsetTelling("+", 105), new DoelsetTelling("A", 67), new DoelsetTelling("P", 762),
             new DoelsetTelling("S", 436), new DoelsetTelling("V", 247), new DoelsetTelling("Z", 28)],
            resultaat.OvergeslagenDoelsets);

        var doelen = resultaat.Disciplines.SelectMany(d => d.Leerplandoelen).ToList();
        Assert.Equal(5835, doelen.Count);
        Assert.Equal(4983, doelen.Count(l => l.MinimumdoelRef is not null));
        Assert.Equal(992, doelen.Select(l => l.MinimumdoelRef).OfType<string>().Distinct().Count());
        Assert.Equal(1954, doelen.Count(l => l.Cluster is null));
        Assert.All(doelen, l =>
        {
            Assert.Equal(Doelsoort.Gemeenschappelijk, l.Doelsoort);
            Assert.True(Jaarfasen.IsBekend(l.JaarFase), l.Code);
            Assert.NotNull(l.OpstapSleutel);
            // A closing tag in stored text could only mean markup got through the conversion.
            Assert.DoesNotContain("</", l.Tekst + l.Voorbeelden + l.Toelichting + l.Woordenschat, StringComparison.Ordinal);
        });

        // The shapes that decided the converter's rules, each on the goal it was found in.
        Assert.Contains("10^2=10x10= 100", Doel(doelen, "2.1.GL3.10").Toelichting, StringComparison.Ordinal);
        Assert.Contains("=, ≠, <, >", Doel(doelen, "2.1.GL1.2").Tekst, StringComparison.Ordinal);
        Assert.Contains("(< 1 week)", Doel(doelen, "2.3.GL2.48").Tekst, StringComparison.Ordinal);
        Assert.Contains("notaties: 1/2, 1/4 [F]", Doel(doelen, "2.1.GL2.20").Tekst, StringComparison.Ordinal);
        Assert.Contains("Berekening:\nkans = 1/6\n", Doel(doelen, "2.5.GL6.6").Voorbeelden, StringComparison.Ordinal);
        Assert.Contains("1. hoeveel mogelijke uitkomsten er zijn;", Doel(doelen, "2.5.GL6.6").Toelichting, StringComparison.Ordinal);
        Assert.Contains("4 zijden | ✓ | ✓ | ✓", Doel(doelen, "2.4.GL4.9").Voorbeelden, StringComparison.Ordinal);
        Assert.Contains("[lege tabel van 4 rijen en 5 kolommen]", Doel(doelen, "2.2.GL2.2").Voorbeelden, StringComparison.Ordinal);
        Assert.Contains("[afbeelding: De energiebron]", Doel(doelen, "3.5.GL4.15").Voorbeelden, StringComparison.Ordinal);
        Assert.StartsWith("hedendaagse tijd, onze tijd(drekening)", Doel(doelen, "5.1.GL6.3").Woordenschat, StringComparison.Ordinal);
        Assert.Equal("9.3", Doel(doelen, "9-3.2.GL4.7").DisciplineNummer);
        Assert.Equal("4-2.1.7", Doel(doelen, "2.1.GL3.10").MinimumdoelRef);
    }

    /// <summary>Asked for no version, the source names a numbered one: the one an apply will pin.</summary>
    [LiveOpstapFact]
    public async Task Zonder_versie_noemt_de_bron_een_genummerde_versie()
    {
        await using var provider = Registratie();

        var resultaat = await provider.GetRequiredService<ILeerplandoelBron>().HaalOpAsync(versie: null);

        Assert.True(Opstapversie.IsGeldigeVersie(resultaat.Versie), resultaat.Versie);
        Assert.Empty(resultaat.Problemen);
    }

    /// <summary>The E1-12 source through the same registration, which no request had used before (E1-12 status note).</summary>
    [LiveOpstapFact]
    public async Task De_minimumdoelen_komen_via_de_echte_registratie_binnen()
    {
        await using var provider = Registratie();

        var resultaat = await provider.GetRequiredService<IMinimumdoelBron>().HaalOpAsync();

        Assert.Empty(resultaat.Problemen);
        Assert.Equal(998, resultaat.Minimumdoelen.Count);
    }

    private static Leerplandoel Doel(IEnumerable<Leerplandoel> doelen, string code) => Assert.Single(doelen, l => l.Code == code);
}
