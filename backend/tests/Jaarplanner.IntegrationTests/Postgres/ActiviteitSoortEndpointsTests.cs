using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-050: an activiteit's soort is optional, and an absent soort stays absent over HTTP.
/// <para>
/// <b>Against real PostgreSQL</b> because the claim is about the stored column: as a plain enum an omitted
/// <c>activiteitType</c> bound to <c>Experiment</c>, the zero value, and was saved as such without anyone choosing it.
/// </para>
/// </summary>
public sealed class ActiviteitSoortEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("activiteitsoort");
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

    [PostgresFact]
    public async Task Een_activiteit_zonder_soort_wordt_zonder_soort_bewaard_en_niet_als_Experiment()
    {
        var client = _factory.CreateClient();
        var subthemaId = await MaakSubthemaAsync(client);

        // The field left out entirely, as an older client or a hand-written call would.
        var zonderVeld = await client.PostAsJsonAsync($"/api/subthemas/{subthemaId}/activiteiten", new { naam = "Zonder veld" });
        // And sent as null, as the form does.
        var metNull = await client.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/activiteiten", new { naam = "Met null", activiteitType = (string?)null });

        Assert.Equal(HttpStatusCode.Created, zonderVeld.StatusCode);
        Assert.Equal(HttpStatusCode.Created, metNull.StatusCode);
        Assert.Null((await zonderVeld.Content.ReadFromJsonAsync<ActiviteitDto>())!.ActiviteitType);
        Assert.Null((await metNull.Content.ReadFromJsonAsync<ActiviteitDto>())!.ActiviteitType);

        await using var context = _db.MaakContext();
        var opgeslagen = await context.Activiteiten.Where(a => a.SubthemaId == subthemaId).ToListAsync();
        Assert.Equal(2, opgeslagen.Count);
        Assert.All(opgeslagen, a => Assert.Null(a.ActiviteitType));
    }

    [PostgresFact]
    public async Task Een_gekozen_soort_blijft_en_kan_weer_leeg_gemaakt_worden()
    {
        var client = _factory.CreateClient();
        var subthemaId = await MaakSubthemaAsync(client);

        var gemaakt = await client.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/activiteiten", new { naam = "Bootjes", activiteitType = "Hoek", hoek = "waterhoek" });
        Assert.Equal(HttpStatusCode.Created, gemaakt.StatusCode);
        var activiteit = await gemaakt.Content.ReadFromJsonAsync<ActiviteitDto>();
        Assert.Equal("Hoek", activiteit!.ActiviteitType);

        var geleegd = await client.PutAsJsonAsync(
            $"/api/activiteiten/{activiteit.Id}", new { naam = "Bootjes", activiteitType = (string?)null });
        Assert.Equal(HttpStatusCode.OK, geleegd.StatusCode);
        Assert.Null((await geleegd.Content.ReadFromJsonAsync<ActiviteitDto>())!.ActiviteitType);

        // And in the column itself, not only in the response.
        await using var context = _db.MaakContext();
        Assert.Null((await context.Activiteiten.SingleAsync(a => a.Id == activiteit.Id)).ActiviteitType);
    }

    private async Task<Guid> MaakSubthemaAsync(HttpClient client)
    {
        await using (var context = _db.MaakContext())
        {
            // Truncated to fit Schooljaar.Naam's varchar(32), as its siblings do.
            var schooljaar = new Schooljaar(
                $"2026-2027-{Guid.NewGuid():N}"[..20],
                new DateOnly(2026, 9, 1),
                new DateOnly(2027, 6, 30));
            schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
            context.Schooljaren.Add(schooljaar);
            await context.SaveChangesAsync();
        }

        var themaResp = await client.PostAsJsonAsync("/api/themas", new { naam = "Water", duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, themaResp.StatusCode);
        var thema = await themaResp.Content.ReadFromJsonAsync<IdDto>();

        var subResp = await client.PostAsJsonAsync(
            $"/api/themas/{thema!.Id}/subthemas", new { naam = "Drijven en zinken", duurWeken = 2, leeftijd = "K3" });
        Assert.Equal(HttpStatusCode.Created, subResp.StatusCode);
        return (await subResp.Content.ReadFromJsonAsync<IdDto>())!.Id;
    }

    private sealed record IdDto(Guid Id);

    private sealed record ActiviteitDto(Guid Id, string Naam, string? ActiviteitType);
}
