using ClosedXML.Excel;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// ClosedXML implementation of <see cref="ISchoolcontentTemplateGenerator"/> (Art. VIII — ClosedXML/MIT,
/// no EPPlus). Emits the header row by iterating every <see cref="SchoolcontentKolom"/> and labelling
/// it via <see cref="SchoolcontentKolommen.Label"/> — the <b>same single source</b> the parser reads
/// (Art. III.3) — so there is no second column list and the template can never drift from the parser.
/// <para>
/// Below the header it writes one <b>worked example row</b> showing the expected format: ';'-separated
/// woordenschat/themadoelen/subdoelen lists, a valid <see cref="ActiviteitType"/> word (taken from the
/// single-source <see cref="ActiviteitTypeCode"/>), and positive duurWeken. The example is deliberately
/// kept valid so the generated template round-trips cleanly through
/// <see cref="ClosedXmlSchoolcontentParser"/> (<c>IsGeldig == true</c>, no per-row problems) — pinned by
/// a round-trip test. All visible text is Dutch (Art. II). The layout is provisional (Art. XIV).
/// </para>
/// </summary>
public sealed class ClosedXmlSchoolcontentTemplateGenerator : ISchoolcontentTemplateGenerator
{
    /// <summary>The worksheet name; the parser reads the first worksheet regardless of its name.</summary>
    private const string WerkbladNaam = "Schoolcontent";

    /// <summary>
    /// One valid example value per column. Required fields are non-empty; duurWeken are positive
    /// integers; the activiteit type comes from the single-source <see cref="ActiviteitTypeCode"/>;
    /// list columns are ';'-separated. Optional columns carry a helpful, still-valid example. Keeping
    /// this keyed by <see cref="SchoolcontentKolom"/> means it follows the single-source layout — there
    /// is no positional/literal column list here.
    /// </summary>
    private static readonly IReadOnlyDictionary<SchoolcontentKolom, string> Voorbeeld =
        new Dictionary<SchoolcontentKolom, string>
        {
            [SchoolcontentKolom.ThemaNaam] = "Herfst",
            [SchoolcontentKolom.ThemaDuurWeken] = "5",
            [SchoolcontentKolom.ThemaInvalshoeken] = "natuur; seizoenen",
            [SchoolcontentKolom.ThemaKernwoordenschat] = "blad; tak; boom",
            [SchoolcontentKolom.ThemaRijkeWoordenschat] = "fotosynthese; bladval",
            [SchoolcontentKolom.Themadoelen] = "NC-1.1; NC-1.2",
            [SchoolcontentKolom.SubthemaNaam] = "Bladeren",
            [SchoolcontentKolom.SubthemaDuurWeken] = "2",
            [SchoolcontentKolom.SubthemaKlas] = "K3 — derde kleuterklas",
            [SchoolcontentKolom.SubthemaLeeftijd] = "5-6",
            [SchoolcontentKolom.SubthemaProbleemstelling] = "Waarom vallen de bladeren in de herfst?",
            [SchoolcontentKolom.SubthemaOnderzoeksvraag] = "Welke bomen verliezen hun bladeren?",
            [SchoolcontentKolom.Subdoelen] = "WO-2.3",
            [SchoolcontentKolom.ActiviteitNaam] = "Bladeren zoeken in het bos",
            [SchoolcontentKolom.ActiviteitType] = ActiviteitType.Uitstap.ToCode(),
            [SchoolcontentKolom.ActiviteitHoek] = "ontdektafel",
            [SchoolcontentKolom.ActiviteitVerwachteUitkomsten] = "De kleuter benoemt drie soorten bladeren.",
        };

    /// <inheritdoc />
    public MemoryStream GenereerTemplate()
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(WerkbladNaam);

        foreach (SchoolcontentKolom kolom in Enum.GetValues<SchoolcontentKolom>())
        {
            var col = (int)kolom;

            // Header row from the single source (Art. III.3) — bold so it reads as a header.
            var header = sheet.Cell(1, col);
            header.Value = SchoolcontentKolommen.Label(kolom);
            header.Style.Font.Bold = true;

            // One worked example row, valid so the template round-trips through the parser.
            sheet.Cell(2, col).Value = Voorbeeld[kolom];
        }

        sheet.Columns().AdjustToContents();

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;
        return stream;
    }
}
