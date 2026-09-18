using System.Data.Common;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Persistence;
using Jaarplanner.Infrastructure.Toegang;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The invitation gate against real PostgreSQL (E6-01, ADR-0031 decisions 3 and 7). On Postgres rather than in memory
/// because two of its guarantees are unique indexes: one invitation per address, and one invitation per Entra account.
/// </summary>
public sealed class ToegangServiceTests : IAsyncLifetime
{
    private static readonly Guid School = Guid.Parse("11111111-2222-3333-4444-555555555555");
    private static readonly Guid AndereSchool = Guid.Parse("99999999-2222-3333-4444-555555555555");

    private PostgresTestDatabase _db = null!;

    public async Task InitializeAsync()
    {
        if (PostgresTestDatabase.IsBeschikbaar)
        {
            _db = await PostgresTestDatabase.MaakAsync("toegang");
        }
    }

    public async Task DisposeAsync()
    {
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task De_eerste_aanmelding_koppelt_de_uitnodiging_ongeacht_hoofdletters()
    {
        var uitnodiging = await NodigUitAsync("an.peeters@school.be");
        var objectId = Guid.NewGuid();

        var resultaat = await Dienst().MeldAanMetEntraAsync(Lid(objectId, "An.Peeters@SCHOOL.be", "An Peeters"), School);

        Assert.Null(resultaat.Weigering);
        Assert.Equal(uitnodiging.Id, resultaat.Gebruiker!.Id);
        Assert.Equal("An Peeters", resultaat.Gebruiker.Naam);
        await using var context = _db.MaakContext();
        var bewaard = await context.Gebruikers.SingleAsync(g => g.Id == uitnodiging.Id);
        Assert.Equal(School, bewaard.EntraTenantId);
        Assert.Equal(objectId, bewaard.EntraObjectId);
        Assert.Equal("An Peeters", bewaard.Naam);
    }

    /*
      The three races below are provoked, not hoped for: an interceptor binds a row on its own connection just before the
      service's UPDATE runs, which is exactly the window between the service's read and its write. Each one failed to be
      noticed by any test before (antagonist, E6-01 code round 2): making the write unconditional again, or swallowing
      every database fault, left the whole suite green.
    */

    [PostgresFact]
    public async Task Een_ander_account_dat_de_uitnodiging_net_eerder_koppelde_houdt_ze()
    {
        var uitnodiging = await NodigUitAsync("an@school.be");
        var eerste = Guid.NewGuid();
        var dienst = DienstMet(new KoppeltVlakVoorDeUpdate(_db.ConnectionString, uitnodiging.Id, eerste));

        var resultaat = await dienst.MeldAanMetEntraAsync(Lid(Guid.NewGuid(), "an@school.be"), School);

        Assert.Equal(Aanmeldweigering.NietUitgenodigd, resultaat.Weigering);
        await using var context = _db.MaakContext();
        Assert.Equal(eerste, (await context.Gebruikers.SingleAsync(g => g.Id == uitnodiging.Id)).EntraObjectId);
    }

    [PostgresFact]
    public async Task Hetzelfde_account_dat_de_uitnodiging_net_eerder_koppelde_komt_binnen()
    {
        var uitnodiging = await NodigUitAsync("an@school.be");
        var objectId = Guid.NewGuid();
        var dienst = DienstMet(new KoppeltVlakVoorDeUpdate(_db.ConnectionString, uitnodiging.Id, objectId));

        var resultaat = await dienst.MeldAanMetEntraAsync(Lid(objectId, "an@school.be"), School);

        Assert.Equal(uitnodiging.Id, resultaat.Gebruiker?.Id);
    }

    [PostgresFact]
    public async Task Een_account_dat_intussen_aan_een_andere_uitnodiging_hangt_komt_binnen_als_die()
    {
        // The unique (tenant, object) index is what refuses the second binding here, and the service must read that
        // refusal as "bound elsewhere", not as a fault.
        var uitnodiging = await NodigUitAsync("an@school.be");
        var andere = await NodigUitAsync("an.oud@school.be");
        var objectId = Guid.NewGuid();
        var dienst = DienstMet(new KoppeltVlakVoorDeUpdate(_db.ConnectionString, andere.Id, objectId));

        var resultaat = await dienst.MeldAanMetEntraAsync(Lid(objectId, "an@school.be"), School);

        Assert.Equal(andere.Id, resultaat.Gebruiker?.Id);
        await using var context = _db.MaakContext();
        Assert.Null((await context.Gebruikers.SingleAsync(g => g.Id == uitnodiging.Id)).EntraObjectId);
    }

    [PostgresFact]
    public async Task Een_gekoppeld_account_wordt_herkend_aan_tenant_en_object_ook_als_de_UPN_verandert()
    {
        await NodigUitAsync("an@school.be");
        var objectId = Guid.NewGuid();
        await Dienst().MeldAanMetEntraAsync(Lid(objectId, "an@school.be"), School);

        var resultaat = await Dienst().MeldAanMetEntraAsync(Lid(objectId, "an.nieuw@school.be"), School);

        Assert.NotNull(resultaat.Gebruiker);
    }

    [PostgresFact]
    public async Task Een_gekoppelde_uitnodiging_kan_niet_door_een_ander_account_met_dezelfde_UPN_genomen_worden()
    {
        await NodigUitAsync("an@school.be");
        await Dienst().MeldAanMetEntraAsync(Lid(Guid.NewGuid(), "an@school.be"), School);

        // The address was reassigned to another member after the binding: they must not inherit An's account.
        var resultaat = await Dienst().MeldAanMetEntraAsync(Lid(Guid.NewGuid(), "an@school.be"), School);

        Assert.Equal(Aanmeldweigering.NietUitgenodigd, resultaat.Weigering);
    }

    [PostgresFact]
    public async Task Zonder_uitnodiging_geen_toegang()
    {
        var resultaat = await Dienst().MeldAanMetEntraAsync(Lid(Guid.NewGuid(), "iemand@school.be"), School);

        Assert.Equal(Aanmeldweigering.NietUitgenodigd, resultaat.Weigering);
    }

    [PostgresFact]
    public async Task Een_account_uit_een_andere_tenant_wordt_geweigerd_ook_met_een_passende_uitnodiging()
    {
        await NodigUitAsync("an@school.be");

        var resultaat = await Dienst().MeldAanMetEntraAsync(
            new EntraIdentiteit(AndereSchool, Guid.NewGuid(), "an@school.be", "An", IsLid: true), School);

        Assert.Equal(Aanmeldweigering.AndereTenant, resultaat.Weigering);
        await AssertNietGekoppeldAsync("an@school.be");
    }

    [PostgresFact]
    public async Task Een_gast_of_een_token_zonder_acct_wordt_geweigerd()
    {
        await NodigUitAsync("an@school.be");

        var resultaat = await Dienst().MeldAanMetEntraAsync(
            new EntraIdentiteit(School, Guid.NewGuid(), "an@school.be", "An", IsLid: false), School);

        Assert.Equal(Aanmeldweigering.GeenLid, resultaat.Weigering);
        await AssertNietGekoppeldAsync("an@school.be");
    }

    [PostgresFact]
    public async Task Een_onvolledige_identiteit_wordt_geweigerd()
    {
        var resultaat = await Dienst().MeldAanMetEntraAsync(
            new EntraIdentiteit(School, ObjectId: null, "an@school.be", "An", IsLid: true), School);

        Assert.Equal(Aanmeldweigering.OnvolledigeIdentiteit, resultaat.Weigering);
    }

    [PostgresFact]
    public async Task Een_adres_kan_maar_een_keer_uitgenodigd_worden_ongeacht_hoofdletters()
    {
        await NodigUitAsync("an@school.be");

        await Assert.ThrowsAsync<DbUpdateException>(() => NodigUitAsync("AN@school.be"));
    }

    [PostgresFact]
    public async Task De_eerste_admin_komt_er_alleen_in_een_lege_tabel()
    {
        var eerste = await Dienst().ZorgVoorEersteAdminAsync("admin@school.be");
        var tweede = await Dienst().ZorgVoorEersteAdminAsync("iemand.anders@school.be");

        Assert.True(eerste);
        Assert.False(tweede);
        var gebruikers = await Dienst().HaalGebruikersOpAsync();
        var admin = Assert.Single(gebruikers);
        Assert.True(admin.IsAdmin);
        Assert.Equal("admin@school.be", admin.Email);
    }

    [PostgresFact]
    public async Task Zonder_admin_maar_met_andere_gebruikers_gaat_de_opstartdeur_niet_opnieuw_open()
    {
        // The last admin was removed and only a leerkracht remains: configuration must not mint a new admin.
        await NodigUitAsync("leerkracht@school.be");

        var aangemaakt = await Dienst().ZorgVoorEersteAdminAsync("admin@school.be");

        Assert.False(aangemaakt);
        Assert.DoesNotContain(await Dienst().HaalGebruikersOpAsync(), g => g.IsAdmin);
    }

    private ToegangService Dienst() => new(_db.MaakContext());

    private ToegangService DienstMet(DbCommandInterceptor interceptor) =>
        new(new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(_db.ConnectionString)
            .AddInterceptors(interceptor)
            .Options));

