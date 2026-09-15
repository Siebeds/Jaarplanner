using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.PlanningBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// <see cref="LeerlingBeheerService"/> and the two klas guards FB-001 adds to <see cref="KlasBeheerService"/>, over the
/// in-memory provider. The rights and the Restrict FK are PostgreSQL's and the API's to prove
/// (<c>LeerlingEndpointsTests</c>); what is pinned here is the roll order, D9 for everyone, and that every refusal is the
/// teacher's sentence and names no child. All names are made up.
/// </summary>
public sealed class LeerlingBeheerServiceTests
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Guid _k3;
    private readonly Guid _k2;

    public LeerlingBeheerServiceTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"leerlingen_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);
        var schooljaar = new Schooljaar("2026-2027", new DateOnly(2026, 8, 31), new DateOnly(2027, 6, 30));
        var k3 = schooljaar.VoegKlasToe("K3 groen", "K3");
        var k2 = schooljaar.VoegKlasToe("K2 rood", "K2");
        seed.Schooljaren.Add(schooljaar);
        seed.SaveChanges();

        _k3 = k3.Id;
        _k2 = k2.Id;
    }

    private LeerlingBeheerService Service() => new(new AppDbContext(_options));

    private KlasBeheerService Klassen() => new(new AppDbContext(_options));

    [Fact]
    public async Task De_lijst_staat_op_voornaam_dan_achternaam_zonder_op_hoofdletters_te_letten()
    {
        await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("Staf", "Voorbeeld"));
        await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("Fien", "Testkind"));
        await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("fien", "Proefmans"));
        await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("Émile", "Voorbeeld"));

        var lijst = await Service().HaalLeerlingenOpAsync(_k3);

        // Case-insensitive (an ordinal sort would put "fien" after "Staf"), and an accented initial beside its letter.
        Assert.Equal(
            ["Émile Voorbeeld", "fien Proefmans", "Fien Testkind", "Staf Voorbeeld"],
            lijst.Select(l => $"{l.Voornaam} {l.Achternaam}"));
        Assert.All(lijst, l => Assert.Equal(_k3, l.KlasId));
    }

    [Fact]
    public async Task Een_kind_wordt_getrimd_bewaard_hernoemd_en_verwijderd()
    {
        var staf = await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("  Staf ", " Voorbeeld "));
        Assert.Equal(("Staf", "Voorbeeld"), (staf.Voornaam, staf.Achternaam));

        var stef = await Service().WijzigLeerlingAsync(staf.Id, new LeerlingInvoer("Stef", "Voorbeeld"));
        Assert.Equal(staf.Id, stef.Id);
        Assert.Equal("Stef", Assert.Single(await Service().HaalLeerlingenOpAsync(_k3)).Voornaam);

        await Service().VerwijderLeerlingAsync(staf.Id);
        Assert.Empty(await Service().HaalLeerlingenOpAsync(_k3));
    }

    [Fact]
    public async Task Een_klas_die_geen_K3_geeft_krijgt_geen_kinderen()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().MaakLeerlingAsync(_k2, new LeerlingInvoer("Fien", "Proefmans")));

        Assert.Equal("Alleen een klas van de derde kleuter kan kinderen hebben.", fout.Message);
        await using var context = new AppDbContext(_options);
        Assert.False(await context.Leerlingen.AnyAsync());
    }

    [Theory]
    [InlineData(null, "Proefmans", "Vul een voornaam in.")]
    [InlineData("  ", "Proefmans", "Vul een voornaam in.")]
    [InlineData("Fien", null, "Vul een achternaam in.")]
    [InlineData("Fien", "", "Vul een achternaam in.")]
    [InlineData("lang", "Proefmans", "Een voornaam is hoogstens 100 tekens lang.")]
    [InlineData("Fien", "lang", "Een achternaam is hoogstens 100 tekens lang.")]
    public async Task Een_ontbrekende_of_te_lange_naam_krijgt_de_zin_voor_de_leerkracht(
        string? voornaam,
        string? achternaam,
        string zin)
    {
        // "lang" stands for 101 characters, so the data row stays readable.
        static string? Vul(string? waarde) => waarde == "lang" ? "Fien" + new string('e', 97) : waarde;
        var invoer = new LeerlingInvoer(Vul(voornaam), Vul(achternaam));
        var bestaand = await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("Staf", "Voorbeeld"));

        var maak = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().MaakLeerlingAsync(_k3, invoer));
        var wijzig = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().WijzigLeerlingAsync(bestaand.Id, invoer));

        Assert.Equal(zin, maak.Message);
        Assert.Equal(zin, wijzig.Message);
        Assert.DoesNotContain("Fien", maak.Message, StringComparison.Ordinal);
        Assert.Equal("Staf", Assert.Single(await Service().HaalLeerlingenOpAsync(_k3)).Voornaam);
    }

    [Fact]
    public async Task Een_onbekende_klas_of_een_verdwenen_kind_is_niet_gevonden()
    {
        var onbekend = Guid.NewGuid();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => Service().HaalLeerlingenOpAsync(onbekend));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().MaakLeerlingAsync(onbekend, new LeerlingInvoer("Fien", "Proefmans")));

        var wijzig = await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().WijzigLeerlingAsync(onbekend, new LeerlingInvoer("Fien", "Proefmans")));
        var verwijder = await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => Service().VerwijderLeerlingAsync(onbekend));

        Assert.Equal("Dit kind is niet gevonden.", wijzig.Message);
        Assert.Equal(wijzig.Message, verwijder.Message);
    }

    // --- The klas guards (D9, and the Restrict FK the klas delete would otherwise hit). ---

    [Fact]
    public async Task Een_klas_met_kinderen_wordt_niet_verwijderd_en_zonder_wel()
    {
        var fien = await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("Fien", "Proefmans"));
        await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("Staf", "Voorbeeld"));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Klassen().VerwijderKlasAsync(_k3));

        Assert.Equal(
            "Klas 'K3 groen' heeft nog 2 kind(eren) in het ontwikkelingsrapport en kan niet verwijderd worden. "
            + "Verwijder die kinderen eerst bij Ontwikkelingsrapport.",
            fout.Message);
        Assert.DoesNotContain("Fien", fout.Message, StringComparison.Ordinal);

        foreach (var leerling in await Service().HaalLeerlingenOpAsync(_k3))
        {
            await Service().VerwijderLeerlingAsync(leerling.Id);
        }

        await Klassen().VerwijderKlasAsync(_k3);
        await using var context = new AppDbContext(_options);
        Assert.False(await context.Klassen.AnyAsync(k => k.Id == _k3));
        Assert.False(await context.Leerlingen.AnyAsync(l => l.Id == fien.Id));
    }

    [Fact]
    public async Task Een_klas_met_kinderen_blijft_een_klas_van_de_derde_kleuter()
    {
        await Service().MaakLeerlingAsync(_k3, new LeerlingInvoer("Fien", "Proefmans"));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Klassen().WijzigKlasAsync(_k3, new KlasCreatie("K3 groen", "K2")));

        Assert.Equal(
            "Klas 'K3 groen' heeft nog 1 kind(eren) in het ontwikkelingsrapport. Een klas met kinderen blijft een klas "
            + "van de derde kleuter. Verwijder die kinderen eerst bij Ontwikkelingsrapport.",
            fout.Message);

        // Renaming while it stays K3 is fine.
        var hernoemd = await Klassen().WijzigKlasAsync(_k3, new KlasCreatie("K3 groen A", "K3"));
        Assert.Equal("K3 groen A", hernoemd.Naam);
        Assert.Equal("K3", hernoemd.Jaarfase);
    }

    [Fact]
    public async Task Een_klas_zonder_kinderen_verandert_vrij_van_jaarfase()
    {
        var gewijzigd = await Klassen().WijzigKlasAsync(_k3, new KlasCreatie("K3 groen", "K2"));

        Assert.Equal("K2", gewijzigd.Jaarfase);
    }
}
