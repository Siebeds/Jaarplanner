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

    /// <summary>
    /// <see cref="Sluitingssoort"/> must still differentiate two closures after a round-trip — and this is the
    /// only test that would notice if it stopped.
    /// <para>
    /// <b>Why it is needed.</b> Every other persistence test constructs a <see cref="Schoolsluiting"/> without a
    /// soort, which defaults to <see cref="Sluitingssoort.Vakantie"/> (= enum 0). So deleting the column mapping
    /// in <c>SchooljaarConfiguration</c> would leave all of them green while silently turning every persisted
    /// <see cref="Sluitingssoort.VrijeDag"/> back into a <see cref="Sluitingssoort.Vakantie"/> — reinstating
    /// exactly the one-week-sliver defect the directie ruling of 2026-07-28 was issued to kill (ADR-0020). The
    /// domain behaviour is unit-tested, but *storage* is the layer the E1 reopening proved cannot be taken on
    /// trust from the in-memory provider.
    /// </para>
    /// </summary>
    [PostgresFact]
    public async Task Sluitingssoort_blijft_onderscheiden_en_alleen_een_vakantie_breekt_de_periode()
    {
        var vrijeDag = new DateOnly(2029, 5, 21); // Pinkstermaandag

        var schooljaar = new Schooljaar("2028-2029", new DateOnly(2028, 9, 1), new DateOnly(2029, 6, 30));
        schooljaar.VoegSluitingToe(new Schoolsluiting(
            "Herfstvakantie", new DateOnly(2028, 10, 30), new DateOnly(2028, 11, 5), Sluitingssoort.Vakantie));
        schooljaar.VoegSluitingToe(new Schoolsluiting(
            "Pinkstermaandag", vrijeDag, vrijeDag, Sluitingssoort.VrijeDag));

        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(schooljaar);
            await context.SaveChangesAsync();
        }

        await using (var context = _db.MaakContext())
        {
            var opnieuw = await context.Schooljaren.SingleAsync();

            // Both closures came back — and, the point of the test, they came back *different*.
            Assert.Equal(["Herfstvakantie", "Pinkstermaandag"], opnieuw.Sluitingen.Select(s => s.Naam));
            Assert.Equal(Sluitingssoort.Vakantie, opnieuw.Sluitingen[0].Soort);
            Assert.Equal(Sluitingssoort.VrijeDag, opnieuw.Sluitingen[1].Soort);

            // The consequence that actually matters: only the vakantie cuts the teaching year, so the
            // Pinkstermaandag week stays one plannable period instead of splitting into slivers.
            Assert.Equal(["Herfstvakantie"], opnieuw.Vakanties.Select(v => v.Naam));
            Assert.Equal(2, opnieuw.Lesperiodes().Count);

            // The free day is still a non-teaching day, and it sits *inside* a stretch rather than ending one.
            Assert.False(opnieuw.IsLesdag(vrijeDag));
            Assert.Contains(opnieuw.Lesperiodes(), p => p.Start <= vrijeDag && vrijeDag <= p.Eind);
        }

        await using (var context = _db.MaakContext())
        {
            // Stored by name, not as an int (SchooljaarConfiguration: "legible in the database"). Asserted in
            // raw SQL because an int mapping would satisfy the round-trip above while losing that legibility.
            var soorten = await context.Database
                .SqlQueryRaw<string>("SELECT \"Soort\" AS \"Value\" FROM schoolsluitingen ORDER BY \"Start\"")
                .ToListAsync();

            Assert.Equal(["Vakantie", "VrijeDag"], soorten);
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
