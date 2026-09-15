using System.Buffers.Binary;
using System.Text;
using SkiaSharp;

namespace Jaarplanner.Testhulp;

/// <summary>
/// Made-up test images for the kindtekening (FB-005): a flat two-colour picture, with or without the metadata a phone
/// photo carries. Nothing here is a photo of anyone; the GPS position is the centre of Brussels and the camera and
/// street are invented. Shared with the integration tests as a linked file.
/// </summary>
internal static class Testbeelden
{
    /// <summary>The camera make written into the EXIF block.</summary>
    public const string Camera = "Proefcamera";

    /// <summary>The place written into the XMP block, the JPEG comment and the PNG text.</summary>
    public const string Plaats = "Proefstraat 1";

    /// <summary>Left half red, right half blue.</summary>
    public static SKBitmap Tweekleurig(int breedte, int hoogte, bool transparant = false)
    {
        var bitmap = new SKBitmap(new SKImageInfo(breedte, hoogte, SKColorType.Rgba8888, transparant ? SKAlphaType.Premul : SKAlphaType.Opaque));
        using var canvas = new SKCanvas(bitmap);
        canvas.Clear(transparant ? SKColors.Transparent : SKColors.White);
        using var rood = new SKPaint { Color = SKColors.Red };
        using var blauw = new SKPaint { Color = SKColors.Blue };
        canvas.DrawRect(0, 0, breedte / 2f, hoogte, rood);
        canvas.DrawRect(breedte / 2f, 0, breedte / 2f, transparant ? hoogte / 2f : hoogte, blauw);
        return bitmap;
    }

    public static byte[] Jpeg(int breedte = 40, int hoogte = 20)
    {
        using var bitmap = Tweekleurig(breedte, hoogte);
        using var data = bitmap.Encode(SKEncodedImageFormat.Jpeg, 90);
        return data.ToArray();
    }

    public static byte[] Png(int breedte = 40, int hoogte = 20, bool transparant = false)
    {
        using var bitmap = Tweekleurig(breedte, hoogte, transparant);
        using var data = bitmap.Encode(SKEncodedImageFormat.Png, 100);
        return data.ToArray();
    }

    public static byte[] Webp(int breedte = 40, int hoogte = 20)
    {
        using var bitmap = Tweekleurig(breedte, hoogte);
        using var data = bitmap.Encode(SKEncodedImageFormat.Webp, 90);
        return data.ToArray();
    }

    /// <summary>A 1×1 GIF, byte for byte.</summary>
    public static byte[] Gif() =>
    [
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00,
        0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02,
        0x02, 0x44, 0x01, 0x00, 0x3B,
    ];

