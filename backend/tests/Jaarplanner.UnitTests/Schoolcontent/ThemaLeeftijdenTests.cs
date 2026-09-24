using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// FB-012 (ADR-0069): a thema holds the leeftijden it is meant for. All nine by default, never none; a subthema holds one
/// of them; and a leeftijd a klas's jaarplan or a subthema still uses cannot be removed, with a refusal naming both.
/// </summary>
public sealed class ThemaLeeftijdenTests : IDisposable
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Klas _jk;
    private readonly Klas _k3;

    public ThemaLeeftijdenTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"thema_leeftijden_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);
        var schooljaar = TestSchooljaar.Maak();
        _jk = schooljaar.VoegKlasToe("De Egeltjes", "JK");
        _k3 = schooljaar.VoegKlasToe("De Uilen", "K3");
        seed.Schooljaren.Add(schooljaar);
        seed.SaveChanges();
    }

    private SchoolcontentBeheerService NieuweService() => new(new AppDbContext(_options));

    public void Dispose()
    {
        using var ctx = new AppDbContext(_options);
        ctx.Database.EnsureDeleted();
    }

    // --- Domain. ---

    [Fact]
    public void Een_nieuw_thema_geldt_voor_alle_leeftijden()
    {
        var thema = new Thema("Water", 4);

        Assert.Equal(Jaarfasen.Alle, thema.Leeftijden);
        Assert.True(thema.GeldtVoor(["JK"]));
    }

    [Fact]
    public void Leeftijden_worden_ontdubbeld_en_in_de_vaste_volgorde_bewaard()
    {
        var thema = new Thema("Water", 4);

        thema.StelLeeftijdenIn(["K3", " K2 ", "K3"]);

        Assert.Equal(["K2", "K3"], thema.Leeftijden);
    }

    [Fact]
    public void Een_thema_zonder_leeftijd_wordt_geweigerd()
    {
        var thema = new Thema("Water", 4);

        var fout = Assert.Throws<ArgumentException>(() => thema.StelLeeftijdenIn([]));

        Assert.Equal("Een thema geldt voor minstens één leeftijd.", fout.Message);
        Assert.Equal(Jaarfasen.Alle, thema.Leeftijden);
    }

    [Fact]
    public void Een_onbekende_leeftijd_wordt_geweigerd()
    {
        var thema = new Thema("Water", 4);

        var fout = Assert.Throws<ArgumentException>(() => thema.StelLeeftijdenIn(["K3", "5-6"]));

        Assert.Contains("'5-6'", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Een_klas_ziet_een_beperkt_thema_alleen_op_haar_leeftijd()
    {
        var thema = new Thema("Herfst", 4);
        thema.StelLeeftijdenIn(["K2", "K3"]);

        Assert.False(thema.GeldtVoor(["JK"]));
        Assert.True(thema.GeldtVoor(["K3"]));
        // A klas whose leeftijd cannot be derived widens to every thema (ADR-0069 D2).
        Assert.True(thema.GeldtVoor(null));
    }

    [Fact]
    public void Een_subthema_krijgt_alleen_een_leeftijd_van_zijn_thema()
    {
        var thema = new Thema("Herfst", 4);
        thema.StelLeeftijdenIn(["K2", "K3"]);

        var fout = Assert.Throws<ArgumentException>(() => thema.VoegSubthemaToe("Paddenstoelen", 2, "JK"));

        Assert.Equal(
            "Thema 'Herfst' geldt niet voor JK. Kies een leeftijd waarvoor het thema geldt: K2, K3.",
            fout.Message);
        Assert.Empty(thema.Subthemas);
        Assert.Equal("K3", thema.VoegSubthemaToe("Bladeren", 2, "K3").Leeftijd);
    }

    // --- Service. ---

    [Fact]
    public async Task Maak_thema_bewaart_de_gekozen_leeftijden()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4, Leeftijden: ["K3", "K2"]));

        Assert.Equal(["K2", "K3"], thema.Leeftijden);
        var bibliotheek = await NieuweService().HaalThemaBibliotheekOpAsync();
        Assert.Equal(["K2", "K3"], Assert.Single(bibliotheek).Leeftijden);
    }

    [Fact]
    public async Task De_bibliotheek_voor_een_klas_toont_alleen_de_themas_van_haar_leeftijd()
    {
        await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4, Leeftijden: ["K2", "K3"]));
        await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", 4));

        var voorJk = await NieuweService().HaalThemaBibliotheekOpAsync(_jk.Id);
        var voorK3 = await NieuweService().HaalThemaBibliotheekOpAsync(_k3.Id);
        var school = await NieuweService().HaalThemaBibliotheekOpAsync();

        Assert.Equal(["Water"], voorJk.Select(t => t.Naam));
        Assert.Equal(["Herfst", "Water"], voorK3.Select(t => t.Naam));
        Assert.Equal(2, school.Count);
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => NieuweService().HaalThemaBibliotheekOpAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Maak_thema_zonder_leeftijden_geldt_voor_alle()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", 4));

        Assert.Equal(Jaarfasen.Alle, thema.Leeftijden);
    }

    [Fact]
    public async Task Wijzig_thema_zonder_leeftijden_laat_ze_ongemoeid()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4, Leeftijden: ["K3"]));

        var gewijzigd = await NieuweService().WijzigThemaAsync(thema.Id, new ThemaWijziging("Herfst!", 5));

        Assert.Equal(["K3"], gewijzigd.Leeftijden);
    }

    [Fact]
    public async Task Wijzig_thema_met_een_lege_keuze_wordt_geweigerd()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().WijzigThemaAsync(thema.Id, new ThemaWijziging("Herfst", 4, Leeftijden: [])));

        Assert.Equal("Een thema geldt voor minstens één leeftijd.", fout.Message);
    }

    [Fact]
    public async Task Een_leeftijd_in_een_jaarplan_en_een_subthema_kan_niet_weg_en_de_melding_noemt_ze()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4));
        await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Egels", 2, "JK"));
        await PlaatsAsync(_jk.Id, thema.Id);

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().WijzigThemaAsync(thema.Id, new ThemaWijziging("Herfst", 4, Leeftijden: ["K2", "K3"])));

        Assert.Equal(
            "JK kan niet weg bij thema 'Herfst': het thema staat in het jaarplan van De Egeltjes; "
            + "deze subthema's hebben die leeftijd: Egels (JK). "
            + "Haal het thema eerst uit die jaarplannen en verplaats of verwijder die subthema's.",
            fout.Message);

        await using var context = new AppDbContext(_options);
        Assert.Equal(Jaarfasen.Alle, (await context.Themas.SingleAsync()).Leeftijden);
    }

    [Fact]
    public async Task Een_jaarplan_van_een_andere_leeftijd_staat_niet_in_de_weg()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4));
        await PlaatsAsync(_k3.Id, thema.Id);

        var gewijzigd = await NieuweService().WijzigThemaAsync(
            thema.Id, new ThemaWijziging("Herfst", 4, Leeftijden: ["K2", "K3"]));

        Assert.Equal(["K2", "K3"], gewijzigd.Leeftijden);
    }

    [Fact]
    public async Task Maak_subthema_buiten_de_leeftijden_van_het_thema_wordt_geweigerd()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4, Leeftijden: ["K2", "K3"]));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Egels", 2, "JK")));

        Assert.Contains("geldt niet voor JK", fout.Message, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Wijzig_subthema_naar_een_leeftijd_buiten_het_thema_wordt_geweigerd()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Herfst", 4, Leeftijden: ["K2", "K3"]));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Egels", 2, "K3"));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => NieuweService().WijzigSubthemaAsync(subthema.Id, new SubthemaWijzigingInvoer("Egels", 2, "JK")));

        Assert.Contains("geldt niet voor JK", fout.Message, StringComparison.Ordinal);
        var naarK2 = await NieuweService().WijzigSubthemaAsync(subthema.Id, new SubthemaWijzigingInvoer("Egels", 2, "K2"));
        Assert.Equal("K2", naarK2.Leeftijd);
    }

    private async Task PlaatsAsync(Guid klasId, Guid themaId)
    {
        await using var context = new AppDbContext(_options);
        var jaarplan = new Jaarplan(klasId);
        jaarplan.VoegPlaatsingToe(
            themaId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 1), KoppelingStatus.Manueel);
        context.Jaarplannen.Add(jaarplan);
        await context.SaveChangesAsync();
    }
}
