using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.SchoolcontentImport;

namespace Jaarplanner.UnitTests.Schoolcontent;

/// <summary>
/// Thorough coverage of the high-risk school-content (thema/subthema/activiteit) import
/// parser/validator (Art. V.6, FR-1.1/1.2). Pins: correct mapping of a valid multi-level file,
/// required-field violations reported per-row with the right row number and a Dutch message,
/// missing required header column reported, empty/whitespace handling, the structural klas+leeftijd
/// subthema scope (Art. IX.2), activiteittype parsing incl. unknown value, list-column splitting,
/// and report-don't-drop (good rows still parse when some rows are bad).
/// </summary>
public class ClosedXmlSchoolcontentParserTests
{
    private static readonly ISchoolcontentParser Parser = new ClosedXmlSchoolcontentParser();

    private static SchoolcontentParseResult Parse(SchoolcontentWorkbookBuilder builder)
    {
        using var stream = builder.Bouw();
        return Parser.Parse(stream);
    }

    [Fact]
    public void Maps_every_column_of_a_valid_row_to_the_right_field()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(
                themaNaam: "Herfst",
                themaDuurWeken: "5",
                invalshoeken: "natuur; seizoenen",
                kernwoordenschat: "blad; tak; boom",
                rijkeWoordenschat: "fotosynthese; bladval",
                themadoelen: "NC-1.1; NC-1.2",
                subthemaNaam: "Bladeren",
                subthemaDuurWeken: "2",
                klas: "K3",
                leeftijd: "5-6",
                probleemstelling: "Waarom vallen bladeren?",
                onderzoeksvraag: "Wat gebeurt er in de herfst?",
                subdoelen: "WO-2.3",
                activiteitNaam: "Bladeren zoeken",
                activiteitType: "uitstap",
                hoek: "ontdektafel",
                verwachteUitkomsten: "De kleuter benoemt drie soorten bladeren."));

        Assert.True(result.IsGeldig);
        var rij = Assert.Single(result.Rijen);

        Assert.Equal("Herfst", rij.ThemaNaam);
        Assert.Equal(5, rij.ThemaDuurWeken);
        Assert.Equal("natuur; seizoenen", rij.ThemaInvalshoeken);
        Assert.Equal(["blad", "tak", "boom"], rij.Kernwoordenschat);
        Assert.Equal(["fotosynthese", "bladval"], rij.RijkeWoordenschat);
        Assert.Equal(["NC-1.1", "NC-1.2"], rij.Themadoelen);
        Assert.Equal("Bladeren", rij.SubthemaNaam);
        Assert.Equal(2, rij.SubthemaDuurWeken);
        Assert.Equal("K3", rij.SubthemaKlas);
        Assert.Equal("5-6", rij.SubthemaLeeftijd);
        Assert.Equal("Waarom vallen bladeren?", rij.SubthemaProbleemstelling);
        Assert.Equal("Wat gebeurt er in de herfst?", rij.SubthemaOnderzoeksvraag);
        Assert.Equal(["WO-2.3"], rij.Subdoelen);
        Assert.Equal("Bladeren zoeken", rij.ActiviteitNaam);
        Assert.Equal(ActiviteitType.Uitstap, rij.ActiviteitType);
        Assert.Equal("ontdektafel", rij.ActiviteitHoek);
        Assert.Equal("De kleuter benoemt drie soorten bladeren.", rij.ActiviteitVerwachteUitkomsten);
        Assert.Equal(2, rij.RijNummer);
    }

    [Fact]
    public void Parses_a_multi_level_file_with_several_subthemas_and_activiteiten()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(subthemaNaam: "Bladeren", activiteitNaam: "Bladeren zoeken", activiteitType: "uitstap")
            .MetRij(subthemaNaam: "Bladeren", activiteitNaam: "Bladpers maken", activiteitType: "experiment")
            .MetRij(subthemaNaam: "Paddenstoelen", klas: "K3", leeftijd: "5-6",
                    activiteitNaam: "Sporenprint", activiteitType: "waarneming"));

        Assert.True(result.IsGeldig);
        Assert.Equal(3, result.Rijen.Count);
        Assert.Equal(
            ["Bladeren zoeken", "Bladpers maken", "Sporenprint"],
            result.Rijen.Select(r => r.ActiviteitNaam));
    }

    [Theory]
    [InlineData("experiment", ActiviteitType.Experiment)]
    [InlineData("prentenboek", ActiviteitType.Prentenboek)]
    [InlineData("hoek", ActiviteitType.Hoek)]
    [InlineData("uitstap", ActiviteitType.Uitstap)]
    [InlineData("spel", ActiviteitType.Spel)]
    [InlineData("waarneming", ActiviteitType.Waarneming)]
    [InlineData("beweging", ActiviteitType.Beweging)]
    [InlineData("onderzoek", ActiviteitType.Onderzoek)]
    public void Maps_each_activiteittype_word_via_the_single_source(string woord, ActiviteitType verwacht)
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(activiteitType: woord));

        var rij = Assert.Single(result.Rijen);
        Assert.Equal(verwacht, rij.ActiviteitType);
    }

    [Fact]
    public void Maps_activiteittype_case_insensitively()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(activiteitType: "UITSTAP"));

        var rij = Assert.Single(result.Rijen);
        Assert.Equal(ActiviteitType.Uitstap, rij.ActiviteitType);
    }

    [Fact]
    public void Reports_an_unknown_activiteittype_rather_than_dropping_silently()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(activiteitType: "knutselen"));

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(2, probleem.RijNummer);
        Assert.Equal(SchoolcontentKolom.ActiviteitType, probleem.Kolom);
        Assert.Contains("knutselen", probleem.Melding);
        Assert.False(result.IsGeldig);
    }

    [Theory]
    [InlineData(SchoolcontentKolom.ThemaNaam)]
    [InlineData(SchoolcontentKolom.SubthemaNaam)]
    [InlineData(SchoolcontentKolom.ActiviteitNaam)]
    public void Reports_a_missing_required_text_field_with_the_row_number(SchoolcontentKolom kolom)
    {
        var builder = kolom switch
        {
            SchoolcontentKolom.ThemaNaam => new SchoolcontentWorkbookBuilder().MetHeader().MetRij(themaNaam: null),
            SchoolcontentKolom.SubthemaNaam => new SchoolcontentWorkbookBuilder().MetHeader().MetRij(subthemaNaam: null),
            _ => new SchoolcontentWorkbookBuilder().MetHeader().MetRij(activiteitNaam: null),
        };

        var result = Parse(builder);

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(2, probleem.RijNummer);
        Assert.Equal(kolom, probleem.Kolom);
        Assert.Contains(SchoolcontentKolommen.Label(kolom), probleem.Melding);
    }

    [Fact]
    public void Reports_a_subthema_missing_its_required_klas_scope_Art_IX_2()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(klas: null));

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(SchoolcontentKolom.SubthemaKlas, probleem.Kolom);
        Assert.Contains("Klas", probleem.Melding);
    }

    [Fact]
    public void Reports_a_subthema_missing_its_required_leeftijd_scope_Art_IX_2()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(leeftijd: null));

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(SchoolcontentKolom.SubthemaLeeftijd, probleem.Kolom);
        Assert.Contains("Leeftijd", probleem.Melding);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("nul")]
    [InlineData("0")]
    [InlineData("-3")]
    [InlineData("2,5")]
    public void Reports_an_invalid_thema_duurWeken(string? waarde)
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(themaDuurWeken: waarde));

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(SchoolcontentKolom.ThemaDuurWeken, probleem.Kolom);
    }

    [Fact]
    public void Reports_every_problem_on_a_row_so_the_teacher_can_fix_them_all_at_once()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(themaNaam: null, klas: null, activiteitType: "knutselen"));

        Assert.Empty(result.Rijen);
        Assert.Equal(3, result.Problemen.Count);
        Assert.All(result.Problemen, p => Assert.Equal(2, p.RijNummer));
        Assert.Contains(result.Problemen, p => p.Kolom == SchoolcontentKolom.ThemaNaam);
        Assert.Contains(result.Problemen, p => p.Kolom == SchoolcontentKolom.SubthemaKlas);
        Assert.Contains(result.Problemen, p => p.Kolom == SchoolcontentKolom.ActiviteitType);
    }

    [Fact]
    public void Continues_after_a_bad_row_and_collects_every_good_row_report_dont_drop()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(activiteitNaam: "Goed 1")
            .MetRij(activiteitNaam: "Slecht", activiteitType: "knutselen")
            .MetRij(activiteitNaam: "Goed 2")
            .MetRij(themaNaam: null, activiteitNaam: "Slecht 2")
            .MetRij(activiteitNaam: "Goed 3"));

        Assert.Equal(["Goed 1", "Goed 2", "Goed 3"], result.Rijen.Select(r => r.ActiviteitNaam));
        Assert.Equal(2, result.Problemen.Count);
        Assert.Equal([3, 5], result.Problemen.Select(p => p.RijNummer));
        Assert.False(result.IsGeldig);
    }

    [Fact]
    public void Reports_a_missing_required_header_column_and_does_not_process_data_rows()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeaderZonder(SchoolcontentKolom.SubthemaKlas)
            .MetRij());

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(1, probleem.RijNummer);
        Assert.Contains(SchoolcontentKolommen.Label(SchoolcontentKolom.SubthemaKlas), probleem.Melding);
        Assert.False(result.IsGeldig);
    }

    [Fact]
    public void Lists_all_missing_required_header_columns()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeaderZonder(SchoolcontentKolom.SubthemaKlas, SchoolcontentKolom.ActiviteitType)
            .MetRij());

        var probleem = Assert.Single(result.Problemen);
        Assert.Contains(SchoolcontentKolommen.Label(SchoolcontentKolom.SubthemaKlas), probleem.Melding);
        Assert.Contains(SchoolcontentKolommen.Label(SchoolcontentKolom.ActiviteitType), probleem.Melding);
    }

    [Fact]
    public void Accepts_a_header_that_omits_only_optional_columns()
    {
        // Optional columns (e.g. probleemstelling) absent from the header is fine.
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeaderZonder(SchoolcontentKolom.SubthemaProbleemstelling, SchoolcontentKolom.ActiviteitHoek)
            .MetRij());

        Assert.True(result.IsGeldig);
        Assert.Single(result.Rijen);
    }

    [Fact]
    public void Skips_fully_blank_rows_between_data_rows()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder()
            .MetHeader()
            .MetRij(activiteitNaam: "A1")
            .MetLegeRij()
            .MetRij(activiteitNaam: "A2"));

        Assert.True(result.IsGeldig);
        Assert.Equal(["A1", "A2"], result.Rijen.Select(r => r.ActiviteitNaam));
    }

    [Fact]
    public void Trims_surrounding_whitespace_on_fields()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(
            themaNaam: "  Herfst  ",
            subthemaNaam: "  Bladeren  ",
            activiteitNaam: "  Zoeken  "));

        var rij = Assert.Single(result.Rijen);
        Assert.Equal("Herfst", rij.ThemaNaam);
        Assert.Equal("Bladeren", rij.SubthemaNaam);
        Assert.Equal("Zoeken", rij.ActiviteitNaam);
    }

    [Fact]
    public void Treats_a_whitespace_required_field_as_missing()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(themaNaam: "   "));

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(SchoolcontentKolom.ThemaNaam, probleem.Kolom);
    }

    [Fact]
    public void Treats_whitespace_optional_cells_as_null()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(
            invalshoeken: "   ",
            probleemstelling: "\t",
            onderzoeksvraag: " ",
            hoek: "",
            verwachteUitkomsten: "  "));

        var rij = Assert.Single(result.Rijen);
        Assert.Null(rij.ThemaInvalshoeken);
        Assert.Null(rij.SubthemaProbleemstelling);
        Assert.Null(rij.SubthemaOnderzoeksvraag);
        Assert.Null(rij.ActiviteitHoek);
        Assert.Null(rij.ActiviteitVerwachteUitkomsten);
    }

    [Fact]
    public void Yields_empty_lists_for_absent_or_blank_list_columns()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(
            kernwoordenschat: null,
            rijkeWoordenschat: "  ",
            themadoelen: ";;",
            subdoelen: null));

        var rij = Assert.Single(result.Rijen);
        Assert.Empty(rij.Kernwoordenschat);
        Assert.Empty(rij.RijkeWoordenschat);
        Assert.Empty(rij.Themadoelen);
        Assert.Empty(rij.Subdoelen);
    }

    [Fact]
    public void Splits_and_trims_list_columns_dropping_empty_entries()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(
            kernwoordenschat: " blad ; tak ;; boom ; "));

        var rij = Assert.Single(result.Rijen);
        Assert.Equal(["blad", "tak", "boom"], rij.Kernwoordenschat);
    }

    [Fact]
    public void Reports_a_file_with_no_header_row()
    {
        using var stream = SchoolcontentWorkbookBuilder.LeegWerkboek();
        var result = Parser.Parse(stream);

        Assert.Empty(result.Rijen);
        var probleem = Assert.Single(result.Problemen);
        Assert.False(result.IsGeldig);
    }

    [Fact]
    public void Reports_a_header_only_file_as_valid_with_no_rows()
    {
        // A header but no data rows is not an error — it simply yields nothing to commit.
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader());

        Assert.True(result.IsGeldig);
        Assert.Empty(result.Rijen);
    }

    [Fact]
    public void Rejects_a_null_stream()
    {
        Assert.Throws<ArgumentNullException>(() => Parser.Parse(null!));
    }

    /// <summary>
    /// The offending column travels to the caller as a <b>Dutch label</b>, not only as an enum member
    /// (E1-13, FR-1.2). Added because the alternative was for the import screen to keep its own
    /// enum-name to column-label table, which would have put a second copy of the Excel layout outside
    /// this assembly and broken Art. III.3's single-source rule from the outside.
    /// </summary>
    [Fact]
    public void Names_the_offending_column_in_Dutch_from_the_single_source()
    {
        var result = Parse(new SchoolcontentWorkbookBuilder().MetHeader().MetRij(activiteitType: "zwemmen"));

        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(SchoolcontentKolom.ActiviteitType, probleem.Kolom);
        Assert.Equal(SchoolcontentKolommen.Label(SchoolcontentKolom.ActiviteitType), probleem.KolomLabel);
    }

    /// <summary>A file-level problem names no column, so the label must be absent rather than invented.</summary>
    [Fact]
    public void Leaves_the_column_label_null_for_a_file_level_problem()
    {
        using var stream = SchoolcontentWorkbookBuilder.LeegWerkboek();
        var result = Parser.Parse(stream);

        var probleem = Assert.Single(result.Problemen);
        Assert.Null(probleem.Kolom);
        Assert.Null(probleem.KolomLabel);
        // Row 0 means "the file, not a row". Pinned because a renderer that prints it verbatim says "rij 0".
        Assert.Equal(0, probleem.RijNummer);
    }
}
