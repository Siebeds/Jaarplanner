using Jaarplanner.Application.Planning;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Planning;
using Jaarplanner.UnitTests.Ai;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// Pins the E3-01 end-to-end generation flow (FR-5.1, Art. IV.1/IV.2/IV.3/IV.5/IV.6): given a class, the service
/// asks the <see cref="IPlanningsblokIndeling"/> seam for the year's blocks, builds the grounded prompt, calls the
/// injected <see cref="FakeAiClient"/> with <b>no network</b>, validates the completion and persists each validated
/// placement as a <c>voorgesteld</c> <see cref="Themaplaatsing"/> with its motivation — via
/// <see cref="FakeJaarplanOpslag"/> with <b>no database</b>.
/// <para>
/// These tests are the "Done when" evidence at service level: a class yields a reviewable generated plan through a
/// faked AI client, keyed on the block start date, and a malformed response persists nothing. The endpoint-level
/// evidence — that a caller can actually reach this — is <c>JaarplanEndpointsTests</c>.
/// </para>
/// </summary>
public sealed class JaarplanGeneratieServiceTests
{
    private static readonly IPlanningsblokIndeling Indeling =
        new GeconfigureerdePlanningsblokIndeling(new PlanningsblokOptions());

    private static IReadOnlyList<Planningsblok> Blokken(Schooljaar schooljaar) =>
        Indeling.Blokken(schooljaar, JaarplanGeneratieService.GeneratieNiveau);

