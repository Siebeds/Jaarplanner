using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-012's migration gives every existing thema all nine leeftijden (ADR-0069 D1), so nothing disappears from a klas's
/// choices. Proven by stepping the database back one migration, which drops the column, and migrating up again.
/// </summary>
public sealed class ThemaLeeftijdenMigratieTests : IAsyncLifetime
{
    private const string VorigeMigratie = "20260923182940_ActiviteitplaatsingAiMotivatie";

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("themaleeftijden");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Een_bestaand_thema_geldt_na_de_migratie_voor_alle_leeftijden()
    {
        Guid themaId;
        await using (var context = _db.MaakContext())
        {
            var thema = new Thema("Water", 4);
            thema.StelLeeftijdenIn(["K3"]);
            context.Themas.Add(thema);
            await context.SaveChangesAsync();
            themaId = thema.Id;

            await context.GetService<IMigrator>().MigrateAsync(VorigeMigratie);
        }

        await using (var context = _db.MaakContext())
        {
            await context.Database.MigrateAsync();
        }

        await using var na = _db.MaakContext();
        var geladen = await na.Themas.SingleAsync(t => t.Id == themaId);
        Assert.Equal(Jaarfasen.Alle, geladen.Leeftijden);
    }

    [PostgresFact]
    public async Task Een_beperkt_thema_bewaart_zijn_leeftijden()
    {
        await using (var context = _db.MaakContext())
        {
            var thema = new Thema("Herfst", 4);
            thema.StelLeeftijdenIn(["K3", "K2"]);
            context.Themas.Add(thema);
            await context.SaveChangesAsync();
        }

        await using var na = _db.MaakContext();
        var geladen = await na.Themas.SingleAsync(t => t.Naam == "Herfst");
        Assert.Equal(["K2", "K3"], geladen.Leeftijden);
    }
}
