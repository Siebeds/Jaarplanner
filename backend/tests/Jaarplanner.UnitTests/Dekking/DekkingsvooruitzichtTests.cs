using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// The dekkingsvooruitzicht (E3-03, FR-5.3): what a plan <b>would</b> cover if the teacher accepted everything
/// standing in it, beside what it covers today.
/// <para>
/// <b>The property these tests exist to pin is that the two figures come apart in exactly one direction.</b> A fresh
/// generation covers nothing (every placement is <c>voorgesteld</c>, Art. IV.1/V.1) while its ceiling can be high;
/// accepting raises the first towards the second; and no state may ever put the ceiling below the real figure. Each
/// of those is a separate test, because a single "it works" test over one plan would pass on a service that returned
/// the same number twice.
/// </para>
/// <para>
/// No database and no network: the plan comes from <see cref="FakeJaarplanLezer"/> and the links from
/// <see cref="FakeDekkingOpslag"/> with its per-thema mode, which is what lets a test say "thema A carries this doel
/// and thema B that one" and therefore observe which set was counted. The SQL side of the same reads is covered
/// against real PostgreSQL by <c>DekkingLagenPostgresTests</c> and <c>JaarplanGeneratieEndpointTests</c> (E7-16: a
/// database path verified only in memory is not verified).
/// </para>
/// <para>
/// The fixtures here are deliberately this file's own rather than shared with <c>DekkingServiceTests</c>: those
/// arrange one placement to isolate one coverage rule, these arrange two thema's with disjoint doelen to make the
/// gap between the figures visible. Sharing one builder would have meant a parameter for every case in both files.
/// </para>
/// </summary>
public sealed class DekkingsvooruitzichtTests
{
    private static readonly Guid KlasId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid HerfstId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid WinterId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");

    /// <summary>A kleutergroep, so the production default (<c>EigenJaarFase</c>) resolves rather than falls back.</summary>
    private const int KleuterLeerjaar = 0;

    [Fact]
    public async Task Een_vers_gegenereerd_plan_dekt_niets_en_dat_is_precies_wat_het_vooruitzicht_zichtbaar_maakt()
    {
        // The state E3-03's acceptance criterion could not be written against: a run has just placed two thema's, both
        // `voorgesteld`, so the real figure is 0 and stays 0 until a human acts (Art. IV.1). The vooruitzicht is what
        // says the proposal is nevertheless worth something.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Voorgesteld),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02"), Doel("NAT-K3-03")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(2, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(3, vooruitzicht.AantalLeerplandoelen);

        // The two derived figures, which are what the panel actually renders: accepting everything gains two doelen
        // and still leaves one that no placed thema carries at all.
        Assert.Equal(2, vooruitzicht.AantalWinstBijAanvaarden);
        Assert.Equal(1, vooruitzicht.AantalOnbereikbaar);
    }

