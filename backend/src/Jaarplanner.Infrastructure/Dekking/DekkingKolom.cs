using System.Collections.ObjectModel;

namespace Jaarplanner.Infrastructure.Dekking;

/// <summary>
/// The columns of the dekking export, and their position in it (E5-06, FR-9.5).
/// <para>
/// <b>The ordinal <i>is</i> the spreadsheet column</b>, exactly as <c>SchoolcontentKolom</c> works for the import
/// template, so moving a column is a one-line change here and the header row, the widths and the row writer all
/// follow. Art. III.3's "keep the mapping in one place" is written about the Op.stap import, but the reason applies to
/// any layout with two writers: a second list is a second thing to forget.
/// </para>
/// <para>
/// The first six columns are the leerplandoel's own reference data in the order the Op.stap file itself uses
/// (Art. VII.1), so a reader who knows the curriculum export recognises the shape. The last three are what this
/// document adds: whether this class's plan covers the goal, through what, and whether the goal is still in Op.stap.
/// </para>
/// <para>
/// <b>There is deliberately no minimumdoel column, and the reason is worth keeping.</b> The payload carries a
/// <c>minimumdoelRef</c> per doel and an earlier revision of this file rendered it, headed <c>"Minimumdoel"</c>,
/// directly beside <see cref="Gedekt"/> and inside the AutoFilter. The antagonist killed it and was right twice
/// over. The kopblok states two rows above that minimumdoel-level coverage is <b>not</b> in this file (Art. V.2,
/// E5-04, blocked on E1-12), so the document rendered the level it says is absent: the E4-06 and E3-07
/// contradiction shape in a new artefact. And the inference it invited is wrong in <i>both</i> directions, not
/// merely unsupported. Art. V.1 makes a minimumdoel covered when <b>at least one</b> concorded leerplandoel is,
/// so a <c>Nee</c> beside a ref does not mean that minimumdoel is uncovered: another row with the same ref may
/// say <c>Ja</c>, and this document aggregates nothing. In the other direction, a minimumdoel concorded only to
/// leerplandoelen outside the scope appears in no row at all, so filtering the column yields a set that is
/// silently incomplete. The screen has no such column either (<c>Doeldekkingregel.tsx</c>), and this story's
/// criterion is that the export reproduce the screen faithfully. <b>E5-04 owns this column</b>, where it can be
/// rolled up correctly instead of insinuated.
/// </para>
/// </summary>
public enum DekkingKolom
{
    /// <summary>The leerplandoel's unique, stable code (Art. III.5). The identity a reader looks a goal up by.</summary>
    Code = 1,

    /// <summary>The official Op.stap doelsoort short code, from <c>DoelsoortCodes</c>.</summary>
    Doelsoort = 2,

    /// <summary>The jaar/fase code (JK, K2, K3, L1 to L6, or a fase for P/S).</summary>
    JaarFase = 3,

    /// <summary>The domein.</summary>
    Domein = 4,

    /// <summary>The subdomein, which is unique only together with the domein (Art. VII.0).</summary>
    Subdomein = 5,

    /// <summary>The goal text.</summary>
    Leerplandoel = 6,

    /// <summary>Whether this class's jaarplan covers the goal: "Ja" or "Nee" (Art. V.1).</summary>
    Gedekt = 7,

    /// <summary>
    /// The thema's that cover it, ';'-separated; empty exactly when <see cref="Gedekt"/> is "Nee".
    /// <para>
    /// This column is the evidence half of Art. V: a document claiming coverage has to say <i>through what</i>. A
    /// "Ja" with nothing beside it would be an assertion a reader cannot check.
    /// </para>
    /// </summary>
    DekkendeThemas = 8,

    /// <summary>
    /// Marked when a re-import found the goal gone from Op.stap while school content still referenced it, so it was
    /// flagged rather than deleted (Art. III.4). Such a goal stays in the denominator, deliberately: dropping it would
    /// shrink the total and raise the figure, which is the one direction coverage must never move by itself.
    /// </summary>
    NietMeerInOpstap = 9,
}

/// <summary>
/// The labels and widths for <see cref="DekkingKolom"/>. One place, so the header row and the layout cannot drift
/// from each other or from the writer.
/// </summary>
public static class DekkingKolommen
{
    private static readonly ReadOnlyDictionary<DekkingKolom, string> Labels =
        new(new Dictionary<DekkingKolom, string>
        {
            [DekkingKolom.Code] = "Code",
            [DekkingKolom.Doelsoort] = "Doelsoort",
            [DekkingKolom.JaarFase] = "Jaar of fase",
            [DekkingKolom.Domein] = "Domein",
            [DekkingKolom.Subdomein] = "Subdomein",
            [DekkingKolom.Leerplandoel] = "Leerplandoel",
            [DekkingKolom.Gedekt] = "Gedekt",
            [DekkingKolom.DekkendeThemas] = "Gedekt door",
            [DekkingKolom.NietMeerInOpstap] = "Opmerking",
        });

    /// <summary>
    /// Column widths in characters.
    /// <para>
    /// Set explicitly rather than with <c>AdjustToContents()</c>, which the import template can afford because its
    /// cells are short. A leerplandoel's text runs to several lines, so auto-fitting produces one column hundreds of
    /// characters wide and a document nobody can read without resizing it first. The text column wraps instead.
    /// </para>
    /// <para>
    /// <b><see cref="DekkingKolom.Code"/>'s width is set by the kopblok, not by a goal code</b> (antagonist
    /// MINOR-1). The kopblok's labels live in column 1 and every one of them has a populated column 2, and Excel
    /// clips a cell whose neighbour is populated. At 14 the label <c>"Buiten dit overzicht"</c> rendered
    /// truncated, which is the one line that exists to stop a narrowed denominator being silent. Nothing in the
    /// tests can see this: every assertion reads cell values, and clipping does not change them.
    /// </para>
    /// </summary>
    private static readonly ReadOnlyDictionary<DekkingKolom, double> Breedtes =
        new(new Dictionary<DekkingKolom, double>
        {
            [DekkingKolom.Code] = 22,
            [DekkingKolom.Doelsoort] = 10,
            [DekkingKolom.JaarFase] = 12,
            [DekkingKolom.Domein] = 22,
            [DekkingKolom.Subdomein] = 22,
            [DekkingKolom.Leerplandoel] = 70,
            [DekkingKolom.Gedekt] = 9,
            [DekkingKolom.DekkendeThemas] = 30,
            [DekkingKolom.NietMeerInOpstap] = 22,
        });

    /// <summary>Every column, in spreadsheet order.</summary>
    public static IReadOnlyList<DekkingKolom> Alle { get; } =
        Enum.GetValues<DekkingKolom>().OrderBy(kolom => (int)kolom).ToArray();

    /// <summary>The rightmost column's ordinal, for ranges that span the whole table.</summary>
    public static DekkingKolom Laatste { get; } = Alle[^1];

    /// <summary>The Dutch header label for a column (Art. II.3: user-facing text is Dutch).</summary>
    public static string Label(DekkingKolom kolom) =>
        Labels.TryGetValue(kolom, out var label)
            ? label
            : throw new ArgumentOutOfRangeException(nameof(kolom), kolom, "Unknown dekking export column.");

    /// <summary>The column's width in characters.</summary>
    public static double Breedte(DekkingKolom kolom) =>
        Breedtes.TryGetValue(kolom, out var breedte)
            ? breedte
            : throw new ArgumentOutOfRangeException(nameof(kolom), kolom, "Unknown dekking export column.");
}
