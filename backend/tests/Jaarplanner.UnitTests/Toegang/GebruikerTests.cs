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

    // --- The rights on the gebruiker itself (E6-02, ADR-0030 R4, R16; ADR-0031 decision 7). ---

    [Fact]
    public void Een_nieuwe_gebruiker_heeft_geen_themabeheer()
    {
        Assert.False(new Gebruiker("an@school.be", "An", isDirectie: false).HeeftThemabeheer);
    }

    [Fact]
    public void Themabeheer_wordt_gegeven_en_afgenomen()
    {
        var gebruiker = new Gebruiker("an@school.be", "An", isDirectie: false);

        gebruiker.GeefThemabeheer();
        gebruiker.GeefThemabeheer();
        Assert.True(gebruiker.HeeftThemabeheer);

        gebruiker.NeemThemabeheerAf();
        Assert.False(gebruiker.HeeftThemabeheer);
    }

    [Fact]
    public void Directie_kan_het_directierecht_aan_iemand_anders_geven()
    {
        var ict = new Gebruiker("ict@school.be", "ICT", isDirectie: false);

        ict.GeefDirectierecht();

        Assert.True(ict.IsDirectie);
    }

    [Fact]
    public void De_laatste_directie_verliest_het_directierecht_niet()
    {
        var directie = new Gebruiker("directie@school.be", "Directie", isDirectie: true);

        Assert.Throws<InvalidOperationException>(() => directie.NeemDirectierechtAf(aantalAndereDirectieleden: 0));
        Assert.True(directie.IsDirectie);
    }

    [Fact]
    public void Met_een_andere_directie_kan_het_directierecht_afgenomen_worden()
    {
        var directie = new Gebruiker("directie@school.be", "Directie", isDirectie: true);

        directie.NeemDirectierechtAf(aantalAndereDirectieleden: 1);

        Assert.False(directie.IsDirectie);
    }

    [Fact]
    public void Afnemen_bij_wie_geen_directie_is_verandert_niets()
    {
        var an = new Gebruiker("an@school.be", "An", isDirectie: false);

        an.NeemDirectierechtAf(aantalAndereDirectieleden: 0);

        Assert.False(an.IsDirectie);
    }

    [Fact]
    public void De_laatste_directie_is_niet_verwijderbaar_een_leerkracht_wel()
    {
        var directie = new Gebruiker("directie@school.be", "Directie", isDirectie: true);
        var an = new Gebruiker("an@school.be", "An", isDirectie: false);

        Assert.Throws<InvalidOperationException>(() => directie.BevestigVerwijderbaar(aantalAndereDirectieleden: 0));
        directie.BevestigVerwijderbaar(aantalAndereDirectieleden: 1);
        an.BevestigVerwijderbaar(aantalAndereDirectieleden: 0);
    }
}