    public static byte[] Pdf() => Encoding.ASCII.GetBytes("%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

    /// <summary>
    /// A JPEG as a phone writes it: an EXIF block with the camera, a GPS position and <paramref name="orientatie"/>, an XMP
    /// block with the place, and a comment.
    /// </summary>
    public static byte[] JpegMetMetagegevens(int breedte = 40, int hoogte = 20, ushort orientatie = 1)
    {
        var kaal = Jpeg(breedte, hoogte);
        using var uit = new MemoryStream();
        uit.Write(kaal, 0, 2); // SOI
        JpegSegment(uit, 0xE1, Exif(orientatie));
        JpegSegment(uit, 0xE1, [.. "http://ns.adobe.com/xap/1.0/\0"u8, .. Encoding.UTF8.GetBytes(Xmp())]);
        JpegSegment(uit, 0xFE, Encoding.ASCII.GetBytes($"Gemaakt in de {Plaats}"));
        uit.Write(kaal, 2, kaal.Length - 2);
        return uit.ToArray();
    }

    /// <summary>A PNG with a text chunk, an international text chunk, an EXIF chunk and a time chunk before its pixels.</summary>
    public static byte[] PngMetMetagegevens(int breedte = 40, int hoogte = 20)
    {
        var kaal = Png(breedte, hoogte);
        var idat = ChunkPositie(kaal, "IDAT");
        using var uit = new MemoryStream();
        uit.Write(kaal, 0, idat);
        PngChunk(uit, "tEXt", [.. "Location\0"u8, .. Encoding.Latin1.GetBytes(Plaats)]);
        PngChunk(uit, "iTXt", [.. "Comment\0\0\0\0\0"u8, .. Encoding.UTF8.GetBytes($"Gemaakt in de {Plaats}")]);
        PngChunk(uit, "eXIf", Exif(1)[6..]);
        PngChunk(uit, "tIME", [0x07, 0xEA, 9, 15, 12, 0, 0]);
        uit.Write(kaal, idat, kaal.Length - idat);
        return uit.ToArray();
    }

    /// <summary>A PNG whose header claims <paramref name="breedte"/>×<paramref name="hoogte"/>, with one byte of pixel data.</summary>
    public static byte[] PngMetKop(int breedte, int hoogte)
    {
        using var uit = new MemoryStream();
        uit.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        var ihdr = new byte[13];
        BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(0), breedte);
        BinaryPrimitives.WriteInt32BigEndian(ihdr.AsSpan(4), hoogte);
        ihdr[8] = 8; // bit depth
        ihdr[9] = 2; // RGB
        PngChunk(uit, "IHDR", ihdr);
        PngChunk(uit, "IDAT", [0x78]);
        PngChunk(uit, "IEND", []);
        return uit.ToArray();
    }

    /// <summary>The markers of a JPEG's header, up to the start of its pixel data.</summary>
    public static List<byte> JpegMarkers(byte[] jpeg)
    {
        var markers = new List<byte>();
        var p = 2;
        while (p + 4 <= jpeg.Length && jpeg[p] == 0xFF)
        {
            var marker = jpeg[p + 1];
            markers.Add(marker);
            if (marker == 0xDA)
            {
                break;
            }

            p += 2 + BinaryPrimitives.ReadUInt16BigEndian(jpeg.AsSpan(p + 2));
        }

        return markers;
    }

    /// <summary>The chunk types of a PNG, in order.</summary>
    public static List<string> PngChunks(byte[] png)
    {
        var chunks = new List<string>();
        var p = 8;
        while (p + 8 <= png.Length)
        {
            var lengte = BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(p));
            chunks.Add(Encoding.ASCII.GetString(png, p + 4, 4));
            p += 12 + lengte;
        }

