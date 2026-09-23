using Jaarplanner.Application.Kat;
using Jaarplanner.Application.Planning.Weekvoorstel;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// Where the blocks of a weekvoorstel land (FB-027, ADR-0067 W2, D1, D4). A pure function, so the rule the ticket's
/// first acceptance criterion states is a test here that needs no AI.
/// </summary>
public sealed class WeekinpassingTests
{
    private static readonly DateOnly Maandag = new(2026, 9, 28);
    private static readonly DateOnly Dinsdag = new(2026, 9, 29);
    private static readonly DateOnly Woensdag = new(2026, 9, 30);
    private static readonly DateOnly Donderdag = new(2026, 10, 1);
    private static readonly DateOnly Vrijdag = new(2026, 10, 2);
    private static readonly DateOnly[] Week = [Maandag, Dinsdag, Woensdag, Donderdag, Vrijdag];

    /// <summary>
    /// The ticket's first criterion: schooluren 8:30 to 15:30, middagpauze 12:00 to 13:15 and an algemene fiche every
    /// day from 13:15 to 14:00. However many the model picks, no block falls outside the hours, in the pause or over the
    /// fiche.
    /// </summary>
    [Fact]
    public void Geen_blok_valt_buiten_de_schooluren_in_de_middagpauze_of_over_de_fiche()
    {
        var kandidaten = Enumerable.Range(1, 12)
            .Select(i => Kandidaat($"A{i}", lesuren: 1 + (i % 2)))
            .ToList();
        var context = Context(kandidaten, Week.Select(d => Dag(d, (13, 15, 14, 0))).ToArray());
        var keuzes = kandidaten.Select((k, i) => Keuze(k.Sleutel, Week[i % 5])).ToList();

        var resultaat = Weekinpassing.Pas(context, keuzes);

        Assert.NotEmpty(resultaat.Blokken);
        foreach (var blok in resultaat.Blokken)
        {
            Assert.True(blok.Begin >= new TimeOnly(8, 30), $"{blok.Kandidaat.Naam} begint voor 8:30");
            Assert.True(blok.Einde <= new TimeOnly(15, 30), $"{blok.Kandidaat.Naam} eindigt na 15:30");
            Assert.False(Overlapt(blok, 12, 0, 13, 15), $"{blok.Kandidaat.Naam} valt in de middagpauze");
            Assert.False(Overlapt(blok, 13, 15, 14, 0), $"{blok.Kandidaat.Naam} valt over de fiche");
        }

        // And no two proposals share a minute.
        foreach (var dag in resultaat.Blokken.GroupBy(b => b.Datum))
        {
            var blokken = dag.OrderBy(b => b.Begin).ToList();
            for (var i = 1; i < blokken.Count; i++)
            {
                Assert.True(blokken[i].Begin >= blokken[i - 1].Einde);
            }
        }
    }

    [Fact]
    public void Het_model_kiest_de_dag_en_de_tool_het_eerste_vrije_moment_in_zijn_volgorde()
    {
        var a = Kandidaat("A1");
        var b = Kandidaat("A2");
        var context = Context([a, b], Dag(Maandag), Dag(Dinsdag, (8, 30, 9, 0)));

        var resultaat = Weekinpassing.Pas(context, [Keuze("A2", Dinsdag), Keuze("A1", Dinsdag)]);

        Assert.Equal(
            [("A2", Dinsdag, new TimeOnly(9, 0)), ("A1", Dinsdag, new TimeOnly(10, 0))],
            resultaat.Blokken.Select(bl => (bl.Kandidaat.Sleutel, bl.Datum, bl.Begin)).ToList());
        Assert.Equal(new TimeOnly(9, 50), resultaat.Blokken[0].Einde);
    }

    [Fact]
    public void De_lengte_van_het_blok_is_die_van_de_activiteit()
    {
        var context = Context([Kandidaat("A1", lesuren: 2)], Dag(Maandag));

        var blok = Assert.Single(Weekinpassing.Pas(context, [Keuze("A1", Maandag)]).Blokken);

        Assert.Equal((new TimeOnly(8, 30), new TimeOnly(10, 10)), (blok.Begin, blok.Einde));
    }

    [Fact]
    public void Een_volle_dag_schuift_door_naar_een_andere_dag_van_de_week()
    {
        var context = Context([Kandidaat("A1")], Dag(Maandag), Dag(Dinsdag, (8, 30, 12, 0), (13, 15, 15, 30)));

        var blok = Assert.Single(Weekinpassing.Pas(context, [Keuze("A1", Dinsdag)]).Blokken);

        Assert.Equal(Maandag, blok.Datum);
    }

