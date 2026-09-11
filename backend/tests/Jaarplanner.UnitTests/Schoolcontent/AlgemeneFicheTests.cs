using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// <see cref="AlgemeneFiche"/> (owner, 2026-09-11). The rule worth pinning is that a fiche can only ever carry a
/// <c>manueel</c> link: its links count for dekking, and the dekking filter trusts the status.
/// </summary>
public sealed class AlgemeneFicheTests
{
    private static readonly Guid KlasId = Guid.NewGuid();

    [Fact]
    public void Een_fiche_bewaart_naam_en_omschrijving_getrimd()
    {
        var fiche = new AlgemeneFiche(KlasId, "  turnen ", "  in de zaal ");

        Assert.Equal("turnen", fiche.Naam);
        Assert.Equal("in de zaal", fiche.Omschrijving);
        Assert.Empty(fiche.Doelkoppelingen);
    }

    [Fact]
    public void Een_fiche_zonder_naam_of_klas_bestaat_niet()
    {
        Assert.Throws<ArgumentException>(() => new AlgemeneFiche(KlasId, "  "));
        Assert.Throws<ArgumentException>(() => new AlgemeneFiche(Guid.Empty, "onthaal"));
    }

    [Fact]
    public void Een_koppeling_is_altijd_manueel()
    {
        var fiche = new AlgemeneFiche(KlasId, "turnen");

        var koppeling = fiche.KoppelAanDoel(" LO-K3-01 ");

        Assert.Equal(KoppelingStatus.Manueel, koppeling.Status);
        Assert.Equal("LO-K3-01", koppeling.LeerplandoelCode);
        Assert.Null(koppeling.AiMotivatie);
    }

    [Fact]
    public void Hetzelfde_doel_twee_keer_koppelen_wordt_geweigerd()
    {
        var fiche = new AlgemeneFiche(KlasId, "turnen");
        fiche.KoppelAanDoel("LO-K3-01");

        var fout = Assert.Throws<ArgumentException>(() => fiche.KoppelAanDoel("LO-K3-01"));

        Assert.Contains("al gekoppeld", fout.Message);
        Assert.Single(fiche.Doelkoppelingen);
    }

    [Fact]
    public void Ontkoppelen_verwijdert_alleen_die_koppeling()
    {
        var fiche = new AlgemeneFiche(KlasId, "turnen");
        var eerste = fiche.KoppelAanDoel("LO-K3-01");
        fiche.KoppelAanDoel("LO-K3-02");

        Assert.True(fiche.Ontkoppel(eerste.Id));
        Assert.False(fiche.Ontkoppel(eerste.Id));
        Assert.Equal("LO-K3-02", Assert.Single(fiche.Doelkoppelingen).LeerplandoelCode);
    }
}
