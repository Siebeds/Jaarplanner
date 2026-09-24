using Jaarplanner.Application.Planning.AlgemeneFiches;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// <see cref="AlgemeneFicheplaatsingService"/> over the in-memory provider (owner, 2026-09-11). What it adds to the
/// domain rule is the calendar lookup and the two checks only the service can make; the weekday arithmetic itself is
/// pinned in <see cref="AlgemeneFicheplaatsingTests"/>.
/// </summary>
public sealed class AlgemeneFicheplaatsingServiceTests
{
    private static readonly DateOnly Start = new(2026, 8, 31);
    private static readonly DateOnly Eind = new(2027, 6, 30);

    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Guid _klasId;
    private readonly Guid _ficheId;
    private readonly Guid _ficheVanAndereKlasId;

    public AlgemeneFicheplaatsingServiceTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"algemene_ficheplaatsing_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);

        var schooljaar = new Schooljaar("2026-2027", Start, Eind);
        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfst", new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 11)));
        var klas = schooljaar.VoegKlasToe("K3 groen", "K3");
        var andere = schooljaar.VoegKlasToe("K3 blauw", "K3");
        seed.Schooljaren.Add(schooljaar);

        var fiche = new AlgemeneFiche(klas.Id, "turnen");
        var vreemde = new AlgemeneFiche(andere.Id, "onthaal");
        seed.AlgemeneFiches.AddRange(fiche, vreemde);
        seed.SaveChanges();

