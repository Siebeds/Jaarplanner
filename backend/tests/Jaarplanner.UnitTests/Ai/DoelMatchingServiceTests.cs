using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.UnitTests.AiAuthoring;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// A thema's doelsuggesties run end to end (FB-053, ADR-0049, Art. IV.1/IV.2/IV.5/IV.6, FR-4.1/4.2): the leeftijden give
/// the mijlpalen, their minimumdoelen are the candidates, the injected <see cref="FakeAiClient"/> answers with <b>no
/// network</b>, and each valid, new proposal is stored as <c>voorgesteld</c> with its motivation through the in-memory
/// <see cref="FakeDoelMatchOpslag"/> with <b>no database</b>. A malformed answer stores nothing.
/// </summary>
public sealed class DoelMatchingServiceTests
{
    private static readonly Guid ThemaId = Guid.NewGuid();

    private static Thema EenThema()
    {
        var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur");
        thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K3");
        return thema;
    }

    private static IReadOnlyList<Minimumdoel> Minimumdoelen() =>
    [
        new Minimumdoel("K-1.1.1", "K-", "1.1.1", "De kleuters kunnen rijm herkennen.", "Nederlands", "Lezen"),
        new Minimumdoel("K-9.1.1", "K-", "9.1.1", "De kleuters kunnen seizoenen onderscheiden.", "Wereldoriëntatie", "Natuur"),
        new Minimumdoel("4-2.1.1", "4-", "2.1.1", "De leerlingen tellen tot honderd.", "Wiskunde", "Getallen"),
        new Minimumdoel("6-2.1.1", "6-", "2.1.1", "De leerlingen rekenen met breuken.", "Wiskunde", "Getallen"),
    ];

    // The configured default; every prompt in these tests is far under it unless a test sets its own ceiling.
    private static readonly Promptbegrenzing Ruim = new();

    private static DoelMatchingService Service(
        FakeAiClient client,
        out FakeDoelMatchOpslag opslag,
        out FakeLeerdoelCatalogus catalogus,
        Thema? thema = null,
        IReadOnlyList<Minimumdoel>? minimumdoelen = null,
        Promptbegrenzing? begrenzing = null)
    {
        opslag = new FakeDoelMatchOpslag(thema ?? EenThema());
        catalogus = new FakeLeerdoelCatalogus([]) { Minimumdoelen = minimumdoelen ?? Minimumdoelen() };
        return new DoelMatchingService(client, opslag, catalogus, begrenzing ?? Ruim);
    }

    private static FakeAiClient Antwoord(params (string Code, string Motivatie)[] suggesties) =>
        new(cannedContent: "{\"suggesties\":[" +
            string.Join(",", suggesties.Select(s => $"{{\"code\":\"{s.Code}\",\"motivatie\":\"{s.Motivatie}\"}}")) +
            "]}");

