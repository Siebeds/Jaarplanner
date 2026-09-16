using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// The dekkingsvooruitzicht (E3-03, FR-5.3): what a plan <b>would</b> cover if the teacher accepted everything
/// standing in it, beside what it covers today, over the leerplandoelen.
/// <para>
/// <b>Since ADR-0052 no thema placement reaches a leerplandoel</b>: a leerplandoel is covered through a placed subthema
/// or a planned algemene fiche, neither of which depends on a thema placement's status. So the two figures are equal
/// in every state, and these tests pin that, together with the rules that still shape them: the scope, and the stale
/// placement that withholds both.
/// </para>
/// <para>
/// No database and no network: the plan comes from <see cref="FakeJaarplanLezer"/> and the links from
/// <see cref="FakeDekkingOpslag"/>. The SQL side of the same reads is covered against real PostgreSQL by
/// <c>DekkingLagenPostgresTests</c> and <c>JaarplanGeneratieEndpointTests</c>.
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
    public async Task Een_vers_gegenereerd_plan_verhoogt_het_vooruitzicht_niet()
    {
        // A run has just placed two thema's, both `voorgesteld`. Accepting them would cover no leerplandoel: that is
        // the subthema's placement in the agenda (Art. V.1).
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, KoppelingStatus.Voorgesteld),
                Plaatsing(WinterId, KoppelingStatus.Voorgesteld),
            ],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02"), Doel("NAT-K3-03")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(0, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(3, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(3, vooruitzicht.AantalOnbereikbaar);
    }

    [Fact]
    public async Task Het_gedekte_cijfer_is_hetzelfde_getal_als_de_dekkingsberekening_geeft()
    {
        // The anti-drift test, and the reason BerekenVooruitzichtAsync lives on this service rather than beside the
        // generator: the decided half must be the SAME rule, not a similar one.
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
        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Een_onopgeloste_vervallen_plaatsing_houdt_beide_cijfers_tegen()
    {
        // The directie ruling of 2026-07-28, applied to the prospect as well as to the figure. Both are null, so no
        // caller can print one and imply the other.
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
        Assert.Null(vooruitzicht.AantalOnbereikbaar);

        // The denominator survives, because it is a property of the curriculum rather than of this plan.
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
    }

    [Fact]
    public async Task Een_vervallen_maar_geweigerde_plaatsing_houdt_de_cijfers_niet_tegen()
    {
        // Owner ruling 2026-08-03: a rejected stale placement leaves the figure trustworthy, because rejecting is
        // what RESOLVES it.
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
        Assert.Equal(0, vooruitzicht.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Zonder_enige_plaatsing_is_niets_gedekt()
    {
        var service = Maak(plaatsingen: [], doelen: [Doel("NAT-K3-01")]);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(0, vooruitzicht.AantalGedekt);
        Assert.Equal(0, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(1, vooruitzicht.AantalOnbereikbaar);
    }

    [Fact]
    public async Task Het_cijfer_wordt_geteld_over_de_doelen_in_bereik_en_niet_over_de_koppelingen()
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

        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
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
        Assert.Equal(1, vooruitzicht.AantalMogelijkGedekt);
    }

    [Fact]
    public async Task Een_klas_zonder_afleidbaar_leerjaar_verbreedt_het_bereik_en_zegt_dat()
    {
        // The unresolved graadklas half of Art. XIV. The scope widens rather than narrows, and the payload declares it.
        var service = Maak(
            plaatsingen: [],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-L3-01", jaarFase: "L3")],
            leerjaar: 9);

        var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

        Assert.Equal(Dekkingsbereik.HeelCurriculum, vooruitzicht.Bereik);
        Assert.True(vooruitzicht.IsTerugvalNaarHeelCurriculum);
        Assert.Empty(vooruitzicht.GemetenJaarFasen);
        Assert.Equal(2, vooruitzicht.AantalLeerplandoelen);
        Assert.Equal(0, vooruitzicht.AantalBuitenBereik);
    }

    [Fact]
    public async Task Het_plafond_is_het_gedekte_cijfer_bij_elke_plaatsingsstatus()
    {
        // A property rather than a case, asserted over every status combination of two placements: no thema
        // placement moves a leerplandoel figure (ADR-0052), so the ceiling equals the figure and stays within the
        // denominator.
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
                    subthemas: [new Subthemakoppeling("NAT-K3-01", "Herfst", "Bladeren", IsIngepland: true)]);

                var vooruitzicht = await service.BerekenVooruitzichtAsync(KlasId);

                Assert.True(
                    vooruitzicht.AantalMogelijkGedekt == vooruitzicht.AantalGedekt && vooruitzicht.AantalGedekt == 1,
                    $"{eerste} + {tweede}: plafond {vooruitzicht.AantalMogelijkGedekt}, cijfer {vooruitzicht.AantalGedekt}");
            }
        }
    }

    [Fact]
    public async Task Een_kleutergroep_kan_het_vooruitzicht_versmallen_tot_een_kleuterjaar()
    {
        // The kleuterjaar chooser sits on the kalender (E3-09), driving the live dekking line on the same screen as
        // this panel. Narrowing to JK is asserted rather than to K3, because the covered doel is K3: it proves the
        // parameter reached the query rather than that the answer happened to look right.
        var service = Maak(
            plaatsingen: [],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-JK-01", jaarFase: "JK")],
            subthemas: [new Subthemakoppeling("NAT-K3-01", "Herfst", "Bladeren", IsIngepland: true)]);

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

    private static DekkingService Maak(
        IReadOnlyList<ThemaplaatsingWeergave> plaatsingen,
        IReadOnlyList<Leerplandoel> doelen,
        IReadOnlyList<Subthemakoppeling>? subthemas = null,
        int? leerjaar = KleuterLeerjaar) =>
        new(
            new FakeJaarplanLezer(Plan(plaatsingen)),
            new FakeDekkingOpslag(doelen)
            {
                Leerjaar = leerjaar,
                Subthemakoppelingen = subthemas ?? [],
            });

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
        new(
            Guid.NewGuid(),
            themaId,
            themaId == HerfstId ? "Herfst" : "Winter",
            "Themaperiode",
            new DateOnly(2026, 9, 1),
            isVervallen ? null : new DateOnly(2026, 10, 9),
            isVervallen ? null : 1,
            isVervallen,
            status.ToString(),
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
