using System.ComponentModel.DataAnnotations;
using Jaarplanner.Application.Ai;
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

            // **The capacity the model is told is the capacity the te-vol verdict measures** (owner ruling,
            // 2026-08-05, E3-09): `ceil(TelOpenDagen / 7)`, the same arithmetic as
            // `BlokspreidingWeergave.BeschikbareWeken`. It used to be `AantalDagen / 7` to one decimal, so the prompt
            // said "4,4 weken" about a period the flag on screen measured as 5 — the generator steered by a stricter
            // number than the verdict it would be judged against. Asserted against the *rapport* rather than against a
            // literal, so the two cannot be changed apart.
            var capaciteit = Spreidingsrapport
                .Meet([], blokken, new Dictionary<Guid, Thema>(), schooljaar)
                .Blokken.Single(b => b.Start == blok.Start)
                .BeschikbareWeken;
            Assert.Contains($"({capaciteit} weken)", prompt);
        }

        // And no fractional weeks anywhere in the prompt, which is the property that makes the sentence above true
        // rather than merely currently equal.
        //
        // **Both separators**, because the old form was `ToString("0.0", InvariantCulture)` and therefore printed a
        // POINT. A first version of this line matched only a comma and so could not have caught the very code it was
        // written against — found by mutating rather than by reading, which is the only way that class of test gets
        // caught. (The first mutation attempt was itself wrong: integer division also prints no separator and passed,
        // which proves only that a mutation has to reproduce the original, not merely differ from the fix.)
        Assert.DoesNotMatch(@"\d[.,]\d weken", prompt);

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
    /// FR-5.3's <b>asked</b> half (E3-03): the prompt tells the model to aim for full coverage over the year, and
    /// carries the figures that make the instruction satisfiable.
    /// <para>
    /// Split from the measured half for the same reason E3-02 split its own claim: the AI client is a fake in every
    /// test (Art. IV.6), so "the model achieved good coverage" is unfalsifiable here and asserting it would assert
    /// the fake. What <i>is</i> verifiable is that the request is not silently missing the instruction — the failure
    /// mode that would leave FR-5.3 unimplemented while looking done, which is exactly what happened to FR-4.1 and
    /// FR-8.4 on this project. The result side is <c>DekkingsvooruitzichtTests</c>.
    /// </para>
    /// <para>
    /// <b>It also pins what the coverage section must NOT contain.</b> No target number, no percentage and no
    /// curriculum: the model is grounded on the school's own thema's only (Art. IV.4), and asking it to judge its own
    /// coverage against a bar would be the retry loop E3-02 deliberately refused to build (Art. IV.1). The
    /// denominator is resolved server-side, where the owner's ruling of 2026-08-04 lives.
    /// </para>
    /// </summary>
    [Fact]
    public async Task De_prompt_vraagt_volledige_dekking_en_zet_er_geen_streefcijfer_in()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var (service, _, client, klas, _, themas) = Opzet("""{"plaatsingen":[]}""", schooljaar);

        await service.GenereerAsync(klas.Id);

        var systeem = client.LaatsteRequest!.SystemPrompt;
        var prompt = client.LaatsteRequest.UserPrompt;

        // 1. The aim itself, in FR-5.3's own words, under its own heading rather than buried in the spreiding list.
        Assert.Contains("Dekking (streef naar volledige dekking over het hele schooljaar):", systeem);

        // 2. What coverage actually depends on: the UNION of the placed thema's goals, so as many DIFFERENT ones as
        //    the chosen combination can reach.
        Assert.Contains("zoveel mogelijk VERSCHILLENDE leerplandoelen", systeem);
        Assert.Contains("de combinatie van thema's die samen het meeste dekt", systeem);
        Assert.Contains("nog nergens anders in het jaarplan voorkomen", systeem);

        // 3. **Selection, not exhaustion** (owner ruling 2026-08-05). The first version asked for every thema to be
        //    placed at least once, which asserts that every school-wide thema belongs in every class's year. The
        //    owner ruled that each class may have its own thema's, so the library is an offer. Asserted in both
        //    directions, because the earlier sentence was individually plausible and would read as an improvement to
        //    anyone re-adding it.
        Assert.Contains("Je hoeft niet elk thema te gebruiken", systeem);
        Assert.Contains("niet een verplichte inhoud voor deze klas", systeem);
        Assert.DoesNotContain("Plaats elk thema minstens", systeem);

        // 4. The library's size, beside the block count E3-02 added: together they show whether this is a selection
        //    problem at all. (Its justification changed with the ruling above; the figure did not.)
        Assert.Contains($"Aantal thema's: {themas.Count}", prompt);

        // 5. No target, no percentage, no curriculum in the prompt. Asserted rather than assumed, because a
        //    well-meaning "streef naar minstens 80%" is the obvious next edit and it would hand the judgement to the
        //    model (Art. IV.1) using a denominator it cannot see.
        Assert.DoesNotContain("%", systeem);
        Assert.DoesNotContain("procent", systeem, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("minstens 8", systeem);
        Assert.DoesNotContain("minimumdoel", systeem, StringComparison.OrdinalIgnoreCase);
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

    /// <summary>
    /// The E3-07 move (FR-6.2): the placement lands on the target block's <b>start date</b>, becomes
    /// <c>manueel</c> because the position is now the teacher's, and loses the AI motivation that argued for the
    /// period it left. Persisted immediately (FR-6.5) — one commit, no save button.
    /// </summary>
    [Fact]
    public async Task Een_plaatsing_verplaatsen_bewaart_de_nieuwe_blokstart_als_manueel_zonder_ai_motivatie()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);
        await service.GenereerAsync(klas.Id);

        var voor = Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);
        Assert.Equal("Voorgesteld", voor.Status);
        Assert.Equal("past hier", voor.AiMotivatie);

        var na = Assert.Single(
            (await service.VerplaatsPlaatsingAsync(klas.Id, voor.Id, blokken[2].Start)).Plaatsingen);

        // The new key is the target block's start date, and the derived period is projected alongside it.
        Assert.Equal(blokken[2].Start, na.BlokStart);
        Assert.Equal(blokken[2].Eind, na.BlokEind);
        Assert.Equal(blokken[2].Ordinaal, na.BlokOrdinaal);
        Assert.False(na.IsVervallen);

        // The teacher placed it, so the plan says so — and no longer credits the model for the position.
        Assert.Equal("Manueel", na.Status);
        Assert.Null(na.AiMotivatie);

        // The tier is untouched: dragging along the board repositions, it does not re-tier.
        Assert.Equal("Themaperiode", na.BlokNiveau);

        // One commit for the generation, one for the move.
        Assert.Equal(2, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// A target date that starts no block is <b>refused</b>, never snapped to the nearest period. Same rule the
    /// generation path applies to a model-supplied date, for the same reason: a thema in a period nobody chose is the
    /// silent relocation ADR-0020 and the directie ruling of 2026-07-28 forbid.
    /// </summary>
    [Fact]
    public async Task Verplaatsen_naar_een_datum_die_geen_blokstart_is_wordt_geweigerd_niet_bijgeschoven()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);
        await service.GenereerAsync(klas.Id);
        var plaatsing = Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);

        // One day past a real boundary: the nearest block is obvious, which is exactly why refusing matters.
        var netNaastEenGrens = blokken[1].Start.AddDays(1);

        await Assert.ThrowsAsync<OngeldigeVerplaatsingFout>(
            () => service.VerplaatsPlaatsingAsync(klas.Id, plaatsing.Id, netNaastEenGrens));

        // Nothing moved and nothing was written.
        var na = Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);
        Assert.Equal(blokken[0].Start, na.BlokStart);
        Assert.Equal("Voorgesteld", na.Status);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// <b>The re-placement route the directie ruling requires.</b> A placement whose stored date stopped being a
    /// period boundary is stale; the application never guesses a period for it, but the teacher can give it one
    /// through the same move. Nothing validates where the placement currently sits, only where it is going.
    /// </summary>
    [Fact]
    public async Task Een_vervallen_plaatsing_kan_naar_een_echte_periode_verplaatst_worden()
    {
        var origineel = TestSchooljaar.MetVakanties();
        var origineleBlokken = Blokken(origineel);

        var gewijzigd = new Schooljaar("2026-2027", origineel.Start, origineel.Eind);
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 14), new DateOnly(2026, 12, 27)));
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Krokusvakantie", new DateOnly(2027, 2, 15), new DateOnly(2027, 2, 21)));
        gewijzigd.VoegSluitingToe(new Schoolsluiting("Paasvakantie", new DateOnly(2027, 4, 5), new DateOnly(2027, 4, 18)));
        var nieuweBlokken = Blokken(gewijzigd);

        var verdwenen = origineleBlokken.First(o => nieuweBlokken.All(n => n.Start != o.Start));

        var klas = gewijzigd.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();
        var jaarplan = new Jaarplan(klas.Id);
        var plaatsing = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, verdwenen.Start, KoppelingStatus.Aanvaard, "voor de wijziging");

        var opslag = new FakeJaarplanOpslag(klas, gewijzigd, [herfst], jaarplan);
        var service = new JaarplanGeneratieService(new FakeAiClient(), Indeling, opslag);

        // It reads as stale first: the plan reports it, and no period was invented for it.
        Assert.True(Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen).IsVervallen);

        var na = Assert.Single(
            (await service.VerplaatsPlaatsingAsync(klas.Id, plaatsing.Id, nieuweBlokken[3].Start)).Plaatsingen);

        Assert.False(na.IsVervallen);
        Assert.Equal(nieuweBlokken[3].Start, na.BlokStart);
        Assert.Equal(nieuweBlokken[3].Ordinaal, na.BlokOrdinaal);
        Assert.Equal("Manueel", na.Status);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// Dropping a card back where it started changes nothing — and in particular does <b>not</b> convert a standing
    /// AI proposal into a manual placement or discard its motivation. A no-op gesture must not silently cost the
    /// teacher the model's reasoning.
    /// </summary>
    [Fact]
    public async Task Verplaatsen_naar_dezelfde_periode_wijzigt_niets()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);
        await service.GenereerAsync(klas.Id);
        var voor = Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);

        var na = Assert.Single(
            (await service.VerplaatsPlaatsingAsync(klas.Id, voor.Id, blokken[0].Start)).Plaatsingen);

        Assert.Equal(blokken[0].Start, na.BlokStart);
        Assert.Equal("Voorgesteld", na.Status);
        Assert.Equal("past hier", na.AiMotivatie);

        // Only the generation committed; the no-op wrote nothing.
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// A block holds several thema's (Art. IX.3), so only the same thema twice in the same block is refused. The
    /// service catches it and reports it in Dutch, rather than letting the aggregate's English programmer-error
    /// exception escape to a teacher.
    /// </summary>
    [Fact]
    public async Task Een_thema_naar_een_periode_verplaatsen_waar_het_al_staat_wordt_geweigerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();

        var jaarplan = new Jaarplan(klas.Id);
        var eerste = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Voorgesteld, "eerste");
        jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[1].Start, KoppelingStatus.Voorgesteld, "tweede");

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst], jaarplan);
        var service = new JaarplanGeneratieService(new FakeAiClient(), Indeling, opslag);

        await Assert.ThrowsAsync<OngeldigeVerplaatsingFout>(
            () => service.VerplaatsPlaatsingAsync(klas.Id, eerste.Id, blokken[1].Start));

        Assert.Equal(blokken[0].Start, eerste.BlokStart);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// <b>A move survives the next generation run.</b> The status becomes <c>manueel</c>, so the placement is no
    /// longer <c>IsVervangbaar</c> and regeneration may not discard it (Art. IV.1, Art. IX.3). Without this, a
    /// teacher could drag a thema into place and have the next run quietly put it back.
    /// </summary>
    [Fact]
    public async Task Een_verplaatste_plaatsing_overleeft_een_hergeneratie()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var antwoord = Antwoord(("Herfst", blokken[0].Start));
        var (service, opslag, _, klas, _, _) = Opzet(antwoord, schooljaar);
        await service.GenereerAsync(klas.Id);

        var voorgesteld = Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);
        await service.VerplaatsPlaatsingAsync(klas.Id, voorgesteld.Id, blokken[2].Start);

        // The model proposes the ORIGINAL period again; the teacher's move must stand.
        var opnieuw = await new JaarplanGeneratieService(new FakeAiClient(antwoord), Indeling, opslag)
            .GenereerAsync(klas.Id);

        var verplaatst = Assert.Single(opnieuw.Jaarplan!.Plaatsingen, p => p.Status == "Manueel");
        Assert.Equal(blokken[2].Start, verplaatst.BlokStart);
        Assert.Equal(1, opnieuw.AantalBehouden);

        // The run may still add the thema in the period it wanted — that is a new proposal alongside the teacher's
        // placement, not a relocation of it. What matters is that the moved one did not budge.
        Assert.DoesNotContain(opnieuw.Jaarplan!.Plaatsingen, p => p.Id == verplaatst.Id && p.Status != "Manueel");
    }

    /// <summary>
    /// <b>A rejected placement is not moved, because moving it would grant dekking it must not have.</b>
    /// <para>
    /// This is the only status transition in the move path with an Art. V.1 consequence: under the binding reading in
    /// <c>backlog/E5-dekking-export.md</c> only <c>aanvaard</c>/<c>manueel</c> placements count as *placed*, so
    /// converting a rejection to <c>manueel</c> would flip the thema from "not taught" to "taught" in the figure the
    /// onderwijsinspectie is shown — as a side effect of a drag, with no teacher decision. Found by the E3-07
    /// antagonist audit: the story built an explicit, explained control for reversing a rejection and then let a drag
    /// do the same thing silently.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_geweigerde_plaatsing_verplaatsen_wordt_geweigerd_en_verandert_geen_dekking()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();

        var jaarplan = new Jaarplan(klas.Id);
        var geweigerd = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Geweigerd, "afgewezen");

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst], jaarplan);
        var service = new JaarplanGeneratieService(new FakeAiClient(), Indeling, opslag);

        await Assert.ThrowsAsync<OngeldigeVerplaatsingFout>(
            () => service.VerplaatsPlaatsingAsync(klas.Id, geweigerd.Id, blokken[1].Start));

        // Nothing moved, the rejection stands, and nothing was written.
        Assert.Equal(blokken[0].Start, geweigerd.BlokStart);
        Assert.Equal(KoppelingStatus.Geweigerd, geweigerd.Status);
        Assert.False(geweigerd.IsGepland);
        Assert.Equal(0, opslag.AantalKeerBewaard);

        // Refused even for a drop back onto its own period, so the gesture is never taught as available. Without
        // this ordering the no-op branch would answer 200 and the card would look draggable.
        await Assert.ThrowsAsync<OngeldigeVerplaatsingFout>(
            () => service.VerplaatsPlaatsingAsync(klas.Id, geweigerd.Id, blokken[0].Start));

        // The explicit route out is still open: the teacher reverses the rejection, and *then* it can move.
        await service.WijzigPlaatsingStatusAsync(klas.Id, geweigerd.Id, KoppelingStatus.Manueel);
        var na = Assert.Single(
            (await service.VerplaatsPlaatsingAsync(klas.Id, geweigerd.Id, blokken[1].Start)).Plaatsingen);
        Assert.Equal(blokken[1].Start, na.BlokStart);
        Assert.Equal("Manueel", na.Status);
    }

    /// <summary>
    /// A locked placement can still be moved by the teacher, and stays locked. Art. IX.3 scopes <c>vergrendeld</c> to
    /// "excluded from <i>regeneration</i>" — it is not a latch against its own owner, and clearing it as a side effect
    /// of a drag would silently expose the thema to the next run.
    /// </summary>
    [Fact]
    public async Task Een_vergrendelde_plaatsing_kan_verplaatst_worden_en_blijft_vergrendeld()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L3 — derde leerjaar", leerjaar: 3);
        var herfst = Herfst();

        var jaarplan = new Jaarplan(klas.Id);
        var plaatsing = jaarplan.VoegPlaatsingToe(
            herfst.Id, Planningsblokniveau.Themaperiode, blokken[0].Start, KoppelingStatus.Aanvaard, "beslist");
        plaatsing.StelVergrendelingIn(true);

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [herfst], jaarplan);
        var service = new JaarplanGeneratieService(new FakeAiClient(), Indeling, opslag);

        var na = Assert.Single(
            (await service.VerplaatsPlaatsingAsync(klas.Id, plaatsing.Id, blokken[1].Start)).Plaatsingen);

        Assert.Equal(blokken[1].Start, na.BlokStart);
        Assert.True(na.Vergrendeld);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_onbekende_plaatsing_verplaatsen_geeft_een_nietgevonden_fout()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);
        await service.GenereerAsync(klas.Id);

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => service.VerplaatsPlaatsingAsync(klas.Id, Guid.NewGuid(), blokken[1].Start));
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
        Assert.Equal("Herfst", geweigerd.ThemaNaam);
        Assert.Equal(blokken[0].Start, geweigerd.BlokStart);
        Assert.Equal("Schoolfeest", geweigerd.MomentNaam);

        // The model's proposal survives the refusal: the motivation is kept so the teacher can still read what was
        // suggested and place it by hand, rather than the thema vanishing with no trace (Art. IV.2/IV.3).
        Assert.Equal("past hier", geweigerd.AiMotivatie);

        // A refused placement IS an attention point: a thema the teacher wanted taught is now planned nowhere.
        Assert.True(rapport.HeeftAandachtspunten);
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
                VasteMomenten = [new VastMoment("Sportdag", blokken[0].Start.AddDays(2), BlokkeertPlaatsing: false)],
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
        Assert.Equal("Oudercontact", onplaatsbaar.Naam);
        Assert.Null(onplaatsbaar.BlokStart);
        Assert.Empty(resultaat.Parameters!.ToegepasteVasteMomenten);
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
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Water")],
            });

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
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Water")],
            });

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
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Water")],
            });

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
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Ruimtevaart")],
            });

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
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Water")],
            });

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
    /// The teacher's two instructions contradict each other: open with Water, and block the period Water would open.
    /// The tool refuses it, so reporting that as the model declining would tell a teacher the AI ignored them when in
    /// fact their own inputs could not both hold. Found by the E3-04 audit; the first revision had no test and did
    /// exactly that.
    /// </summary>
    [Fact]
    public async Task Een_startthema_in_een_geblokkeerd_blok_is_tegenstrijdig_niet_genegeerd_door_de_ai()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(
            Antwoord(("Water", blokken[0].Start), ("Herfst", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Water")],
                VasteMomenten = [new VastMoment("Schoolfeest", blokken[0].Start.AddDays(1), BlokkeertPlaatsing: true)],
            });

        var rapport = resultaat.Parameters!;
        Assert.Equal(["Water"], rapport.TegenstrijdigeStartthemas);

        // Crucially NOT reported as the model declining, which is what the first revision did.
        Assert.Empty(rapport.NietGehonoreerdeStartthemas);
        Assert.Empty(rapport.GehonoreerdeStartthemas);
        Assert.True(rapport.HeeftAandachtspunten);
    }

    /// <summary>
    /// Several start thema's map one-per-block from the start of the year, in the order given. The earlier revision
    /// joined them into one sentence naming a single block, which told the model to put two 4–6 week thema's in one
    /// themaperiode and guaranteed the report a false "not honoured" entry.
    /// </summary>
    [Fact]
    public async Task Meerdere_startthemas_gaan_elk_naar_hun_eigen_blok()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, client, klas, _, _) = Opzet(
            Antwoord(("Water", blokken[0].Start), ("Herfst", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas =
                [
                    new Startthemakeuze(blokken[0].Start, "Water"),
                    new Startthemakeuze(blokken[1].Start, "Herfst"),
                ],
            });

        // Each request names its OWN block in the prompt.
        var prompt = client.LaatsteRequest!.UserPrompt;
        Assert.Contains($"\"Water\" in het blok met startdatum {blokken[0].Start:yyyy-MM-dd}", prompt);
        Assert.Contains($"\"Herfst\" in het blok met startdatum {blokken[1].Start:yyyy-MM-dd}", prompt);

        // And both count as honoured, where the old single-block reading would have failed one of them.
        var rapport = resultaat.Parameters!;
        Assert.Equal(["Water", "Herfst"], rapport.GehonoreerdeStartthemas);
        Assert.Empty(rapport.NietGehonoreerdeStartthemas);
        Assert.False(rapport.HeeftAandachtspunten);
    }

    /// <summary>
    /// Two vaste momenten in one period: both are reported as applied, even though only one name explains the
    /// refusal. A teacher who enters two and sees one acknowledged has no evidence the other was parsed.
    /// </summary>
    [Fact]
    public async Task Twee_vaste_momenten_in_hetzelfde_blok_worden_beide_gerapporteerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[1].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                VasteMomenten =
                [
                    new VastMoment("Schoolfeest", blokken[0].Start.AddDays(1), BlokkeertPlaatsing: true),
                    new VastMoment("Sportdag", blokken[0].Start.AddDays(2), BlokkeertPlaatsing: true),
                ],
            });

        var toegepast = resultaat.Parameters!.ToegepasteVasteMomenten;
        Assert.Equal(2, toegepast.Count);
        Assert.All(toegepast, m => Assert.Equal(blokken[0].Start, m.BlokStart));
        Assert.Contains(toegepast, m => m.Naam == "Schoolfeest");
        Assert.Contains(toegepast, m => m.Naam == "Sportdag");
    }

    /// <summary>
    /// Blank start thema names are normalised away and names are trimmed, so a form that posts an empty row cannot make
    /// the prompt ask for "".
    /// <para>
    /// <b>Nothing is de-duplicated here any more.</b> Two rows for one period used to be thinned to
    /// <c>groep.First()</c>, silently discarding a resolvable instruction and — since a body replaces the kept settings
    /// — deleting it for good. That shape is a 400 now
    /// (<see cref="Twee_startthemas_voor_dezelfde_periode_zijn_een_ongeldig_verzoek"/>), so normalisation no longer has
    /// to make a choice nobody asked it to make.
    /// </para>
    /// <para>
    /// The same thema in <b>two different</b> periods survives, unlike under the old positional contract, which
    /// de-duplicated by name. It is expressible now that the key is a date, and it is not contradictory: a teacher may
    /// genuinely want a thema repeated later in the year.
    /// </para>
    /// </summary>
    [Fact]
    public void Startthemas_worden_genormaliseerd()
    {
        var eerste = new DateOnly(2026, 9, 1);
        var tweede = new DateOnly(2026, 11, 9);

        var parameters = new JaarplanGeneratieParameters
        {
            GewensteStartthemas =
            [
                new Startthemakeuze(tweede, "  Herfst  "),
                new Startthemakeuze(eerste, "Water"),
                new Startthemakeuze(eerste, "  "),
            ],
        };

        // Ordered by the block they target, so the prompt and the report read the year front to back.
        Assert.Equal(
            [new Startthemakeuze(eerste, "Water"), new Startthemakeuze(tweede, "Herfst")],
            parameters.GenormaliseerdeStartthemas());

        Assert.False(parameters.IsLeeg);
        Assert.True(new JaarplanGeneratieParameters().IsLeeg);
        Assert.True(JaarplanGeneratieParameters.Geen.IsLeeg);

        // A row with only a name typed is not an instruction and must not become one.
        Assert.True(
            new JaarplanGeneratieParameters { VasteMomenten = [new VastMoment("  ", eerste, true)] }.IsLeeg);
    }

    // ---------------------------------------------------------------------------------------------------------
    // E3-04, persistence half (owner ruling 2026-07-30): the settings are KEPT.
    //
    // Three properties carry the ruling, and each has its own test below:
    //   * a run that posts parameters SAVES them;
    //   * a run that posts none READS them — which is what makes FR-8/E4 regeneration honour a blocked period;
    //   * saving happens BEFORE the model is called, so a failed generation does not cost the teacher their input.
    // ---------------------------------------------------------------------------------------------------------

    /// <summary>
    /// <b>The load-bearing test of the ruling.</b> A blocking vast moment is supplied once, and the <i>next</i> run
    /// supplies nothing at all: the period stays bezet. Before persistence the second run re-placed the thema, which is
    /// exactly the behaviour the owner ruled against.
    /// </summary>
    [Fact]
    public async Task Een_tweede_run_zonder_body_honoreert_de_bewaarde_parameters()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(
            Antwoord(("Herfst", blokken[0].Start), ("Water", blokken[1].Start)), schooljaar);

        var eerste = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                VasteMomenten = [new VastMoment("Schoolfeest", blokken[0].Start.AddDays(3), true)],
            });
        Assert.Equal(1, eerste.AantalNieuw);

        // Regeneration, with no parameters in the call at all — the shape E4-04/E4-05 will use.
        var tweede = await service.GenereerAsync(klas.Id);

        Assert.True(tweede.IsGeslaagd);
        Assert.Equal(1, tweede.AantalNieuw);
        Assert.DoesNotContain(tweede.Jaarplan!.Plaatsingen, p => p.BlokStart == blokken[0].Start);

        var geweigerd = Assert.Single(tweede.Parameters!.GeweigerdDoorVastMoment);
        Assert.Equal("Schoolfeest", geweigerd.MomentNaam);

        // And it really is stored, not merely remembered inside one service instance.
        var bewaard = Assert.Single(opslag.Generatieparameters!.VasteMomenten);
        Assert.Equal("Schoolfeest", bewaard.Naam);
        Assert.True(bewaard.BlokkeertPlaatsing);
    }

    /// <summary>
    /// The settings are committed <b>before</b> the AI call, so a generation that fails afterwards leaves them saved.
    /// This is not hypothetical: this environment has no <c>AzureAI:ApiKey</c>, so the client throwing is the common
    /// case, and a teacher who lost a filled-in form to it would simply not use the feature.
    /// </summary>
    [Fact]
    public async Task Een_mislukte_generatie_verliest_de_ingevulde_parameters_niet()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L4 vierde leerjaar", leerjaar: 4);
        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [Herfst(), Water()]);
        var service = new JaarplanGeneratieService(new StukkeAiClient(), Indeling, opslag);

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Water")],
                VasteMomenten = [new VastMoment("Sportdag", blokken[1].Start.AddDays(1), false)],
            }));

        // Saved despite the failure, and saved on the stable key.
        var bewaard = opslag.Generatieparameters;
        Assert.NotNull(bewaard);
        var startthema = Assert.Single(bewaard!.Startthemas);
        Assert.Equal(blokken[0].Start, startthema.BlokStart);
        Assert.Equal("Water", startthema.ThemaNaam);
        Assert.Single(bewaard.VasteMomenten);

        // The plan itself is untouched: nothing was persisted for it (Art. IV.5).
        Assert.Null(opslag.Jaarplan);
    }

    /// <summary>
    /// An explicitly <b>empty</b> body clears the kept settings. There is deliberately no separate "Bewaren" control,
    /// so this is the only way to clear them: a merge would leave a teacher who removed a vast moment with it still
    /// blocking the next run.
    /// </summary>
    [Fact]
    public async Task Een_leeg_verzoek_wist_de_bewaarde_parameters()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                VasteMomenten = [new VastMoment("Schoolfeest", blokken[0].Start.AddDays(3), true)],
            });
        Assert.Single(opslag.Generatieparameters!.VasteMomenten);

        var leeg = await service.GenereerAsync(klas.Id, new JaarplanGeneratieParameters());

        Assert.Empty(opslag.Generatieparameters!.VasteMomenten);
        Assert.True(opslag.Generatieparameters!.IsLeeg);

        // And the run itself is back to an unparameterised one: the thema lands in the period again.
        Assert.Equal(1, leeg.AantalNieuw);
        Assert.Same(ParameterRapport.Geen, leeg.Parameters);

        // A following run with no body reads the cleared settings, so nothing is blocked any more either.
        var daarna = await service.GenereerAsync(klas.Id);
        Assert.Empty(daarna.Parameters!.GeweigerdDoorVastMoment);
    }

    /// <summary>The read path the form loads: the kept settings, or the empty set for a class that has none.</summary>
    [Fact]
    public async Task De_bewaarde_parameters_zijn_uitleesbaar_en_leeg_is_geen_fout()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        // Nothing kept yet: the empty set, not a not-found. "No settings" is the normal state.
        Assert.Same(JaarplanGeneratieParameters.Geen, await service.HaalParametersAsync(klas.Id));

        await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[1].Start, "Water")],
                VasteMomenten = [new VastMoment("Schoolfeest", blokken[0].Start.AddDays(3), true)],
            });

        var gelezen = await service.HaalParametersAsync(klas.Id);
        Assert.Equal(
            [new Startthemakeuze(blokken[1].Start, "Water")], gelezen.GewensteStartthemas);
        Assert.Equal(
            [new VastMoment("Schoolfeest", blokken[0].Start.AddDays(3), true)], gelezen.VasteMomenten);
    }

    /// <summary>
    /// A kept setting from another <b>school year</b> is never read. The dates stored here are only meaningful inside
    /// one year, so this is the leak the (klas, schooljaar) key exists to make impossible: a schoolfeest on 2026-09-15
    /// loaded into 2027-2028's form would put a stale constraint in front of a teacher as if they had set it.
    /// </summary>
    [Fact]
    public async Task Bewaarde_parameters_van_een_ander_schooljaar_worden_niet_gelezen()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var klas = schooljaar.VoegKlasToe("L5 vijfde leerjaar", leerjaar: 5);

        // Settings written for the same klas but a DIFFERENT school year — the shape a rollover (E8-03) would leave.
        var vorigJaar = new Generatieparameters(klas.Id, Guid.NewGuid());
        vorigJaar.Vervang(
            [new BewaardStartthema(blokken[0].Start, "Water")],
            [new BewaardVastMoment("Schoolfeest van vorig jaar", blokken[0].Start.AddDays(3), true)]);

        var opslag = new FakeJaarplanOpslag(klas, schooljaar, [Herfst(), Water()]);
        await opslag.ProbeerGeneratieparametersToeTeVoegenAsync(vorigJaar);
        var client = new FakeAiClient(Antwoord(("Herfst", blokken[0].Start)));
        var service = new JaarplanGeneratieService(client, Indeling, opslag);

        Assert.Same(JaarplanGeneratieParameters.Geen, await service.HaalParametersAsync(klas.Id));

        // And the stale blocking moment does not silently refuse a placement in this year either.
        var resultaat = await service.GenereerAsync(klas.Id);
        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Empty(resultaat.Parameters!.GeweigerdDoorVastMoment);
        Assert.DoesNotContain("vorig jaar", client.LaatsteRequest!.UserPrompt);
    }

    /// <summary>
    /// A kept start thema whose block start is no longer a period boundary — a beheerder edited the vakantiedata — is
    /// <b>reported</b>, kept, and asked of nobody. Never dropped and never moved to a neighbouring period, which is the
    /// ruling directie made for placements on 2026-07-28, applied to the parameter that now survives long enough to hit
    /// it.
    /// </summary>
    [Fact]
    public async Task Een_startthema_op_een_verdwenen_periodegrens_wordt_gemeld_niet_verplaatst()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, client, klas, _, _) = Opzet(
            Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        // A date inside the year that starts no block: the day after the first block begins.
        var geenBlokgrens = blokken[0].Start.AddDays(1);

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(geenBlokgrens, "Water")],
            });

        var rapport = resultaat.Parameters!;
        var vervallen = Assert.Single(rapport.VervallenStartthemas);
        Assert.Equal("Water", vervallen.ThemaNaam);
        Assert.Equal(geenBlokgrens, vervallen.BlokStart);
        Assert.True(rapport.HeeftAandachtspunten);

        // Not silently re-filed as something else, and not blamed on the model.
        Assert.Empty(rapport.NietGehonoreerdeStartthemas);
        Assert.Empty(rapport.TegenstrijdigeStartthemas);
        Assert.Empty(rapport.OnbekendeStartthemas);

        // The model is not told to use a date that starts no block, which the system prompt forbids anyway.
        Assert.DoesNotContain(
            $"\"Water\" in het blok met startdatum {geenBlokgrens:yyyy-MM-dd}", client.LaatsteRequest!.UserPrompt);

        // But the setting SURVIVES: reverting the vakantie edit must restore it, so it is not thrown away.
        Assert.Equal(geenBlokgrens, Assert.Single(opslag.Generatieparameters!.Startthemas).BlokStart);
    }

    /// <summary>
    /// One period opens with one thema, held by the aggregate and not only by the application's normalisation — the
    /// database index above it enforces the same thing.
    /// </summary>
    [Fact]
    public void Twee_startthemas_voor_dezelfde_periode_worden_geweigerd_door_het_aggregaat()
    {
        var parameters = new Generatieparameters(Guid.NewGuid(), Guid.NewGuid());
        var blok = new DateOnly(2026, 9, 1);

        Assert.Throws<ArgumentException>(() => parameters.Vervang(
            [new BewaardStartthema(blok, "Water"), new BewaardStartthema(blok, "Herfst")],
            []));
    }

    /// <summary>
    /// <b>Two preferences for one period are refused at the boundary, not thinned silently.</b> An earlier revision
    /// de-duplicated them inside <c>GenormaliseerdeStartthemas</c> with <c>groep.First()</c>, so one fully resolvable
    /// instruction disappeared with no report entry — and, now that a body replaces the kept settings, was deleted for
    /// good. The validation runs on the bound request body, so this asserts the same method <c>[ApiController]</c> calls.
    /// </summary>
    [Fact]
    public void Twee_startthemas_voor_dezelfde_periode_zijn_een_ongeldig_verzoek()
    {
        var blok = new DateOnly(2026, 9, 1);
        var parameters = new JaarplanGeneratieParameters
        {
            GewensteStartthemas = [new Startthemakeuze(blok, "Water"), new Startthemakeuze(blok, "Herfst")],
        };

        var fout = Assert.Single(parameters.Validate(new ValidationContext(parameters)));
        Assert.Contains("2026-09-01", fout.ErrorMessage);
        Assert.Equal([nameof(JaarplanGeneratieParameters.GewensteStartthemas)], fout.MemberNames);

        // And neither entry is dropped on the way through: the set stays as sent, so nothing is lost quietly.
        Assert.Equal(2, parameters.GenormaliseerdeStartthemas().Count);

        // The same thema in two DIFFERENT periods stays valid — it is a plan a teacher may genuinely want.
        var tweePeriodes = new JaarplanGeneratieParameters
        {
            GewensteStartthemas =
            [
                new Startthemakeuze(blok, "Water"),
                new Startthemakeuze(blok.AddDays(40), "Water"),
            ],
        };
        Assert.Empty(tweePeriodes.Validate(new ValidationContext(tweePeriodes)));
    }

    /// <summary>
    /// A class with nothing kept that submits nothing gets <b>no settings row</b>. The form posts a body on every run
    /// once its query resolves, and for such a class that body is <c>{[], []}</c>, so without this every class would
    /// carry an empty row after its first generation — which the code comment here used to deny.
    /// </summary>
    [Fact]
    public async Task Een_lege_inzending_maakt_geen_parameterrij_aan()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        var resultaat = await service.GenereerAsync(klas.Id, new JaarplanGeneratieParameters());

        Assert.True(resultaat.IsGeslaagd);
        Assert.Null(opslag.Generatieparameters);
        Assert.Same(ParameterRapport.Geen, resultaat.Parameters);

        // Reading it back is still the normal empty answer, so nothing is lost by not writing the row.
        Assert.Same(JaarplanGeneratieParameters.Geen, await service.HaalParametersAsync(klas.Id));
    }

    /// <summary>
    /// <b>Two runs starting together do not 500 <i>on the settings row</i></b> — and the scope of that claim is
    /// deliberate. Both find no settings row, both create one, and the <c>(KlasId, SchooljaarId)</c> unique index refuses
    /// the second, which used to surface as a raw <c>23505</c> in a 500 with an English detail. The loser's intent is
    /// satisfiable, so it takes the winner's row and writes its own settings into it: last write wins, exactly as two
    /// runs a second apart already behave.
    /// <para>
    /// <b>The wider class is NOT closed, and pretending otherwise is what the name of this test used to do.</b>
    /// <c>LaadOfMaakJaarplanAsync</c> does the identical unguarded load-or-create for <see cref="Jaarplan"/>, which also
    /// carries a unique index on <c>KlasId</c> and whose <c>BewaarAsync</c> catches nothing — so two simultaneous
    /// first-ever runs for one class still fail one step later, and two simultaneous regenerations can still lose the
    /// <c>VerwijderVervangbarePlaatsingen</c> delete. Recorded as a known residual in the E3-04 backlog entry rather than
    /// fixed here, because the resolution is a different one (the loser's plan write is not "last write wins" in any
    /// obvious sense) and it belongs to E3-01's aggregate.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Een_gelijktijdige_run_verliest_de_parameterrace_zonder_fout()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(("Herfst", blokken[0].Start)), schooljaar);

        // The row a concurrent run inserted first, with ITS parameters in it.
        var winnaar = new Generatieparameters(klas.Id, schooljaar.Id);
        winnaar.Vervang([new BewaardStartthema(blokken[1].Start, "Herfst")], []);
        opslag.GelijktijdigeWinnaar = winnaar;

        var resultaat = await service.GenereerAsync(
            klas.Id,
            new JaarplanGeneratieParameters
            {
                GewensteStartthemas = [new Startthemakeuze(blokken[0].Start, "Water")],
                VasteMomenten = [new VastMoment("Sportdag", blokken[1].Start.AddDays(1), false)],
            });

        Assert.True(resultaat.IsGeslaagd);

        // One row, holding what the losing run asked for — and its vast moment too, so nothing it sent was dropped.
        var bewaard = opslag.Generatieparameters!;
        var startthema = Assert.Single(bewaard.Startthemas);
        Assert.Equal(blokken[0].Start, startthema.BlokStart);
        Assert.Equal("Water", startthema.ThemaNaam);
        Assert.Equal("Sportdag", Assert.Single(bewaard.VasteMomenten).Naam);

        // And the run itself used those parameters rather than the winner's.
        Assert.Equal(
            [new Startthemakeuze(blokken[0].Start, "Water")],
            (await service.HaalParametersAsync(klas.Id)).GewensteStartthemas);
    }

    /// <summary>
    /// <b>The frontend's <c>GENERATIEBLOKNIVEAU</c> is the same tier as <see cref="JaarplanGeneratieService.GeneratieNiveau"/>,
    /// and this test is the only thing that binds them.</b>
    /// <para>
    /// The constant is duplicated across the wire: the parameter form compares the grid's <c>niveau</c> against its own
    /// copy, and the two halves were coupled by a doc comment. Move generation to another tier and, with nothing
    /// asserting the pair, the form degrades <i>silently and permanently</i> to its "another tier" branch: startthema's
    /// become unsettable and no test fails. <c>PlanningsroosterEndpointTests</c> does not cover this — it pins the
    /// <i>rooster</i> default, which is a different decision that merely happens to agree today.
    /// </para>
    /// <para>
    /// Reading the TypeScript is the point: an assertion on the C# value alone would pass while the halves disagreed.
    /// The failure message names the file to change, because whoever moves the tier has to move both.
    /// </para>
    /// </summary>
    [Fact]
    public void De_frontendconstante_voor_het_generatieniveau_volgt_de_backend()
    {
        var repoRoot = VindRepoRoot();
        Assert.True(
            repoRoot is not null,
            $"repository root not found above {AppContext.BaseDirectory}; expected a directory holding both " +
            "backend/src and frontend/src");

        var typesPad = Path.Combine(repoRoot!, "frontend", "src", "features", "jaarplan", "types.ts");
        Assert.True(File.Exists(typesPad), $"{typesPad} does not exist");

        var match = System.Text.RegularExpressions.Regex.Match(
            File.ReadAllText(typesPad),
            """GENERATIEBLOKNIVEAU\s*=\s*"(?<niveau>[^"]+)"\s*;""");
        Assert.True(match.Success, $"GENERATIEBLOKNIVEAU is not declared as a string literal in {typesPad}");

        Assert.Equal(
            JaarplanGeneratieService.GeneratieNiveau.ToString(),
            match.Groups["niveau"].Value);
    }

    // --- E4-03: placing a thema by hand, with no AI involved (FR-7.2). ---

    /// <summary>
    /// <b>The story's own criterion, and the one thing that was impossible before it.</b> A class that has never been
    /// generated for has no <c>Jaarplan</c> row at all, and every other manual path 404s on that. Here the plan is
    /// created by the hand-placement itself, and the assertion that carries the weight is
    /// <see cref="FakeAiClient.AantalAanroepen"/>: <b>zero</b>. "Los van de AI" is not evidenced by a placement that
    /// happens to be manual, but by a plan that exists without the model ever having been asked.
    /// </summary>
    [Fact]
    public async Task Een_klas_zonder_jaarplan_krijgt_haar_eerste_thema_handmatig_zonder_enige_ai_aanroep()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, client, klas, _, themas) = Opzet(Antwoord(), schooljaar);

        // No generation ran, so there is no plan to edit — the precondition, asserted rather than assumed.
        Assert.Empty((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);

        var na = Assert.Single(
            (await service.VoegPlaatsingToeAsync(klas.Id, themas[0].Id, blokken[2].Start)).Plaatsingen);

        Assert.Equal(0, client.AantalAanroepen);

        Assert.Equal(themas[0].Id, na.ThemaId);
        Assert.Equal(blokken[2].Start, na.BlokStart);
        Assert.Equal(blokken[2].Ordinaal, na.BlokOrdinaal);
        Assert.Equal("Themaperiode", na.BlokNiveau);
        Assert.False(na.IsVervallen);

        // The teacher's own decision: manueel, and nothing attributed to a model that was never called (Art. IV.3).
        Assert.Equal("Manueel", na.Status);
        Assert.Null(na.AiMotivatie);
        Assert.False(na.Vergrendeld);

        Assert.Equal(1, opslag.AantalKeerBewaard);

        // Survives a reload: the plan was persisted, not just projected back out of the call's own return value.
        Assert.Equal("Manueel", Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen).Status);
    }

    /// <summary>
    /// A period that starts no block of the current grid is <b>refused</b>, never snapped to the nearest one. Same rule
    /// and same reason as the move path and generation: a thema in a period nobody chose is the silent relocation
    /// ADR-0020 and the directie ruling of 2026-07-28 forbid.
    /// </summary>
    [Fact]
    public async Task Handmatig_plaatsen_op_een_datum_die_geen_periodebegin_is_wordt_geweigerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, themas) = Opzet(Antwoord(), schooljaar);

        // One day past a real boundary: the nearest block is obvious, which is exactly why refusing matters.
        var netNaastEenGrens = blokken[1].Start.AddDays(1);

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => service.VoegPlaatsingToeAsync(klas.Id, themas[0].Id, netNaastEenGrens));

        Assert.Empty((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// A subthemaperiode start is refused too, and this is the case a "is it a date on the grid?" check would wave
    /// through: each themaperiode's <b>first</b> sub-block shares its parent's start date, so those dates are real
    /// boundaries at the fine tier. Accepting one would record five weeks where the teacher aimed at a fortnight
    /// (E3-08's reasoning), so the service resolves against the generation tier only. Uses a fine start that is
    /// <i>not</i> also a coarse one, which is the only form of this input that can fail.
    /// </summary>
    [Fact]
    public async Task Handmatig_plaatsen_op_een_subthemaperiode_die_geen_themaperiode_begint_wordt_geweigerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var grofOverzicht = Blokken(schooljaar).Select(b => b.Start).ToHashSet();
        var fijn = Indeling.Blokken(schooljaar, Planningsblokniveau.Subthemaperiode);

        var alleenFijn = fijn.First(b => !grofOverzicht.Contains(b.Start));

        var (service, opslag, _, klas, _, themas) = Opzet(Antwoord(), schooljaar);

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => service.VoegPlaatsingToeAsync(klas.Id, themas[0].Id, alleenFijn.Start));

        Assert.Empty((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// The exact duplicate is refused in Dutch by the service, rather than letting the aggregate's English
    /// programmer-error exception escape to a teacher.
    /// </summary>
    [Fact]
    public async Task Hetzelfde_thema_twee_keer_in_dezelfde_periode_wordt_geweigerd()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, themas) = Opzet(Antwoord(), schooljaar);

        await service.VoegPlaatsingToeAsync(klas.Id, themas[0].Id, blokken[0].Start);

        await Assert.ThrowsAsync<OngeldigePlaatsingFout>(
            () => service.VoegPlaatsingToeAsync(klas.Id, themas[0].Id, blokken[0].Start));

        Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// <b>Two different thema's in one period is allowed</b>, because Art. IX.3 says a block holds "a list of thema's".
    /// Pinned alongside the duplicate refusal above so a future tightening of that guard cannot quietly become
    /// "one thema per period", which the model does not say and a graadklas would not survive.
    /// </summary>
    [Fact]
    public async Task Twee_verschillende_themas_in_dezelfde_periode_mogen()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, _, _, klas, _, themas) = Opzet(Antwoord(), schooljaar);

        await service.VoegPlaatsingToeAsync(klas.Id, themas[0].Id, blokken[0].Start);
        var na = (await service.VoegPlaatsingToeAsync(klas.Id, themas[1].Id, blokken[0].Start)).Plaatsingen;

        Assert.Equal(2, na.Count);
        Assert.All(na, p => Assert.Equal(blokken[0].Start, p.BlokStart));

        // Both sides sorted. An earlier revision sorted only the actual against an unsorted expected of two random
        // Guids, so it passed on the ordering luck of that run — a test that can pass for the wrong reason.
        Assert.Equal(
            new[] { themas[0].Id, themas[1].Id }.Order().ToArray(),
            na.Select(p => p.ThemaId).Order().ToArray());
    }

    /// <summary>
    /// An unknown thema is a 404, not a placement pointing at nothing. Reachable in practice from a picker list that
    /// went stale while the page was open (a colleague deleting a thema through E1-14's beheer screen).
    /// </summary>
    [Fact]
    public async Task Handmatig_plaatsen_van_een_onbekend_thema_is_niet_gevonden()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);
        var (service, opslag, _, klas, _, _) = Opzet(Antwoord(), schooljaar);

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(
            () => service.VoegPlaatsingToeAsync(klas.Id, Guid.NewGuid(), blokken[0].Start));

        Assert.Empty((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    /// <summary>
    /// <b>A hand-placed thema survives a regeneration, without the teacher locking anything.</b> This is the
    /// consequence of landing as <c>manueel</c> rather than <c>voorgesteld</c>, and it is what makes hand-built work
    /// safe to do before pressing generate: <c>IsVervangbaar</c> is <c>Voorgesteld &amp;&amp; !Vergrendeld</c>, so a run
    /// discards the AI's own untouched proposals and leaves this one alone (Art. IV.1, Art. IX.3). Pinned here because
    /// E4-06's copy tells teachers exactly this in words, and until now no hand-placement existed to test it with.
    /// </summary>
    [Fact]
    public async Task Een_handmatig_geplaatst_thema_overleeft_een_hergeneratie()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var blokken = Blokken(schooljaar);

        // The AI proposes Water in period 1; the teacher has hand-placed Herfst in period 4.
        var (service, _, _, klas, _, themas) = Opzet(Antwoord(("Water", blokken[0].Start)), schooljaar);
        var handmatig = Assert.Single(
            (await service.VoegPlaatsingToeAsync(klas.Id, themas[0].Id, blokken[3].Start)).Plaatsingen);

        await service.GenereerAsync(klas.Id);
        var na = (await service.HaalJaarplanAsync(klas.Id)).Plaatsingen;

        // Both are there: the generated proposal, and the teacher's own placement untouched.
        var bewaard = Assert.Single(na, p => p.Id == handmatig.Id);
        Assert.Equal("Manueel", bewaard.Status);
        Assert.Equal(blokken[3].Start, bewaard.BlokStart);
        Assert.Contains(na, p => p.Status == "Voorgesteld" && p.BlokStart == blokken[0].Start);

        // And a second run still leaves it standing, which is the case FR-8 actually exercises.
        await service.GenereerAsync(klas.Id);
        Assert.Equal(
            "Manueel",
            Assert.Single((await service.HaalJaarplanAsync(klas.Id)).Plaatsingen, p => p.Id == handmatig.Id).Status);
    }

    /// <summary>
    /// Walks up from the test assembly to the repository root, identified by holding both source trees. Walked rather
    /// than assumed as a fixed number of <c>..</c> segments, which breaks on a different target framework or output path.
    /// </summary>
    private static string? VindRepoRoot()
    {
        for (var map = new DirectoryInfo(AppContext.BaseDirectory); map is not null; map = map.Parent)
        {
            if (Directory.Exists(Path.Combine(map.FullName, "backend", "src")) &&
                Directory.Exists(Path.Combine(map.FullName, "frontend", "src")))
            {
                return map.FullName;
            }
        }

        return null;
    }

    /// <summary>An AI client that always fails, for the "a failed run keeps the parameters" test.</summary>
    private sealed class StukkeAiClient : IAiClient
    {
        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            throw new InvalidOperationException("AzureAI:ApiKey is not configured.");
    }
}
