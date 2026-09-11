using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The hours of a placed hoek's whole run, over HTTP against real PostgreSQL (owner, 2026-09-11).
/// <para>
/// The unit tests hold the same rules on the in-memory provider. This is the one place the route, the TimeOnly
/// binding and the save are proven on the database the school runs on, including the refusal for a day that holds the
/// hoek twice, which must leave every row where it was.
/// </para>
/// </summary>
public sealed class HoekurenEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("hoekuren");
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
    public async Task Nieuwe_uren_gelden_voor_elke_dag_en_een_dubbele_dag_is_een_nederlandse_400()
    {
        var klasId = await ZetOpAsync();
        var client = _factory.CreateClient();

        var hoek = (await (await client.PostAsJsonAsync($"/api/klassen/{klasId}/hoeken", new { naam = "bouwhoek", omschrijving = (string?)null }))
            .EnsureSuccessStatusCode().Content.ReadFromJsonAsync<HoekDto>())!;
        var geplaatst = await client.PostAsJsonAsync($"/api/klassen/{klasId}/hoekplaatsingen", new
        {
            hoekId = hoek.Id,
            van = "2026-09-14",
            tot = "2026-09-17",
            begin = "08:00:00",
            einde = "11:50:00",
        });
        Assert.Equal(HttpStatusCode.Created, geplaatst.StatusCode);
        var plaatsing = (await geplaatst.Content.ReadFromJsonAsync<PlaatsingDto>())!;
        Assert.Equal(4, plaatsing.Momenten.Count);

        // Monday shortened by hand, as in the owner's screenshot. The new hours reach it too.
        var maandag = plaatsing.Momenten.Single(m => m.Datum == "2026-09-14");
        (await client.PutAsJsonAsync(
            $"/api/hoekplaatsingen/{plaatsing.Id}/momenten/{maandag.Id}",
            new { datum = "2026-09-14", begin = "08:00:00", einde = "10:00:00" })).EnsureSuccessStatusCode();

        (await client.PutAsJsonAsync($"/api/hoekplaatsingen/{plaatsing.Id}/uren", new { begin = "09:00:00", einde = "10:30:00" }))
            .EnsureSuccessStatusCode();
        var gezet = await MomentenAsync(client, klasId);
        Assert.Equal(4, gezet.Count);
        Assert.All(gezet, m => Assert.Equal(("09:00:00", "10:30:00"), (m.Begin, m.Einde)));

        // Tuesday dragged onto Monday morning: Monday now holds the hoek twice, so new hours are refused, day named.
        var dinsdag = plaatsing.Momenten.Single(m => m.Datum == "2026-09-15");
        (await client.PutAsJsonAsync(
            $"/api/hoekplaatsingen/{plaatsing.Id}/momenten/{dinsdag.Id}",
            new { datum = "2026-09-14", begin = "07:00:00", einde = "07:45:00" })).EnsureSuccessStatusCode();

        var geweigerd = await client.PutAsJsonAsync(
            $"/api/hoekplaatsingen/{plaatsing.Id}/uren", new { begin = "13:00:00", einde = "14:00:00" });
        Assert.Equal(HttpStatusCode.BadRequest, geweigerd.StatusCode);
        Assert.Contains("Op maandag 14 september staat deze hoek twee keer.", await geweigerd.Content.ReadAsStringAsync());

        // And nothing moved: still four rows, none at the refused hours, the dragged one where she put it.
        var na = await MomentenAsync(client, klasId);
        Assert.Equal(4, na.Count);
        Assert.DoesNotContain(na, m => m.Begin == "13:00:00");
        Assert.Contains(na, m => m.Datum == "2026-09-14" && m.Begin == "07:00:00");
    }

    private static async Task<List<MomentDto>> MomentenAsync(HttpClient client, Guid klasId) =>
        (await client.GetFromJsonAsync<List<PlaatsingDto>>(
            $"/api/klassen/{klasId}/hoekplaatsingen?van=2026-09-14&tot=2026-09-17"))!.Single().Momenten;

    /// <summary>A school year with one class and no closure in the week under test, seeded directly.</summary>
    private async Task<Guid> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        var schooljaar = new Schooljaar($"2026-2027-{Guid.NewGuid():N}"[..20], new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();
        return klas.Id;
    }

    private sealed record HoekDto(Guid Id, string Naam);

    private sealed record PlaatsingDto(Guid Id, List<MomentDto> Momenten);

    private sealed record MomentDto(Guid Id, string Datum, string Begin, string Einde);
}
