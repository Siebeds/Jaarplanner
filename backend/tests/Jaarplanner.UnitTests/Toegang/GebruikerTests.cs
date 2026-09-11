using Jaarplanner.Domain.Toegang;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>The invitation and its one-time binding (E6-01, ADR-0031 decision 3).</summary>
public sealed class GebruikerTests
{
    private static readonly Guid Tenant = Guid.Parse("11111111-2222-3333-4444-555555555555");

    [Fact]
    public void Het_adres_wordt_genormaliseerd_bewaard()
    {
        var gebruiker = new Gebruiker("  An.Peeters@School.BE ", "An", isDirectie: false);

        Assert.Equal("an.peeters@school.be", gebruiker.Email);
    }

    [Fact]
    public void Zonder_naam_toont_een_uitnodiging_het_adres()
    {
        var gebruiker = new Gebruiker("directie@school.be", "  ", isDirectie: true);

        Assert.Equal("directie@school.be", gebruiker.Naam);
        Assert.True(gebruiker.IsDirectie);
    }

    [Theory]
    [InlineData("")]
    [InlineData("geen-apenstaart")]
    [InlineData("@school.be")]
    [InlineData("an@")]
    [InlineData("an@b@school.be")]
    [InlineData("an peeters@school.be")]
    public void Een_ongeldig_adres_wordt_geweigerd(string adres) =>
        Assert.Throws<ArgumentException>(() => new Gebruiker(adres, "An", isDirectie: false));

    [Fact]
    public void Een_uitnodiging_is_niet_gekoppeld_tot_de_eerste_aanmelding()
    {
        var gebruiker = new Gebruiker("an@school.be", "An", isDirectie: false);

        Assert.False(gebruiker.IsGekoppeld);
        Assert.Null(gebruiker.EntraObjectId);
    }

    [Fact]
    public void De_eerste_aanmelding_koppelt_en_neemt_de_naam_uit_Entra()
    {
        var gebruiker = new Gebruiker("an@school.be", "an@school.be", isDirectie: false);
        var objectId = Guid.NewGuid();

        gebruiker.KoppelAanEntra(Tenant, objectId, "An Peeters");

        Assert.True(gebruiker.IsGekoppeld);
        Assert.Equal(Tenant, gebruiker.EntraTenantId);
        Assert.Equal(objectId, gebruiker.EntraObjectId);
        Assert.Equal("An Peeters", gebruiker.Naam);
    }

    [Fact]
    public void Een_koppeling_is_definitief()
    {
        var gebruiker = new Gebruiker("an@school.be", "An", isDirectie: false);
        gebruiker.KoppelAanEntra(Tenant, Guid.NewGuid(), naam: null);

        Assert.Throws<InvalidOperationException>(() => gebruiker.KoppelAanEntra(Tenant, Guid.NewGuid(), naam: null));
    }

    [Fact]
    public void Een_koppeling_zonder_tenant_of_object_wordt_geweigerd()
    {
        var gebruiker = new Gebruiker("an@school.be", "An", isDirectie: false);

        Assert.Throws<ArgumentException>(() => gebruiker.KoppelAanEntra(Guid.Empty, Guid.NewGuid(), naam: null));
        Assert.Throws<ArgumentException>(() => gebruiker.KoppelAanEntra(Tenant, Guid.Empty, naam: null));
        Assert.False(gebruiker.IsGekoppeld);
    }
}
