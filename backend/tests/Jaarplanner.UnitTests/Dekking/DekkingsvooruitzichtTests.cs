using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// The dekkingsvooruitzicht (E3-03, FR-5.3, TB-052): what a plan <b>would</b> cover if the teacher accepted every
/// thema placement standing in it, beside what it covers today.
/// <para>
/// <b>The forecast is over minimumdoelen</b>: a thema placement covers a minimumdoel through its themadoelen and
/// reaches no leerplandoel (ADR-0052). Today's leerplandoel figure stays on the payload for the dekkingsbalk and
/// does not move with any placement's status.
/// </para>
/// <para>
/// No database and no network: the plan comes from <see cref="FakeJaarplanLezer"/> and the links from
/// <see cref="FakeDekkingOpslag"/>. The SQL side of the same reads is covered against real PostgreSQL by
/// <c>DekkingsvooruitzichtPostgresTests</c>.
/// </para>
/// </summary>
public sealed class DekkingsvooruitzichtTests
{
    private static readonly Guid KlasId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid HerfstId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid WinterId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");

    /// <summary>A kleutergroep, so the production default (<c>EigenJaarFase</c>) resolves rather than falls back.</summary>
    private const int KleuterLeerjaar = 0;

    private static readonly Minimumdoel[] KleuterMinimumdoelen =
    [
        Minimum("K-9.1.1"),
        Minimum("K-9.1.2"),
        Minimum("K-9.1.3"),
        Minimum("K-9.1.4"),
    ];