    [Fact]
    public void Een_dag_buiten_het_subthema_wordt_een_dag_binnen_het_subthema()
    {
        // The subthema runs from Wednesday on; the model named Monday.
        var kandidaat = Kandidaat("A1", dagen: [Woensdag, Donderdag, Vrijdag]);
        var context = Context([kandidaat], Week.Select(d => Dag(d)).ToArray());

        var blok = Assert.Single(Weekinpassing.Pas(context, [Keuze("A1", Maandag)]).Blokken);

        Assert.Equal(Woensdag, blok.Datum);
    }

    [Fact]
    public void Wat_nergens_past_wordt_gemeld_en_niet_gepland()
    {
        var context = Context([Kandidaat("A1", "Bladeren stempelen")], Dag(Maandag, (8, 30, 12, 0), (13, 15, 15, 30)));

        var resultaat = Weekinpassing.Pas(context, [Keuze("A1", Maandag)]);

        Assert.Empty(resultaat.Blokken);
        Assert.Equal(["Bladeren stempelen"], resultaat.PastNiet);
    }

    [Fact]
    public void Een_net_voorgesteld_blok_telt_als_bezet_voor_het_volgende()
    {
        // The morning holds one block of 50 minutes and a second no longer; the second goes to the afternoon.
        var context = Context([Kandidaat("A1"), Kandidaat("A2")], Dag(Maandag, (9, 20, 12, 0)));

        var resultaat = Weekinpassing.Pas(context, [Keuze("A1", Maandag), Keuze("A2", Maandag)]);

        Assert.Equal([new TimeOnly(8, 30), new TimeOnly(13, 15)], resultaat.Blokken.Select(b => b.Begin).ToList());
    }

    [Fact]
    public void Een_onbekende_een_herhaalde_of_een_ongemotiveerde_keuze_valt_weg_en_de_rest_blijft()
    {
        var context = Context([Kandidaat("A1"), Kandidaat("A2")], Dag(Maandag));

        var resultaat = Weekinpassing.Pas(context,
        [
            Keuze("A1", Maandag),
            Keuze("A9", Maandag),
            Keuze("a1", Maandag),
            new RuweWeekkeuze("A2", "2026-09-28", null),
            new RuweWeekkeuze(null, "2026-09-28", "zonder sleutel"),
        ]);

        Assert.Equal(["A1"], resultaat.Blokken.Select(b => b.Kandidaat.Sleutel).ToList());
        Assert.Equal(4, resultaat.AantalOvergeslagen);
    }

    [Theory]
    [InlineData("28/09/2026")]
    [InlineData("maandag")]
    [InlineData(null)]
    public void Een_onleesbare_dag_neemt_het_eerste_vrije_moment_van_de_week(string? dag)
    {
        var context = Context([Kandidaat("A1")], Dag(Maandag, (8, 30, 12, 0), (13, 15, 15, 30)), Dag(Dinsdag));

        var blok = Assert.Single(Weekinpassing.Pas(context, [new RuweWeekkeuze("A1", dag, "motivatie")]).Blokken);

        Assert.Equal((Dinsdag, new TimeOnly(8, 30)), (blok.Datum, blok.Begin));
    }

    [Fact]
    public void De_motivatie_gaat_mee_met_het_blok()
    {
        var context = Context([Kandidaat("A1")], Dag(Maandag));

        var blok = Assert.Single(Weekinpassing.Pas(context, [new RuweWeekkeuze("A1", "2026-09-28", "Start van de week.")]).Blokken);

        Assert.Equal("Start van de week.", blok.Motivatie);
    }

    private static bool Overlapt(IngepastBlok blok, int vu, int vm, int tu, int tm) =>
        new Tijdvak(blok.Begin, blok.Einde).Overlapt(new TimeOnly(vu, vm), new TimeOnly(tu, tm));

    private static RuweWeekkeuze Keuze(string sleutel, DateOnly dag) =>
        new(sleutel, dag.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture), $"Motivatie voor {sleutel}.");

    private static Weekkandidaat Kandidaat(string sleutel, string? naam = null, int lesuren = 1, DateOnly[]? dagen = null) =>
        new(sleutel, Guid.NewGuid(), naam ?? $"Activiteit {sleutel}", null, null, lesuren, "Bladeren", (dagen ?? Week).ToHashSet());

    private static WeekvoorstelContext Context(IReadOnlyList<Weekkandidaat> kandidaten, params Schooldagvenster[] dagen) =>
        new("K3", kandidaten, dagen);

    /// <summary>A school day of 8:30 to 15:30 with a middagpauze of 12:00 to 13:15, and what is taken on it.</summary>
    private static Schooldagvenster Dag(DateOnly datum, params (int Vu, int Vm, int Tu, int Tm)[] bezet) =>
        new(
            datum,
            new Schooldaguren(datum.DayOfWeek, new TimeOnly(8, 30), new TimeOnly(15, 30), new TimeOnly(12, 0), new TimeOnly(13, 15)),
            bezet.Select(b => new Tijdvak(new TimeOnly(b.Vu, b.Vm), new TimeOnly(b.Tu, b.Tm))).ToList());
}
