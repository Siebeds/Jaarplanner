using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Kat.Chat;
using Jaarplanner.UnitTests.Ai;
using static Jaarplanner.UnitTests.Kat.Chat.Chatschool;

namespace Jaarplanner.UnitTests.Kat.Chat;

/// <summary>
/// The chat with a fake AI client (FB-031, ADR-0066): one call per question, the school's content never in the
/// request, and a lookup answered from the tool's own data whatever the model believes.
/// </summary>
public sealed class KatchatServiceTests
{
    private static readonly Handleiding Kort = new(
        "# Handleiding\n\nInleiding.\n\n## Een algemene fiche plannen\n\n1. Open het zijpaneel.\n2. Sleep de fiche.\n\n## De agenda\n\nDe agenda.\n");

    private readonly Chatschool _school = new();

    private KatchatService Service(FakeAiClient ai) => new(ai, _school, new Promptbegrenzing(), Kort);

    [Fact]
    public async Task Een_vraag_over_de_tool_krijgt_de_uitleg_met_de_hoofdstukken_waarop_ze_steunt()
    {
        var ai = new FakeAiClient("""
            {"soort": "uitleg", "antwoord": "1. Open het zijpaneel.\n2. Sleep de fiche.", "hoofdstukken": ["een algemene fiche plannen"]}
            """);

        var antwoord = await Service(ai).BeantwoordAsync("Hoe plan ik een algemene fiche?", Leerkracht("K3"));

        Assert.Equal(Katantwoordsoort.Uitleg, antwoord.Soort);
        Assert.Equal("1. Open het zijpaneel.\n2. Sleep de fiche.", antwoord.Uitleg);
        Assert.Equal(["Een algemene fiche plannen"], antwoord.Hoofdstukken);
        Assert.Equal(1, ai.AantalAanroepen);
    }

    [Fact]
    public async Task De_aanvraag_bevat_de_handleiding_en_de_vraag_en_niets_van_de_inhoud_van_de_school()
    {
        var ai = new FakeAiClient("""{"soort": "opzoeking", "opzoeking": {"vraag": "waarGebruikt", "doel": "G-WI-03"}}""");

        await Service(ai).BeantwoordAsync("Waar wordt G-WI-03 gebruikt?", Admin());

        var verzoek = ai.LaatsteRequest!;
        Assert.Equal(KatchatPromptBuilder.SystemPrompt, verzoek.SystemPrompt);
        Assert.Contains("## Een algemene fiche plannen", verzoek.VasteContext);
        Assert.Contains("Waar wordt G-WI-03 gebruikt?", verzoek.UserPrompt);
        var alles = verzoek.SystemPrompt + verzoek.VasteContext + verzoek.UserPrompt;
        Assert.DoesNotContain("Onthaal", alles);
        Assert.DoesNotContain("Herfst", alles);
        Assert.DoesNotContain("K3 Blauw", alles);
        Assert.DoesNotContain(Tellen.Tekst, alles);
    }

    [Fact]
    public async Task Een_opzoeking_komt_uit_de_gegevens_van_de_tool()
    {
        var ai = new FakeAiClient("""{"soort": "opzoeking", "opzoeking": {"vraag": "doelInThema", "doel": "MD-K-01", "thema": "Herfst"}}""");

        var antwoord = await Service(ai).BeantwoordAsync("Zit MD-K-01 in thema Herfst?", Leerkracht("K3"));

        Assert.Equal(Katantwoordsoort.DoelInThema, antwoord.Soort);
        Assert.True(antwoord.Ja);
        Assert.Equal(Katpleksoort.Themadoel, Assert.Single(antwoord.Plekken).Soort);
    }

    [Fact]
    public async Task Wat_de_handleiding_niet_zegt_weet_hij_niet()
    {
        var ai = new FakeAiClient("""{"soort": "onbekend"}""");

        var antwoord = await Service(ai).BeantwoordAsync("Wat is de hoofdstad van Peru?", Leerkracht("K3"));

        Assert.Equal(Katantwoordsoort.Onbekend, antwoord.Soort);
        Assert.Null(antwoord.Uitleg);
    }

    [Fact]
    public async Task Een_uitleg_die_op_geen_hoofdstuk_steunt_wordt_niet_doorgegeven()
    {
        var ai = new FakeAiClient("""{"soort": "uitleg", "antwoord": "Iets verzonnen.", "hoofdstukken": ["Een hoofdstuk dat niet bestaat"]}""");

        var antwoord = await Service(ai).BeantwoordAsync("Hoe exporteer ik naar Smartschool?", Leerkracht("K3"));

        Assert.Equal(Katantwoordsoort.Onbekend, antwoord.Soort);
        Assert.Null(antwoord.Uitleg);
    }

    [Fact]
    public async Task Een_onbruikbaar_antwoord_mislukt_en_zoekt_niets_op()
    {
        var ai = new FakeAiClient("Dit is geen JSON.");

        var antwoord = await Service(ai).BeantwoordAsync("Zit MD-K-01 in thema Herfst?", Leerkracht("K3"));

        Assert.Equal(Katantwoordsoort.Mislukt, antwoord.Soort);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Een_lege_vraag_roept_de_ai_niet_aan(string vraag)
    {
        var ai = new FakeAiClient();

        await Assert.ThrowsAsync<ArgumentException>(() => Service(ai).BeantwoordAsync(vraag, Leerkracht("K3")));
        Assert.Equal(0, ai.AantalAanroepen);
    }

    [Fact]
    public async Task Een_te_lange_vraag_roept_de_ai_niet_aan()
    {
        var ai = new FakeAiClient();

        await Assert.ThrowsAsync<ArgumentException>(() =>
            Service(ai).BeantwoordAsync(new string('a', KatchatPromptBuilder.MaxVraagLengte + 1), Leerkracht("K3")));
        Assert.Equal(0, ai.AantalAanroepen);
    }

    [Fact]
    public async Task Een_opzoeking_opnieuw_met_een_gekozen_kandidaat_roept_de_ai_niet_aan()
    {
        var ai = new FakeAiClient();

        var antwoord = await Service(ai).ZoekOpAsync(new Katopzoeking(Katvraag.WaarGebruikt, Doel: "G-WI-03"), Leerkracht("K3", K3Blauw));

        Assert.Equal(Katantwoordsoort.WaarGebruikt, antwoord.Soort);
        Assert.Equal(0, ai.AantalAanroepen);
    }

    [Fact]
    public async Task De_ingebouwde_handleiding_past_onder_de_grens_van_een_aanvraag()
    {
        var verzoek = KatchatPromptBuilder.Bouw(new string('a', KatchatPromptBuilder.MaxVraagLengte), Handleiding.Standaard);

        new Promptbegrenzing().BewaakChat(verzoek);
    }
}
