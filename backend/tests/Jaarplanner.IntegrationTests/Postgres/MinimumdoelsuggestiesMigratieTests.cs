using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-053's migration deletes every thema-level leerplandoel doelsuggestie, open and accepted (owner ruling
/// 2026-09-16), and nothing else. Proven by stepping the database back one migration, writing rows in the old shape
/// with SQL (the current model no longer has them), and migrating up.
/// </summary>
public sealed class MinimumdoelsuggestiesMigratieTests : IAsyncLifetime
{
    private const string VorigeMigratie = "20260916221228_Subdoelplaatsing";

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("minimumdoelsuggesties");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task De_migratie_verwijdert_de_leerplandoel_doelsuggesties_en_laat_de_rest_staan()
    {
        Guid themaId;
        await using (var context = _db.MaakContext())
        {
            context.Leerplandoelen.Add(
                new Leerplandoel("MIG-53", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9.1", tekst: "Tekst"));
            context.Minimumdoelen.Add(new Minimumdoel("MIG-K-53", "K-", "53", "Een kleuterdoel."));
            var thema = new Thema("Water", 4);
            thema.KoppelMinimumdoel("MIG-K-53");
            thema.VoegSubthemaToe("Regen", 2, "K3").VoegSubdoelToe("K3", new DoelKoppeling("MIG-53", KoppelingStatus.Manueel));
            context.Themas.Add(thema);
            await context.SaveChangesAsync();
            themaId = thema.Id;

            await context.GetService<IMigrator>().MigrateAsync(VorigeMigratie);

            // An open and an accepted doelsuggestie in the shape the old table had.
            await context.Database.ExecuteSqlInterpolatedAsync($"""
                INSERT INTO thema_doelsuggesties ("ThemaId", "Id", leerplandoel_code, status, ai_motivatie)
                VALUES ({themaId}, {Guid.NewGuid()}, 'MIG-53', 'Voorgesteld', 'past'),
                       ({themaId}, {Guid.NewGuid()}, 'MIG-53', 'Aanvaard', 'past');
                """);
            Assert.Equal(2, await AantalAsync(context, "SELECT COUNT(*) FROM thema_doelsuggesties"));
        }

        await using (var context = _db.MaakContext())
        {
            await context.Database.MigrateAsync();

            Assert.Equal(0, await AantalAsync(context, "SELECT COUNT(*) FROM pg_tables WHERE tablename = 'thema_doelsuggesties'"));
            Assert.Equal(1, await AantalAsync(context, "SELECT COUNT(*) FROM pg_tables WHERE tablename = 'thema_minimumdoelsuggesties'"));
        }

        await using var na = _db.MaakContext();
        var geladen = await na.Themas
            .Include(t => t.Doelsuggesties)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .SingleAsync(t => t.Id == themaId);
        Assert.Empty(geladen.Doelsuggesties);
        // The thema, its minimumdoel, its subdoel and the read-only goals are untouched.
        Assert.Equal("MIG-K-53", Assert.Single(geladen.Minimumdoelen).MinimumdoelRef);
        Assert.Equal("MIG-53", Assert.Single(Assert.Single(geladen.Subthemas).Subdoelen).Koppeling.LeerplandoelCode);
        Assert.True(await na.Leerplandoelen.AnyAsync(l => l.Code == "MIG-53"));
    }

    private static async Task<long> AantalAsync(DbContext context, string sql)
    {
        var verbinding = context.Database.GetDbConnection();
        var wasOpen = verbinding.State == System.Data.ConnectionState.Open;
        if (!wasOpen)
        {
            await verbinding.OpenAsync();
        }

        try
        {
            await using var opdracht = verbinding.CreateCommand();
            // The statement is a constant of this test, never input.
            opdracht.CommandText = sql;
            return (long)(await opdracht.ExecuteScalarAsync())!;
        }
        finally
        {
            if (!wasOpen)
            {
                await verbinding.CloseAsync();
            }
        }
    }
}
