using Jaarplanner.Application.Activiteitdoelen;
using Jaarplanner.Application.AiMatching.Response;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Activiteitdoelen;

/// <summary>
/// The goal proposals for an activiteit (FB-026, ADR-0052): what the prompt holds (Art. IV.4, TB-043), which items of an
/// answer survive (D3), and the domain's proposal and decision rules (D5, D6).
/// </summary>
public sealed class ActiviteitDoelsuggestieTests
{
    private static readonly Leerplandoel Doel01 = Doel("WO-NAT-GK2-01", "herkent bladeren.");
    private static readonly Leerplandoel Doel02 = Doel("WO-NAT-GK2-02", "benoemt kleuren in de herfst.");
    private static readonly Leerplandoel Doel03 = Doel("WO-TEC-GK2-03", "maakt wind zichtbaar.");

    private static Leerplandoel Doel(string code, string tekst) =>
        new(code, Doelsoort.Gemeenschappelijk, "K2", "Natuur", "Seizoenen", "9", tekst: tekst);

    private static ActiviteitDoelsuggestieContext Context(int max = 5, IReadOnlyCollection<string>? nietVoorstellen = null) => new(
        "Bladeren sorteren",
        "waarneming",
        "ontdektafel",
        "Ze sorteren bladeren op kleur.",
        "Waarom vallen bladeren?",
        "Bladeren vallen",
        "Herfst",
        "K2",
        [Doel03, Doel01, Doel02],
        nietVoorstellen ?? [],
        max);

    private static DoelMatchParseResultaat Antwoord(params string[] codes) =>
        DoelMatchParseResultaat.Geldig(codes.Select(c => new DoelMatchSuggestie(c, $"Past: {c}.")).ToList());

    [Fact]
    public void De_prompt_bevat_de_activiteit_de_doelen_van_de_leeftijd_en_wat_niet_voorgesteld_mag_worden()
    {
        var verzoek = ActiviteitDoelsuggestiePromptBuilder.Bouw(Context(max: 3, nietVoorstellen: ["WO-NAT-GK2-02", "WO-NAT-GK2-01"]));

        Assert.Contains("Stel hoogstens 3 leerplandoelen voor", verzoek.SystemPrompt);
        Assert.Contains("WO-NAT-GK2-01", verzoek.VasteContext);
        Assert.Contains("maakt wind zichtbaar.", verzoek.VasteContext);
        Assert.Equal(
            "# Activiteit\n" +
            "Naam: Bladeren sorteren\n" +
            "Soort: waarneming\n" +
            "Hoek: ontdektafel\n" +
            "Verwachte uitkomsten: Ze sorteren bladeren op kleur.\n" +
            "Onderzoeksvraag: Waarom vallen bladeren?\n" +
            "Subthema: Bladeren vallen\n" +
            "Thema: Herfst\n" +
            "Leeftijd: K2\n" +
            "\n# Niet voorstellen\n\n" +
            "Al gekoppeld of geweigerd: WO-NAT-GK2-01, WO-NAT-GK2-02\n",
            verzoek.UserPrompt);
    }

    [Fact]
    public void Het_vaste_deel_hangt_niet_af_van_de_activiteit()
    {
        var een = ActiviteitDoelsuggestiePromptBuilder.Bouw(Context(nietVoorstellen: ["WO-NAT-GK2-01"]));
        var ander = ActiviteitDoelsuggestiePromptBuilder.Bouw(Context() with { ActiviteitNaam = "Iets anders", Soort = null });

        Assert.Equal(een.SystemPrompt, ander.SystemPrompt);
        Assert.Equal(een.VasteContext, ander.VasteContext);
        Assert.DoesNotContain("Soort:", ander.UserPrompt);
        Assert.DoesNotContain("Niet voorstellen", ander.UserPrompt);
    }

