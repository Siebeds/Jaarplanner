using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.UnitTests.Ai;

namespace Jaarplanner.UnitTests.AiAuthoring;

/// <summary>
/// Pins the E2-07 goal-first authoring assist end-to-end (Art. IV.1/IV.2/IV.4/IV.5/IV.6/IV.8, Gap A.7):
/// for both the step 2 (themadoel) and step 6 (subdoel) hooks the service loads the bounded Op.stap
/// candidates (via the in-memory <see cref="FakeLeerdoelCatalogus"/>, <b>no database</b>), builds the
/// grounded prompt, calls the injected <see cref="FakeAiClient"/> (<b>no network</b>), validates the
/// completion by reusing the E2-03 parser, and returns <b>advisory, transient</b> suggestions —
/// nothing is persisted or auto-applied. These tests are the "Done when" evidence: the wizard can
/// request themadoel/subdoel suggestions, and a malformed response yields nothing.
/// </summary>
public sealed class ThemaOpbouwAssistServiceTests
{
    private static IReadOnlyList<Leerplandoel> EenLeerdoelenSet() =>
    [
        new Leerplandoel("WAT-K3-01", Doelsoort.Minimumdoel, "K3", "Wereldoriëntatie", "Natuur", "9",
            tekst: "De kleuter onderzoekt water.", minimumdoelRef: "K-20"),
        new Leerplandoel("WAT-K3-02", Doelsoort.Gemeenschappelijk, "K3", "Wereldoriëntatie", "Natuur", "9",
            tekst: "De kleuter benoemt nat en droog."),
    ];

    private static ThemaOpbouwContext EenThema(IReadOnlyCollection<string>? gekozen = null) => new()
    {
        Naam = "Water",
        DuurWeken = 5,
        Kernwoordenschat = ["nat", "droog"],
        GekozenThemadoelCodes = gekozen,
    };

    private static SubthemaOpbouwContext EenSubthema() => new()
    {
        Naam = "Water in de klas",
        Leeftijd = "3K",
        Onderzoeksvraag = "Hoe stroomt water?",
    };

    private static ThemaOpbouwAssistService Service(FakeAiClient client, out FakeLeerdoelCatalogus catalogus)
    {
        catalogus = new FakeLeerdoelCatalogus(EenLeerdoelenSet());
        return new ThemaOpbouwAssistService(client, catalogus);
    }

    [Fact]
    public async Task Stap2_geeft_advieskandidaten_verrijkt_en_adviserend_terug()
    {
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[{\"code\":\"WAT-K3-01\",\"motivatie\":\"kern van het thema water\"}]}");
        var service = Service(fake, out var catalogus);

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema() });

        Assert.True(resultaat.IsGeslaagd);
        var advies = Assert.Single(resultaat.Suggesties);
        Assert.Equal("WAT-K3-01", advies.Code);
        Assert.Equal("kern van het thema water", advies.Motivatie);
        // Enriched from the read-only leerplandoel (Art. III.1) so the wizard can render it.
        Assert.Equal("De kleuter onderzoekt water.", advies.Tekst);
        Assert.Equal("MD", advies.Doelsoort);
        Assert.Equal("K3", advies.JaarFase);

