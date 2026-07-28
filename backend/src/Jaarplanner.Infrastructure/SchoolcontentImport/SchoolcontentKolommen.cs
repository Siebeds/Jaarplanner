using System.Collections.ObjectModel;

namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// The single-source companion to <see cref="SchoolcontentKolom"/>: the Dutch header label for each
/// column and which columns are <b>required</b> to be present (and non-empty per row). Keeping the
/// header labels and the required set here — beside the column enum — means the parser, the
/// required-header-column check, and the eventual template generator (E1-09) all read the layout
/// from one place (Art. III.3). Labels are provisional, refinable with the layout (Art. XIV).
/// </summary>
public static class SchoolcontentKolommen
{
    /// <summary>The Dutch header label for each column (row 1 of the sheet).</summary>
    private static readonly ReadOnlyDictionary<SchoolcontentKolom, string> Labels =
        new(new Dictionary<SchoolcontentKolom, string>
        {
            [SchoolcontentKolom.ThemaNaam] = "Thema",
            [SchoolcontentKolom.ThemaDuurWeken] = "Thema duur (weken)",
            [SchoolcontentKolom.ThemaInvalshoeken] = "Invalshoeken",
            [SchoolcontentKolom.ThemaKernwoordenschat] = "Kernwoordenschat",
            [SchoolcontentKolom.ThemaRijkeWoordenschat] = "Rijke woordenschat",
            [SchoolcontentKolom.Themadoelen] = "Themadoelen",
            [SchoolcontentKolom.SubthemaNaam] = "Subthema",
            [SchoolcontentKolom.SubthemaDuurWeken] = "Subthema duur (weken)",
            [SchoolcontentKolom.SubthemaKlas] = "Klas",
            [SchoolcontentKolom.SubthemaLeeftijd] = "Leeftijd",
            [SchoolcontentKolom.SubthemaProbleemstelling] = "Probleemstelling",
            [SchoolcontentKolom.SubthemaOnderzoeksvraag] = "Onderzoeksvraag",
            [SchoolcontentKolom.Subdoelen] = "Subdoelen",
            [SchoolcontentKolom.ActiviteitNaam] = "Activiteit",
            [SchoolcontentKolom.ActiviteitType] = "Type",
            [SchoolcontentKolom.ActiviteitHoek] = "Hoek",
            [SchoolcontentKolom.ActiviteitVerwachteUitkomsten] = "Verwachte uitkomsten",
        });

    /// <summary>
    /// The columns whose header must be present and whose value is required on every data row
    /// (Art. IX.2 structural requirements: a row must carry a thema, a subthema with its required
    /// klas + leeftijd scope, and a typed activiteit).
    /// </summary>
    public static readonly IReadOnlyList<SchoolcontentKolom> Verplicht =
    [
        SchoolcontentKolom.ThemaNaam,
        SchoolcontentKolom.ThemaDuurWeken,
        SchoolcontentKolom.SubthemaNaam,
        SchoolcontentKolom.SubthemaDuurWeken,
        SchoolcontentKolom.SubthemaKlas,
        SchoolcontentKolom.SubthemaLeeftijd,
        SchoolcontentKolom.ActiviteitNaam,
        SchoolcontentKolom.ActiviteitType,
    ];

    /// <summary>The Dutch header label for a column.</summary>
    public static string Label(SchoolcontentKolom kolom) =>
        Labels.TryGetValue(kolom, out var label)
            ? label
            : throw new ArgumentOutOfRangeException(nameof(kolom), kolom, "Unknown school-content column.");
}
