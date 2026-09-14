using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The <see cref="Hoekplaatsing"/> and <see cref="Hoekverrijking"/> invariants (owner, meeting 2026-08-30).
/// <para>
/// <b>The rule these exist to pin down is that a corner has one answer per day.</b> "Wat ligt er deze week in de
/// boekenhoek" is printed on a day cell in the agenda, so two enrichments covering the same Tuesday is not a richer
/// answer, it is an unanswerable question. Gaps are the opposite case and are deliberately fine: a corner with nothing
/// special in it for a fortnight is an ordinary state, not a missing value.
/// </para>
/// </summary>
public sealed class HoekplaatsingTests
{
    private static readonly DateOnly Start = new(2026, 9, 1);
    private static readonly DateOnly Eind = new(2026, 12, 18);

    // Hoekenwerk after lunch, the ordinary case in the demo school.
    private static readonly TimeOnly HalfTwee = new(13, 30);
    private static readonly TimeOnly TweeUurTwintig = new(14, 20);

    private static Hoekplaatsing Plaatsing() => new(Guid.NewGuid(), Guid.NewGuid(), Start, Eind);

    /// <summary>
    /// The class's school year, which decides the days a moment may move to. A closed week (Monday 26 to Friday 30
    /// October) and one vrije dag (Wednesday 7 October), both inside <see cref="Plaatsing"/>'s window and clear of the
    /// September days the other tests move rows between.
    /// </summary>
    private static Schooljaar Jaar()
    {
        var jaar = new Schooljaar("2026-2027", new DateOnly(2026, 8, 31), new DateOnly(2027, 6, 30));
        jaar.VoegSluitingToe(new Schoolsluiting("Herfst", new DateOnly(2026, 10, 26), new DateOnly(2026, 10, 30)));
        jaar.VoegSluitingToe(new Schoolsluiting(
            "Studiedag",
            new DateOnly(2026, 10, 7),
            new DateOnly(2026, 10, 7),
            Sluitingssoort.VrijeDag));
        return jaar;
    }

    [Fact]
    public void Een_plaatsing_bewaart_de_periode_die_de_leraar_aanduidde()
    {
        var plaatsing = Plaatsing();

        Assert.Equal(Start, plaatsing.Van);
        Assert.Equal(Eind, plaatsing.Tot);
        Assert.True(plaatsing.Omvat(new DateOnly(2026, 10, 5)));
        Assert.False(plaatsing.Omvat(new DateOnly(2027, 1, 5)));
    }

    [Fact]
    public void Een_periode_die_eindigt_voor_ze_begint_wordt_geweigerd()
    {
        var fout = Assert.Throws<ArgumentException>(
            () => new Hoekplaatsing(Guid.NewGuid(), Guid.NewGuid(), Eind, Start));

        // Dutch: both dates came from a teacher's own mini calendar, so this is a sentence she can act on (Art. II.3).
        Assert.Contains("hoekperiode", fout.Message);
    }

    [Fact]
    public void Een_nieuwe_plaatsing_heeft_nog_geen_momenten_tot_de_service_ze_inplant()
    {
        var plaatsing = Plaatsing();

        // The aggregate does not know which days the school is open, so it writes nothing itself. The service plans
        // one row per teaching day, for EVERY placement since 2026-09-11 ("elke hoek moet een tijdstip krijgen");
        // HoekplaatsingServiceTests holds that half.
        Assert.Empty(plaatsing.Momenten);
    }

    [Fact]
    public void Elke_dag_van_de_periode_krijgt_zijn_eigen_rij()
    {
        var plaatsing = Plaatsing();

        // What the service does: one row per teaching day. Fifteen for a three-week placement, which is what the
        // owner asked for, and each one exists so it can be moved on its own.
        foreach (var dag in new[] { new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 9) })
        {
            plaatsing.PlanIn(dag, HalfTwee, TweeUurTwintig);
        }

