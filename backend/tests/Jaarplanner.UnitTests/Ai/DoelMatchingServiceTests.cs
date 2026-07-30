using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.UnitTests.AiAuthoring;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Pins the E2-04 end-to-end matching flow (Art. IV.1/IV.2/IV.5/IV.6, FR-4.1/4.2): given a thema and
/// the loaded leerplandoelen, the service builds the prompt (E2-02), calls the injected
/// <see cref="FakeAiClient"/> with <b>no network</b> (E2-01), validates the completion (E2-03) and
/// persists each validated suggestion as a <c>voorgesteld</c> <c>DoelKoppeling</c> with its AI
/// motivation (E2-04) — via the in-memory <see cref="FakeDoelMatchOpslag"/> with <b>no database</b>.
/// These tests are the "Done when" evidence: suggestions are stored (advisory only) and queryable
/// per thema, and a malformed response persists nothing.
/// </summary>
public sealed class DoelMatchingServiceTests
{
    private static readonly Guid ThemaId = Guid.NewGuid();

    private static Thema EenThema()
    {
        var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur");
        thema.VoegSubthemaToe("Bladeren", duurWeken: 2, klasId: Guid.NewGuid(), leeftijd: "K3");
        return thema;
    }

    private static IReadOnlyList<Leerplandoel> EenLeerdoelenSet() =>
    [
        new Leerplandoel("NAT-K3-01", Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."),
        new Leerplandoel("NAT-K3-02", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9", tekst: "observeert de natuur."),
        new Leerplandoel("REK-L1-01", Doelsoort.Gemeenschappelijk, "L1", "Getallen", "Getalbegrip", "2", tekst: "telt tot 20."),
    ];

    private static DoelMatchingService Service(FakeAiClient client, out FakeDoelMatchOpslag opslag, Thema? thema = null)
    {
        opslag = new FakeDoelMatchOpslag(thema ?? EenThema());
        return new DoelMatchingService(client, opslag, new FakeLeerdoelCatalogus(EenLeerdoelenSet()));
    }

    private static DoelMatchingService Service(
        FakeAiClient client,
        out FakeDoelMatchOpslag opslag,
        out FakeLeerdoelCatalogus catalogus,
        Thema? thema = null,
        IReadOnlyList<Leerplandoel>? leerdoelen = null)
    {
        opslag = new FakeDoelMatchOpslag(thema ?? EenThema());
        catalogus = new FakeLeerdoelCatalogus(leerdoelen ?? EenLeerdoelenSet());
        return new DoelMatchingService(client, opslag, catalogus);
    }

    [Fact]
    public async Task Geldige_suggesties_worden_als_voorgesteld_met_motivatie_gepersisteerd()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[" +
            "{\"code\":\"NAT-K3-01\",\"motivatie\":\"past bij het observeren van bomen\"}," +
            "{\"code\":\"NAT-K3-02\",\"motivatie\":\"sluit aan bij natuurwaarneming\"}]}");
        var service = Service(fake, out var opslag, thema);

        var resultaat = await service.MatchThemaAsync(ThemaId, EenLeerdoelenSet());

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(2, resultaat.Bewaard.Count);

        // Both persisted as `voorgesteld` (Art. IV.2), never auto-accepted (Art. IV.1).
        Assert.All(thema.Doelsuggesties, k => Assert.Equal(KoppelingStatus.Voorgesteld, k.Status));
        Assert.All(thema.Themadoelen, td => Assert.Fail("matching must not create curated themadoelen"));

        var eerste = thema.Doelsuggesties.Single(k => k.LeerplandoelCode == "NAT-K3-01");
        Assert.Equal("past bij het observeren van bomen", eerste.AiMotivatie);

        // The flow reached the injected client (no network) exactly once, and committed once.
        Assert.Equal(1, fake.AantalAanroepen);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Malformed_json_persisteert_niets_en_geeft_een_fout()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent: "dit is geen JSON {kapot");
        var service = Service(fake, out var opslag, thema);

        var resultaat = await service.MatchThemaAsync(ThemaId, EenLeerdoelenSet());

        Assert.False(resultaat.IsGeslaagd);
        Assert.NotNull(resultaat.Fout);
        Assert.Empty(resultaat.Bewaard);

        // Nothing added, nothing committed (Art. IV.5).
        Assert.Empty(thema.Doelsuggesties);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Een_code_buiten_de_geladen_set_wordt_overgeslagen_niet_verzonnen()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[" +
            "{\"code\":\"NAT-K3-01\",\"motivatie\":\"geldig\"}," +
            "{\"code\":\"VERZONNEN-99\",\"motivatie\":\"deze code bestaat niet\"}]}");
        var service = Service(fake, out _, thema);

        var resultaat = await service.MatchThemaAsync(ThemaId, EenLeerdoelenSet());

        Assert.True(resultaat.IsGeslaagd);
        var bewaard = Assert.Single(thema.Doelsuggesties);
        Assert.Equal("NAT-K3-01", bewaard.LeerplandoelCode);
        Assert.Equal("VERZONNEN-99", Assert.Single(resultaat.OvergeslagenOnbekend));
    }

