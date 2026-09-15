namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// The one drawing on a report (FB-005, R10, FR-13.5, ADR-0035 §3.6): a photo or a scan of the child's drawing, as the
/// server re-encoded it. <b>Pupil data</b> (Art. VI.7), and it never counts for dekking.
/// <para>
/// <b>A table of its own (D15)</b>, keyed by its report, so reading a report never loads an image. It goes with its report
/// (a database cascade), and so with the child (D8) and with a wiped schooljaar (D7).
/// </para>
/// <para>
/// <b>It holds nothing the upload carried</b> besides the pixels: no file name, no date, no metadata. What is stored is
/// only what the re-encode produced.
/// </para>
/// </summary>
public sealed class Kindtekening
{
    // EF Core materialisation only.
    private Kindtekening()
    {
        Inhoud = [];
    }

    /// <summary>The drawing of a report, as re-encoded.</summary>
    public Kindtekening(Guid ontwikkelingsrapportId, Beeldformaat formaat, int breedte, int hoogte, byte[] inhoud)
    {
        OntwikkelingsrapportId = ontwikkelingsrapportId == Guid.Empty
            ? throw new ArgumentException("'ontwikkelingsrapportId' is required.", nameof(ontwikkelingsrapportId))
            : ontwikkelingsrapportId;
        Inhoud = [];
        Vervang(formaat, breedte, hoogte, inhoud);
    }

    /// <summary>The report it belongs to, and its identity: one drawing per report. Immutable.</summary>
    public Guid OntwikkelingsrapportId { get; private set; }

    /// <summary>
    /// New on every replacement. The screen puts it in the image's address, so a replaced drawing is fetched again rather
    /// than shown from the browser's memory of the old one.
    /// </summary>
    public Guid Versie { get; private set; }

    public Beeldformaat Formaat { get; private set; }

    /// <summary>In pixels, as stored: upright, after the photo's rotation was applied.</summary>
    public int Breedte { get; private set; }

    /// <summary>In pixels, as stored.</summary>
    public int Hoogte { get; private set; }

    /// <summary>The re-encoded image.</summary>
    public byte[] Inhoud { get; private set; }

    /// <summary>The media type the image is served with.</summary>
    public string MediaType => MediaTypeVan(Formaat);

    /// <summary>Puts a new drawing in place of this one, with a new <see cref="Versie"/>.</summary>
    public void Vervang(Beeldformaat formaat, int breedte, int hoogte, byte[] inhoud)
    {
        if (!Enum.IsDefined(formaat))
        {
            throw new ArgumentOutOfRangeException(nameof(formaat), formaat, "'formaat' is Jpeg or Png.");
        }

        if (breedte <= 0 || hoogte <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(breedte), "'breedte' and 'hoogte' are positive.");
        }

        if (inhoud is null || inhoud.Length == 0)
        {
            throw new ArgumentException("'inhoud' is required.", nameof(inhoud));
        }

        Formaat = formaat;
        Breedte = breedte;
        Hoogte = hoogte;
        Inhoud = inhoud;
        Versie = Guid.NewGuid();
    }

    /// <summary>The media type of a stored format.</summary>
    public static string MediaTypeVan(Beeldformaat formaat) =>
        formaat == Beeldformaat.Png ? "image/png" : "image/jpeg";
}
