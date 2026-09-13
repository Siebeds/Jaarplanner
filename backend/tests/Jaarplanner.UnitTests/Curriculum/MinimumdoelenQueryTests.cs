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

    /// <summary>
    /// E1-22: a minimumdoel no loaded leerplandoel concords is listed, once, without a bucket and after every bucket.
    /// Before E1-22 the inner join hid it, and right after the minimumdoelen import that was every one of them.
    /// </summary>
    [Fact]
    public async Task Een_minimumdoel_zonder_geconcordeerd_leerplandoel_staat_als_laatste_in_de_lijst_zonder_bucket()
    {
        var options = Options();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Disciplines.Add(new Discipline("2", "Wiskunde"));
            ctx.Minimumdoelen.AddRange(
                new Minimumdoel("6-7.1.6", "6-", "7.1.6", "De leerlingen kunnen zwemmen."),
                new Minimumdoel("4-2.1.7", "4-", "2.1.7", "De leerlingen kunnen tellen tot 1000."));
            ctx.Leerplandoelen.Add(Leerdoel("2.1.GL3.10", "4-2.1.7", "2", "Getallen", "Tellen"));
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var pagina = await new MinimumdoelenQuery(query).ZoekAsync(new MinimumdoelFilter());

        Assert.Equal(2, pagina.Totaal);
        Assert.Equal(["4-2.1.7", "6-7.1.6"], pagina.Regels.Select(r => r.Ref).ToArray());

        var zonder = pagina.Regels[1];
        Assert.Null(zonder.DisciplineNummer);
        Assert.Null(zonder.DisciplineNaam);
        Assert.Null(zonder.Domein);
        Assert.Null(zonder.Subdomein);
        Assert.Empty(zonder.LeerplandoelCodes);
        Assert.Equal("Wiskunde", pagina.Regels[0].DisciplineNaam);
    }

    /// <summary>Right after the minimumdoelen import no leerplandoel exists yet, and the register still lists every minimumdoel.</summary>
    [Fact]
    public async Task Zonder_enig_leerplandoel_staan_alle_minimumdoelen_in_de_lijst()
    {
        var options = Options();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Minimumdoelen.AddRange(
                new Minimumdoel("K-1.3.9", "K-", "1.3.9", "Mondelinge interactie."),
                new Minimumdoel("4-2.1.7", "4-", "2.1.7", "Tellen tot 1000."),
                new Minimumdoel("6-2.5.4", "6-", "2.5.4", "Kansen berekenen."));
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        var pagina = await sut.ZoekAsync(new MinimumdoelFilter());
        var facetten = await sut.HaalFacettenAsync(new MinimumdoelFilter());

        Assert.Equal(3, pagina.Totaal);
        Assert.All(pagina.Regels, r => Assert.Null(r.DisciplineNummer));
        Assert.Equal(3, facetten.TotaalAantalMinimumdoelen);
        Assert.Equal(3, facetten.AantalTreffers);
        Assert.Equal(3, facetten.AantalZonderLeerplandoel);
        Assert.Empty(facetten.Disciplines);
        Assert.Empty(facetten.Domeinen);
        Assert.Empty(facetten.JaarFasen);
    }

    /// <summary>
    /// The taxonomy dimensions exist only through a concorded goal, so filtering on one drops a minimumdoel without a
    /// bucket rather than matching it on a null.
    /// </summary>
    [Fact]
    public async Task Een_taxonomiefilter_laat_een_minimumdoel_zonder_leerplandoel_weg()
    {
        var options = Options();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Disciplines.Add(new Discipline("1", "Nederlands"));
            ctx.Minimumdoelen.AddRange(
                new Minimumdoel("K-01", "K-", "1", "Met een leerplandoel."),
                new Minimumdoel("K-02", "K-", "2", "Zonder leerplandoel."));
            ctx.Leerplandoelen.Add(Leerdoel("NL-001", "K-01", "1", "Taal", "Lezen"));
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        foreach (var filter in new[]
                 {
                     new MinimumdoelFilter(Discipline: "1"),
                     new MinimumdoelFilter(Domein: "Taal"),
                     new MinimumdoelFilter(Domein: "Taal", Subdomein: "Lezen"),
                     new MinimumdoelFilter(JaarFase: "K3"),
                 })
        {
            var pagina = await sut.ZoekAsync(filter);
            var facetten = await sut.HaalFacettenAsync(filter);

            Assert.Equal(["K-01"], pagina.Regels.Select(r => r.Ref).ToArray());
            Assert.Equal(1, facetten.AantalTreffers);
            Assert.Equal(0, facetten.AantalZonderLeerplandoel);
        }
    }

    /// <summary>
    /// The header count of the register is minimumdoelen, not rows: a minimumdoel in two buckets counts once, and one
    /// without a bucket counts too. Summing the domein facets (what the screen did before E1-22) gives rows.
    /// </summary>
    [Fact]
    public async Task Facetten_tellen_de_treffers_per_minimumdoel_en_niet_per_bucket()
    {
        var options = Options();

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Disciplines.AddRange(new Discipline("1", "Nederlands"), new Discipline("2", "Wiskunde"));
            ctx.Minimumdoelen.AddRange(
                new Minimumdoel("K-10", "K-", "10", "In twee buckets."),
                new Minimumdoel("K-11", "K-", "11", "In een bucket."),
                new Minimumdoel("K-12", "K-", "12", "Zonder bucket."));
            ctx.Leerplandoelen.AddRange(
                Leerdoel("NL-010", "K-10", "1", "Taal", "Lezen"),
                Leerdoel("WIS-010", "K-10", "2", "Getallen", "Optellen"),
                Leerdoel("NL-011", "K-11", "1", "Taal", "Schrijven"));
            await ctx.SaveChangesAsync();
        }

        await using var query = new AppDbContext(options);
        var sut = new MinimumdoelenQuery(query);

        var facetten = await sut.HaalFacettenAsync(new MinimumdoelFilter());
        var pagina = await sut.ZoekAsync(new MinimumdoelFilter());

        Assert.Equal(3, facetten.TotaalAantalMinimumdoelen);
        Assert.Equal(3, facetten.AantalTreffers);
        Assert.Equal(1, facetten.AantalZonderLeerplandoel);
        Assert.Equal(3, facetten.Domeinen.Sum(d => d.Aantal)); // rows in buckets: K-10 twice, K-11 once
        Assert.Equal(4, pagina.Totaal); // every row the register lists: three in buckets, one without
        Assert.DoesNotContain(facetten.Disciplines, d => string.IsNullOrEmpty(d.Nummer));
        Assert.DoesNotContain(facetten.Domeinen, d => string.IsNullOrEmpty(d.Domein));
    }
}
