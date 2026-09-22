using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Kat.Detectoren;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// "Plaats subthema ..." (FB-069, ADR-0059 D4). Without a database and without an AI client.
/// </summary>
public sealed class SubthemaNietGeplandDetectorTests
{
    private static readonly Guid Water = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000001");
    private static readonly Guid Drijven = Guid.Parse("bbbbbbbb-0000-0000-0000-000000000002");

    // Tuesday. Friday 25 September is four schooldagen away, counting today.
    private static readonly DateOnly Vandaag = new(2026, 9, 22);

    private static readonly DateOnly OverVierSchooldagen = new(2026, 9, 25);

    private static readonly DateOnly VerWeg = new(2026, 11, 30);

    private static SubthemaNietGeplandDetector Detector(
        IEnumerable<ThemaplaatsingWeergave> plaatsingen,
        params Katsubthema[] subthemas) =>
        new(
            new NepJaarplanlezer(Detectorbouw.Plan(plaatsingen: plaatsingen)),
            new NepKatplanbron { Subthemas = [.. subthemas], Schooljaar = Detectorbouw.Schooljaar() });

    private static Katsubthema Subthema(string leeftijd = "K3", bool isGepland = false, params string[] codes) =>
        new(Drijven, Water, "Drijven en zinken", leeftijd, isGepland, codes.Length > 0 ? codes : ["N-01"]);

    private static Katcontext Context(IReadOnlyList<string>? leeftijden = null, params (string Code, bool Gedekt)[] doelen) =>
        Detectorbouw.Context(
            Detectorbouw.Dekking(doelen: (doelen.Length > 0 ? doelen : [("N-01", false)])
                .Select(d => Detectorbouw.Leerplandoel(d.Code, d.Gedekt))),
            Vandaag,
            leeftijden);

    [Fact]
    public async Task Een_thema_dat_bijna_afloopt_met_een_ongepland_subthema_levert_plaats_subthema_op()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen)],
            Subthema());

        var vondst = Assert.Single(await detector.DetecteerAsync(Context(), CancellationToken.None));

        Assert.Equal(Signaalsoort.SubthemaNietGepland, vondst.Soort);
        Assert.Equal(Drijven.ToString(), vondst.Sleutel);
        Assert.Equal("Drijven en zinken", vondst.Gegevens[SubthemaNietGeplandDetector.Sleutels.Subthema]);
        Assert.Equal("Water", vondst.Gegevens[SubthemaNietGeplandDetector.Sleutels.Thema]);
        Assert.Equal<IReadOnlyList<string>>(
            ["N-01"],
            (IReadOnlyList<string>)vondst.Gegevens[SubthemaNietGeplandDetector.Sleutels.Doelen]);
        Assert.Equal(1, vondst.Gegevens[SubthemaNietGeplandDetector.Sleutels.AantalDoelen]);
    }

    [Fact]
    public async Task Een_thema_dat_nog_lang_loopt_levert_niets_op()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), VerWeg)],
            Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_subthema_dat_al_in_de_agenda_staat_levert_niets_op()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen)],
            Subthema(isGepland: true));

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_subthema_van_een_andere_leeftijd_levert_niets_op()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen)],
            Subthema(leeftijd: "K2"));

        Assert.Empty(await detector.DetecteerAsync(Context(["K3"]), CancellationToken.None));
    }

    [Fact]
    public async Task Een_klas_waarvan_de_leeftijd_niet_af_te_leiden_is_verbreedt_in_plaats_van_te_zwijgen()
    {
        // Art. XIV, the graadklas: null means "cannot derive". The dekking widens and says so; so does the cat,
        // because a signal about a subthema of another leeftijd beats silence about her own.
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen)],
            Subthema(leeftijd: "K2"));
        var context = Detectorbouw.ContextZonderLeeftijd(
            Detectorbouw.Dekking(doelen: [Detectorbouw.Leerplandoel("N-01", isGedekt: false)]),
            Vandaag);

        Assert.Single(await detector.DetecteerAsync(context, CancellationToken.None));
    }

    [Fact]
    public async Task Een_subthema_waarvan_alles_al_gedekt_is_levert_niets_op()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen)],
            Subthema(codes: "N-01"));

        Assert.Empty(await detector.DetecteerAsync(Context(null, ("N-01", true)), CancellationToken.None));
    }

    [Fact]
    public async Task Alleen_de_doelen_die_nog_niet_gedekt_zijn_worden_genoemd()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen)],
            Subthema(codes: ["N-01", "N-02"]));

        var vondst = Assert.Single(
            await detector.DetecteerAsync(Context(null, ("N-01", true), ("N-02", false)), CancellationToken.None));

        Assert.Equal<IReadOnlyList<string>>(
            ["N-02"],
            (IReadOnlyList<string>)vondst.Gegevens[SubthemaNietGeplandDetector.Sleutels.Doelen]);
    }

    [Fact]
    public async Task Een_vervallen_plaatsing_is_geen_periode()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen, isVervallen: true)],
            Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_deel_dat_afloopt_voor_een_vakantie_laat_het_thema_niet_aflopen()
    {
        // ADR-0053: a vacation stores one thema as several placements. The teacher reads the whole run as one thema,
        // so warning her when the first part ends would fire in the middle of a thema with weeks to go.
        var reeks = new ReeksWeergave(1, 2, new DateOnly(2026, 9, 1), VerWeg, 8, false, false);
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen, reeks: reeks)],
            Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task Een_geweigerde_plaatsing_is_geen_periode()
    {
        // Nothing is taught on its account, so it can neither run nor end.
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen, status: "Geweigerd")],
            Subthema());

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }

    [Fact]
    public async Task De_melding_wijst_naar_de_periodes_van_het_jaarplan()
    {
        var detector = Detector(
            [Detectorbouw.Plaatsing(Water, "Water", new DateOnly(2026, 9, 1), OverVierSchooldagen)],
            Subthema());

        var vondst = Assert.Single(await detector.DetecteerAsync(Context(), CancellationToken.None));

        // A route the frontend router actually has: the klas comes from the klasfilter, not from the path.
        Assert.Equal("/agenda/periodes", vondst.Verwijzing);
    }

    [Fact]
    public async Task Zonder_schooljaar_zwijgt_de_detector()
    {
        var detector = new SubthemaNietGeplandDetector(
            new NepJaarplanlezer(Detectorbouw.Plan()),
            new NepKatplanbron { Schooljaar = null });

        Assert.Empty(await detector.DetecteerAsync(Context(), CancellationToken.None));
    }
}
