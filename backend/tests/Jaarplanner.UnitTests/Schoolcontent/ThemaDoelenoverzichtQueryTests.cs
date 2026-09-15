using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// The doelen a thema reaches per leeftijd (FB-009): where each link is placed, that only a decided link counts, and that
/// the minimumdoelen follow from the concordance. EF Core in-memory, so it runs without Docker.
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
    public async Task Plaatst_subdoel_en_activiteitdoel_bij_de_leeftijd_van_het_subthema_elk_doel_een_keer()
    {
        var thema = new Thema("Herfst", 4);
        var subthema = thema.VoegSubthemaToe("Bladeren", 2, "K3");
        subthema.VoegSubdoelToe("K3", Manueel("3.1.GK3.1"));
        var sorteren = subthema.VoegActiviteitToe("Sorteren", ActiviteitType.Onderzoek);
        sorteren.VoegDoelkoppelingToe(Manueel("3.1.GK3.1"));
        sorteren.VoegDoelkoppelingToe(Manueel("3.2.GK3.4"));
        subthema.VoegActiviteitToe("Wegen", ActiviteitType.Onderzoek).VoegDoelkoppelingToe(Manueel("3.1.GK3.1"));

        var overzicht = await OverzichtVan(thema, Doel("3.1.GK3.1", "K3"), Doel("3.2.GK3.4", "K3"));

        var k3 = Assert.Single(overzicht.Leeftijden);
        Assert.Equal("K3", k3.Leeftijd);
        Assert.Equal(["3.1.GK3.1", "3.2.GK3.4"], k3.Leerplandoelen.Select(l => l.Code));
        Assert.Equal(
            [
                new DoelPlaats(DoelPlaatsSoort.Subdoel, "Bladeren"),
                new DoelPlaats(DoelPlaatsSoort.Activiteit, "Sorteren"),
                new DoelPlaats(DoelPlaatsSoort.Activiteit, "Wegen"),
            ],
            k3.Leerplandoelen[0].Plaatsen);
    }

    [Fact]
    public async Task Plaatst_een_themadoel_bij_de_jaarfase_van_zijn_leerplandoel_en_ordent_de_leeftijden()
    {
        var thema = new Thema("Herfst", 4);
        thema.VoegThemadoelToe(Manueel("4.1.GK2.1"));
        thema.VoegSubthemaToe("Bladeren", 2, "K3").VoegSubdoelToe("K3", Manueel("3.1.GK3.1"));

        var overzicht = await OverzichtVan(thema, Doel("4.1.GK2.1", "K2"), Doel("3.1.GK3.1", "K3"));

        Assert.Equal(["K2", "K3"], overzicht.Leeftijden.Select(l => l.Leeftijd));
        var themadoel = Assert.Single(overzicht.Leeftijden[0].Leerplandoelen);
        Assert.Equal([new DoelPlaats(DoelPlaatsSoort.Themadoel, null)], themadoel.Plaatsen);
    }

    [Fact]
    public async Task Telt_een_aanvaarde_doelsuggestie_mee_en_een_keer_naast_hetzelfde_themadoel()
    {
        var thema = new Thema("Herfst", 4);
        thema.VoegThemadoelToe(Manueel("4.1.GK3.1"));
        thema.VoegDoelsuggestieToe(new DoelKoppeling("4.1.GK3.1", KoppelingStatus.Voorgesteld, "past")).WijzigStatus(KoppelingStatus.Aanvaard);
        thema.VoegDoelsuggestieToe(new DoelKoppeling("4.2.GK3.2", KoppelingStatus.Voorgesteld, "past")).WijzigStatus(KoppelingStatus.Aanvaard);

        var overzicht = await OverzichtVan(thema, Doel("4.1.GK3.1", "K3"), Doel("4.2.GK3.2", "K3"));

        var k3 = Assert.Single(overzicht.Leeftijden);
        Assert.Equal(["4.1.GK3.1", "4.2.GK3.2"], k3.Leerplandoelen.Select(l => l.Code));
        Assert.All(k3.Leerplandoelen, l => Assert.Equal([new DoelPlaats(DoelPlaatsSoort.Themadoel, null)], l.Plaatsen));
    }

    [Fact]
    public async Task Laat_voorgestelde_en_geweigerde_koppelingen_weg()
    {
        var thema = new Thema("Herfst", 4);
        thema.VoegDoelsuggestieToe(new DoelKoppeling("5.1.GK3.1", KoppelingStatus.Voorgesteld, "past"));
        var subthema = thema.VoegSubthemaToe("Bladeren", 2, "K3");
        subthema.VoegActiviteitToe("Sorteren", ActiviteitType.Onderzoek)
            .VoegDoelkoppelingToe(new DoelKoppeling("5.2.GK3.1", KoppelingStatus.Geweigerd));

        var overzicht = await OverzichtVan(thema, Doel("5.1.GK3.1", "K3"), Doel("5.2.GK3.1", "K3"));

        Assert.Empty(overzicht.Leeftijden);
    }

    [Fact]
    public async Task Bereikt_minimumdoelen_via_de_concordantie_en_een_doel_zonder_ref_levert_er_geen()
    {
        var thema = new Thema("Herfst", 4);
        var subthema = thema.VoegSubthemaToe("Bladeren", 2, "K3");
        subthema.VoegSubdoelToe("K3", Manueel("A.1"));
        subthema.VoegSubdoelToe("K3", Manueel("A.2"));
        subthema.VoegSubdoelToe("K3", Manueel("A.3"));

        var overzicht = await OverzichtVan(
            thema,
            new Minimumdoel("K-7", "K-", "7", "eindterm"),
            Doel("A.1", "K3", "K-7"),
            Doel("A.2", "K3", "K-7"),
            Doel("A.3", "K3"));

        var k3 = Assert.Single(overzicht.Leeftijden);
        Assert.Equal(3, k3.Leerplandoelen.Count);
        var minimumdoel = Assert.Single(k3.Minimumdoelen);
        Assert.Equal("K-7", minimumdoel.Ref);
        Assert.Equal(["A.1", "A.2"], minimumdoel.Leerplandoelen);
    }

    [Fact]
    public async Task Ordent_codes_zoals_een_lezer_ze_telt()
    {
        var thema = new Thema("Herfst", 4);
        var subthema = thema.VoegSubthemaToe("Bladeren", 2, "K3");
        foreach (var code in new[] { "3.1.GK3.10", "3.1.GK3.9", "3.1.GK3.2" })
        {
            subthema.VoegSubdoelToe("K3", Manueel(code));
        }

        var overzicht = await OverzichtVan(thema, Doel("3.1.GK3.10", "K3"), Doel("3.1.GK3.9", "K3"), Doel("3.1.GK3.2", "K3"));

        Assert.Equal(["3.1.GK3.2", "3.1.GK3.9", "3.1.GK3.10"], overzicht.Leeftijden[0].Leerplandoelen.Select(l => l.Code));
    }

    [Fact]
    public async Task Weigert_een_thema_dat_niet_bestaat()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => _query.HaalOpAsync(Guid.NewGuid()));
    }
}
