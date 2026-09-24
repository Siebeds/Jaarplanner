using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// TB-017: every goal link in a thema read carries what the doel says (its text, its doelsoort and whether Op.stap
/// dropped it), so the thema page shows its rows without reading the doel detail once per code. Against real
/// PostgreSQL, because the lookup is one query over a list of codes and that translation is the provider's work.
/// </summary>
public sealed class ThemaweergaveDoelinhoudPostgresTests : IAsyncLifetime
{
    private const string Leeftijd = "K3";

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (PostgresTestDatabase.IsBeschikbaar)
        {
            _db = await PostgresTestDatabase.MaakAsync("doelinhoud");
        }
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Een_thema_openen_geeft_elke_koppeling_de_tekst_de_doelsoort_en_de_opstapvlag_mee()
    {
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var thema = await new SchoolcontentBeheerService(context).HaalThemaOpAsync(seed.ThemaId);

        AssertInhoud(thema);
    }

    [PostgresFact]
    public async Task Een_thema_voor_een_klas_geeft_elke_koppeling_de_doelinhoud_mee()
    {
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var thema = await new SchoolcontentBeheerService(context).HaalThemaVoorKlasAsync(seed.ThemaId, seed.KlasId);

        AssertInhoud(thema);
    }

    [PostgresFact]
    public async Task De_themalijst_geeft_elke_koppeling_de_doelinhoud_mee()
    {
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var themas = await new SchoolcontentBeheerService(context).HaalThemasOpAsync();

        AssertInhoud(Assert.Single(themas, t => t.Id == seed.ThemaId));
        var leeg = Assert.Single(themas, t => t.Id != seed.ThemaId);
        Assert.Empty(leeg.Themadoelen);
    }

    [PostgresFact]
    public async Task Het_antwoord_op_een_schrijfactie_draagt_geen_doelinhoud()
    {
        // A write answers from what it just changed and runs no extra query; the screen reads the thema again.
        var seed = await SeedAsync();

        await using var context = _db.MaakContext();
        var service = new SchoolcontentBeheerService(context);
        var thema = await service.HaalThemaOpAsync(seed.ThemaId);
        var gewijzigd = await service.WijzigThemaAsync(
            seed.ThemaId,
            new ThemaWijziging("Herfst", thema.DuurWeken, "andere invalshoek", thema.Kernwoordenschat, thema.RijkeWoordenschat));

        var koppeling = Assert.Single(gewijzigd.Themadoelen).Koppeling;
        Assert.Null(koppeling.Tekst);
        Assert.Null(koppeling.Doelsoort);
        Assert.Null(koppeling.NietMeerInOpstap);
    }

    private static void AssertInhoud(ThemaWeergave thema)
    {
        var themadoel = Assert.Single(thema.Themadoelen).Koppeling;
        Assert.Equal("TB17-MD", themadoel.LeerplandoelCode);
        Assert.Equal("verwondert zich over de natuur.", themadoel.Tekst);
        Assert.Equal(Doelsoort.Minimumdoel, themadoel.Doelsoort);
        Assert.False(themadoel.NietMeerInOpstap);

        var subthema = Assert.Single(thema.Subthemas);
        var subdoel = Assert.Single(subthema.Subdoelen).Koppeling;
        Assert.Equal("herkent bladeren.", subdoel.Tekst);
        Assert.Equal(Doelsoort.Gemeenschappelijk, subdoel.Doelsoort);
        Assert.True(subdoel.NietMeerInOpstap);

        var activiteitdoel = Assert.Single(Assert.Single(subthema.Activiteiten).Doelkoppelingen);
        Assert.Equal("TB17-V", activiteitdoel.LeerplandoelCode);
        Assert.Equal("sorteert bladeren op vorm.", activiteitdoel.Tekst);
        Assert.Equal(Doelsoort.Verdieping, activiteitdoel.Doelsoort);
        Assert.False(activiteitdoel.NietMeerInOpstap);
    }

    /// <summary>
    /// One thema with a themadoel, a subdoel whose doel Op.stap dropped, and an activiteit with a third doel, each of
    /// another doelsoort; and a second thema without anything, so the list read has a thema with no codes at all.
    /// </summary>
    private async Task<Seed> SeedAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("doelinhoud"));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}"[..12], Leeftijd);
        context.Schooljaren.Add(schooljaar);

        context.Leerplandoelen.Add(new Leerplandoel(
            "TB17-MD", Doelsoort.Minimumdoel, Leeftijd, "Natuur", "Levende natuur", "3", tekst: "verwondert zich over de natuur."));
        var vervallen = new Leerplandoel(
            "TB17-G", Doelsoort.Gemeenschappelijk, Leeftijd, "Natuur", "Levende natuur", "3", tekst: "herkent bladeren.");
        context.Leerplandoelen.Add(vervallen);
        context.Entry(vervallen).Property(l => l.NietMeerInOpstap).CurrentValue = true;
        context.Leerplandoelen.Add(new Leerplandoel(
            "TB17-V", Doelsoort.Verdieping, Leeftijd, "Natuur", "Levende natuur", "3", tekst: "sorteert bladeren op vorm."));

        var herfst = new Thema("Herfst", duurWeken: 6);
        herfst.VoegThemadoelToe(new DoelKoppeling("TB17-MD", KoppelingStatus.Manueel));
        var subthema = herfst.VoegSubthemaToe("Bladeren", duurWeken: 2, Leeftijd);
        subthema.VoegSubdoelToe(Leeftijd, new DoelKoppeling("TB17-G", KoppelingStatus.Manueel));
        var activiteit = subthema.VoegActiviteitToe("Bladeren sorteren", ActiviteitType.Waarneming);
        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("TB17-V", KoppelingStatus.Manueel));
        context.Themas.Add(herfst);

        context.Themas.Add(new Thema("Zee", duurWeken: 4));

        await context.SaveChangesAsync();
        return new Seed(herfst.Id, klas.Id);
    }

    private sealed record Seed(Guid ThemaId, Guid KlasId);
}
