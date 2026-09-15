using Jaarplanner.Domain.Planning;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// The <see cref="Hoekverrijking"/> itself (FB-020): a text for one hoek and one subthemaperiode. The rules that need
/// the database (one per pair, the hoek in the klas of the window) are in <c>HoekverrijkingServiceTests</c>.
/// </summary>
public sealed class HoekverrijkingTests
{
    [Fact]
    public void Een_verrijking_bewaart_de_hoek_het_venster_en_de_tekst_zonder_randspaties()
    {
        var hoekId = Guid.NewGuid();
        var vensterId = Guid.NewGuid();

        var verrijking = new Hoekverrijking(hoekId, vensterId, "  prentenboeken over de herfst \n");

        Assert.Equal((hoekId, vensterId), (verrijking.HoekId, verrijking.SubthemaplaatsingId));
        Assert.Equal("prentenboeken over de herfst", verrijking.Tekst);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Een_verrijking_zonder_tekst_bestaat_niet(string tekst)
    {
        // The service reads a blank field as "remove it", so a blank reaching the constructor is a programmer error.
        Assert.Throws<ArgumentException>(() => new Hoekverrijking(Guid.NewGuid(), Guid.NewGuid(), tekst));
    }

    [Fact]
    public void Een_verrijking_zonder_hoek_of_venster_bestaat_niet()
    {
        Assert.Throws<ArgumentException>(() => new Hoekverrijking(Guid.Empty, Guid.NewGuid(), "boeken"));
        Assert.Throws<ArgumentException>(() => new Hoekverrijking(Guid.NewGuid(), Guid.Empty, "boeken"));
    }

    [Fact]
    public void Herschrijven_verandert_alleen_de_tekst()
    {
        var verrijking = new Hoekverrijking(Guid.NewGuid(), Guid.NewGuid(), "prentenboeken");
        var (hoek, venster) = (verrijking.HoekId, verrijking.SubthemaplaatsingId);

        verrijking.Wijzig("prentenboeken en bladeren");

        Assert.Equal("prentenboeken en bladeren", verrijking.Tekst);
        Assert.Equal((hoek, venster), (verrijking.HoekId, verrijking.SubthemaplaatsingId));
        Assert.Throws<ArgumentException>(() => verrijking.Wijzig(" "));
        Assert.Equal("prentenboeken en bladeren", verrijking.Tekst);
    }
}
