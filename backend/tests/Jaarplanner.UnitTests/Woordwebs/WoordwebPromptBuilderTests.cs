using Jaarplanner.Application.Woordwebs;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Woordwebs;

/// <summary>
/// What the AI is told about a woordweb (FB-036, ADR-0043 W6): the subthema, its thema and this web's words, and the
/// contract it must answer in. Nothing else: no owner, no other web.
/// </summary>
public sealed class WoordwebPromptBuilderTests
{
    private static (Woordweb Web, Subthema Subthema, Thema Thema) Opzet()
    {
        var thema = new Thema("Het weer", 5, invalshoeken: "Seizoenen, kleding");
        var subthema = thema.VoegSubthemaToe("Regen", 2, "K3");
        subthema.VoegOnderzoeksvraagToe("Waar komt regen vandaan?", "De speelplaats is nat.");

        var web = new Woordweb(subthema.Id, Guid.NewGuid());
        web.VoegWoordenToe(["wind", "plas"]);
        var aanvaard = web.VoegVoorstelToe("wolk", "Een reden.")!;
        web.Beslis(aanvaard.Id, KoppelingStatus.Aanvaard);
        var geweigerd = web.VoegVoorstelToe("tsunami", "Een reden.")!;
        web.Beslis(geweigerd.Id, KoppelingStatus.Geweigerd);
        web.VoegVoorstelToe("paraplu", "Een reden.");

        return (web, subthema, thema);
    }

    [Fact]
    public void De_context_deelt_de_woorden_op_naar_hun_status()
    {
        var (web, subthema, thema) = Opzet();

        var context = WoordwebPromptBuilder.ContextVoor(web, subthema, thema);

        Assert.Equal(["wind", "plas", "wolk"], context.WoordenInWeb);
        Assert.Equal(["paraplu"], context.OpenVoorstellen);
        Assert.Equal(["tsunami"], context.Geweigerd);
        Assert.Equal("Regen", context.SubthemaNaam);
        Assert.Equal("K3", context.Leeftijd);
        Assert.Equal("Het weer", context.ThemaNaam);
        Assert.Equal("Seizoenen, kleding", context.Invalshoeken);
        Assert.Equal([("Waar komt regen vandaan?", (string?)"De speelplaats is nat.")], context.Onderzoeksvragen);
    }

    [Fact]
    public void De_vraag_draagt_het_subthema_het_thema_en_de_woorden_van_het_web()
    {
        var (web, subthema, thema) = Opzet();

        var verzoek = WoordwebPromptBuilder.Bouw(WoordwebPromptBuilder.ContextVoor(web, subthema, thema));

        Assert.Equal(
            "# Subthema\n" +
            "Naam: Regen\n" +
            "Leeftijd: K3\n" +
            "Onderzoeksvraag: Waar komt regen vandaan?\n" +
            "Probleemstelling: De speelplaats is nat.\n" +
            "\n" +
            "# Thema\n" +
            "Naam: Het weer\n" +
            "Invalshoeken: Seizoenen, kleding\n" +
            "\n" +
            "# Woorden in het woordweb\n" +
            "- wind\n" +
            "- plas\n" +
            "- wolk\n" +
            "\n" +
            "# Al voorgesteld, nog niet beslist\n" +
            "- paraplu\n" +
            "\n" +
            "# Geweigerd: niet opnieuw voorstellen\n" +
            "- tsunami\n",
            verzoek.UserPrompt);
    }

    [Fact]
    public void Een_lege_lijst_wordt_als_geen_getoond()
    {
        var context = new WoordwebContext("Het weer", null, "Regen", "K3", [], ["wind"], [], []);

        var verzoek = WoordwebPromptBuilder.Bouw(context);

        Assert.DoesNotContain("Invalshoeken", verzoek.UserPrompt);
        Assert.DoesNotContain("Onderzoeksvraag", verzoek.UserPrompt);
        Assert.Contains("# Al voorgesteld, nog niet beslist\n- (geen)\n", verzoek.UserPrompt);
        Assert.Contains("# Geweigerd: niet opnieuw voorstellen\n- (geen)\n", verzoek.UserPrompt);
    }

    [Fact]
    public void De_instructie_begrenst_het_aantal_en_legt_het_jsoncontract_vast()
    {
        var systeem = WoordwebPromptBuilder.SystemPrompt;

        Assert.Contains($"hoogstens {WoordwebPromptBuilder.MaxVoorstellen} woorden", systeem);
        Assert.Contains("{\"woorden\": [{\"woord\": \"<woord>\", \"motivatie\": \"<één zin>\"}]}", systeem);
        Assert.Contains("de leerkracht beslist", systeem);
        Assert.Contains("Noem geen personen en geen kinderen.", systeem);
        Assert.Equal(5, WoordwebPromptBuilder.MaxVoorstellen);
    }

    [Fact]
    public void Dezelfde_context_geeft_dezelfde_vraag()
    {
        var context = new WoordwebContext("Het weer", null, "Regen", "K3", [("Waarom?", null)], ["wind"], ["wolk"], []);

        Assert.Equal(WoordwebPromptBuilder.Bouw(context).UserPrompt, WoordwebPromptBuilder.Bouw(context).UserPrompt);
    }
}
