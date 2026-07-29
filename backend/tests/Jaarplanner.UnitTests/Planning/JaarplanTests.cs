using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// E3-01: the <see cref="Jaarplan"/> aggregate and its <see cref="Themaplaatsing"/> invariants (Art. IX.3,
/// Art. IV.1/IV.2). These pin the two properties the rest of E3 and E4 depend on: a placement keys on the block's
/// <b>start date</b>, and <c>vergrendeld</c> actually excludes a placement from regeneration.
/// </summary>
public sealed class JaarplanTests
{
    private static readonly DateOnly Blok1 = new(2026, 9, 1);
    private static readonly DateOnly Blok2 = new(2026, 10, 6);

    [Fact]
    public void Een_plaatsing_bewaart_de_startdatum_en_het_niveau_als_sleutel()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var themaId = Guid.NewGuid();

        var plaatsing = jaarplan.VoegPlaatsingToe(
            themaId, Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld, "past bij de herfst");

        Assert.Equal(themaId, plaatsing.ThemaId);
        Assert.Equal(Blok1, plaatsing.BlokStart);
        Assert.Equal(Planningsblokniveau.Themaperiode, plaatsing.BlokNiveau);
        Assert.Equal("past bij de herfst", plaatsing.AiMotivatie);
    }

    /// <summary>
    /// <b>The structural guarantee behind ADR-0020 §3.</b> No member of <see cref="Themaplaatsing"/> carries a
    /// block ordinal/position, so there is no way to persist one even by accident. If someone later adds one, this
    /// fails — which is the point: the ordinal shifts when the school edits a vakantie, so a placement keyed on it
    /// would silently relocate a teacher's thema.
    /// </summary>
    [Fact]
    public void Themaplaatsing_heeft_geen_ordinaal_of_kalendereenheid()
    {
        var namen = typeof(Themaplaatsing)
            .GetProperties()
            .Select(p => p.Name)
            .ToList();

        Assert.DoesNotContain("Ordinaal", namen);
        Assert.DoesNotContain("BlokOrdinaal", namen);
        Assert.DoesNotContain("Maand", namen);
        Assert.DoesNotContain("Week", namen);

        // And the key it does carry is a date.
        Assert.Contains("BlokStart", namen);
        Assert.Equal(typeof(DateOnly), typeof(Themaplaatsing).GetProperty("BlokStart")!.PropertyType);
    }

    [Fact]
    public void Een_thema_kan_niet_twee_keer_in_hetzelfde_blok()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var themaId = Guid.NewGuid();
        jaarplan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld);

        Assert.Throws<InvalidOperationException>(() =>
            jaarplan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld));
    }

    /// <summary>Art. IX.3 says a block holds "a list of thema's" — several thema's in one period is legitimate.</summary>
    [Fact]
    public void Meerdere_themas_in_hetzelfde_blok_zijn_toegestaan()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());

        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld);
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld);

        Assert.Equal(2, jaarplan.Plaatsingen.Count);
    }

    /// <summary>
    /// The same thema on the fine tier is a different placement — the key is (niveau, startdatum), and the two
    /// tiers nest (ADR-0020 §2), so a thema in a themaperiode and in one of its subthemaperioden do not collide.
    /// </summary>
    [Fact]
    public void Hetzelfde_thema_op_een_ander_niveau_is_een_andere_plaatsing()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var themaId = Guid.NewGuid();

        jaarplan.VoegPlaatsingToe(themaId, Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld);
        jaarplan.VoegPlaatsingToe(themaId, Planningsblokniveau.Subthemaperiode, Blok1, KoppelingStatus.Voorgesteld);

        Assert.Equal(2, jaarplan.Plaatsingen.Count);
    }

    [Fact]
    public void Plaatsingen_zijn_chronologisch_op_de_bewaarde_sleutel()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), Planningsblokniveau.Themaperiode, Blok2, KoppelingStatus.Voorgesteld);
        jaarplan.VoegPlaatsingToe(Guid.NewGuid(), Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld);

        Assert.Equal([Blok1, Blok2], jaarplan.Plaatsingen.Select(p => p.BlokStart));
    }

    /// <summary>
    /// <b>What <c>vergrendeld</c> is for</b> (Art. IX.3, consumed by E4). A regeneration may discard an untouched
    /// proposal, but never a locked one and never one the teacher decided on.
    /// </summary>
    [Fact]
    public void Alleen_een_onaangeroerd_en_niet_vergrendeld_voorstel_is_vervangbaar()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());

        var voorstel = jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld);
        var vergrendeld = jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), Planningsblokniveau.Themaperiode, Blok2, KoppelingStatus.Voorgesteld);
        vergrendeld.StelVergrendelingIn(true);
        var aanvaard = jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), Planningsblokniveau.Themaperiode, new DateOnly(2026, 11, 9), KoppelingStatus.Voorgesteld);
        aanvaard.WijzigStatus(KoppelingStatus.Aanvaard);
        var manueel = jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), Planningsblokniveau.Themaperiode, new DateOnly(2027, 1, 4), KoppelingStatus.Manueel);

        Assert.True(voorstel.IsVervangbaar);
        Assert.False(vergrendeld.IsVervangbaar);
        Assert.False(aanvaard.IsVervangbaar);
        Assert.False(manueel.IsVervangbaar);

        var verwijderd = jaarplan.VerwijderVervangbarePlaatsingen();

        Assert.Equal([voorstel.Id], verwijderd.Select(p => p.Id));
        Assert.Equal(
            [vergrendeld.Id, aanvaard.Id, manueel.Id],
            jaarplan.Plaatsingen.Select(p => p.Id).OrderBy(id => jaarplan.VindPlaatsing(id)!.BlokStart));
    }

    [Fact]
    public void Vergrendeling_is_standaard_uit_en_omschakelbaar()
    {
        var jaarplan = new Jaarplan(Guid.NewGuid());
        var plaatsing = jaarplan.VoegPlaatsingToe(
            Guid.NewGuid(), Planningsblokniveau.Themaperiode, Blok1, KoppelingStatus.Voorgesteld);

        Assert.False(plaatsing.Vergrendeld);

        plaatsing.StelVergrendelingIn(true);
        Assert.True(plaatsing.Vergrendeld);

        plaatsing.StelVergrendelingIn(false);
        Assert.False(plaatsing.Vergrendeld);
    }

    [Fact]
    public void Een_jaarplan_vereist_een_klas()
    {
        Assert.Throws<ArgumentException>(() => new Jaarplan(Guid.Empty));
    }

    [Fact]
    public void Een_plaatsing_vereist_een_geldig_niveau_en_status()
    {
        var jaarplanId = Guid.NewGuid();
        var themaId = Guid.NewGuid();

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new Themaplaatsing(jaarplanId, themaId, (Planningsblokniveau)99, Blok1, KoppelingStatus.Voorgesteld));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new Themaplaatsing(jaarplanId, themaId, Planningsblokniveau.Themaperiode, Blok1, (KoppelingStatus)99));
    }
}
