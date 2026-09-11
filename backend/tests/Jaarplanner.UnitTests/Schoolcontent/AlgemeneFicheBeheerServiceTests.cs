using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.SchoolcontentBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// <see cref="AlgemeneFicheBeheerService"/> over the in-memory provider (owner, 2026-09-11). The FK behaviour (the
/// Restrict that makes the delete guard necessary, the FK to the leerplandoel) is real PostgreSQL's to prove; what is
/// pinned here is that the service refuses BEFORE the database would, with a sentence the teacher can act on.
/// </summary>
public sealed class AlgemeneFicheBeheerServiceTests
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Guid _klasId;

    public AlgemeneFicheBeheerServiceTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"algemene_fiches_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);

        var schooljaar = new Schooljaar("2026-2027", new DateOnly(2026, 8, 31), new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe("K3 groen", "K3");
        seed.Schooljaren.Add(schooljaar);

        seed.Leerplandoelen.AddRange(
            new Leerplandoel("LO-K3-01", Doelsoort.Minimumdoel, "K3", "Motoriek", "Grove motoriek", "6", tekst: "loopt, springt en klimt."),
            new Leerplandoel("LO-K3-02", Doelsoort.Gemeenschappelijk, "K3", "Motoriek", "Evenwicht", "6", tekst: "houdt evenwicht."));
        seed.SaveChanges();

        _klasId = klas.Id;
    }

    private AlgemeneFicheBeheerService Service() => new(new AppDbContext(_options));

    [Fact]
    public async Task Een_nieuwe_fiche_staat_in_de_lijst_van_haar_klas()
    {
        var fiche = await Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer(" turnen ", "in de zaal"));

        Assert.Equal("turnen", fiche.Naam);
        Assert.Equal(0, fiche.AantalPlaatsingen);
        Assert.Empty(fiche.Doelen);

        var lijst = await Service().HaalFichesOpAsync(_klasId);
        Assert.Equal(fiche.Id, Assert.Single(lijst).Id);
    }

    [Fact]
    public async Task Twee_fiches_met_dezelfde_naam_in_een_klas_worden_geweigerd_ook_bij_andere_hoofdletters()
    {
        await Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer("Turnen"));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() =>
            Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer("turnen")));
    }

    [Fact]
    public async Task Een_gekoppeld_doel_komt_terug_met_zijn_eigen_tekst()
    {
        var fiche = await Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer("turnen"));

        var na = await Service().KoppelAanDoelAsync(fiche.Id, "LO-K3-02");
        na = await Service().KoppelAanDoelAsync(fiche.Id, "LO-K3-01");

        Assert.Equal(["LO-K3-01", "LO-K3-02"], na.Doelen.Select(d => d.LeerplandoelCode));
        Assert.Equal("loopt, springt en klimt.", na.Doelen[0].Tekst);
        Assert.Equal(Doelsoort.Minimumdoel, na.Doelen[0].Doelsoort);

        await using var context = new AppDbContext(_options);
        var bewaard = await context.AlgemeneFiches.SingleAsync(f => f.Id == fiche.Id);
        Assert.All(bewaard.Doelkoppelingen, k => Assert.Equal(KoppelingStatus.Manueel, k.Status));
    }

    [Fact]
    public async Task Een_onbekende_code_of_een_dubbele_koppeling_wordt_geweigerd()
    {
        var fiche = await Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer("turnen"));
        await Service().KoppelAanDoelAsync(fiche.Id, "LO-K3-01");

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().KoppelAanDoelAsync(fiche.Id, "BESTAAT-NIET"));
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().KoppelAanDoelAsync(fiche.Id, "LO-K3-01"));
    }

    [Fact]
    public async Task Ontkoppelen_haalt_het_doel_weg_en_een_tweede_keer_is_niet_gevonden()
    {
        var fiche = await Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer("turnen"));
        var gekoppeld = await Service().KoppelAanDoelAsync(fiche.Id, "LO-K3-01");
        var koppelingId = gekoppeld.Doelen.Single().KoppelingId;

        var na = await Service().OntkoppelDoelAsync(fiche.Id, koppelingId);

        Assert.Empty(na.Doelen);
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => Service().OntkoppelDoelAsync(fiche.Id, koppelingId));
    }

    [Fact]
    public async Task Een_ingeplande_fiche_verwijderen_wordt_geweigerd_met_het_aantal()
    {
        var fiche = await Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer("turnen"));

        await using (var context = new AppDbContext(_options))
        {
            context.AlgemeneFicheplaatsingen.Add(
                new AlgemeneFicheplaatsing(_klasId, fiche.Id, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30)));
            await context.SaveChangesAsync();
        }

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().VerwijderFicheAsync(fiche.Id));
        Assert.Contains("1 keer in de agenda", fout.Message);

        var lijst = await Service().HaalFichesOpAsync(_klasId);
        Assert.Equal(1, Assert.Single(lijst).AantalPlaatsingen);
    }

    [Fact]
    public async Task Een_fiche_die_nergens_staat_kan_weg()
    {
        var fiche = await Service().MaakFicheAsync(_klasId, new AlgemeneFicheInvoer("onthaal"));

        await Service().VerwijderFicheAsync(fiche.Id);

        Assert.Empty(await Service().HaalFichesOpAsync(_klasId));
    }
}
