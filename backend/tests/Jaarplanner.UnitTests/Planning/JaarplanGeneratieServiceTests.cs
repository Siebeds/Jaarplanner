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

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        var opslag = new FakeJaarplanOpslag(null, null);

        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(null!, Indeling, opslag));
        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(new FakeAiClient(), null!, opslag));
        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(new FakeAiClient(), Indeling, null!));
    }
}