        Assert.Equal(3, plaatsing.Momenten.Count);
        Assert.All(plaatsing.Momenten, m => Assert.Equal(HalfTwee, m.Begin));
        Assert.All(plaatsing.Momenten, m => Assert.Equal(TweeUurTwintig, m.Einde));
    }

    [Fact]
    public void Een_losse_dag_kan_naar_een_ander_uur()
    {
        // THE REQUIREMENT THIS ENTITY EXISTS FOR (owner, 2026-08-30): "als leerkracht wil ik flexibel kunnen
        // zijn". The hoek runs all fortnight after lunch, and on this one Wednesday it happens in the morning and
        // runs longer. A derived appearance could not express that, which is why the fifteen rows are stored.
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        var woensdag = plaatsing.PlanIn(new DateOnly(2026, 9, 9), HalfTwee, TweeUurTwintig);

        Assert.True(plaatsing.VerplaatsMoment(woensdag.Id, new DateOnly(2026, 9, 9), new TimeOnly(10, 15), new TimeOnly(11, 30), Jaar()));

        var verplaatst = plaatsing.Momenten.Single(m => m.Id == woensdag.Id);
        Assert.Equal(new TimeOnly(10, 15), verplaatst.Begin);
        Assert.Equal(new TimeOnly(11, 30), verplaatst.Einde);
        // And the other day did not move with it.
        Assert.Equal(HalfTwee, plaatsing.Momenten.Single(m => m.Id != woensdag.Id).Begin);
    }

    [Fact]
    public void Nieuwe_uren_gelden_voor_elke_dag_ook_een_die_apart_verzet_was()
    {
        // Owner ruling 2026-09-11: new hours for the run reach the Tuesday she once lengthened by hand as well.
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        var dinsdag = plaatsing.PlanIn(new DateOnly(2026, 9, 8), HalfTwee, TweeUurTwintig);
        plaatsing.VerplaatsMoment(dinsdag.Id, dinsdag.Datum, HalfTwee, new TimeOnly(15, 0), Jaar());

        plaatsing.ZetUren(new TimeOnly(9, 0), new TimeOnly(10, 30));

        Assert.All(plaatsing.Momenten, m => Assert.Equal(new TimeOnly(9, 0), m.Begin));
        Assert.All(plaatsing.Momenten, m => Assert.Equal(new TimeOnly(10, 30), m.Einde));
        // Each stays on its own day: this changes when, never which days.
        Assert.Equal([new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 8)], plaatsing.Momenten.Select(m => m.Datum).Order());
    }

    /// <summary>
    /// The refusal for a day holding the hoek more than once, word for word. Its twin is <c>hoekdetail.dubbeleDag</c> in
    /// nl.json, and <c>Hoekdetailblad.test.tsx</c> pins the same literal against the rendered sheet: a change to either
    /// sentence fails one of the two tests instead of letting the sheet and the server drift apart.
    /// </summary>
    private static string Dubbel(string dagen) =>
        $"Op {dagen} staat deze hoek meer dan één keer. Sleep er eerst één naar een andere dag, tot geen dag de hoek meer dan één keer heeft. Dan kan je de uren aanpassen.";

    [Fact]
    public void Nieuwe_uren_worden_geweigerd_zolang_een_dag_de_hoek_meer_dan_een_keer_heeft()
    {
        // Tuesday dragged onto Monday morning: legal on its own, because it starts at another time than Monday's own
        // row. At the same hours the two would be one row written twice. Owner ruling 2026-09-11: refuse and name the
        // day, rather than fold the two into one and quietly lose an appearance she placed.
        var plaatsing = Plaatsing();
        var maandag = plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        var dinsdag = plaatsing.PlanIn(new DateOnly(2026, 9, 8), HalfTwee, TweeUurTwintig);
        plaatsing.VerplaatsMoment(dinsdag.Id, maandag.Datum, new TimeOnly(9, 0), new TimeOnly(9, 50), Jaar());

        var fout = Assert.Throws<ArgumentException>(() => plaatsing.ZetUren(new TimeOnly(10, 0), new TimeOnly(11, 0)));

        Assert.Equal(Dubbel("maandag 7 september"), fout.Message);
        Assert.Equal(2, plaatsing.Momenten.Count);
        Assert.Equal(HalfTwee, plaatsing.Momenten.Single(m => m.Id == maandag.Id).Begin);
        Assert.Equal(new TimeOnly(9, 0), plaatsing.Momenten.Single(m => m.Id == dinsdag.Id).Begin);
    }

    [Fact]
    public void Drie_keer_op_een_dag_is_ook_meer_dan_een_keer()
    {
        // Tuesday and Wednesday both dragged onto Monday at their own hours: BewaakDag allows it, since no two start
        // together. The sentence must not say "twice" here, which is why it says "meer dan één keer".
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        var dinsdag = plaatsing.PlanIn(new DateOnly(2026, 9, 8), HalfTwee, TweeUurTwintig);
        var woensdag = plaatsing.PlanIn(new DateOnly(2026, 9, 9), HalfTwee, TweeUurTwintig);
        plaatsing.VerplaatsMoment(dinsdag.Id, new DateOnly(2026, 9, 7), new TimeOnly(9, 0), new TimeOnly(9, 50), Jaar());
        plaatsing.VerplaatsMoment(woensdag.Id, new DateOnly(2026, 9, 7), new TimeOnly(11, 0), new TimeOnly(11, 50), Jaar());

        var fout = Assert.Throws<ArgumentException>(() => plaatsing.ZetUren(new TimeOnly(10, 0), new TimeOnly(11, 0)));

        Assert.Equal(Dubbel("maandag 7 september"), fout.Message);
        Assert.Equal(3, plaatsing.Momenten.Count(m => m.Datum == new DateOnly(2026, 9, 7)));
    }

    [Fact]
    public void Twee_dagen_met_de_hoek_meer_dan_een_keer_worden_allebei_genoemd_in_kalendervolgorde()
    {
        // Thursday onto Wednesday first, then Tuesday onto Monday, so the order the rows were changed in is not the
        // calendar order the sentence must use.
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        var dinsdag = plaatsing.PlanIn(new DateOnly(2026, 9, 8), HalfTwee, TweeUurTwintig);
        plaatsing.PlanIn(new DateOnly(2026, 9, 9), HalfTwee, TweeUurTwintig);
        var donderdag = plaatsing.PlanIn(new DateOnly(2026, 9, 10), HalfTwee, TweeUurTwintig);
        plaatsing.VerplaatsMoment(donderdag.Id, new DateOnly(2026, 9, 9), new TimeOnly(9, 0), new TimeOnly(9, 50), Jaar());
        plaatsing.VerplaatsMoment(dinsdag.Id, new DateOnly(2026, 9, 7), new TimeOnly(9, 0), new TimeOnly(9, 50), Jaar());

        var fout = Assert.Throws<ArgumentException>(() => plaatsing.ZetUren(new TimeOnly(10, 0), new TimeOnly(11, 0)));

        Assert.Equal(Dubbel("maandag 7 september en woensdag 9 september"), fout.Message);
    }

    [Fact]
    public void Nieuwe_uren_met_een_einde_voor_het_begin_laten_de_reeks_zoals_ze_was()
    {
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);

        var fout = Assert.Throws<ArgumentException>(() => plaatsing.ZetUren(TweeUurTwintig, HalfTwee));

        Assert.Contains("einde", fout.Message);
        var moment = Assert.Single(plaatsing.Momenten);
        Assert.Equal((HalfTwee, TweeUurTwintig), (moment.Begin, moment.Einde));
    }

    [Fact]
    public void Een_losse_dag_kan_weg_zonder_de_rest_mee_te_nemen()
    {
        var plaatsing = Plaatsing();
        var maandag = plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        plaatsing.PlanIn(new DateOnly(2026, 9, 8), HalfTwee, TweeUurTwintig);

        Assert.True(plaatsing.VerwijderMoment(maandag.Id));

        Assert.Single(plaatsing.Momenten);
        Assert.Equal(new DateOnly(2026, 9, 8), plaatsing.Momenten[0].Datum);
    }

    [Fact]
    public void Dezelfde_hoek_twee_keer_met_hetzelfde_begin_op_een_dag_betekent_niets()
    {
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);

        // The one combination that is refused: it is the same row written twice. A second appearance that starts at
        // another time is fine, even while the first is still running, as two blocks side by side in any agenda.
        var fout = Assert.Throws<ArgumentException>(
            () => plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, new TimeOnly(15, 0)));
        Assert.Contains("begint al", fout.Message);

        plaatsing.PlanIn(new DateOnly(2026, 9, 7), new TimeOnly(14, 0), new TimeOnly(14, 50));
        Assert.Equal(2, plaatsing.Momenten.Count);
    }

    [Fact]
    public void Een_moment_buiten_de_periode_van_de_hoek_wordt_geweigerd()
    {
        var plaatsing = Plaatsing();

        Assert.Throws<ArgumentException>(() => plaatsing.PlanIn(new DateOnly(2027, 1, 12), HalfTwee, TweeUurTwintig));

        var moment = plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        Assert.Throws<ArgumentException>(
            () => plaatsing.VerplaatsMoment(moment.Id, new DateOnly(2027, 1, 12), HalfTwee, TweeUurTwintig, Jaar()));
    }

    /// <summary>
    /// The refusal for a day without school, word for word. It is the sentence
    /// <see cref="AlgemeneFicheplaatsing.VerplaatsMoment"/> gives, whose tests pin the same literal together with the
    /// frontend's <c>fichedetail.geenSchooldag</c>, so a rewrite of any one of them fails a test.
    /// </summary>
    private const string GeenSchooldag = "Op die dag is er geen school. Kies een schooldag.";

    [Fact]
    public void Een_moment_verplaatsen_naar_een_dag_zonder_school_wordt_geweigerd()
    {
        // TB-011: the service plans rows only on open weekdays, so a move must not put one on a closed day either. All
        // three days lie inside the window, so this is the school-day rule speaking and not the window rule.
        var plaatsing = Plaatsing();
        var dinsdag = plaatsing.PlanIn(new DateOnly(2026, 9, 1), HalfTwee, TweeUurTwintig);
        var jaar = Jaar();

        // A Saturday, a day in the closed week and the vrije dag.
        foreach (var dag in new[] { new DateOnly(2026, 9, 5), new DateOnly(2026, 10, 28), new DateOnly(2026, 10, 7) })
        {
            var fout = Assert.Throws<ArgumentException>(
                () => plaatsing.VerplaatsMoment(dinsdag.Id, dag, new TimeOnly(9, 0), new TimeOnly(9, 50), jaar));
            Assert.Equal(GeenSchooldag, fout.Message);
        }

        // A refusal moves nothing: the day and both times are as they were.
        Assert.Equal(
            (new DateOnly(2026, 9, 1), HalfTwee, TweeUurTwintig),
            (dinsdag.Datum, dinsdag.Begin, dinsdag.Einde));

        // And the rule is about closed days only: the Thursday right after the vrije dag is an ordinary school day.
        Assert.True(plaatsing.VerplaatsMoment(dinsdag.Id, new DateOnly(2026, 10, 8), new TimeOnly(9, 0), new TimeOnly(9, 50), jaar));
        Assert.Equal(new DateOnly(2026, 10, 8), dinsdag.Datum);
    }

    [Fact]
    public void Een_einde_dat_niet_na_het_begin_ligt_bestaat_niet()
    {
        var plaatsing = Plaatsing();

        // Dutch, like the window rules: both times came from the teacher's own sheet or her own drag (Art. II.3).
        var fout = Assert.Throws<ArgumentException>(
            () => plaatsing.PlanIn(new DateOnly(2026, 9, 7), TweeUurTwintig, HalfTwee));
        Assert.Contains("einde", fout.Message);
        Assert.Empty(plaatsing.Momenten);

        var moment = plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        Assert.Throws<ArgumentException>(
            () => plaatsing.VerplaatsMoment(moment.Id, moment.Datum, HalfTwee, HalfTwee, Jaar()));

        // A refused resize leaves the row as it was.
        Assert.Equal(TweeUurTwintig, plaatsing.Momenten.Single().Einde);
    }

    [Fact]
    public void Verrijkingen_volgen_elkaar_op_en_mogen_gaten_laten()
    {
        var plaatsing = Plaatsing();

        plaatsing.VoegVerrijkingToe(Start, new DateOnly(2026, 10, 16), "prentenboeken over de herfst");
        // Abutting, not overlapping: one ends on the 16th, the next begins on the 17th.
        plaatsing.VoegVerrijkingToe(new DateOnly(2026, 10, 17), new DateOnly(2026, 11, 20), "boeken over bouwen");

        Assert.Equal(2, plaatsing.Verrijkingen.Count);
        Assert.Equal("prentenboeken over de herfst", plaatsing.VerrijkingOp(new DateOnly(2026, 9, 30))!.Tekst);
        Assert.Equal("boeken over bouwen", plaatsing.VerrijkingOp(new DateOnly(2026, 11, 3))!.Tekst);

        // The gap after 20 november is an ordinary state and reads as one: the corner is open with nothing special
        // in it, which is not the same as an error.
        Assert.Null(plaatsing.VerrijkingOp(new DateOnly(2026, 12, 1)));
    }

    [Fact]
    public void Twee_verrijkingen_op_dezelfde_dag_worden_geweigerd()
    {
        var plaatsing = Plaatsing();
        plaatsing.VoegVerrijkingToe(Start, new DateOnly(2026, 10, 16), "prentenboeken over de herfst");

        var fout = Assert.Throws<ArgumentException>(
            () => plaatsing.VoegVerrijkingToe(new DateOnly(2026, 10, 16), new DateOnly(2026, 11, 20), "boeken over bouwen"));

        Assert.Contains("verrijking", fout.Message);
        Assert.Single(plaatsing.Verrijkingen);
    }

    [Fact]
    public void Een_verrijking_buiten_de_periode_van_de_hoek_wordt_geweigerd()
    {
        var plaatsing = Plaatsing();

        // A day before the corner runs describes nothing.
        Assert.Throws<ArgumentException>(
            () => plaatsing.VoegVerrijkingToe(new DateOnly(2026, 8, 25), new DateOnly(2026, 9, 10), "te vroeg"));

        // And a day after it stops.
        Assert.Throws<ArgumentException>(
            () => plaatsing.VoegVerrijkingToe(new DateOnly(2026, 12, 1), new DateOnly(2027, 1, 10), "te laat"));

        Assert.Empty(plaatsing.Verrijkingen);
    }

    [Fact]
    public void Een_verrijking_zonder_tekst_bestaat_niet()
    {
        var plaatsing = Plaatsing();

        Assert.Throws<ArgumentException>(() => plaatsing.VoegVerrijkingToe(Start, Eind, "   "));
    }

    [Fact]
    public void Een_verrijking_aanpassen_overlapt_niet_met_zichzelf()
    {
        var plaatsing = Plaatsing();
        var verrijking = plaatsing.VoegVerrijkingToe(Start, new DateOnly(2026, 10, 16), "prentenboeken");

        // Same window, new text. Without the self-exclusion in the overlap check this is the call that would
        // wrongly refuse, and it is the ordinary one: she reopens the sheet and rewrites what she typed.
        var gelukt = plaatsing.WijzigVerrijking(verrijking.Id, Start, new DateOnly(2026, 10, 16), "prentenboeken en bladeren");

        Assert.True(gelukt);
        Assert.Equal("prentenboeken en bladeren", plaatsing.Verrijkingen[0].Tekst);
    }

    [Fact]
    public void Een_onbekende_verrijking_aanpassen_of_verwijderen_meldt_dat_ze_er_niet_is()
    {
        var plaatsing = Plaatsing();

        Assert.False(plaatsing.WijzigVerrijking(Guid.NewGuid(), Start, Eind, "iets"));
        Assert.False(plaatsing.VerwijderVerrijking(Guid.NewGuid()));
    }

    [Fact]
    public void Een_verrijking_verwijderen_laat_de_rest_staan()
    {
        var plaatsing = Plaatsing();
        var eerste = plaatsing.VoegVerrijkingToe(Start, new DateOnly(2026, 10, 16), "prentenboeken");
        plaatsing.VoegVerrijkingToe(new DateOnly(2026, 10, 17), new DateOnly(2026, 11, 20), "bouwen");

        Assert.True(plaatsing.VerwijderVerrijking(eerste.Id));

        Assert.Single(plaatsing.Verrijkingen);
        Assert.Equal("bouwen", plaatsing.Verrijkingen[0].Tekst);
    }

    [Fact]
    public void De_periode_inkorten_weigert_wanneer_er_verrijkingen_buiten_zouden_vallen()
    {
        var plaatsing = Plaatsing();
        plaatsing.VoegVerrijkingToe(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 20), "bouwen");
        plaatsing.VoegVerrijkingToe(new DateOnly(2026, 12, 1), new DateOnly(2026, 12, 10), "kerst");

        var fout = Assert.Throws<ArgumentException>(() => plaatsing.Herzet(Start, new DateOnly(2026, 10, 31)));

        // The count is in the sentence: "one of your verrijkingen is in the way" without saying how many is not
        // something a teacher can act on.
        Assert.Contains("2 verrijkingen", fout.Message);

        // And the placement did not move.
        Assert.Equal(Eind, plaatsing.Tot);
    }

    [Fact]
    public void De_periode_inkorten_noemt_een_enkele_verrijking_in_het_enkelvoud()
    {
        var plaatsing = Plaatsing();
        plaatsing.VoegVerrijkingToe(new DateOnly(2026, 12, 1), new DateOnly(2026, 12, 10), "kerst");

        var fout = Assert.Throws<ArgumentException>(() => plaatsing.Herzet(Start, new DateOnly(2026, 11, 30)));

        Assert.Contains("1 verrijking buiten", fout.Message);
    }

    [Fact]
    public void De_periode_verruimen_mag_altijd()
    {
        var plaatsing = Plaatsing();
        plaatsing.VoegVerrijkingToe(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 20), "bouwen");

        var verwijderd = plaatsing.Herzet(new DateOnly(2026, 8, 24), new DateOnly(2027, 6, 30));

        Assert.Equal(0, verwijderd);
        Assert.Equal(new DateOnly(2026, 8, 24), plaatsing.Van);
        Assert.Equal(new DateOnly(2027, 6, 30), plaatsing.Tot);
        Assert.Single(plaatsing.Verrijkingen);
    }

    [Fact]
    public void De_periode_inkorten_neemt_de_uurroosterrijen_erbuiten_mee_en_zegt_hoeveel()
    {
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), HalfTwee, TweeUurTwintig);
        plaatsing.PlanIn(new DateOnly(2026, 11, 2), HalfTwee, TweeUurTwintig);
        plaatsing.PlanIn(new DateOnly(2026, 11, 3), HalfTwee, TweeUurTwintig);

        // Unlike a verrijking, an appearance does not block the move: it is generated rather than written, so
        // dropping it costs the teacher no text. It is REPORTED rather than dropped quietly, which is the whole
        // reason this verb returns a number.
        var verwijderd = plaatsing.Herzet(Start, new DateOnly(2026, 9, 30));

        Assert.Equal(2, verwijderd);
        Assert.Single(plaatsing.Momenten);
        Assert.Equal(new DateOnly(2026, 9, 7), plaatsing.Momenten[0].Datum);
    }

    [Fact]
    public void Overlapt_kijkt_naar_gedeelde_dagen_en_niet_naar_aansluiten()
    {
        var plaatsing = Plaatsing();

        Assert.True(plaatsing.Overlapt(new DateOnly(2026, 12, 18), new DateOnly(2027, 2, 1)));
        Assert.False(plaatsing.Overlapt(new DateOnly(2026, 12, 19), new DateOnly(2027, 2, 1)));
    }
}