    [Fact]
    public void De_validator_houdt_alleen_nieuwe_kandidaten_tot_het_maximum_in_volgorde()
    {
        var plan = ActiviteitDoelsuggestieValidator.Keur(
            Context(max: 2, nietVoorstellen: ["WO-NAT-GK2-01"]),
            Antwoord("VERZONNEN", "WO-NAT-GK2-01", "WO-TEC-GK2-03", "WO-TEC-GK2-03", "WO-NAT-GK2-02", "WO-NAT-GK2-99"));

        Assert.Equal(["WO-TEC-GK2-03", "WO-NAT-GK2-02"], plan.Voorstellen.Select(v => v.Code));
        Assert.Equal("Past: WO-TEC-GK2-03.", plan.Voorstellen[0].Motivatie);
        Assert.Equal(4, plan.AantalOvergeslagen);
    }

    [Fact]
    public void De_validator_weigert_een_onleesbaar_antwoord()
    {
        Assert.Throws<ArgumentException>(() =>
            ActiviteitDoelsuggestieValidator.Keur(Context(), DoelMatchParseResultaat.Ongeldig("kapot")));
    }

    private static Activiteit Activiteit() =>
        new Thema("Herfst", duurWeken: 4)
            .VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K2")
            .VoegActiviteitToe("Sorteren", ActiviteitType.Waarneming);

    [Fact]
    public void Alleen_een_beslist_doel_telt_als_gekoppeld()
    {
        var activiteit = Activiteit();
        var voorstel = activiteit.StelDoelVoor("WO-NAT-GK2-01", "Past.");
        activiteit.StelDoelVoor("WO-NAT-GK2-02", "Past.").WijzigStatus(KoppelingStatus.Geweigerd);

        Assert.Equal((KoppelingStatus.Voorgesteld, "Past."), (voorstel.Status, voorstel.AiMotivatie));
        Assert.False(activiteit.HeeftBeslisteDoelkoppeling);

        voorstel.WijzigStatus(KoppelingStatus.Aanvaard);
        Assert.True(activiteit.HeeftBeslisteDoelkoppeling);
    }

    [Fact]
    public void Een_nieuwe_vraag_verwijdert_alleen_de_open_voorstellen()
    {
        var activiteit = Activiteit();
        activiteit.StelDoelVoor("WO-NAT-GK2-01", "Past.");
        activiteit.StelDoelVoor("WO-NAT-GK2-02", "Past.").WijzigStatus(KoppelingStatus.Geweigerd);
        activiteit.VoegDoelkoppelingToe(new DoelKoppeling("WO-TEC-GK2-03", KoppelingStatus.Manueel));

        activiteit.VerwijderOpenDoelvoorstellen();

        Assert.Equal(["WO-NAT-GK2-02", "WO-TEC-GK2-03"], activiteit.Doelkoppelingen.Select(k => k.LeerplandoelCode));
    }

    [Fact]
    public void Een_voorstel_vraagt_een_motivatie_en_een_doel_dat_er_nog_niet_staat()
    {
        var activiteit = Activiteit();
        activiteit.StelDoelVoor("WO-NAT-GK2-01", "Past.");

        Assert.Throws<ArgumentException>(() => activiteit.StelDoelVoor("WO-NAT-GK2-02", " "));
        Assert.Throws<InvalidOperationException>(() => activiteit.StelDoelVoor("WO-NAT-GK2-01", "Nog eens."));
    }

    [Fact]
    public void Met_de_hand_koppelen_maakt_een_voorstel_manueel_zonder_motivatie()
    {
        var koppeling = new DoelKoppeling("WO-NAT-GK2-01", KoppelingStatus.Geweigerd, "Past.");

        koppeling.MaakManueel();

        Assert.Equal((KoppelingStatus.Manueel, (string?)null, true), (koppeling.Status, koppeling.AiMotivatie, koppeling.IsBeslist));
    }

    [Fact]
    public void Een_subdoelvoorstel_vanuit_een_activiteit_onthoudt_die_activiteit()
    {
        var activiteitId = Guid.NewGuid();
        var subthemaId = Guid.NewGuid();

        var voorstel = Subdoelvoorstel.VanuitActiviteit(Guid.NewGuid(), "K2", "WO-NAT-GK2-01", subthemaId, activiteitId, "Past.");

        Assert.Equal((activiteitId, (Guid?)subthemaId, (Guid?)null, true), (voorstel.ActiviteitId!.Value, voorstel.SubthemaId, voorstel.SubthemavoorstelId, voorstel.IsOpen));
    }
}
