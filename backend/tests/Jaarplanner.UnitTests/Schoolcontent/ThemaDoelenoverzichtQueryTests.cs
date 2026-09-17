using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// The leerplandoelen of a thema per leeftijd (FB-009, TB-048): the list follows the concordance of the thema's
/// minimumdoelen, and a decided link outside it is shown apart where it is placed. EF Core in-memory, so it runs without
/// Docker.
/// </summary>
public sealed class ThemaDoelenoverzichtQueryTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly ThemaDoelenoverzichtQuery _query;

    public ThemaDoelenoverzichtQueryTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"thema_doelenoverzicht_{Guid.NewGuid():N}")
            .Options;
        _context = new AppDbContext(options);
        _query = new ThemaDoelenoverzichtQuery(_context);
    }

    public void Dispose() => _context.Dispose();

    private static Leerplandoel Doel(string code, string jaarFase, string? minimumdoelRef = null) =>
        new(
            code: code,
            doelsoort: Doelsoort.Gemeenschappelijk,
            jaarFase: jaarFase,
            domein: "Natuur",
            subdomein: "Planten",
            disciplineNummer: "3",
            tekst: $"tekst {code}",
            minimumdoelRef: minimumdoelRef);

    private static DoelKoppeling Manueel(string code) => new(code, KoppelingStatus.Manueel);

    private async Task<ThemaDoelenoverzicht> OverzichtVan(Thema thema, params object[] curriculum)
    {
        _context.AddRange(curriculum);
        _context.Add(thema);
        await _context.SaveChangesAsync();
        _context.ChangeTracker.Clear();
        return await _query.HaalOpAsync(thema.Id);
    }

    [Fact]
    public async Task Lijst_de_leerplandoelen_van_de_minimumdoelen_van_het_thema_per_jaarfase_ook_als_niets_ze_koppelt()
    {
        var thema = new Thema("Herfst", 4);
        thema.KoppelMinimumdoel("K-7");

        var overzicht = await OverzichtVan(
            thema,
            new Minimumdoel("K-7", "K-", "7", "eindterm"),
            new Minimumdoel("K-8", "K-", "8", "andere eindterm"),
            Doel("3.1.GK3.2", "K3", "K-7"),
            Doel("3.1.GK2.1", "K2", "K-7"),
            Doel("3.1.GK3.1", "K3", "K-7"),
            Doel("3.1.GK3.9", "K3", "K-8"),
            Doel("3.1.GK3.5", "K3"));

        Assert.Equal(["K2", "K3"], overzicht.Leeftijden.Select(l => l.Leeftijd));
        Assert.Equal(["3.1.GK2.1"], overzicht.Leeftijden[0].Leerplandoelen.Select(l => l.Code));
        var k3 = overzicht.Leeftijden[1];
        Assert.Equal(["3.1.GK3.1", "3.1.GK3.2"], k3.Leerplandoelen.Select(l => l.Code));
        Assert.All(k3.Leerplandoelen, l => Assert.Equal("K-7", l.MinimumdoelRef));
        Assert.All(k3.Leerplandoelen, l => Assert.Empty(l.Plaatsen));
        Assert.Empty(k3.BuitenMinimumdoelen);
    }

    [Fact]
    public async Task Een_gekoppeld_leerplandoel_van_een_minimumdoel_van_het_thema_staat_alleen_in_de_lijst()
    {
        var thema = new Thema("Herfst", 4);
        thema.KoppelMinimumdoel("K-7");
        thema.VoegSubthemaToe("Bladeren", 2, "K3").VoegSubdoelToe("K3", Manueel("3.1.GK3.1"));

        var overzicht = await OverzichtVan(
            thema, new Minimumdoel("K-7", "K-", "7", "eindterm"), Doel("3.1.GK3.1", "K3", "K-7"));

        var k3 = Assert.Single(overzicht.Leeftijden);
        Assert.Equal(["3.1.GK3.1"], k3.Leerplandoelen.Select(l => l.Code));
        Assert.Empty(k3.BuitenMinimumdoelen);
    }

    [Fact]
    public async Task Zet_gekoppelde_leerplandoelen_buiten_de_minimumdoelen_apart_bij_de_leeftijd_van_het_subthema()
    {
        var thema = new Thema("Herfst", 4);
        thema.KoppelMinimumdoel("K-7");
        var subthema = thema.VoegSubthemaToe("Bladeren", 2, "K3");
        subthema.VoegSubdoelToe("K3", Manueel("3.1.GK3.9"));
        var sorteren = subthema.VoegActiviteitToe("Sorteren", ActiviteitType.Onderzoek);
        sorteren.VoegDoelkoppelingToe(Manueel("3.1.GK3.9"));
        sorteren.VoegDoelkoppelingToe(Manueel("3.2.GK3.4"));
        subthema.VoegActiviteitToe("Wegen", ActiviteitType.Onderzoek).VoegDoelkoppelingToe(Manueel("3.1.GK3.9"));

        var overzicht = await OverzichtVan(
            thema,
            new Minimumdoel("K-7", "K-", "7", "eindterm"),
            new Minimumdoel("K-8", "K-", "8", "andere eindterm"),
            Doel("3.1.GK3.1", "K3", "K-7"),
            Doel("3.1.GK3.9", "K3", "K-8"),
            Doel("3.2.GK3.4", "K3"));

        var k3 = Assert.Single(overzicht.Leeftijden);
        Assert.Equal(["3.1.GK3.1"], k3.Leerplandoelen.Select(l => l.Code));
        Assert.Equal(["3.1.GK3.9", "3.2.GK3.4"], k3.BuitenMinimumdoelen.Select(l => l.Code));
        Assert.Equal(
            [
                new DoelPlaats(DoelPlaatsSoort.Subdoel, "Bladeren"),
                new DoelPlaats(DoelPlaatsSoort.Activiteit, "Sorteren"),
                new DoelPlaats(DoelPlaatsSoort.Activiteit, "Wegen"),
            ],
            k3.BuitenMinimumdoelen[0].Plaatsen);
    }

    [Fact]
    public async Task Een_thema_zonder_minimumdoelen_heeft_een_lege_lijst_en_toont_zijn_koppelingen_apart()
    {
        var thema = new Thema("Herfst", 4);
        thema.VoegThemadoelToe(Manueel("4.1.GK2.1"));
        thema.VoegSubthemaToe("Bladeren", 2, "K3").VoegSubdoelToe("K3", Manueel("3.1.GK3.1"));

        var overzicht = await OverzichtVan(
            thema, new Minimumdoel("K-7", "K-", "7", "eindterm"), Doel("4.1.GK2.1", "K2", "K-7"), Doel("3.1.GK3.1", "K3", "K-7"));

        Assert.Equal(["K2", "K3"], overzicht.Leeftijden.Select(l => l.Leeftijd));
        Assert.All(overzicht.Leeftijden, l => Assert.Empty(l.Leerplandoelen));
        var themadoel = Assert.Single(overzicht.Leeftijden[0].BuitenMinimumdoelen);
        Assert.Equal([new DoelPlaats(DoelPlaatsSoort.Themadoel, null)], themadoel.Plaatsen);
    }

    [Fact]
    public async Task Een_thema_zonder_minimumdoelen_en_zonder_koppelingen_is_leeg()
    {
        var overzicht = await OverzichtVan(new Thema("Herfst", 4), Doel("3.1.GK3.1", "K3", "K-7"));

        Assert.Empty(overzicht.Leeftijden);
    }

    [Fact]
    public async Task Laat_voorgestelde_en_geweigerde_koppelingen_en_eigen_activiteiten_weg()
    {
        var thema = new Thema("Herfst", 4);
        var subthema = thema.VoegSubthemaToe("Bladeren", 2, "K3");
        var activiteit = subthema.VoegActiviteitToe("Sorteren", ActiviteitType.Onderzoek);
        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("5.1.GK3.1", KoppelingStatus.Voorgesteld, "past"));
        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("5.2.GK3.1", KoppelingStatus.Geweigerd));
        subthema.VoegActiviteitToe("Eigen", ActiviteitType.Onderzoek, eigenaarId: Guid.NewGuid())
            .VoegDoelkoppelingToe(Manueel("5.3.GK3.1"));

        var overzicht = await OverzichtVan(thema, Doel("5.1.GK3.1", "K3"), Doel("5.2.GK3.1", "K3"), Doel("5.3.GK3.1", "K3"));

        Assert.Empty(overzicht.Leeftijden);
    }

    [Fact]
    public async Task Ordent_codes_zoals_een_lezer_ze_telt()
    {
        var thema = new Thema("Herfst", 4);
        thema.KoppelMinimumdoel("K-7");

        var overzicht = await OverzichtVan(
            thema,
            new Minimumdoel("K-7", "K-", "7", "eindterm"),
            Doel("3.1.GK3.10", "K3", "K-7"),
            Doel("3.1.GK3.9", "K3", "K-7"),
            Doel("3.1.GK3.2", "K3", "K-7"));

        Assert.Equal(["3.1.GK3.2", "3.1.GK3.9", "3.1.GK3.10"], overzicht.Leeftijden[0].Leerplandoelen.Select(l => l.Code));
    }

    [Fact]
    public async Task Weigert_een_thema_dat_niet_bestaat()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => _query.HaalOpAsync(Guid.NewGuid()));
    }
}
