using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// Where an activiteit still fits (FB-070, ADR-0060 G5, D3). A pure function, so every rule is a test here and none of
/// them needs a database or a clock.
/// </summary>
public sealed class VrijmomentTests
{
    private static readonly DateOnly Maandag = new(2026, 9, 21);
    private static readonly DateOnly Dinsdag = new(2026, 9, 22);

    [Fact]
    public void Op_een_lege_dag_begint_het_blok_bij_het_begin_van_de_schooldag()
    {
        var moment = Vrijmoment.Zoek([Dag(Maandag)], 50);

        Assert.Equal((Maandag, new TimeOnly(8, 30), new TimeOnly(9, 20)), moment);
    }

    [Fact]
    public void Wat_al_gepland_staat_schuift_het_blok_op_naar_het_volgende_kwartier()
    {
        // 8:30 to 9:10 is taken, so the first free quarter that fits a whole block is 9:15, not 9:10.
        var moment = Vrijmoment.Zoek([Dag(Maandag, (8, 30, 9, 10))], 50);

        Assert.Equal((Maandag, new TimeOnly(9, 15), new TimeOnly(10, 5)), moment);
    }

    [Fact]
    public void Een_blok_loopt_niet_door_de_middagpauze()
    {
        // The morning is full from 8:30 to 11:50, and the pause runs 12:00 to 13:00: a block of 50 minutes does not
        // fit in the ten minutes before it, so it lands after it.
        var moment = Vrijmoment.Zoek([Dag(Maandag, (8, 30, 11, 50))], 50);

        Assert.Equal((Maandag, new TimeOnly(13, 0), new TimeOnly(13, 50)), moment);
    }

    [Fact]
    public void Een_volle_dag_schuift_door_naar_de_volgende()
    {
        var moment = Vrijmoment.Zoek([Dag(Maandag, (8, 30, 12, 0), (13, 0, 15, 30)), Dag(Dinsdag)], 50);

        Assert.Equal((Dinsdag, new TimeOnly(8, 30), new TimeOnly(9, 20)), moment);
    }

    [Fact]
    public void Een_weekdag_zonder_schooluren_biedt_geen_moment()
    {
        // Admin has set no hours for that day, so the tool does not know when school runs and invents nothing.
        Assert.Null(Vrijmoment.Zoek([new Schooldagvenster(Maandag, null, [])], 50));
    }

    [Fact]
    public void Past_het_nergens_dan_is_er_geen_moment()
    {
        Assert.Null(Vrijmoment.Zoek([Dag(Maandag, (8, 30, 12, 0), (13, 0, 15, 30))], 50));
    }

    [Fact]
    public void Zonder_dagen_is_er_geen_moment()
    {
        Assert.Null(Vrijmoment.Zoek([], 50));
    }

    [Fact]
    public void Een_blok_van_twee_lesuren_heeft_meer_ruimte_nodig()
    {
        // 100 minutes no longer fit in the 90 free minutes of the morning, so the afternoon takes it.
        var moment = Vrijmoment.Zoek([Dag(Maandag, (8, 30, 10, 30))], 2 * Vrijmoment.MinutenPerLesuur);

        Assert.Equal((Maandag, new TimeOnly(13, 0), new TimeOnly(14, 40)), moment);
    }

