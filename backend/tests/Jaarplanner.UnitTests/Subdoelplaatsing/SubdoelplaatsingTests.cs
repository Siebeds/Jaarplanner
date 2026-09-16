using Jaarplanner.Application.Subdoelplaatsing;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Subdoelplaatsing;

/// <summary>
/// The subdoelplaatsing contract (FB-057, ADR-0050): the answer's shape (Art. IV.5), which items survive validation
/// (D1, D3, D7), what the prompt holds (Art. IV.4), and the two proposal entities.
/// </summary>
public sealed class SubdoelplaatsingTests
{
    private static readonly Guid Bladeren = Guid.NewGuid();
    private static readonly Guid Dieren = Guid.NewGuid();

    private static readonly Leerplandoel Doel05 =
        new("WO-NAT-GK2-05", Doelsoort.Gemeenschappelijk, "K2", "Natuur", "Dieren", "9", tekst: "herkent dieren die zich voorbereiden op de winter.");

    private static readonly Leerplandoel Doel09 =
        new("WO-NAT-GK2-09", Doelsoort.Gemeenschappelijk, "K2", "Natuur", "Weer", "9", tekst: "benoemt verschillen in temperatuur en neerslag.");

    private static readonly Leerplandoel Doel11 =
        new("WO-TEC-GK2-11", Doelsoort.Gemeenschappelijk, "K2", "Techniek", "Wind", "9", tekst: "maakt wind zichtbaar.");

    private static SubdoelplaatsingContext Context(
        IReadOnlyList<GeweigerdePlaatsing>? geweigerd = null,
        IReadOnlyList<string>? geweigerdeNamen = null) => new(
        "Herfst",
        "natuur",
        "K2",
        [new PromptMinimumdoel("MD-3.07", "De kleuters verkennen veranderingen in de natuur.")],
        [
            new PromptSubthema("S1", Bladeren, "Bladeren vallen", 2, ["Waarom vallen bladeren?"],
                [new PromptSubdoel("WO-NAT-GK2-02", "neemt waar hoe bladeren van kleur veranderen.")]),
            new PromptSubthema("S2", Dieren, "Dieren in de winterslaap", 2, [], []),
        ],
        [Doel05, Doel09, Doel11],
        geweigerd ?? [],
        geweigerdeNamen ?? []);

    private static SubdoelplaatsingPlan Keur(string json, SubdoelplaatsingContext? context = null)
    {
        var antwoord = SubdoelplaatsingResponseParser.Parse(json);
        Assert.True(antwoord.IsGeldig, antwoord.Fout);
        return SubdoelplaatsingValidator.Keur(context ?? Context(), antwoord);
    }

    // --- The answer's shape ---

    [Fact]
    public void Een_geldig_antwoord_geeft_plaatsingen_en_nieuwe_subthemas_getrimd()
    {
        var resultaat = SubdoelplaatsingResponseParser.Parse(
            """
            ```json
            {"Plaatsingen": [{"code": " WO-NAT-GK2-05 ", "subthema": "S2", "motivatie": " Past bij egels. "}],
             "nieuweSubthemas": [{"sleutel": "N1", "naam": "Regen", "onderzoeksvraag": "Waar komt regen vandaan?", "duurWeken": "2", "motivatie": "Nieuw."}]}
            ```
            """);

        Assert.True(resultaat.IsGeldig);
        Assert.Equal(new RuwePlaatsing("WO-NAT-GK2-05", "S2", "Past bij egels."), Assert.Single(resultaat.Plaatsingen));
        Assert.Equal(2, Assert.Single(resultaat.NieuweSubthemas).DuurWeken);
    }

    [Fact]
    public void Een_ontbrekende_lijst_telt_als_leeg()
    {
        var resultaat = SubdoelplaatsingResponseParser.Parse("""{"plaatsingen": []}""");

        Assert.True(resultaat.IsGeldig);
        Assert.Empty(resultaat.NieuweSubthemas);
    }

    [Theory]
    [InlineData("")]
    [InlineData("geen json")]
    [InlineData("""[{"code": "X"}]""")]
    [InlineData("""{"plaatsingen": [null]}""")]
    [InlineData("""{"nieuweSubthemas": [null]}""")]
    [InlineData("""{"nieuweSubthemas": [{"duurWeken": "twee"}]}""")]
    public void Een_onleesbaar_antwoord_wordt_in_zijn_geheel_geweigerd(string json)
    {
        var resultaat = SubdoelplaatsingResponseParser.Parse(json);

        Assert.False(resultaat.IsGeldig);
        Assert.NotNull(resultaat.Fout);
    }

    // --- Validation (D1, D3, D7) ---

