using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-043's migration deletes every themadoel that links a leerplandoel (owner ruling 2026-09-16) and nothing else.
/// Proven by stepping the database back one migration, writing rows in the old shape, and migrating up.
/// </summary>
public sealed class ThemaMinimumdoelenMigratieTests : IAsyncLifetime
{
    private const string VorigeMigratie = "20260916074540_HerschrijvingGeweigerd";

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("themaminimumdoelen");
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task De_migratie_verwijdert_de_leerplandoel_themadoelen_en_laat_de_rest_staan()
    {
        Guid themaId;
        await using (var context = _db.MaakContext())
        {
            context.Leerplandoelen.AddRange(
                new Leerplandoel("MIG-01", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9.1", tekst: "Tekst"),
                new Leerplandoel("MIG-02", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9.1", tekst: "Tekst"));
            var thema = new Thema("Water", 4);
            thema.VoegThemadoelToe(new DoelKoppeling("MIG-01", KoppelingStatus.Manueel));
            thema.VoegThemadoelToe(new DoelKoppeling("MIG-02", KoppelingStatus.Aanvaard));
            thema.VoegSubthemaToe("Regen", 2, "K3").VoegSubdoelToe("K3", new DoelKoppeling("MIG-01", KoppelingStatus.Manueel));
            context.Themas.Add(thema);
            await context.SaveChangesAsync();
            themaId = thema.Id;

            await context.GetService<IMigrator>().MigrateAsync(VorigeMigratie);
        }

        await using (var context = _db.MaakContext())
        {
            Assert.Equal(2, await AantalAsync(context, "themadoelen"));
            await context.Database.MigrateAsync();
        }

        await using var na = _db.MaakContext();
        var geladen = await na.Themas
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .SingleAsync(t => t.Id == themaId);
        Assert.Empty(geladen.Themadoelen);
        Assert.Empty(geladen.Minimumdoelen);
        // The thema, its subdoelen and the read-only leerplandoelen are untouched.
        Assert.Empty(geladen.Doelsuggesties);
        Assert.Equal("MIG-01", Assert.Single(Assert.Single(geladen.Subthemas).Subdoelen).Koppeling.LeerplandoelCode);
        Assert.Equal(2, await na.Leerplandoelen.CountAsync(l => l.Code.StartsWith("MIG-")));
    }

    private static async Task<long> AantalAsync(DbContext context, string tabel)
    {
        var verbinding = context.Database.GetDbConnection();
        await verbinding.OpenAsync();
        try
        {
            await using var opdracht = verbinding.CreateCommand();
            // The table name is a constant of this test, never input.
            opdracht.CommandText = $"SELECT COUNT(*) FROM {tabel}";
            return (long)(await opdracht.ExecuteScalarAsync())!;
        }
        finally
        {
            await verbinding.CloseAsync();
        }
    }
}
