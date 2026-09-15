using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Ontwikkelingsrapport;
using Jaarplanner.Testhulp;
using SkiaSharp;

namespace Jaarplanner.UnitTests.Ontwikkelingsrapport;

/// <summary>
/// The re-encode of a kindtekening (FB-005, FR-13.5, ADR-0035 §3.6): no metadata of the upload survives, a photo comes
/// out upright, a large one is scaled down, and only a readable JPEG or PNG within the pixel limit is accepted, the limit
/// read from the header before anything is decoded.
/// </summary>
public sealed class SkiaTekeningHerwerkerTests
{
    private static readonly byte[] JpegMarkersMetMetagegevens =
        [0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB, 0xEC, 0xED, 0xEE, 0xEF, 0xFE];

    private readonly SkiaTekeningHerwerker _herwerker = new();

    [Fact]
    public void Een_JPEG_verliest_EXIF_met_GPS_XMP_en_commentaar()
    {
        var bron = Testbeelden.JpegMetMetagegevens();
        Assert.Contains((byte)0xE1, Testbeelden.JpegMarkers(bron));
        Assert.True(Testbeelden.Bevat(bron, Testbeelden.Camera));

        var uit = _herwerker.Herwerk(bron);

        Assert.Equal((Beeldformaat.Jpeg, 40, 20), (uit.Formaat, uit.Breedte, uit.Hoogte));
        var markers = Testbeelden.JpegMarkers(uit.Inhoud);
        Assert.Equal(0xDA, markers[^1]);
        Assert.DoesNotContain(markers, JpegMarkersMetMetagegevens.Contains);
        foreach (var spoor in new[] { "Exif", Testbeelden.Camera, Testbeelden.Plaats, "xmpmeta", "GPS" })
        {
            Assert.False(Testbeelden.Bevat(uit.Inhoud, spoor), $"The re-encoded JPEG still carries '{spoor}'.");
        }

        using var gelezen = SKBitmap.Decode(uit.Inhoud);
        Assert.Equal((40, 20), (gelezen.Width, gelezen.Height));
    }

    [Fact]
    public void Een_PNG_verliest_tekst_EXIF_en_tijd_en_houdt_alleen_zijn_beeld()
    {
        var bron = Testbeelden.PngMetMetagegevens();
        Assert.Contains("tEXt", Testbeelden.PngChunks(bron));

        var uit = _herwerker.Herwerk(bron);

        Assert.Equal((Beeldformaat.Png, 40, 20), (uit.Formaat, uit.Breedte, uit.Hoogte));
        // Only the chunks that draw the picture. sBIT says how many bits per channel are significant: a property of the
        // pixels, not of the photo, and nothing that names a place, a device or a moment.
        Assert.All(
            Testbeelden.PngChunks(uit.Inhoud),
            chunk => Assert.Contains(chunk, new[] { "IHDR", "sBIT", "PLTE", "tRNS", "IDAT", "IEND" }));
        Assert.False(Testbeelden.Bevat(uit.Inhoud, Testbeelden.Plaats));
        Assert.False(Testbeelden.Bevat(uit.Inhoud, Testbeelden.Camera));
    }

    [Fact]
    public void Een_PNG_met_transparantie_blijft_een_PNG_met_transparantie()
    {
        var uit = _herwerker.Herwerk(Testbeelden.Png(40, 20, transparant: true));

        using var gelezen = SKBitmap.Decode(uit.Inhoud);
        Assert.Equal(Beeldformaat.Png, uit.Formaat);
        Assert.Equal(0, gelezen.GetPixel(30, 15).Alpha);
        Assert.Equal(SKColors.Red, gelezen.GetPixel(5, 5));
    }

