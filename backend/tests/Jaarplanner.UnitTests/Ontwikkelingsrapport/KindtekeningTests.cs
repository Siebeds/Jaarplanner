using Jaarplanner.Domain.Ontwikkelingsrapport;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// The kindtekening of a report (FB-005, R10): one per report, a new version on every replacement, and only a real image
/// in one of the two formats.
/// </summary>
public sealed class KindtekeningTests
{
    private static readonly Guid Rapport = Guid.NewGuid();

    [Fact]
    public void Een_tekening_hoort_bij_een_rapport()
    {
        Assert.Throws<ArgumentException>(() => new Kindtekening(Guid.Empty, Beeldformaat.Jpeg, 10, 10, [1]));
    }

    [Fact]
    public void Vervangen_geeft_een_nieuwe_versie_en_het_nieuwe_beeld()
    {
        var tekening = new Kindtekening(Rapport, Beeldformaat.Jpeg, 40, 20, [1, 2, 3]);
        var eerste = tekening.Versie;

        tekening.Vervang(Beeldformaat.Png, 20, 40, [4, 5]);

        Assert.NotEqual(eerste, tekening.Versie);
        Assert.Equal((Beeldformaat.Png, 20, 40, "image/png"), (tekening.Formaat, tekening.Breedte, tekening.Hoogte, tekening.MediaType));
        Assert.Equal([4, 5], tekening.Inhoud);
        Assert.Equal(Rapport, tekening.OntwikkelingsrapportId);
    }

    [Fact]
    public void Een_leeg_beeld_of_een_beeld_zonder_maten_wordt_geweigerd()
    {
        Assert.Throws<ArgumentException>(() => new Kindtekening(Rapport, Beeldformaat.Jpeg, 10, 10, []));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Kindtekening(Rapport, Beeldformaat.Jpeg, 0, 10, [1]));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Kindtekening(Rapport, Beeldformaat.Jpeg, 10, -1, [1]));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Kindtekening(Rapport, (Beeldformaat)7, 10, 10, [1]));
    }

    [Fact]
    public void Een_JPEG_heeft_het_mediatype_van_een_JPEG()
    {
        Assert.Equal("image/jpeg", new Kindtekening(Rapport, Beeldformaat.Jpeg, 1, 1, [1]).MediaType);
    }
}
