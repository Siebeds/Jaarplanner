using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The <see cref="Jaarplan"/> aggregate and its <see cref="Themaplaatsing"/> invariants (Art. IX.3, ADR-0049): a
/// placement carries its own days, no two placements share a day, and <c>vergrendeld</c> still marks what a
/// regeneration may not discard.
/// </summary>
public sealed class JaarplanTests
{
    private static readonly DateOnly SepVan = new(2026, 9, 1);
    private static readonly DateOnly SepTot = new(2026, 9, 18);
    private static readonly DateOnly OktVan = new(2026, 10, 5);
    private static readonly DateOnly OktTot = new(2026, 10, 23);

    [Fact]
    public void Een_plaatsing_bewaart_haar_eigen_dagen()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var themaId = Guid.NewGuid();

        var plaatsing = jaarplan.VoegPlaatsingToe(themaId, SepVan, SepTot, KoppelingStatus.Voorgesteld, "past bij de herfst");

        Assert.Equal(themaId, plaatsing.ThemaId);
        Assert.Equal(SepVan, plaatsing.Van);
        Assert.Equal(SepTot, plaatsing.Tot);
        Assert.Equal(jaarplan.Id, plaatsing.JaarplanId);
        Assert.Equal("past bij de herfst", plaatsing.AiMotivatie);
    }

    /// <summary>No block ordinal and no block key survive on the placement (ADR-0049).</summary>
    [Fact]
    public void Themaplaatsing_heeft_geen_periodesleutel_meer()
    {
        var namen = typeof(Themaplaatsing).GetProperties().Select(p => p.Name).ToList();

        Assert.DoesNotContain("BlokStart", namen);
        Assert.DoesNotContain("BlokNiveau", namen);
        Assert.DoesNotContain("Ordinaal", namen);
        Assert.Equal(typeof(DateOnly), typeof(Themaplaatsing).GetProperty("Van")!.PropertyType);
        Assert.Equal(typeof(DateOnly), typeof(Themaplaatsing).GetProperty("Tot")!.PropertyType);
    }

    [Theory]
    [InlineData(2026, 9, 18, 2026, 9, 25)] // shares the last day
    [InlineData(2026, 8, 25, 2026, 9, 1)] // shares the first day
    [InlineData(2026, 9, 7, 2026, 9, 8)] // lies inside
    [InlineData(2026, 8, 1, 2026, 10, 1)] // wraps around
    public void Een_overlappende_plaatsing_wordt_geweigerd(int j1, int m1, int d1, int j2, int m2, int d2)
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Manueel);

        Assert.Throws<InvalidOperationException>(() => jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), new DateOnly(j1, m1, d1), new DateOnly(j2, m2, d2), KoppelingStatus.Manueel));
        Assert.Single(jaarplan.Plaatsingen);
    }

    [Fact]
    public void Hetzelfde_thema_overlappend_wordt_ook_geweigerd_maar_later_in_het_jaar_mag()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var themaId = Guid.NewGuid();
        jaarplan.VoegPlaatsingToe(themaId, SepVan, SepTot, KoppelingStatus.Manueel);

        Assert.Throws<InvalidOperationException>(() =>
            jaarplan.VoegPlaatsingToe(themaId, SepTot, SepTot.AddDays(3), KoppelingStatus.Manueel));

        jaarplan.VoegPlaatsingToe(themaId, SepTot.AddDays(1), SepTot.AddDays(7), KoppelingStatus.Manueel);
        Assert.Equal(2, jaarplan.Plaatsingen.Count);
    }

    [Fact]
    public void Overlappend_vindt_de_plaatsing_in_de_weg_en_slaat_de_uitgezonderde_over()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var sep = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Manueel);
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), OktVan, OktTot, KoppelingStatus.Manueel);

        Assert.Same(sep, jaarplan.Overlappend(SepVan, SepVan));
        Assert.Null(jaarplan.Overlappend(SepVan, SepVan, sep.Id));
        Assert.Null(jaarplan.Overlappend(SepTot.AddDays(1), OktVan.AddDays(-1)));
    }

    [Fact]
    public void Herplannen_geeft_nieuwe_dagen_maakt_manueel_en_wist_de_motivatie()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var plaatsing = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Voorgesteld, "herfst");

        // Overlapping its own old days is fine.
        jaarplan.HerplanPlaatsing(plaatsing, SepVan.AddDays(7), SepTot.AddDays(7));

        Assert.Equal(SepVan.AddDays(7), plaatsing.Van);
        Assert.Equal(SepTot.AddDays(7), plaatsing.Tot);
        Assert.Equal(KoppelingStatus.Manueel, plaatsing.Status);
        Assert.Null(plaatsing.AiMotivatie);
    }

    [Fact]
    public void Herplannen_op_een_andere_plaatsing_wordt_geweigerd_en_verandert_niets()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var plaatsing = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Voorgesteld, "herfst");
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), OktVan, OktTot, KoppelingStatus.Manueel);

        Assert.Throws<InvalidOperationException>(() => jaarplan.HerplanPlaatsing(plaatsing, SepVan, OktVan));

        Assert.Equal(SepTot, plaatsing.Tot);
        Assert.Equal(KoppelingStatus.Voorgesteld, plaatsing.Status);
    }

    [Fact]
    public void Een_plaatsing_van_een_ander_jaarplan_herplannen_wordt_geweigerd()
    {
        var ander = new Jaarplan(Guid.NewGuid());
        var vreemd = ander.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Manueel);

        Assert.Throws<InvalidOperationException>(() =>
            new Jaarplan(Guid.NewGuid()).HerplanPlaatsing(vreemd, OktVan, OktTot));
    }

    [Fact]
    public void Plaatsingen_zijn_chronologisch_op_hun_eerste_dag()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), OktVan, OktTot, KoppelingStatus.Voorgesteld);
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Voorgesteld);

        Assert.Equal([SepVan, OktVan], jaarplan.Plaatsingen.Select(p => p.Van));
    }

    [Fact]
    public void Alleen_een_onaangeroerd_en_niet_vergrendeld_voorstel_is_vervangbaar()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());

        var voorstel = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Voorgesteld);
        var vergrendeld = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), OktVan, OktTot, KoppelingStatus.Voorgesteld);
        vergrendeld.StelVergrendelingIn(true);
        var aanvaard = jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), new DateOnly(2026, 11, 9), new DateOnly(2026, 11, 20), KoppelingStatus.Voorgesteld);
        aanvaard.WijzigStatus(KoppelingStatus.Aanvaard);
        var manueel = jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), new DateOnly(2027, 1, 4), new DateOnly(2027, 1, 8), KoppelingStatus.Manueel);

        Assert.True(voorstel.IsVervangbaar);
        Assert.False(vergrendeld.IsVervangbaar);
        Assert.False(aanvaard.IsVervangbaar);
        Assert.False(manueel.IsVervangbaar);

        Assert.Equal(
            [vergrendeld.Id, aanvaard.Id, manueel.Id],
            jaarplan.MenselijkBeslotenPlaatsingen.Select(p => p.Id).OrderBy(id => jaarplan.VindPlaatsing(id)!.Van));
    }

    [Fact]
    public void Verwijderen_neemt_enkel_die_plaatsing_weg_en_weigert_een_vreemde()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var eerste = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Manueel);
        var tweede = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), OktVan, OktTot, KoppelingStatus.Manueel);

        jaarplan.VerwijderPlaatsing(eerste);

        Assert.Equal([tweede.Id], jaarplan.Plaatsingen.Select(p => p.Id));
        Assert.Throws<InvalidOperationException>(() => jaarplan.VerwijderPlaatsing(eerste));
    }

    [Fact]
    public void Vergrendeling_is_standaard_uit_en_omschakelbaar()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var plaatsing = jaarplan.VoegPlaatsingToe(Guid.NewGuid(), SepVan, SepTot, KoppelingStatus.Voorgesteld);

        Assert.False(plaatsing.Vergrendeld);
        plaatsing.StelVergrendelingIn(true);
        Assert.True(plaatsing.Vergrendeld);
        plaatsing.StelVergrendelingIn(false);
        Assert.False(plaatsing.Vergrendeld);
    }

    [Fact]
    public void Een_jaarplan_vereist_een_klas() =>
        Assert.Throws<ArgumentException>(() => new Jaarplan(Guid.Empty));

    [Fact]
    public void Een_plaatsing_vereist_een_geldige_status_en_een_einde_niet_voor_het_begin()
    {
        var jaarplanId = Guid.NewGuid();
        var themaId = Guid.NewGuid();

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new Themaplaatsing(jaarplanId, themaId, SepVan, SepTot, (KoppelingStatus)99));
        Assert.Throws<ArgumentException>(() =>
            new Themaplaatsing(jaarplanId, themaId, SepTot, SepVan, KoppelingStatus.Manueel));
        Assert.Throws<ArgumentException>(() =>
            new Themaplaatsing(Guid.Empty, themaId, SepVan, SepTot, KoppelingStatus.Manueel));

        // A one-day placement is legal.
        var eenDag = new Themaplaatsing(jaarplanId, themaId, SepVan, SepVan, KoppelingStatus.Manueel);
        Assert.Equal(eenDag.Van, eenDag.Tot);
    }
}
