using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the coverage-critical concordance build (Art. V.6): leerplandoel refs (Excel D = B+C)
/// resolve to known minimumdoelen, a missing ref is skipped, and a ref that matches no known
/// minimumdoel (e.g. a partial B-only/C-only key) is surfaced as orphaned — never a phantom link
/// (Art. III.5). Also covers a minimumdoel concorded by multiple leerplandoelen (one-to-many).
/// </summary>
public class ConcordantieBouwerTests
{
    private static Leerplandoel Doel(string code, string? minimumdoelRef) =>
        new(
            code: code,
            doelsoort: Doelsoort.Minimumdoel,
            jaarFase: "L1",
            domein: "Getallen",
            subdomein: "Getalbegrip",
            disciplineNummer: "2",
            tekst: "tekst",
            minimumdoelRef: minimumdoelRef);

    [Fact]
    public void Bouw_links_a_leerplandoel_to_its_known_minimumdoel()
    {
        var resultaat = ConcordantieBouwer.Bouw(
            [Doel("LP-1", "6-12")],
            ["6-12"]);

        Assert.True(resultaat.IsVolledig);
        var link = Assert.Single(resultaat.Links);
        Assert.Equal("LP-1", link.LeerplandoelCode);
        Assert.Equal("6-12", link.MinimumdoelRef);
        Assert.Empty(resultaat.VerweesdeRefs);
    }

    [Fact]
    public void Bouw_skips_a_leerplandoel_without_a_ref()
    {
        var resultaat = ConcordantieBouwer.Bouw(
            [Doel("LP-1", minimumdoelRef: null)],
            ["6-12"]);

        Assert.Empty(resultaat.Links);
        Assert.Empty(resultaat.VerweesdeRefs);
        Assert.True(resultaat.IsVolledig);
    }

    [Fact]
    public void Bouw_surfaces_an_orphaned_ref_without_creating_a_phantom_link()
    {
        // "6-" is a partial key (B present, C blank) that matches no real minimumdoel.
        var resultaat = ConcordantieBouwer.Bouw(
            [Doel("LP-1", "6-")],
            ["6-12", "4-3"]);

        Assert.Empty(resultaat.Links);
        var orphan = Assert.Single(resultaat.VerweesdeRefs);
        Assert.Equal("LP-1", orphan.LeerplandoelCode);
        Assert.Equal("6-", orphan.MinimumdoelRef);
        Assert.False(resultaat.IsVolledig);
    }

    [Fact]
    public void Bouw_links_multiple_leerplandoelen_to_the_same_minimumdoel()
    {
        var resultaat = ConcordantieBouwer.Bouw(
            [Doel("LP-1", "6-12"), Doel("LP-2", "6-12"), Doel("LP-3", "4-3")],
            ["6-12", "4-3"]);

        Assert.True(resultaat.IsVolledig);
        Assert.Equal(3, resultaat.Links.Count);

        var voorMd = resultaat.Links
            .Where(l => l.MinimumdoelRef == "6-12")
            .Select(l => l.LeerplandoelCode)
            .OrderBy(c => c)
            .ToList();
        Assert.Equal(["LP-1", "LP-2"], voorMd);
    }

    [Fact]
    public void Bouw_separates_resolvable_links_from_orphans_in_a_mixed_set()
    {
        var resultaat = ConcordantieBouwer.Bouw(
            [Doel("LP-1", "6-12"), Doel("LP-2", "9-99"), Doel("LP-3", null)],
            ["6-12"]);

        Assert.Single(resultaat.Links);
        Assert.Equal("LP-1", resultaat.Links[0].LeerplandoelCode);

        var orphan = Assert.Single(resultaat.VerweesdeRefs);
        Assert.Equal("LP-2", orphan.LeerplandoelCode);
    }
}