    /// <summary>
    /// Binds one row to the school's tenant and <c>objectId</c> on a connection of its own, once, just before the first
    /// UPDATE of <c>gebruikers</c> runs: the moment another first login would have won the race.
    /// </summary>
    private sealed class KoppeltVlakVoorDeUpdate : DbCommandInterceptor
    {
        private readonly string _verbinding;
        private readonly Guid _gebruikerId;
        private readonly Guid _objectId;
        private bool _gedaan;

        public KoppeltVlakVoorDeUpdate(string verbinding, Guid gebruikerId, Guid objectId)
        {
            _verbinding = verbinding;
            _gebruikerId = gebruikerId;
            _objectId = objectId;
        }

        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (!_gedaan
                && command.CommandText.Contains("UPDATE", StringComparison.OrdinalIgnoreCase)
                && command.CommandText.Contains("gebruikers", StringComparison.Ordinal))
            {
                _gedaan = true;
                await using var verbinding = new NpgsqlConnection(_verbinding);
                await verbinding.OpenAsync(cancellationToken);
                await using var koppel = verbinding.CreateCommand();
                koppel.CommandText = "UPDATE gebruikers SET \"EntraTenantId\" = @t, \"EntraObjectId\" = @o WHERE \"Id\" = @id";
                koppel.Parameters.AddWithValue("t", School);
                koppel.Parameters.AddWithValue("o", _objectId);
                koppel.Parameters.AddWithValue("id", _gebruikerId);
                await koppel.ExecuteNonQueryAsync(cancellationToken);
            }

            return result;
        }
    }

    private static EntraIdentiteit Lid(Guid objectId, string upn, string? naam = null) =>
        new(School, objectId, upn, naam, IsLid: true);

    private async Task<Gebruiker> NodigUitAsync(string email)
    {
        await using var context = _db.MaakContext();
        var gebruiker = new Gebruiker(email, naam: string.Empty, isAdmin: false);
        context.Gebruikers.Add(gebruiker);
        await context.SaveChangesAsync();
        return gebruiker;
    }

    private async Task AssertNietGekoppeldAsync(string email)
    {
        await using var context = _db.MaakContext();
        var gebruiker = await context.Gebruikers.SingleAsync(g => g.Email == email);
        Assert.Null(gebruiker.EntraObjectId);
    }
}
