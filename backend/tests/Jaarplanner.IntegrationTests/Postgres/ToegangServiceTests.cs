using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Toegang;
using Jaarplanner.Infrastructure.Toegang;
using Microsoft.EntityFrameworkCore;

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
    public async Task De_eerste_directie_komt_er_alleen_in_een_lege_tabel()
    {
        var eerste = await Dienst().ZorgVoorEersteDirectieAsync("directie@school.be");
        var tweede = await Dienst().ZorgVoorEersteDirectieAsync("iemand.anders@school.be");

        Assert.True(eerste);
        Assert.False(tweede);
        var gebruikers = await Dienst().HaalGebruikersOpAsync();
        var directie = Assert.Single(gebruikers);
        Assert.True(directie.IsDirectie);
        Assert.Equal("directie@school.be", directie.Email);
    }

    [PostgresFact]
    public async Task Zonder_directie_maar_met_andere_gebruikers_gaat_de_opstartdeur_niet_opnieuw_open()
    {
        // The last directie was removed and only a leerkracht remains: configuration must not mint a new directie.
        await NodigUitAsync("leerkracht@school.be");

        var aangemaakt = await Dienst().ZorgVoorEersteDirectieAsync("directie@school.be");

        Assert.False(aangemaakt);
        Assert.DoesNotContain(await Dienst().HaalGebruikersOpAsync(), g => g.IsDirectie);
    }

    private ToegangService Dienst() => new(_db.MaakContext());

    private static EntraIdentiteit Lid(Guid objectId, string upn, string? naam = null) =>
        new(School, objectId, upn, naam, IsLid: true);

    private async Task<Gebruiker> NodigUitAsync(string email)
    {
        await using var context = _db.MaakContext();
        var gebruiker = new Gebruiker(email, naam: string.Empty, isDirectie: false);
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
