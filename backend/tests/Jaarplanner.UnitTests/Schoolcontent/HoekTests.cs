using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// The <see cref="Hoek"/> invariants (owner, meeting 2026-08-30).
/// <para>
/// <b>The one that carries the feature is <c>Een_kopie_staat_los_van_het_origineel</c>.</b> The owner asked for a
/// button that takes over another class's corners, and the whole question that button raises is whether the second
/// teacher then owns her list or is editing the first teacher's. A copy that shared a row would mean a rename in K3B
/// silently rewrote K3A's classroom.
/// </para>
/// </summary>
public sealed class HoekTests
{
    [Fact]
    public void Een_hoek_hoort_bij_een_klas_en_draagt_een_naam()
    {
        var klasId = Guid.NewGuid();

        var hoek = new Hoek(klasId, "boekenhoek", "vaste kast met prentenboeken");

        Assert.Equal(klasId, hoek.KlasId);
        Assert.Equal("boekenhoek", hoek.Naam);
        Assert.Equal("vaste kast met prentenboeken", hoek.Omschrijving);
        Assert.NotEqual(Guid.Empty, hoek.Id);
    }

    [Fact]
    public void Een_hoek_zonder_klas_bestaat_niet()
    {
        // A hoek is furniture in a room. Without a room there is nothing for it to be in, so this is structural
        // rather than a validation nicety.
        Assert.Throws<ArgumentException>(() => new Hoek(Guid.Empty, "boekenhoek"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Een_hoek_zonder_naam_bestaat_niet(string naam)
    {
        Assert.Throws<ArgumentException>(() => new Hoek(Guid.NewGuid(), naam));
    }

    [Fact]
    public void Namen_en_omschrijvingen_worden_getrimd_en_een_lege_omschrijving_wordt_null()
    {
        var hoek = new Hoek(Guid.NewGuid(), "  bouwhoek  ", "   ");

        Assert.Equal("bouwhoek", hoek.Naam);
        Assert.Null(hoek.Omschrijving);
    }

    [Fact]
    public void Een_hoek_kan_hernoemd_en_herbeschreven_worden()
    {
        var hoek = new Hoek(Guid.NewGuid(), "boekenhoek");

        hoek.Wijzig("leeshoek", "met het nieuwe zitzakje");

        Assert.Equal("leeshoek", hoek.Naam);
        Assert.Equal("met het nieuwe zitzakje", hoek.Omschrijving);
    }

    [Fact]
    public void Een_kopie_staat_los_van_het_origineel()
    {
        var k3a = Guid.NewGuid();
        var k3b = Guid.NewGuid();
        var origineel = new Hoek(k3a, "boekenhoek", "vaste kast");

        var kopie = origineel.KopieerNaar(k3b);

        // Same content, different identity, different room.
        Assert.Equal("boekenhoek", kopie.Naam);
        Assert.Equal("vaste kast", kopie.Omschrijving);
        Assert.Equal(k3b, kopie.KlasId);
        Assert.NotEqual(origineel.Id, kopie.Id);

        // And now the point: editing the copy leaves the original alone. If these ever shared a row this assertion
        // is the one that fails, which is why it is here rather than a comment saying they do not.
        kopie.Wijzig("leeshoek", null);
        Assert.Equal("boekenhoek", origineel.Naam);
        Assert.Equal("vaste kast", origineel.Omschrijving);
        Assert.Equal(k3a, origineel.KlasId);
    }
}
