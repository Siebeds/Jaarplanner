using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.PlanningBeheer;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// <see cref="SchoolurenService"/> over the in-memory provider (FB-023). What matters beyond the domain's own rules is
/// that a replace is all or nothing and that a weekday left out loses its hours.
/// </summary>
public sealed class SchoolurenServiceTests
{
    private readonly DbContextOptions<AppDbContext> _options = new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase($"schooluren_{Guid.NewGuid():N}")
        .Options;

    // A fresh service over a fresh context per operation, mirroring the scoped-per-request lifetime.
    private SchoolurenService Service() => new(new AppDbContext(_options));

    private static TimeOnly T(int uur, int minuut = 0) => new(uur, minuut);

    private static SchooldagurenInvoer Dag(int weekdag, TimeOnly begin, TimeOnly einde, TimeOnly? pb = null, TimeOnly? pe = null) =>
        new(weekdag, begin, einde, pb, pe);

    [Fact]
    public async Task Een_school_zonder_uren_leest_een_lege_lijst()
    {
        Assert.Empty((await Service().HaalOpAsync()).Dagen);
    }

    [Fact]
    public async Task Bewaarde_uren_worden_teruggelezen_maandag_eerst()
    {
        await Service().VervangAsync(new SchoolurenInvoer([
            Dag(3, T(8, 30), T(12)),
            Dag(1, T(8, 30), T(15, 30), T(12), T(13, 15)),
        ]));

        var dagen = (await Service().HaalOpAsync()).Dagen;

        Assert.Equal([1, 3], dagen.Select(d => d.Weekdag));
        Assert.Equal(new SchooldagurenWeergave(1, T(8, 30), T(15, 30), T(12), T(13, 15)), dagen[0]);
        Assert.Equal(new SchooldagurenWeergave(3, T(8, 30), T(12), null, null), dagen[1]);
    }

    [Fact]
    public async Task Opnieuw_bewaren_wijzigt_een_dag_en_een_weggelaten_dag_verliest_zijn_uren()
    {
        await Service().VervangAsync(new SchoolurenInvoer([Dag(1, T(8, 30), T(15, 30)), Dag(2, T(8, 30), T(15, 30))]));

        await Service().VervangAsync(new SchoolurenInvoer([Dag(1, T(8, 45), T(15, 45))]));

        var dagen = (await Service().HaalOpAsync()).Dagen;
        Assert.Equal([new SchooldagurenWeergave(1, T(8, 45), T(15, 45), null, null)], dagen);
    }

    [Fact]
    public async Task Een_geweigerde_dag_laat_alle_uren_staan()
    {
        await Service().VervangAsync(new SchoolurenInvoer([Dag(1, T(8, 30), T(15, 30))]));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().VervangAsync(new SchoolurenInvoer([
            Dag(1, T(9), T(16)),
            Dag(2, T(15, 30), T(8, 30)),
        ])));

        Assert.Equal("Op dinsdag moet de schooldag na het begin eindigen. Kies een later einduur.", fout.Message);
        Assert.Equal([new SchooldagurenWeergave(1, T(8, 30), T(15, 30), null, null)], (await Service().HaalOpAsync()).Dagen);
    }

    [Fact]
    public async Task Een_weekdag_die_twee_keer_voorkomt_wordt_geweigerd()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().VervangAsync(
            new SchoolurenInvoer([Dag(3, T(8, 30), T(12)), Dag(3, T(8, 30), T(15, 30))])));

        Assert.Equal("Weekday 3 appears more than once in 'dagen'.", fout.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(8)]
    public async Task Een_onbekende_weekdag_wordt_geweigerd(int weekdag)
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VervangAsync(new SchoolurenInvoer([Dag(weekdag, T(8, 30), T(12))])));

        Assert.Equal("'weekdag' must be an ISO weekday number, 1 (Monday) to 7 (Sunday).", fout.Message);
    }

    [Fact]
    public async Task Een_zaterdag_krijgt_de_zin_van_het_domein()
    {
        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(
            () => Service().VervangAsync(new SchoolurenInvoer([Dag(6, T(8, 30), T(12))])));

        Assert.Equal("Schooluren gelden alleen voor maandag tot vrijdag.", fout.Message);
    }

    [Fact]
    public async Task Een_verzoek_zonder_lijst_wist_niets()
    {
        await Service().VervangAsync(new SchoolurenInvoer([Dag(1, T(8, 30), T(15, 30))]));

        var fout = await Assert.ThrowsAsync<SchoolcontentValidatieFout>(() => Service().VervangAsync(new SchoolurenInvoer(null)));

        Assert.Equal("The request has no 'dagen' list.", fout.Message);
        Assert.Single((await Service().HaalOpAsync()).Dagen);
    }

    [Fact]
    public async Task Een_lege_lijst_wist_alle_uren()
    {
        await Service().VervangAsync(new SchoolurenInvoer([Dag(1, T(8, 30), T(15, 30))]));

        await Service().VervangAsync(new SchoolurenInvoer([]));

        Assert.Empty((await Service().HaalOpAsync()).Dagen);
    }
}