    [Fact]
    public void Een_plaatsing_in_een_bestaand_en_in_een_nieuw_subthema_blijven_behouden()
    {
        var plan = Keur(
            """
            {"plaatsingen": [
               {"code": "WO-NAT-GK2-05", "subthema": "s2", "motivatie": "Egels."},
               {"code": "WO-NAT-GK2-09", "subthema": "N1", "motivatie": "Weer."},
               {"code": "WO-TEC-GK2-11", "subthema": "N1", "motivatie": "Wind."}],
             "nieuweSubthemas": [{"sleutel": "N1", "naam": "Regen, wind en mist", "onderzoeksvraag": "Waar komt regen vandaan?", "duurWeken": 2, "motivatie": "Geen weersubthema."}]}
            """);

        Assert.Equal(new PlaatsingInBestaand("WO-NAT-GK2-05", Dieren, "Egels."), Assert.Single(plan.InBestaand));
        var nieuw = Assert.Single(plan.Nieuw);
        Assert.Equal("Regen, wind en mist", nieuw.Naam);
        Assert.Equal(["WO-NAT-GK2-09", "WO-TEC-GK2-11"], nieuw.Doelen.Select(d => d.Code));
        Assert.Equal(0, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_code_buiten_de_open_doelen_een_verzonnen_subthema_en_een_tweede_vermelding_vallen_weg()
    {
        var plan = Keur(
            """
            {"plaatsingen": [
               {"code": "WO-NAT-GK2-02", "subthema": "S1", "motivatie": "Staat er al."},
               {"code": "VERZONNEN-01", "subthema": "S1", "motivatie": "Bestaat niet."},
               {"code": "WO-NAT-GK2-05", "subthema": "S9", "motivatie": "Geen S9."},
               {"code": "WO-NAT-GK2-09", "subthema": "S1", "motivatie": "Eerste."},
               {"code": "WO-NAT-GK2-09", "subthema": "S2", "motivatie": "Tweede."},
               {"code": "WO-TEC-GK2-11", "subthema": "S1"}]}
            """);

        Assert.Equal("WO-NAT-GK2-09", Assert.Single(plan.InBestaand).Code);
        Assert.Equal(Bladeren, plan.InBestaand[0].SubthemaId);
        Assert.Equal(5, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_geweigerde_plaatsing_komt_niet_terug_maar_hetzelfde_doel_mag_elders()
    {
        var context = Context(geweigerd: [new GeweigerdePlaatsing("WO-NAT-GK2-05", Dieren)]);

        var plan = Keur(
            """
            {"plaatsingen": [
               {"code": "WO-NAT-GK2-05", "subthema": "S2", "motivatie": "Opnieuw."},
               {"code": "WO-NAT-GK2-09", "subthema": "S2", "motivatie": "Ander doel."}]}
            """,
            context);

        Assert.Equal("WO-NAT-GK2-09", Assert.Single(plan.InBestaand).Code);
        Assert.Equal(1, plan.AantalOvergeslagen);
    }

    [Theory]
    [InlineData("""{"sleutel": "N1", "naam": "Bladeren vallen", "onderzoeksvraag": "V?", "duurWeken": 2, "motivatie": "M."}""")]
    [InlineData("""{"sleutel": "N1", "naam": "Mist", "onderzoeksvraag": "V?", "duurWeken": 2, "motivatie": "M."}""")]
    [InlineData("""{"sleutel": "N1", "naam": "Regen", "onderzoeksvraag": "V?", "duurWeken": 7, "motivatie": "M."}""")]
    [InlineData("""{"sleutel": "N1", "naam": "Regen", "onderzoeksvraag": "V?", "duurWeken": 0, "motivatie": "M."}""")]
    [InlineData("""{"sleutel": "N1", "naam": "Regen", "duurWeken": 2, "motivatie": "M."}""")]
    [InlineData("""{"sleutel": "S1", "naam": "Regen", "onderzoeksvraag": "V?", "duurWeken": 2, "motivatie": "M."}""")]
    public void Een_nieuw_subthema_met_een_bezette_of_geweigerde_naam_of_een_fout_veld_valt_weg_met_zijn_doelen(string subthema)
    {
        var context = Context(geweigerdeNamen: ["mist"]);

        var plan = Keur(
            $$"""
            {"plaatsingen": [{"code": "WO-NAT-GK2-09", "subthema": "N1", "motivatie": "Weer."}],
             "nieuweSubthemas": [{{subthema}}]}
            """,
            context);

        Assert.Empty(plan.Nieuw);
        Assert.Empty(plan.InBestaand);
    }

    [Fact]
    public void Hoogstens_drie_nieuwe_subthemas_en_een_zonder_doelen_valt_weg()
    {
        var plan = Keur(
            """
            {"plaatsingen": [
               {"code": "WO-NAT-GK2-05", "subthema": "N1", "motivatie": "a"},
               {"code": "WO-NAT-GK2-09", "subthema": "N2", "motivatie": "b"},
               {"code": "WO-TEC-GK2-11", "subthema": "N4", "motivatie": "c"}],
             "nieuweSubthemas": [
               {"sleutel": "N1", "naam": "Een", "onderzoeksvraag": "V?", "duurWeken": 2, "motivatie": "M."},
               {"sleutel": "N2", "naam": "Twee", "onderzoeksvraag": "V?", "duurWeken": 2, "motivatie": "M."},
               {"sleutel": "N3", "naam": "Drie", "onderzoeksvraag": "V?", "duurWeken": 2, "motivatie": "M."},
               {"sleutel": "N4", "naam": "Vier", "onderzoeksvraag": "V?", "duurWeken": 2, "motivatie": "M."}]}
            """);

        Assert.Equal(["Een", "Twee"], plan.Nieuw.Select(n => n.Naam));
        // N4 is the fourth (dropped), so its goal is dropped too; N3 has no goal.
        Assert.Equal(3, plan.AantalOvergeslagen);
    }

    // --- The prompt ---

    [Fact]
    public void De_vraag_bevat_het_thema_de_subthemas_met_sleutel_de_open_doelen_en_wat_geweigerd_werd()
    {
        var verzoek = SubdoelplaatsingPromptBuilder.Bouw(Context(
            geweigerd: [new GeweigerdePlaatsing("WO-NAT-GK2-05", Dieren)],
            geweigerdeNamen: ["Mist"]));

        Assert.Contains("Naam: Herfst", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("- MD-3.07: De kleuters verkennen veranderingen in de natuur.", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("- S1: Bladeren vallen (2 weken)", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("  Subdoel: WO-NAT-GK2-02 | neemt waar", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("- WO-TEC-GK2-11 | Techniek > Wind", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("- WO-NAT-GK2-05 in S2", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("- Mist", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain(Dieren.ToString(), verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("\r", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("\"plaatsingen\"", verzoek.SystemPrompt, StringComparison.Ordinal);
        Assert.Contains("zelf bedenken", verzoek.SystemPrompt, StringComparison.Ordinal);
    }

    [Fact]
    public void Dezelfde_invoer_geeft_dezelfde_vraag()
    {
        Assert.Equal(SubdoelplaatsingPromptBuilder.Bouw(Context()).UserPrompt, SubdoelplaatsingPromptBuilder.Bouw(Context()).UserPrompt);
    }

    // --- The entities ---

    [Fact]
    public void Een_subdoelvoorstel_wordt_een_keer_beslist()
    {
        var voorstel = Subdoelvoorstel.InSubthema(Guid.NewGuid(), "K2", "WO-NAT-GK2-05", Dieren, "Egels.");

        voorstel.Beslis(KoppelingStatus.Geweigerd);

        Assert.False(voorstel.IsOpen);
        Assert.Throws<InvalidOperationException>(() => voorstel.Beslis(KoppelingStatus.Aanvaard));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            Subdoelvoorstel.InSubthema(Guid.NewGuid(), "K2", "X", Dieren, "m").Beslis(KoppelingStatus.Manueel));
    }

    [Fact]
    public void Een_aanvaard_subthemavoorstel_is_manueel_zodra_iets_gewijzigd_is()
    {
        var subthemaId = Guid.NewGuid();
        var ongewijzigd = new Subthemavoorstel(Guid.NewGuid(), "K2", "Regen", "Waarom regent het?", 2, "M.");
        var gewijzigd = new Subthemavoorstel(Guid.NewGuid(), "K2", "Regen", "Waarom regent het?", 2, "M.");
        var minderDoelen = new Subthemavoorstel(Guid.NewGuid(), "K2", "Regen", "Waarom regent het?", 2, "M.");

        ongewijzigd.Aanvaard(subthemaId, " Regen ", "Waarom regent het?", 2, doelenGewijzigd: false);
        gewijzigd.Aanvaard(subthemaId, "Regen en wind", "Waarom regent het?", 2, doelenGewijzigd: false);
        minderDoelen.Aanvaard(subthemaId, "Regen", "Waarom regent het?", 2, doelenGewijzigd: true);

        Assert.Equal(KoppelingStatus.Aanvaard, ongewijzigd.Status);
        Assert.Equal(subthemaId, ongewijzigd.SubthemaId);
        Assert.Equal(KoppelingStatus.Manueel, gewijzigd.Status);
        Assert.Equal("Regen en wind", gewijzigd.Naam);
        Assert.Equal(KoppelingStatus.Manueel, minderDoelen.Status);
        Assert.Throws<InvalidOperationException>(() => ongewijzigd.Weiger());
        Assert.Throws<ArgumentOutOfRangeException>(() => new Subthemavoorstel(Guid.NewGuid(), "K2", "R", "V", 7, "M."));
    }
}