        return chunks;
    }

    /// <summary>Whether <paramref name="tekst"/> occurs anywhere in the bytes, as ASCII.</summary>
    public static bool Bevat(byte[] bytes, string tekst) =>
        bytes.AsSpan().IndexOf(Encoding.ASCII.GetBytes(tekst)) >= 0;

    private static string Xmp() =>
        "<x:xmpmeta xmlns:x=\"adobe:ns:meta/\"><rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\">" +
        "<rdf:Description xmlns:exif=\"http://ns.adobe.com/exif/1.0/\" exif:GPSLatitude=\"50,51.2N\" " +
        $"exif:GPSLongitude=\"4,21.3E\"><exif:UserComment>{Plaats}</exif:UserComment></rdf:Description></rdf:RDF></x:xmpmeta>";

    /// <summary>
    /// An EXIF block (little-endian TIFF) with IFD0 holding the camera make, the orientation and a pointer to a GPS IFD
    /// with latitude and longitude.
    /// </summary>
    private static byte[] Exif(ushort orientatie)
    {
        var merk = Encoding.ASCII.GetBytes(Camera + "\0");
        const int ifd0 = 8;
        const int gps = ifd0 + 2 + (3 * 12) + 4;
        const int merkOp = gps + 2 + (4 * 12) + 4;
        var breedteOp = merkOp + merk.Length;
        var lengteOp = breedteOp + 24;
        var tiff = new byte[lengteOp + 24];
        var s = tiff.AsSpan();

        "II"u8.CopyTo(s);
        BinaryPrimitives.WriteUInt16LittleEndian(s[2..], 42);
        BinaryPrimitives.WriteUInt32LittleEndian(s[4..], ifd0);

        var p = ifd0;
        BinaryPrimitives.WriteUInt16LittleEndian(s[p..], 3);
        p += 2;
        p = Veld(s, p, 0x010F, 2, (uint)merk.Length, (uint)merkOp); // Make
        p = Veld(s, p, 0x0112, 3, 1, orientatie); // Orientation
        p = Veld(s, p, 0x8825, 4, 1, gps); // GPS IFD
        BinaryPrimitives.WriteUInt32LittleEndian(s[p..], 0);

        p = gps;
        BinaryPrimitives.WriteUInt16LittleEndian(s[p..], 4);
        p += 2;
        p = Veld(s, p, 0x0001, 2, 2, 'N');
        p = Veld(s, p, 0x0002, 5, 3, (uint)breedteOp);
        p = Veld(s, p, 0x0003, 2, 2, 'E');
        p = Veld(s, p, 0x0004, 5, 3, (uint)lengteOp);
        BinaryPrimitives.WriteUInt32LittleEndian(s[p..], 0);

        merk.CopyTo(s[merkOp..]);
        Rationalen(s[breedteOp..], (50, 1), (51, 1), (1234, 100));
        Rationalen(s[lengteOp..], (4, 1), (21, 1), (1800, 100));

        return [.. "Exif\0\0"u8, .. tiff];
    }

    private static int Veld(Span<byte> s, int p, ushort tag, ushort type, uint aantal, uint waarde)
    {
        BinaryPrimitives.WriteUInt16LittleEndian(s[p..], tag);
        BinaryPrimitives.WriteUInt16LittleEndian(s[(p + 2)..], type);
        BinaryPrimitives.WriteUInt32LittleEndian(s[(p + 4)..], aantal);
        BinaryPrimitives.WriteUInt32LittleEndian(s[(p + 8)..], waarde);
        return p + 12;
    }

    private static void Rationalen(Span<byte> s, params (uint Teller, uint Noemer)[] waarden)
    {
        for (var i = 0; i < waarden.Length; i++)
        {
            BinaryPrimitives.WriteUInt32LittleEndian(s[(i * 8)..], waarden[i].Teller);
            BinaryPrimitives.WriteUInt32LittleEndian(s[((i * 8) + 4)..], waarden[i].Noemer);
        }
    }

    private static void JpegSegment(Stream uit, byte marker, byte[] inhoud)
    {
        uit.WriteByte(0xFF);
        uit.WriteByte(marker);
        var lengte = new byte[2];
        BinaryPrimitives.WriteUInt16BigEndian(lengte, (ushort)(inhoud.Length + 2));
        uit.Write(lengte);
        uit.Write(inhoud);
    }

    private static void PngChunk(Stream uit, string type, byte[] inhoud)
    {
        var kop = new byte[8];
        BinaryPrimitives.WriteInt32BigEndian(kop, inhoud.Length);
        Encoding.ASCII.GetBytes(type).CopyTo(kop, 4);
        uit.Write(kop);
        uit.Write(inhoud);
        var crc = new byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(crc, Crc32([.. kop[4..], .. inhoud]));
        uit.Write(crc);
    }

    private static int ChunkPositie(byte[] png, string type)
    {
        var p = 8;
        while (p + 8 <= png.Length)
        {
            if (Encoding.ASCII.GetString(png, p + 4, 4) == type)
            {
                return p;
            }

            p += 12 + BinaryPrimitives.ReadInt32BigEndian(png.AsSpan(p));
        }

        throw new InvalidOperationException($"No {type} chunk.");
    }

    private static uint Crc32(byte[] bytes)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in bytes)
        {
            crc ^= b;
            for (var k = 0; k < 8; k++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320u : crc >> 1;
            }
        }

        return crc ^ 0xFFFFFFFFu;
    }
}
