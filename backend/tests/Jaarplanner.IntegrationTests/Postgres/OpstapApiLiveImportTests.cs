using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The whole Op.stap API path, with <b>nothing faked</b>: the running application reads KOV's live API and writes into
/// real PostgreSQL through both import endpoints (E1-12, E1-21). Skipped unless <c>JAARPLANNER_LIVE_OPSTAP=1</c>
/// <b>and</b> <c>JAARPLANNER_TEST_POSTGRES</c> are set, because CI must not depend on KOV (ADR-0032); run it by hand, or on
/// E1-23's nightly schedule.
/// <para>
/// This is the proof E1-21's done-when asks for ("proven against PostgreSQL") on the real curriculum rather than a
/// fixture, and the recorded request through the running app that E1-12's status note named as owed before its <c>[x]</c>.
/// Snapshot 1.2 is pinned, so its figures are exact.
/// </para>
/// </summary>
public sealed class OpstapApiLiveImportTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!LivePostgresFactAttribute.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("opstaplive");
        _factory = new PostgresApiFactory(_db.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [LivePostgresFact]
    public async Task De_echte_import_van_KOV_landt_geconcordeerd_in_PostgreSQL_en_is_herhaalbaar()
    {
        var minimumdoelen = await Post("/api/opstap-import/minimumdoelen", body: null);
        var voorbeeld = await Post("/api/opstap-import/leerplandoelen/voorbeeld", new { versie = "1.2" });
        var toepassing = await Post("/api/opstap-import/leerplandoelen", new { versie = "1.2" });
        var herhaling = await Post("/api/opstap-import/leerplandoelen", new { versie = "1.2" });

        Assert.Equal(998, minimumdoelen.GetProperty("diff").GetProperty("toegevoegd").GetArrayLength());
        Assert.Empty(voorbeeld.GetProperty("problemen").EnumerateArray());
        Assert.False(voorbeeld.GetProperty("toegepast").GetBoolean());
        Assert.True(toepassing.GetProperty("toegepast").GetBoolean());
        Assert.True(toepassing.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.Equal(5835, Som(toepassing, "toegevoegd"));
        Assert.All(herhaling.GetProperty("disciplines").EnumerateArray(), d => Assert.True(d.GetProperty("diff").GetProperty("isLeeg").GetBoolean()));

        await using var context = _db.MaakContext();
        Assert.Equal(998, await context.Minimumdoelen.CountAsync());
        Assert.Equal(5835, await context.Leerplandoelen.CountAsync());
        Assert.Equal(4983, await context.Leerplandoelen.CountAsync(l => l.MinimumdoelRef != null));
        Assert.Equal(992, await context.Leerplandoelen.Where(l => l.MinimumdoelRef != null).Select(l => l.MinimumdoelRef).Distinct().CountAsync());
        Assert.Equal(0, await context.Leerplandoelen.CountAsync(l => l.OpstapSleutel == null));
        Assert.Equal(["1.2", "1.2"], await context.Opstapversies.Select(v => v.Versie).ToListAsync());

        // ADR-0032 decision 5 on the database: exactly the six minimumdoelen no G goal concords.
        var geconcordeerd = context.Leerplandoelen.Where(l => l.MinimumdoelRef != null).Select(l => l.MinimumdoelRef!);
        var zonderGDoel = await context.Minimumdoelen.Where(m => !geconcordeerd.Contains(m.Ref)).Select(m => m.Ref).OrderBy(r => r).ToListAsync();
        Assert.Equal(["4-2.2.23", "6-2.2.3", "6-6.2.5", "6-6.3.9", "6-7.1.6", "K-1.2.6"], zonderGDoel);
    }

    private static int Som(JsonElement antwoord, string bak) =>
        antwoord.GetProperty("disciplines").EnumerateArray().Sum(d => d.GetProperty("diff").GetProperty(bak).GetArrayLength());

    private async Task<JsonElement> Post(string url, object? body)
    {
        var client = _factory.CreateClient();
        client.Timeout = TimeSpan.FromMinutes(5);
        var response = body is null ? await client.PostAsync(url, content: null) : await client.PostAsJsonAsync(url, body);
        Assert.True(response.IsSuccessStatusCode, $"{url}: {(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");
        return await response.Content.ReadFromJsonAsync<JsonElement>();
    }
}

/// <summary>A fact that runs only when both the live Op.stap switch and a PostgreSQL connection are set.</summary>
public sealed class LivePostgresFactAttribute : FactAttribute
{
    /// <summary>The environment variable that switches the live Op.stap tests on, as in the unit tests.</summary>
    public const string LiveVariabele = "JAARPLANNER_LIVE_OPSTAP";

    /// <summary>True when both switches are set.</summary>
    public static bool IsBeschikbaar =>
        Environment.GetEnvironmentVariable(LiveVariabele) == "1" && PostgresTestDatabase.IsBeschikbaar;

    public LivePostgresFactAttribute()
    {
        if (!IsBeschikbaar)
        {
            Skip = $"Calls KOV's live Op.stap API and writes to PostgreSQL; set {LiveVariabele}=1 and {PostgresTestDatabase.ConnectionStringVariable}.";
        }
    }
}
