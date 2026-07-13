using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

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
    ];

    private static DoelMatchingService Service(FakeAiClient client, out FakeDoelMatchOpslag opslag, Thema? thema = null)
    {
        opslag = new FakeDoelMatchOpslag(thema ?? EenThema());
        return new DoelMatchingService(client, opslag);
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
        var service = new DoelMatchingService(fake, new FakeDoelMatchOpslag(thema: null));

        await Assert.ThrowsAsync<ThemaNietGevondenFout>(
            () => service.MatchThemaAsync(ThemaId, EenLeerdoelenSet()));
        // The AI is never called when the thema is missing.
        Assert.Equal(0, fake.AantalAanroepen);
    }

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(null!, new FakeDoelMatchOpslag(EenThema())));
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(new FakeAiClient(), null!));
    }
}
