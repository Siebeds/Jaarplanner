using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.UnitTests.Ai;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The jaarplan generation on dates (TB-053, ADR-0055): the model names thema's and start weeks, and the service turns
/// them into days by the calendar rules of ADR-0053, on free days only, with no database and no network (Art. IV.6).
/// The school year is 1 September 2026 to 30 June 2027 with the four Belgian vacations; 1 September is a Tuesday.
/// </summary>
public sealed class JaarplanGeneratieServiceTests
{
    private static DateOnly D(int maand, int dag) => new(maand >= 9 ? 2026 : 2027, maand, dag);

    private static Thema Herfst()
    {
        var thema = new Thema("Herfst", duurWeken: 5, invalshoeken: "natuur");
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Aanvaard, "anchor"));
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-02", KoppelingStatus.Voorgesteld, "nog niet beslist"));
        thema.KoppelMinimumdoel("K-1.1.1");

        return thema;
    }

    private sealed class Opzet
    {
        /// <param name="antwoord">What the fake model answers.</param>
        /// <param name="vul">Fills a plan the klas already has; without it the klas has none.</param>
        /// <param name="begrenzing">The prompt ceiling; the default one when omitted.</param>
        /// <param name="metThemas">False for a school without thema's.</param>
        public Opzet(
            string antwoord,
            Action<Opzet, Jaarplan>? vul = null,
            Promptbegrenzing? begrenzing = null,
            bool metThemas = true)
        {
            Schooljaar = TestSchooljaar.MetVakanties();
            Klas = Schooljaar.VoegKlasToe("L3 derde leerjaar", "L3");
            Herfst = JaarplanGeneratieServiceTests.Herfst();
            Water = new Thema("Water", duurWeken: 5);
            Winter = new Thema("Winter", duurWeken: 3);

            Jaarplan? jaarplan = null;
            if (vul is not null)
            {
                jaarplan = new Jaarplan(Klas.Id);
                vul(this, jaarplan);
            }

            Opslag = new FakeJaarplanOpslag(Klas, Schooljaar, metThemas ? [Herfst, Water, Winter] : [], jaarplan);
            Ai = new FakeAiClient(antwoord);
            Service = new JaarplanGeneratieService(Ai, Opslag, begrenzing ?? new Promptbegrenzing());
        }

        public Schooljaar Schooljaar { get; }

        public Klas Klas { get; }

        public Thema Herfst { get; }

        public Thema Water { get; }

        public Thema Winter { get; }

        public FakeJaarplanOpslag Opslag { get; }

        public FakeAiClient Ai { get; }

        public JaarplanGeneratieService Service { get; }

        public Task<JaarplanGeneratieResultaat> GenereerAsync() => Service.GenereerAsync(Klas.Id);
    }

    private static string Antwoord(params (string Thema, string Startweek)[] voorstellen) =>
        "{\"plaatsingen\":[" +
        string.Join(",", voorstellen.Select(v =>
            $"{{\"thema\":\"{v.Thema}\",\"startweek\":\"{v.Startweek}\",\"motivatie\":\"past bij {v.Thema}\"}}")) +
        "]}";

    [Fact]
    public async Task Een_leeg_jaarplan_krijgt_themas_met_eigen_datums_zonder_overlap_en_gesplitst_rond_een_vakantie()
    {
        var opzet = new Opzet(Antwoord(("Herfst", "2026-08-31"), ("Water", "2026-10-05")));

        var resultaat = await opzet.GenereerAsync();

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(2, resultaat.AantalNieuw);
        Assert.Empty(resultaat.NietGeplaatst);

        var plaatsingen = opzet.Opslag.Jaarplan!.Plaatsingen;
        Assert.Equal(
            [
                (opzet.Herfst.Id, D(9, 1), D(10, 5)),
                (opzet.Water.Id, D(10, 6), D(10, 30)),
                (opzet.Water.Id, D(11, 9), D(11, 16)),
            ],
            plaatsingen.Select(p => (p.ThemaId, p.Van, p.Tot)));
        Assert.All(plaatsingen, p =>
        {
            Assert.Equal(KoppelingStatus.Voorgesteld, p.Status);
            Assert.False(p.Vergrendeld);
            Assert.StartsWith("past bij", p.AiMotivatie);
        });
        Assert.Equal(1, opzet.Opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_hergeneratie_houdt_beslist_en_vergrendeld_en_vervangt_alleen_open_voorstellen()
    {
        var opzet = new Opzet(
            Antwoord(("Herfst", "2026-09-07"), ("Water", "2026-10-05"), ("Winter", "2027-01-04")),
            (o, plan) =>
            {
                plan.VoegPlaatsingToe(o.Herfst.Id, D(9, 1), D(10, 2), KoppelingStatus.Manueel);
                plan.VoegPlaatsingToe(o.Water.Id, D(11, 9), D(11, 27), KoppelingStatus.Voorgesteld, "oud");
                plan.VoegPlaatsingToe(o.Winter.Id, D(1, 4), D(1, 22), KoppelingStatus.Voorgesteld, "vast")
                    .StelVergrendelingIn(true);
            });

        var resultaat = await opzet.GenereerAsync();

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalVervangen);
        Assert.Equal(2, resultaat.AantalBehouden);
        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Equal(
            [
                new NietGeplaatstThema("Herfst", NietGeplaatstThema.AlGepland),
                new NietGeplaatstThema("Winter", NietGeplaatstThema.AlGepland),
            ],
            resultaat.NietGeplaatst);

        var plaatsingen = opzet.Opslag.Jaarplan!.Plaatsingen;
        Assert.Equal(
            [
                (opzet.Herfst.Id, D(9, 1), D(10, 2), KoppelingStatus.Manueel),
                (opzet.Water.Id, D(10, 5), D(10, 30), KoppelingStatus.Voorgesteld),
                (opzet.Water.Id, D(11, 9), D(11, 13), KoppelingStatus.Voorgesteld),
                (opzet.Winter.Id, D(1, 4), D(1, 22), KoppelingStatus.Voorgesteld),
            ],
            plaatsingen.Select(p => (p.ThemaId, p.Van, p.Tot, p.Status)));
        Assert.DoesNotContain(plaatsingen, p => p.AiMotivatie == "oud");

        // The model is shown what stays, and the proposal about to go is not in its way.
        var prompt = opzet.Ai.LaatsteRequest!.UserPrompt;
        Assert.Contains("- 2026-09-07: bezet (Herfst)", prompt);
        Assert.Contains("- 2026-11-09: vrij", prompt);
        Assert.Contains("- 2027-01-04: bezet (Winter)", prompt);
        var alGepland = prompt[prompt.IndexOf("# Thema's die al in het jaarplan staan", StringComparison.Ordinal)..];
        Assert.Contains("- Herfst", alGepland);
        Assert.DoesNotContain("- Water", alGepland[..alGepland.IndexOf("# Thema's van de school", StringComparison.Ordinal)]);
    }

    /// <summary>
    /// A thema split around a vacation of which the teacher accepted one part stays whole: its open part is not
    /// replaced, and the model is shown both parts as taken.
    /// </summary>
    [Fact]
    public async Task Een_deels_aanvaard_thema_blijft_heel()
    {
        var opzet = new Opzet(
            Antwoord(("Water", "2026-10-05")),
            (o, plan) =>
            {
                plan.VoegPlaatsingToe(o.Water.Id, D(10, 5), D(10, 30), KoppelingStatus.Aanvaard);
                plan.VoegPlaatsingToe(o.Water.Id, D(11, 9), D(11, 13), KoppelingStatus.Voorgesteld, "deel 2");
                plan.VoegPlaatsingToe(o.Herfst.Id, D(9, 1), D(9, 25), KoppelingStatus.Voorgesteld, "open");
            });

        var resultaat = await opzet.GenereerAsync();

        Assert.Equal(1, resultaat.AantalVervangen);
        Assert.Equal(1, resultaat.AantalBehouden);
        Assert.Equal([new NietGeplaatstThema("Water", NietGeplaatstThema.AlGepland)], resultaat.NietGeplaatst);
        Assert.Equal(
            [(D(10, 5), D(10, 30)), (D(11, 9), D(11, 13))],
            opzet.Opslag.Jaarplan!.Plaatsingen.Select(p => (p.Van, p.Tot)));
        Assert.Contains("- 2026-11-09: bezet (Water)", opzet.Ai.LaatsteRequest!.UserPrompt);
    }

    [Fact]
    public async Task Een_thema_dat_tegen_een_bestaand_thema_botst_stopt_de_schooldag_ervoor()
    {
        var opzet = new Opzet(
            Antwoord(("Herfst", "2026-09-21")),
            (o, plan) => plan.VoegPlaatsingToe(o.Water.Id, D(10, 12), D(10, 30), KoppelingStatus.Manueel));

        var resultaat = await opzet.GenereerAsync();

        Assert.Equal(1, resultaat.AantalNieuw);
        var herfst = Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen, p => p.ThemaId == opzet.Herfst.Id);
        Assert.Equal((D(9, 21), D(10, 9)), (herfst.Van, herfst.Tot));
    }

    [Fact]
    public async Task Een_thema_begint_op_de_eerste_vrije_schooldag_in_de_gekozen_weken()
    {
        var opzet = new Opzet(
            Antwoord(("Herfst", "2026-09-07")),
            (o, plan) => plan.VoegPlaatsingToe(o.Water.Id, D(9, 1), D(9, 9), KoppelingStatus.Manueel));

        await opzet.GenereerAsync();

        var herfst = Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen, p => p.ThemaId == opzet.Herfst.Id);
        Assert.Equal((D(9, 10), D(10, 14)), (herfst.Van, herfst.Tot));
    }

    [Fact]
    public async Task Weken_zonder_vrije_lesweek_zijn_geen_plaats()
    {
        var opzet = new Opzet(
            Antwoord(("Herfst", "2026-09-07"), ("Winter", "2026-09-14")),
            (o, plan) =>
            {
                // 7 September to 9 October is full; the stretch 17-18 September is shorter than one lesweek.
                plan.VoegPlaatsingToe(o.Water.Id, D(9, 1), D(9, 16), KoppelingStatus.Manueel);
                plan.VoegPlaatsingToe(o.Water.Id, D(9, 21), D(10, 16), KoppelingStatus.Aanvaard);
            });

        var resultaat = await opzet.GenereerAsync();

        Assert.Equal(0, resultaat.AantalNieuw);
        Assert.Equal(
            [
                new NietGeplaatstThema("Herfst", NietGeplaatstThema.GeenPlaats),
                new NietGeplaatstThema("Winter", NietGeplaatstThema.GeenPlaats),
            ],
            resultaat.NietGeplaatst);
        Assert.Equal(2, opzet.Opslag.Jaarplan!.Plaatsingen.Count);
    }

    [Fact]
    public async Task Is_het_eerste_vrije_stuk_te_kort_dan_krijgt_het_thema_het_volgende()
    {
        var opzet = new Opzet(
            Antwoord(("Herfst", "2026-09-14")),
            (o, plan) =>
            {
                plan.VoegPlaatsingToe(o.Water.Id, D(9, 1), D(9, 16), KoppelingStatus.Manueel);
                plan.VoegPlaatsingToe(o.Winter.Id, D(9, 21), D(9, 25), KoppelingStatus.Aanvaard);
            });

        await opzet.GenereerAsync();

        var herfst = Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen, p => p.ThemaId == opzet.Herfst.Id);
        Assert.Equal((D(9, 28), D(10, 30)), (herfst.Van, herfst.Tot));
    }

    /// <summary>
    /// At the end of the year a thema stops on the last schooldag (ADR-0053 R5); a start in the last, partial week holds
    /// no whole lesweek and is no place.
    /// </summary>
    [Fact]
    public async Task Aan_het_einde_van_het_jaar_stopt_een_thema_op_de_laatste_schooldag_of_past_het_niet()
    {
        var afgekapt = new Opzet(Antwoord(("Herfst", "2027-06-07")));
        await afgekapt.GenereerAsync();
        var herfst = Assert.Single(afgekapt.Opslag.Jaarplan!.Plaatsingen);
        Assert.Equal((D(6, 7), D(6, 30)), (herfst.Van, herfst.Tot));

        var opzet = new Opzet(Antwoord(("Winter", "2027-06-07"), ("Water", "2027-06-28")));
        var resultaat = await opzet.GenereerAsync();
        var winter = Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen);
        Assert.Equal((opzet.Winter.Id, D(6, 7), D(6, 25)), (winter.ThemaId, winter.Van, winter.Tot));
        Assert.Equal([new NietGeplaatstThema("Water", NietGeplaatstThema.GeenPlaats)], resultaat.NietGeplaatst);
    }

    [Fact]
    public async Task Een_onbekend_thema_een_vakantieweek_en_een_dubbel_voorstel_worden_gemeld_en_niet_geplaatst()
    {
        var opzet = new Opzet(Antwoord(
            ("Ruimte", "2026-09-07"),
            ("Water", "2026-11-02"),
            ("herfst", "2026-09-07"),
            ("Winter", "2027-08-02"),
            ("Herfst", "2027-03-01")));

        var resultaat = await opzet.GenereerAsync();

        Assert.Equal(1, resultaat.AantalNieuw);
        Assert.Equal(
            [
                new NietGeplaatstThema("Ruimte", NietGeplaatstThema.OnbekendThema),
                new NietGeplaatstThema("Water", NietGeplaatstThema.GeenLesweek),
                new NietGeplaatstThema("Herfst", NietGeplaatstThema.AlGepland),
                new NietGeplaatstThema("Winter", NietGeplaatstThema.GeenLesweek),
            ],
            resultaat.NietGeplaatst);
        var herfst = Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen);
        Assert.Equal((opzet.Herfst.Id, D(9, 7)), (herfst.ThemaId, herfst.Van));
    }

    /// <summary>
    /// FB-012 (ADR-0069 D2): a thema not meant for the klas's leeftijd is not sent to the model, and a name the model
    /// returns for it anyway is an unknown thema.
    /// </summary>
    [Fact]
    public async Task Een_thema_voor_een_andere_leeftijd_wordt_niet_aangeboden_en_niet_geplaatst()
    {
        var opzet = new Opzet(Antwoord(("Winter", "2027-01-04"), ("Water", "2026-09-07")));
        opzet.Winter.StelLeeftijdenIn(["JK", "K2", "K3"]);

        var resultaat = await opzet.GenereerAsync();

        Assert.DoesNotContain("Winter", opzet.Ai.LaatsteRequest!.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("Water", opzet.Ai.LaatsteRequest!.UserPrompt, StringComparison.Ordinal);
        Assert.Equal([new NietGeplaatstThema("Winter", NietGeplaatstThema.OnbekendThema)], resultaat.NietGeplaatst);
        Assert.Equal(opzet.Water.Id, Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen).ThemaId);
    }

    [Fact]
    public async Task Zonder_thema_voor_de_leeftijd_van_de_klas_wordt_niet_gegenereerd()
    {
        var opzet = new Opzet(Antwoord(("Water", "2026-09-07")));
        foreach (var thema in new[] { opzet.Herfst, opzet.Water, opzet.Winter })
        {
            thema.StelLeeftijdenIn(["K3"]);
        }

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(opzet.GenereerAsync);

        Assert.Equal("De school heeft nog geen thema's voor de leeftijd van deze klas.", fout.Message);
        Assert.Null(opzet.Ai.LaatsteRequest);
    }

    /// <summary>A startweek on another weekday than Monday names the week it falls in.</summary>
    [Fact]
    public async Task Een_startdatum_midden_in_de_week_noemt_die_week()
    {
        var opzet = new Opzet(Antwoord(("Winter", "2027-01-06")));

        await opzet.GenereerAsync();

        var winter = Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen);
        Assert.Equal((D(1, 4), D(1, 22)), (winter.Van, winter.Tot));
    }

    [Fact]
    public async Task Een_onleesbaar_antwoord_verandert_niets()
    {
        var opzet = new Opzet(
            "dit is geen JSON",
            (o, plan) => plan.VoegPlaatsingToe(o.Water.Id, D(9, 7), D(9, 25), KoppelingStatus.Voorgesteld, "blijft"));

        var resultaat = await opzet.GenereerAsync();

        Assert.False(resultaat.IsGeslaagd);
        Assert.Contains("Malformed JSON", resultaat.Fout);
        Assert.Equal(0, opzet.Opslag.AantalKeerBewaard);
        Assert.Equal("blijft", Assert.Single(opzet.Opslag.Jaarplan!.Plaatsingen).AiMotivatie);
    }

    [Fact]
    public async Task Een_onleesbaar_antwoord_maakt_geen_leeg_jaarplan_aan()
    {
        var opzet = new Opzet("{\"plaatsingen\":[{\"thema\":\"Herfst\",\"motivatie\":\"x\"}]}");

        var resultaat = await opzet.GenereerAsync();

        Assert.False(resultaat.IsGeslaagd);
        Assert.Null(opzet.Opslag.Jaarplan);
    }

    [Fact]
    public async Task Een_onbekende_klas_geeft_nietgevonden_zonder_de_AI_te_vragen()
    {
        var opzet = new Opzet(Antwoord());

        await Assert.ThrowsAsync<SchoolcontentNietGevondenFout>(() => opzet.Service.GenereerAsync(Guid.NewGuid()));
        Assert.Equal(0, opzet.Ai.AantalAanroepen);
    }

    [Fact]
    public async Task Zonder_themas_wordt_de_AI_niet_gevraagd()
    {
        var opzet = new Opzet(Antwoord(), metThemas: false);

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(opzet.GenereerAsync);

        Assert.Contains("geen thema's", fout.Message);
        Assert.Equal(0, opzet.Ai.AantalAanroepen);
    }

    [Fact]
    public async Task Een_vol_jaarplan_wordt_niet_aan_de_AI_voorgelegd()
    {
        var opzet = new Opzet(
            Antwoord(),
            (o, plan) => plan.VoegPlaatsingToe(o.Water.Id, D(9, 1), D(6, 30), KoppelingStatus.Manueel));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(opzet.GenereerAsync);

        Assert.Contains("geen vrije lesweek", fout.Message);
        Assert.Equal(0, opzet.Ai.AantalAanroepen);
    }

    [Fact]
    public async Task Een_te_grote_aanvraag_wordt_niet_verstuurd()
    {
        var opzet = new Opzet(Antwoord(), begrenzing: new Promptbegrenzing(maxTokens: 10));

        var fout = await Assert.ThrowsAsync<PromptTeGrootFout>(opzet.GenereerAsync);

        Assert.Contains("3 thema's", fout.Message);
        Assert.Equal(0, opzet.Ai.AantalAanroepen);
        Assert.Null(opzet.Opslag.Jaarplan);
    }

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        var opzet = new Opzet(Antwoord());

        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(null!, opzet.Opslag, new Promptbegrenzing()));
        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(opzet.Ai, null!, new Promptbegrenzing()));
        Assert.Throws<ArgumentNullException>(() => new JaarplanGeneratieService(opzet.Ai, opzet.Opslag, null!));
    }

    /// <summary>
    /// The prompt offers the lesweken by their Monday with what stands in them, the vacations and the school's own
    /// thema's with their decided goals, and no month name.
    /// </summary>
    [Fact]
    public async Task De_prompt_biedt_lesweken_vakanties_en_themas_aan_en_geen_maandnaam()
    {
        var opzet = new Opzet(
            Antwoord(),
            (o, plan) => plan.VoegPlaatsingToe(o.Water.Id, D(9, 1), D(9, 9), KoppelingStatus.Manueel));

        await opzet.GenereerAsync();
        var request = opzet.Ai.LaatsteRequest!;
        var prompt = request.UserPrompt;

        var lesweken = new Themakalender(opzet.Schooljaar).Lesweken();
        Assert.Contains($"Aantal lesweken: {lesweken.Count}, waarvan vrij: {lesweken.Count - 2}", prompt);
        Assert.Contains("- 2026-08-31: bezet (Water)", prompt);
        Assert.Contains("- 2026-09-07: deels vrij (Water staat er al)", prompt);
        Assert.Contains("- 2026-09-14: vrij", prompt);
        Assert.DoesNotContain("- 2026-11-02:", prompt);
        Assert.Contains("- Herfstvakantie: 2026-11-02 t/m 2026-11-08", prompt);

        Assert.Contains("- Thema: Herfst (duur 5 lesweken)", prompt);
        Assert.Contains("Gekoppelde leerplandoelen (1): NAT-K3-01", prompt);
        Assert.DoesNotContain("NAT-K3-02", prompt);
        Assert.Contains("Themadoelen, minimumdoelen (1): K-1.1.1", prompt);
        Assert.Contains("Aantal thema's: 3", prompt);

        foreach (var maand in (string[])
                 ["januari", "februari", "maart", "april", "juni", "juli", "augustus", "oktober", "november", "december"])
        {
            Assert.DoesNotContain(maand, prompt, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain(maand, request.SystemPrompt, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Contains("Gebruik geen externe kennis", request.SystemPrompt);
        Assert.Contains("Twee thema's lopen nooit tegelijk", request.SystemPrompt);
        Assert.Contains("Je hoeft niet elk thema te gebruiken", request.SystemPrompt);
        Assert.Contains("\"startweek\"", request.SystemPrompt);
        Assert.DoesNotContain("blok", request.SystemPrompt, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("%", request.SystemPrompt);
    }

    [Fact]
    public void De_prompt_hangt_niet_af_van_de_volgorde_van_de_invoer()
    {
        var schooljaar = TestSchooljaar.MetVakanties();
        var klas = schooljaar.VoegKlasToe("L3", "L3");
        Planweek[] weken = [new(D(9, 7), ["B", "A"], false), new(D(8, 31), [], false)];
        Thema[] themas = [new("Water", 5), Herfst()];

        var een = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, weken, themas, ["Water", "Herfst"]).UserPrompt;
        var twee = JaarplanGeneratiePromptBuilder.Bouw(
            klas, schooljaar, weken.Reverse().ToArray(), themas.Reverse().ToArray(), ["Herfst", "Water"]).UserPrompt;

        Assert.Equal(een, twee);
        Assert.Contains("- 2026-09-07: deels vrij (A, B staat er al)", een);
    }
}