    [Fact]
    public async Task Een_reeds_gekoppelde_code_wordt_niet_gedupliceerd()
    {
        var thema = EenThema();
        // The thema already anchors NAT-K3-01 as a curated themadoel (Art. IX.2).
        thema.VoegThemadoelToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Manueel));

        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[{\"code\":\"NAT-K3-01\",\"motivatie\":\"reeds gekoppeld\"}]}");
        var service = Service(fake, out var opslag, thema);

        var resultaat = await service.MatchThemaAsync(ThemaId, EenLeerdoelenSet());

        Assert.True(resultaat.IsGeslaagd);
        Assert.Empty(thema.Doelsuggesties);
        Assert.Equal("NAT-K3-01", Assert.Single(resultaat.OvergeslagenDuplicaat));
        // Nothing new to persist ⇒ no unit of work.
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Gepersisteerde_suggesties_zijn_queryeerbaar_per_thema()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[{\"code\":\"NAT-K3-02\",\"motivatie\":\"waarneming\"}]}");
        var service = Service(fake, out _, thema);

        await service.MatchThemaAsync(ThemaId, EenLeerdoelenSet());

        var suggesties = await service.HaalSuggestiesVoorThemaAsync(ThemaId);
        var view = Assert.Single(suggesties);
        Assert.Equal("NAT-K3-02", view.LeerplandoelCode);
        Assert.Equal("Voorgesteld", view.Status);
        Assert.Equal("waarneming", view.AiMotivatie);
    }

    [Fact]
    public async Task Een_lege_geldige_lijst_persisteert_niets_maar_slaagt()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out var opslag, thema);

        var resultaat = await service.MatchThemaAsync(ThemaId, EenLeerdoelenSet());

        Assert.True(resultaat.IsGeslaagd);
        Assert.Empty(thema.Doelsuggesties);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Onbekend_thema_gooit_ThemaNietGevondenFout()
    {
        var fake = new FakeAiClient();
        var service = new DoelMatchingService(
            fake, new FakeDoelMatchOpslag(thema: null), new FakeLeerdoelCatalogus(EenLeerdoelenSet()));

        await Assert.ThrowsAsync<ThemaNietGevondenFout>(
            () => service.MatchThemaAsync(ThemaId, EenLeerdoelenSet()));
        // The AI is never called when the thema is missing.
        Assert.Equal(0, fake.AantalAanroepen);
    }

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        var catalogus = new FakeLeerdoelCatalogus(EenLeerdoelenSet());
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(null!, new FakeDoelMatchOpslag(EenThema()), catalogus));
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(new FakeAiClient(), null!, catalogus));
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(new FakeAiClient(), new FakeDoelMatchOpslag(EenThema()), null!));
    }

    // ---------------------------------------------------------------------------------------------
    // E2-08 — the invocation surface (FR-4.1). Everything above drives MatchThemaAsync with a
    // candidate set handed in by the test; these drive GenereerSuggestiesAsync, the entry point a
    // controller can actually call, which resolves that set itself through ILeerdoelCatalogus.
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Genereren_haalt_de_kandidaten_zelf_op_en_persisteert_als_voorgesteld()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[{\"code\":\"NAT-K3-01\",\"motivatie\":\"past bij het observeren van bomen\"}]}");
        var service = Service(fake, out var opslag, out var catalogus, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.True(resultaat.IsGeslaagd);
        var bewaard = Assert.Single(resultaat.Bewaard);
        Assert.Equal("NAT-K3-01", bewaard.LeerplandoelCode);
        Assert.Equal("Voorgesteld", bewaard.Status);
        Assert.Equal("past bij het observeren van bomen", bewaard.AiMotivatie);
        // FR-4.2: the goal's own text + doelsoort travel with the suggestion so it is judgeable.
        Assert.Equal("herkent bomen.", bewaard.Tekst);
        Assert.Equal(Doelsoort.Minimumdoel, bewaard.Doelsoort);

        // The candidate set came from the read-only curriculum seam — no caller had to supply it.
        Assert.Equal(1, catalogus.AantalAanroepen);
        Assert.Equal(3, resultaat.AantalKandidaten);

        // Advisory only: persisted as `voorgesteld`, nothing accepted (Art. IV.1/IV.2).
        Assert.All(thema.Doelsuggesties, k => Assert.Equal(KoppelingStatus.Voorgesteld, k.Status));
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Zonder_selectie_zoekt_de_generatie_in_alles()
    {
        // The default is "no filter", applied in ONE documented place — not a discipline list picked on the
        // school's behalf (Art. XIV, "disciplines first" is still open). The teacher narrows it per run.
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out _, out var catalogus);

        await service.GenereerSuggestiesAsync(ThemaId);

        Assert.Equal(LeerdoelSelectie.Alles, catalogus.LaatsteSelectie);
    }

    [Fact]
    public async Task Een_selectie_van_de_leerkracht_begrenst_de_kandidaten()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out _, out var catalogus);

        var resultaat = await service.GenereerSuggestiesAsync(
            ThemaId, new LeerdoelSelectie { JaarFasen = ["K3"] });

        Assert.Equal(new[] { "K3" }, catalogus.LaatsteSelectie!.JaarFasen!);
        // Only the two K3 goals were candidates — the L1 one was out of scope.
        Assert.Equal(2, resultaat.AantalKandidaten);
    }

    [Theory]
    [InlineData("k3")]
    [InlineData("K3")]
    [InlineData(" k3 ")]
    public async Task Een_selectie_in_kleine_letters_vindt_dezelfde_kandidaten(string jaarFase)
    {
        // The teacher types the jaar/fase by hand. A case-sensitive filter answers with zero candidates,
        // which the UI can only report as "er zijn geen leerplandoelen die aan je keuze voldoen" — a silent
        // wrong answer that reads like an empty curriculum.
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out _, out _);

        var resultaat = await service.GenereerSuggestiesAsync(
            ThemaId, new LeerdoelSelectie { JaarFasen = [jaarFase] });

        Assert.Equal(2, resultaat.AantalKandidaten);
    }

    [Fact]
    public async Task Zonder_kandidaten_wordt_de_ai_niet_aangeroepen()
    {
        // The realistic cause today: no Op.stap import has run (E1-15), so the curriculum is empty. Calling the
        // model would burn a request on a prompt with an empty goal list whose every answer must be discarded.
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[{\"code\":\"NAT-K3-01\",\"motivatie\":\"x\"}]}");
        var service = Service(fake, out var opslag, out _, thema: null, leerdoelen: []);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(0, resultaat.AantalKandidaten);
        Assert.Empty(resultaat.Bewaard);
        Assert.Equal(0, fake.AantalAanroepen);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Genereren_op_kapotte_json_persisteert_niets()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent: "dit is geen JSON {kapot");
        var service = Service(fake, out var opslag, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.False(resultaat.IsGeslaagd);
        Assert.NotNull(resultaat.Fout);
        Assert.Empty(thema.Doelsuggesties);
        Assert.Equal(0, opslag.AantalKeerBewaard);
        // The run still reports what it searched in, so a 0-suggestion failure is not mistaken for an empty
        // curriculum.
        Assert.Equal(3, resultaat.AantalKandidaten);
    }

    [Fact]
    public async Task Genereren_slaat_een_verzonnen_code_over()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[" +
            "{\"code\":\"NAT-K3-02\",\"motivatie\":\"geldig\"}," +
            "{\"code\":\"VERZONNEN-99\",\"motivatie\":\"deze code bestaat niet\"}]}");
        var service = Service(fake, out _, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.Equal("NAT-K3-02", Assert.Single(thema.Doelsuggesties).LeerplandoelCode);
        Assert.Equal("VERZONNEN-99", Assert.Single(resultaat.OvergeslagenOnbekend));
    }

    [Fact]
    public async Task Genereren_slaat_een_al_gekoppelde_code_over()
    {
        var thema = EenThema();
        thema.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "eerdere ronde"));

        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[{\"code\":\"NAT-K3-01\",\"motivatie\":\"opnieuw voorgesteld\"}]}");
        var service = Service(fake, out var opslag, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Single(thema.Doelsuggesties);
        Assert.Equal("NAT-K3-01", Assert.Single(resultaat.OvergeslagenDuplicaat));
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    // ---------------------------------------------------------------------------------------------
    // E2-08 — FR-4.3 "aanpassen": substituting a DIFFERENT leerplandoel, landing as `manueel`.
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Aanpassen_vervangt_het_doel_en_zet_de_koppeling_op_manueel()
    {
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "past bij het observeren van bomen"));
        var service = Service(new FakeAiClient(), out var opslag, out _, thema);

        var weergave = await service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, "NAT-K3-02");

        // The link now points at the teacher's goal and is the teacher's own choice.
        Assert.Equal("NAT-K3-02", suggestie.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Manueel, suggestie.Status);
        // The AI motivation described the goal it proposed, not this one — it goes with the old code (Art. IV.3).
        Assert.Null(suggestie.AiMotivatie);
        // The view carries the NEW goal's text so the teacher sees what they now coupled (FR-4.2).
        Assert.Equal("observeert de natuur.", weergave.Tekst);
        Assert.Equal(Doelsoort.Gemeenschappelijk, weergave.Doelsoort);
        Assert.Equal("Manueel", weergave.Status);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Aanpassen_aanvaardt_een_code_in_kleine_letters_en_bewaart_de_officiele_code()
    {
        // The teacher types the code by hand, so casing is theirs; the code that gets *stored* is always the
        // curriculum's own (Art. III.5 — a link points at a real Op.stap code, spelled the way Op.stap does).
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "motivatie"));
        var service = Service(new FakeAiClient(), out _, out _, thema);

        var weergave = await service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, "nat-k3-02");

        Assert.Equal("NAT-K3-02", suggestie.LeerplandoelCode);
        Assert.Equal("NAT-K3-02", weergave.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Manueel, suggestie.Status);
    }

    [Fact]
    public async Task Aanpassen_weigert_een_code_die_op_meerdere_doelen_past()
    {
        // `Leerplandoel.Code` is a case-SENSITIVE primary key, so two goals differing only in case could
        // legally coexist. There is no evidence Op.stap produces such codes, but if it did, resolving the
        // teacher's input to whichever row happened to sort first would be the tool guessing at goal identity
        // — exactly what Art. III.5 forbids. Refusing and naming both candidates beats silently picking one.
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("REK-L1-01", KoppelingStatus.Voorgesteld, "motivatie"));
        var service = Service(new FakeAiClient(), out var opslag, out _, thema, leerdoelen:
        [
            new Leerplandoel("NAT-K3-01", Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."),
            new Leerplandoel("nat-k3-01", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9", tekst: "een ander doel."),
            new Leerplandoel("REK-L1-01", Doelsoort.Gemeenschappelijk, "L1", "Getallen", "Getalbegrip", "2", tekst: "telt tot 20."),
        ]);

        var fout = await Assert.ThrowsAsync<OngeldigeDoelsubstitutieFout>(
            () => service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, "Nat-K3-01"));

        // The message names both candidates rather than asserting the code does not exist.
        Assert.Contains("NAT-K3-01", fout.Message, StringComparison.Ordinal);
        Assert.Contains("nat-k3-01", fout.Message, StringComparison.Ordinal);

        Assert.Equal("REK-L1-01", suggestie.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Aanpassen_kiest_de_exacte_code_als_die_bestaat_naast_een_andere_schrijfwijze()
    {
        // The other half of the rule above: an exact hit is never ambiguous, so it wins outright instead of
        // being refused. (The status path's safety no longer rides on this: it uses a lookup that cannot refuse
        // at all — see `DoelsuggestieStatusTests.Een_onoplosbare_code_doet_de_beslissing_niet_mislukken`.)
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("REK-L1-01", KoppelingStatus.Voorgesteld, "motivatie"));
        var service = Service(new FakeAiClient(), out _, out _, thema, leerdoelen:
        [
            new Leerplandoel("NAT-K3-01", Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."),
            new Leerplandoel("nat-k3-01", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9", tekst: "een ander doel."),
            new Leerplandoel("REK-L1-01", Doelsoort.Gemeenschappelijk, "L1", "Getallen", "Getalbegrip", "2", tekst: "telt tot 20."),
        ]);

        var weergave = await service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, "nat-k3-01");

        Assert.Equal("nat-k3-01", suggestie.LeerplandoelCode);
        Assert.Equal("een ander doel.", weergave.Tekst);
    }

    [Fact]
    public async Task Aanpassen_naar_een_onbestaande_code_wordt_geweigerd()
    {
        // Art. III.5: a link may only ever point at a code the read-only Op.stap set carries.
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "motivatie"));
        var service = Service(new FakeAiClient(), out var opslag, out _, thema);

        await Assert.ThrowsAsync<OngeldigeDoelsubstitutieFout>(
            () => service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, "VERZONNEN-99"));

        Assert.Equal("NAT-K3-01", suggestie.LeerplandoelCode);
        Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);
        Assert.Equal("motivatie", suggestie.AiMotivatie);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Aanpassen_zonder_code_wordt_geweigerd(string code)
    {
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "motivatie"));
        var service = Service(new FakeAiClient(), out var opslag, out _, thema);

        await Assert.ThrowsAsync<OngeldigeDoelsubstitutieFout>(
            () => service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, code));

        Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Aanpassen_naar_een_al_gekoppeld_doel_wordt_geweigerd()
    {
        // Two links to one doel would double-count it in dekking (Art. V), and the second is not an adjustment.
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "motivatie"));
        thema.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-02", KoppelingStatus.Voorgesteld, "andere suggestie"));
        var service = Service(new FakeAiClient(), out var opslag, out _, thema);

        await Assert.ThrowsAsync<OngeldigeDoelsubstitutieFout>(
            () => service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, "NAT-K3-02"));

        Assert.Equal("NAT-K3-01", suggestie.LeerplandoelCode);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Aanpassen_naar_hetzelfde_doel_wordt_geweigerd()
    {
        var thema = EenThema();
        var suggestie = thema.VoegDoelsuggestieToe(
            new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "motivatie"));
        var service = Service(new FakeAiClient(), out var opslag, out _, thema);

        await Assert.ThrowsAsync<OngeldigeDoelsubstitutieFout>(
            () => service.VervangSuggestieDoelAsync(ThemaId, suggestie.Id, "NAT-K3-01"));

        // Still `voorgesteld`: setting `manueel` without changing anything is the OTHER action (the status PUT),
        // and this path must not become a back door to it.
        Assert.Equal(KoppelingStatus.Voorgesteld, suggestie.Status);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Aanpassen_van_een_onbekende_suggestie_of_thema_geeft_niet_gevonden()
    {
        var thema = EenThema();
        var service = Service(new FakeAiClient(), out _, out _, thema);
        await Assert.ThrowsAsync<DoelsuggestieNietGevondenFout>(
            () => service.VervangSuggestieDoelAsync(ThemaId, Guid.NewGuid(), "NAT-K3-02"));

        var zonderThema = new DoelMatchingService(
            new FakeAiClient(), new FakeDoelMatchOpslag(thema: null), new FakeLeerdoelCatalogus(EenLeerdoelenSet()));
        await Assert.ThrowsAsync<ThemaNietGevondenFout>(
            () => zonderThema.VervangSuggestieDoelAsync(ThemaId, Guid.NewGuid(), "NAT-K3-02"));
    }
}
