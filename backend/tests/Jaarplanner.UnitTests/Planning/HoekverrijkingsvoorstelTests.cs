using Jaarplanner.Application.Planning.Hoeken;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// FB-028 (ADR-0070): the proposal's own rules, the parser of the model's answer, and what the prompt holds. The service
/// with its fake AI client is proven over real PostgreSQL in <c>HoekverrijkingsvoorstellenEndpointsTests</c>.
/// </summary>
public sealed class HoekverrijkingsvoorstelTests
{
    private static Hoekverrijkingsvoorstel Voorstel() =>
        new(Guid.NewGuid(), Guid.NewGuid(), "  Takken en bladeren.  ", "Past bij de herfst.");

    [Fact]
    public void Een_nieuw_voorstel_is_open_en_getrimd()
    {
        var voorstel = Voorstel();

        Assert.True(voorstel.IsOpen);
        Assert.Equal((KoppelingStatus.Voorgesteld, "Takken en bladeren."), (voorstel.Status, voorstel.Tekst));
    }

    [Fact]
    public void Ongewijzigd_overnemen_is_aanvaard_en_aangepast_is_manueel()
    {
        var ongewijzigd = Voorstel();
        ongewijzigd.Aanvaard("Takken en bladeren. ");
        Assert.Equal(KoppelingStatus.Aanvaard, ongewijzigd.Status);

        var aangepast = Voorstel();
        aangepast.Aanvaard("Takken, bladeren en een vergrootglas.");
        Assert.Equal((KoppelingStatus.Manueel, "Takken, bladeren en een vergrootglas."), (aangepast.Status, aangepast.Tekst));
    }

    [Fact]
    public void Een_beslist_voorstel_beslist_men_niet_opnieuw()
    {
        var voorstel = Voorstel();
        voorstel.Weiger();

        Assert.Equal(KoppelingStatus.Geweigerd, voorstel.Status);
        Assert.Throws<InvalidOperationException>(voorstel.Weiger);
        Assert.Throws<InvalidOperationException>(() => voorstel.Aanvaard("iets"));
    }

    [Fact]
    public void Een_lege_of_te_lange_tekst_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() => new Hoekverrijkingsvoorstel(Guid.NewGuid(), Guid.NewGuid(), " ", "m"));
        Assert.Throws<ArgumentException>(() => new Hoekverrijkingsvoorstel(Guid.NewGuid(), Guid.NewGuid(), "t", ""));
        Assert.Throws<ArgumentException>(() => new Hoekverrijkingsvoorstel(
            Guid.NewGuid(), Guid.NewGuid(), new string('x', Hoekverrijkingsvoorstel.MaxTekstlengte + 1), "m"));
        Assert.Throws<ArgumentException>(() => new Hoekverrijkingsvoorstel(Guid.Empty, Guid.NewGuid(), "t", "m"));
    }

    [Fact]
    public void De_parser_leest_een_verrijking_met_motivatie_ook_in_een_codeblok()
    {
        var resultaat = HoekverrijkingsvoorstelResponseParser.Parse(
            "```json\n{\"Verrijking\": \" Takken. \", \"motivatie\": \"Past.\", \"extra\": 1}\n```");

        Assert.Equal((true, "Takken.", "Past."), (resultaat.IsGeldig, resultaat.Tekst, resultaat.Motivatie));
    }

    [Theory]
    [InlineData("{\"verrijking\": null, \"motivatie\": null}")]
    [InlineData("{\"verrijking\": \"  \"}")]
    [InlineData("{}")]
    public void Niets_passends_is_een_geldig_leeg_antwoord(string json)
    {
        var resultaat = HoekverrijkingsvoorstelResponseParser.Parse(json);

        Assert.True(resultaat.IsGeldig);
        Assert.Null(resultaat.Tekst);
    }

    [Theory]
    [InlineData("")]
    [InlineData("geen json")]
    [InlineData("[{\"verrijking\": \"x\", \"motivatie\": \"y\"}]")]
    [InlineData("{\"verrijking\": \"Takken.\"}")]
    public void Een_onleesbaar_antwoord_wordt_geweigerd(string json)
    {
        Assert.False(HoekverrijkingsvoorstelResponseParser.Parse(json).IsGeldig);
    }

    [Fact]
    public void Een_te_lange_verrijking_wordt_geweigerd()
    {
        var lang = new string('x', Hoekverrijkingsvoorstel.MaxTekstlengte + 1);

        Assert.False(HoekverrijkingsvoorstelResponseParser.Parse($"{{\"verrijking\": \"{lang}\", \"motivatie\": \"m\"}}").IsGeldig);
    }

    [Fact]
    public void De_prompt_bevat_de_hoek_het_subthema_de_huidige_en_de_geweigerde_verrijkingen()
    {
        var verzoek = HoekverrijkingsvoorstelPromptBuilder.Bouw(new HoekverrijkingsvoorstelContext(
            "De seizoenen",
            "De herfst",
            "K2",
            ["Waarom vallen de bladeren?"],
            ["Onderzoekt hoe bladeren vallen."],
            "bouwhoek",
            "Blokken en planken.",
            "kastanjes",
            ["dennenappels"]));

        Assert.Contains("JSON", verzoek.SystemPrompt);
        Assert.Contains("Noem geen leerplandoelen", verzoek.SystemPrompt);
        foreach (var deel in new[]
                 {
                     "Naam: bouwhoek", "Omschrijving: Blokken en planken.", "Naam: De herfst", "Thema: De seizoenen",
                     "Leeftijd: K2", "- Waarom vallen de bladeren?", "- Onderzoekt hoe bladeren vallen.", "kastanjes",
                     "# Geweigerd: niet opnieuw voorstellen\n- dennenappels",
                 })
        {
            Assert.Contains(deel, verzoek.UserPrompt);
        }
    }

    [Fact]
    public void Zonder_huidige_verrijking_of_weigeringen_zegt_de_prompt_geen()
    {
        var verzoek = HoekverrijkingsvoorstelPromptBuilder.Bouw(new HoekverrijkingsvoorstelContext(
            "T", "S", "K3", [], [], "boekenhoek", null, null, []));

        Assert.DoesNotContain("Omschrijving:", verzoek.UserPrompt);
        Assert.Contains("# Huidige verrijking van deze hoek voor dit subthema\n(geen)", verzoek.UserPrompt);
        Assert.Contains("# Geweigerd: niet opnieuw voorstellen\n- (geen)", verzoek.UserPrompt);
    }
}
