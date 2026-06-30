using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Exercises the persisted concordance bidirectionally (the E1-04 <i>Done when</i>): given a
/// minimumdoel → its concorded leerplandoelen; given a leerplandoel → its minimumdoel. Uses the
/// EF Core in-memory provider so the query runs without Docker. The structural FK that forbids a
/// phantom link is pinned by CurriculumModelConfigurationTests; here the query's own no-match
/// handling (orphaned/absent ref → null/empty) is asserted (Art. III.5, V.1–2).
/// </summary>
public sealed class ConcordantieQueryTests : IDisposable
{
    private readonly AppDbContext _context;
    private readonly ConcordantieQuery _query;

    public ConcordantieQueryTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"concordantie_{Guid.NewGuid():N}")
            .Options;
        _context = new AppDbContext(options);
        _query = new ConcordantieQuery(_context);
    }

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

    private async Task SeedAsync(params object[] entities)
    {
        _context.AddRange(entities);
        await _context.SaveChangesAsync();
    }

    [Fact]
    public async Task Forward_returns_all_leerplandoelen_concorded_to_a_minimumdoel()
    {
        await SeedAsync(
            new Minimumdoel("6-12", "6-", "12", "eindterm"),
            Doel("LP-1", "6-12"),
            Doel("LP-2", "6-12"),
            Doel("LP-3", null));

        var leerplandoelen = await _query.LeerplandoelenVoorMinimumdoelAsync("6-12");

        Assert.Equal(["LP-1", "LP-2"], leerplandoelen.Select(l => l.Code).ToArray());
    }

    [Fact]
    public async Task Reverse_returns_the_minimumdoel_for_a_concorded_leerplandoel()
    {
        await SeedAsync(
            new Minimumdoel("4-3", "4-", "3", "eindterm"),
            Doel("LP-1", "4-3"));

        var minimumdoel = await _query.MinimumdoelVoorLeerplandoelAsync("LP-1");

        Assert.NotNull(minimumdoel);
        Assert.Equal("4-3", minimumdoel!.Ref);
    }

    [Fact]
    public async Task Reverse_returns_null_for_a_leerplandoel_without_a_ref()
    {
        await SeedAsync(Doel("LP-1", null));

        var minimumdoel = await _query.MinimumdoelVoorLeerplandoelAsync("LP-1");

        Assert.Null(minimumdoel);
    }

    [Fact]
    public async Task Reverse_returns_null_when_the_ref_matches_no_minimumdoel()
    {
        // A leerplandoel carrying a ref with no matching minimumdoel row yields no phantom link.
        await SeedAsync(Doel("LP-1", "9-99"));

        var minimumdoel = await _query.MinimumdoelVoorLeerplandoelAsync("LP-1");

        Assert.Null(minimumdoel);
    }

    [Fact]
    public async Task Forward_returns_empty_for_an_unknown_minimumdoel()
    {
        await SeedAsync(new Minimumdoel("6-12", "6-", "12", "eindterm"), Doel("LP-1", "6-12"));

        var leerplandoelen = await _query.LeerplandoelenVoorMinimumdoelAsync("0-0");

        Assert.Empty(leerplandoelen);
    }

    [Fact]
    public async Task Lookups_are_consistent_in_both_directions()
    {
        await SeedAsync(
            new Minimumdoel("6-12", "6-", "12", "eindterm"),
            Doel("LP-1", "6-12"),
            Doel("LP-2", "6-12"));

        var leerplandoelen = await _query.LeerplandoelenVoorMinimumdoelAsync("6-12");
        foreach (var doel in leerplandoelen)
        {
            var terug = await _query.MinimumdoelVoorLeerplandoelAsync(doel.Code);
            Assert.NotNull(terug);
            Assert.Equal("6-12", terug!.Ref);
        }
    }

    public void Dispose() => _context.Dispose();
}
