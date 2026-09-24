using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Application.Planning.Weekplanning;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// <see cref="HoekverrijkingService"/> over the in-memory provider (FB-020, ADR-0041): a text per hoek and per
/// subthemaperiode of the klas.
/// <para>
/// <b>Storing a window is faked, and that is the one seam.</b> The service stores a missing window through
/// <see cref="IWeekplanningService.PlaatsSubthemaAsync"/>, whose own rules (the age, the clamp) have their own tests.
/// The fake stores the window as asked and counts its calls, so the rule that matters here can be seen: an existing
/// window over those days is USED, never moved.
/// </para>
/// </summary>
public sealed class HoekverrijkingServiceTests
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly VensterWeekplanning _weekplanning;
    private readonly Guid _klasId;
    private readonly Guid _andereKlasId;
    private readonly Guid _jaarplanId;
    private readonly Guid _boekenhoek;
    private readonly Guid _bouwhoek;
    private readonly Guid _zandtafel;
    private readonly Guid _hoekVanAndereKlas;
    private readonly Guid _herfst;
    private readonly Guid _winter;
    private readonly Guid _herfstVenster;

    public HoekverrijkingServiceTests()
    {
        _options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"hoekverrijking_{Guid.NewGuid():N}")
            .Options;
        _weekplanning = new VensterWeekplanning(_options);

        using var seed = new AppDbContext(_options);

        var schooljaar = TestSchooljaar.Maak();
        var klas = schooljaar.VoegKlasToe("K2 groen", "K2");
        var andere = schooljaar.VoegKlasToe("K2 blauw", "K2");
        seed.Schooljaren.Add(schooljaar);

        var boeken = new Hoek(klas.Id, "boekenhoek");
        var bouwen = new Hoek(klas.Id, "bouwhoek");
        var zand = new Hoek(klas.Id, "zandtafel");
        var vreemd = new Hoek(andere.Id, "boekenhoek");
        seed.Hoeken.AddRange(boeken, bouwen, zand, vreemd);

        var thema = new Thema("De seizoenen", 6);
        var herfst = thema.VoegSubthemaToe("De herfst", 2, "K2");
        var winter = thema.VoegSubthemaToe("De winter", 2, "K2");
        seed.Themas.Add(thema);

        var jaarplan = new Jaarplan(klas.Id);
        seed.Jaarplannen.Add(jaarplan);
        var venster = new Subthemaplaatsing(jaarplan.Id, herfst.Id, new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 25));
        seed.Subthemaplaatsingen.Add(venster);

        seed.SaveChanges();

        (_klasId, _andereKlasId, _jaarplanId) = (klas.Id, andere.Id, jaarplan.Id);
        (_boekenhoek, _bouwhoek, _zandtafel, _hoekVanAndereKlas) = (boeken.Id, bouwen.Id, zand.Id, vreemd.Id);
        (_herfst, _winter, _herfstVenster) = (herfst.Id, winter.Id, venster.Id);
    }

    // A fresh service over a fresh context per operation, mirroring the scoped-per-request lifetime.
    private HoekverrijkingService Service() => new(new AppDbContext(_options), _weekplanning);

    private HoekverrijkingenInvoer VoorHerfst(params HoekverrijkingTekst[] teksten) =>
        new(_herfstVenster, null, null, null, teksten);

    private Task<IReadOnlyList<SubthemaperiodeVerrijkingen>> LeesSeptember(Guid? klasId = null) =>
        Service().HaalVoorBereikAsync(klasId ?? _klasId, new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 31));

    [Fact]
    public async Task Bewaart_een_verrijking_per_hoek_en_leest_ze_terug_bij_het_venster()
    {
        var bewaard = await Service().BewaarAsync(_klasId, VoorHerfst(
            new HoekverrijkingTekst(_boekenhoek, "prentenboeken over de herfst"),
            new HoekverrijkingTekst(_bouwhoek, "  kastanjes en dennenappels  "),
            new HoekverrijkingTekst(_zandtafel, "")));

        Assert.Equal(_herfstVenster, bewaard.SubthemaperiodeId);
        Assert.Equal("De herfst", bewaard.SubthemaNaam);
        // A blank field is no verrijking: the zandtafel has nothing special this time, which is an ordinary answer.
        Assert.Equal(2, bewaard.Verrijkingen.Count);

        var venster = Assert.Single(await LeesSeptember());
        Assert.Equal((new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 25)), (venster.Van, venster.Tot));
        Assert.Equal("kastanjes en dennenappels", venster.Verrijkingen.Single(v => v.HoekId == _bouwhoek).Tekst);
    }

    [Fact]
    public async Task Opnieuw_bewaren_herschrijft_en_een_lege_tekst_haalt_de_verrijking_weg()
    {
        await Service().BewaarAsync(_klasId, VoorHerfst(
            new HoekverrijkingTekst(_boekenhoek, "prentenboeken"),
            new HoekverrijkingTekst(_bouwhoek, "kastanjes")));

        await Service().BewaarAsync(_klasId, VoorHerfst(
            new HoekverrijkingTekst(_boekenhoek, "prentenboeken en bladeren"),
            new HoekverrijkingTekst(_bouwhoek, "   ")));

        var verrijking = Assert.Single(Assert.Single(await LeesSeptember()).Verrijkingen);
        Assert.Equal((_boekenhoek, "prentenboeken en bladeren"), (verrijking.HoekId, verrijking.Tekst));

        // Rewritten in place, not added beside: one row per (hoek, window).
        await using var na = new AppDbContext(_options);
        Assert.Equal(1, await na.Hoekverrijkingen.CountAsync());
    }

    [Fact]
    public async Task Een_hoek_die_niet_in_het_verzoek_staat_blijft_zoals_hij_was()
    {
        // The hoek detail saves one hoek at a time; that must not clear the others of the same window.
        await Service().BewaarAsync(_klasId, VoorHerfst(
            new HoekverrijkingTekst(_boekenhoek, "prentenboeken"),
            new HoekverrijkingTekst(_bouwhoek, "kastanjes")));

        await Service().BewaarAsync(_klasId, VoorHerfst(new HoekverrijkingTekst(_bouwhoek, "dennenappels")));

        var verrijkingen = Assert.Single(await LeesSeptember()).Verrijkingen;
        Assert.Equal("prentenboeken", verrijkingen.Single(v => v.HoekId == _boekenhoek).Tekst);
        Assert.Equal("dennenappels", verrijkingen.Single(v => v.HoekId == _bouwhoek).Tekst);
    }

    [Fact]
    public async Task Een_volgende_subthemaperiode_begint_leeg_en_de_vorige_blijft_bewaard()
    {
        await Service().BewaarAsync(_klasId, VoorHerfst(new HoekverrijkingTekst(_boekenhoek, "herfstboeken")));

        await using (var seed = new AppDbContext(_options))
        {
            seed.Subthemaplaatsingen.Add(
                new Subthemaplaatsing(_jaarplanId, _winter, new DateOnly(2026, 9, 28), new DateOnly(2026, 10, 9)));
            await seed.SaveChangesAsync();
        }

        var vensters = await LeesSeptember();

        Assert.Equal(["De herfst", "De winter"], vensters.Select(v => v.SubthemaNaam));
        Assert.Equal("herfstboeken", Assert.Single(vensters[0].Verrijkingen).Tekst);
        Assert.Empty(vensters[1].Verrijkingen);
    }

    [Fact]
    public async Task Een_andere_klas_van_dezelfde_leeftijd_ziet_haar_eigen_verrijkingen_en_bereikt_deze_niet()
    {
        await Service().BewaarAsync(_klasId, VoorHerfst(new HoekverrijkingTekst(_boekenhoek, "herfstboeken")));

        // K2 blauw plans nothing yet, so it has no window, and it does not see K2 groen's.
        Assert.Empty(await LeesSeptember(_andereKlasId));

        // And K2 groen's window is not reachable through K2 blauw's route, not even with its own hoek.
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => Service().BewaarAsync(
            _andereKlasId,
            new HoekverrijkingenInvoer(_herfstVenster, null, null, null, [new HoekverrijkingTekst(_hoekVanAndereKlas, "x")])));
    }

    [Fact]
    public async Task Een_hoek_van_een_andere_klas_wordt_geweigerd_en_er_wordt_niets_bewaard()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().BewaarAsync(
            _klasId,
            new HoekverrijkingenInvoer(
                null,
                _winter,
                new DateOnly(2026, 9, 28),
                new DateOnly(2026, 10, 9),
                [new HoekverrijkingTekst(_boekenhoek, "winterboeken"), new HoekverrijkingTekst(_hoekVanAndereKlas, "sneeuw")])));

        Assert.Equal("Die hoek hoort bij een andere klas.", fout.Message);

        // Refused before the window was stored: no window, no text.
        Assert.Equal(0, _weekplanning.Aanroepen);
        await using var na = new AppDbContext(_options);
        Assert.Empty(await na.Hoekverrijkingen.ToListAsync());
    }

    [Fact]
    public async Task Een_onbekende_hoek_geeft_niet_gevonden()
    {
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().BewaarAsync(_klasId, VoorHerfst(new HoekverrijkingTekst(Guid.NewGuid(), "iets"))));
    }

    [Fact]
    public async Task Zonder_vastgelegde_periode_legt_de_service_ze_vast_zoals_de_agenda_ze_toont()
    {
        // The owner's ruling of 2026-09-15: the agenda draws De winter from its activiteiten alone, and writing a
        // verrijking there first stores the window as the agenda draws it.
        var bewaard = await Service().BewaarAsync(
            _klasId,
            new HoekverrijkingenInvoer(
                null,
                _winter,
                new DateOnly(2026, 9, 28),
                new DateOnly(2026, 10, 9),
                [new HoekverrijkingTekst(_boekenhoek, "winterboeken")]));

        Assert.Equal(1, _weekplanning.Aanroepen);
        Assert.Equal("De winter", bewaard.SubthemaNaam);
        Assert.Equal((new DateOnly(2026, 9, 28), new DateOnly(2026, 10, 9)), (bewaard.Van, bewaard.Tot));
        Assert.Equal("winterboeken", Assert.Single(bewaard.Verrijkingen).Tekst);
        Assert.NotEqual(_herfstVenster, bewaard.SubthemaperiodeId);
    }

    [Fact]
    public async Task Een_bestaande_periode_over_die_dagen_wordt_gebruikt_en_niet_verzet()
    {
        // The planner's route MOVES an overlapping window of the same subthema. Here that would make De herfst jump to
        // the days the agenda happened to draw, with every verrijking on it, so the existing window is used as it is.
        var bewaard = await Service().BewaarAsync(
            _klasId,
            new HoekverrijkingenInvoer(
                null,
                _herfst,
                new DateOnly(2026, 9, 21),
                new DateOnly(2026, 10, 2),
                [new HoekverrijkingTekst(_boekenhoek, "herfstboeken")]));

        Assert.Equal(0, _weekplanning.Aanroepen);
        Assert.Equal(_herfstVenster, bewaard.SubthemaperiodeId);
        Assert.Equal((new DateOnly(2026, 9, 14), new DateOnly(2026, 9, 25)), (bewaard.Van, bewaard.Tot));
    }

    [Fact]
    public async Task Zonder_periode_en_zonder_subthema_of_dagen_wordt_geweigerd()
    {
        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().BewaarAsync(
            _klasId,
            new HoekverrijkingenInvoer(null, _winter, null, null, [new HoekverrijkingTekst(_boekenhoek, "x")])));

        Assert.Equal(0, _weekplanning.Aanroepen);
    }

    [Fact]
    public async Task Een_te_lange_tekst_wordt_geweigerd_met_het_maximum_in_de_zin()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().BewaarAsync(
            _klasId,
            VoorHerfst(new HoekverrijkingTekst(_boekenhoek, new string('a', IHoekverrijkingService.MaximaleLengte + 1)))));

        Assert.Contains(IHoekverrijkingService.MaximaleLengte.ToString(), fout.Message);

        // Exactly the maximum is fine.
        await Service().BewaarAsync(
            _klasId,
            VoorHerfst(new HoekverrijkingTekst(_boekenhoek, new string('a', IHoekverrijkingService.MaximaleLengte))));
    }

    [Fact]
    public async Task Het_bereik_leest_op_overlap_en_weigert_een_bereik_dat_achteruit_loopt()
    {
        // A week in the middle of the window: a subthema that began the Monday before is still running.
        var midden = await Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 9, 21), new DateOnly(2026, 9, 27));
        Assert.Equal(_herfstVenster, Assert.Single(midden).SubthemaperiodeId);

        Assert.Empty(await Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 9, 26), new DateOnly(2026, 10, 2)));

        await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().HaalVoorBereikAsync(_klasId, new DateOnly(2026, 9, 27), new DateOnly(2026, 9, 21)));
        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => Service().HaalVoorBereikAsync(Guid.NewGuid(), new DateOnly(2026, 9, 21), new DateOnly(2026, 9, 27)));
    }

    [Fact]
    public async Task Telt_de_verrijkingen_van_een_subthema_over_alle_vensters()
    {
        await Service().BewaarAsync(_klasId, VoorHerfst(
            new HoekverrijkingTekst(_boekenhoek, "herfstboeken"),
            new HoekverrijkingTekst(_bouwhoek, "kastanjes")));
        await Service().BewaarAsync(
            _klasId,
            new HoekverrijkingenInvoer(
                null,
                _winter,
                new DateOnly(2026, 9, 28),
                new DateOnly(2026, 10, 9),
                [new HoekverrijkingTekst(_zandtafel, "sneeuw")]));

        Assert.Equal(2, await Service().TelVoorSubthemaAsync(_herfst));
        Assert.Equal(1, await Service().TelVoorSubthemaAsync(_winter));
        Assert.Equal(0, await Service().TelVoorSubthemaAsync(Guid.NewGuid()));
    }

    /// <summary>
    /// Stores a window the way the planner route would, minus its rules, and counts how often it was asked. Only
    /// <see cref="PlaatsSubthemaAsync"/> is reachable from <see cref="HoekverrijkingService"/>.
    /// </summary>
    internal sealed class VensterWeekplanning(DbContextOptions<AppDbContext> options) : IWeekplanningService
    {
        public int Aanroepen { get; private set; }

        public async Task<Weekplanningweergave> PlaatsSubthemaAsync(
            Guid klasId,
            Guid subthemaId,
            DateOnly van,
            DateOnly tot,
            CancellationToken cancellationToken = default)
        {
            Aanroepen++;
            await using var context = new AppDbContext(options);
            var jaarplan = await context.Jaarplannen.SingleAsync(j => j.KlasId == klasId, cancellationToken);
            context.Subthemaplaatsingen.Add(new Subthemaplaatsing(jaarplan.Id, subthemaId, van, tot));
            await context.SaveChangesAsync(cancellationToken);
            return new Weekplanningweergave(klasId, string.Empty, Guid.Empty, string.Empty, van, tot, [], []);
        }

        public Task<Weekplanningweergave> HaalWeekplanningAsync(
            Guid klasId, DateOnly van, DateOnly tot, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Activiteitplaatsingenweergave> HaalActiviteitplaatsingenAsync(
            Guid klasId, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Weekplanningweergave> PlanActiviteitAsync(
            Guid klasId, Guid activiteitId, DateOnly datum, TimeOnly begin, TimeOnly einde,
            Jaarplanner.Application.Toegang.Rechten? planner = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Weekplanningweergave> VerplaatsActiviteitAsync(
            Guid klasId, Guid plaatsingId, DateOnly datum, TimeOnly begin, TimeOnly einde,
            Jaarplanner.Application.Toegang.Rechten? planner = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Weekplanningweergave> VerwijderActiviteitplaatsingAsync(
            Guid klasId, Guid plaatsingId, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Subthemaweghaling> BekijkSubthemaWeghalingAsync(
            Guid klasId, Guid subthemaId, DateOnly van, DateOnly tot, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Weekplanningweergave> HaalSubthemaWegAsync(
            Guid klasId, Guid subthemaId, DateOnly van, DateOnly tot, CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Weekplanningweergave> BeslisVoorstelAsync(
            Guid klasId, Guid plaatsingId, bool aanvaard,
            Jaarplanner.Application.Toegang.Rechten? beslisser = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();

        public Task<Weekplanningweergave> AanvaardVoorstellenAsync(
            Guid klasId, DateOnly van, DateOnly tot,
            Jaarplanner.Application.Toegang.Rechten? beslisser = null,
            CancellationToken cancellationToken = default) =>
            throw new NotSupportedException();
    }
}
