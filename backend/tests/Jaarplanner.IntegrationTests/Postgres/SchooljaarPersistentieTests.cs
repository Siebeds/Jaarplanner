using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Persistence of <see cref="Schooljaar"/> and its owned <see cref="Schoolsluiting"/> collection (E3-05,
/// Art. IX.3) against real PostgreSQL — owned collections, <c>DateOnly</c> → <c>date</c> mapping and
/// cascade behaviour are all things the EF in-memory provider cannot honestly verify.
/// </summary>
public sealed class SchooljaarPersistentieTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("schooljaar");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Schooljaar_met_vakanties_rondtript()
    {
        var schooljaar = new Schooljaar("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Herfstvakantie", new DateOnly(2026, 11, 2), new DateOnly(2026, 11, 8)));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Kerstvakantie", new DateOnly(2026, 12, 21), new DateOnly(2027, 1, 3)));

        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(schooljaar);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Schooljaren.SingleAsync();

            Assert.Equal("2026-2027", opnieuw.Naam);
            Assert.Equal(new DateOnly(2026, 9, 1), opnieuw.Start);
            Assert.Equal(new DateOnly(2027, 6, 30), opnieuw.Eind);

            // The owned collection loads with its owner and stays ordered by start date.
            Assert.Equal(["Herfstvakantie", "Kerstvakantie"], opnieuw.Vakanties.Select(v => v.Naam));

            // And the derived teaching stretches survive the round-trip — the input the grid is built from.
            Assert.Equal(3, opnieuw.Lesperiodes().Count);
        }
    }

    /// <summary>One school year per label — a second "2026-2027" is a data-entry mistake, not a new year.</summary>
    [PostgresFact]
    public async Task Schooljaarnaam_is_uniek()
    {
        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(new Schooljaar("2026-2027", new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30)));
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(new Schooljaar("2026-2027", new DateOnly(2026, 9, 2), new DateOnly(2027, 6, 29)));

            var ex = await Assert.ThrowsAsync<DbUpdateException>(() => context.SaveChangesAsync());
            Assert.Equal("23505", Assert.IsType<Npgsql.PostgresException>(ex.InnerException).SqlState);
        }
    }

    /// <summary>
    /// Deleting a school year takes its vacations with it: they are owned and have no independent
    /// lifetime. Verifies the cascade is real, not merely configured.
    /// </summary>
    [PostgresFact]
    public async Task Verwijderen_neemt_de_vakanties_mee()
    {
        var schooljaar = new Schooljaar("2027-2028", new DateOnly(2027, 9, 1), new DateOnly(2028, 6, 30));
        schooljaar.VoegSluitingToe(new Schoolsluiting("Krokusvakantie", new DateOnly(2028, 2, 14), new DateOnly(2028, 2, 20)));

        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(schooljaar);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Remove(await context.Schooljaren.SingleAsync());
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            Assert.Empty(await context.Schooljaren.ToListAsync());
            var resterend = await context.Database
                .SqlQueryRaw<int>("SELECT COUNT(*)::int AS \"Value\" FROM schoolsluitingen")
                .SingleAsync();
            Assert.Equal(0, resterend);
        }
    }
}
