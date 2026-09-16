using Jaarplanner.Application.Activiteitvoorstellen;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Activiteitvoorstellen;

/// <summary>
/// The activiteitvoorstellen contract (FB-025, ADR-0052): the answer's shape (Art. IV.5), which items survive validation
/// (D3, D5 to D7), what the prompt holds and forbids (Art. I.2, IV.4), and the proposal entity (D8).
/// </summary>
public sealed class ActiviteitvoorstelTests
{
    private static readonly Guid Vraag1 = Guid.NewGuid();

    private static readonly Leerplandoel Doel01 =
        new("WO-NAT-GK3-01", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Water", "9", tekst: "onderzoekt wat drijft en zinkt.");

    private static readonly Leerplandoel Doel02 =
        new("WO-NAT-GK3-02", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Water", "9", tekst: "beschrijft hoe water beweegt.");

    private static ActiviteitvoorstelContext Context(int aantal = 5, IReadOnlyList<string>? geweigerd = null) => new(
        "Water",
        "Drijven en zinken",
        "K3",
        2,
        [new PromptOnderzoeksvraag("V1", Vraag1, "Waarom blijft een boot drijven?")],
        [Doel01, Doel02],
        [new BestaandeActiviteit("Bootjes vouwen", ActiviteitType.Experiment)],
        geweigerd ?? ["Plonsproef"],
        aantal);

    private static string Item(
        string naam = "Drijftafel",
        string soort = "\"experiment\"",
        string uitkomsten = "\"De kleuters testen voorwerpen in een bak water.\"",
        string lengte = "1",
        string vraag = "\"V1\"",
        string doelen = "[\"WO-NAT-GK3-01\"]",
        string motivatie = "\"Werkt aan drijven en zinken.\"") =>
        $$"""{"naam": "{{naam}}", "soort": {{soort}}, "verwachteUitkomsten": {{uitkomsten}}, "lengteInLesuren": {{lengte}}, "onderzoeksvraag": {{vraag}}, "doelen": {{doelen}}, "motivatie": {{motivatie}}}""";

    private static ActiviteitvoorstelPlan Keur(ActiviteitvoorstelContext context, params string[] items)
    {
        var antwoord = ActiviteitvoorstelResponseParser.Parse($$"""{"activiteiten": [{{string.Join(",", items)}}]}""");
        Assert.True(antwoord.IsGeldig, antwoord.Fout);
        return ActiviteitvoorstelValidator.Keur(context, antwoord);
    }

    private static ActiviteitvoorstelPlan Keur(params string[] items) => Keur(Context(), items);

    // --- The answer's shape ---

    [Fact]
    public void Een_geldig_antwoord_wordt_getrimd_gelezen_ook_in_een_codeblok()
    {
        var resultaat = ActiviteitvoorstelResponseParser.Parse(
            """
            ```json
            {"Activiteiten": [{"naam": " Drijftafel ", "soort": "Experiment", "verwachteUitkomsten": " Testen. ",
              "lengteInLesuren": "2", "onderzoeksvraag": null, "doelen": [" WO-NAT-GK3-01 ", " ", null], "motivatie": "Reden."}]}
            ```
            """);

        Assert.True(resultaat.IsGeldig);
        var item = Assert.Single(resultaat.Activiteiten);
        Assert.Equal(("Drijftafel", "Testen.", 2, (string?)null), (item.Naam, item.VerwachteUitkomsten, item.LengteInLesuren!.Value, item.Onderzoeksvraag));
        Assert.Equal(["WO-NAT-GK3-01"], item.Doelen);
    }

    [Fact]
    public void Een_ontbrekende_lijst_telt_als_leeg()
    {
        var resultaat = ActiviteitvoorstelResponseParser.Parse("{}");

        Assert.True(resultaat.IsGeldig);
        Assert.Empty(resultaat.Activiteiten);
    }

    [Theory]
    [InlineData("")]
    [InlineData("geen json")]
    [InlineData("""[{"naam": "X"}]""")]
    [InlineData("""{"activiteiten": [null]}""")]
    [InlineData("""{"activiteiten": "Drijftafel"}""")]
    public void Een_onleesbaar_antwoord_wordt_als_geheel_geweigerd(string inhoud)
    {
        var resultaat = ActiviteitvoorstelResponseParser.Parse(inhoud);

        Assert.False(resultaat.IsGeldig);
        Assert.False(string.IsNullOrWhiteSpace(resultaat.Fout));
    }

    // --- Validation ---

    [Fact]
    public void Een_geldig_voorstel_houdt_zijn_velden_en_de_onderzoeksvraag_van_zijn_sleutel()
    {
        var plan = Keur(Item());

        var activiteit = Assert.Single(plan.Activiteiten);
        Assert.Equal(
            ("Drijftafel", (ActiviteitType?)ActiviteitType.Experiment, "De kleuters testen voorwerpen in een bak water.", 1, (Guid?)Vraag1, "Werkt aan drijven en zinken."),
            (activiteit.Naam, activiteit.ActiviteitType, activiteit.VerwachteUitkomsten, activiteit.LengteInLesuren, activiteit.OnderzoeksvraagId, activiteit.Motivatie));
        Assert.Equal(["WO-NAT-GK3-01"], activiteit.LeerplandoelCodes);
        Assert.Equal(0, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_code_die_geen_subdoel_is_valt_weg_en_een_voorstel_zonder_geldig_doel_ook()
    {
        var plan = Keur(
            Item(naam: "Drijftafel", doelen: """["WO-NAT-GK3-01", "WO-NAT-GK3-99", "WO-NAT-GK3-01"]"""),
            Item(naam: "Verzonnen", doelen: """["VERZONNEN-01"]"""),
            Item(naam: "Zonder doel", doelen: "[]"));

        Assert.Equal(["WO-NAT-GK3-01"], Assert.Single(plan.Activiteiten).LeerplandoelCodes);
        Assert.Equal(2, plan.AantalOvergeslagen);
    }

    [Theory]
    [InlineData("naam", "\"\"")]
    [InlineData("uitkomsten", "null")]
    [InlineData("motivatie", "null")]
    [InlineData("lengte", "0")]
    [InlineData("lengte", "5")]
    [InlineData("lengte", "null")]
    public void Een_voorstel_zonder_verplicht_veld_of_met_een_ongeldige_lengte_valt_weg(string veld, string waarde)
    {
        var item = veld switch
        {
            "naam" => Item(naam: "").Replace("\"naam\": \"\"", $"\"naam\": {waarde}", StringComparison.Ordinal),
            "uitkomsten" => Item(uitkomsten: waarde),
            "motivatie" => Item(motivatie: waarde),
            _ => Item(lengte: waarde),
        };

        var plan = Keur(item);

        Assert.Empty(plan.Activiteiten);
        Assert.Equal(1, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Te_lange_teksten_vallen_weg()
    {
        var plan = Keur(
            Item(naam: new string('a', Activiteitvoorstel.MaxNaamlengte + 1)),
            Item(naam: "Lang", uitkomsten: $"\"{new string('b', Activiteitvoorstel.MaxUitkomstlengte + 1)}\""));

        Assert.Empty(plan.Activiteiten);
        Assert.Equal(2, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_bestaande_een_geweigerde_of_een_herhaalde_naam_valt_weg_ongeacht_hoofdletters()
    {
        var plan = Keur(
            Item(naam: "bootjes vouwen"),
            Item(naam: "PLONSPROEF"),
            Item(naam: "Drijftafel"),
            Item(naam: "drijftafel"));

        Assert.Equal("Drijftafel", Assert.Single(plan.Activiteiten).Naam);
        Assert.Equal(3, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_onbekende_soort_of_vraagsleutel_wordt_geen_en_laat_het_voorstel_staan()
    {
        var plan = Keur(Item(soort: "\"knutselen\"", vraag: "\"V9\""), Item(naam: "Getal", soort: "\"3\"", vraag: "null"));

        Assert.All(plan.Activiteiten, a => Assert.Null(a.ActiviteitType));
        Assert.All(plan.Activiteiten, a => Assert.Null(a.OnderzoeksvraagId));
        Assert.Equal(2, plan.Activiteiten.Count);
    }

    [Fact]
    public void Meer_voorstellen_dan_gevraagd_worden_afgekapt()
    {
        var plan = Keur(Context(aantal: 2), Item(naam: "Een"), Item(naam: "Twee"), Item(naam: "Drie"));

        Assert.Equal(["Een", "Twee"], plan.Activiteiten.Select(a => a.Naam));
        Assert.Equal(1, plan.AantalOvergeslagen);
    }

    [Theory]
    [InlineData("Experiment", ActiviteitType.Experiment)]
    [InlineData("prentenboek", ActiviteitType.Prentenboek)]
    [InlineData("UITSTAP", ActiviteitType.Uitstap)]
    public void Een_soort_wordt_gelezen_zonder_hoofdlettergevoeligheid(string invoer, ActiviteitType verwacht) =>
        Assert.Equal(verwacht, ActiviteitvoorstelValidator.LeesSoort(invoer));

    // --- The prompt ---

    [Fact]
    public void De_prompt_bevat_alleen_de_eigen_gegevens_en_de_regels()
    {
        var verzoek = ActiviteitvoorstelPromptBuilder.Bouw(Context(aantal: 3));

        Assert.Contains("Stel hoogstens 3 activiteiten voor.", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("Naam: Drijven en zinken", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("Onderzoeksvraag V1: Waarom blijft een boot drijven?", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("- WO-NAT-GK3-01 | Natuur > Water", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("- Bootjes vouwen (Experiment)", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.Contains("# Geweigerde activiteiten (niet opnieuw voorstellen)\n- Plonsproef", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain(Vraag1.ToString(), verzoek.UserPrompt, StringComparison.Ordinal);

        // Art. I.2 and IV.4: no lesson material, goals only from the listed subdoelen.
        Assert.Contains("Maak geen lesmateriaal", verzoek.SystemPrompt, StringComparison.Ordinal);
        Assert.Contains(ActiviteitvoorstelPromptBuilder.SubdoelenKop, verzoek.SystemPrompt, StringComparison.Ordinal);
        Assert.Contains(ActiviteitvoorstelPromptBuilder.Soorten, verzoek.SystemPrompt, StringComparison.Ordinal);
        Assert.Empty(verzoek.VasteContext);
    }

    [Fact]
    public void Zonder_geweigerde_namen_en_activiteiten_zegt_de_prompt_dat_er_geen_zijn()
    {
        var verzoek = ActiviteitvoorstelPromptBuilder.Bouw(Context(geweigerd: []) with { BestaandeActiviteiten = [] });

        Assert.Contains("# Activiteiten die er al zijn (niet herhalen)\n- (geen)", verzoek.UserPrompt, StringComparison.Ordinal);
        Assert.DoesNotContain("Geweigerde", verzoek.UserPrompt, StringComparison.Ordinal);
    }

    // --- The entity ---

    private static Activiteitvoorstel Voorstel() => new(
        Guid.NewGuid(), Guid.NewGuid(), "Drijftafel", ActiviteitType.Experiment, "Testen.", 1, null, ["B", "A", "A"], "Reden.");

    [Fact]
    public void Een_ongewijzigd_aanvaard_voorstel_is_aanvaard_en_een_gewijzigd_manueel()
    {
        var ongewijzigd = Voorstel();
        ongewijzigd.Aanvaard(Guid.NewGuid(), "Drijftafel", ActiviteitType.Experiment, "Testen.", 1, ["A", "B"]);
        Assert.Equal(KoppelingStatus.Aanvaard, ongewijzigd.Status);

        var minderDoelen = Voorstel();
        minderDoelen.Aanvaard(Guid.NewGuid(), "Drijftafel", ActiviteitType.Experiment, "Testen.", 1, ["A"]);
        Assert.Equal(KoppelingStatus.Manueel, minderDoelen.Status);
        Assert.Equal(["A"], minderDoelen.LeerplandoelCodes);

        var geenSoort = Voorstel();
        geenSoort.Aanvaard(Guid.NewGuid(), "Drijftafel", null, "Testen.", 1, ["A", "B"]);
        Assert.Equal(KoppelingStatus.Manueel, geenSoort.Status);
    }

    [Fact]
    public void Een_beslist_voorstel_beslist_men_niet_opnieuw()
    {
        var voorstel = Voorstel();
        voorstel.Weiger();

        Assert.Equal(KoppelingStatus.Geweigerd, voorstel.Status);
        Assert.Throws<InvalidOperationException>(voorstel.Weiger);
        Assert.Throws<InvalidOperationException>(() => voorstel.Aanvaard(Guid.NewGuid(), "X", null, "Y", 1, []));
    }

    [Fact]
    public void Een_voorstel_weigert_ongeldige_waarden()
    {
        Assert.Throws<ArgumentException>(() => new Activiteitvoorstel(Guid.NewGuid(), Guid.Empty, "X", null, "Y", 1, null, [], "Z"));
        Assert.Throws<ArgumentException>(() => new Activiteitvoorstel(Guid.NewGuid(), Guid.NewGuid(), " ", null, "Y", 1, null, [], "Z"));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Activiteitvoorstel(Guid.NewGuid(), Guid.NewGuid(), "X", null, "Y", 5, null, [], "Z"));
        Assert.Throws<ArgumentException>(() => new Activiteitvoorstel(Guid.NewGuid(), Guid.NewGuid(), "X", null, "Y", 1, null, [" "], "Z"));
        Assert.Equal(["B", "A"], Voorstel().LeerplandoelCodes);
    }
}