    [Theory]
    [InlineData((ushort)1, 40, 20, "links rood")]
    [InlineData((ushort)3, 40, 20, "rechts rood")]
    [InlineData((ushort)6, 20, 40, "boven rood")]
    [InlineData((ushort)8, 20, 40, "onder rood")]
    public void Een_foto_komt_rechtop_zoals_de_telefoon_ze_bedoelde(ushort orientatie, int breedte, int hoogte, string waar)
    {
        var uit = _herwerker.Herwerk(Testbeelden.JpegMetMetagegevens(40, 20, orientatie));

        Assert.Equal((breedte, hoogte), (uit.Breedte, uit.Hoogte));
        using var gelezen = SKBitmap.Decode(uit.Inhoud);
        var (rood, blauw) = waar switch
        {
            "links rood" => (gelezen.GetPixel(5, 10), gelezen.GetPixel(35, 10)),
            "rechts rood" => (gelezen.GetPixel(35, 10), gelezen.GetPixel(5, 10)),
            "boven rood" => (gelezen.GetPixel(10, 5), gelezen.GetPixel(10, 35)),
            _ => (gelezen.GetPixel(10, 35), gelezen.GetPixel(10, 5)),
        };
        Assert.True(rood.Red > 200 && rood.Blue < 60, $"Expected red, got {rood}.");
        Assert.True(blauw.Blue > 200 && blauw.Red < 60, $"Expected blue, got {blauw}.");
    }

    [Theory]
    [InlineData("jpeg", 3000, 1500, 2400, 1200)]
    [InlineData("png", 2600, 100, 2400, 92)]
    [InlineData("jpeg", 1200, 2400, 1200, 2400)]
    public void Een_grote_foto_wordt_verkleind_tot_de_langste_zijde_2400_is(string soort, int breedte, int hoogte, int naarBreedte, int naarHoogte)
    {
        var bron = soort == "png" ? Testbeelden.Png(breedte, hoogte) : Testbeelden.Jpeg(breedte, hoogte);

        var uit = _herwerker.Herwerk(bron);

        Assert.Equal((naarBreedte, naarHoogte), (uit.Breedte, uit.Hoogte));
        using var gelezen = SKBitmap.Decode(uit.Inhoud);
        Assert.Equal((naarBreedte, naarHoogte), (gelezen.Width, gelezen.Height));
    }

    [Fact]
    public void Een_beeld_met_te_veel_pixels_wordt_geweigerd_op_zijn_kop_alleen()
    {
        // 8000 × 6000 is 48 million pixels, in a file of a few dozen bytes: nothing to decode, only a header to read.
        var fout = Assert.Throws<TekeningGeweigerdFout>(() => _herwerker.Herwerk(Testbeelden.PngMetKop(8000, 6000)));
        Assert.Equal(Tekeningweigering.TeVeelPixels, fout.Reden);
    }

    [Fact]
    public void Een_beeld_op_de_pixelgrens_wordt_niet_om_zijn_pixels_geweigerd()
    {
        // Exactly 40 million pixels passes the header check, and then fails on its one byte of pixel data.
        var fout = Assert.Throws<TekeningGeweigerdFout>(() => _herwerker.Herwerk(Testbeelden.PngMetKop(8000, 5000)));
        Assert.Equal(Tekeningweigering.GeenJpegOfPng, fout.Reden);
    }

    public static TheoryData<string, byte[]> GeenJpegOfPng => new()
    {
        { "pdf", Testbeelden.Pdf() },
        { "gif", Testbeelden.Gif() },
        { "webp", Testbeelden.Webp() },
        { "leeg", [] },
        { "onzin", [1, 2, 3, 4, 5, 6, 7, 8, 9] },
        { "afgebroken jpeg", Testbeelden.Jpeg(400, 400)[..600] },
    };

    [Theory]
    [MemberData(nameof(GeenJpegOfPng))]
    public void Wat_geen_leesbare_JPEG_of_PNG_is_wordt_geweigerd(string soort, byte[] bron)
    {
        var fout = Assert.Throws<TekeningGeweigerdFout>(() => _herwerker.Herwerk(bron));
        Assert.Equal(Tekeningweigering.GeenJpegOfPng, fout.Reden);
        Assert.DoesNotContain(soort, fout.Message, StringComparison.Ordinal);
    }
}