        _klasId = klas.Id;
        _ficheId = fiche.Id;
        _ficheVanAndereKlasId = vreemde.Id;
    }

    private AlgemeneFicheplaatsingService Service() => new(new AppDbContext(_options));

    private static readonly TimeOnly Begin = new(10, 30);
    private static readonly TimeOnly Einde = new(11, 20);

    private static AlgemeneFicheplaatsingInvoer Invoer(Guid ficheId, DateOnly van, DateOnly tot, int[] weekdagen) =>
        new(ficheId, van, tot, weekdagen, Begin, Einde);

    /// <summary>
    /// FB-022: a day text through the service. It lands on that one occurrence and is persisted; an unknown placement or
    /// moment is a 404 and a text over the limit a Dutch 400, and a refusal leaves the saved text alone.
    /// </summary>
    [Fact]
    public async Task Een_dagtekst_wordt_bewaard_en_een_onbekend_moment_of_een_te_lange_tekst_geweigerd()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 18), [1, 2]));
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 15));

        var na = await Service().ZetMomenttekstAsync(plaatsing.Id, dinsdag.Id, "Kapla");
        Assert.Equal("Kapla", na.Momenten.Single(m => m.Id == dinsdag.Id).Tekst);
        Assert.Null(na.Momenten.Single(m => m.Id != dinsdag.Id).Tekst);

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            Service().ZetMomenttekstAsync(Guid.NewGuid(), dinsdag.Id, "Iets"));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            Service().ZetMomenttekstAsync(plaatsing.Id, Guid.NewGuid(), "Iets"));
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() =>
            Service().ZetMomenttekstAsync(plaatsing.Id, dinsdag.Id, new string('a', AlgemeneFichemoment.MaxTekstLengte + 1)));
        Assert.Contains("hoogstens 500 tekens", fout.Message);

        await using var context = new AppDbContext(_options);
        Assert.Equal("Kapla", (await context.AlgemeneFichemomenten.SingleAsync(m => m.Id == dinsdag.Id)).Tekst);
    }

    /// <summary>TB-030: one day taken off leaves the rest of the period, and its day text goes with it.</summary>
    [Fact]
    public async Task Een_dag_weghalen_laat_de_andere_dagen_van_de_periode_staan()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 18), [1, 2]));
        var maandag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 14));
        await Service().ZetMomenttekstAsync(plaatsing.Id, maandag.Id, "Kapla");

        await Service().VerwijderMomentAsync(plaatsing.Id, maandag.Id);

        await using var context = new AppDbContext(_options);
        var over = Assert.Single(await context.AlgemeneFichemomenten.ToListAsync());
        Assert.Equal(new DateOnly(2026, 9, 15), over.Datum);
        Assert.True(await context.AlgemeneFicheplaatsingen.AnyAsync(p => p.Id == plaatsing.Id));
    }

    /// <summary>
    /// TB-030: the last day takes the placement along. Dekking asks whether a placement row exists
    /// (<c>EfDekkingOpslag</c>), so the row being gone is the fiche no longer counting through this period.
    /// </summary>
    [Fact]
    public async Task De_laatste_dag_weghalen_neemt_de_plaatsing_mee()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 14), [1]));

        await Service().VerwijderMomentAsync(plaatsing.Id, Assert.Single(plaatsing.Momenten).Id);

        await using var context = new AppDbContext(_options);
        Assert.False(await context.AlgemeneFicheplaatsingen.AnyAsync());
        Assert.False(await context.AlgemeneFichemomenten.AnyAsync());
    }

    [Fact]
    public async Task Een_dag_weghalen_van_een_onbekende_plaatsing_of_een_onbekend_moment_is_niet_gevonden()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 14), [1]));
        var moment = Assert.Single(plaatsing.Momenten);

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            Service().VerwijderMomentAsync(Guid.NewGuid(), moment.Id));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            Service().VerwijderMomentAsync(plaatsing.Id, Guid.NewGuid()));

        await using var context = new AppDbContext(_options);
        Assert.Equal(1, await context.AlgemeneFichemomenten.CountAsync());
    }

    [Fact]
    public async Task Elke_maandag_levert_een_rij_per_maandag_met_school_op_het_gekozen_lesuur()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, new DateOnly(2026, 8, 31), new DateOnly(2026, 9, 30), [1]));

        Assert.Equal("turnen", plaatsing.FicheNaam);
        // 7 September is inside the Herfst closure.
        Assert.Equal(
            [new DateOnly(2026, 8, 31), new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 21), new DateOnly(2026, 9, 28)],
            plaatsing.Momenten.Select(m => m.Datum));
        Assert.All(plaatsing.Momenten, m => Assert.Equal((Begin, Einde), (m.Begin, m.Einde)));

        await using var context = new AppDbContext(_options);
        Assert.Equal(4, await context.AlgemeneFichemomenten.CountAsync());
    }

    [Fact]
    public async Task De_fiche_van_een_andere_klas_wordt_geweigerd()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheVanAndereKlasId, Start, new DateOnly(2026, 9, 30), [1])));

        Assert.Contains("andere klas", fout.Message);
    }

    [Fact]
    public async Task Een_periode_buiten_het_schooljaar_wordt_geweigerd()
    {
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, new DateOnly(2026, 8, 24), new DateOnly(2026, 9, 30), [1])));
    }

    [Fact]
    public async Task Een_weekenddag_of_een_onbekende_weekdag_wordt_geweigerd_als_400_niet_als_500()
    {
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, Start, new DateOnly(2026, 9, 30), [6])));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, Start, new DateOnly(2026, 9, 30), [9])));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().PlaatsAsync(
            _klasId,
            Invoer(_ficheId, Start, new DateOnly(2026, 9, 30), [])));
    }

    [Fact]
    public async Task Het_bereik_leest_elke_plaatsing_die_overlapt()
    {
        await Service().PlaatsAsync(_klasId, Invoer(_ficheId, Start, Eind, [1, 4]));

        var november = await Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 6));

        var plaatsing = Assert.Single(november);
        Assert.Equal(Start, plaatsing.Van);
    }

    [Fact]
    public async Task Verwijderen_neemt_alle_momenten_mee()
    {
        var plaatsing = await Service().PlaatsAsync(_klasId, Invoer(_ficheId, Start, new DateOnly(2026, 9, 30), [1]));

        await Service().VerwijderAsync(plaatsing.Id);

        await using var context = new AppDbContext(_options);
        Assert.Empty(await context.AlgemeneFicheplaatsingen.ToListAsync());
        Assert.Empty(await context.AlgemeneFichemomenten.ToListAsync());
    }

    [Fact]
    public async Task Een_moment_verplaatsen_antwoordt_met_de_hele_plaatsing()
    {
        var plaatsing = await Service().PlaatsAsync(_klasId, Invoer(_ficheId, Start, new DateOnly(2026, 9, 30), [1]));
        var eerste = plaatsing.Momenten[0];

        var later = new TimeOnly(13, 0);
        var laterEinde = new TimeOnly(13, 50);

        var na = await Service().VerplaatsMomentAsync(plaatsing.Id, eerste.Id, new DateOnly(2026, 9, 1), later, laterEinde);

        Assert.Equal(4, na.Momenten.Count);
        Assert.Contains(na.Momenten, m => m.Id == eerste.Id && m.Datum == new DateOnly(2026, 9, 1) && m.Begin == later && m.Einde == laterEinde);

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() =>
            Service().VerplaatsMomentAsync(plaatsing.Id, eerste.Id, new DateOnly(2026, 10, 5), later, laterEinde));
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() =>
            Service().VerplaatsMomentAsync(plaatsing.Id, eerste.Id, new DateOnly(2026, 9, 1), laterEinde, later));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            Service().VerplaatsMomentAsync(plaatsing.Id, Guid.NewGuid(), new DateOnly(2026, 9, 1), later, laterEinde));
    }

    // FB-101: the hours of the whole period in one call, the days and their texts left alone (owner, 2026-09-24).
    [Fact]
    public async Task Uren_van_de_hele_periode_gelden_voor_elke_dag_ook_een_apart_verschoven_dag_en_de_teksten_blijven()
    {
        var plaatsing = await Service().PlaatsAsync(_klasId, Invoer(_ficheId, Start, new DateOnly(2026, 9, 30), [1]));
        var eerste = plaatsing.Momenten.OrderBy(m => m.Datum).First();
        await Service().ZetMomenttekstAsync(plaatsing.Id, eerste.Id, "Kapla");
        // One Monday moved to the Tuesday afternoon by hand: it keeps its Tuesday and gets the new hours.
        await Service().VerplaatsMomentAsync(plaatsing.Id, eerste.Id, eerste.Datum.AddDays(1), new TimeOnly(14, 0), new TimeOnly(14, 50));
        var dagenVoor = plaatsing.Momenten.Select(m => m.Id == eerste.Id ? eerste.Datum.AddDays(1) : m.Datum).OrderBy(d => d).ToList();

        var na = await Service().ZetUrenAsync(plaatsing.Id, new TimeOnly(13, 0), new TimeOnly(13, 50));

        Assert.Equal(4, na.Momenten.Count);
        Assert.All(na.Momenten, m => Assert.Equal((new TimeOnly(13, 0), new TimeOnly(13, 50)), (m.Begin, m.Einde)));
        Assert.Equal(dagenVoor, na.Momenten.Select(m => m.Datum).OrderBy(d => d).ToList());
        Assert.Equal("Kapla", na.Momenten.Single(m => m.Id == eerste.Id).Tekst);

        // Saved, not only answered: a fresh context reads the same.
        var gelezen = await Service().HaalVoorBereikAsync(_klasId, Start, new DateOnly(2026, 9, 30));
        Assert.All(Assert.Single(gelezen).Momenten, m => Assert.Equal(new TimeOnly(13, 50), m.Einde));
    }

    [Fact]
    public async Task Uren_van_de_hele_periode_weigeren_een_einde_voor_het_begin_en_een_dubbele_dag_en_laten_alles_staan()
    {
        var plaatsing = await Service().PlaatsAsync(_klasId, Invoer(_ficheId, Start, new DateOnly(2026, 9, 30), [1]));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().ZetUrenAsync(plaatsing.Id, Einde, Begin));

        // The first Monday dragged onto the second one, at another hour: that Monday now holds the run twice.
        var maandagen = plaatsing.Momenten.OrderBy(m => m.Datum).ToList();
        await Service().VerplaatsMomentAsync(plaatsing.Id, maandagen[0].Id, maandagen[1].Datum, new TimeOnly(14, 0), new TimeOnly(14, 50));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().ZetUrenAsync(plaatsing.Id, new TimeOnly(9, 0), new TimeOnly(9, 50)));
        Assert.Contains("maandag 14 september", fout.Message);

        var gelezen = await Service().HaalVoorBereikAsync(_klasId, Start, new DateOnly(2026, 9, 30));
        Assert.DoesNotContain(Assert.Single(gelezen).Momenten, m => m.Begin == new TimeOnly(9, 0));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => Service().ZetUrenAsync(Guid.NewGuid(), Begin, Einde));
    }
}
