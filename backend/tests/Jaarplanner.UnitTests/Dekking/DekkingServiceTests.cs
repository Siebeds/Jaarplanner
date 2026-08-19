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

    /// <summary>
    /// The leerjaar every fake in this file is given: 0, a kleutergroep, matching the plan's own "K3 derde
    /// kleuterklas" and the <see cref="Doel"/> helper's <c>K3</c> jaar/fase.
    /// <para>
    /// <b>Not a detail.</b> Since the owner ruling of 2026-08-04 the production default is
    /// <c>Dekkingsbereik.EigenJaarFase</c>, and a fake left with <c>Leerjaar = null</c> runs the whole-curriculum
    /// <i>fallback</i> instead: the test still passes, for a different reason than the one it was written for. Five
    /// tests here did exactly that for a while, including the Art. IV.1 one, which is why this constant exists rather
    /// than the value being repeated.
    /// </para>
    /// </summary>
    private const int KleuterLeerjaar = 0;

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
            [Doel("NAT-K3-01")])
        { Leerjaar = KleuterLeerjaar };

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
            [Doel("NAT-K3-01")])
        { Leerjaar = KleuterLeerjaar };

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
            [Doel("NAT-K3-01")])
        { Leerjaar = KleuterLeerjaar };

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
            [Doel("NAT-K3-01")])
        { Leerjaar = KleuterLeerjaar };

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
        // than a not-found. 0 of the doelen IN SCOPE is the honest answer, and it is a trustworthy 0: nothing is
        // unresolved.
        var opslag = new FakeDekkingOpslag([], [Doel("NAT-K3-01"), Doel("NAT-K3-02")])
        {
            Leerjaar = KleuterLeerjaar,
        };
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

    // ── The denominator (E5-02, owner ruling 2026-08-04) ────────────────────────────────────────────────────────
    //
    // E5-01 left a test here named "De_noemer_is_vandaag_het_hele_curriculum_en_dat_is_een_open_beslissing", whose
    // own comment said: when the ruling lands, THIS test is the one that should fail and be rewritten. It landed, so
    // the tests below replace it. Kept as a note rather than silently deleted, because the instruction working as
    // intended is the argument for writing that kind of test in the first place.

    [Fact]
    public async Task Een_klas_wordt_standaard_tegen_haar_eigen_jaar_fase_gemeten()
    {
        // The ruling as a request AND as an answer. A kleutergroep (leerjaar 0) is measured against the three kleuter
        // codes, so the L6 goal is not this class's lacune and does not sit in its denominator.
        var opslag = new FakeDekkingOpslag([], [Doel("K3-01"), Doel("L6-99", jaarFase: "L6")]) { Leerjaar = 0 };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(["JK", "K2", "K3"], opslag.GevraagdeJaarFasen);
        Assert.Equal(Dekkingsbereik.EigenJaarFase, dekking.Bereik);
        Assert.Equal(["JK", "K2", "K3"], dekking.GemetenJaarFasen);
        Assert.False(dekking.IsTerugvalNaarHeelCurriculum);

        // One goal in scope, one left out, and the number that says so. Without AantalBuitenBereik a narrowed
        // denominator would be indistinguishable from a smaller curriculum.
        Assert.Equal(1, dekking.AantalLeerplandoelen);
        Assert.Equal(1, dekking.AantalBuitenBereik);
        Assert.Equal("K3-01", Assert.Single(dekking.Doelen).Code);
    }

    [Fact]
    public async Task Een_leerjaar_van_het_lager_levert_precies_dat_ene_leerjaar_op()
    {
        var opslag = new FakeDekkingOpslag([], [Doel("L3-01", jaarFase: "L3"), Doel("L4-01", jaarFase: "L4")])
        {
            Leerjaar = 3,
        };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId);

        // Exactly L3: not "L1 through L3", because dekking asks what this class teaches this year, not what its
        // pupils have ever been taught.
        Assert.Equal(["L3"], dekking.GemetenJaarFasen);
        Assert.Equal("L3-01", Assert.Single(dekking.Doelen).Code);
    }

    [Fact]
    public async Task Een_kleutergroep_kan_versmald_worden_tot_een_kleuterjaar()
    {
        // OWNER RULING 2026-08-04. Leerjaar 0 says "kleutergroep" and not WHICH kleuterjaar, so the derived scope is all
        // three codes and a derde kleuterklas carries roughly three times the doelen it teaches: its figure reads about
        // a third of what it is, and its gap list names doelen for two-and-a-half-year-olds. The teacher narrows it.
        var opslag = new FakeDekkingOpslag(
            [],
            [Doel("JK-01", jaarFase: "JK"), Doel("K2-01", jaarFase: "K2"), Doel("K3-01", jaarFase: "K3")])
        {
            Leerjaar = KleuterLeerjaar,
        };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId, jaarFase: "K3");

        // Measured against K3 alone...
        Assert.Equal(["K3"], opslag.GevraagdeJaarFasen);
        Assert.Equal(["K3"], dekking.GemetenJaarFasen);
        Assert.Equal("K3-01", Assert.Single(dekking.Doelen).Code);
        Assert.Equal(1, dekking.AantalLeerplandoelen);
        Assert.Equal(2, dekking.AantalBuitenBereik);

        // ...while still reporting what it narrowed FROM, or the screen could not offer the alternatives.
        Assert.Equal(["JK", "K2", "K3"], dekking.BeschikbareJaarFasen);
        Assert.Equal(Dekkingsbereik.EigenJaarFase, dekking.Bereik);
        Assert.False(dekking.IsTerugvalNaarHeelCurriculum);
    }

    [Fact]
    public async Task Zonder_keuze_meet_een_kleutergroep_tegen_alle_drie()
    {
        var opslag = new FakeDekkingOpslag(
            [],
            [Doel("JK-01", jaarFase: "JK"), Doel("K3-01", jaarFase: "K3")])
        { Leerjaar = KleuterLeerjaar };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Equal(["JK", "K2", "K3"], dekking.GemetenJaarFasen);
        Assert.Equal(["JK", "K2", "K3"], dekking.BeschikbareJaarFasen);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
    }

    [Theory]
    [InlineData("L6")]
    [InlineData("k3")]
    [InlineData("")]
    public async Task Een_jaar_fase_die_deze_klas_niet_heeft_wordt_genegeerd(string jaarFase)
    {
        // Narrowing is a filter over what this class HAS, never free choice: nobody may measure a kleutergroep against
        // L6. Ignored rather than refused, because a 400 would take a teacher who followed a stale link off a working
        // screen — and the payload stays honest because GemetenJaarFasen reports what was APPLIED. "k3" is in the set
        // only under case folding, and the comparison is deliberately ordinal: stored codes are canonical (owner ruling
        // 2026-08-03, the import normalises), so folding here would mask an import that did not.
        var opslag = new FakeDekkingOpslag([], [Doel("K3-01", jaarFase: "K3")]) { Leerjaar = KleuterLeerjaar };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId, jaarFase: jaarFase);

        Assert.Equal(["JK", "K2", "K3"], dekking.GemetenJaarFasen);
    }

    [Fact]
    public async Task Een_klas_met_een_enkel_leerjaar_valt_niet_te_versmallen()
    {
        // An L3 class has exactly one code, so there is nothing to choose and nothing to get wrong. Asserted because the
        // narrowing guard keys on "more than one available" rather than on "is this a kleutergroep", which is a question
        // the data model cannot answer and a future graadklas ruling would answer differently.
        var opslag = new FakeDekkingOpslag([], [Doel("L3-01", jaarFase: "L3")]) { Leerjaar = 3 };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId, jaarFase: "L1");

        Assert.Equal(["L3"], dekking.GemetenJaarFasen);
        Assert.Equal(["L3"], dekking.BeschikbareJaarFasen);
    }

    [Fact]
    public async Task Het_hele_curriculum_negeert_een_jaar_fase_keuze()
    {
        var opslag = new FakeDekkingOpslag([], [Doel("K3-01"), Doel("L6-01", jaarFase: "L6")]) { Leerjaar = KleuterLeerjaar };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId, Dekkingsbereik.HeelCurriculum, jaarFase: "K3");

        Assert.Null(opslag.GevraagdeJaarFasen);
        Assert.Empty(dekking.GemetenJaarFasen);
        Assert.Empty(dekking.BeschikbareJaarFasen);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
    }

    [Fact]
    public async Task Het_hele_curriculum_is_een_expliciete_keuze_en_vraagt_geen_leerjaar()
    {
        var opslag = new FakeDekkingOpslag([], [Doel("K3-01"), Doel("L6-99", jaarFase: "L6")]) { Leerjaar = 0 };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId, Dekkingsbereik.HeelCurriculum);

        Assert.Null(opslag.GevraagdeJaarFasen);
        Assert.Equal(Dekkingsbereik.HeelCurriculum, dekking.Bereik);
        Assert.Empty(dekking.GemetenJaarFasen);
        Assert.Equal(2, dekking.AantalLeerplandoelen);

        // Two queries this path cannot need: the class's leerjaar is irrelevant, and the unscoped list already IS the
        // total, so counting it again would be a round trip whose answer is `Doelen.Count`.
        Assert.False(opslag.HeeftLeerjaarGevraagd);
        Assert.Equal(0, opslag.AantalTelAanroepen);
        Assert.Equal(0, dekking.AantalBuitenBereik);
    }

    [Theory]
    [InlineData(7)]
    [InlineData(-1)]
    [InlineData(null)]
    public async Task Een_klas_zonder_afleidbare_jaar_fase_valt_terug_op_alles_en_zegt_dat(int? leerjaar)
    {
        // The unresolved half of the Art. XIV decision: a graadklas ordinal nobody can map, and a class deleted
        // between the two reads. Both must WIDEN the scope, never narrow it — a class measured against nothing would
        // report having nothing left to cover, which is the one direction this figure must not move by itself.
        var opslag = new FakeDekkingOpslag([], [Doel("K3-01"), Doel("L6-99", jaarFase: "L6")]) { Leerjaar = leerjaar };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Null(opslag.GevraagdeJaarFasen);
        Assert.Equal(2, dekking.AantalLeerplandoelen);
        Assert.Equal(0, dekking.AantalBuitenBereik);

        // Bereik reports what was APPLIED, and the flag is what says the caller did not choose it. Both, because
        // either one alone leaves the screen unable to explain why it is showing more than was asked for.
        Assert.Equal(Dekkingsbereik.HeelCurriculum, dekking.Bereik);
        Assert.True(dekking.IsTerugvalNaarHeelCurriculum);
    }

    [Fact]
    public async Task Nul_doelen_in_bereik_is_niet_hetzelfde_als_alles_gedekt()
    {
        // A class scoped to L3 in a school that has only loaded kleuterdoelen. The figure is a truthful 0 of 0, and
        // the ONLY thing that distinguishes it from an empty database is AantalBuitenBereik. A screen that reads
        // "aantalGedekt == aantalLeerplandoelen" as success would congratulate this teacher.
        var opslag = new FakeDekkingOpslag([], [Doel("K3-01"), Doel("K3-02")]) { Leerjaar = 3 };
        var service = new DekkingService(new FakeJaarplanLezer(Plan([])), opslag);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.Empty(dekking.Doelen);
        Assert.Equal(0, dekking.AantalLeerplandoelen);
        Assert.Equal(0, dekking.AantalGedekt);
        Assert.Equal(2, dekking.AantalBuitenBereik);
        Assert.False(dekking.IsTerugvalNaarHeelCurriculum);
    }

    [Fact]
    public async Task Een_vervallen_plaatsing_houdt_het_cijfer_tegen_ook_binnen_een_bereik()
    {
        // The two rules are independent and must compose: scoping decides WHAT is measured, the stale-placement
        // ruling decides WHETHER a total may be printed at all. A scoped denominator is still present in that state,
        // because it is a property of the curriculum rather than of the broken placement.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard, isVervallen: true)],
            koppelingen: [],
            doelen: [Doel("K3-01"), Doel("L6-99", jaarFase: "L6")]);

        var dekking = await service.BerekenAsync(KlasId);

        Assert.False(dekking.IsBetrouwbaar);
        Assert.Null(dekking.AantalGedekt);
        Assert.Equal(1, dekking.AantalLeerplandoelen);
        Assert.Equal(Dekkingsbereik.EigenJaarFase, dekking.Bereik);
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

    // ---------------------------------------------------------------------------------------------------------
    // THE GAP-ANALYSE (E5-05, FR-9): why an uncovered goal is uncovered, and which thema's a teacher acts on.
    //
    // Art. V.6 puts this file's subject among the two highest-risk pieces of logic in the system, so every cause and
    // the order between them gets its own named test. The order is the part worth testing hardest:
    // a doel can sit in several states at once, and reporting the wrong one sends a teacher to the wrong screen.
    // ---------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Een_doel_in_een_voorgesteld_geplaatst_thema_wacht_op_een_beslissing()
    {
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld)],
            // No covering link: a voorgesteld placement grants no dekking (Art. IV.1), which is what makes this a gap.
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten: [Kandidaat("NAT-K3-01", HerfstId, "Herfst")]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.False(doel.IsGedekt);
        Assert.Equal(Lacuneoorzaak.WachtOpBeslissing, doel.Oorzaak);
        Assert.Equal(["Herfst"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_doel_waarvan_het_thema_nergens_staat_is_niet_ingepland()
    {
        var service = Maak(
            // The thema exists and carries a decided link; it is simply in no period of this plan.
            plaatsingen: [],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten: [Kandidaat("NAT-K3-01", HerfstId, "Herfst")]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.NietIngepland, doel.Oorzaak);
        Assert.Equal(["Herfst"], doel.KandidaatThemas);
    }

    [Theory]
    [InlineData(KoppelingStatus.Voorgesteld, true)]
    [InlineData(KoppelingStatus.Aanvaard, true)]
    [InlineData(KoppelingStatus.Geweigerd, true)]
    public async Task Een_thema_dat_in_geen_enkele_periode_meer_staat_maakt_de_lacune_niet_ingepland(
        KoppelingStatus status,
        bool isVervallen)
    {
        // THE TWO STATES Lacuneoorzaak.NietIngepland DELIBERATELY FOLDS TOGETHER, driven rather than described: all
        // three rows here are STALE, and a stale placement is drawn in no period column whatever its status, so "sits
        // in no period" is true of every one of them. The remedy is the same too: put the thema in a period. The
        // "never placed" state is the test above.
        //
        // (Geweigerd, false) IS NOT IN THIS THEORY ANY MORE, and that is the whole of antagonist ronde 1's MAJOR-1:
        // a rejected, non-stale placement IS drawn in its period, so this sentence was false in front of a visible
        // card and the route sent the teacher to a picker that disables that thema in exactly that period. It moved to
        // Een_geweigerde_plaatsing_is_haar_eigen_oorzaak below. The rejected-AND-stale row above is the boundary, and
        // it is here rather than there on purpose: it is the case where the folded sentence really is true.
        //
        // The stale cases are the ones that could plausibly go wrong: their thema IS in the plan, so a classification
        // that asked "is this thema placed" rather than "is this thema placed in a period that still exists" would
        // report WachtOpBeslissing and send a teacher to accept a card that sits nowhere.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", status, isVervallen: isVervallen)],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten: [Kandidaat("NAT-K3-01", HerfstId, "Herfst")]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.NietIngepland, doel.Oorzaak);
    }

    [Fact]
    public async Task Een_geweigerde_plaatsing_is_haar_eigen_oorzaak()
    {
        // ANTAGONIST RONDE 1, MAJOR-1 (2026-08-19). The teacher rejected the AI's proposal for Herfst in this period.
        // The card stays visible in that period column (`plaatsingenIn` excludes stale placements and not rejected
        // ones), so the folded NietIngepland copy — "staat in geen enkele periode van dit jaarplan" — contradicted
        // what the kalender was showing, and its route was worse than useless: `Themakiezer` DISABLES this thema in
        // this very period, so a teacher following "put it in a period" met a control that refuses them. The remedy is
        // Weigering terugdraaien on the card, which is a different action, so it is a different cause.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Geweigerd, isVervallen: false)],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten: [Kandidaat("NAT-K3-01", HerfstId, "Herfst")]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.PlaatsingGeweigerd, doel.Oorzaak);

        // The thema is named, because the teacher has to know WHICH rejection to undo, and it is the thema belonging
        // to this cause rather than every thema linked to the goal.
        Assert.Equal(["Herfst"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_open_voorstel_gaat_voor_op_een_weigering_elders()
    {
        // The ordering rule where it can actually be observed: two thema's carry the goal, one standing as an
        // unanswered proposal and one rejected. Cheapest route wins, so the doel reports WachtOpBeslissing and names
        // ONLY that thema — a teacher told to undo a rejection when a single "Aanvaarden" click would do is being
        // sent the long way round.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, "Herfst", KoppelingStatus.Geweigerd, isVervallen: false),
                Plaatsing(WinterId, "Winter", KoppelingStatus.Voorgesteld, isVervallen: false),
            ],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten:
            [
                Kandidaat("NAT-K3-01", HerfstId, "Herfst"),
                Kandidaat("NAT-K3-01", WinterId, "Winter"),
            ]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.WachtOpBeslissing, doel.Oorzaak);
        Assert.Equal(["Winter"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_doel_met_alleen_een_onbesliste_koppeling_wacht_op_die_koppeling()
    {
        // The ordinary state right after FR-4 matching: the AI proposed a link and nobody has answered it. Planning
        // the thema would not help, because only aanvaard/manueel links count (Art. V.1) — so this cause routes to
        // the thema-screen and not to the kalender, and the placement below is there to prove the classification is
        // driven by the LINK rather than by where the thema sits.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten: [Kandidaat("NAT-K3-01", HerfstId, "Herfst", isBeslist: false)]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.KoppelingNietBeslist, doel.Oorzaak);
        Assert.Equal(["Herfst"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_doel_dat_geen_enkel_thema_draagt_krijgt_geen_kandidaat()
    {
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten: []);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.GeenThema, doel.Oorzaak);

        // Empty rather than "the thema's that are linked but rejected": the port never returns a rejected link, so
        // this cause has nothing it could name. The copy constraint that follows from it is on IDekkingOpslag.
        Assert.Empty(doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_gedekt_doel_heeft_geen_oorzaak_en_geen_kandidaten()
    {
        // Null rather than a fifth enum member: "not applicable" and "we could not work out why" would otherwise be
        // the same value, and only one of them is ever true. The candidate list is deliberately non-empty in the
        // fixture, so this asserts the covered branch ignores it rather than that there was nothing to ignore.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard)],
            koppelingen: [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            doelen: [Doel("NAT-K3-01")],
            kandidaten: [Kandidaat("NAT-K3-01", HerfstId, "Herfst")]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.True(doel.IsGedekt);
        Assert.Null(doel.Oorzaak);
        Assert.Empty(doel.KandidaatThemas);
        Assert.Equal(["Herfst"], doel.DekkendeThemas);
    }

    [Fact]
    public async Task De_goedkoopste_route_wint_en_noemt_alleen_de_themas_van_die_oorzaak()
    {
        // One doel, two thema's, two different situations: Herfst stands in the plan awaiting an answer, Winter
        // carries the same goal and is nowhere. Both are true; only one is worth doing first.
        //
        // The second assertion is the one that matters. Naming both thema's would leave a teacher unable to tell
        // which name goes with the action the line describes, which is the failure this classification exists to
        // prevent — and it is the assertion that would still pass if the ordering were right and the filtering wrong.
        var service = Maak(
            plaatsingen: [Plaatsing(HerfstId, "Herfst", KoppelingStatus.Voorgesteld)],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten:
            [
                Kandidaat("NAT-K3-01", HerfstId, "Herfst"),
                Kandidaat("NAT-K3-01", WinterId, "Winter"),
            ]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.WachtOpBeslissing, doel.Oorzaak);
        Assert.Equal(["Herfst"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Een_beslist_thema_verslaat_een_onbesliste_koppeling_op_hetzelfde_doel()
    {
        // The other ordering pair, and the one a single-thema fixture cannot reach: the SAME thema carries the goal
        // both as a decided link and as an undecided suggestion, which the storage read returns as two rows on
        // purpose. NietIngepland is the honest answer — the decided link already exists, so telling the teacher to go
        // decide a link would send them to a screen where the work is done.
        var service = Maak(
            plaatsingen: [],
            koppelingen: [],
            doelen: [Doel("NAT-K3-01")],
            kandidaten:
            [
                Kandidaat("NAT-K3-01", HerfstId, "Herfst", isBeslist: false),
                Kandidaat("NAT-K3-01", HerfstId, "Herfst"),
            ]);

        var doel = Doelvan(await service.BerekenAsync(KlasId), "NAT-K3-01");

        Assert.Equal(Lacuneoorzaak.NietIngepland, doel.Oorzaak);
        Assert.Equal(["Herfst"], doel.KandidaatThemas);
    }

    [Fact]
    public async Task Wachtend_op_een_beslissing_is_precies_het_verschil_tussen_vooruitzicht_en_dekking()
    {
        // THE PIN BETWEEN THE TWO STORIES. E3-03 counts what accepting every standing proposal would cover and says
        // in its own type that WHICH doelen those are is E5-05's to list. If these two ever compute different sets, a
        // teacher reads "accepting this plan would cover 3 more doelen" beside a list naming a different number of
        // them, and neither figure is believable afterwards.
        //
        // The fixture makes the difference non-trivial in both directions: one doel is already covered (so it is in
        // neither set), one is one accept away, one is carried only by an unplanned thema, and one by nothing at all.
        var service = Maak(
            plaatsingen:
            [
                Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, "Winter", KoppelingStatus.Voorgesteld),
            ],
            koppelingen: [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            doelen: [Doel("NAT-K3-01"), Doel("NAT-K3-02"), Doel("NAT-K3-03"), Doel("NAT-K3-04")],
            kandidaten:
            [
                Kandidaat("NAT-K3-01", HerfstId, "Herfst"),
                Kandidaat("NAT-K3-02", WinterId, "Winter"),
                Kandidaat("NAT-K3-03", Guid.NewGuid(), "Lente"),
            ]);

        // The vooruitzicht's own fake has to answer per thema for its two reads to differ at all; see
        // FakeDekkingOpslag.KoppelingenPerThema for why an unfiltered fake makes that figure equal by construction.
        var opslag = new FakeDekkingOpslag(
            [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
            [Doel("NAT-K3-01"), Doel("NAT-K3-02"), Doel("NAT-K3-03"), Doel("NAT-K3-04")])
        {
            Leerjaar = KleuterLeerjaar,
            KoppelingenPerThema = new Dictionary<Guid, IReadOnlyList<DekkendeKoppeling>>
            {
                [HerfstId] = [new DekkendeKoppeling("NAT-K3-01", "Herfst")],
                [WinterId] = [new DekkendeKoppeling("NAT-K3-02", "Winter")],
            },
        };

        var metVooruitzicht = new DekkingService(
            new FakeJaarplanLezer(Plan(
            [
                Plaatsing(HerfstId, "Herfst", KoppelingStatus.Aanvaard),
                Plaatsing(WinterId, "Winter", KoppelingStatus.Voorgesteld),
            ])),
            opslag);

        var vooruitzicht = await metVooruitzicht.BerekenVooruitzichtAsync(KlasId);
        var dekking = await service.BerekenAsync(KlasId);

        var wachtend = dekking.Doelen
            .Where(d => d.Oorzaak == Lacuneoorzaak.WachtOpBeslissing)
            .Select(d => d.Code)
            .ToList();

        Assert.Equal(["NAT-K3-02"], wachtend);
        Assert.Equal(vooruitzicht.AantalMogelijkGedekt - vooruitzicht.AantalGedekt, wachtend.Count);
    }

    /// <summary>
    /// The service under test, with a class that <b>can</b> state its own jaar/fase.
    /// <para>
    /// <c>leerjaar: 0</c> is not an incidental default. Since the owner ruling of 2026-08-04 the production default is
    /// <c>Dekkingsbereik.EigenJaarFase</c>, and a fake whose leerjaar was left null would send every one of these
    /// tests down the <i>fallback</i> path instead — they would all still pass, for a different reason than before,
    /// which is precisely the kind of silent semantic change that makes a green suite meaningless. 0 is the
    /// kleutergroep, which matches the plan's own "K3 derde kleuterklas" and the <see cref="Doel"/> helper's
    /// <c>K3</c> jaar/fase, so the scope contains the goals these tests are about.
    /// </para>
    /// </summary>
    private static DekkingService Maak(
        IReadOnlyList<ThemaplaatsingWeergave> plaatsingen,
        IReadOnlyList<DekkendeKoppeling> koppelingen,
        IReadOnlyList<Leerplandoel> doelen,
        int? leerjaar = 0,
        IReadOnlyList<KandidaatKoppeling>? kandidaten = null) =>
        new(
            new FakeJaarplanLezer(Plan(plaatsingen)),
            new FakeDekkingOpslag(koppelingen, doelen)
            {
                Leerjaar = leerjaar,
                // Empty unless a test says otherwise, which classifies every gap as GeenThema. That is the honest
                // default rather than a convenient one: a school with no linked content is exactly the state in which
                // no thema accounts for any goal.
                Kandidaten = kandidaten ?? [],
            });

    private static JaarplanWeergave Plan(IReadOnlyList<ThemaplaatsingWeergave> plaatsingen) =>
        new(
            KlasId,
            "K3 derde kleuterklas",
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            "2026-2027",
            "themaperiode (4-6 weken)",
            plaatsingen,
            // Dekking does not read the per-block load (E3-09) and must not start to: how full a period is says
            // nothing about whether a goal is taught in it. Empty rather than populated, so a future coupling shows
            // up as a test that needs data instead of one that silently passes on a fixture's leftovers.
            []);

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
            [],
            // A nominal duration, not 0: `DuurWeken` is `RequirePositive` in the domain, and 0 is reserved for the
            // "thema could not be resolved" degrade. Dekking ignores the field either way.
            4);

    private static Leerplandoel Doel(
        string code,
        string domein = "Natuur",
        string subdomein = "Levende natuur",
        string? minimumdoelRef = null,
        string jaarFase = "K3") =>
        new(
            code,
            Doelsoort.Gemeenschappelijk,
            jaarFase,
            domein,
            subdomein,
            "9.1",
            tekst: $"Tekst van {code}",
            minimumdoelRef: minimumdoelRef);

    /// <summary>
    /// One candidate link for the gap-analyse. <c>isBeslist</c> defaults to <c>true</c> because a decided link is the
    /// ordinary case: an undecided one is the specific state FR-4 matching leaves behind, and a test about it should
    /// have to say so.
    /// </summary>
    private static KandidaatKoppeling Kandidaat(
        string code,
        Guid themaId,
        string themaNaam,
        bool isBeslist = true) =>
        new(code, themaId, themaNaam, isBeslist);

    private static LeerplandoelDekking Doelvan(DekkingWeergave dekking, string code) =>
        dekking.Doelen.Single(d => d.Code == code);
}
