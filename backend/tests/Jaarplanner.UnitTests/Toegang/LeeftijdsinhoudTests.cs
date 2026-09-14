using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>
/// The one entry point for a leeftijd that did not come from the database (E6-02 slice 1, fix round 1). It must accept
/// exactly what <see cref="Jaarfasen.WatIsErMisMet"/> accepts, in the form the write stores, so a rights check on a
/// request body asks the same question as a rights check on a stored subthema.
/// </summary>
public sealed class LeeftijdsinhoudTests
{
    [Theory]
    [InlineData("K3", "K3")]
    [InlineData(" K3", "K3")]
    [InlineData("L2 ", "L2")]
    [InlineData("  JK  ", "JK")]
    public void Een_geldige_leeftijd_wordt_getrimd_zoals_de_schrijfactie_ze_bewaart(string invoer, string verwacht)
    {
        Assert.Null(Jaarfasen.WatIsErMisMet(invoer));
        Assert.Equal(new Leeftijdsinhoud(verwacht), Leeftijdsinhoud.UitInvoer(invoer));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("L7")]
    [InlineData("3K")]
    [InlineData("k3")]
    [InlineData("F1")]
    public void Wat_de_validatie_weigert_is_geen_leeftijdsinhoud(string? invoer)
    {
        Assert.NotNull(Jaarfasen.WatIsErMisMet(invoer));
        Assert.Null(Leeftijdsinhoud.UitInvoer(invoer));
    }

    [Fact]
    public void Een_hoofdleerkracht_van_K3_mag_op_een_leeftijd_die_met_een_spatie_binnenkwam()
    {
        // The case the audit named: " K3" passes the service's validation, so it must also pass the rights check.
        var hoofdleerkracht = new Rechten(Guid.NewGuid(), false, false, ["K3"], [], []);

        var bron = Leeftijdsinhoud.UitInvoer(" K3");

        Assert.True(Rechtenmatrix.StaatToe(hoofdleerkracht, Rechtenmatrix.SubthemaBeheren, bron));
    }
}
