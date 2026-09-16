using Jaarplanner.Application.Ai;
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

    private static IReadOnlyList<Minimumdoel> EenMinimumdoelenSet() =>
    [
        new Minimumdoel("K-9.2.1", "K-", "9.2.1", "De kleuters onderzoeken water.", "Wereldoriëntatie", "Natuur"),
        new Minimumdoel("K-9.1.1", "K-", "9.1.1", "De kleuters benoemen nat en droog.", "Wereldoriëntatie", "Natuur"),
        new Minimumdoel("4-9.1.1", "4-", "9.1.1", "De leerlingen beschrijven de waterkringloop.", "Wereldoriëntatie", "Natuur"),
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

    // Step 2 needs chosen jaar/fasen (TB-007); these tests choose K3, the age of every goal in the set.
    private static readonly LeerdoelSelectie K3 = new() { JaarFasen = ["K3"] };

    private static ThemaOpbouwAssistService Service(
        FakeAiClient client,
        out FakeLeerdoelCatalogus catalogus,
        Promptbegrenzing? begrenzing = null)
    {
        catalogus = new FakeLeerdoelCatalogus(EenLeerdoelenSet()) { Minimumdoelen = EenMinimumdoelenSet() };
        return new ThemaOpbouwAssistService(client, catalogus, begrenzing ?? new Promptbegrenzing());
    }

    [Fact]
    public async Task Stap2_stelt_minimumdoelen_voor_verrijkt_en_adviserend()
    {
        // FB-053: the wizard's themadoel step proposes minimumdoelen of the mijlpaal of the chosen leeftijd.
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[{\"code\":\"K-9.2.1\",\"motivatie\":\"kern van het thema water\"}]}");
        var service = Service(fake, out var catalogus);

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema(), Selectie = K3 });

        Assert.True(resultaat.IsGeslaagd);
        var advies = Assert.Single(resultaat.Suggesties);
        Assert.Equal("K-9.2.1", advies.Code);
        Assert.Equal("kern van het thema water", advies.Motivatie);
        // Enriched from the read-only minimumdoel (Art. III.1) so the wizard can render it.
        Assert.Equal("De kleuters onderzoeken water.", advies.Tekst);
        Assert.Equal("MD", advies.Doelsoort);
        Assert.Equal("K-", advies.JaarFase);

        // Ran against the fakes: model called once (no network), only minimumdoelen of K- read (no database).
        Assert.Equal(1, fake.AantalAanroepen);
        Assert.Equal(["K-"], catalogus.LaatsteMijlpalen);
        Assert.Equal(0, catalogus.AantalAanroepen);
        Assert.DoesNotContain("4-9.1.1", fake.LaatsteRequest!.VasteContext, StringComparison.Ordinal);
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
    public async Task Stap6_krijgt_de_gekozen_minimumdoelen_mee_met_hun_tekst()
    {
        // FB-053, criterion 4: the subdoel prompt carries the thema's minimumdoel themadoelen, so the subdoelen build
        // toward them. The chosen refs are minimumdoelen, so no leerplandoel is excluded because of them.
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[" +
            "{\"code\":\"WAT-K3-01\",\"motivatie\":\"leidt naar het themadoel\"}," +
            "{\"code\":\"WAT-K3-02\",\"motivatie\":\"geldige subdoelkandidaat\"}]}");
        var service = Service(fake, out _);

        var resultaat = await service.StelSubdoelenVoorAsync(new SubdoelSuggestieVerzoek
        {
            Thema = EenThema(gekozen: ["K-9.2.1"]),
            Subthema = EenSubthema(),
        });

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(["WAT-K3-01", "WAT-K3-02"], resultaat.Suggesties.Select(a => a.Code));
        Assert.Contains(
            "Themadoelen (minimumdoelen):\n- K-9.2.1: De kleuters onderzoeken water.\n",
            fake.LaatsteRequest!.UserPrompt,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task Stap2_stelt_een_gekozen_minimumdoel_niet_opnieuw_voor_en_hoogstens_acht()
    {
        var kandidaten = Enumerable.Range(1, 10)
            .Select(i => new Minimumdoel($"K-1.1.{i}", "K-", $"1.1.{i}", $"Doel {i}."))
            .ToList();
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[" +
            string.Join(",", kandidaten.Select(k => $"{{\"code\":\"{k.Ref}\",\"motivatie\":\"past\"}}")) + "]}");
        var catalogus = new FakeLeerdoelCatalogus([]) { Minimumdoelen = kandidaten };
        var service = new ThemaOpbouwAssistService(fake, catalogus, new Promptbegrenzing());

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema(gekozen: ["K-1.1.1"]), Selectie = K3 });

        Assert.Equal(8, resultaat.Suggesties.Count);
        Assert.DoesNotContain(resultaat.Suggesties, a => a.Code == "K-1.1.1");
        Assert.Contains("# Niet voorstellen\n\nAl gekozen: K-1.1.1", fake.LaatsteRequest!.UserPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_verzonnen_code_wordt_overgeslagen_niet_verzonnen()
    {
        var fake = new FakeAiClient(cannedContent:
            "{\"suggesties\":[" +
            "{\"code\":\"K-9.2.1\",\"motivatie\":\"geldig\"}," +
            "{\"code\":\"VERZONNEN-99\",\"motivatie\":\"bestaat niet\"}," +
            "{\"code\":\"WAT-K3-01\",\"motivatie\":\"een leerplandoel is geen kandidaat\"}]}");
        var service = Service(fake, out _);

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema(), Selectie = K3 });

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal("K-9.2.1", Assert.Single(resultaat.Suggesties).Code);
        Assert.Equal(["VERZONNEN-99", "WAT-K3-01"], resultaat.OvergeslagenOnbekend);
    }

    [Fact]
    public async Task Malformed_json_geeft_niets_terug_maar_een_fout_stap2()
    {
        var fake = new FakeAiClient(cannedContent: "dit is geen JSON {kapot");
        var service = Service(fake, out _);

        var resultaat = await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema(), Selectie = K3 });

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
            new ThemadoelSuggestieVerzoek { Thema = EenThema(), Selectie = K3 });

        Assert.True(resultaat.IsGeslaagd);
        Assert.Empty(resultaat.Suggesties);
    }

    [Fact]
    public async Task Stap2_zoekt_de_minimumdoelen_van_de_mijlpalen_van_de_gekozen_jaarfasen()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out var catalogus);
        var selectie = new LeerdoelSelectie { Disciplines = ["9"], JaarFasen = ["l6", "2L", "JK"] };

        await service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema(), Selectie = selectie });

        Assert.Equal(["K-", "4-", "6-"], catalogus.LaatsteMijlpalen);
        Assert.Contains("- 4-9.1.1: De leerlingen beschrijven de waterkringloop.", fake.LaatsteRequest!.VasteContext, StringComparison.Ordinal);
    }

    // ---------------------------------------------------------------------------------------------
    // TB-007 — never the whole catalogue, and never over the prompt ceiling.
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public async Task Stap2_zonder_jaarfasen_roept_de_ai_niet_aan()
    {
        // A thema being authored has no subthema to take a leeftijd from, so step 2 needs the choice.
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out var catalogus);

        var fout = await Assert.ThrowsAsync<JaarfaseKeuzeNodigFout>(() => service.StelThemadoelenVoorAsync(
            new ThemadoelSuggestieVerzoek { Thema = EenThema(), Selectie = new LeerdoelSelectie { Disciplines = ["9"] } }));

        Assert.Equal("Kies eerst voor welke leeftijden je themadoelen wil laten voorstellen.", fout.Message);
        Assert.Equal(0, catalogus.AantalAanroepen);
        Assert.Null(catalogus.LaatsteMijlpalen);
        Assert.Equal(0, fake.AantalAanroepen);
    }

    [Fact]
    public async Task Stap6_zonder_keuze_neemt_de_leeftijd_van_het_subthema_in_de_canonieke_vorm()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out var catalogus);

        await service.StelSubdoelenVoorAsync(new SubdoelSuggestieVerzoek { Thema = EenThema(), Subthema = EenSubthema() });

        // The subthema says "3K"; the catalogue stores "K3".
        Assert.Equal(new[] { "K3" }, catalogus.LaatsteSelectie!.JaarFasen!);
        Assert.Equal(1, fake.AantalAanroepen);
    }

    [Fact]
    public async Task Stap6_met_een_keuze_gaat_de_keuze_voor()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out var catalogus);

        await service.StelSubdoelenVoorAsync(new SubdoelSuggestieVerzoek
        {
            Thema = EenThema(),
            Subthema = EenSubthema(),
            Selectie = new LeerdoelSelectie { JaarFasen = ["K2"] },
        });

        Assert.Equal(new[] { "K2" }, catalogus.LaatsteSelectie!.JaarFasen!);
    }

    [Fact]
    public async Task Stap6_zonder_keuze_en_zonder_leeftijd_roept_de_ai_niet_aan()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[]}");
        var service = Service(fake, out var catalogus);

        await Assert.ThrowsAsync<JaarfaseKeuzeNodigFout>(() => service.StelSubdoelenVoorAsync(new SubdoelSuggestieVerzoek
        {
            Thema = EenThema(),
            Subthema = EenSubthema() with { Leeftijd = " " },
        }));

        Assert.Equal(0, catalogus.AantalAanroepen);
        Assert.Equal(0, fake.AantalAanroepen);
    }

    [Fact]
    public async Task Boven_de_grens_roept_de_assist_de_ai_niet_aan()
    {
        var fake = new FakeAiClient(cannedContent: "{\"suggesties\":[{\"code\":\"WAT-K3-01\",\"motivatie\":\"x\"}]}");
        var service = Service(fake, out _, new Promptbegrenzing(maxTokens: 10));

        await Assert.ThrowsAsync<PromptTeGrootFout>(() => service.StelSubdoelenVoorAsync(
            new SubdoelSuggestieVerzoek { Thema = EenThema(), Subthema = EenSubthema() }));

        Assert.Equal(0, fake.AantalAanroepen);
    }

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        Assert.Throws<ArgumentNullException>(
            () => new ThemaOpbouwAssistService(null!, new FakeLeerdoelCatalogus(EenLeerdoelenSet()), new Promptbegrenzing()));
        Assert.Throws<ArgumentNullException>(
            () => new ThemaOpbouwAssistService(new FakeAiClient(), null!, new Promptbegrenzing()));
        Assert.Throws<ArgumentNullException>(
            () => new ThemaOpbouwAssistService(new FakeAiClient(), new FakeLeerdoelCatalogus(EenLeerdoelenSet()), null!));
    }
}