    private static Thema Herfst()
    {
        var thema = new Thema("Herfst", duurWeken: 5, invalshoeken: "natuur");
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Aanvaard, "anchor"));
        thema.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-02", KoppelingStatus.Voorgesteld, "nog niet beslist"));

        return thema;
    }

    private static Thema Water() => new("Water", duurWeken: 5);

    private static (JaarplanGeneratieService Service, FakeJaarplanOpslag Opslag, FakeAiClient Client, Klas Klas,
        Schooljaar Schooljaar, IReadOnlyList<Thema> Themas) Opzet(
            string antwoord,
            Schooljaar? schooljaar = null,
            Jaarplan? jaarplan = null)
    {
        schooljaar ??= TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var themas = new List<Thema> { Herfst(), Water() };
        var opslag = new FakeJaarplanOpslag(klas, schooljaar, themas, jaarplan);
        var client = new FakeAiClient(antwoord);

        return (new JaarplanGeneratieService(client, Indeling, opslag), opslag, client, klas, schooljaar, themas);
    }

    private static string Antwoord(params (string Thema, DateOnly Blok)[] plaatsingen) =>
        "{\"plaatsingen\":[" +
        string.Join(",", plaatsingen.Select(p =>
            $"{{\"blokStart\":\"{p.Blok:yyyy-MM-dd}\",\"thema\":\"{p.Thema}\",\"motivatie\":\"past hier\"}}")) +
        "]}";

    [Fact]
    public async Task Geldig_antwoord_wordt_als_voorgesteld_voorstel_met_motivatie_gepersisteerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, client, klas, _, themas) = Opzet(
            Antwoord(("Herfst", blokken[0].Start), ("Water", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Null(resultaat.Fout);
        Assert.Equal(2, resultaat.AantalNieuw);
        Assert.Equal(0, resultaat.AantalBehouden);

        // Every placement is `voorgesteld` with a motivation — advisory, never auto-applied (Art. IV.1/IV.2/IV.3).
        var plan = resultaat.Jaarplan!;
        Assert.Equal(2, plan.Plaatsingen.Count);
        Assert.All(plan.Plaatsingen, p => Assert.Equal("Voorgesteld", p.Status));
        Assert.All(plan.Plaatsingen, p => Assert.Equal("past hier", p.AiMotivatie));
        Assert.All(plan.Plaatsingen, p => Assert.False(p.Vergrendeld));

        // Keyed on the block START DATE, and the derived period is projected alongside it for display.
        var herfst = plan.Plaatsingen.Single(p => p.ThemaNaam == "Herfst");
        Assert.Equal(blokken[0].Start, herfst.BlokStart);
        Assert.Equal(blokken[0].Eind, herfst.BlokEind);
        Assert.Equal(blokken[0].Ordinaal, herfst.BlokOrdinaal);
        Assert.False(herfst.IsVervallen);
        Assert.Equal("Themaperiode", herfst.BlokNiveau);

        // "Thema's + goals" (FR-5.1): the goals are DERIVED from the thema, and only aanvaard/manueel count
        // (Art. V.1) — dekking is computed, never stored on the plan.
        Assert.Equal(["NAT-K3-01"], herfst.Doelcodes);

        // The flow reached the injected client (no network) exactly once, and committed once.
        Assert.Equal(1, client.AantalAanroepen);
        Assert.Equal(1, opslag.AantalKeerBewaard);
        Assert.Equal(2, themas.Count);
    }

    [Fact]
    public async Task Ongeldig_antwoord_persisteert_niets_en_geeft_een_diagnose()
    {
        var (service, opslag, _, klas, _, _) = Opzet("dit is geen JSON {kapot");

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.False(resultaat.IsGeslaagd);
        Assert.NotNull(resultaat.Fout);
        Assert.Null(resultaat.Jaarplan);

        // Nothing added, nothing committed, and no plan was even created (Art. IV.5).
        Assert.Equal(0, opslag.AantalKeerBewaard);
        Assert.Null(opslag.Jaarplan);
    }

    /// <summary>
    /// A failed run must not even clear the previous proposal — otherwise a bad model response would silently wipe a
    /// teacher's plan. Validation happens before the plan is touched at all.
    /// </summary>
    [Fact]
    public async Task Ongeldig_antwoord_laat_een_bestaand_voorstel_ongemoeid()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();

        var jaarplan = new Jaarplan(klas.Id);
        jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Voorgesteld, "eerder");

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst], jaarplan);
        var service = new JaarplanGeneratieService(new FakeAiClient("{niet geldig"), Indeling, opslag);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.False(resultaat.IsGeslaagd);
        Assert.Equal(0, opslag.AantalKeerBewaard);

        // The earlier proposal is still there, untouched — a bad model answer never wipes a plan.
        var overgebleven = Assert.Single(jaarplan.Plaatsingen);
        Assert.Equal("eerder", overgebleven.AiMotivatie);
        Assert.Equal(blokken[0].Start, overgebleven.BlokStart);
    }

    [Fact]
    public async Task Een_thema_buiten_de_schoolbibliotheek_wordt_overgeslagen_niet_verzonnen()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(
            Antwoord(("Herfst", blokken[0].Start), ("Ruimtevaart", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Equal("Ruimtevaart", Assert.Single(resultaat.OnbekendeThemas));
        Assert.Equal("Herfst", Assert.Single(resultaat.Jaarplan!.Plaatsingen).ThemaNaam);
    }

    /// <summary>
    /// A date that is not the start of any derived block is skipped and reported — deliberately <b>not</b> snapped
    /// to the nearest block. Snapping would put a thema in a period nobody chose, and inventing a block would
    /// contradict "blocks are derived, never stored" (ADR-0013).
    /// </summary>
    [Fact]
    public async Task Een_datum_die_geen_blokstart_is_wordt_overgeslagen_niet_bijgeschoven()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var middenInHetBlok = blokken[0].Start.AddDays(3);
        Assert.DoesNotContain(blokken, b => b.Start == middenInHetBlok);

        var (service, _, _, klas, _, _) = Opzet(
            Antwoord(("Herfst", middenInHetBlok), ("Water", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Equal($"{middenInHetBlok:yyyy-MM-dd}", Assert.Single(resultaat.OnbekendeBlokken));
        Assert.Equal("Water", Assert.Single(resultaat.Jaarplan!.Plaatsingen).ThemaNaam);
    }

    /// <summary>
    /// <b>What <c>vergrendeld</c> buys the teacher</b> (Art. IX.3, consumed by E4). A regeneration replaces the
    /// untouched proposal and leaves a locked placement and a decided one exactly where they are.
    /// </summary>
    [Fact]
    public async Task Hergeneratie_behoudt_vergrendelde_en_besliste_plaatsingen()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();
        var water = Water();
        var vast = new Thema("Kerst", duurWeken: 4);

        var jaarplan = new Jaarplan(klas.Id);
        var losVoorstel = jaarplan.VoegPlaatsingToe(
            water.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Voorgesteld, "oud voorstel");
        var vergrendeld = jaarplan.VoegPlaatsingToe(
            vast.Id, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Voorgesteld, "vastgezet");
        vergrendeld.StelVergrendelingIn(true);
        var aanvaard = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[2].Start, KoppelingStatus.Voorgesteld, "goedgekeurd");
        aanvaard.WijzigStatus(KoppelingStatus.Aanvaard);

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst, water, vast], jaarplan);
        var service = new JaarplanGeneratieService(
            new FakeAiClient(Antwoord(("Water", blokken[3].Start))), Indeling, opslag);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Equal(2, resultaat.AantalBehouden);

        var ids = jaarplan.Plaatsingen.Select(p => p.Id).ToList();
        Assert.DoesNotContain(losVoorstel.Id, ids);      // untouched proposal: replaced
        Assert.Contains(vergrendeld.Id, ids);            // locked: kept (Art. IX.3)
        Assert.Contains(aanvaard.Id, ids);               // teacher decision: kept (Art. IV.1)

        // The kept placements did not move: same block start dates as before.
        Assert.Equal(blokken[1].Start, jaarplan.VindPlaatsing(vergrendeld.Id)!.BlokStart);
        Assert.Equal(blokken[2].Start, jaarplan.VindPlaatsing(aanvaard.Id)!.BlokStart);
    }

    /// <summary>
    /// A slot the teacher <b>rejected</b> is reported as <c>Afgewezen</c>, not as a <c>Duplicaat</c>. Both suppress
    /// the re-proposal, but they are different facts: a duplicate means the AI repeated itself, while this means the
    /// teacher's own rejection is holding. Labelling the second as the first would blame the AI for the teacher's
    /// decision. (The absence of any way to *remove* a rejected placement is a known, documented gap — E3-07.)
    /// </summary>
    [Fact]
    public async Task Een_afgewezen_plaatsing_wordt_niet_als_duplicaat_gerapporteerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();
        var water = Water();

        var jaarplan = new Jaarplan(klas.Id);
        var geweigerd = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Voorgesteld, "eerder");
        geweigerd.WijzigStatus(KoppelingStatus.Geweigerd);
        var aanvaard = jaarplan.VoegPlaatsingToe(
            water.Id, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Voorgesteld, "eerder");
        aanvaard.WijzigStatus(KoppelingStatus.Aanvaard);

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst, water], jaarplan);
        var service = new JaarplanGeneratieService(
            new FakeAiClient(Antwoord(("Herfst", blokken[0].Start), ("Water", blokken[1].Start))),
            Indeling,
            opslag);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(0, resultaat.AantalNieuw);

        // The teacher's rejection is reported as such, and is NOT in duplicaten.
        Assert.Equal($"Herfst @ {blokken[0].Start:yyyy-MM-dd}", Assert.Single(resultaat.Afgewezen));
        Assert.DoesNotContain(resultaat.Duplicaten, d => d.StartsWith("Herfst", StringComparison.Ordinal));

        // The accepted one is genuine AI repetition and stays a duplicaat.
        Assert.Equal($"Water @ {blokken[1].Start:yyyy-MM-dd}", Assert.Single(resultaat.Duplicaten));

        // Both survived the run untouched (Art. IV.1) — the rejection is not silently revived either.
        Assert.Equal(2, resultaat.AantalBehouden);
        Assert.Equal(KoppelingStatus.Geweigerd, jaarplan.VindPlaatsing(geweigerd.Id)!.Status);
    }

    /// <summary>
    /// <b>The reason placements key on a date</b> (ADR-0020 §3). The school shifts its kerstvakantie a week earlier;
    /// the grid reshapes and later ordinals re-point. A placement keyed on the ordinal would silently be a different
    /// period. Keyed on the start date, the stored value is <b>unchanged</b>, and when that date is no longer a
    /// period boundary the plan says so (<c>IsVervallen</c>) instead of guessing a new one — the directie ruling of
    /// 2026-07-28: never silently move a teacher's thema.
    /// </summary>
    [Fact]
    public async Task Een_vakantiewijziging_verplaatst_een_plaatsing_nooit_stil()
    {
        var origineel = TestSchooljaar.MetVakanties();
        var origineleBlokken = Blokken(origineel);

        var gewijzigd = new Schooljaar("2026-2027", origineel.Start, origineel.Eind);
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 14), new DateOnly(2026, 12, 27)));
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Krokusvakantie", new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 21)));
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));
        var nieuweBlokken = Blokken(gewijzigd);

        // A block whose start date does not survive the edit at all — the case a stored date genuinely goes stale.
        var verdwenen = origineleBlokken.First(o => nieuweBlokken.All(n => n.Start != o.Start));

        var klas = gewijzigd.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();
        var jaarplan = new Jaarplan(klas.Id);
        var plaatsing = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, verdwenen.Start, KoppelingStatus.Aanvaard, "voor de wijziging");

        // Read the plan against the EDITED calendar.
        var service = new JaarplanGeneratieService(
            new FakeAiClient(), Indeling, new FakeJaarplanOpslag(klas, gewijzigd, [herfst], jaarplan));

        var plan = await service.HaalJaarplanAsync(klas.Id);
        var weergave = Assert.Single(plan.Plaatsingen);

        // The stored key is untouched — nothing was moved, nothing was guessed.
        Assert.Equal(verdwenen.Start, plaatsing.BlokStart);
        Assert.Equal(verdwenen.Start, weergave.BlokStart);

        // And the staleness is reported rather than papered over.
        Assert.True(weergave.IsVervallen);
        Assert.Null(weergave.BlokEind);
        Assert.Null(weergave.BlokOrdinaal);
    }

    /// <summary>
    /// The prompt offers the model the blocks the seam derived — with their <b>start dates</b> — and no calendar
    /// unit. If generation ever started assuming months, this fails.
    /// </summary>
    [Fact]
    public async Task De_prompt_biedt_de_afgeleide_blokken_aan_en_geen_kalendereenheid()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, client, klas, _, _) = Opzet("""{"plaatsingen":[]}""", schooljaar);

        await service.GenereerAsync(klas.Id);

        var prompt = client.LaatsteRequest!.UserPrompt;
        foreach (var blok in blokken)
        {
            Assert.Contains($"startdatum {blok.Start:yyyy-MM-dd}", prompt);
        }

        // The school's own thema's are offered, and nothing else — grounded only on school data (Art. IV.4).
        Assert.Contains("Thema: Herfst", prompt);
        Assert.Contains("Thema: Water", prompt);

        // No month names anywhere: not in the prompt, not in the instructions (Art. IX.3).
        foreach (var maand in (string[])
                 ["januari", "februari", "maart", "april", "juni", "juli", "augustus", "oktober", "november", "december"])
        {
            Assert.DoesNotContain(maand, prompt, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(maand, client.LaatsteRequest.SystemPrompt, StringComparison.OrdinalIgnoreCase);
        }

        // The instructions demand the date and explicitly refuse the block number.
        Assert.Contains("STARTDATUM", client.LaatsteRequest.SystemPrompt);
        Assert.Contains("nooit met zijn nummer", client.LaatsteRequest.SystemPrompt);

        // Only the teacher-backed goals are shown (aanvaard/manueel, Art. V.1) — never a rejected or pending one.
        Assert.Contains("NAT-K3-01", prompt);
        Assert.DoesNotContain("NAT-K3-02", prompt);
    }

    /// <summary>
    /// E3-02 / FR-5.2: the prompt actually <b>asks</b> for the three spreading properties, and supplies the data
    /// each one needs to be satisfiable.
    /// <para>
    /// This is the honest limit of what a unit test can claim here. Whether the model complies is a property of
    /// the model, and the client is a fake — so asserting compliance would be asserting the fake. What is pinned
    /// is that the request is not silently missing the instruction or the figures, which is the failure mode that
    /// would make FR-5.2 quietly unimplemented while looking done. The <i>result</i> side is measured by
    /// <c>SpreidingsrapportTests</c>.
    /// </para>
    /// </summary>
    [Fact]
    public async Task De_prompt_vraagt_spreiding_en_geeft_de_cijfers_die_daarvoor_nodig_zijn()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, client, klas, _, _) = Opzet("""{"plaatsingen":[]}""", schooljaar);

        await service.GenereerAsync(klas.Id);

        var systeem = client.LaatsteRequest!.SystemPrompt;
        var prompt = client.LaatsteRequest.UserPrompt;

        // 1. Spread over as many blocks as possible, rather than clumping.
        Assert.Contains("zoveel mogelijk verschillende planningsblokken", systeem);

        // 2. A thema must fit the block: expressed in weeks, so the block's weeks are printed.
        Assert.Contains("niet groter", systeem);
        Assert.Contains("weken van het blok", systeem);
        Assert.Contains("weken)", prompt);

        // 3. Logical/seasonal order — and, crucially, derived from the supplied dates and the thema's own words
        //    rather than from outside knowledge, which Art. IV.4 forbids and the system prompt still refuses.
        Assert.Contains("seizoen", systeem);
        Assert.Contains("zoek niets op", systeem);
        Assert.Contains("Gebruik geen externe kennis", systeem);

        // 4. An even goal distribution needs a per-thema weight, so the goal COUNT is stated, not just the codes.
        Assert.Contains("evenwichtig", systeem);
        Assert.Contains("Gekoppelde leerplandoelen (1): NAT-K3-01", prompt);

        // "Respect the number of available blocks" needs the denominator stated outright, not tallied from a list.
        Assert.Contains($"Aantal beschikbare blokken: {blokken.Count}", prompt);

        // Still no calendar unit smuggled in by the new spreading text (Art. IX.3) — "weken" is a block LENGTH,
        // never a planning unit, and no month may appear.
        foreach (var maand in (string[])["januari", "maart", "mei", "september", "december"])
        {
            Assert.DoesNotContain(maand, systeem, StringComparison.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// The run reports how the resulting plan is spread (E3-02), so a teacher sees a clumped proposal as clumped.
    /// It is <b>advisory</b>: the badly spread plan is still returned in full and the run still succeeds
    /// (Art. IV.1) — a generator that rejected its own output would be deciding for the teacher.
    /// </summary>
    [Fact]
    public async Task Een_geklonterd_voorstel_slaagt_en_wordt_als_geklonterd_gerapporteerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var eerste = blokken[0].Start.ToString("yyyy-MM-dd");

        // Both thema's in the SAME first block, leaving every other period empty.
        var antwoord =
            $"{{\"plaatsingen\":[" +
            $"{{\"blokStart\":\"{eerste}\",\"thema\":\"Herfst\",\"motivatie\":\"seizoen\"}}," +
            $"{{\"blokStart\":\"{eerste}\",\"thema\":\"Water\",\"motivatie\":\"ook hier\"}}]}}";
        var (service, _, _, klas, _, _) = Opzet(antwoord, schooljaar);

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);          // advisory: a bad spread is not a failed run
        Assert.Equal(2, resultaat.AantalNieuw);     // and nothing was dropped

        var spreiding = resultaat.Spreiding;
        Assert.NotNull(spreiding);
        Assert.Equal(blokken.Count, spreiding!.AantalBlokken);
        Assert.Equal(1, spreiding.AantalGebruikteBlokken);
        Assert.Equal(blokken.Count - 1, spreiding.LegeBlokOrdinalen.Count);
    }

    /// <summary>A failed run has nothing to measure, so it reports no spread rather than a misleading zero.</summary>
    [Fact]
    public async Task Een_mislukte_generatie_levert_geen_spreidingsrapport_op()
    {
        var (service, _, _, klas, _, _) = Opzet("dit is geen JSON {kapot");

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.False(resultaat.IsGeslaagd);
        Assert.Null(resultaat.Spreiding);
    }

    [Fact]
    public async Task Een_leeg_geldig_antwoord_slaagt_en_plaatst_niets()
    {
        var (service, _, _, klas, _, _) = Opzet("""{"plaatsingen":[]}""");

        var resultaat = await service.GenereerAsync(klas.Id);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(0, resultaat.AantalNieuw);
        Assert.Empty(resultaat.Jaarplan!.Plaatsingen);
    }

    [Fact]
    public async Task Onbekende_klas_geeft_een_nietgevonden_fout_en_roept_de_AI_nooit_aan()
    {
        var (service, _, client, _, _, _) = Opzet("""{"plaatsingen":[]}""");

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => service.GenereerAsync(Guid.NewGuid()));
        Assert.Equal(0, client.AantalAanroepen);
    }

    /// <summary>A class that has never been generated for reads as an empty plan, not a 404 (Art. IX.3).</summary>
    [Fact]
    public async Task Een_klas_zonder_jaarplan_leest_als_een_leeg_plan()
    {
        var (service, _, _, klas, schooljaar, _) = Opzet("""{"plaatsingen":[]}""");

        var plan = await service.HaalJaarplanAsync(klas.Id);

        Assert.Equal(klas.Id, plan.KlasId);
        Assert.Equal(schooljaar.Id, plan.SchooljaarId);
        Assert.Empty(plan.Plaatsingen);

        // The read view says which grain produced the periods, so a caller need not infer a unit.
        Assert.Contains("themaperiode", plan.Blokindeling);
    }

    [Theory]
    [InlineData(KoppelingStatus.Aanvaard)]
    [InlineData(KoppelingStatus.Geweigerd)]
    [InlineData(KoppelingStatus.Manueel)]
    public async Task Een_leerkrachtbeslissing_wordt_bewaard(KoppelingStatus beslissing)
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var gegenereerd = await service.GenereerAsync(klas.Id);
        var plaatsingId = Assert.Single(gegenereerd.Jaarplan!.Plaatsingen).Id;

        var na = await service.WijzigPlaatsingStatusAsync(klas.Id, plaatsingId, beslissing);

        Assert.Equal(beslissing.ToString(), Assert.Single(na.Plaatsingen).Status);
        Assert.Equal(2, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Voorgesteld_terugzetten_wordt_geweigerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var gegenereerd = await service.GenereerAsync(klas.Id);
        var plaatsingId = Assert.Single(gegenereerd.Jaarplan!.Plaatsingen).Id;

        await Assert.ThrowsAsync<OngeldigePlaatsingsstatusFout>(() =>
            service.WijzigPlaatsingStatusAsync(klas.Id, plaatsingId, KoppelingStatus.Voorgesteld));
    }

    [Fact]
    public async Task Vergrendeling_kan_gezet_worden_en_wordt_bewaard()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var gegenereerd = await service.GenereerAsync(klas.Id);
        var plaatsingId = Assert.Single(gegenereerd.Jaarplan!.Plaatsingen).Id;

        var na = await service.WijzigVergrendelingAsync(klas.Id, plaatsingId, vergrendeld: true);

        Assert.True(Assert.Single(na.Plaatsingen).Vergrendeld);
    }

    [Fact]
    public async Task Een_onbekende_plaatsing_geeft_een_nietgevonden_fout()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);
        await service.GenereerAsync(klas.Id);

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() =>
            service.WijzigVergrendelingAsync(klas.Id, Guid.NewGuid(), vergrendeld: true));
    }

    /// <summary>
    /// A placement can be removed whatever its status or lock — an explicit teacher action is the one actor Art. IV.2
    /// allows to discard a human decision. This is the escape hatch the <c>Klas</c> delete guard depends on, and
    /// (see the next test) the only way a <c>geweigerd</c> placement can ever leave a plan.
    /// </summary>
    [Theory]
    [InlineData(KoppelingStatus.Voorgesteld, false)]
    [InlineData(KoppelingStatus.Aanvaard, false)]
    [InlineData(KoppelingStatus.Geweigerd, false)]
    [InlineData(KoppelingStatus.Manueel, false)]
    [InlineData(KoppelingStatus.Aanvaard, true)]   // locked as well
    public async Task Een_plaatsing_kan_verwijderd_worden_ongeacht_status_of_vergrendeling(
        KoppelingStatus status,
        bool vergrendeld)
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();

        var jaarplan = new Jaarplan(klas.Id);
        var plaatsing = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, status, "motivatie");
        plaatsing.StelVergrendelingIn(vergrendeld);

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst], jaarplan);
        var service = new JaarplanGeneratieService(new FakeAiClient(), Indeling, opslag);

        var na = await service.VerwijderPlaatsingAsync(klas.Id, plaatsing.Id);

        Assert.Empty(na.Plaatsingen);
        Assert.Empty(jaarplan.Plaatsingen);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// Removing a <c>geweigerd</c> placement lifts the suppression: the AI can propose that thema/block again. Before
    /// the delete endpoint existed, a rejection was irreversible and silenced that slot for good.
    /// </summary>
    [Fact]
    public async Task Na_het_verwijderen_van_een_afwijzing_kan_het_thema_opnieuw_voorgesteld_worden()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();

        var jaarplan = new Jaarplan(klas.Id);
        var geweigerd = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Geweigerd, "afgewezen");

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst], jaarplan);
        var antwoord = Antwoord(("Herfst", blokken[0].Start));

        // While the rejection stands, the proposal is suppressed and reported as Afgewezen.
        var geblokkeerd = await new JaarplanGeneratieService(new FakeAiClient(antwoord), Indeling, opslag)
            .GenereerAsync(klas.Id);
        Assert.Equal(0, geblokkeerd.AantalNieuw);
        Assert.Single(geblokkeerd.Afgewezen);

        // The teacher removes it.
        await new JaarplanGeneratieService(new FakeAiClient(), Indeling, opslag)
            .VerwijderPlaatsingAsync(klas.Id, geweigerd.Id);

        // Now the same thema/block can be proposed again.
        var opnieuw = await new JaarplanGeneratieService(new FakeAiClient(antwoord), Indeling, opslag)
            .GenereerAsync(klas.Id);

        Assert.Equal(1, opnieuw.AantalNieuw);
        Assert.Empty(opnieuw.Afgewezen);
        Assert.Equal("Voorgesteld", Assert.Single(opnieuw.Jaarplan!.Plaatsingen).Status);
    }

    [Fact]
    public async Task Een_onbekende_plaatsing_verwijderen_geeft_een_nietgevonden_fout()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);
        await service.GenereerAsync(klas.Id);

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => service.VerwijderPlaatsingAsync(klas.Id, Guid.NewGuid()));
    }

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        var opslag = new FakeJaarplanOpslag(null, null);

        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(null!, Indeling, opslag));
        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(new FakeAiClient(), null!, opslag));
        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(new FakeAiClient(), Indeling, null!));
    }

    // ---------------------------------------------------------------------------------------------------------
    // E3-04 — pre-generation parameters (FR-5.4)
    //
    // FR-5.4's criterion is that the parameters "measurably influence the result". With the AI client faked in
    // every test (Art. IV.6), a parameter that only reaches the prompt cannot be shown to change an OUTCOME —
    // asserting that would assert the fake. So the story is delivered in two halves that are each verifiable, the
    // same split E3-02 used, and the tests are written to keep them distinguishable:
    //   * ASKED     — the prompt carries the parameter (a preference the model may decline), and the run reports
    //                 whether the returned plan honoured it.
    //   * ENFORCED  — a blocking vast moment is applied by the service, so the SAME faked response persists a
    //                 different plan depending on the parameter. That is the half that measurably influences.
    // ---------------------------------------------------------------------------------------------------------

    /// <summary>
    /// The enforced half, and the load-bearing test of FR-5.4: one faked response, two parameter sets, two
    /// different persisted plans. Nothing about the model changes between the runs, so the difference is
    /// attributable to the parameter alone.
    /// </summary>
    [Fact]
    public async Task Een_vast_moment_dat_blokkeert_verandert_wat_er_bewaard_wordt()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var antwoord = Antwoord(("Herfst", blokken[0].Start), ("Water", blokken[1].Start));

        // Baseline: no parameters, both placements land.
        var (zonder, _, _, klasZonder, _, _) = Opzet(antwoord, TestSchooljaar.MetVakanties());
        var basis = await zonder.GenereerAsync(klasZonder.Id);
        Assert.Equal(2, basis.AantalNieuw);

        // Same answer, but the teacher has spent the first period on a schoolfeest. The date is given as a DATE
        // inside the block, never as the block's key — a teacher does not know where a boundary falls.
        var (met, _, _, klasMet, _, _) = Opzet(antwoord, schooljaar);
        var parameters = new JaarplanGeneratieParameters
        {
            VasteMomenten = [new VastMoment("Schoolfeest", blokken[0].Start.AddDays(3), BlokkeertPlaatsing: true)],
        };

        var resultaat = await met.GenereerAsync(klasMet.Id, parameters);

        // The run still SUCCEEDS and the rest of the plan stands — a refused placement is not a failed run.
        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Single(resultaat.Jaarplan!.Plaatsingen);
        Assert.Equal("Water", resultaat.Jaarplan!.Plaatsingen[0].ThemaNaam);

        // Refused, not relocated. Moving it to a period the teacher never chose is exactly what ADR-0020 forbids
        // for stale placements, and the reason would be invisible.
        Assert.DoesNotContain(
            resultaat.Jaarplan!.Plaatsingen, p => p.BlokStart == blokken[0].Start);

        // And the refusal NAMES the instruction that caused it: "a thema was dropped" is not actionable.
        var rapport = resultaat.Parameters;
        Assert.NotNull(rapport);
        var geweigerd = Assert.Single(rapport!.GeweigerdDoorVastMoment);
        Assert.Contains("Herfst", geweigerd);
        Assert.Contains("Schoolfeest", geweigerd);
    }

    /// <summary>
    /// A vast moment that does not block is context only: the model is told the period has less time, but nothing
    /// is refused. The default is deliberately the weaker reading, so a caller that omits the flag cannot
    /// accidentally have work silently dropped.
    /// </summary>
    [Fact]
    public async Task Een_vast_moment_zonder_blokkade_weigert_niets()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, client, klas, _, _) = Opzet(
            Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                VasteMomenten = [new VastMoment("Sportdag", blokken[0].Start.AddDays(2))],
            });

        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Empty(resultaat.Parameters!.GeweigerdDoorVastMoment);

        // Asked, though: the model is told it exists so it can reason about the period's real capacity.
        Assert.Contains("Sportdag", client.LaatsteRequest!.UserPrompt);
        Assert.Contains("minder tijd", client.LaatsteRequest.UserPrompt);
    }

    /// <summary>
    /// A blocking moment whose date falls in no block at all — a vakantie is part of no planningsblok (ADR-0020) —
    /// is <b>reported</b>, not silently ignored. A teacher who blocked a period and saw nothing refused would
    /// otherwise conclude the block had been honoured when it was never applied at all.
    /// </summary>
    [Fact]
    public async Task Een_vast_moment_in_een_vakantie_wordt_gerapporteerd_niet_stil_genegeerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var vakantie = schooljaar.Sluitingen.First(s => s.Soort == Sluitingssoort.Vakantie);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                VasteMomenten = [new VastMoment("Oudercontact", vakantie.Start, BlokkeertPlaatsing: true)],
            });

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalNieuw);     // nothing was refused, because nothing could be
        var onplaatsbaar = Assert.Single(resultaat.Parameters!.OnplaatsbareVasteMomenten);
        Assert.Contains("Oudercontact", onplaatsbaar);
        Assert.True(resultaat.Parameters!.HeeftAandachtspunten);
    }

    /// <summary>
    /// The asked half: a gewenst startthema reaches the prompt, naming the block it should open, so the model can
    /// comply in one pass.
    /// </summary>
    [Fact]
    public async Task Een_gewenst_startthema_staat_in_de_prompt_met_het_blok_erbij()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, client, klas, _, _) = Opzet("""{"plaatsingen":[]}""", schooljaar);

        await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters { GewensteStartthemas = ["Water"] });

        var prompt = client.LaatsteRequest!.UserPrompt;
        Assert.Contains("Wat de leerkracht vooraf vraagt", prompt);
        Assert.Contains("Water", prompt);
        Assert.Contains(blokken[0].Start.ToString("yyyy-MM-dd"), prompt);

        // Vakanties are NOT restated as prose: the block list already expresses them, because blocks are derived
        // from them and never span one. A second telling would invite the model to reason about holidays the grid
        // has already removed from consideration.
        Assert.DoesNotContain("vakantie", prompt, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// A declined preference is reported and does <b>not</b> fail the run or trigger a retry (Art. IV.1). A model
    /// that keeps ignoring a request is a fact the teacher should see, not one to bury in a loop — the same
    /// reasoning that keeps <c>Spreidingsrapport</c> threshold-free.
    /// </summary>
    [Fact]
    public async Task Een_genegeerd_startthema_laat_de_run_slagen_en_wordt_gerapporteerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);

        // The teacher asked to open with Water; the model opens with Herfst and puts Water later.
        var (service, _, _, klas, _, _) = Opzet(
            Antwoord(("Herfst", blokken[0].Start), ("Water", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters { GewensteStartthemas = ["Water"] });

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(2, resultaat.AantalNieuw);     // the plan stands in full
        var rapport = resultaat.Parameters!;
        Assert.Equal(["Water"], rapport.NietGehonoreerdeStartthemas);
        Assert.Empty(rapport.GehonoreerdeStartthemas);
        Assert.True(rapport.HeeftAandachtspunten);
    }

    /// <summary>
    /// An honoured request reports as honoured, so the two states are distinguishable rather than both reading as
    /// "parameters were considered".
    /// </summary>
    [Fact]
    public async Task Een_gehonoreerd_startthema_wordt_als_gehonoreerd_gerapporteerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(
            Antwoord(("Water", blokken[0].Start), ("Herfst", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters { GewensteStartthemas = ["Water"] });

        var rapport = resultaat.Parameters!;
        Assert.Equal(["Water"], rapport.GehonoreerdeStartthemas);
        Assert.Empty(rapport.NietGehonoreerdeStartthemas);
        Assert.False(rapport.HeeftAandachtspunten);
    }

    /// <summary>
    /// A start thema the school does not own is reported as unknown rather than as declined. Without the
    /// distinction a typo in a parameter is indistinguishable from a model that ignored the request, and the
    /// teacher would go looking for the wrong problem. Nothing is invented (Art. IV.4).
    /// </summary>
    [Fact]
    public async Task Een_onbekend_startthema_wordt_als_onbekend_gerapporteerd_niet_als_genegeerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters { GewensteStartthemas = ["Ruimtevaart"] });

        var rapport = resultaat.Parameters!;
        Assert.Equal(["Ruimtevaart"], rapport.OnbekendeStartthemas);
        Assert.Empty(rapport.NietGehonoreerdeStartthemas);
        Assert.Empty(rapport.GehonoreerdeStartthemas);
    }

    /// <summary>
    /// A rejected placement does not count as honouring a start-thema request. A <c>geweigerd</c> placement
    /// survives regeneration but nothing is taught because of it, so crediting it would be the same defect the
    /// E3-02 code review found in the spreading report, one story later.
    /// </summary>
    [Fact]
    public async Task Een_geweigerde_plaatsing_honoreert_een_startthema_niet()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Water", blokken[0].Start)), schooljaar);

        // Generate, then have the teacher reject the opening placement.
        var eerste = await service.GenereerAsync(klas.Id);
        var plaatsingId = eerste.Jaarplan!.Plaatsingen.Single(p => p.ThemaNaam == "Water").Id;
        await service.WijzigPlaatsingStatusAsync(klas.Id, plaatsingId, KoppelingStatus.Geweigerd);

        // Re-run asking to open with Water. Its rejected placement still sits in block 1 and suppresses a
        // re-proposal, but it must not be reported as honouring the request.
        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters { GewensteStartthemas = ["Water"] });

        var rapport = resultaat.Parameters!;
        Assert.Equal(["Water"], rapport.NietGehonoreerdeStartthemas);
        Assert.Empty(rapport.GehonoreerdeStartthemas);
    }

    /// <summary>
    /// No parameters ⇒ the prompt is byte-for-byte what it was before this story, and the report is the empty one.
    /// This is what keeps E3-02's snapshot assertions meaningful rather than merely updated, and it is why the
    /// section is omitted entirely rather than rendered as "geen".
    /// </summary>
    [Fact]
    public async Task Zonder_parameters_verandert_de_prompt_niet_en_is_het_rapport_leeg()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, client, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var zonderArgument = await service.GenereerAsync(klas.Id);
        var promptZonder = client.LaatsteRequest!.UserPrompt;

        Assert.DoesNotContain("Wat de leerkracht vooraf vraagt", promptZonder);
        Assert.Same(ParameterRapport.Geen, zonderArgument.Parameters);
        Assert.False(zonderArgument.Parameters!.HeeftAandachtspunten);

        // An explicitly-empty parameter object must behave identically to omitting it, or a UI that always posts a
        // (possibly empty) form would silently take a different path from the plain button.
        var (service2, _, client2, klas2, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), TestSchooljaar.MetVakanties());
        await service2.GenereerAsync(klas2.Id, new JaarplanGeneratieParameters());

        Assert.Equal(promptZonder, client2.LaatsteRequest!.UserPrompt);
    }

    /// <summary>
    /// Blank and duplicate start thema names are normalised away, so a form that posts an empty row cannot make
    /// the prompt ask for "" and cannot make the report list the same thema twice.
    /// </summary>
    [Fact]
    public void Startthemas_worden_genormaliseerd()
    {
        var parameters = new JaarplanGeneratieParameters
        {
            GewensteStartthemas = ["Water", "  ", "water", "", "  Herfst  "],
        };

        Assert.Equal(["Water", "Herfst"], parameters.GenormaliseerdeStartthemas());
        Assert.False(parameters.IsLeeg);
        Assert.True(new JaarplanGeneratieParameters().IsLeeg);
        Assert.True(JaarplanGeneratieParameters.Geen.IsLeeg);
    }
}
