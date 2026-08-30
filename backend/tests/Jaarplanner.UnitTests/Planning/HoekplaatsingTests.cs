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

    private static Hoekplaatsing Plaatsing() => new(Guid.NewGuid(), Guid.NewGuid(), Start, Eind);

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
    public void Geen_momenten_betekent_niet_in_het_uurrooster_en_is_de_normale_toestand()
    {
        var plaatsing = Plaatsing();

        // The teacher answered "no" to the uurrooster question. The corner still runs over its days; it just
        // claims no hour, so there is nothing to schedule and nothing missing.
        Assert.Empty(plaatsing.Momenten);
        Assert.True(plaatsing.Omvat(new DateOnly(2026, 10, 5)));
    }

    [Fact]
    public void Elke_dag_van_de_periode_krijgt_zijn_eigen_rij()
    {
        var plaatsing = Plaatsing();

        // What the service does when she says yes: one row per teaching day. Fifteen for a three-week placement,
        // which is what the owner asked for, and each one exists so it can be moved on its own.
        foreach (var dag in new[] { new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 8), new DateOnly(2026, 9, 9) })
        {
            plaatsing.PlanIn(dag, 2);
        }

        Assert.Equal(3, plaatsing.Momenten.Count);
        Assert.All(plaatsing.Momenten, m => Assert.Equal(2, m.Volgorde));
    }

    [Fact]
    public void Een_losse_dag_kan_naar_een_ander_lesuur()
    {
        // THE REQUIREMENT THIS ENTITY EXISTS FOR (owner, 2026-08-30): "als leerkracht wil ik flexibel kunnen
        // zijn". The hoek runs all fortnight at the third lesuur, and on this one Wednesday it happens at the
        // fifth. A derived appearance could not express that, which is why the fifteen rows are stored.
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), 2);
        var woensdag = plaatsing.PlanIn(new DateOnly(2026, 9, 9), 2);

        Assert.True(plaatsing.VerplaatsMoment(woensdag.Id, new DateOnly(2026, 9, 9), 4));

        Assert.Equal(4, plaatsing.Momenten.Single(m => m.Id == woensdag.Id).Volgorde);
        // And the other day did not move with it.
        Assert.Equal(2, plaatsing.Momenten.Single(m => m.Id != woensdag.Id).Volgorde);
    }

    [Fact]
    public void Een_losse_dag_kan_weg_zonder_de_rest_mee_te_nemen()
    {
        var plaatsing = Plaatsing();
        var maandag = plaatsing.PlanIn(new DateOnly(2026, 9, 7), 2);
        plaatsing.PlanIn(new DateOnly(2026, 9, 8), 2);

        Assert.True(plaatsing.VerwijderMoment(maandag.Id));

        Assert.Single(plaatsing.Momenten);
        Assert.Equal(new DateOnly(2026, 9, 8), plaatsing.Momenten[0].Datum);
    }

    [Fact]
    public void Dezelfde_hoek_twee_keer_op_hetzelfde_lesuur_op_een_dag_betekent_niets()
    {
        var plaatsing = Plaatsing();
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), 2);

        // The one combination that is refused: it is the same row written twice. Two appearances on one day at
        // DIFFERENT hours are fine, and so are two placements of the same hoek on one day.
        Assert.Throws<ArgumentException>(() => plaatsing.PlanIn(new DateOnly(2026, 9, 7), 2));
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), 5);
        Assert.Equal(2, plaatsing.Momenten.Count);
    }

    [Fact]
    public void Een_moment_buiten_de_periode_van_de_hoek_wordt_geweigerd()
    {
        var plaatsing = Plaatsing();

        Assert.Throws<ArgumentException>(() => plaatsing.PlanIn(new DateOnly(2027, 1, 12), 2));

        var moment = plaatsing.PlanIn(new DateOnly(2026, 9, 7), 2);
        Assert.Throws<ArgumentException>(() => plaatsing.VerplaatsMoment(moment.Id, new DateOnly(2027, 1, 12), 2));
    }

    [Fact]
    public void Een_negatief_lesuur_bestaat_niet()
    {
        Assert.Throws<ArgumentException>(() => Plaatsing().PlanIn(new DateOnly(2026, 9, 7), -1));
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
        plaatsing.PlanIn(new DateOnly(2026, 9, 7), 2);
        plaatsing.PlanIn(new DateOnly(2026, 11, 2), 2);
        plaatsing.PlanIn(new DateOnly(2026, 11, 3), 2);

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