    [Fact]
    public void Een_lengte_van_nul_of_minder_is_een_programmeerfout()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Vrijmoment.Zoek([Dag(Maandag)], 0));
    }

    // --- The moment the AI proposed (ADR-0062 M1, D1) ---

    [Fact]
    public void Het_moment_van_het_model_wordt_gebruikt_als_het_vrij_is()
    {
        var moment = Vrijmoment.Zoek([Dag(Maandag), Dag(Dinsdag)], 50, (Dinsdag, new TimeOnly(10, 15)));

        Assert.Equal((Dinsdag, new TimeOnly(10, 15), new TimeOnly(11, 5)), moment);
    }

    [Fact]
    public void Een_bezet_uur_schuift_op_binnen_de_dag_van_het_model()
    {
        // D1: the day the model chose is the pedagogical choice and is kept; the hour is arithmetic and is corrected.
        var moment = Vrijmoment.Zoek([Dag(Maandag), Dag(Dinsdag, (10, 0, 11, 0))], 50, (Dinsdag, new TimeOnly(10, 15)));

        Assert.Equal((Dinsdag, new TimeOnly(11, 0), new TimeOnly(11, 50)), moment);
    }

    [Fact]
    public void Een_uur_in_de_middagpauze_schuift_naar_de_namiddag()
    {
        var moment = Vrijmoment.Zoek([Dag(Maandag)], 50, (Maandag, new TimeOnly(12, 30)));

        Assert.Equal((Maandag, new TimeOnly(13, 0), new TimeOnly(13, 50)), moment);
    }

    [Fact]
    public void Een_uur_na_de_schooldag_schuift_naar_de_volgende_dag()
    {
        var moment = Vrijmoment.Zoek([Dag(Maandag), Dag(Dinsdag)], 50, (Maandag, new TimeOnly(17, 0)));

        Assert.Equal((Dinsdag, new TimeOnly(8, 30), new TimeOnly(9, 20)), moment);
    }

    [Fact]
    public void Een_dag_voor_de_dag_van_het_model_wordt_niet_gebruikt()
    {
        // The Monday is entirely free, and is still not taken: a moment the model did not want is no better answer
        // than a later one it might have.
        var moment = Vrijmoment.Zoek([Dag(Maandag), Dag(Dinsdag)], 50, (Dinsdag, new TimeOnly(9, 0)));

        Assert.Equal(Dinsdag, moment!.Value.Datum);
    }

    [Fact]
    public void Vindt_de_zoektocht_vooruit_niets_dan_telt_een_eerdere_dag_alsnog()
    {
        // ADR-0062 D1: a moment the school cannot give is corrected, never dropped. The model chose the Tuesday and
        // the Tuesday is full, so the free Monday it passed over is better than no activiteit at all.
        var moment = Vrijmoment.Zoek(
            [Dag(Maandag), Dag(Dinsdag, (8, 30, 12, 0), (13, 0, 15, 30))],
            50,
            (Dinsdag, new TimeOnly(9, 0)));

        Assert.Equal((Maandag, new TimeOnly(8, 30), new TimeOnly(9, 20)), moment);
    }

    [Fact]
    public void Past_het_op_geen_enkele_dag_dan_is_er_ook_met_een_voorkeur_geen_moment()
    {
        var moment = Vrijmoment.Zoek(
            [Dag(Maandag, (8, 30, 12, 0), (13, 0, 15, 30)), Dag(Dinsdag, (8, 30, 12, 0), (13, 0, 15, 30))],
            50,
            (Dinsdag, new TimeOnly(9, 0)));

        Assert.Null(moment);
    }

    [Fact]
    public void Een_dag_die_niet_wordt_aangeboden_valt_terug_op_de_eerste_vrije_dag()
    {
        // ADR-0062 D2 leaves such a day out of the preference; this is the other half of that rule.
        var moment = Vrijmoment.Zoek([Dag(Maandag), Dag(Dinsdag)], 50, (new DateOnly(2026, 12, 24), new TimeOnly(9, 0)));

        Assert.Equal((Maandag, new TimeOnly(8, 30), new TimeOnly(9, 20)), moment);
    }

    [Fact]
    public void Een_dag_zonder_uur_neemt_het_eerste_vrije_moment_van_die_dag()
    {
        var moment = Vrijmoment.Zoek([Dag(Maandag), Dag(Dinsdag)], 50, (Dinsdag, TimeOnly.MinValue));

        Assert.Equal((Dinsdag, new TimeOnly(8, 30), new TimeOnly(9, 20)), moment);
    }

    // --- The free stretches the model is shown (ADR-0062 M1) ---

    [Fact]
    public void De_vrije_stukken_van_een_lege_dag_zijn_de_twee_helften_van_de_schooldag()
    {
        Assert.Equal(
            [new Tijdvak(new TimeOnly(8, 30), new TimeOnly(12, 0)), new Tijdvak(new TimeOnly(13, 0), new TimeOnly(15, 30))],
            Vrijmoment.VrijeStukken(Dag(Maandag)));
    }

    [Fact]
    public void Wat_gepland_staat_knipt_de_vrije_stukken_op()
    {
        Assert.Equal(
            [
                new Tijdvak(new TimeOnly(8, 30), new TimeOnly(9, 0)),
                new Tijdvak(new TimeOnly(10, 0), new TimeOnly(12, 0)),
                new Tijdvak(new TimeOnly(13, 0), new TimeOnly(15, 30)),
            ],
            Vrijmoment.VrijeStukken(Dag(Maandag, (9, 0, 10, 0))));
    }

    [Fact]
    public void Een_volle_voormiddag_laat_alleen_de_namiddag_over()
    {
        Assert.Equal(
            [new Tijdvak(new TimeOnly(13, 0), new TimeOnly(15, 30))],
            Vrijmoment.VrijeStukken(Dag(Maandag, (8, 30, 12, 0))));
    }

    [Fact]
    public void Een_dag_zonder_schooluren_heeft_geen_vrije_stukken()
    {
        Assert.Empty(Vrijmoment.VrijeStukken(new Schooldagvenster(Maandag, null, [])));
    }

    /// <summary>A school day from 8:30 to 15:30 with a middagpauze from 12:00 to 13:00, and what is taken on it.</summary>
    private static Schooldagvenster Dag(DateOnly datum, params (int VanUur, int VanMinuut, int TotUur, int TotMinuut)[] bezet) =>
        new(
            datum,
            new Schooldaguren(datum.DayOfWeek, new TimeOnly(8, 30), new TimeOnly(15, 30), new TimeOnly(12, 0), new TimeOnly(13, 0)),
            bezet.Select(b => new Tijdvak(new TimeOnly(b.VanUur, b.VanMinuut), new TimeOnly(b.TotUur, b.TotMinuut))).ToList());
}
