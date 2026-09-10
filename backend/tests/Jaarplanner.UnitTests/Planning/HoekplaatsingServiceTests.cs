using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// <see cref="HoekplaatsingService"/> against a real service over the in-memory provider (owner, 2026-08-30).
/// <para>
/// <b>The test that carries the feature is the one about which days get a timetable row.</b> A hoek that takes
/// the third lesuur takes it on the days the class is in front of the teacher, so a placement over a fortnight
/// must skip the weekends and the vakantie inside it. Writing one row per calendar day would put a lesson on a
/// Saturday, and nothing else in this file would notice.
/// </para>
/// </summary>
public sealed class HoekplaatsingServiceTests
{
    // A Monday, so the arithmetic in the assertions below is readable.
    private static readonly DateOnly Start = new(2026, 8, 31);
    private static readonly DateOnly Eind = new(2027, 6, 30);

    private readonly DbContextOptions<AppDbContext> _options;
    private readonly Guid _klasId;
    private readonly Guid _andereKlasId;
    private readonly Guid _hoekId;
    private readonly Guid _hoekVanAndereKlasId;

    public HoekplaatsingServiceTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"hoekplaatsing_{Guid.NewGuid():N}")
            .Options;

        using var seed = new AppDbContext(_options);

        var schooljaar = new Schooljaar("2026-2027", Start, Eind);
        // A week off in the middle of the first placement window below, so "open weekdays" has something to skip
        // besides the weekend.
        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfst", new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 11)));

        var klas = schooljaar.VoegKlasToe("K3 groen", "K3");
        var andere = schooljaar.VoegKlasToe("K3 blauw", "K3");
        seed.Schooljaren.Add(schooljaar);

        var hoek = new Hoek(klas.Id, "boekenhoek", "vaste kast");
        var vreemde = new Hoek(andere.Id, "bouwhoek");
        seed.Hoeken.AddRange(hoek, vreemde);
        seed.SaveChanges();

        _klasId = klas.Id;
        _andereKlasId = andere.Id;
        _hoekId = hoek.Id;
        _hoekVanAndereKlasId = vreemde.Id;
    }

    private HoekplaatsingService Service() => new(new AppDbContext(_options));

    [Fact]
    public async Task Een_plaatsing_bewaart_de_periode_en_de_naam_van_de_hoek()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18)));

        Assert.Equal("boekenhoek", plaatsing.HoekNaam);
        Assert.Equal(new DateOnly(2026, 9, 1), plaatsing.Van);
        Assert.Equal(new DateOnly(2026, 9, 18), plaatsing.Tot);
        Assert.Empty(plaatsing.Verrijkingen);
        Assert.Empty(plaatsing.Momenten);
    }

    [Fact]
    public async Task Een_lesuur_levert_een_rij_per_open_weekdag_en_slaat_weekends_en_vakantie_over()
    {
        // 1 september 2026 is a Tuesday. The window runs to Friday 18 september, so on a calendar it is 18 days:
        // 14 weekdays, of which 5 fall in the Herfst closure seeded above. Nine lessons remain.
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18), Lesuur: 2));

        Assert.Equal(9, plaatsing.Momenten.Count);
        Assert.All(plaatsing.Momenten, m => Assert.Equal(2, m.Volgorde));

        // No weekend, and nothing inside the closure.
        Assert.All(plaatsing.Momenten, m => Assert.NotEqual(DayOfWeek.Saturday, m.Datum.DayOfWeek));
        Assert.All(plaatsing.Momenten, m => Assert.NotEqual(DayOfWeek.Sunday, m.Datum.DayOfWeek));
        Assert.DoesNotContain(plaatsing.Momenten, m => m.Datum >= new DateOnly(2026, 9, 7) && m.Datum <= new DateOnly(2026, 9, 11));

        // The first and the last are the days a teacher would name.
        Assert.Equal(new DateOnly(2026, 9, 1), plaatsing.Momenten[0].Datum);
        Assert.Equal(new DateOnly(2026, 9, 18), plaatsing.Momenten[^1].Datum);
    }

    [Fact]
    public async Task Zonder_lesuur_loopt_de_hoek_wel_maar_staat_hij_in_geen_enkel_uurrooster()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18)));

        Assert.Empty(plaatsing.Momenten);
        Assert.Equal(new DateOnly(2026, 9, 18), plaatsing.Tot);
    }

    [Fact]
    public async Task De_verrijking_uit_het_blad_loopt_over_het_hele_venster()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 18),
                Verrijking: "prentenboeken over de herfst"));

        var verrijking = Assert.Single(plaatsing.Verrijkingen);
        Assert.Equal("prentenboeken over de herfst", verrijking.Tekst);
        Assert.Equal(plaatsing.Van, verrijking.Van);
        Assert.Equal(plaatsing.Tot, verrijking.Tot);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Een_lege_verrijking_is_geen_verrijking(string tekst)
    {
        // Blank is an ordinary answer: the corner runs in december with nothing special in it. Storing "" would
        // record that she described it as nothing.
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4), Verrijking: tekst));

        Assert.Empty(plaatsing.Verrijkingen);
    }

    [Fact]
    public async Task Een_hoek_van_een_andere_klas_wordt_geweigerd_met_een_zin_die_dat_zegt()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().PlaatsAsync(
                _klasId,
                new HoekplaatsingInvoer(_hoekVanAndereKlasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4))));

        // Not a 404: the corner exists, it is in another classroom, and saying so lets the screen explain itself
        // rather than claim the row was deleted.
        Assert.Contains("andere klas", fout.Message);
    }

    [Fact]
    public async Task Een_periode_buiten_het_schooljaar_wordt_geweigerd()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().PlaatsAsync(
                _klasId,
                new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 8, 1), new DateOnly(2026, 9, 4))));

        Assert.Contains("schooljaar", fout.Message);
    }

    [Fact]
    public async Task Een_venster_dat_eindigt_voor_het_begint_wordt_geweigerd_als_een_400()
    {
        // The domain says it in Dutch; the service turns it into the app's own fault type so the shared handler
        // answers 400 rather than letting an ArgumentException become a 500.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().PlaatsAsync(
                _klasId,
                new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 18), new DateOnly(2026, 9, 1))));
    }

    [Fact]
    public async Task Het_bereik_leest_op_overlap_en_niet_op_startdatum()
    {
        await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30)));

        // A week in november, months after the placement began. Reading placements that START in the range would
        // draw nothing here, which is almost every screen.
        var gevonden = await Service().HaalVoorBereikAsync(
            _klasId, new DateOnly(2026, 11, 16), new DateOnly(2026, 11, 22));

        var plaatsing = Assert.Single(gevonden);
        Assert.Equal("boekenhoek", plaatsing.HoekNaam);
    }

    [Fact]
    public async Task Een_bereik_naast_de_plaatsing_levert_niets()
    {
        await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18)));

        var gevonden = await Service().HaalVoorBereikAsync(
            _klasId, new DateOnly(2026, 9, 19), new DateOnly(2026, 9, 25));

        Assert.Empty(gevonden);
    }

    [Fact]
    public async Task Het_bereik_van_een_andere_klas_ziet_deze_plaatsing_niet()
    {
        await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18)));

        Assert.Empty(await Service().HaalVoorBereikAsync(
            _andereKlasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18)));
    }

    [Fact]
    public async Task Verwijderen_neemt_de_verrijkingen_en_de_uurroosterrijen_mee()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 4),
                Verrijking: "prentenboeken",
                Lesuur: 1));

        Assert.NotEmpty(plaatsing.Momenten);

        await Service().VerwijderAsync(plaatsing.Id);

        await using var na = new AppDbContext(_options);
        Assert.Empty(await na.Hoekplaatsingen.ToListAsync());
        Assert.Empty(await na.Hoekverrijkingen.ToListAsync());
        Assert.Empty(await na.Hoekmomenten.ToListAsync());

        // And the hoek itself is untouched: she removed a run, not a corner.
        Assert.Equal(1, await na.Hoeken.CountAsync(h => h.Id == _hoekId));
    }

    [Fact]
    public async Task Een_onbekende_klas_geeft_niet_gevonden()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().HaalVoorBereikAsync(Guid.NewGuid(), Start, Eind));
    }

    /* ------------------------------------------------------------------------------------------------
       MOVING ONE APPEARANCE (owner, 2026-08-31)

       The point of the whole feature is in the first test: ONE row moves and its siblings do not. The
       rows are stored per day rather than derived exactly so that a teacher can say "on this one
       Thursday the bouwhoek happens after the break", and a move that dragged all of them along would
       make the storage pointless.
       ------------------------------------------------------------------------------------------------ */

    private async Task<HoekplaatsingWeergave> EenWeekIngepland(int lesuur = 1) =>
        await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 4),
                Lesuur: lesuur));

    [Fact]
    public async Task Verplaatst_een_moment_naar_een_ander_lesuur_en_laat_de_andere_dagen_staan()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        var na = await Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, dinsdag.Datum, 4);

        Assert.Equal(4, na.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1)).Volgorde);
        Assert.All(
            na.Momenten.Where(m => m.Datum != new DateOnly(2026, 9, 1)),
            m => Assert.Equal(1, m.Volgorde));
    }

    [Fact]
    public async Task Verplaatst_een_moment_naar_een_andere_dag_binnen_de_periode()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        var na = await Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, new DateOnly(2026, 9, 2), 4);

        // Two appearances on the Wednesday now, at different hours, which is a legal thing to want.
        var woensdag = na.Momenten.Where(m => m.Datum == new DateOnly(2026, 9, 2)).ToList();
        Assert.Equal(2, woensdag.Count);
        Assert.Equal([1, 4], woensdag.Select(m => m.Volgorde));
        Assert.DoesNotContain(na.Momenten, m => m.Datum == new DateOnly(2026, 9, 1));
    }

    [Fact]
    public async Task Weigert_een_moment_buiten_de_periode_van_de_hoek()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.First();

        // A 400 and not a 500: the day is a thing the teacher chose, so the refusal is hers to read.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, new DateOnly(2026, 10, 1), 1));
    }

    [Fact]
    public async Task Weigert_twee_keer_dezelfde_hoek_op_hetzelfde_lesuur_op_een_dag()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        // The Wednesday already has this hoek at lesuur 1, which is the one combination that means nothing.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, new DateOnly(2026, 9, 2), 1));
    }

    [Fact]
    public async Task Een_moment_dat_niet_bestaat_geeft_niet_gevonden()
    {
        var plaatsing = await EenWeekIngepland();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().VerplaatsMomentAsync(plaatsing.Id, Guid.NewGuid(), new DateOnly(2026, 9, 2), 4));
    }

    [Fact]
    public async Task Een_plaatsing_die_niet_bestaat_geeft_niet_gevonden()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().VerplaatsMomentAsync(Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 9, 2), 4));
    }

    /* ------------------------------------------------------------------------------------------------
       THE ENRICHMENT, AFTER IT IS SAVED (owner, 2026-08-31: "ik wil ook de verrijking kunnen aanpassen")

       It was write-once: the placement sheet took it on the way in and no verb reached it again, so a typo
       in the one field carrying the pedagogy was permanent unless the whole placement was deleted and
       redone. These cover the three ways it can change and the two the aggregate refuses.
       ------------------------------------------------------------------------------------------------ */

    [Fact]
    public async Task Herschrijft_een_verrijking()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 4),
                Verrijking: "prentenboeken"));
        var verrijking = Assert.Single(plaatsing.Verrijkingen);

        var na = await Service().WijzigVerrijkingAsync(
            plaatsing.Id,
            verrijking.Id,
            verrijking.Van,
            verrijking.Tot,
            "prentenboeken over de herfst");

        Assert.Equal("prentenboeken over de herfst", Assert.Single(na.Verrijkingen).Tekst);
    }

    [Fact]
    public async Task Verwijdert_een_verrijking_en_laat_de_plaatsing_staan()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 4),
                Verrijking: "prentenboeken",
                Lesuur: 1));

        var na = await Service().VerwijderVerrijkingAsync(plaatsing.Id, plaatsing.Verrijkingen[0].Id);

        Assert.Empty(na.Verrijkingen);
        // The run itself is untouched: she cleared what was in the corner, not the corner.
        Assert.Equal(4, na.Momenten.Count);
        Assert.Equal(new DateOnly(2026, 9, 1), na.Van);
    }

    [Fact]
    public async Task Voegt_een_tweede_verrijking_toe_voor_een_latere_stuk_van_de_periode()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 18),
                Verrijking: "prentenboeken"));
        var eerste = Assert.Single(plaatsing.Verrijkingen);

        // The first one shrinks to make room, which is the order a teacher does it in: she splits a window
        // she already wrote about.
        await Service().WijzigVerrijkingAsync(
            plaatsing.Id,
            eerste.Id,
            new DateOnly(2026, 9, 1),
            new DateOnly(2026, 9, 4),
            "prentenboeken");

        var na = await Service().VoegVerrijkingToeAsync(
            plaatsing.Id,
            new DateOnly(2026, 9, 14),
            new DateOnly(2026, 9, 18),
            "kastanjes en bladeren");

        Assert.Equal(2, na.Verrijkingen.Count);
        Assert.Equal(["prentenboeken", "kastanjes en bladeren"], na.Verrijkingen.Select(v => v.Tekst));
    }

    [Fact]
    public async Task Weigert_een_verrijking_die_over_een_andere_heen_valt()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 18),
                Verrijking: "prentenboeken"));

        // Two answers to "what is in the boekenhoek this week" is not a richer answer, it is an ambiguous
        // one, and the aggregate says so in Dutch.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VoegVerrijkingToeAsync(
                plaatsing.Id,
                new DateOnly(2026, 9, 14),
                new DateOnly(2026, 9, 18),
                "kastanjes"));
    }

    [Fact]
    public async Task Weigert_een_verrijking_buiten_de_periode_van_de_hoek()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4)));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VoegVerrijkingToeAsync(
                plaatsing.Id,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 10, 1),
                "kastanjes"));
    }

    [Fact]
    public async Task Een_verrijking_die_niet_bestaat_geeft_niet_gevonden()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4)));

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().VerwijderVerrijkingAsync(plaatsing.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task Houdt_de_verrijkingen_bij_een_verplaatst_moment()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(
                _hoekId,
                new DateOnly(2026, 9, 1),
                new DateOnly(2026, 9, 4),
                Verrijking: "prentenboeken",
                Lesuur: 1));

        // The answer carries the whole placement, so a verrijking missing from it would blank the detail sheet
        // the moment a teacher dragged a row.
        var na = await Service().VerplaatsMomentAsync(plaatsing.Id, plaatsing.Momenten.First().Id, new DateOnly(2026, 9, 3), 5);

        Assert.Equal("prentenboeken", Assert.Single(na.Verrijkingen).Tekst);
        Assert.Equal("boekenhoek", na.HoekNaam);
    }
}
