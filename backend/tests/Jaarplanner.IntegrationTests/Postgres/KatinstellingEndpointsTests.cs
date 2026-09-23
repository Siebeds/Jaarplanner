using System.Net;
using System.Net.Http.Json;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Whether the school shows Chuck, over HTTP against real PostgreSQL (FB-071, ADR-0065): off until admin turns him on,
/// read by everyone, changed by admin alone.
/// </summary>
public sealed class KatinstellingEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("katinstelling");
        _factory = new PostgresApiFactory(_db.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    private sealed record KatinstellingDto(bool IsZichtbaar);

    [PostgresFact]
    public async Task Chuck_staat_uit_tot_admin_hem_aanzet_en_blijft_dan_aan()
    {
        var opzet = new RechtenTestOpzet(_db, _factory);
        using var admin = opzet.Als(await opzet.GebruikerAsync(admin: true));

        Assert.False((await admin.GetFromJsonAsync<KatinstellingDto>("/api/kat/instelling"))!.IsZichtbaar);

        (await admin.PutAsJsonAsync("/api/kat/instelling", new { isZichtbaar = true })).EnsureSuccessStatusCode();
        Assert.True((await admin.GetFromJsonAsync<KatinstellingDto>("/api/kat/instelling"))!.IsZichtbaar);

        // A second change goes through the update path: the one row already exists.
        (await admin.PutAsJsonAsync("/api/kat/instelling", new { isZichtbaar = false })).EnsureSuccessStatusCode();
        Assert.False((await admin.GetFromJsonAsync<KatinstellingDto>("/api/kat/instelling"))!.IsZichtbaar);
    }

    [PostgresFact]
    public async Task Een_leerkracht_leest_de_instelling_maar_kan_ze_niet_wijzigen()
    {
        var opzet = new RechtenTestOpzet(_db, _factory);
        var school = await opzet.SchoolAsync();
        using var admin = opzet.Admin();
        (await admin.PutAsJsonAsync("/api/kat/instelling", new { isZichtbaar = true })).EnsureSuccessStatusCode();

        // Themabeheer and a hoofdleerkracht too: only admin holds the row.
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(
            school, themabeheer: true, hoofdleerkrachtVan: ["K3"], klassen: [school.K3Blauw]));

        Assert.True((await leerkracht.GetFromJsonAsync<KatinstellingDto>("/api/kat/instelling"))!.IsZichtbaar);
        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PutAsJsonAsync("/api/kat/instelling", new { isZichtbaar = false }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);

        Assert.True((await admin.GetFromJsonAsync<KatinstellingDto>("/api/kat/instelling"))!.IsZichtbaar);
    }
}
