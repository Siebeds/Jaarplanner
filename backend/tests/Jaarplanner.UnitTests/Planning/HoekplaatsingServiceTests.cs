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
/// <b>The test that carries the feature is the one about which days get a timetable row.</b> A hoek that runs from
/// 13:30 runs then on the days the class is in front of the teacher, so a placement over a fortnight must skip the
/// weekends and the vakantie inside it. Writing one row per calendar day would put a lesson on a Saturday, and
/// nothing else in this file would notice.
/// </para>
/// </summary>
public sealed class HoekplaatsingServiceTests
{
    // A Monday, so the arithmetic in the assertions below is readable.
    private static readonly DateOnly Start = new(2026, 8, 31);
    private static readonly DateOnly Eind = new(2027, 6, 30);

    // Hoekenwerk after lunch. Every placement has a time since 2026-09-11 (ADR-0028), so every call below states one.
    private static readonly TimeOnly Begin = new(13, 30);
    private static readonly TimeOnly Einde = new(14, 20);

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

    /// <summary>The first week of the year, Tuesday to Friday: four teaching days, no closure.</summary>
    private HoekplaatsingInvoer EersteWeek() =>
        new(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4), Begin, Einde);

    /// <summary>TB-030: one day taken off leaves the rest of the run.</summary>
    [Fact]
    public async Task Een_dag_weghalen_laat_de_andere_dagen_van_de_hoek_staan()
    {
        var plaatsing = await Service().PlaatsAsync(_klasId, EersteWeek());
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        await Service().VerwijderMomentAsync(plaatsing.Id, dinsdag.Id);

        await using var context = new AppDbContext(_options);
        var bewaard = await context.Hoekplaatsingen.Include(p => p.Momenten).SingleAsync();
        Assert.Equal(
            [new DateOnly(2026, 9, 2), new DateOnly(2026, 9, 3), new DateOnly(2026, 9, 4)],
            bewaard.Momenten.Select(m => m.Datum).Order());
    }

    /// <summary>
    /// TB-030: the last day takes the run along, so the hoek no longer counts as standing in the agenda and can be
    /// deleted in Instellingen.
    /// </summary>
    [Fact]
    public async Task De_laatste_dag_weghalen_neemt_de_plaatsing_mee_en_een_onbekend_moment_is_niet_gevonden()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 1), Begin, Einde));
        var moment = Assert.Single(plaatsing.Momenten);

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            Service().VerwijderMomentAsync(plaatsing.Id, Guid.NewGuid()));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            Service().VerwijderMomentAsync(Guid.NewGuid(), moment.Id));

        await Service().VerwijderMomentAsync(plaatsing.Id, moment.Id);

        await using var context = new AppDbContext(_options);
        Assert.False(await context.Hoekplaatsingen.AnyAsync());
    }

    [Fact]
    public async Task Een_plaatsing_bewaart_de_periode_en_de_naam_van_de_hoek()
    {
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18), Begin, Einde));

        Assert.Equal("boekenhoek", plaatsing.HoekNaam);
        Assert.Equal(new DateOnly(2026, 9, 1), plaatsing.Van);
        Assert.Equal(new DateOnly(2026, 9, 18), plaatsing.Tot);
    }

    [Fact]
    public async Task Een_tijdstip_levert_een_rij_per_open_weekdag_en_slaat_weekends_en_vakantie_over()
    {
        // 1 september 2026 is a Tuesday. The window runs to Friday 18 september, so on a calendar it is 18 days:
        // 14 weekdays, of which 5 fall in the Herfst closure seeded above. Nine lessons remain.
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18), Begin, Einde));

        Assert.Equal(9, plaatsing.Momenten.Count);
        Assert.All(plaatsing.Momenten, m => Assert.Equal(Begin, m.Begin));
        Assert.All(plaatsing.Momenten, m => Assert.Equal(Einde, m.Einde));

        // No weekend, and nothing inside the closure.
        Assert.All(plaatsing.Momenten, m => Assert.NotEqual(DayOfWeek.Saturday, m.Datum.DayOfWeek));
        Assert.All(plaatsing.Momenten, m => Assert.NotEqual(DayOfWeek.Sunday, m.Datum.DayOfWeek));
        Assert.DoesNotContain(plaatsing.Momenten, m => m.Datum >= new DateOnly(2026, 9, 7) && m.Datum <= new DateOnly(2026, 9, 11));

        // The first and the last are the days a teacher would name.
        Assert.Equal(new DateOnly(2026, 9, 1), plaatsing.Momenten[0].Datum);
        Assert.Equal(new DateOnly(2026, 9, 18), plaatsing.Momenten[^1].Datum);
    }

    /// <summary>
    /// <b>The owner's ruling of 2026-09-11, pinned from the refusing side.</b> Every hoek gets a time, so every
    /// placement gets rows; a window holding no teaching day would be a placement with nowhere to appear. Both
    /// shapes of that window are covered: the closure week, and a bare weekend.
    /// </summary>
    [Theory]
    [InlineData(2026, 9, 7, 2026, 9, 11)]
    [InlineData(2026, 9, 5, 2026, 9, 6)]
    public async Task Een_periode_zonder_schooldag_wordt_geweigerd(int vj, int vm, int vd, int tj, int tm, int td)
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().PlaatsAsync(
                _klasId,
                new HoekplaatsingInvoer(_hoekId, new DateOnly(vj, vm, vd), new DateOnly(tj, tm, td), Begin, Einde)));

        Assert.Contains("schooldag", fout.Message);

        await using var na = new AppDbContext(_options);
        Assert.Empty(await na.Hoekplaatsingen.ToListAsync());
    }

    [Fact]
    public async Task Een_einde_voor_het_begin_wordt_geweigerd_als_een_400()
    {
        // The domain says it in Dutch; the service maps it, so the teacher sees her own mistake rather than a 500.
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().PlaatsAsync(
                _klasId,
                new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4), Einde, Begin)));

        Assert.Contains("einde", fout.Message);
    }

    [Fact]
    public async Task Een_hoek_van_een_andere_klas_wordt_geweigerd_met_een_zin_die_dat_zegt()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().PlaatsAsync(
                _klasId,
                new HoekplaatsingInvoer(
                    _hoekVanAndereKlasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4), Begin, Einde)));

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
                new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 8, 1), new DateOnly(2026, 9, 4), Begin, Einde)));

        Assert.Contains("schooljaar", fout.Message);
    }

    [Fact]
    public async Task Een_venster_dat_eindigt_voor_het_begint_wordt_geweigerd_als_een_400()
    {
        // The domain says it in Dutch; the service turns it into the app's own fault type so the shared handler
        // answers 400 rather than letting an ArgumentException become a 500. And it is THIS sentence the teacher
        // reads, not "no teaching day": a backwards window is checked before the days in it are counted.
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().PlaatsAsync(
                _klasId,
                new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 18), new DateOnly(2026, 9, 1), Begin, Einde)));

        Assert.Contains("hoekperiode", fout.Message);
    }

    [Fact]
    public async Task Het_bereik_leest_op_overlap_en_niet_op_startdatum()
    {
        await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30), Begin, Einde));

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
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18), Begin, Einde));

        var gevonden = await Service().HaalVoorBereikAsync(
            _klasId, new DateOnly(2026, 9, 19), new DateOnly(2026, 9, 25));

        Assert.Empty(gevonden);
    }

    [Fact]
    public async Task Het_bereik_van_een_andere_klas_ziet_deze_plaatsing_niet()
    {
        await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18), Begin, Einde));

        Assert.Empty(await Service().HaalVoorBereikAsync(
            _andereKlasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18)));
    }

    [Fact]
    public async Task Verwijderen_neemt_de_uurroosterrijen_mee_en_laat_de_verrijkingen_van_de_hoek_staan()
    {
        var plaatsing = await Service().PlaatsAsync(_klasId, EersteWeek());

        // A verrijking of this hoek for some subthemaperiode (FB-020). It belongs to the hoek and the subthema, not to
        // a run in the timetable, so taking the run out must leave it alone.
        await using (var seed = new AppDbContext(_options))
        {
            seed.Hoekverrijkingen.Add(new Hoekverrijking(_hoekId, Guid.NewGuid(), "prentenboeken"));
            await seed.SaveChangesAsync();
        }

        Assert.NotEmpty(plaatsing.Momenten);

        await Service().VerwijderAsync(plaatsing.Id);

        await using var na = new AppDbContext(_options);
        Assert.Empty(await na.Hoekplaatsingen.ToListAsync());
        Assert.Empty(await na.Hoekmomenten.ToListAsync());
        Assert.Equal("prentenboeken", Assert.Single(await na.Hoekverrijkingen.ToListAsync()).Tekst);

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
       make the storage pointless. Since ADR-0028 the same verb also resizes a row: dragging its bottom
       edge sends the same day and start with a new end.
       ------------------------------------------------------------------------------------------------ */

    private async Task<HoekplaatsingWeergave> EenWeekIngepland() =>
        await Service().PlaatsAsync(_klasId, EersteWeek());

    [Fact]
    public async Task Verplaatst_een_moment_naar_een_ander_uur_en_laat_de_andere_dagen_staan()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        var na = await Service().VerplaatsMomentAsync(
            plaatsing.Id, dinsdag.Id, dinsdag.Datum, new TimeOnly(10, 15), new TimeOnly(11, 5));

        var verplaatst = na.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));
        Assert.Equal(new TimeOnly(10, 15), verplaatst.Begin);
        Assert.Equal(new TimeOnly(11, 5), verplaatst.Einde);
        Assert.All(
            na.Momenten.Where(m => m.Datum != new DateOnly(2026, 9, 1)),
            m => Assert.Equal(Begin, m.Begin));
    }

    [Fact]
    public async Task Maakt_een_moment_langer_zonder_het_te_verplaatsen()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        // Same day, same start, later end: the bottom edge of the block dragged down. Refusing this as "that hoek
        // already starts there" would make every resize an error, because the row it compares against is itself.
        var na = await Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, dinsdag.Datum, Begin, new TimeOnly(15, 0));

        Assert.Equal(new TimeOnly(15, 0), na.Momenten.Single(m => m.Id == dinsdag.Id).Einde);
    }

    [Fact]
    public async Task Verplaatst_een_moment_naar_een_andere_dag_binnen_de_periode()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        var na = await Service().VerplaatsMomentAsync(
            plaatsing.Id, dinsdag.Id, new DateOnly(2026, 9, 2), new TimeOnly(9, 0), new TimeOnly(9, 50));

        // Two appearances on the Wednesday now, at different times, which is a legal thing to want.
        var woensdag = na.Momenten.Where(m => m.Datum == new DateOnly(2026, 9, 2)).ToList();
        Assert.Equal(2, woensdag.Count);
        Assert.Equal([new TimeOnly(9, 0), Begin], woensdag.Select(m => m.Begin));
        Assert.DoesNotContain(na.Momenten, m => m.Datum == new DateOnly(2026, 9, 1));
    }

    [Fact]
    public async Task Weigert_een_moment_buiten_de_periode_van_de_hoek()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.First();

        // A 400 and not a 500: the day is a thing the teacher chose, so the refusal is hers to read.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, new DateOnly(2026, 10, 1), Begin, Einde));
    }

    [Fact]
    public async Task Weigert_een_moment_op_een_dag_zonder_school_en_laat_het_staan()
    {
        // TB-011. Tuesday 1 to Friday 18 September holds a Saturday and the Herfst week seeded above, both inside the
        // window, so only the school year the service loads can refuse them.
        var plaatsing = await Service().PlaatsAsync(
            _klasId,
            new HoekplaatsingInvoer(_hoekId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18), Begin, Einde));
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        foreach (var dag in new[] { new DateOnly(2026, 9, 5), new DateOnly(2026, 9, 8) })
        {
            var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
                () => Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, dag, new TimeOnly(9, 0), new TimeOnly(9, 50)));
            Assert.Equal("Op die dag is er geen school. Kies een schooldag.", fout.Message);
        }

        // Nothing was saved: a fresh context still finds the row on its Tuesday at its own hours.
        var gelezen = await Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 18));
        var moment = Assert.Single(gelezen).Momenten.Single(m => m.Id == dinsdag.Id);
        Assert.Equal((new DateOnly(2026, 9, 1), Begin, Einde), (moment.Datum, moment.Begin, moment.Einde));
    }

    [Fact]
    public async Task Weigert_twee_keer_dezelfde_hoek_met_hetzelfde_begin_op_een_dag()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));

        // The Wednesday already has this hoek starting at 13:30, which is the one combination that means nothing.
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, new DateOnly(2026, 9, 2), Begin, Einde));
    }

    [Fact]
    public async Task Weigert_een_moment_dat_eindigt_voor_het_begint()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.First();

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, dinsdag.Datum, Einde, Begin));
    }

    /* ------------------------------------------------------------------------------------------------
       THE HOURS OF THE WHOLE RUN (owner, 2026-09-11: "ik wil op het detailscherm van de hoeken de
       mogelijkheid om de uren aan te passen"). Every day gets them, the ones moved by hand included,
       which is the owner's ruling of the same day.
       ------------------------------------------------------------------------------------------------ */

    [Fact]
    public async Task Zet_de_uren_van_elke_dag_ook_van_een_dag_die_apart_verlengd_was()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));
        await Service().VerplaatsMomentAsync(plaatsing.Id, dinsdag.Id, dinsdag.Datum, Begin, new TimeOnly(15, 0));

        var na = await Service().ZetUrenAsync(plaatsing.Id, new TimeOnly(9, 0), new TimeOnly(10, 30));

        Assert.Equal(4, na.Momenten.Count);
        Assert.All(na.Momenten, m => Assert.Equal(new TimeOnly(9, 0), m.Begin));
        Assert.All(na.Momenten, m => Assert.Equal(new TimeOnly(10, 30), m.Einde));

        // Saved, not only answered: a fresh context reads the same.
        var gelezen = await Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4));
        Assert.All(Assert.Single(gelezen).Momenten, m => Assert.Equal(new TimeOnly(10, 30), m.Einde));
    }

    [Fact]
    public async Task Weigert_nieuwe_uren_zolang_een_dag_de_hoek_twee_keer_heeft_en_laat_alles_staan()
    {
        var plaatsing = await EenWeekIngepland();
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == new DateOnly(2026, 9, 1));
        // Tuesday onto Wednesday morning, so Wednesday holds two appearances and Tuesday none.
        await Service().VerplaatsMomentAsync(
            plaatsing.Id, dinsdag.Id, new DateOnly(2026, 9, 2), new TimeOnly(9, 0), new TimeOnly(9, 50));

        // A 400 naming the day (owner ruling 2026-09-11), not a quiet fold into one row.
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().ZetUrenAsync(plaatsing.Id, new TimeOnly(9, 0), new TimeOnly(10, 30)));
        Assert.Contains("woensdag 2 september", fout.Message);

        var gelezen = await Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4));
        var momenten = Assert.Single(gelezen).Momenten;
        Assert.Equal(4, momenten.Count);
        Assert.Contains(momenten, m => m.Begin == new TimeOnly(9, 0) && m.Einde == new TimeOnly(9, 50));
    }

    [Fact]
    public async Task Weigert_uren_die_eindigen_voor_ze_beginnen_en_verandert_niets()
    {
        var plaatsing = await EenWeekIngepland();

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().ZetUrenAsync(plaatsing.Id, Einde, Begin));

        var gelezen = await Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 4));
        Assert.All(Assert.Single(gelezen).Momenten, m => Assert.Equal(Begin, m.Begin));
    }

    [Fact]
    public async Task Uren_voor_een_plaatsing_die_niet_bestaat_geven_niet_gevonden()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().ZetUrenAsync(Guid.NewGuid(), Begin, Einde));
    }

    [Fact]
    public async Task Een_moment_dat_niet_bestaat_geeft_niet_gevonden()
    {
        var plaatsing = await EenWeekIngepland();

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().VerplaatsMomentAsync(plaatsing.Id, Guid.NewGuid(), new DateOnly(2026, 9, 2), Begin, Einde));
    }

    [Fact]
    public async Task Een_plaatsing_die_niet_bestaat_geeft_niet_gevonden()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().VerplaatsMomentAsync(Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 9, 2), Begin, Einde));
    }
}