        // Ran against the fakes: model called once (no network), candidates loaded once (no database).
        Assert.Equal(1, fake.AantalAanroepen);
        Assert.NotNull(catalogus.LaatsteSelectie);
        // Used the step-2 themadoel prompt (not the subdoel one).
        Assert.Equal(ThemaOpbouwPromptBuilder.SystemPromptThemadoelen, fake.LaatsteRequest!.SystemPrompt);
    }

    [Fact]
    public async Task Stap6_gebruikt_de_subdoel_prompt_en_grondt_op_de_subthema_context()
    {
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[{\"code\":\"WAT-K3-02\",\"motivatie\":\"past bij nat en droog onderzoeken\"}]}");
        var service = Service(fake, out _);

        var resultaat = await service.StelSubdoelenVoorAsync(
            new SubdoelSuggestieVerzoek { Thema = EenThema(), Subthema = EenSubthema() });

        Assert.True(resultaat.IsGeslaagd);
        var advies = Assert.Single(resultaat.Suggesties);
        Assert.Equal("WAT-K3-02", advies.Code);
        Assert.Equal("G", advies.Doelsoort);

        // Used the step-6 subdoel prompt, grounded on the subthema (its leeftijd is in the prompt).
        Assert.Equal(ThemaOpbouwPromptBuilder.SystemPromptSubdoelen, fake.LaatsteRequest!.SystemPrompt);
        Assert.Contains("leeftijd 3K", fake.LaatsteRequest!.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("Hoe stroomt water?", fake.LaatsteRequest!.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Stap6_sluit_reeds_gekozen_themadoelen_uit()
    {
        // The model re-proposes an already-chosen themadoel; step 6 must not re-suggest an anchor.
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[" +
            "{\"code\":\"WAT-K3-01\",\"motivatie\":\"is al een themadoel\"}," +
            "{\"code\":\"WAT-K3-02\",\"motivatie\":\"geldige subdoelkandidaat\"}]}");
        var service = Service(fake, out _);

        var resultaat = await service.StelSubdoelenVoorAsync(new SubdoelSuggestieVerzoek
        {
            Thema = EenThema(gekozen: ["WAT-K3-01"]),
            Subthema = EenSubthema(),
        });

        Assert.True(resultaat.IsGeslaagd);
        var advies = Assert.Single(resultaat.Suggesties);
        Assert.Equal("WAT-K3-02", advies.Code);
    }

    [Fact]
    public async Task Een_verzonnen_code_wordt_overgeslagen_niet_verzonnen()
    {
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[" +
            "{\"code\":\"WAT-K3-01\",\"motivatie\":\"geldig\"}," +
            "{\"code\":\"VERZONNEN-99\",\"motivatie\":\"bestaat niet\"}]}");
        var service = Service(fake, out _);

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema() });

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal("WAT-K3-01", Assert.Single(resultaat.Suggesties).Code);
        Assert.Equal("VERZONNEN-99", Assert.Single(resultaat.OvergeslagenOnbekend));
    }

    [Fact]
    public async Task Malformed_json_geeft_niets_terug_maar_een_fout_stap2()
    {
        var fake = new FakeAiClient(cannedContent: "dit is geen JSON {kapot");
        var service = Service(fake, out _);

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema() });

        Assert.False(resultaat.IsGeslaagd);
        Assert.NotNull(resultaat.Fout);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public async Task Malformed_json_geeft_niets_terug_maar_een_fout_stap6()
    {
        var fake = new FakeAiClient(cannedContent: "{\"onzin\": true}");
        var service = Service(fake, out _);

        var resultaat = await service.StelSubdoelenVoorAsync(
            new SubdoelSuggestieVerzoek { Thema = EenThema(), Subthema = EenSubthema() });

        Assert.False(resultaat.IsGeslaagd);
        Assert.NotNull(resultaat.Fout);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public async Task Een_lege_geldige_lijst_slaagt_zonder_suggesties()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out _);

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema() });

        Assert.True(resultaat.IsGeslaagd);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public async Task Selectie_wordt_doorgegeven_aan_de_catalogus()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out var catalogus);
        var selectie = new LeerdoelSelectie { Disciplines = ["9"], JaarFasen = ["K3"] };

        await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema(), Selectie = selectie });

        Assert.Same(selectie, catalogus.LaatsteSelectie);
    }

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        Assert.Throws<ArgumentNullException>(
            () => new ThemaOpbouwAssistService(null!, new FakeLeerdoelCatalogus(EenLeerdoelenSet())));
        Assert.Throws<ArgumentNullException>(
            () => new ThemaOpbouwAssistService(new FakeAiClient(), null!));
    }
}
