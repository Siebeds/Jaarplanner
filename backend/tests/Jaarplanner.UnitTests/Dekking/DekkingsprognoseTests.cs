using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// The two steps of Art. V.1 (FB-045, ADR-0047): the dekkingsprognose and the dekking, for leerplandoelen and for
/// minimumdoelen. No database: the plan and the reads are fakes, and <c>DekkingLagenPostgresTests</c> pins the reads.
/// </summary>
public sealed class DekkingsprognoseTests
{
    private static readonly Guid KlasId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid HerfstId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid WinterId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");

    // ── Leerplandoelen ──────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Een_subdoel_van_een_subthema_dat_niet_ingepland_is_staat_in_de_prognose()
    {
        var (service, _) = Maak(subthemas: [new Subthemakoppeling("K3-01", "Herfst", "Bladeren", IsIngepland: false)]);

        var dekking = await service.BerekenAsync(KlasId);

        var doel = Doel(dekking, "K3-01");
        Assert.Equal(Dekkingsstap.Prognose, doel.Stap);
        Assert.False(doel.IsGedekt);
        Assert.Equal(["Bladeren (Herfst)"], doel.PrognoseBronnen);
        Assert.Empty(doel.DekkendeThemas);
        Assert.Equal(Lacuneoorzaak.NietIngepland, doel.Oorzaak);
        Assert.Equal(["Bladeren (Herfst)"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_subdoel_is_gedekt_zodra_het_subthema_in_de_agenda_staat()
    {
        var (service, _) = Maak(subthemas: [new Subthemakoppeling("K3-01", "Herfst", "Bladeren", IsIngepland: true)]);

        var dekking = await service.BerekenAsync(KlasId);

        var doel = Doel(dekking, "K3-01");
        Assert.Equal(Dekkingsstap.Gedekt, doel.Stap);
        Assert.True(doel.IsGedekt);
        Assert.Equal(["Bladeren (Herfst)"], doel.DekkendeThemas);
        Assert.Null(doel.Oorzaak);
        Assert.Empty(doel.KandidaatThemas);
    }

    [Fact]
    public async Task Het_thema_inplannen_volstaat_niet_voor_een_subdoel()
    {
        // D3: the thema above is placed, the subthema is not. Since ADR-0052 nothing on the thema reaches a leerplandoel.
        var (service, _) = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)],
            subthemas: [new Subthemakoppeling("K3-01", "Herfst", "Bladeren", IsIngepland: false)],
            themaMinimumdoelen: [new Themaminimumdoelkoppeling("K-1", HerfstId, "Herfst")],
            leerplandoelMinimumdoel: "K-1");

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(Dekkingsstap.Prognose, Doel(dekking, "K3-01").Stap);
        Assert.Equal(Dekkingsstap.Gedekt, Minimumdoel(dekking, "K-1").Stap);
    }

