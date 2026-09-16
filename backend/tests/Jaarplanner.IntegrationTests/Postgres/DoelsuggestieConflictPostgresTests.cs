using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.AiMatching;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Accepting a proposal while someone links the same minimumdoel by hand (FB-053): the unique index on
/// <c>thema_minimumdoelen</c> refuses the second link, and the store turns that into a
/// <see cref="DoelsuggestieConflictFout"/> (a 409 with a Dutch sentence) instead of a 500.
/// </summary>
public sealed class DoelsuggestieConflictPostgresTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("doelsuggestieconflict");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Aanvaarden_terwijl_iemand_hetzelfde_minimumdoel_koppelt_geeft_een_conflict_en_geen_500()
    {
        Guid themaId;
        await using (var context = _db.MaakContext())
        {
            context.Minimumdoelen.Add(new Minimumdoel("CONF-K-1", "K-", "1", "Een kleuterdoel."));
            var thema = new Thema("Water", 4);
            thema.VoegDoelsuggestieToe("CONF-K-1", "past");
            context.Themas.Add(thema);
            await context.SaveChangesAsync();
            themaId = thema.Id;
        }

        await using var eerste = _db.MaakContext();
        var opslag = new EfDoelMatchOpslag(eerste);
        var geladen = (await opslag.LaadThemaAsync(themaId))!;

        // Meanwhile a person links the same minimumdoel by hand.
        await using (var tweede = _db.MaakContext())
        {
            var thema = await tweede.Themas.SingleAsync(t => t.Id == themaId);
            tweede.ThemaMinimumdoelen.Add(thema.KoppelMinimumdoel("CONF-K-1"));
            await tweede.SaveChangesAsync();
        }

        geladen.AanvaardDoelsuggestie(Assert.Single(geladen.Doelsuggesties));
        var fout = await Assert.ThrowsAsync<DoelsuggestieConflictFout>(() => opslag.BewaarAsync());

        Assert.Equal("Dit minimumdoel is intussen al gekoppeld of voorgesteld bij dit thema. Laad de pagina opnieuw.", fout.Message);
        await using var na = _db.MaakContext();
        Assert.Equal(1, await na.ThemaMinimumdoelen.CountAsync(m => m.ThemaId == themaId));
        Assert.Equal(KoppelingStatus.Voorgesteld, (await na.Minimumdoelsuggesties.SingleAsync(s => s.ThemaId == themaId)).Status);
    }
}
