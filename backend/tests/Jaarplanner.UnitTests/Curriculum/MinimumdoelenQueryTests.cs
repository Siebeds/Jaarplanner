using Jaarplanner.Application.Curriculum;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Pins the <see cref="MinimumdoelenQuery"/> (FR-2.4 "Bekijk minimumdoelen" toggle). The load-bearing
/// behaviour: a minimumdoel appears in every (discipline, domein, subdomein) bucket that at least one of its
/// concorded leerplandoelen belongs to — it may appear in more than one bucket when its concorded goals
/// span more than one domein, and that is correct (Art. VII.0 / IX.1). Uses the in-memory provider.
/// </summary>
public sealed class MinimumdoelenQueryTests
{
    private static DbContextOptions<AppDbContext> Options() =>
        new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase($"minimumdoelen_query_{Guid.NewGuid():N}")
            .Options;

    private static Leerplandoel Leerdoel(
        string code,
        string minimumdoelRef,
        string disciplineNummer = "1",
        string domein = "Taal",
        string subdomein = "Lezen") =>
        new(code, Doelsoort.Minimumdoel, "K3", domein, subdomein, disciplineNummer, tekst: $"doel {code}", minimumdoelRef: minimumdoelRef);

    [Fact]
    public async Task Minimumdoel_verschijnt_in_elk_bucket_van_zijn_concordeerde_leerplandoelen()
    {
        var options = Options();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Disciplines.Add(new Discipline("1", "Nederlands"));
            ctx.Disciplines.Add(new Discipline("2", "Wiskunde"));

            ctx.Minimumdoelen.Add(new Minimumdoel("K-01", "K-", "1", "De leerling begrijpt teksten."));

            // Two leerplandoelen concorded to the same minimumdoel, but in different (discipline, domein, subdomein).
            ctx.Leerplandoelen.AddRange(
                Leerdoel("NL-K3-01", "K-01", "1", "Taal", "Lezen"),
                Leerdoel("WIS-K3-01", "K-01", "2", "Getallen", "Tellen"));

            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        var pagina = await sut.ZoekAsync(new MinimumdoelFilter());

        // The minimumdoel appears twice: once in each bucket.
        Assert.Equal(2, pagina.Totaal);
        Assert.Equal(2, pagina.Regels.Count);

        var taalbucket = pagina.Regels.Single(r => r.DisciplineNummer == "1");
        Assert.Equal("K-01", taalbucket.Ref);
        Assert.Equal("Taal", taalbucket.Domein);
        Assert.Equal("Lezen", taalbucket.Subdomein);
        Assert.Contains("NL-K3-01", taalbucket.LeerplandoelCodes);

        var wisbucket = pagina.Regels.Single(r => r.DisciplineNummer == "2");
        Assert.Equal("K-01", wisbucket.Ref);
        Assert.Equal("Getallen", wisbucket.Domein);
        Assert.Equal("Tellen", wisbucket.Subdomein);
        Assert.Contains("WIS-K3-01", wisbucket.LeerplandoelCodes);
    }

    [Fact]
    public async Task Filter_op_discipline_beperkt_de_resultaten()
    {
        var options = Options();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Disciplines.AddRange(new Discipline("1", "Nederlands"), new Discipline("2", "Wiskunde"));
            ctx.Minimumdoelen.Add(new Minimumdoel("K-02", "K-", "2", "De leerling telt tot 10."));
            ctx.Leerplandoelen.AddRange(
                Leerdoel("NL-001", "K-02", "1", "Taal", "Lezen"),
                Leerdoel("WIS-001", "K-02", "2", "Getallen", "Tellen"));
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        var pagina = await sut.ZoekAsync(new MinimumdoelFilter(Discipline: "1"));

        Assert.Equal(1, pagina.Totaal);
        Assert.Single(pagina.Regels);
        Assert.Equal("1", pagina.Regels[0].DisciplineNummer);
    }

    [Fact]
    public async Task Facetten_tellen_per_discipline_onder_de_rest_van_het_filter()
    {
        var options = Options();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Disciplines.AddRange(new Discipline("1", "Nederlands"), new Discipline("2", "Wiskunde"));
            ctx.Minimumdoelen.AddRange(
                new Minimumdoel("K-10", "K-", "10", "Minimumdoel 10."),
                new Minimumdoel("K-11", "K-", "11", "Minimumdoel 11."));
            ctx.Leerplandoelen.AddRange(
                Leerdoel("NL-010", "K-10", "1", "Taal", "Lezen"),
                Leerdoel("WIS-010", "K-10", "2", "Getallen", "Optellen"),
                Leerdoel("NL-011", "K-11", "1", "Taal", "Schrijven"));
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        var facetten = await sut.HaalFacettenAsync(new MinimumdoelFilter());

        Assert.Equal(2, facetten.TotaalAantalMinimumdoelen);
        var d1 = facetten.Disciplines.Single(d => d.Nummer == "1");
        var d2 = facetten.Disciplines.Single(d => d.Nummer == "2");
        // K-10 appears in discipline 1 (Taal/Lezen) and 2 (Getallen/Optellen); K-11 in 1 only (Taal/Schrijven).
        // Under no discipline filter: discipline 1 has 2 bucket-rows (K-10 and K-11), discipline 2 has 1.
        Assert.Equal(2, d1.Aantal);
        Assert.Equal(1, d2.Aantal);
    }
}
