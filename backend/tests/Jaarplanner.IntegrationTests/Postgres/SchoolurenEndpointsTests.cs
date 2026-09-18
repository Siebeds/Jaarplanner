using System.Net;
using System.Net.Http.Json;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The school's hours over HTTP against real PostgreSQL (FB-023, ADR-0038): the route, the TimeOnly binding, the
/// unique weekday index on the database the school runs on, and the rights: admin writes, everyone else reads.
/// </summary>
public sealed class SchoolurenEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("schooluren");
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

    private static object Week() => new
    {
        dagen = new object[]
        {
            new { weekdag = 1, begin = "08:30:00", einde = "15:30:00", middagpauzeBegin = "12:00:00", middagpauzeEinde = "13:15:00" },
            new { weekdag = 3, begin = "08:30:00", einde = "12:00:00", middagpauzeBegin = (string?)null, middagpauzeEinde = (string?)null },
        },
    };

    [PostgresFact]
    public async Task Admin_bewaart_de_uren_en_ze_staan_er_na_herladen()
    {
        var opzet = new RechtenTestOpzet(_db, _factory);
        using var admin = opzet.Als(await opzet.GebruikerAsync(admin: true));

        (await admin.PutAsJsonAsync("/api/schooluren", Week())).EnsureSuccessStatusCode();
        // Saving the same week again goes through the update path: each weekday already has its row.
        (await admin.PutAsJsonAsync("/api/schooluren", Week())).EnsureSuccessStatusCode();

        var gelezen = (await admin.GetFromJsonAsync<SchoolurenDto>("/api/schooluren"))!;
        Assert.Equal(
            [
                new DagDto(1, "08:30:00", "15:30:00", "12:00:00", "13:15:00"),
                new DagDto(3, "08:30:00", "12:00:00", null, null),
            ],
            gelezen.Dagen);
    }

    [PostgresFact]
    public async Task Een_leerkracht_leest_de_uren_maar_kan_ze_niet_wijzigen()
    {
        var opzet = new RechtenTestOpzet(_db, _factory);
        var school = await opzet.SchoolAsync();
        using var admin = opzet.Admin();
        (await admin.PutAsJsonAsync("/api/schooluren", Week())).EnsureSuccessStatusCode();

        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(
            school, themabeheer: true, hoofdleerkrachtVan: ["K3"], klassen: [school.K3Blauw]));

        Assert.Equal(2, (await leerkracht.GetFromJsonAsync<SchoolurenDto>("/api/schooluren"))!.Dagen.Count);
        await RechtenTestOpzet.VerwachtAsync(
            leerkracht.PutAsJsonAsync("/api/schooluren", new { dagen = Array.Empty<object>() }),
            HttpStatusCode.Forbidden,
            RechtenTestOpzet.GeenToegang);

        // And the refused write changed nothing.
        Assert.Equal(2, (await admin.GetFromJsonAsync<SchoolurenDto>("/api/schooluren"))!.Dagen.Count);
    }

    [PostgresFact]
    public async Task Een_middagpauze_buiten_de_schooldag_is_een_nederlandse_400()
    {
        using var admin = new RechtenTestOpzet(_db, _factory).Admin();

        await RechtenTestOpzet.VerwachtAsync(
            admin.PutAsJsonAsync("/api/schooluren", new
            {
                dagen = new[] { new { weekdag = 3, begin = "08:30:00", einde = "12:00:00", middagpauzeBegin = "12:00:00", middagpauzeEinde = "13:15:00" } },
            }),
            HttpStatusCode.BadRequest,
            "Op woensdag moet de middagpauze binnen de schooldag vallen, tussen 8:30 en 12:00.");

        await RechtenTestOpzet.VerwachtAsync(
            admin.PutAsJsonAsync("/api/schooluren", new
            {
                dagen = new[] { new { weekdag = 1, begin = "15:30:00", einde = "08:30:00" } },
            }),
            HttpStatusCode.BadRequest,
            "Op maandag moet de schooldag na het begin eindigen. Kies een later einduur.");
    }

    private sealed record SchoolurenDto(List<DagDto> Dagen);

    private sealed record DagDto(int Weekdag, string Begin, string Einde, string? MiddagpauzeBegin, string? MiddagpauzeEinde);
}
