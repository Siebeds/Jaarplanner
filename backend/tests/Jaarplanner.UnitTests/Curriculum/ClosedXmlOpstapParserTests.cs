using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.OpstapImport;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Thorough coverage of the highest-risk Op.stap Excel parser (Art. V.6). Pins the A–M
/// column→field mapping, nullable cluster, empty/whitespace cells → null, hidden-column
/// tolerance, doelsoort code mapping (MD/G/+/P/S/A), the B+C minimumdoelRef key, and that
/// malformed rows are reported rather than silently dropped (ADR-0006 §4).
/// </summary>
public class ClosedXmlOpstapParserTests
{
    private static readonly IOpstapParser Parser = new ClosedXmlOpstapParser();

    private static OpstapParseResult Parse(OpstapWorkbookBuilder builder, string discipline = "1")
    {
        using var stream = builder.Bouw();
        return Parser.Parse(stream, discipline);
    }

    [Fact]
    public void Maps_every_A_to_M_column_to_the_right_field()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetRij(
                doelsoort: "MD",
                leeftijdMd: "6-",
                nummerMd: "34",
                minimumdoelRef: "6-34",
                code: "WIS-2.7",
                jaarFase: "L4",
                domein: "Getallen",
                subdomein: "Bewerkingen",
                cluster: "Hoofdrekenen",
                tekst: "De leerling rekent vlot uit het hoofd.",
                voorbeelden: "23 + 19",
                toelichting: "Strategisch rekenen.",
                woordenschat: "som, verschil"));

        Assert.True(result.IsSchoon);
        var doel = Assert.Single(result.Leerplandoelen);

        Assert.Equal("WIS-2.7", doel.Code);
        Assert.Equal(Doelsoort.Minimumdoel, doel.Doelsoort);
        Assert.Equal("L4", doel.JaarFase);
        Assert.Equal("Getallen", doel.Domein);
        Assert.Equal("Bewerkingen", doel.Subdomein);
        Assert.Equal("Hoofdrekenen", doel.Cluster);
        Assert.Equal("De leerling rekent vlot uit het hoofd.", doel.Tekst);
        Assert.Equal("23 + 19", doel.Voorbeelden);
        Assert.Equal("Strategisch rekenen.", doel.Toelichting);
        Assert.Equal("som, verschil", doel.Woordenschat);
        Assert.Equal("6-34", doel.MinimumdoelRef);
        Assert.Equal("1", doel.DisciplineNummer);
    }

    [Theory]
    [InlineData("MD", Doelsoort.Minimumdoel)]
    [InlineData("G", Doelsoort.Gemeenschappelijk)]
    [InlineData("+", Doelsoort.Verdieping)]
    [InlineData("P", Doelsoort.Precurriculum)]
    [InlineData("S", Doelsoort.Specifiek)]
    [InlineData("A", Doelsoort.AnderstaligeNieuwkomers)]
    public void Maps_each_doelsoort_short_code_via_the_single_source(string code, Doelsoort expected)
    {
        var result = Parse(new OpstapWorkbookBuilder().MetHeader().MetRij(doelsoort: code));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Equal(expected, doel.Doelsoort);
    }

    [Fact]
    public void Treats_an_empty_cluster_as_null()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetHeader().MetRij(cluster: null));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Null(doel.Cluster);
    }

    [Fact]
    public void Treats_whitespace_optional_cells_as_null()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetHeader().MetRij(
            cluster: "   ",
            voorbeelden: "\t",
            toelichting: " ",
            woordenschat: ""));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Null(doel.Cluster);
        Assert.Null(doel.Voorbeelden);
        Assert.Null(doel.Toelichting);
        Assert.Null(doel.Woordenschat);
    }

    [Fact]
    public void Uses_column_D_for_the_minimumdoelRef_when_present()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetHeader().MetRij(
            leeftijdMd: "K-",
            nummerMd: "5",
            minimumdoelRef: "K-5"));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Equal("K-5", doel.MinimumdoelRef);
    }

    [Fact]
    public void Derives_the_minimumdoelRef_from_B_plus_C_when_column_D_is_empty()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetHeader().MetRij(
            leeftijdMd: "4-",
            nummerMd: "12",
            minimumdoelRef: null));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Equal("4-12", doel.MinimumdoelRef);
    }

    [Fact]
    public void Leaves_the_minimumdoelRef_null_when_the_row_carries_no_concordance()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetHeader().MetRij(
            doelsoort: "+",
            leeftijdMd: null,
            nummerMd: null,
            minimumdoelRef: null));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Null(doel.MinimumdoelRef);
    }

    [Fact]
    public void Tolerates_hidden_columns_and_still_reads_their_values()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetRij(cluster: "Verborgen cluster", woordenschat: "verborgen woord")
            .MetVerborgenKolom(OpstapKolom.Cluster)
            .MetVerborgenKolom(OpstapKolom.Woordenschat));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Equal("Verborgen cluster", doel.Cluster);
        Assert.Equal("verborgen woord", doel.Woordenschat);
    }

    [Fact]
    public void Skips_the_header_row_and_blank_rows()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetLegeRij()
            .MetRij(code: "A-1")
            .MetLegeRij()
            .MetRij(code: "A-2"));

        Assert.True(result.IsSchoon);
        Assert.Equal(2, result.Leerplandoelen.Count);
        Assert.Equal(["A-1", "A-2"], result.Leerplandoelen.Select(l => l.Code));
    }

    [Fact]
    public void Parses_a_file_with_no_header_row()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetRij(code: "NC-9"));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Equal("NC-9", doel.Code);
    }

    [Fact]
    public void Reports_an_unknown_doelsoort_code_in_the_body_rather_than_dropping_it()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetRij(code: "OK-1")
            .MetRij(doelsoort: "ZZ", code: "BAD-1"));

        Assert.Single(result.Leerplandoelen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(3, probleem.RijNummer);
        Assert.Equal("BAD-1", probleem.Code);
        Assert.Contains("doelsoort", probleem.Reden, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Reports_a_row_missing_a_required_field_rather_than_dropping_it()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetRij(code: "GOOD-1")
            .MetRij(code: null, tekst: "Tekst zonder code"));

        Assert.Single(result.Leerplandoelen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal(3, probleem.RijNummer);
        Assert.Contains("code", probleem.Reden, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Reports_a_row_missing_the_tekst_rather_than_dropping_it()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetRij(code: "NOTEKST", tekst: null));

        Assert.Empty(result.Leerplandoelen);
        var probleem = Assert.Single(result.Problemen);
        Assert.Equal("NOTEKST", probleem.Code);
        Assert.Contains("tekst", probleem.Reden, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Continues_after_a_bad_row_and_collects_every_good_row()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetRij(code: "G1")
            .MetRij(doelsoort: "ZZ", code: "B1")
            .MetRij(code: "G2")
            .MetRij(code: null)
            .MetRij(code: "G3"));

        Assert.Equal(["G1", "G2", "G3"], result.Leerplandoelen.Select(l => l.Code));
        Assert.Equal(2, result.Problemen.Count);
        Assert.False(result.IsSchoon);
    }

    [Fact]
    public void Exposes_distinct_minimumdoelRefs_for_the_concordance_builder()
    {
        var result = Parse(new OpstapWorkbookBuilder()
            .MetHeader()
            .MetRij(code: "R1", leeftijdMd: "6-", nummerMd: "1", minimumdoelRef: "6-1")
            .MetRij(code: "R2", leeftijdMd: "6-", nummerMd: "1", minimumdoelRef: "6-1")
            .MetRij(code: "R3", leeftijdMd: "4-", nummerMd: "2", minimumdoelRef: "4-2")
            .MetRij(code: "R4", doelsoort: "+", leeftijdMd: null, nummerMd: null, minimumdoelRef: null));

        Assert.Equal(["6-1", "4-2"], result.MinimumdoelRefs);
    }

    [Fact]
    public void Carries_the_supplied_discipline_number_onto_every_row()
    {
        var result = Parse(
            new OpstapWorkbookBuilder().MetHeader().MetRij(code: "X1").MetRij(code: "X2"),
            discipline: "9.2");

        Assert.Equal("9.2", result.DisciplineNummer);
        Assert.All(result.Leerplandoelen, l => Assert.Equal("9.2", l.DisciplineNummer));
    }

    [Fact]
    public void Trims_surrounding_whitespace_on_mapped_fields()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetHeader().MetRij(
            code: "  CODE-1  ",
            domein: "  Getallen  ",
            tekst: "  De leerling telt.  "));

        var doel = Assert.Single(result.Leerplandoelen);
        Assert.Equal("CODE-1", doel.Code);
        Assert.Equal("Getallen", doel.Domein);
        Assert.Equal("De leerling telt.", doel.Tekst);
    }

    [Fact]
    public void Returns_an_empty_result_for_an_empty_sheet()
    {
        var result = Parse(new OpstapWorkbookBuilder().MetLegeRij());

        Assert.Empty(result.Leerplandoelen);
        Assert.Empty(result.Problemen);
        Assert.True(result.IsSchoon);
    }

    [Fact]
    public void Rejects_a_blank_discipline_number()
    {
        using var stream = new OpstapWorkbookBuilder().MetHeader().MetRij().Bouw();
        Assert.Throws<ArgumentException>(() => Parser.Parse(stream, "  "));
    }
}
