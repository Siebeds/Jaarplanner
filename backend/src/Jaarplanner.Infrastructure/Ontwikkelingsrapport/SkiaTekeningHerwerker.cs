using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using SkiaSharp;

namespace Jaarplanner.Infrastructure.Ontwikkelingsrapport;

/// <summary>
/// Re-encodes a kindtekening with SkiaSharp (MIT, over Skia's BSD licence: ADR-0035 D16) so that nothing of the upload
/// survives but its pixels (FB-005, FR-13.5, ADR-0035 §3.6).
/// <para>
/// <b>Why this drops all metadata.</b> The image is decoded to bare pixels and a new file is encoded from them. Skia's
/// encoders write no EXIF, XMP, IPTC, comment or PNG text of their own, and the pixels are encoded without a colour
/// profile (they are converted to sRGB first, which is what an untagged image means), so the new file carries none.
/// </para>
/// <para>
/// <b>In the order ADR-0035 §3.6 asks.</b> The format and the size are read from the header, and an image over
/// <see cref="Kindtekeningregels.MaxPixels"/> is refused before one pixel is decoded. A JPEG is then decoded at the
/// smallest of libjpeg's 1/8 steps that still covers the stored size, so a large photo never takes its full size in
/// memory; a PNG cannot be, which is what the pixel limit and <see cref="Gelijktijdig"/> are for.
/// </para>
/// <para>
/// <b>Upright.</b> A phone stores a photo as the sensor saw it and puts its rotation in the EXIF metadata. Dropping that
/// without applying it would turn every portrait photo on its side, so the rotation is applied to the pixels first.
/// </para>
/// </summary>
public sealed class SkiaTekeningHerwerker : ITekeningHerwerker
{
    /// <summary>JPEG quality of a stored drawing: no visible loss on a photo of paper, at a fraction of the phone's size.</summary>
    internal const int JpegKwaliteit = 85;

    /// <summary>
    /// At most two images decoded at once, across the app: a decoded PNG at the pixel limit takes 160 MB, and a klas's
    /// teachers uploading together must not take the server's memory with them.
    /// </summary>
    private static readonly SemaphoreSlim Gelijktijdig = new(2, 2);

    private static readonly SKSamplingOptions Schalen = new(SKCubicResampler.Mitchell);

    private readonly SemaphoreSlim _gelijktijdig;

    public SkiaTekeningHerwerker()
        : this(Gelijktijdig)
    {
    }

    /// <summary>With its own limit instead of the app-wide one, so a test can hold every place.</summary>
    internal SkiaTekeningHerwerker(SemaphoreSlim gelijktijdig) =>
        _gelijktijdig = gelijktijdig ?? throw new ArgumentNullException(nameof(gelijktijdig));

    public async Task<HerwerkteTekening> HerwerkAsync(byte[] bron, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(bron);

        using var data = SKData.CreateCopy(bron);
        using var codec = SKCodec.Create(data) ?? throw new TekeningGeweigerdFout(Tekeningweigering.GeenJpegOfPng);

        var formaat = codec.EncodedFormat switch
        {
            SKEncodedImageFormat.Jpeg => Beeldformaat.Jpeg,
            SKEncodedImageFormat.Png => Beeldformaat.Png,
            _ => throw new TekeningGeweigerdFout(Tekeningweigering.GeenJpegOfPng),
        };

        var info = codec.Info;
        if (info.Width <= 0 || info.Height <= 0)
        {
            throw new TekeningGeweigerdFout(Tekeningweigering.GeenJpegOfPng);
        }

        if ((long)info.Width * info.Height > Kindtekeningregels.MaxPixels)
        {
            throw new TekeningGeweigerdFout(Tekeningweigering.TeVeelPixels);
        }

        // Waits for a free place without holding a thread, and stops waiting when the request is aborted.
        await _gelijktijdig.WaitAsync(cancellationToken);
        try
        {
            return Herwerk(codec, formaat);
        }
        finally
        {
            _gelijktijdig.Release();
        }
    }

