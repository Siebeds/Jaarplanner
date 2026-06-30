using Jaarplanner.Infrastructure.SchoolcontentImport;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Pins the downloadable import template (E1-09, FR-1.5, Gap A.4). The headline is the
/// <b>round-trip</b>: the generated template — header + worked example row — must parse cleanly back
/// through the very <see cref="ClosedXmlSchoolcontentParser"/> it is a template for (Art. III.3 single
/// source: template and parser share <see cref="SchoolcontentKolom"/>/<see cref="SchoolcontentKolommen"/>,
/// so neither can drift). Also checks the header carries exactly the single-source labels and that the
/// example shows the fields the story calls out (themadoelen, onderzoeksvraag, two-tier woordenschat,
/// activiteittype, duurWeken).
/// </summary>
public class ClosedXmlSchoolcontentTemplateGeneratorTests
{
    private static readonly ISchoolcontentTemplateGenerator Generator = new ClosedXmlSchoolcontentTemplateGenerator();
    private static readonly ISchoolcontentParser Parser = new ClosedXmlSchoolcontentParser();

    [Fact]
    public void Generated_template_round_trips_cleanly_through_the_E1_07_parser()
    {
        using var template = Generator.GenereerTemplate();

        var result = Parser.Parse(template);

        Assert.True(result.IsGeldig);          // no file-level or per-row problems
        Assert.Empty(result.Problemen);
        Assert.Single(result.Rijen);           // the one worked example row parses
    }

    [Fact]
    public void Header_row_carries_exactly_the_single_source_labels_in_column_order()
    {
        using var template = Generator.GenereerTemplate();

        // Re-read the workbook and assert each header cell equals the single-source label for that
        // column. This is what guarantees the template cannot drift from the parser (Art. III.3).
        using var workbook = new ClosedXML.Excel.XLWorkbook(template);
        var sheet = workbook.Worksheets.First();

        foreach (SchoolcontentKolom kolom in Enum.GetValues<SchoolcontentKolom>())
        {
            Assert.Equal(
                SchoolcontentKolommen.Label(kolom),
                sheet.Cell(1, (int)kolom).GetString());
        }
    }

    [Fact]
    public void Example_row_demonstrates_the_story_fields_after_parsing()
    {
        using var template = Generator.GenereerTemplate();

        var rij = Assert.Single(Parser.Parse(template).Rijen);

        // The fields the story names are present and well-formed in the example.
        Assert.NotEmpty(rij.Themadoelen);                                 // themadoelen
        Assert.False(string.IsNullOrWhiteSpace(rij.SubthemaOnderzoeksvraag)); // subthema onderzoeksvraag
        Assert.NotEmpty(rij.Kernwoordenschat);                            // two-tier woordenschat (kern)
        Assert.NotEmpty(rij.RijkeWoordenschat);                           // two-tier woordenschat (rijk)
        Assert.True(Enum.IsDefined(rij.ActiviteitType));                  // activiteittype
        Assert.True(rij.ThemaDuurWeken > 0);                              // duurWeken
        Assert.True(rij.SubthemaDuurWeken > 0);
    }

    [Fact]
    public void Every_required_column_is_filled_in_the_example_row()
    {
        // A teacher can run the template straight through without touching required fields and it
        // still validates — the example carries each required column non-empty.
        using var template = Generator.GenereerTemplate();

        var result = Parser.Parse(template);

        Assert.True(result.IsGeldig);
        Assert.DoesNotContain(
            result.Problemen,
            p => SchoolcontentKolommen.Verplicht.Contains(p.Kolom.GetValueOrDefault()));
    }
}
