using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Kat.Detectoren;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// "Er start een thema en deze discipline zit nergens in het aanbod" (FB-070, ADR-0060 G2, G3). Without a database and
/// <b>without an AI client</b>: what the cat notices is arithmetic (ADR-0059 K1); the AI only makes the content, and
/// that is <c>AanbodgatTaak</c>'s.
/// </summary>
public sealed class AanbodgatDetectorTests
{
    private static readonly Guid Water = Guid.Parse("cccccccc-0000-0000-0000-000000000001");
    private static readonly Guid Drijven = Guid.Parse("cccccccc-0000-0000-0000-000000000002");

    // Tuesday. Friday 25 September is three schooldagen away, counting from tomorrow.
    private static readonly DateOnly Vandaag = new(2026, 9, 22);

    private static readonly DateOnly OverDrieSchooldagen = new(2026, 9, 25);

    private static readonly DateOnly VerWeg = new(2026, 11, 30);

    [Fact]
    public async Task Een_thema_dat_bijna_start_met_een_aanbod_gat_levert_een_vondst_op()
    {
        var plaatsing = Detectorbouw.Plaatsing(Water, "Water", OverDrieSchooldagen, new DateOnly(2026, 10, 16));
        var detector = Detector([plaatsing], Subthema());

        var vondst = Assert.Single(await detector.DetecteerAsync(Context(), CancellationToken.None));

        Assert.Equal(Signaalsoort.Aanbodgat, vondst.Soort);

        // Keyed on the placement, which is what "once per placement" (G3) means.
        Assert.Equal(plaatsing.Id.ToString(), vondst.Sleutel);
        Assert.Equal("Water", vondst.Gegevens[AanbodgatDetector.Sleutels.Thema]);
        Assert.Equal("Natuur en techniek", vondst.Gegevens[AanbodgatDetector.Sleutels.Discipline]);
        Assert.Equal(2, vondst.Gegevens[AanbodgatDetector.Sleutels.AantalDoelen]);
        Assert.Equal(3, vondst.Gegevens[AanbodgatDetector.Sleutels.AantalInDiscipline]);
    }

    [Fact]
    public async Task Een_thema_dat_pas_veel_later_start_levert_niets_op()
    {
        var detector = Detector([Detectorbouw.Plaatsing(Water, "Water", VerWeg, VerWeg.AddDays(20))], Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_thema_dat_vandaag_start_levert_niets_op()
    {
        // It is running: preparing for it is no longer preparing (G3).
        var detector = Detector([Detectorbouw.Plaatsing(Water, "Water", Vandaag, Vandaag.AddDays(20))], Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_thema_zonder_subthema_op_de_leeftijd_van_de_klas_levert_niets_op()
    {
        // Every proposal goes under a subthema (D3), so a thema that offers none at this age has nowhere to put one.
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", OverDrieSchooldagen, new DateOnly(2026, 10, 16))],
            Subthema(leeftijd: "JK"));

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_klas_zonder_afleidbare_leeftijden_verbreedt_in_plaats_van_te_versmallen()
    {
        // Art. XIV, the graadklas: null means "do not narrow", exactly as the dekking widens.
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", OverDrieSchooldagen, new DateOnly(2026, 10, 16))],
            Subthema(leeftijd: "JK"));

        Assert.Single(await detector.DetecteerAsync(
            Detectorbouw.ContextZonderLeeftijd(Dekking(), Vandaag),
            CancellationToken.None));
    }

    [Fact]
    public async Task Zonder_aanbod_gat_levert_een_startend_thema_niets_op()
    {
        var detector = Detector([Detectorbouw.Plaatsing(Water, "Water", OverDrieSchooldagen, VerWeg)], Subthema());

        var context = Detectorbouw.Context(
            Detectorbouw.Dekking(doelen: [Detectorbouw.Leerplandoel("N-01", Dekkingsstap.Gedekt)]),
            Vandaag);

        Assert.Empty(await detector.DetecteerAsync(context, CancellationToken.None));
    }

    [Fact]
    public async Task Een_vervallen_of_geweigerde_plaatsing_telt_niet_als_een_start()
    {
        var detector = Detector(
            [
                Detectorbouw.Plaatsing(Water, "Water", OverDrieSchooldagen, VerWeg, isVervallen: true),
                Detectorbouw.Plaatsing(Guid.NewGuid(), "Herfst", OverDrieSchooldagen, VerWeg, status: "Geweigerd"),
            ],
            Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_vakantie_splitst_een_thema_en_alleen_het_begin_van_de_reeks_telt()
    {
        // ADR-0053: one thema, two stored parts. The second part starts soon, but the thema has been running for
        // weeks, so nothing is about to start.
        var reeks = new ReeksWeergave(2, 2, new DateOnly(2026, 9, 1), new DateOnly(2026, 10, 16), 6, false, false);
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", OverDrieSchooldagen, new DateOnly(2026, 10, 16), reeks: reeks)],
            Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Zonder_schooljaar_levert_de_detector_niets_op()
    {
        var detector = new AanbodgatDetector(
            new NepJaarplanlezer(Detectorbouw.Plan(plaatsingen:
                [Detectorbouw.Plaatsing(Water, "Water", OverDrieSchooldagen, VerWeg)])),
            new NepKatplanbron { Subthemas = [Subthema()], Schooljaar = null });

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    private static AanbodgatDetector Detector(
        IEnumerable<ThemaplaatsingWeergave> plaatsingen,
        params Katsubthema[] subthemas) =>
        new(
            new NepJaarplanlezer(Detectorbouw.Plan(plaatsingen: plaatsingen)),
            new NepKatplanbron { Subthemas = [.. subthemas], Schooljaar = Detectorbouw.Schooljaar() });

    private static Katsubthema Subthema(string leeftijd = "K3") =>
        new(Drijven, Water, "Drijven en zinken", leeftijd, IsGepland: false, ["N-03"]);

    /// <summary>Two of the three goals of discipline 9 are nowhere in the klas's aanbod.</summary>
    private static DekkingWeergave Dekking() =>
        Detectorbouw.Dekking(doelen:
        [
            Detectorbouw.Leerplandoel("N-01", Dekkingsstap.Geen),
            Detectorbouw.Leerplandoel("N-02", Dekkingsstap.Geen),
            Detectorbouw.Leerplandoel("N-03", Dekkingsstap.Gedekt),
        ]);

    private static Katcontext Context() => Detectorbouw.Context(Dekking(), Vandaag);
}
