using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// The coverage computation (E5-01, FR-9.1, Art. V.1) — one of the two pieces of logic Art. V.6 singles out as the
/// highest-risk in the system, so each rule gets its own named test rather than being asserted in passing.
/// <para>
/// Every test runs with <b>no database and no network</b>: the plan comes from <see cref="FakeJaarplanLezer"/> and
/// the link/curriculum reads from <see cref="FakeDekkingOpslag"/>. The SQL translation of the four-layer union is a
/// separate concern and is covered against real PostgreSQL by <c>DekkingLagenPostgresTests</c>, because the EF
/// in-memory provider evaluates that shape in LINQ and would pass whether or not Npgsql can translate it.
/// </para>
/// </summary>
public sealed class DekkingServiceTests
{
    private static readonly Guid KlasId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AndereKlasId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid HerfstId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000001");
    private static readonly Guid WinterId = Guid.Parse("aaaaaaaa-0000-0000-0000-000000000002");

    [Fact]
    public async Task Een_doel_is_gedekt_wanneer_een_aanvaarde_plaatsing_het_draagt()
    {
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)],
            koppelingen: [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.True(Doelvan(dekking, "NAT-K3-01").IsGedekt);
        Assert.False(Doelvan(dekking, "NAT-K3-02").IsGedekt);

        // The figure is present because nothing is unresolved, and it counts doelen rather than links.
        Assert.True(dekking.IsBetrouwbaar);
        Assert.Equal(1, dekking.AantalGedekt);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
    }

    [Fact]
    public async Task Een_manuele_plaatsing_dekt_net_zo_goed_als_een_aanvaarde()
    {
        // Art. V.1 names aanvaard AND manueel. A teacher who dragged a thema into a period (which makes the
        // placement manueel, see Themaplaatsing.VerplaatsNaar) has committed to it just as firmly as one who
        // pressed accept, so treating manueel as second-class would under-report their own plan.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Manueel)],
            koppelingen: [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            doelen: [Doel("NAT-K3-01")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.True(Doelvan(dekking, "NAT-K3-01").IsGedekt);
        Assert.Equal(1, dekking.AantalGedekt);
    }

    [Fact]
    public async Task Een_voorgestelde_plaatsing_dekt_niets_want_dan_zou_de_AI_dekking_toekennen()
    {
        // The binding reading of Art. V.1's "placed in the plan": only aanvaard/manueel count. A `voorgesteld`
        // placement is the model's proposal, and letting it grant dekking would let the AI decide what the school
        // can prove to an inspectie (Art. IV.1).
        var opslag = new FakeDekkingOpslag(
            [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            [Doel("NAT-K3-01")]);

        var service = new DekkingService(
            new FakeJaarplanLezer(Plan([Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld)])),
            opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.False(Doelvan(dekking, "NAT-K3-01").IsGedekt);
        Assert.Equal(0, dekking.AantalGedekt);

        // And it never even asked the database about that thema — the exclusion happens before the link read, so a
        // fake that answered generously could not have made this pass.
        Assert.Equal(0, opslag.AantalKoppelingAanroepen);
        Assert.Null(opslag.GevraagdeThemaIds);
    }

    [Fact]
    public async Task Een_geweigerde_plaatsing_dekt_niets()
    {
        var opslag = new FakeDekkingOpslag(
            [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            [Doel("NAT-K3-01")]);

        var service = new DekkingService(
            new FakeJaarplanLezer(Plan([Plaatsing(HerfstId, "Herfst", KoppelingStatus.Geweigerd)])),
            opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.False(Doelvan(dekking, "NAT-K3-01").IsGedekt);
        Assert.Equal(0, opslag.AantalKoppelingAanroepen);
    }

    [Fact]
    public async Task Een_vervallen_plaatsing_dekt_niets_en_maakt_het_cijfer_onbetrouwbaar()
    {
        // Directie ruling 2026-07-28: a placement whose stored start date is no longer any period's start is in no
        // period, so nothing is demonstrably taught on its account — AND the figure may not be reported at all
        // while it is unresolved, because re-placing it would raise the number.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard, isVervallen: true)],
            koppelingen: [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            doelen: [Doel("NAT-K3-01")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.False(Doelvan(dekking, "NAT-K3-01").IsGedekt);
        Assert.False(dekking.IsBetrouwbaar);
        Assert.Equal(1, dekking.AantalOnopgelosteVervallenPlaatsingen);

        // The total is WITHHELD, not merely flagged. A number beside a false flag is a number a caller renders.
        Assert.Null(dekking.AantalGedekt);

        // The denominator survives, because it is a property of the curriculum rather than of this plan.
        Assert.Equal(1, dekking.AantalLeerplandoelen);
    }

    [Fact]
    public async Task Een_vervallen_maar_geweigerde_plaatsing_maakt_het_cijfer_niet_onbetrouwbaar()
    {
        // A judgement call, recorded as such: the directie ruling says "while any placement is unresolved" and did
        // not contemplate a rejected one. A rejected placement contributes nothing whether or not its period still
        // exists, so its staleness can never change the figure. Counting it would leave the plan permanently "te
        // herzien" over a placement nobody will ever re-place, and would repeat the defect E4-06 fixed elsewhere:
        // a rejected card being told to go pick a period.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, "Winter", KoppelingStatus.Geweigerd, isVervallen: true),
            ],
            koppelingen: [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            doelen: [Doel("NAT-K3-01")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.True(dekking.IsBetrouwbaar);
        Assert.Equal(0, dekking.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Equal(1, dekking.AantalGedekt);
    }

    [Fact]
    public async Task Een_vervallen_voorgestelde_plaatsing_maakt_het_cijfer_wel_onbetrouwbaar()
    {
        // The other side of the same judgement call, and the reason it is not simply "ignore anything that does not
        // currently cover": a `voorgesteld` placement may still be accepted, and accepting it would raise the
        // figure. It is undecided, not discarded.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld, isVervallen: true)],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.False(dekking.IsBetrouwbaar);
        Assert.Equal(1, dekking.AantalOnopgelosteVervallenPlaatsingen);
        Assert.Null(dekking.AantalGedekt);
    }

    [Fact]
    public async Task De_klas_wordt_doorgegeven_zodat_de_klasgebonden_lagen_gefilterd_kunnen_worden()
    {
        // Layers 3 and 4 (subdoel, activiteit) hang off a Subthema, which Art. IX.2 scopes per klas and leeftijd.
        // The service cannot do that filtering itself — it is a database concern — so what it owes is passing the
        // klas through. Without this the query would silently answer school-wide and class A would claim dekking
        // for content class B teaches.
        var opslag = new FakeDekkingOpslag(
            [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            [Doel("NAT-K3-01")]);

        var service = new DekkingService(
            new FakeJaarplanLezer(Plan([Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)])),
            opslag);

        await service.BerekenAsync(KlasId);

        Assert.Equal(KlasId, opslag.GevraagdeKlasId);
        Assert.NotEqual(AndereKlasId, opslag.GevraagdeKlasId);
    }

    [Fact]
    public async Task Hetzelfde_thema_twee_keer_geplaatst_wordt_een_keer_gevraagd()
    {
        // A thema may legitimately be placed in two periods (Art. IX.3 allows a list per block, and a school may
        // revisit a thema). Coverage is about the doel being taught, not about how often, so the thema id is asked
        // about once and the doel counts once.
        var opslag = new FakeDekkingOpslag(
            [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            [Doel("NAT-K3-01")]);

        var service = new DekkingService(
            new FakeJaarplanLezer(Plan(
            [
                Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard),
                Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard, blokStart: new DateOnly(2027, 1, 11)),
            ])),
            opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal([HerfstId], opslag.GevraagdeThemaIds);
        Assert.Equal(1, dekking.AantalGedekt);
        Assert.Equal(["Herfst"], Doelvan(dekking, "NAT-K3-01").DekkendeThemas);
    }

    [Fact]
    public async Task Een_doel_dat_twee_themas_dragen_noemt_ze_beide_alfabetisch()
    {
        // The evidence half of Art. V: an export that claims coverage must be able to say through what, and a
        // teacher wants to see which thema's already touch a goal.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(WinterId, "Winter", KoppelingStatus.Aanvaard),
                Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard),
            ],
            koppelingen:
            [
                new DekkendeKoppeling("NAT-K3-01", "Winter"),
                new DekkendeKoppeling("NAT-K3-01", "Herfst"),
            ],
            doelen: [Doel("NAT-K3-01")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(["Herfst", "Winter"], Doelvan(dekking, "NAT-K3-01").DekkendeThemas);
    }

    [Fact]
    public async Task Hetzelfde_thema_dat_een_code_in_twee_lagen_draagt_wordt_een_keer_genoemd()
    {
        // A teacher may curate a code as a themadoel AND accept the same code as a suggestion. The union then
        // yields the pair twice; naming the thema twice in the evidence list would read as two separate reasons.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)],
            koppelingen:
            [
                new DekkendeKoppeling("NAT-K3-01", "Herfst"),
                new DekkendeKoppeling("NAT-K3-01", "Herfst"),
            ],
            doelen: [Doel("NAT-K3-01")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(["Herfst"], Doelvan(dekking, "NAT-K3-01").DekkendeThemas);
        Assert.Equal(1, dekking.AantalGedekt);
    }

    [Fact]
    public async Task Een_leeg_jaarplan_dekt_niets_en_is_geen_fout()
    {
        // Art. IX.3 says a klas HAS a jaarplan, so a class that has never generated yields an empty plan rather
        // than a not-found. 0 of the whole curriculum is the honest answer, and it is a trustworthy 0: nothing is
        // unresolved.
        var opslag = new FakeDekkingOpslag([], [Doel("NAT-K3-01"), Doel("NAT-K3-02")]);
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.True(dekking.IsBetrouwbaar);
        Assert.Equal(0, dekking.AantalGedekt);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
        Assert.All(dekking.Doelen, d => Assert.False(d.IsGedekt));

        // No placed thema means the link tables are never touched.
        Assert.Equal(0, opslag.AantalKoppelingAanroepen);
    }

    // The NietMeerInOpstap pass-through is asserted in DekkingLagenPostgresTests instead of here, and deliberately
    // so: Leerplandoel exposes NO public mutator for that flag (Art. III.1 keeps official content immutable to
    // ordinary app code; only the sanctioned import path sets it, through EF property metadata). Reaching it from a
    // unit test would mean either reflection or adding the mutator the domain refuses to have, and the second would
    // be a real weakening of an invariant in exchange for a cheaper test.

    [Fact]
    public async Task Doelen_staan_op_domein_subdomein_code_zodat_de_gaplijst_en_de_doelenlijst_niet_verschillen()
    {
        var service = Maak(
            plaatsingen: [],
            koppelingen: [],
            doelen:
            [
                Doel("B-02", domein: "Wereld", subdomein: "Techniek"),
                Doel("B-01", domein: "Wereld", subdomein: "Techniek"),
                Doel("A-01", domein: "Wereld", subdomein: "Natuur"),
                Doel("C-01", domein: "Taal", subdomein: "Lezen"),
            ]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(["C-01", "A-01", "B-01", "B-02"], dekking.Doelen.Select(d => d.Code));
    }

    [Fact]
    public async Task Een_onbekende_status_dekt_niets_en_blijft_als_onopgelost_gelden()
    {
        // Fail closed, in both directions. ThemaplaatsingWeergave carries the status as a string, so an unknown
        // value is reachable if the enum ever grows and this code is not updated. A coverage claim this code cannot
        // justify is worse than a missing one; and an unreadable status must not be able to silently restore
        // confidence in the figure either.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", status: "Onbekend", isVervallen: true)],
            koppelingen: [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            doelen: [Doel("NAT-K3-01")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.False(Doelvan(dekking, "NAT-K3-01").IsGedekt);
        Assert.False(dekking.IsBetrouwbaar);
        Assert.Equal(1, dekking.AantalOnopgelosteVervallenPlaatsingen);
    }

    [Fact]
    public async Task De_minimumdoelref_reist_mee_maar_er_wordt_niets_op_minimumdoelniveau_beweerd()
    {
        // E5-04 rolls coverage up to minimumdoel level, which is the level the onderwijsinspectie tests
        // (Art. V.2). It is blocked on E1-12 — no Minimumdoel row can exist yet — so this story carries the
        // concordance key and claims nothing about it. The test exists so a reader does not mistake the presence of
        // the field for the presence of the roll-up.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)],
            koppelingen: [new DekkendeKoppeling("MD-01", "Herfst")],
            doelen: [Doel("MD-01", minimumdoelRef: "K-3")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal("K-3", Doelvan(dekking, "MD-01").MinimumdoelRef);
        Assert.True(Doelvan(dekking, "MD-01").IsGedekt);
    }

    [Fact]
    public async Task De_noemer_is_vandaag_het_hele_curriculum_en_dat_is_een_open_beslissing()
    {
        // Pinned so the open Art. XIV decision is visible as a test rather than only as a comment. The service passes
        // NO jaar/fase scope, so a K3 class is measured against every loaded goal. That is not a considered answer —
        // Klas keys nothing on Leerjaar while graadklassen are unresolved — and when the ruling lands, THIS test is
        // the one that should fail and be rewritten, which is the point of asserting it explicitly.
        var opslag = new FakeDekkingOpslag([], [Doel("K3-01"), Doel("L6-99")]);
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.True(opslag.HeeftLeerplandoelenGevraagd);
        Assert.Null(opslag.GevraagdeJaarFasen);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
    }

    [Fact]
    public async Task De_klas_en_het_schooljaar_komen_uit_het_plan_zelf()
    {
        // Not fetched separately: the plan already names them, and a second lookup could disagree with the
        // projection the staleness came from.
        var service = Maak(plaatsingen: [], koppelingen: [], doelen: []);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(KlasId, dekking.KlasId);
        Assert.Equal("K3 derde kleuterklas", dekking.KlasNaam);
        Assert.Equal("2026-2027", dekking.SchooljaarNaam);
    }

    private static DekkingService Maak(
        IReadOnlyList<ThemaplaatsingWeergave> plaatsingen,
        IReadOnlyList<DekkendeKoppeling> koppelingen,
        IReadOnlyList<Leerplandoel> doelen) =>
        new(
            new FakeJaarplanLezer(Plan(plaatsingen)),
            new FakeDekkingOpslag(koppelingen, doelen));

    private static JaarplanWeergave Plan(IReadOnlyList<ThemaplaatsingWeergave> plaatsingen) =>
        new(
            KlasId,
            "K3 derde kleuterklas",
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            "2026-2027",
            "themaperiode (4-6 weken)",
            plaatsingen);

    private static ThemaplaatsingWeergave Plaatsing(
        Guid themaId,
        string themaNaam,
        KoppelingStatus status,
        bool isVervallen = false,
        DateOnly? blokStart = null) =>
        Plaatsing(themaId, themaNaam, status.ToString(), isVervallen, blokStart);

    private static ThemaplaatsingWeergave Plaatsing(
        Guid themaId,
        string themaNaam,
        string status,
        bool isVervallen = false,
        DateOnly? blokStart = null) =>
        new(
            Guid.NewGuid(),
            themaId,
            themaNaam,
            "Themaperiode",
            blokStart ?? new DateOnly(2026, 9, 1),
            isVervallen ? null : new DateOnly(2026, 10, 9),
            isVervallen ? null : 1,
            isVervallen,
            status,
            null,
            false,
            []);

    private static Leerplandoel Doel(
        string code,
        string domein = "Natuur",
        string subdomein = "Levende natuur",
        string? minimumdoelRef = null) =>
        new(
            code,
            Doelsoort.Gemeenschappelijk,
            "K3",
            domein,
            subdomein,
            "9.1",
            tekst: $"Tekst van {code}",
            minimumdoelRef: minimumdoelRef);

    private static LeerplandoelDekking Doelvan(DekkingWeergave dekking, string code) =>
        dekking.Doelen.Single(d => d.Code == code);
}
