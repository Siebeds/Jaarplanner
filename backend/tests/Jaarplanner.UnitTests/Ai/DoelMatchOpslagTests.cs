using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.AiMatching;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.UnitTests.Ai;

/// <summary>
/// Persistence round-trip for a thema's doelsuggesties (FB-053, FR-4.1/4.2, Art. IV.2): drives the real EF Core mapping
/// through <see cref="EfDoelMatchOpslag"/> to prove that a proposal of a minimumdoel persists as <c>voorgesteld</c>, is
/// queryable per thema with its minimumdoel's text, and that accepting one stores the themadoel beside it. Uses the EF
/// Core in-memory provider; <c>DoelsuggestieEndpointsTests</c> covers the same against the API.
/// </summary>
public sealed class DoelMatchOpslagTests
{
    private static DbContextOptions<AppDbContext> Options(string db) =>
        new DbContextOptionsBuilder<AppDbContext>().UseInMemoryDatabase(db).Options;

    [Fact]
    public async Task Voorstellen_persisteren_als_voorgesteld_en_een_aanvaard_voorstel_wordt_een_themadoel()
    {
        var options = Options($"fb053_{Guid.NewGuid():N}");
        Guid themaId;

        await using (var ctx = new AppDbContext(options))
        {
            ctx.Minimumdoelen.AddRange(
                new Minimumdoel("K-1.1.1", "K-", "1.1.1", "De kleuters kunnen rijm herkennen."),
                new Minimumdoel("K-2.1.1", "K-", "2.1.1", "De kleuters kunnen tellen."));
            var thema = new Thema("Herfst", duurWeken: 4);
            ctx.Themas.Add(thema);
            await ctx.SaveChangesAsync();
            themaId = thema.Id;
        }

        // Load tracked through the port, add two proposals, commit.
        await using (var ctx = new AppDbContext(options))
        {
            var opslag = new EfDoelMatchOpslag(ctx);
            var thema = await opslag.LaadThemaAsync(themaId);
            Assert.NotNull(thema);

            thema!.VoegDoelsuggestieToe("K-1.1.1", "Het thema speelt met rijmpjes.");
            thema.VoegDoelsuggestieToe("K-2.1.1", "Bladeren tellen.");
            await opslag.BewaarAsync();
        }

        // Accept one in a fresh unit of work: the new themadoel is added to a loaded collection and must insert.
        await using (var ctx = new AppDbContext(options))
        {
            var opslag = new EfDoelMatchOpslag(ctx);
            var thema = (await opslag.LaadThemaAsync(themaId))!;
            thema.AanvaardDoelsuggestie(thema.Doelsuggesties.Single(s => s.MinimumdoelRef == "K-1.1.1"));
            await opslag.BewaarAsync();
        }

        await using (var ctx = new AppDbContext(options))
        {
            var opslag = new EfDoelMatchOpslag(ctx);
            var suggesties = await opslag.HaalSuggestiesVoorThemaAsync(themaId);

            Assert.Equal(["K-1.1.1", "K-2.1.1"], suggesties.Select(s => s.MinimumdoelRef));
            var aanvaard = suggesties[0];
            Assert.Equal("Aanvaard", aanvaard.Status);
            Assert.Equal("Het thema speelt met rijmpjes.", aanvaard.AiMotivatie);
            Assert.Equal("De kleuters kunnen rijm herkennen.", aanvaard.Omschrijving);
            Assert.Equal("K-", aanvaard.Mijlpaal);
            Assert.Equal("Voorgesteld", suggesties[1].Status);

            var thema = await ctx.Themas.SingleAsync(t => t.Id == themaId);
            Assert.Equal("K-1.1.1", Assert.Single(thema.Minimumdoelen).MinimumdoelRef);
        }
    }

    [Fact]
    public async Task Het_query_pad_volgt_de_rang_en_niet_de_code()
    {
        // Owner ruling 2026-09-16 (ADR-0052 D6): the model's order, best fit first.
        var options = Options($"fb053_{Guid.NewGuid():N}");
        Guid themaId;
        await using (var ctx = new AppDbContext(options))
        {
            var thema = new Thema("Herfst", duurWeken: 4);
            thema.VoegDoelsuggestieToe("K-9.1.1", "best passend");
            thema.VoegDoelsuggestieToe("K-1.1.1", "tweede");
            thema.VoegDoelsuggestieToe("K-5.1.1", "derde");
            ctx.Themas.Add(thema);
            await ctx.SaveChangesAsync();
            themaId = thema.Id;
        }

        await using (var ctx = new AppDbContext(options))
        {
            var suggesties = await new EfDoelMatchOpslag(ctx).HaalSuggestiesVoorThemaAsync(themaId);
            Assert.Equal(["K-9.1.1", "K-1.1.1", "K-5.1.1"], suggesties.Select(s => s.MinimumdoelRef));
        }
    }

    [Fact]
    public async Task Query_pad_geeft_lege_lijst_voor_onbekend_thema()
    {
        await using var ctx = new AppDbContext(Options($"fb053_{Guid.NewGuid():N}"));
        var opslag = new EfDoelMatchOpslag(ctx);

        Assert.Empty(await opslag.HaalSuggestiesVoorThemaAsync(Guid.NewGuid()));
    }
}
