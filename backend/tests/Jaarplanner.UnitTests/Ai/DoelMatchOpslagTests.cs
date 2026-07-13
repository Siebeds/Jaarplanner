using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.AiMatching;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Persistence round-trip for E2-04 (FR-4.1/4.2, Art. IV.2): drives the real EF Core mapping through
/// <see cref="EfDoelMatchOpslag"/> to prove that AI match suggestions persist as <c>voorgesteld</c>
/// <c>DoelKoppeling</c> rows and are <b>queryable per thema</b>. Uses the EF Core in-memory provider
/// so the test runs in CI/dev with no Postgres container (the same choice as the E1 endpoint tests).
/// </summary>
public sealed class DoelMatchOpslagTests
{
    private static DbContextOptions<AppDbContext> Options(string db) =>
        new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(db).Options;

    [Fact]
    public async Task Suggesties_persisteren_als_voorgesteld_en_zijn_queryeerbaar_per_thema()
    {
        var options = Options($"e2_04_{Guid.NewGuid():N}");
        Guid themaId;

        // Seed a thema (the leerplandoel FK is not enforced by the in-memory provider).
        await using (var ctx = new AppDbContext(options))
        {
            var thema = new Thema("Herfst", duurWeken: 4);
            ctx.Themas.Add(thema);
            await ctx.SaveChangesAsync();
            themaId = thema.Id;
        }

        // Load tracked through the port, add two voorgesteld suggestions, commit.
        await using (var ctx = new AppDbContext(options))
        {
            var opslag = new EfDoelMatchOpslag(ctx);
            var thema = await opslag.LaadThemaAsync(themaId);
            Assert.NotNull(thema);

            thema!.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-01", KoppelingStatus.Voorgesteld, "past bij observatie"));
            thema.VoegDoelsuggestieToe(new DoelKoppeling("NAT-K3-02", KoppelingStatus.Voorgesteld, "seizoensverandering"));
            await opslag.BewaarAsync();
        }

        // Query them back per thema in a fresh context — they round-tripped as voorgesteld.
        await using (var ctx = new AppDbContext(options))
        {
            var opslag = new EfDoelMatchOpslag(ctx);
            var suggesties = await opslag.HaalSuggestiesVoorThemaAsync(themaId);

            Assert.Equal(2, suggesties.Count);
            Assert.All(suggesties, s => Assert.Equal("Voorgesteld", s.Status));
            var een = suggesties.Single(s => s.LeerplandoelCode == "NAT-K3-01");
            Assert.Equal("past bij observatie", een.AiMotivatie);
        }
    }

    [Fact]
    public async Task Query_pad_geeft_lege_lijst_voor_onbekend_thema()
    {
        await using var ctx = new AppDbContext(Options($"e2_04_{Guid.NewGuid():N}"));
        var opslag = new EfDoelMatchOpslag(ctx);

        Assert.Empty(await opslag.HaalSuggestiesVoorThemaAsync(Guid.NewGuid()));
    }
}
