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

    /// <summary>
    /// The concordance key to the decreed eindterm, or empty.
    /// <para>
    /// Carried because it is the goal's own reference data and an inspectie-facing document that hides the
    /// concordance is less useful for no gain. It is <b>not</b> minimumdoel coverage: that roll-up is E5-04 and the
    /// kopblok says so in as many words, because a reader is entitled to know that the level they care about is
    /// absent rather than to infer it from a column of refs.
    /// </para>
    /// </summary>
    Minimumdoel = 7,

    /// <summary>Whether this class's jaarplan covers the goal: "Ja" or "Nee" (Art. V.1).</summary>
    Gedekt = 8,

    /// <summary>
    /// The thema's that cover it, ';'-separated; empty exactly when <see cref="Gedekt"/> is "Nee".
    /// <para>
    /// This column is the evidence half of Art. V: a document claiming coverage has to say <i>through what</i>. A
    /// "Ja" with nothing beside it would be an assertion a reader cannot check.
    /// </para>
    /// </summary>
    DekkendeThemas = 9,

    /// <summary>
    /// Marked when a re-import found the goal gone from Op.stap while school content still referenced it, so it was
    /// flagged rather than deleted (Art. III.4). Such a goal stays in the denominator, deliberately: dropping it would
    /// shrink the total and raise the figure, which is the one direction coverage must never move by itself.
    /// </summary>
    NietMeerInOpstap = 10,
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
            [DekkingKolom.Minimumdoel] = "Minimumdoel",
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
    /// </summary>
    private static readonly ReadOnlyDictionary<DekkingKolom, double> Breedtes =
        new(new Dictionary<DekkingKolom, double>
        {
            [DekkingKolom.Code] = 14,
            [DekkingKolom.Doelsoort] = 10,
            [DekkingKolom.JaarFase] = 12,
            [DekkingKolom.Domein] = 22,
            [DekkingKolom.Subdomein] = 22,
            [DekkingKolom.Leerplandoel] = 70,
            [DekkingKolom.Minimumdoel] = 14,
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
