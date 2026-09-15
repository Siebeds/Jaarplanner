using Jaarplanner.Application.Toegang;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>
/// The one entry point for a leeftijd that did not come from the database (E6-02 slice 1, fix rounds 1 and 2), against
/// fixed expectations. That it agrees with the subthema write's own validation is pinned against the real service in
/// <c>Schoolcontent.SubthemaLeeftijdInvoerTests</c>.
/// </summary>
public sealed class LeeftijdsinhoudTests
{
    [Theory]
    [InlineData("K3", "K3")]
    [InlineData(" K3", "K3")]
    [InlineData("L2 ", "L2")]
    [InlineData("  JK  ", "JK")]
    public void Een_geldige_leeftijd_wordt_getrimd_zoals_de_schrijfactie_ze_bewaart(string invoer, string verwacht) =>
        Assert.Equal(new Leeftijdsinhoud(verwacht), Leeftijdsinhoud.UitInvoer(invoer));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("L7")]
    [InlineData("3K")]
    [InlineData("k3")]
    [InlineData("F1")]
    public void Wat_geen_van_de_negen_codes_is_is_geen_leeftijdsinhoud(string? invoer) =>
        Assert.Null(Leeftijdsinhoud.UitInvoer(invoer));

    [Fact]
    public void Een_hoofdleerkracht_van_K3_mag_op_een_leeftijd_die_met_een_spatie_binnenkwam()
    {
        // The case the audit named: " K3" passes the service's validation, so it must also pass the rights check.
        var hoofdleerkracht = new Rechten(Guid.NewGuid(), false, false, ["K3"], [], []);

        var bron = Leeftijdsinhoud.UitInvoer(" K3");

        Assert.True(Rechtenmatrix.StaatToe(hoofdleerkracht, Rechtenmatrix.SubthemaBeheren, bron));
    }
}