    [Fact]
    public async Task Geldige_voorstellen_worden_als_voorgesteld_met_motivatie_bewaard_en_niet_gekoppeld()
    {
        var thema = EenThema();
        var fake = Antwoord(("K-9.1.1", "Het thema volgt de herfst."), ("K-1.1.1", "Er zijn herfstversjes."));
        var service = Service(fake, out var opslag, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(["K-9.1.1", "K-1.1.1"], resultaat.Bewaard.Select(b => b.MinimumdoelRef));
        Assert.All(resultaat.Bewaard, b => Assert.Equal("Voorgesteld", b.Status));
        Assert.Equal("De kleuters kunnen seizoenen onderscheiden.", resultaat.Bewaard[0].Omschrijving);
        Assert.Equal("K-", resultaat.Bewaard[0].Mijlpaal);

        // Stored as proposals (Art. IV.2), never applied (Art. IV.1): the thema has no themadoel yet.
        Assert.All(thema.Doelsuggesties, s => Assert.Equal(KoppelingStatus.Voorgesteld, s.Status));
        Assert.Equal("Het thema volgt de herfst.", thema.Doelsuggesties[0].AiMotivatie);
        Assert.Empty(thema.Minimumdoelen);
        Assert.Empty(thema.Themadoelen);

        Assert.Equal(1, fake.AantalAanroepen);
        Assert.Equal(1, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task De_leeftijden_van_de_subthemas_bepalen_de_mijlpalen_en_dus_de_kandidaten()
    {
        var thema = new Thema("Herfst", duurWeken: 4);
        thema.VoegSubthemaToe("Tellen", duurWeken: 2, leeftijd: "L2");
        thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K3");
        thema.VoegSubthemaToe("Kastanjes", duurWeken: 2, leeftijd: "3K");
        var fake = Antwoord();
        var service = Service(fake, out _, out var catalogus, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.Equal(["K3", "L2"], resultaat.JaarFasen);
        Assert.Equal(["K-", "4-"], resultaat.Mijlpalen);
        Assert.Equal(["K-", "4-"], catalogus.LaatsteMijlpalen);
        Assert.Equal(3, resultaat.AantalKandidaten);
        Assert.Contains("- 4-2.1.1: De leerlingen tellen tot honderd.", fake.LaatsteRequest!.UserPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("6-2.1.1", fake.LaatsteRequest.UserPrompt, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("L5", "6-")]
    [InlineData("l4", "4-")]
    [InlineData(" JK ", "K-")]
    public async Task Een_keuze_van_de_gebruiker_gaat_voor_de_leeftijden_van_de_subthemas(string keuze, string mijlpaal)
    {
        var fake = Antwoord();
        var service = Service(fake, out _, out _);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId, [keuze]);

        Assert.Equal([mijlpaal], resultaat.Mijlpalen);
        Assert.Equal(1, fake.AantalAanroepen);
    }

    [Fact]
    public async Task Een_thema_zonder_subthemas_zoekt_in_de_gekozen_leeftijden()
    {
        var fake = Antwoord();
        var service = Service(fake, out _, out _, new Thema("Herfst", duurWeken: 4));

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId, ["K2"]);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(["K2"], resultaat.JaarFasen);
        Assert.Equal(2, resultaat.AantalKandidaten);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("F1")]
    public async Task Een_thema_zonder_subthemas_en_zonder_bruikbare_keuze_roept_de_ai_niet_aan(string? keuze)
    {
        var thema = new Thema("Herfst", duurWeken: 4);
        var fake = Antwoord(("K-1.1.1", "x"));
        var service = Service(fake, out var opslag, out var catalogus, thema);

        var fout = await Assert.ThrowsAsync<JaarfaseKeuzeNodigFout>(
            () => service.GenereerSuggestiesAsync(ThemaId, keuze is null ? null : [keuze]));

        Assert.Equal("Kies eerst voor welke leeftijden je doelsuggesties wil.", fout.Message);
        Assert.Null(catalogus.LaatsteMijlpalen);
        Assert.Equal(0, fake.AantalAanroepen);
        Assert.Empty(thema.Doelsuggesties);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Malformed_json_bewaart_niets_en_zegt_wat_er_doorzocht_is()
    {
        var thema = EenThema();
        var fake = new FakeAiClient(cannedContent: "dit is geen JSON {kapot");
        var service = Service(fake, out var opslag, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.False(resultaat.IsGeslaagd);
        Assert.NotNull(resultaat.Fout);
        Assert.Empty(resultaat.Bewaard);
        Assert.Empty(thema.Doelsuggesties);
        Assert.Equal(0, opslag.AantalKeerBewaard);
        Assert.Equal(2, resultaat.AantalKandidaten);
    }

    [Fact]
    public async Task Een_code_buiten_de_kandidaten_wordt_overgeslagen_niet_verzonnen()
    {
        // 4-2.1.1 exists, but not among this run's candidates; k-1.1.1 alters a decreed identifier (Art. III.5).
        var thema = EenThema();
        var fake = Antwoord(("K-1.1.1", "geldig"), ("VERZONNEN-99", "bestaat niet"), ("4-2.1.1", "andere mijlpaal"), ("k-1.1.1", "kleine letters"));
        var service = Service(fake, out _, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.Equal("K-1.1.1", Assert.Single(thema.Doelsuggesties).MinimumdoelRef);
        Assert.Equal(["VERZONNEN-99", "4-2.1.1", "k-1.1.1"], resultaat.OvergeslagenOnbekend);
    }

    [Fact]
    public async Task Een_themadoel_of_een_eerder_voorstel_komt_niet_terug()
    {
        var thema = EenThema();
        thema.KoppelMinimumdoel("K-1.1.1");
        var geweigerd = thema.VoegDoelsuggestieToe("K-9.1.1", "eerder voorgesteld");
        thema.WeigerDoelsuggestie(geweigerd);
        var fake = Antwoord(("K-1.1.1", "al themadoel"), ("K-9.1.1", "al geweigerd"));
        var service = Service(fake, out var opslag, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Empty(resultaat.Bewaard);
        Assert.Equal(["K-1.1.1", "K-9.1.1"], resultaat.OvergeslagenDuplicaat);
        Assert.Same(geweigerd, Assert.Single(thema.Doelsuggesties));
        Assert.Equal(KoppelingStatus.Geweigerd, geweigerd.Status);
        Assert.Equal(0, opslag.AantalKeerBewaard);

        // And the model was told so, on the prompt's last line.
        Assert.EndsWith(
            "Niet voorstellen (al themadoel of al voorgesteld): K-1.1.1, K-9.1.1\n",
            fake.LaatsteRequest!.UserPrompt,
            StringComparison.Ordinal);
    }

    [Fact]
    public async Task Dezelfde_code_twee_keer_in_een_antwoord_wordt_een_keer_bewaard()
    {
        var thema = EenThema();
        var fake = Antwoord(("K-1.1.1", "eerste"), ("K-1.1.1", "tweede"));
        var service = Service(fake, out _, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.Equal("eerste", Assert.Single(thema.Doelsuggesties).AiMotivatie);
        Assert.Equal(["K-1.1.1"], resultaat.OvergeslagenDuplicaat);
    }

    [Fact]
    public async Task Hoogstens_acht_voorstellen_worden_bewaard()
    {
        var kandidaten = Enumerable.Range(1, 10)
            .Select(i => new Minimumdoel($"K-1.1.{i}", "K-", $"1.1.{i}", $"Doel {i}."))
            .ToList();
        var thema = EenThema();
        var fake = Antwoord(kandidaten.Select(k => (k.Ref, "past")).ToArray());
        var service = Service(fake, out _, out _, thema, kandidaten);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.Equal(MatchingPromptBuilder.MaxSuggesties, resultaat.Bewaard.Count);
        Assert.Equal(8, thema.Doelsuggesties.Count);
        Assert.Equal("K-1.1.8", thema.Doelsuggesties[^1].MinimumdoelRef);
    }

    [Fact]
    public async Task Een_lege_geldige_lijst_bewaart_niets_maar_slaagt()
    {
        var thema = EenThema();
        var service = Service(Antwoord(), out var opslag, out _, thema);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Empty(resultaat.Bewaard);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Zonder_kandidaten_wordt_de_ai_niet_aangeroepen()
    {
        var fake = Antwoord(("K-1.1.1", "x"));
        var service = Service(fake, out var opslag, out _, minimumdoelen: []);

        var resultaat = await service.GenereerSuggestiesAsync(ThemaId);

        Assert.True(resultaat.IsGeslaagd);
        Assert.Equal(0, resultaat.AantalKandidaten);
        Assert.Equal(0, fake.AantalAanroepen);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task Boven_de_grens_wordt_de_ai_niet_aangeroepen_en_niets_bewaard()
    {
        var thema = EenThema();
        var fake = Antwoord(("K-1.1.1", "x"));
        var service = Service(fake, out var opslag, out _, thema, begrenzing: new Promptbegrenzing(maxTokens: 10));

        var fout = await Assert.ThrowsAsync<PromptTeGrootFout>(() => service.GenereerSuggestiesAsync(ThemaId));

        Assert.Equal(10, fout.MaxTokens);
        Assert.Contains("2 doelen", fout.Message, StringComparison.Ordinal);
        Assert.Equal(0, fake.AantalAanroepen);
        Assert.Empty(thema.Doelsuggesties);
        Assert.Equal(0, opslag.AantalKeerBewaard);
    }

    [Fact]
    public async Task De_prompt_is_de_minimumdoelprompt_en_vermeldt_geen_leerplandoelen()
    {
        var fake = Antwoord();
        var service = Service(fake, out _, out _);

        await service.GenereerSuggestiesAsync(ThemaId);

        Assert.Equal(MatchingPromptBuilder.SystemPrompt, fake.LaatsteRequest!.SystemPrompt);
        Assert.StartsWith(MinimumdoelPromptlijst.Kop, fake.LaatsteRequest.UserPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("leerplandoel", fake.LaatsteRequest.UserPrompt, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Onbekend_thema_gooit_ThemaNietGevondenFout()
    {
        var opslag = new FakeDoelMatchOpslag(thema: null);
        var service = new DoelMatchingService(Antwoord(), opslag, new FakeLeerdoelCatalogus([]), Ruim);

        await Assert.ThrowsAsync<ThemaNietGevondenFout>(() => service.GenereerSuggestiesAsync(ThemaId));
    }

    [Fact]
    public async Task Bewaarde_voorstellen_zijn_opvraagbaar_per_thema()
    {
        var thema = EenThema();
        var service = Service(Antwoord(("K-1.1.1", "past")), out _, out _, thema);
        await service.GenereerSuggestiesAsync(ThemaId);

        var lijst = await service.HaalSuggestiesVoorThemaAsync(ThemaId);

        Assert.Equal("K-1.1.1", Assert.Single(lijst).MinimumdoelRef);
    }

    [Fact]
    public void Service_verwerpt_null_afhankelijkheden()
    {
        var client = Antwoord();
        var opslag = new FakeDoelMatchOpslag(EenThema());
        var catalogus = new FakeLeerdoelCatalogus([]);

        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(null!, opslag, catalogus, Ruim));
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(client, null!, catalogus, Ruim));
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(client, opslag, null!, Ruim));
        Assert.Throws<ArgumentNullException>(() => new DoelMatchingService(client, opslag, catalogus, null!));
    }
}