    private static HerwerkteTekening Herwerk(SKCodec codec, Beeldformaat formaat)
    {
        var bron = codec.Info;
        var schaal = Math.Min(1f, (float)Kindtekeningregels.MaxZijde / Math.Max(bron.Width, bron.Height));
        var doel = new SKSizeI(
            Math.Max(1, (int)Math.Round(bron.Width * schaal)),
            Math.Max(1, (int)Math.Round(bron.Height * schaal)));

        // A JPEG decodes at a scale of n/8 at no cost; Skia rounds up, so the decode still covers the stored size. A codec
        // that answers a smaller size than asked decodes at full size instead.
        var decodeer = codec.GetScaledDimensions(schaal);
        if (decodeer.Width < doel.Width || decodeer.Height < doel.Height)
        {
            decodeer = bron.Size;
        }

        var alfa = bron.AlphaType == SKAlphaType.Opaque ? SKAlphaType.Opaque : SKAlphaType.Premul;
        var decodeInfo = new SKImageInfo(decodeer.Width, decodeer.Height, SKColorType.Rgba8888, alfa, SKColorSpace.CreateSrgb());

        using var gedecodeerd = new SKBitmap(decodeInfo);
        if (codec.GetPixels(decodeInfo, gedecodeerd.GetPixels()) != SKCodecResult.Success)
        {
            // Truncated or damaged: the teacher gets the same sentence as for a file that is no image at all.
            throw new TekeningGeweigerdFout(Tekeningweigering.GeenJpegOfPng);
        }

        using var geschaald = decodeer == doel ? null : gedecodeerd.Resize(decodeInfo.WithSize(doel.Width, doel.Height), Schalen);
        var opMaat = geschaald ?? gedecodeerd;

        using var rechtop = Richt(opMaat, codec.EncodedOrigin);
        var eind = rechtop ?? opMaat;

        // Encoded from the same sRGB pixels described without a colour space, so the encoder writes no colour profile.
        using var pixels = new SKPixmap(eind.Info.WithColorSpace(null), eind.GetPixels(), eind.RowBytes);
        using var gecodeerd = formaat == Beeldformaat.Jpeg
            ? pixels.Encode(new SKJpegEncoderOptions(JpegKwaliteit, SKJpegEncoderDownsample.Downsample420, SKJpegEncoderAlphaOption.Ignore))
            : pixels.Encode(new SKPngEncoderOptions(SKPngEncoderFilterFlags.AllFilters, 6));

        if (gecodeerd is null)
        {
            throw new InvalidOperationException("The image could not be re-encoded.");
        }

        return new HerwerkteTekening(formaat, eind.Width, eind.Height, gecodeerd.ToArray());
    }

    /// <summary>
    /// The pixels turned the way the EXIF orientation says they are meant to be seen, or <c>null</c> when they already
    /// are. The eight orientations are the four rotations, each with or without a mirror.
    /// </summary>
    private static SKBitmap? Richt(SKBitmap bron, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft)
        {
            return null;
        }

        float w = bron.Width;
        float h = bron.Height;
        var gewisseld = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;

        // x' = ScaleX·x + SkewX·y + TransX; y' = SkewY·x + ScaleY·y + TransY.
        var matrix = origin switch
        {
            SKEncodedOrigin.TopRight => new SKMatrix(-1, 0, w, 0, 1, 0, 0, 0, 1),
            SKEncodedOrigin.BottomRight => new SKMatrix(-1, 0, w, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.BottomLeft => new SKMatrix(1, 0, 0, 0, -1, h, 0, 0, 1),
            SKEncodedOrigin.LeftTop => new SKMatrix(0, 1, 0, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightTop => new SKMatrix(0, -1, h, 1, 0, 0, 0, 0, 1),
            SKEncodedOrigin.RightBottom => new SKMatrix(0, -1, h, -1, 0, w, 0, 0, 1),
            SKEncodedOrigin.LeftBottom => new SKMatrix(0, 1, 0, -1, 0, w, 0, 0, 1),
            _ => SKMatrix.Identity,
        };

        var info = gewisseld ? bron.Info.WithSize(bron.Height, bron.Width) : bron.Info;
        var doel = new SKBitmap(info);
        using var canvas = new SKCanvas(doel);
        canvas.SetMatrix(matrix);
        // Quarter turns and mirrors land every pixel on a pixel, so nearest sampling copies them exactly.
        using var afbeelding = SKImage.FromBitmap(bron);
        canvas.DrawImage(afbeelding, 0, 0, new SKSamplingOptions(SKFilterMode.Nearest));
        return doel;
    }
}