    // ── Minimumdoelen: the forecast ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Een_voorgesteld_thema_met_drie_themadoelen_verhoogt_het_vooruitzicht_met_drie()
    {
        // TB-052 criterion 1: nothing is placed yet, and a proposed plan holds a thema with three minimumdoelen of the
        // klas's mijlpaal as themadoel.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, KoppelingStatus.Voorgesteld)],
            themadoelen: [Themadoel("K-9.1.1", HerfstId), Themadoel("K-9.1.2", HerfstId), Themadoel("K-9.1.3", HerfstId)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(3, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
        Assert.Equal(4, vooruitzicht.AantalMinimumdoelen);
    }

    [Fact]
    public async Task Een_minimumdoel_dat_al_gedekt_is_telt_niet_dubbel()
    {
        // TB-052 criterion 2: Herfst is placed and covers two minimumdoelen; Winter is proposed and carries those two
        // plus one more. Accepting Winter adds one, not three.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld),
            ],
            themadoelen:
            [
                Themadoel("K-9.1.1", HerfstId),
                Themadoel("K-9.1.2", HerfstId),
                Themadoel("K-9.1.1", WinterId),
                Themadoel("K-9.1.2", WinterId),
                Themadoel("K-9.1.3", WinterId),
            ]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(2, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(3, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
    }

    [Fact]
    public async Task Een_geweigerde_plaatsing_verhoogt_het_vooruitzicht_niet()
    {
        // The teacher has already decided a rejected placement, so accepting "the plan" does not include it.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, KoppelingStatus.Geweigerd)],
            themadoelen: [Themadoel("K-9.1.1", HerfstId)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
    }

    [Fact]
    public async Task Een_thema_dat_niet_in_het_plan_staat_verhoogt_het_vooruitzicht_niet()
    {
        // A themadoel alone is the prognose, not a proposal the teacher can accept.
        var service = Maak(plaatsingen: [], themadoelen: [Themadoel("K-9.1.1", HerfstId)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
    }

    [Fact]
    public async Task Het_vooruitzicht_telt_alleen_de_minimumdoelen_van_de_mijlpaal_van_de_klas()
    {
        // A kleutergroep is measured against the K- mijlpaal; a themadoel of the 4- mijlpaal raises nothing.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, KoppelingStatus.Voorgesteld)],
            minimumdoelen: [.. KleuterMinimumdoelen, Minimum("4-9.1.1", "4-")],
            themadoelen: [Themadoel("K-9.1.1", HerfstId), Themadoel("4-9.1.1", HerfstId)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(1, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
        Assert.Equal(4, vooruitzicht.AantalMinimumdoelen);
    }

    [Fact]
    public async Task Het_vooruitzicht_is_hetzelfde_getal_als_de_dekkingsberekening_geeft()
    {
        // The anti-drift test: today's figure is the dekkingsoverzicht's, and the difference is exactly the
        // minimumdoelen the overzicht marks as waiting for a decision.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld),
            ],
            themadoelen:
            [
                Themadoel("K-9.1.1", HerfstId),
                Themadoel("K-9.1.2", WinterId),
                Themadoel("K-9.1.3", WinterId),
            ]);

        var dekking = await service.BerekenAsync(KlasId);
        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(dekking.AantalMinimumdoelenGedekt, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(dekking.AantalMinimumdoelen, vooruitzicht.AantalMinimumdoelen);
        Assert.Equal(
            dekking.Minimumdoelen.Count(m => m.Oorzaak == Lacuneoorzaak.WachtOpBeslissing),
            vooruitzicht.AantalMinimumdoelenMogelijkGedekt - vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(1, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(3, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
    }

    [Fact]
    public async Task Het_plafond_ligt_bij_elke_plaatsingsstatus_tussen_het_cijfer_en_het_totaal()
    {
        // A property over every status combination of two placements. The leerplandoel figure never moves with them
        // (ADR-0052).
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
                    doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")],
                    subthemas: [new Subthemakoppeling("NAT-K3-01", "Herfst", "Bladeren", IsIngepland: true)],
                    themadoelen:
                    [
                        Themadoel("K-9.1.1", HerfstId),
                        Themadoel("K-9.1.2", HerfstId),
                        Themadoel("K-9.1.2", WinterId),
                    ]);

                var v = await service.BerekenVooruitzichtAsync(KlasId);

                Assert.True(
                    v.AantalMinimumdoelenGedekt <= v.AantalMinimumdoelenMogelijkGedekt
                    && v.AantalMinimumdoelenMogelijkGedekt <= v.AantalMinimumdoelen
                    && v.AantalGedekt == 1,
                    $"{eerste} + {tweede}: cijfer {v.AantalMinimumdoelenGedekt}, plafond {v.AantalMinimumdoelenMogelijkGedekt}, leerplandoelen {v.AantalGedekt}");
            }
        }
    }

    // ── Leerplandoelen: today's figure, for the dekkingsbalk ────────────────────────────────────────────────────

    [Fact]
    public async Task Het_gedekte_leerplandoelcijfer_is_hetzelfde_getal_als_de_dekkingsberekening_geeft()
    {
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")],
            subthemas:
            [
                new Subthemakoppeling("NAT-K3-01", "Herfst", "Bladeren", IsIngepland: true),
                new Subthemakoppeling("NAT-K3-02", "Winter", "Sneeuw", IsIngepland: false),
            ]);

        var dekking = await service.BerekenAsync(KlasId);
        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(dekking.AantalGedekt, vooruitzicht.AantalGedekt);
        Assert.Equal(dekking.AantalLeerplandoelen, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(dekking.Bereik, vooruitzicht.Bereik);
        Assert.Equal(dekking.GemetenJaarFasen, vooruitzicht.GemetenJaarFasen);
        Assert.Equal(1, vooruitzicht.AantalGedekt);
    }

    [Fact]
    public async Task Het_leerplandoelcijfer_wordt_geteld_over_de_doelen_in_bereik_en_niet_over_de_koppelingen()
    {
        // A subthema at another leeftijd would not be read for this klas, but a fake may hand one back: counting links
        // instead of in-scope doelen would push the figure past the denominator.
        var service = Maak(
            plaatsingen: [],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")],
            subthemas:
            [
                new Subthemakoppeling("NAT-K3-01", "Herfst", "Bladeren", IsIngepland: true),
                new Subthemakoppeling("NAT-L1-09", "Herfst", "Bladeren", IsIngepland: true),
            ]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(1, vooruitzicht.AantalGedekt);
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
    }

    // ── Shared rules: stale placements and scope ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Een_onopgeloste_vervallen_plaatsing_houdt_alle_cijfers_tegen()
    {
        // The directie ruling of 2026-07-28, applied to the prospect as well as to the figure. All are null, so no
        // caller can print one and imply another.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld, isVervallen: true),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")],
            themadoelen: [Themadoel("K-9.1.1", HerfstId)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.False(vooruitzicht.IsBetrouwbaar);
        Assert.Equal(1, vooruitzicht.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Null(vooruitzicht.AantalGedekt);
        Assert.Null(vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Null(vooruitzicht.AantalMinimumdoelenMogelijkGedekt);

        // The denominators survive, because they are a property of the curriculum rather than of this plan.
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(4, vooruitzicht.AantalMinimumdoelen);
    }

    [Fact]
    public async Task Een_vervallen_maar_geweigerde_plaatsing_houdt_de_cijfers_niet_tegen_en_telt_niet_mee()
    {
        // Owner ruling 2026-08-03: a rejected stale placement leaves the figure trustworthy, because rejecting is
        // what RESOLVES it.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Voorgesteld),
                Plaatsing(WinterId, KoppelingStatus.Geweigerd, isVervallen: true),
            ],
            themadoelen: [Themadoel("K-9.1.1", HerfstId), Themadoel("K-9.1.2", WinterId)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.True(vooruitzicht.IsBetrouwbaar);
        Assert.Equal(0, vooruitzicht.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(1, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
    }

    [Fact]
    public async Task Het_vooruitzicht_meet_tegen_de_eigen_jaarfasen_en_zegt_hoeveel_het_buiten_bereik_laat()
    {
        // The owner ruling of 2026-08-04 applies here too: a class is measured against its own jaar/fase.
        var service = Maak(
            plaatsingen: [],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-L3-01", jaarFase: "L3"), Doel("NAT-L3-02", jaarFase: "L3")],
            subthemas: [new Subthemakoppeling("NAT-K3-01", "Herfst", "Bladeren", IsIngepland: true)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(Dekkingsbereik.EigenJaarFase, vooruitzicht.Bereik);
        Assert.Equal(Jaarfasen.Kleuter, vooruitzicht.GemetenJaarFasen);
        Assert.False(vooruitzicht.IsTerugvalNaarHeelCurriculum);
        Assert.Equal(1, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(2, vooruitzicht.AantalBuitenBereik);
        Assert.Equal(1, vooruitzicht.AantalGedekt);
    }

    [Fact]
    public async Task Een_klas_zonder_afleidbaar_leerjaar_verbreedt_het_bereik_en_zegt_dat()
    {
        // The unresolved graadklas half of Art. XIV. The scope widens rather than narrows, to every mijlpaal too.
        var service = Maak(
            plaatsingen: [],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-L3-01", jaarFase: "L3")],
            minimumdoelen: [.. KleuterMinimumdoelen, Minimum("4-9.1.1", "4-")],
            leerjaar: 9);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(Dekkingsbereik.HeelCurriculum, vooruitzicht.Bereik);
        Assert.True(vooruitzicht.IsTerugvalNaarHeelCurriculum);
        Assert.Empty(vooruitzicht.GemetenJaarFasen);
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(0, vooruitzicht.AantalBuitenBereik);
        Assert.Equal(5, vooruitzicht.AantalMinimumdoelen);
    }

    [Fact]
    public async Task Een_kleutergroep_kan_het_vooruitzicht_versmallen_tot_een_kleuterjaar()
    {
        // Narrowing to JK is asserted rather than to K3, because the covered doel is K3: it proves the parameter
        // reached the query rather than that the answer happened to look right.
        var service = Maak(
            plaatsingen: [],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-JK-01", jaarFase: "JK")],
            subthemas: [new Subthemakoppeling("NAT-K3-01", "Herfst", "Bladeren", IsIngepland: true)]);

        var breed = await service.BerekenVooruitzichtAsync(KlasId);
        var versmald = await service.BerekenVooruitzichtAsync(KlasId, jaarFase: "JK");

        Assert.Equal(Jaarfasen.Kleuter, breed.GemetenJaarFasen);
        Assert.Equal(2, breed.AantalLeerplandoelen);
        Assert.Equal(1, breed.AantalGedekt);

        Assert.Equal(["JK"], versmald.GemetenJaarFasen);
        Assert.Equal(1, versmald.AantalLeerplandoelen);
        Assert.Equal(0, versmald.AantalGedekt);
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

    private static DekkingService Maak(
        IReadOnlyList<ThemaplaatsingWeergave> plaatsingen,
        IReadOnlyList<Leerplandoel>? doelen = null,
        IReadOnlyList<Subthemakoppeling>? subthemas = null,
        IReadOnlyList<Minimumdoel>? minimumdoelen = null,
        IReadOnlyList<Themaminimumdoelkoppeling>? themadoelen = null,
        int? leerjaar = KleuterLeerjaar) =>
        new(
            new FakeJaarplanLezer(Plan(plaatsingen)),
            new FakeDekkingOpslag(doelen ?? [Doel("NAT-K3-01")])
            {
                Leerjaar = leerjaar,
                Subthemakoppelingen = subthemas ?? [],
                Minimumdoelen = minimumdoelen ?? KleuterMinimumdoelen,
                ThemaMinimumdoelen = themadoelen ?? [],
            });

    private static JaarplanWeergave Plan(IReadOnlyList<ThemaplaatsingWeergave> plaatsingen) =>
        new(
            KlasId,
            "K3 derde kleuterklas",
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            "2026-2027",
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30),
            plaatsingen,
            // Dekking reads neither the lesweken nor the balance, and must not start to.
            [],
            new JaarbalansWeergave(0, 0, 0));

    private static ThemaplaatsingWeergave Plaatsing(
        Guid themaId,
        KoppelingStatus status,
        bool isVervallen = false) =>
        new(
            Guid.NewGuid(),
            themaId,
            Themanaam(themaId),
            new DateOnly(2026, 9, 1),
            new DateOnly(2026, 10, 9),
            isVervallen,
            status.ToString(),
            null,
            false,
            [],
            4,
            null);

    private static string Themanaam(Guid themaId) => themaId == HerfstId ? "Herfst" : "Winter";

    private static Themaminimumdoelkoppeling Themadoel(string minimumdoelRef, Guid themaId) =>
        new(minimumdoelRef, themaId, Themanaam(themaId));

    private static Minimumdoel Minimum(string reference, string leeftijd = "K-") =>
        new(reference, leeftijd, reference[leeftijd.Length..], $"Omschrijving van {reference}", "Wereldoriëntatie", "Natuur");

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