    [Fact]
    public async Task Het_gedekte_cijfer_is_hetzelfde_getal_als_de_dekkingsberekening_geeft()
    {
        // The anti-drift test, and the reason BerekenVooruitzichtAsync lives on this service rather than beside the
        // generator: the decided half must be the SAME rule, not a similar one. Both methods are called on one
        // arrangement and their figures compared, so a future edit to either that changes what counts fails here
        // rather than only on a screen. One accepted thema, one open proposal: the two figures must differ from each
        // other and the decided one must match dekking exactly.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

        var dekking = await service.BerekenAsync(KlasId);
        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(dekking.AantalGedekt, vooruitzicht.AantalGedekt);
        Assert.Equal(dekking.AantalLeerplandoelen, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(dekking.Bereik, vooruitzicht.Bereik);
        Assert.Equal(dekking.GemetenJaarFasen, vooruitzicht.GemetenJaarFasen);

        // And the arrangement really does distinguish them, so the equality above is not trivially true.
        Assert.Equal(1, vooruitzicht.AantalGedekt);
        Assert.Equal(2, vooruitzicht.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Een_geweigerde_plaatsing_verhoogt_het_plafond_niet_want_de_leerkracht_heeft_al_beslist()
    {
        // A rejection is an answer. Counting it in the ceiling would tell a teacher that accepting everything gets
        // them a doel they have already said no to, and it would make the figure go UP when they reject something.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Voorgesteld),
                Plaatsing(WinterId, KoppelingStatus.Geweigerd),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(1, vooruitzicht.AantalOnbereikbaar);
    }

    [Fact]
    public async Task Een_status_die_deze_code_niet_kent_verhoogt_het_plafond_niet()
    {
        // IsVoorstelbaar is written as "counts already, or is an open proposal" rather than as "not rejected", and
        // this is the case where those two differ. A value this code cannot read must not be able to raise a figure
        // a teacher reads: the fail-closed direction TeltVoorDekking already takes.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Voorgesteld),
                Plaatsing(WinterId, "IetsNieuws"),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Een_onopgeloste_vervallen_plaatsing_houdt_beide_cijfers_tegen()
    {
        // The directie ruling of 2026-07-28, applied to the prospect as well as to the figure: a plan with a
        // placement pointing at a period that no longer exists cannot honestly say what accepting it would achieve
        // either. Both are null, so no caller can print one and imply the other.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld, isVervallen: true),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.False(vooruitzicht.IsBetrouwbaar);
        Assert.Equal(1, vooruitzicht.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Null(vooruitzicht.AantalGedekt);
        Assert.Null(vooruitzicht.AantalMogelijkGedekt);

        // The derived figures follow rather than computing over a null: a screen that shows "nog 2 onbereikbaar"
        // beside "we kunnen dit niet meten" would be the E4-06 contradiction in a new place.
        Assert.Null(vooruitzicht.AantalOnbereikbaar);
        Assert.Null(vooruitzicht.AantalWinstBijAanvaarden);

        // The denominator survives, because it is a property of the curriculum rather than of this plan.
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
    }

    [Fact]
    public async Task Een_vervallen_maar_geweigerde_plaatsing_houdt_de_cijfers_niet_tegen()
    {
        // Owner ruling 2026-08-03: a rejected stale placement leaves the figure trustworthy, because rejecting is
        // what RESOLVES it. Asserted here too, not only on BerekenAsync, so the two cannot come apart on the state
        // the kalender's own notice treats differently.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Voorgesteld),
                Plaatsing(WinterId, KoppelingStatus.Geweigerd, isVervallen: true),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.True(vooruitzicht.IsBetrouwbaar);
        Assert.Equal(0, vooruitzicht.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Zonder_openstaand_voorstel_is_het_plafond_het_cijfer_en_wordt_er_niet_twee_keer_gelezen()
    {
        // A plan a teacher has fully decided on has nothing left to look ahead over, so the ceiling IS the figure.
        // The second link read is skipped in that state, which is the state every plan is in when nothing was just
        // generated — asserted because a per-request extra query on the commonest state is a real cost, and because
        // the shortcut must not be able to change the answer.
        var opslag = Opslag([Doel("NAT-K3-01"), Doel("NAT-K3-02")]);
        var service = new DekkingService(
            new FakeJaarplanLezer(Plan(
            [
                Plaatsing(HerfstId, KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, KoppelingStatus.Manueel),
            ])),
            opslag);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(2, vooruitzicht.AantalGedekt);
        Assert.Equal(2, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(0, vooruitzicht.AantalWinstBijAanvaarden);
        Assert.Equal(1, opslag.AantalKoppelingAanroepen);
    }

    [Fact]
    public async Task Zonder_enige_plaatsing_wordt_de_databank_niet_naar_koppelingen_gevraagd()
    {
        var opslag = Opslag([Doel("NAT-K3-01")]);
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(0, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(1, vooruitzicht.AantalOnbereikbaar);
        Assert.Equal(0, opslag.AantalKoppelingAanroepen);
    }

    [Fact]
    public async Task Het_plafond_wordt_geteld_over_de_doelen_in_bereik_en_niet_over_de_koppelingen()
    {
        // A thema may carry a leerplandoel from another leerjaar (thema's are school-wide, Art. IX.2). Counting links
        // instead of in-scope doelen would let such a link push the ceiling past the denominator — "3 van 2 mogelijk
        // gedekt" — which is the shape of arithmetic an inspectie-facing figure must never produce.
        var opslag = Opslag(
            [Doel("NAT-K3-01"), Doel("NAT-K3-02")],
            perThema: new Dictionary<Guid, IReadOnlyList<DekkendeKoppeling>>
            {
                [HerfstId] =
                [
                    new DekkendeKoppeling("NAT-K3-01", "Herfst"),
                    new DekkendeKoppeling("NAT-L1-09", "Herfst"),
                ],
            });

        var service = new DekkingService(
            new FakeJaarplanLezer(Plan([Plaatsing(HerfstId, KoppelingStatus.Voorgesteld)])),
            opslag);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
    }

    [Fact]
    public async Task Het_vooruitzicht_meet_tegen_de_eigen_jaarfasen_en_zegt_hoeveel_het_buiten_bereik_laat()
    {
        // The owner ruling of 2026-08-04 applies here too: a class is measured against its own jaar/fase. The panel
        // has to be able to name the scope and say what it left out, otherwise a narrower denominator would flatter
        // the outlook silently.
        var opslag = Opslag(
            [Doel("NAT-K3-01"), Doel("NAT-L3-01", jaarFase: "L3"), Doel("NAT-L3-02", jaarFase: "L3")],
            perThema: new Dictionary<Guid, IReadOnlyList<DekkendeKoppeling>>
            {
                [HerfstId] = [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            });

        var service = new DekkingService(
            new FakeJaarplanLezer(Plan([Plaatsing(HerfstId, KoppelingStatus.Voorgesteld)])),
            opslag);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(Dekkingsbereik.EigenJaarFase, vooruitzicht.Bereik);
        Assert.Equal(Jaarfasen.Kleuter, vooruitzicht.GemetenJaarFasen);
        Assert.False(vooruitzicht.IsTerugvalNaarHeelCurriculum);
        Assert.Equal(1, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(2, vooruitzicht.AantalBuitenBereik);
        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Een_klas_zonder_afleidbaar_leerjaar_verbreedt_het_bereik_en_zegt_dat()
    {
        // The unresolved graadklas half of Art. XIV. The scope widens rather than narrows, and the payload declares
        // it: a narrower-than-intended denominator would overstate the outlook, which is the one direction it must
        // not move by itself.
        var opslag = Opslag([Doel("NAT-K3-01"), Doel("NAT-L3-01", jaarFase: "L3")], leerjaar: 9);

        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(Dekkingsbereik.HeelCurriculum, vooruitzicht.Bereik);
        Assert.True(vooruitzicht.IsTerugvalNaarHeelCurriculum);
        Assert.Empty(vooruitzicht.GemetenJaarFasen);
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(0, vooruitzicht.AantalBuitenBereik);
    }

    [Fact]
    public async Task Het_plafond_kan_nooit_lager_liggen_dan_het_gedekte_cijfer()
    {
        // A property rather than a case: whatever mix of statuses a plan holds, the ceiling counts over a superset of
        // what the figure counts over, so it can never be lower. Asserted over every status combination of two
        // placements rather than over one arrangement, because "superset" is exactly the kind of invariant a later
        // refactor breaks in one branch.
        KoppelingStatus[] statussen =
        [
            KoppelingStatus.Voorgesteld,
            KoppelingStatus.Aanvaard,
            KoppelingStatus.Geweigerd,
            KoppelingStatus.Manueel,
        ];

        foreach (var eerste in statussen)
        {
            foreach (var tweede in statussen)
            {
                var service = Maak(
                    plaatsingen: [Plaatsing(HerfstId, eerste), Plaatsing(WinterId, tweede)],
                    doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

                var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

                Assert.True(
                    vooruitzicht.AantalMogelijkGedekt >= vooruitzicht.AantalGedekt,
                    $"{eerste} + {tweede}: plafond {vooruitzicht.AantalMogelijkGedekt} lag onder het cijfer " +
                    $"{vooruitzicht.AantalGedekt}");
                Assert.True(
                    vooruitzicht.AantalMogelijkGedekt <= vooruitzicht.AantalLeerplandoelen,
                    $"{eerste} + {tweede}: plafond {vooruitzicht.AantalMogelijkGedekt} lag boven de noemer " +
                    $"{vooruitzicht.AantalLeerplandoelen}");
            }
        }
    }

    [Fact]
    public async Task Een_kleutergroep_kan_het_vooruitzicht_versmallen_tot_een_kleuterjaar()
    {
        // Antagonist round 1's third MAJOR. The kleuterjaar chooser sits on the KALENDER (E3-09), driving the live
        // dekking line on the same screen as this panel, so a report that refused to narrow put two figures over two
        // denominators a few pixels apart. Narrowing to JK is asserted rather than to K3, because the seeded doelen
        // are K3: it proves the parameter reached the query rather than that the answer happened to look right.
        var opslag = Opslag(
            [Doel("NAT-K3-01"), Doel("NAT-JK-01", jaarFase: "JK")],
            perThema: new Dictionary<Guid, IReadOnlyList<DekkendeKoppeling>>
            {
                [HerfstId] = [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            });

        var service = new DekkingService(
            new FakeJaarplanLezer(Plan([Plaatsing(HerfstId, KoppelingStatus.Voorgesteld)])),
            opslag);

        var breed = await service.BerekenVooruitzichtAsync(KlasId);
        var versmald = await service.BerekenVooruitzichtAsync(KlasId, jaarFase: "JK");

        Assert.Equal(Jaarfasen.Kleuter, breed.GemetenJaarFasen);
        Assert.Equal(2, breed.AantalLeerplandoelen);
        Assert.Equal(1, breed.AantalMogelijkGedekt);

        Assert.Equal(["JK"], versmald.GemetenJaarFasen);
        Assert.Equal(1, versmald.AantalLeerplandoelen);
        Assert.Equal(0, versmald.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Een_jaar_fase_buiten_de_klas_wordt_genegeerd_en_gemeld_als_niet_toegepast()
    {
        // Same rule as the dekking figure: ignored rather than refused, and `GemetenJaarFasen` reports what was
        // APPLIED, so no screen can claim a narrowing that did not happen.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, KoppelingStatus.Voorgesteld)],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId, jaarFase: "L6");

        Assert.Equal(Jaarfasen.Kleuter, vooruitzicht.GemetenJaarFasen);
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
    }

    /// <summary>
    /// A service whose two thema's carry one distinct doel each — <c>Herfst</c> covers <c>NAT-K3-01</c> and
    /// <c>Winter</c> covers <c>NAT-K3-02</c> — so which set of placements was counted is visible in the figure.
    /// </summary>
    private static DekkingService Maak(
        IReadOnlyList<ThemaplaatsingWeergave> plaatsingen,
        IReadOnlyList<Leerplandoel> doelen) =>
        new(
            new FakeJaarplanLezer(Plan(plaatsingen)),
            Opslag(doelen));

    private static FakeDekkingOpslag Opslag(
        IReadOnlyList<Leerplandoel> doelen,
        IReadOnlyDictionary<Guid, IReadOnlyList<DekkendeKoppeling>>? perThema = null,
        int? leerjaar = KleuterLeerjaar) =>
        new([], doelen)
        {
            Leerjaar = leerjaar,
            KoppelingenPerThema = perThema ?? new Dictionary<Guid, IReadOnlyList<DekkendeKoppeling>>
            {
                [HerfstId] = [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
                [WinterId] = [new DekkendeKoppeling("NAT-K3-02", "Winter")],
            },
        };

    private static JaarplanWeergave Plan(IReadOnlyList<ThemaplaatsingWeergave> plaatsingen) =>
        new(
            KlasId,
            "K3 derde kleuterklas",
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            "2026-2027",
            "themaperiode (4-6 weken)",
            plaatsingen,
            []);

    private static ThemaplaatsingWeergave Plaatsing(
        Guid themaId,
        KoppelingStatus status,
        bool isVervallen = false) =>
        Plaatsing(themaId, status.ToString(), isVervallen);

    private static ThemaplaatsingWeergave Plaatsing(
        Guid themaId,
        string status,
        bool isVervallen = false) =>
        new(
            Guid.NewGuid(),
            themaId,
            themaId == HerfstId ? "Herfst" : "Winter",
            "Themaperiode",
            new DateOnly(2026, 9, 1),
            isVervallen ? null : new DateOnly(2026, 10, 9),
            isVervallen ? null : 1,
            isVervallen,
            status,
            null,
            false,
            [],
            4);

    private static Leerplandoel Doel(string code, string jaarFase = "K3") =>
        new(
            code,
            Doelsoort.Gemeenschappelijk,
            jaarFase,
            "Natuur",
            "Levende natuur",
            "9.1",
            tekst: $"Tekst van {code}");
}
