using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// The decree's ordering on <see cref="Minimumdoel"/> (TB-010): leergebied and rubriek come together or not at all, a
/// subrubriek needs a rubriek, and blank levels are no levels. A branch of no tree would have no place in the register.
/// </summary>
public sealed class MinimumdoelOrdeningTests
{
    [Fact]
    public void Een_minimumdoel_draagt_de_ordening_en_de_soort_van_het_decreet()
    {
        var doel = new Minimumdoel(
            "4-1.1.1", "4-", "1.1.1", "De leerlingen kunnen woorden lezen.",
            " Nederlands ", "Lezen", "Vlot en vloeiend lezen", MinimumdoelSoort.TeBereikenIndividueel);

        Assert.Equal("Nederlands", doel.Leergebied);
        Assert.Equal("Lezen", doel.Rubriek);
        Assert.Equal("Vlot en vloeiend lezen", doel.Subrubriek);
        Assert.Equal(MinimumdoelSoort.TeBereikenIndividueel, doel.Soort);
    }

    [Fact]
    public void Zonder_ordening_zijn_de_niveaus_leeg_en_een_blanco_niveau_is_geen_niveau()
    {
        var zonder = new Minimumdoel("K-1.1", "K-", "1.1", "Tekst.");
        var blanco = new Minimumdoel("K-1.2", "K-", "1.2", "Tekst.", " ", "", null);

        Assert.Null(zonder.Leergebied);
        Assert.Null(zonder.Soort);
        Assert.Null(blanco.Leergebied);
        Assert.Null(blanco.Rubriek);
    }

    /// <summary>The column is this wide; a longer name is refused rather than cut, since cutting would change a decreed heading.</summary>
    [Fact]
    public void Een_niveau_breder_dan_de_kolom_wordt_geweigerd()
    {
        var lang = new string('a', Minimumdoel.MaxOrdeningLengte + 1);

        Assert.Throws<ArgumentException>(() => new Minimumdoel("K-1.1", "K-", "1.1", "Tekst.", "Nederlands", lang));
    }

    [Theory]
    [InlineData("Nederlands", null, null)]
    [InlineData(null, "Lezen", null)]
    [InlineData(null, null, "Vlot en vloeiend lezen")]
    [InlineData("Nederlands", null, "Vlot en vloeiend lezen")]
    public void Een_niveau_zonder_het_niveau_erboven_wordt_geweigerd(string? leergebied, string? rubriek, string? subrubriek)
    {
        Assert.Throws<ArgumentException>(() =>
            new Minimumdoel("K-1.1", "K-", "1.1", "Tekst.", leergebied, rubriek, subrubriek));
    }
}
