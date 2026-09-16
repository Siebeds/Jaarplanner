using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// An activiteit a gebruiker creates is her own unless she asks for a shared one, a colleague of that leeftijd reads it
/// and copies it, and nobody else finds it under the subthema (ADR-0049 E1, E2, D3, D5). The FK and its SetNull (D8)
/// are database guarantees and are pinned against PostgreSQL.
/// </summary>
public sealed class EigenActiviteitTests : IDisposable
{
    private readonly DbContextOptions<AppDbContext> _options = new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase($"eigen_activiteit_{Guid.NewGuid():N}")
        .Options;

    private SchoolcontentBeheerService NieuweService() => new(new AppDbContext(_options));

    public void Dispose()
    {
        using var context = new AppDbContext(_options);
        context.Database.EnsureDeleted();
    }

    [Fact]
    public async Task Een_nieuwe_activiteit_is_standaard_de_eigen_activiteit_van_wie_ze_maakt()
    {
        var an = await BewaarGebruikerAsync("An");
        var (_, subthemaId) = await MaakSubthemaAsync();

        var weergave = await NieuweService().MaakActiviteitAsync(
            subthemaId, an.Id, new ActiviteitCreatie("Plassen meten", ActiviteitType.Waarneming));

        Assert.Equal(an.Id, weergave.EigenaarId);
        Assert.Equal("An", weergave.EigenaarNaam);
        Assert.Equal(an.Id, weergave.MakerId);
    }

    [Fact]
    public async Task Wie_een_gedeelde_vraagt_krijgt_een_gedeelde_activiteit()
    {
        var an = await BewaarGebruikerAsync("An");
        var (_, subthemaId) = await MaakSubthemaAsync();

        var weergave = await NieuweService().MaakActiviteitAsync(
            subthemaId, an.Id, new ActiviteitCreatie("Plassen meten", ActiviteitType.Waarneming, Gedeeld: true));

        Assert.Null(weergave.EigenaarId);
        Assert.Null(weergave.EigenaarNaam);
        Assert.Equal(an.Id, weergave.MakerId);
    }

    [Fact]
    public async Task Een_eigen_activiteit_zien_alleen_wie_ze_mag_lezen()
    {
        var an = await BewaarGebruikerAsync("An");
        var (themaId, subthemaId) = await MaakSubthemaAsync();
        await NieuweService().MaakActiviteitAsync(subthemaId, an.Id, new ActiviteitCreatie("Eigen", null));
        await NieuweService().MaakActiviteitAsync(subthemaId, an.Id, new ActiviteitCreatie("Gedeeld", null, Gedeeld: true));

        var collegaK3 = new Rechten(Guid.NewGuid(), false, false, [], ["K3"], []);
        var collegaK2 = new Rechten(Guid.NewGuid(), false, false, [], ["K2"], []);
        var themabeheer = new Rechten(Guid.NewGuid(), false, true, [], [], []);
        var directie = new Rechten(Guid.NewGuid(), true, false, [], [], []);
        var zelf = Rechten.Geen(an.Id);

        Assert.Equal(["Eigen", "Gedeeld"], await NamenAsync(themaId, collegaK3));
        Assert.Equal(["Eigen", "Gedeeld"], await NamenAsync(themaId, directie));
        Assert.Equal(["Eigen", "Gedeeld"], await NamenAsync(themaId, zelf));
        Assert.Equal(["Gedeeld"], await NamenAsync(themaId, collegaK2));
        Assert.Equal(["Gedeeld"], await NamenAsync(themaId, themabeheer));
        Assert.Equal(["Gedeeld"], await NamenAsync(themaId, lezer: null));

        var gezien = (await NieuweService().HaalThemaOpAsync(themaId, collegaK3)).Subthemas.Single().Activiteiten
            .Single(a => a.Naam == "Eigen");
        Assert.Equal("An", gezien.EigenaarNaam);

        // The school-wide library counts shared activiteiten only.
        var item = (await NieuweService().HaalThemaBibliotheekOpAsync()).Single();
        Assert.Equal(1, item.AantalActiviteiten);
    }

