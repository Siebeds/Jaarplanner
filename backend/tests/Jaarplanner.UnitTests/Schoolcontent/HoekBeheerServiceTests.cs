using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// <see cref="HoekBeheerService"/> against a real service over the in-memory provider (owner, 2026-08-30).
/// <para>
/// <b>Two of these earn their place well ahead of the rest.</b> The delete guard sits in front of a
/// <c>Restrict</c> foreign key, and this repository has already shipped a Restrict whose Dutch refusal did not
/// actually exist, turning an ordinary teacher action into an unhandled 500. And "neem over van een andere klas"
/// has to be a COPY: if those rows were ever shared, a rename in one classroom would rewrite another.
/// </para>
/// </summary>
public sealed class HoekBeheerServiceTests
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Klas _k3a;
    private readonly Klas _k3b;

    public HoekBeheerServiceTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"hoek_beheer_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);

        var schooljaar = TestSchooljaar.Maak();
        _k3a = schooljaar.VoegKlasToe("K3 groen", "K3");
        _k3b = schooljaar.VoegKlasToe("K3 blauw", "K3");
        seed.Schooljaren.Add(schooljaar);
        seed.SaveChanges();
    }

    // A fresh service over a fresh context per operation, mirroring the scoped-per-request lifetime.
    private HoekBeheerService Service() => new(new AppDbContext(_options));

    private AppDbContext Context() => new(_options);

    [Fact]
    public async Task Een_hoek_hoort_bij_de_klas_waarin_ze_gemaakt_is()
    {
        var hoek = await Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("boekenhoek", "vaste kast"));

        Assert.Equal(_k3a.Id, hoek.KlasId);
        Assert.Equal(0, hoek.AantalPlaatsingen);

        // And the other class of the same age does not see it. A hoek is furniture, not content: K3 blauw may
        // genuinely not have this corner, which is the whole reason it is scoped per klas while a subthema is not.
        Assert.Empty(await Service().HaalHoekenOpAsync(_k3b.Id));
    }

    [Fact]
    public async Task Twee_hoeken_met_dezelfde_naam_in_een_klas_worden_geweigerd_ongeacht_hoofdletters()
    {
        await Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("boekenhoek"));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("Boekenhoek")));

        Assert.Contains("Boekenhoek", fout.Message);

        // The same name in the OTHER class is fine: two rooms may each have a boekenhoek.
        var elders = await Service().MaakHoekAsync(_k3b.Id, new HoekInvoer("boekenhoek"));
        Assert.Equal(_k3b.Id, elders.KlasId);
    }

    [Fact]
    public async Task Een_hoek_zonder_naam_wordt_geweigerd_met_een_zin_voor_de_leerkracht()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("   ")));

        Assert.Equal("Een hoek heeft een naam nodig.", fout.Message);
    }

    [Fact]
    public async Task Hernoemen_botst_niet_met_de_hoek_zelf()
    {
        var hoek = await Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("boekenhoek"));

        // Same name, new description. Without the self-exclusion in the name guard this is the call that would
        // wrongly refuse, and it is the ordinary one.
        var gewijzigd = await Service().WijzigHoekAsync(hoek.Id, new HoekInvoer("boekenhoek", "met het zitzakje"));

        Assert.Equal("met het zitzakje", gewijzigd.Omschrijving);
    }

    [Fact]
    public async Task Een_onbekende_klas_geeft_niet_gevonden_en_geen_lege_lijst()
    {
        // "This class has no corners" and "this class does not exist" are different facts, and a picker that
        // reads the first hides its own control.
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().HaalHoekenOpAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task Een_geplaatste_hoek_kan_niet_verwijderd_worden_en_de_melding_noemt_het_aantal()
    {
        var hoek = await Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("boekenhoek"));

        await using (var context = Context())
        {
            context.Hoekplaatsingen.Add(new Hoekplaatsing(
                _k3a.Id, hoek.Id, new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 16)));
            await context.SaveChangesAsync();
        }

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VerwijderHoekAsync(hoek.Id));

        // THE ASSERTION THAT MATTERS: a Dutch sentence naming the corner, the count and the way out, in front of
        // a Restrict FK that would otherwise surface as a bare 23503.
        Assert.Contains("boekenhoek", fout.Message);
        Assert.Contains("1 keer", fout.Message);
        Assert.Contains("agenda", fout.Message);

        // And nothing was deleted on the way to the refusal.
        await using var na = Context();
        Assert.Equal(1, await na.Hoeken.CountAsync(h => h.Id == hoek.Id));
    }

    [Fact]
    public async Task Een_ongeplaatste_hoek_kan_gewoon_weg()
    {
        var hoek = await Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("zandtafel"));

        await Service().VerwijderHoekAsync(hoek.Id);

        Assert.Empty(await Service().HaalHoekenOpAsync(_k3a.Id));
    }

    [Fact]
    public async Task Overnemen_kopieert_en_slaat_over_wat_er_al_is()
    {
        var service = Service();
        await service.MaakHoekAsync(_k3a.Id, new HoekInvoer("boekenhoek", "vaste kast"));
        await service.MaakHoekAsync(_k3a.Id, new HoekInvoer("bouwhoek"));
        await service.MaakHoekAsync(_k3a.Id, new HoekInvoer("zandtafel"));

        // K3 blauw already has one of the three, spelled differently. It is skipped, and it is NAMED, because
        // "1 overgeslagen" leaves a teacher wondering which one.
        await Service().MaakHoekAsync(_k3b.Id, new HoekInvoer("Bouwhoek"));

        var overname = await Service().NeemHoekenOverAsync(_k3b.Id, _k3a.Id);

        Assert.Equal(2, overname.Overgenomen.Count);
        Assert.Equal(["bouwhoek"], overname.Overgeslagen);
        Assert.All(overname.Overgenomen, h => Assert.Equal(_k3b.Id, h.KlasId));

        var blauw = await Service().HaalHoekenOpAsync(_k3b.Id);
        Assert.Equal(["Bouwhoek", "boekenhoek", "zandtafel"], blauw.Select(h => h.Naam).Order(StringComparer.Ordinal));
    }

    [Fact]
    public async Task Een_overgenomen_hoek_staat_los_van_het_origineel()
    {
        var origineel = await Service().MaakHoekAsync(_k3a.Id, new HoekInvoer("boekenhoek", "vaste kast"));
        var overname = await Service().NeemHoekenOverAsync(_k3b.Id, _k3a.Id);
        var kopie = Assert.Single(overname.Overgenomen);

        Assert.NotEqual(origineel.Id, kopie.Id);

        await Service().WijzigHoekAsync(kopie.Id, new HoekInvoer("leeshoek", null));

        // THE POINT OF THE FEATURE: K3 blauw now owns its list. If these rows were ever shared, this assertion is
        // the one that fails, and one teacher's rename would have rewritten another teacher's classroom.
        var groen = Assert.Single(await Service().HaalHoekenOpAsync(_k3a.Id));
        Assert.Equal("boekenhoek", groen.Naam);
        Assert.Equal("vaste kast", groen.Omschrijving);
    }

    [Fact]
    public async Task Hoeken_van_je_eigen_klas_overnemen_slaat_nergens_op()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().NeemHoekenOverAsync(_k3a.Id, _k3a.Id));

        Assert.Contains("andere klas", fout.Message);
    }
}
