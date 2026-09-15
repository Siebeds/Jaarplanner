using Jaarplanner.Domain.Ontwikkelingsrapport;

namespace Jaarplanner.Application.Ontwikkelingsrapport;

/// <summary>
/// The kindtekening of one report (FB-005, R10, FR-13.5, ADR-0035 §3.6): at most one per child and moment, added,
/// replaced or deleted by whoever may fill in the report, and read by whoever may read it.
/// <para>
/// <b>Who may call what is the matrix's</b> (<c>OntwikkelingsrapportLezen</c>, <c>RapportInvullen</c>), applied on the
/// routes, as for the rest of the report. What this service adds holds for everyone: only a JPEG or a PNG, within
/// <see cref="Kindtekeningregels"/>, and <b>every image re-encoded before anything is stored</b>, so no metadata of the
/// upload survives (GPS position, camera, date, XMP, IPTC, PNG text).
/// </para>
/// <para>
/// <b>No image and no file name in a fault or a log</b> (ADR-0035 §3.8). The file name of the upload is never read.
/// </para>
/// </summary>
public interface IKindtekeningService
{
    /// <summary>
    /// Re-encodes <paramref name="bestand"/> and stores it as the drawing of the child's report at the moment, in place of
    /// the one before. Makes the report when this is its first write. 404 when the child does not exist; 400 when there is
    /// no file, it is too large, has too many pixels, or is not a readable JPEG or PNG.
    /// </summary>
    /// <param name="lengte">The declared length of the upload, so a file over the limit is refused before it is read.</param>
    Task<TekeningWeergave> BewaarAsync(
        Guid leerlingId,
        int moment,
        Stream bestand,
        long lengte,
        CancellationToken cancellationToken = default);

    /// <summary>The stored image of the report at the moment. 404 when the child does not exist or there is none.</summary>
    Task<TekeningBestand> HaalOpAsync(Guid leerlingId, int moment, CancellationToken cancellationToken = default);

    /// <summary>Deletes the drawing of the report at the moment; nothing to delete is no fault. 404 when the child does not exist.</summary>
    Task VerwijderAsync(Guid leerlingId, int moment, CancellationToken cancellationToken = default);
}

/// <summary>
/// The limits on an upload (FB-005: "de bouw kiest de grenzen"). The screen mirrors the size limit so a file that is too
/// large is refused before it is sent; the pixel limit only the server can check.
/// </summary>
public static class Kindtekeningregels
{
    /// <summary>The largest upload accepted, in MB, as the refusal names it.</summary>
    public const int MaxMegabytes = 20;

    /// <summary><see cref="MaxMegabytes"/> in bytes.</summary>
    public const long MaxBytes = MaxMegabytes * 1024L * 1024L;

    /// <summary>
    /// The most pixels accepted, in millions, as the refusal names it. Read from the image's header before anything is
    /// decoded (ADR-0035 §3.6), so a small file that decompresses to gigabytes is refused unread.
    /// </summary>
    public const int MaxMegapixels = 40;

    /// <summary><see cref="MaxMegapixels"/> in pixels.</summary>
    public const long MaxPixels = MaxMegapixels * 1_000_000L;

    /// <summary>
    /// The longest side a stored drawing has, in pixels. A larger photo is scaled down when it is re-encoded: a drawing on
    /// a report needs no more, and a phone photo would otherwise weigh several MB per child and moment in the database.
    /// </summary>
    public const int MaxZijde = 2400;
}

/// <summary>The drawing as the report shows it: which version, and its size.</summary>
/// <param name="Versie">Changes with every replacement; the screen puts it in the image's address.</param>
/// <param name="Breedte">In pixels.</param>
/// <param name="Hoogte">In pixels.</param>
public sealed record TekeningWeergave(Guid Versie, int Breedte, int Hoogte);

/// <summary>A stored drawing, to serve.</summary>
public sealed record TekeningBestand(byte[] Inhoud, string MediaType);

/// <summary>
/// Decodes an uploaded image and encodes it again (ADR-0035 §3.6). Only a re-encode reliably drops all metadata. Behind
/// an interface because the image library is Infrastructure's (D16: permissively licensed).
/// </summary>
public interface ITekeningHerwerker
{
    /// <summary>
    /// The image in <paramref name="bron"/>, upright, scaled to at most <see cref="Kindtekeningregels.MaxZijde"/>, in its
    /// own format (JPEG stays JPEG, PNG stays PNG), carrying no metadata.
    /// </summary>
    /// <exception cref="TekeningGeweigerdFout">It is not a readable JPEG or PNG, or it has too many pixels.</exception>
    HerwerkteTekening Herwerk(byte[] bron);
}

/// <summary>What a re-encode produced.</summary>
public sealed record HerwerkteTekening(Beeldformaat Formaat, int Breedte, int Hoogte, byte[] Inhoud);

/// <summary>Why an image was refused.</summary>
public enum Tekeningweigering
{
    /// <summary>Not a JPEG or a PNG, or one that could not be read.</summary>
    GeenJpegOfPng,

    /// <summary>More than <see cref="Kindtekeningregels.MaxPixels"/>, by its header.</summary>
    TeVeelPixels,
}

/// <summary>An image the re-encode refuses. Its message is for an operator and names only the reason, never the file.</summary>
public sealed class TekeningGeweigerdFout : Exception
{
    public TekeningGeweigerdFout(Tekeningweigering reden)
        : base($"The image was refused: {reden}.") => Reden = reden;

    public Tekeningweigering Reden { get; }
}
