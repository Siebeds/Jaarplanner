using Jaarplanner.Domain.Toegang;

namespace Jaarplanner.UnitTests.Toegang;

/// <summary>The two link rows the rights are read from (E6-02, ADR-0030 R5, R15): what they refuse at construction.</summary>
public sealed class KlastoewijzingEnAanstellingTests
{
    [Fact]
    public void Een_klastoewijzing_verbindt_een_gebruiker_met_een_klas()
    {
        var gebruiker = Guid.NewGuid();
        var klas = Guid.NewGuid();

        var toewijzing = new Klastoewijzing(gebruiker, klas);

        Assert.Equal(gebruiker, toewijzing.GebruikerId);
        Assert.Equal(klas, toewijzing.KlasId);
        Assert.NotEqual(Guid.Empty, toewijzing.Id);
    }

    [Fact]
    public void Een_klastoewijzing_zonder_gebruiker_of_klas_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() => new Klastoewijzing(Guid.Empty, Guid.NewGuid()));
        Assert.Throws<ArgumentException>(() => new Klastoewijzing(Guid.NewGuid(), Guid.Empty));
    }

    [Fact]
    public void Een_aanstelling_bewaart_de_jaarfase_getrimd()
    {
        var aanstelling = new Hoofdleerkrachtaanstelling(Guid.NewGuid(), Guid.NewGuid(), " K3 ");

        Assert.Equal("K3", aanstelling.Jaarfase);
        Assert.NotEqual(Guid.Empty, aanstelling.Id);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("L7")]
    [InlineData("3K")]
    [InlineData("F1")]
    public void Een_aanstelling_voor_een_onbekende_jaarfase_wordt_geweigerd(string jaarfase) =>
        Assert.Throws<ArgumentException>(() => new Hoofdleerkrachtaanstelling(Guid.NewGuid(), Guid.NewGuid(), jaarfase));

    [Fact]
    public void Een_aanstelling_zonder_gebruiker_of_schooljaar_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() => new Hoofdleerkrachtaanstelling(Guid.Empty, Guid.NewGuid(), "K3"));
        Assert.Throws<ArgumentException>(() => new Hoofdleerkrachtaanstelling(Guid.NewGuid(), Guid.Empty, "K3"));
    }
}
