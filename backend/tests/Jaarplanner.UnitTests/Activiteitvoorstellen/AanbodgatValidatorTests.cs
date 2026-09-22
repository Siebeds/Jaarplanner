using Jaarplanner.Application.Activiteitvoorstellen;
using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Activiteitvoorstellen;

/// <summary>
/// What the cat keeps of the model's answer (FB-070, ADR-0060 D1, G6; Art. IV.4, IV.5). A pure function, so every rule
/// is one test and none of them calls an AI.
/// </summary>
public sealed class AanbodgatValidatorTests
{
    private static readonly Guid Drijven = Guid.Parse("dddddddd-0000-0000-0000-000000000001");
    private static readonly Guid Zinken = Guid.Parse("dddddddd-0000-0000-0000-000000000002");
    private static readonly Guid VraagVanDrijven = Guid.Parse("dddddddd-0000-0000-0000-000000000011");
    private static readonly Guid VraagVanZinken = Guid.Parse("dddddddd-0000-0000-0000-000000000012");

    private static readonly DateOnly Maandag = new(2026, 9, 28);
    private static readonly DateOnly Dinsdag = new(2026, 9, 29);

    [Fact]
    public void Een_geldig_voorstel_komt_onder_zijn_subthema_terecht()
    {
        var plan = AanbodgatValidator.Keur(Context(), Antwoord(Item("Drijfproef", "S1", ["N-01"])));

        var voorstel = Assert.Single(plan.Voorstellen);
        Assert.Equal(Drijven, voorstel.SubthemaId);
        Assert.Equal("Drijfproef", voorstel.Activiteit.Naam);
        Assert.Equal(["N-01"], voorstel.Activiteit.LeerplandoelCodes);
        Assert.Equal(0, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_doel_dat_niet_in_het_gat_zit_wordt_niet_gehouden()
    {
        // D1: the candidates are the discipline's goals in the aanbod-gat. Anything else the model names is a goal it
        // was not sent (Art. IV.4).
        var plan = AanbodgatValidator.Keur(Context(), Antwoord(Item("Drijfproef", "S1", ["N-01", "W-99"])));

        var voorstel = Assert.Single(plan.Voorstellen);
        Assert.Equal(["N-01"], voorstel.Activiteit.LeerplandoelCodes);
    }

    [Fact]
    public void Een_voorstel_met_alleen_onbekende_doelen_valt_weg()
    {
        var plan = AanbodgatValidator.Keur(Context(), Antwoord(Item("Drijfproef", "S1", ["MD-3.2", "VERZONNEN"])));

        Assert.Empty(plan.Voorstellen);
        Assert.Equal(1, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_voorstel_zonder_subthema_of_met_een_onbekend_subthema_valt_weg()
    {
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(
                Item("Zonder", null, ["N-01"]),
                Item("Onbekend", "S9", ["N-01"])));

        Assert.Empty(plan.Voorstellen);
        Assert.Equal(2, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_onderzoeksvraag_van_een_ander_subthema_telt_niet_mee()
    {
        // V1 exists under both subthema's; the proposal goes under S1, so S2's vraag is not the one it answers.
        var plan = AanbodgatValidator.Keur(Context(), Antwoord(Item("Drijfproef", "S1", ["N-01"], vraag: "V1")));

        var voorstel = Assert.Single(plan.Voorstellen);
        Assert.Equal(VraagVanDrijven, voorstel.Activiteit.OnderzoeksvraagId);
    }

    [Fact]
    public void Een_onbekende_onderzoeksvraag_wordt_geen_koppeling()
    {
        var plan = AanbodgatValidator.Keur(Context(), Antwoord(Item("Drijfproef", "S1", ["N-01"], vraag: "V7")));

        Assert.Null(Assert.Single(plan.Voorstellen).Activiteit.OnderzoeksvraagId);
    }

    [Fact]
    public void Meer_dan_gevraagd_wordt_afgekapt()
    {
        var plan = AanbodgatValidator.Keur(
            Context(aantal: 2),
            Antwoord(
                Item("Een", "S1", ["N-01"]),
                Item("Twee", "S2", ["N-02"]),
                Item("Drie", "S1", ["N-01"])));

        Assert.Equal(2, plan.Voorstellen.Count);
        Assert.Equal(1, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_naam_die_er_al_is_of_geweigerd_werd_valt_weg()
    {
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(
                Item("Waterbak verkennen", "S1", ["N-01"]),
                Item("Bootjes bouwen", "S1", ["N-01"]),
                Item("drijfproef", "S1", ["N-01"]),
                Item("Drijfproef", "S1", ["N-01"])));

        // The existing activiteit, the rejected name, and the second spelling of the third one.
        Assert.Equal("drijfproef", Assert.Single(plan.Voorstellen).Activiteit.Naam);
        Assert.Equal(3, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_lengte_buiten_de_grenzen_valt_weg()
    {
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(Item("Te lang", "S1", ["N-01"], lesuren: Activiteitvoorstel.MaxLesuren + 1)));

        Assert.Empty(plan.Voorstellen);
    }

    [Fact]
    public void De_dag_en_het_uur_van_het_model_komen_mee_als_voorkeur()
    {
        // ADR-0062 M1: the AI chooses the moment. What the validator keeps is what it wrote, unchecked against the
        // timetable: correcting it is Vrijmoment's (D1).
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(Item("Drijfproef", "S1", ["N-01"], dag: "2026-09-29", beginuur: "10:15")));

        Assert.Equal((Dinsdag, new TimeOnly(10, 15)), Assert.Single(plan.Voorstellen).Voorkeur);
    }

    [Fact]
    public void Een_dag_die_niet_werd_aangeboden_telt_niet_als_voorkeur()
    {
        // ADR-0062 D2: a day outside the thema's period is a different thema, not a smaller mistake.
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(Item("Drijfproef", "S1", ["N-01"], dag: "2026-12-24", beginuur: "10:15")));

        Assert.Null(Assert.Single(plan.Voorstellen).Voorkeur);
    }

    [Fact]
    public void Een_onleesbare_dag_of_een_ontbrekende_dag_laat_de_voorkeur_leeg()
    {
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(
                Item("Een", "S1", ["N-01"], dag: "maandag", beginuur: "10:15"),
                Item("Twee", "S1", ["N-01"], beginuur: "10:15")));

        Assert.Equal(2, plan.Voorstellen.Count);
        Assert.All(plan.Voorstellen, v => Assert.Null(v.Voorkeur));
    }

    [Fact]
    public void Een_dag_zonder_bruikbaar_uur_houdt_de_dag()
    {
        // D1: "this Tuesday" is a choice worth keeping, and the tool then takes the first free moment of that day.
        // A proposal is never dropped over the hour, only over its content.
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(
                Item("Een", "S1", ["N-01"], dag: "2026-09-28"),
                Item("Twee", "S1", ["N-02"], dag: "2026-09-28", beginuur: "kwart over tien")));

        Assert.Equal(2, plan.Voorstellen.Count);
        Assert.All(plan.Voorstellen, v => Assert.Equal((Maandag, TimeOnly.MinValue), v.Voorkeur));
    }

    [Theory]
    [InlineData("9:15")]
    [InlineData("09:15")]
    [InlineData("09:15:00")]
    [InlineData("9.15")]
    public void Een_uur_dat_het_model_anders_schrijft_wordt_toch_gelezen(string uur)
    {
        var plan = AanbodgatValidator.Keur(
            Context(),
            Antwoord(Item("Drijfproef", "S1", ["N-01"], dag: "2026-09-28", beginuur: uur)));

        Assert.Equal((Maandag, new TimeOnly(9, 15)), Assert.Single(plan.Voorstellen).Voorkeur);
    }

    [Fact]
    public void Een_leeg_antwoord_levert_niets_op_en_is_geen_fout()
    {
        // G4: "nothing fits" is an honest answer, and the cat then brings nothing.
        var plan = AanbodgatValidator.Keur(Context(), Antwoord());

        Assert.Empty(plan.Voorstellen);
        Assert.Equal(0, plan.AantalOvergeslagen);
    }

    [Fact]
    public void Een_onleesbaar_antwoord_valt_niet_te_keuren()
    {
        Assert.Throws<ArgumentException>(() =>
            AanbodgatValidator.Keur(Context(), ActiviteitvoorstelParseResultaat.Ongeldig("Malformed JSON")));
    }

    private static AanbodgatContext Context(int aantal = 3) =>
        new(
            "Water",
            "K3",
            "Natuur en techniek",
            [
                new PromptSubthema(
                    "S1",
                    Drijven,
                    "Drijven en zinken",
                    [new PromptOnderzoeksvraag("V1", VraagVanDrijven, "Waarom drijft een boot?")],
                    [new BestaandeActiviteit("Waterbak verkennen", ActiviteitType.Hoek)]),
                new PromptSubthema(
                    "S2",
                    Zinken,
                    "Stromend water",
                    [new PromptOnderzoeksvraag("V1", VraagVanZinken, "Waar loopt het water heen?")],
                    []),
            ],
            [Doel("N-01"), Doel("N-02")],
            ["Bootjes bouwen"],
            aantal,
            [Dag(Maandag), Dag(Dinsdag)]);

    /// <summary>A school day from 8:30 to 15:30 with a middagpauze from 12:00 to 13:00, with nothing on it.</summary>
    private static Schooldagvenster Dag(DateOnly datum) =>
        new(
            datum,
            new Schooldaguren(datum.DayOfWeek, new TimeOnly(8, 30), new TimeOnly(15, 30), new TimeOnly(12, 0), new TimeOnly(13, 0)),
            []);

    private static Leerplandoel Doel(string code) =>
        new(code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Water", "9", tekst: $"Tekst van {code}");

    private static ActiviteitvoorstelParseResultaat Antwoord(params RuweActiviteit[] activiteiten) =>
        ActiviteitvoorstelParseResultaat.Geldig(activiteiten);

    private static RuweActiviteit Item(
        string naam,
        string? subthema,
        string[] doelen,
        string? vraag = null,
        int lesuren = 1,
        string? dag = null,
        string? beginuur = null) =>
        new(
            naam,
            "Hoek",
            "De kinderen leggen voorwerpen in het water.",
            lesuren,
            vraag,
            doelen,
            "Past bij dit thema.",
            subthema,
            dag,
            beginuur);
}