    [Fact]
    public async Task Een_voorgestelde_themaplaatsing_laat_een_leerplandoel_niet_wachten_op_een_beslissing()
    {
        // ADR-0052: accepting the thema's placement would not cover the leerplandoel, so the cause is its subthema.
        var (service, _) = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld)],
            kandidaten: [new KandidaatKoppeling("K3-01", HerfstId, "Herfst", IsBeslist: true)],
            subthemas: [new Subthemakoppeling("K3-01", "Herfst", "Bladeren", IsIngepland: false)]);

        var doel = Doel(await service.BerekenAsync(KlasId), "K3-01");

        Assert.Equal(Dekkingsstap.Prognose, doel.Stap);
        Assert.Equal(Lacuneoorzaak.NietIngepland, doel.Oorzaak);
        Assert.Equal(["Bladeren (Herfst)"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_onbesliste_koppeling_alleen_zet_een_doel_niet_in_de_prognose()
    {
        var (service, _) = Maak(
            kandidaten: [new KandidaatKoppeling("K3-01", HerfstId, "Herfst", IsBeslist: false)]);

        var doel = Doel(await service.BerekenAsync(KlasId), "K3-01");

        Assert.Equal(Dekkingsstap.Geen, doel.Stap);
        Assert.Empty(doel.PrognoseBronnen);
        Assert.Equal(Lacuneoorzaak.KoppelingNietBeslist, doel.Oorzaak);
    }

    [Fact]
    public async Task Een_geplande_fiche_dekt_zonder_prognose()
    {
        var (service, opslag) = Maak();
        opslag.Fichekoppelingen = [new DekkendeFichekoppeling("K3-01", "Onthaal")];

        var doel = Doel(await service.BerekenAsync(KlasId), "K3-01");

        Assert.Equal(Dekkingsstap.Gedekt, doel.Stap);
        Assert.Equal(["Onthaal"], doel.DekkendeFiches);
        Assert.Empty(doel.PrognoseBronnen);
    }

    [Fact]
    public async Task De_tellingen_van_prognose_en_dekking_overlappen_niet()
    {
        var (service, _) = Maak(subthemas:
        [
            new Subthemakoppeling("K3-01", "Herfst", "Bladeren", IsIngepland: true),
            new Subthemakoppeling("K3-02", "Herfst", "Bladeren", IsIngepland: false),
            new Subthemakoppeling("K3-02", "Winter", "Sneeuw", IsIngepland: false),
        ]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(1, dekking.AantalGedekt);
        Assert.Equal(1, dekking.AantalInPrognose);
        Assert.Equal(3, dekking.AantalLeerplandoelen);
        Assert.Equal(["Bladeren (Herfst)", "Sneeuw (Winter)"], Doel(dekking, "K3-02").PrognoseBronnen);
    }

    [Fact]
    public async Task Een_onopgeloste_vervallen_plaatsing_houdt_alle_cijfers_tegen_maar_niet_de_stappen()
    {
        var (service, _) = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld, isVervallen: true)],
            subthemas: [new Subthemakoppeling("K3-01", "Herfst", "Bladeren", IsIngepland: true)],
            themaMinimumdoelen: [new Themaminimumdoelkoppeling("K-1", HerfstId, "Herfst")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.False(dekking.IsBetrouwbaar);
        Assert.Null(dekking.AantalGedekt);
        Assert.Null(dekking.AantalInPrognose);
        Assert.Null(dekking.AantalMinimumdoelenGedekt);
        Assert.Null(dekking.AantalMinimumdoelenInPrognose);
        Assert.Equal(2, dekking.AantalMinimumdoelen);
        Assert.Equal(Dekkingsstap.Gedekt, Doel(dekking, "K3-01").Stap);
    }

    // ── Minimumdoelen ───────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Een_minimumdoel_op_een_thema_staat_in_de_prognose_tot_dat_thema_ingepland_is()
    {
        var koppeling = new Themaminimumdoelkoppeling("K-1", HerfstId, "Herfst");

        var (voor, _) = Maak(themaMinimumdoelen: [koppeling]);
        var zonder = Minimumdoel(await voor.BerekenAsync(KlasId), "K-1");
        Assert.Equal(Dekkingsstap.Prognose, zonder.Stap);
        Assert.Equal(["Herfst"], zonder.PrognoseThemas);
        Assert.Empty(zonder.DekkendeThemas);
        Assert.Equal(Lacuneoorzaak.NietIngepland, zonder.Oorzaak);
        Assert.Equal(["Herfst"], zonder.KandidaatThemas);

        var (na, _) = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Manueel)],
            themaMinimumdoelen: [koppeling]);
        var met = Minimumdoel(await na.BerekenAsync(KlasId), "K-1");
        Assert.Equal(Dekkingsstap.Gedekt, met.Stap);
        Assert.True(met.IsGedekt);
        Assert.Equal(["Herfst"], met.DekkendeThemas);
        Assert.Null(met.Oorzaak);
    }

    [Theory]
    [InlineData(KoppelingStatus.Voorgesteld, Lacuneoorzaak.WachtOpBeslissing)]
    [InlineData(KoppelingStatus.Geweigerd, Lacuneoorzaak.PlaatsingGeweigerd)]
    public async Task Een_niet_besliste_themaplaatsing_dekt_een_minimumdoel_niet_en_zegt_waarom(
        KoppelingStatus status,
        Lacuneoorzaak oorzaak)
    {
        var (service, _) = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", status)],
            themaMinimumdoelen:
            [
                new Themaminimumdoelkoppeling("K-1", HerfstId, "Herfst"),
                new Themaminimumdoelkoppeling("K-1", WinterId, "Winter"),
            ]);

        var md = Minimumdoel(await service.BerekenAsync(KlasId), "K-1");

        Assert.Equal(Dekkingsstap.Prognose, md.Stap);
        Assert.Equal(oorzaak, md.Oorzaak);
        Assert.Equal(["Herfst"], md.KandidaatThemas);
        Assert.Equal(["Herfst", "Winter"], md.PrognoseThemas);
    }

    [Fact]
    public async Task Een_minimumdoel_telt_nooit_via_een_gedekt_leerplandoel()
    {
        // D2: the concordance does not make a minimumdoel gedekt, nor put it in the prognose.
        var (service, _) = Maak(
            subthemas: [new Subthemakoppeling("K3-01", "Herfst", "Bladeren", IsIngepland: true)],
            leerplandoelMinimumdoel: "K-1");

        var dekking = await service.BerekenAsync(KlasId);

        Assert.True(Doel(dekking, "K3-01").IsGedekt);
        var md = Minimumdoel(dekking, "K-1");
        Assert.Equal(Dekkingsstap.Geen, md.Stap);
        Assert.Equal(Lacuneoorzaak.GeenThema, md.Oorzaak);
        Assert.Empty(md.KandidaatThemas);
        Assert.Equal(0, dekking.AantalMinimumdoelenGedekt);
        Assert.Equal(0, dekking.AantalMinimumdoelenInPrognose);
    }

    [Fact]
    public async Task De_minimumdoelen_staan_in_de_volgorde_van_het_decreet_met_de_ongeordende_achteraan()
    {
        var (service, opslag) = Maak();
        opslag.Minimumdoelen =
        [
            new Minimumdoel("K-9", "K-", "9", "zonder ordening"),
            new Minimumdoel("K-2", "K-", "2", "tekst", "Wiskunde", "Getallen"),
            new Minimumdoel("K-1", "K-", "1", "tekst", "Nederlands", "Lezen"),
        ];

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(["K-1", "K-2", "K-9"], dekking.Minimumdoelen.Select(m => m.Ref));
    }

    [Theory]
    [InlineData("K3", "K-")]
    [InlineData("L1", "4-")]
    [InlineData("L4", "4-")]
    [InlineData("L5", "6-")]
    public async Task Een_klas_wordt_gemeten_tegen_de_minimumdoelen_van_haar_mijlpaal(string jaarfase, string mijlpaal)
    {
        var (service, opslag) = Maak(jaarfase: jaarfase);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal([mijlpaal], opslag.GevraagdeMijlpalen);
        Assert.All(dekking.Minimumdoelen, m => Assert.Equal(mijlpaal, m.Leeftijd));
        Assert.Equal(mijlpaal == "K-" ? 2 : 1, dekking.AantalMinimumdoelen);
    }

    [Fact]
    public async Task Het_hele_curriculum_en_een_klas_zonder_jaarfase_meten_alle_minimumdoelen()
    {
        var (heel, heelOpslag) = Maak();
        var heleDekking = await heel.BerekenAsync(KlasId, Dekkingsbereik.HeelCurriculum);
        Assert.Null(heelOpslag.GevraagdeMijlpalen);
        Assert.Equal(4, heleDekking.AantalMinimumdoelen);

        var (terugval, terugvalOpslag) = Maak(leerjaar: null);
        var terugvalDekking = await terugval.BerekenAsync(KlasId);
        Assert.True(terugvalDekking.IsTerugvalNaarHeelCurriculum);
        Assert.Null(terugvalOpslag.GevraagdeMijlpalen);
        Assert.Equal(4, terugvalDekking.AantalMinimumdoelen);
    }

    // ── Vooruitzicht ────────────────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Het_vooruitzicht_telt_een_ingepland_subthema_bij_de_leerplandoelen_en_een_themavoorstel_bij_de_minimumdoelen()
    {
        var (service, _) = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld)],
            themaMinimumdoelen: [new Themaminimumdoelkoppeling("K-1", HerfstId, "Herfst")],
            subthemas:
            [
                new Subthemakoppeling("K3-01", "Winter", "Sneeuw", IsIngepland: true),
                new Subthemakoppeling("K3-03", "Winter", "IJs", IsIngepland: false),
            ]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(1, vooruitzicht.AantalGedekt);
        Assert.Equal(0, vooruitzicht.AantalMinimumdoelenGedekt);
        Assert.Equal(1, vooruitzicht.AantalMinimumdoelenMogelijkGedekt);
        Assert.Equal(2, vooruitzicht.AantalMinimumdoelen);
    }

    [Fact]
    public async Task Het_vooruitzicht_telt_de_minimumdoelen_in_de_prognose_zoals_het_dekkingsoverzicht()
    {
        // FB-071: Chuck purrs on this count, so it must be the dekkingsoverzicht's own figure, not a second one.
        var (service, _) = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld)],
            themaMinimumdoelen: [new Themaminimumdoelkoppeling("K-1", HerfstId, "Herfst")],
            subthemas: [new Subthemakoppeling("K3-01", "Winter", "Sneeuw", IsIngepland: true)]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);
        var overzicht = await service.BerekenAsync(KlasId);

        Assert.Equal(1, vooruitzicht.AantalMinimumdoelenInPrognose);
        Assert.Equal(overzicht.AantalMinimumdoelenInPrognose, vooruitzicht.AantalMinimumdoelenInPrognose);
        Assert.Equal(overzicht.AantalMinimumdoelenGedekt, vooruitzicht.AantalMinimumdoelenGedekt);
    }

    // ── Jaarfasen.MijlpalenVoor ─────────────────────────────────────────────────────────────────────────────────

    [Fact]
    public void De_mijlpaal_volgt_uit_de_jaarfasen()
    {
        Assert.Equal(["K-"], Jaarfasen.MijlpalenVoor(["JK", "K2", "K3"]));
        Assert.Equal(["4-"], Jaarfasen.MijlpalenVoor(["L1"]));
        Assert.Equal(["6-"], Jaarfasen.MijlpalenVoor(["L6"]));
        Assert.Equal(["K-", "4-", "6-"], Jaarfasen.MijlpalenVoor(Jaarfasen.Alle));
        Assert.Empty(Jaarfasen.MijlpalenVoor(["onbekend"]));
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────────

    private static (DekkingService Service, FakeDekkingOpslag Opslag) Maak(
        IReadOnlyList<ThemaplaatsingWeergave>? plaatsingen = null,
        IReadOnlyList<Subthemakoppeling>? subthemas = null,
        IReadOnlyList<KandidaatKoppeling>? kandidaten = null,
        IReadOnlyList<Themaminimumdoelkoppeling>? themaMinimumdoelen = null,
        string? leerplandoelMinimumdoel = null,
        string jaarfase = "K3",
        int? leerjaar = 0)
    {
        var fase = Jaarfasen.IsBekend(jaarfase) ? jaarfase : "K3";
        var opslag = new FakeDekkingOpslag(
            [
                Leerplandoel("K3-01", fase, leerplandoelMinimumdoel),
                Leerplandoel("K3-02", fase),
                Leerplandoel("K3-03", fase),
            ])
        {
            Leerjaar = leerjaar,
            Jaarfase = leerjaar is null ? null : jaarfase,
            Subthemakoppelingen = subthemas ?? [],
            Kandidaten = kandidaten ?? [],
            ThemaMinimumdoelen = themaMinimumdoelen ?? [],
            Minimumdoelen =
            [
                new Minimumdoel("K-1", "K-", "1", "Een kleuterdoel."),
                new Minimumdoel("K-2", "K-", "2", "Nog een kleuterdoel."),
                new Minimumdoel("4-1", "4-", "1", "Een doel van het vierde leerjaar."),
                new Minimumdoel("6-1", "6-", "1", "Een doel van het zesde leerjaar."),
            ],
        };

        var plan = new JaarplanWeergave(
            KlasId,
            "Testklas",
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            "2026-2027",
            new DateOnly(2026, 9, 1),
            new DateOnly(2027, 6, 30),
            plaatsingen ?? [],
            // Dekking reads neither the lesweken nor the balance, and must not start to.
            [],
            new JaarbalansWeergave(0, 0, 0));

        return (new DekkingService(new FakeJaarplanLezer(plan), opslag), opslag);
    }

    private static Leerplandoel Leerplandoel(string code, string jaarFase, string? minimumdoelRef = null) =>
        new(code, Doelsoort.Gemeenschappelijk, jaarFase, "Natuur", "Levende natuur", "9.1",
            tekst: $"Tekst van {code}", minimumdoelRef: minimumdoelRef);

    private static ThemaplaatsingWeergave Plaatsing(
        Guid themaId,
        string themaNaam,
        KoppelingStatus status,
        bool isVervallen = false) =>
        new(
            Guid.NewGuid(),
            themaId,
            themaNaam,
            new DateOnly(2026, 9, 1),
            new DateOnly(2026, 10, 9),
            isVervallen,
            status.ToString(),
            null,
            false,
            [],
            4,
            null);

    private static LeerplandoelDekking Doel(DekkingWeergave dekking, string code) =>
        dekking.Doelen.Single(d => d.Code == code);

    private static MinimumdoelDekking Minimumdoel(DekkingWeergave dekking, string minimumdoelRef) =>
        dekking.Minimumdoelen.Single(m => m.Ref == minimumdoelRef);
}