    [Fact]
    public async Task Gebruiken_geeft_een_eigen_kopie_met_dezelfde_inhoud_en_doelen_en_laat_het_origineel_ongemoeid()
    {
        var an = await BewaarGebruikerAsync("An");
        var bert = await BewaarGebruikerAsync("Bert");
        var (_, subthemaId) = await MaakSubthemaAsync();
        await BewaarLeerplandoelAsync("NAT-K3-01");
        var origineel = await NieuweService().MaakActiviteitAsync(
            subthemaId,
            an.Id,
            new ActiviteitCreatie(
                "Plassen meten",
                ActiviteitType.Waarneming,
                Hoek: "Waterhoek",
                VerwachteUitkomsten: "Ze meten",
                Kleur: Activiteitkleur.Olijf,
                LengteInLesuren: 2,
                LeerplandoelCodes: ["NAT-K3-01"]));

        var kopie = await NieuweService().KopieerActiviteitAsync(origineel.Id, bert.Id);

        Assert.NotEqual(origineel.Id, kopie.Id);
        Assert.Equal(bert.Id, kopie.EigenaarId);
        Assert.Equal(bert.Id, kopie.MakerId);
        Assert.Equal("Bert", kopie.EigenaarNaam);
        Assert.Equal(
            (origineel.Naam, origineel.ActiviteitType, origineel.Hoek, origineel.VerwachteUitkomsten, origineel.Kleur, origineel.LengteInLesuren),
            (kopie.Naam, kopie.ActiviteitType, kopie.Hoek, kopie.VerwachteUitkomsten, kopie.Kleur, kopie.LengteInLesuren));
        var koppeling = Assert.Single(kopie.Doelkoppelingen);
        Assert.Equal(("NAT-K3-01", KoppelingStatus.Manueel), (koppeling.LeerplandoelCode, koppeling.Status));

        // The copy is not tied to the original: renaming it leaves the original as it was.
        await NieuweService().WijzigActiviteitAsync(kopie.Id, new ActiviteitWijzigingInvoer("Mijn plassen", null));
        await using var context = new AppDbContext(_options);
        var opgeslagen = await context.Activiteiten.SingleAsync(a => a.Id == origineel.Id);
        Assert.Equal(("Plassen meten", an.Id), (opgeslagen.Naam, opgeslagen.EigenaarId));
    }

    [Fact]
    public async Task Een_gedeelde_activiteit_wordt_niet_gekopieerd()
    {
        var an = await BewaarGebruikerAsync("An");
        var (_, subthemaId) = await MaakSubthemaAsync();
        var gedeeld = await NieuweService().MaakActiviteitAsync(
            subthemaId, an.Id, new ActiviteitCreatie("Gedeeld", null, Gedeeld: true));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => NieuweService().KopieerActiviteitAsync(gedeeld.Id, an.Id));
    }

    [Fact]
    public void Het_domein_kopieert_alleen_besliste_doelen_en_alleen_binnen_het_eigen_subthema()
    {
        var thema = new Thema("Water", 4);
        var subthema = thema.VoegSubthemaToe("Regen", 2, "K3");
        var eigenaar = Guid.NewGuid();
        var bron = subthema.VoegActiviteitToe("Plassen", null, makerId: eigenaar, eigenaarId: eigenaar);
        bron.VoegDoelkoppelingToe(new DoelKoppeling("A", KoppelingStatus.Aanvaard));
        bron.VoegDoelkoppelingToe(new DoelKoppeling("B", KoppelingStatus.Voorgesteld, "motivatie"));
        bron.VoegDoelkoppelingToe(new DoelKoppeling("C", KoppelingStatus.Geweigerd));

        var kopie = subthema.KopieerActiviteitVoor(bron, Guid.NewGuid());

        Assert.True(kopie.IsEigen);
        Assert.Equal(["A"], kopie.Doelkoppelingen.Select(k => k.LeerplandoelCode));
        var ander = thema.VoegSubthemaToe("Wind", 2, "K3");
        Assert.Throws<InvalidOperationException>(() => ander.KopieerActiviteitVoor(bron, Guid.NewGuid()));
    }

    private async Task<string[]> NamenAsync(Guid themaId, Rechten? lezer) =>
        (await NieuweService().HaalThemaOpAsync(themaId, lezer)).Subthemas.Single().Activiteiten
            .Select(a => a.Naam)
            .Order(StringComparer.Ordinal)
            .ToArray();

    private async Task<Gebruiker> BewaarGebruikerAsync(string naam)
    {
        var gebruiker = new Gebruiker($"{naam.ToLowerInvariant()}@school.be", naam, isDirectie: false);
        await using var context = new AppDbContext(_options);
        context.Gebruikers.Add(gebruiker);
        await context.SaveChangesAsync();
        return gebruiker;
    }

    private async Task BewaarLeerplandoelAsync(string code)
    {
        await using var context = new AppDbContext(_options);
        context.Leerplandoelen.Add(new Leerplandoel(
            code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "3", tekst: "doeltekst"));
        await context.SaveChangesAsync();
    }

    private async Task<(Guid ThemaId, Guid SubthemaId)> MaakSubthemaAsync()
    {
        var thema = await NieuweService().MaakThemaAsync(new ThemaCreatie("Water", DuurWeken: 4));
        var subthema = await NieuweService().MaakSubthemaAsync(thema.Id, new SubthemaCreatie("Regen", 2, "K3"));
        return (thema.Id, subthema.Id);
    }
}
