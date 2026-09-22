using Jaarplanner.Infrastructure.Kat;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The cat's tick against real PostgreSQL (TB-057, ADR-0059 D1): two instances that wake on the same moment, and only
/// one of them runs the round. The claim is the primary key of <see cref="Kattik"/>, so this is the database's own
/// guarantee and not the application's; that is exactly why it is tested here and not with a fake.
/// </summary>
public sealed class KattikPostgresTests : IAsyncLifetime
{
    private static readonly DateTimeOffset Moment = new(2026, 9, 22, 5, 0, 0, TimeSpan.Zero);

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("kattik");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Twee_instanties_verwerken_samen_maar_een_tik()
    {
        // Two processes, each with its own context, racing the same scheduled moment.
        var geslaagd = 0;
        var mislukt = 0;

        await Task.WhenAll(Enumerable.Range(0, 2).Select(async nummer =>
        {
            await using var context = _db.MaakContext();
            context.Kattikken.Add(new Kattik(Moment, $"instantie-{nummer}", DateTimeOffset.UtcNow));
            try
            {
                await context.SaveChangesAsync();
                Interlocked.Increment(ref geslaagd);
            }
            catch (DbUpdateException)
            {
                Interlocked.Increment(ref mislukt);
            }
        }));

        Assert.Equal(1, geslaagd);
        Assert.Equal(1, mislukt);

        await using var nalezen = _db.MaakContext();
        Assert.Equal(1, await nalezen.Kattikken.CountAsync(t => t.Moment == Moment));
    }

    [PostgresFact]
    public async Task Een_volgende_tik_is_een_eigen_rij()
    {
        await using var context = _db.MaakContext();
        context.Kattikken.Add(new Kattik(Moment, "instantie-a", DateTimeOffset.UtcNow));
        context.Kattikken.Add(new Kattik(Moment.AddHours(12), "instantie-a", DateTimeOffset.UtcNow));

        await context.SaveChangesAsync();

        Assert.Equal(2, await context.Kattikken.CountAsync());
    }

    [PostgresFact]
    public async Task Een_voltooide_ronde_laat_zien_dat_ze_afraakte()
    {
        await using var context = _db.MaakContext();
        var tik = new Kattik(Moment, "instantie-a", DateTimeOffset.UtcNow);
        context.Kattikken.Add(tik);
        await context.SaveChangesAsync();

        tik.MarkeerVoltooid(Moment.AddMinutes(2));
        await context.SaveChangesAsync();

        // An interrupted round leaves this null, which is how the log tells the two apart.
        var opgeslagen = await context.Kattikken.SingleAsync();
        Assert.NotNull(opgeslagen.Voltooid);
    }
}
