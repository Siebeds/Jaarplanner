using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The algemene fiches end to end, over HTTP against real PostgreSQL (owner, 2026-09-11): a teacher makes a fiche,
/// links a goal, plans it on Mondays, and the dekkingsoverzicht names the fiche as the evidence. Each step is the
/// request a screen sends, so a wiring mistake (a missing DI registration, a weekday serialised the wrong way, a
/// dekking read that never asks the fifth layer) fails here rather than in a teacher's browser.
/// </summary>
public sealed class AlgemeneFicheEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("ficheapi");
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
    public async Task Een_fiche_maken_koppelen_en_op_maandag_inplannen_dekt_het_doel()
    {
        var klasId = await ZetOpAsync();
        var client = _factory.CreateClient();

        var aangemaakt = await client.PostAsJsonAsync($"/api/klassen/{klasId}/algemene-fiches", new { naam = "Turnen" });
        Assert.Equal(HttpStatusCode.Created, aangemaakt.StatusCode);
        var fiche = (await aangemaakt.Content.ReadFromJsonAsync<FicheDto>())!;

        var gekoppeld = await client.PostAsJsonAsync(
            $"/api/algemene-fiches/{fiche.Id}/doelkoppelingen",
            new { leerplandoelCode = "LO-API-01" });
        gekoppeld.EnsureSuccessStatusCode();
        Assert.Equal(["LO-API-01"], (await gekoppeld.Content.ReadFromJsonAsync<FicheDto>())!.Doelen.Select(d => d.LeerplandoelCode));

        // Linked but not planned: the goal does not count yet.
        Assert.False((await DoelAsync(client, klasId, "LO-API-01")).IsGedekt);

        var gepland = await client.PostAsJsonAsync($"/api/klassen/{klasId}/algemene-ficheplaatsingen", new
        {
            algemeneFicheId = fiche.Id,
            van = "2026-09-07",
            tot = "2026-09-25",
            weekdagen = new[] { 1 },
            begin = "10:30:00",
            einde = "11:20:00",
        });
        Assert.Equal(HttpStatusCode.Created, gepland.StatusCode);
        var plaatsing = (await gepland.Content.ReadFromJsonAsync<PlaatsingDto>())!;
        Assert.Equal(["2026-09-07", "2026-09-14", "2026-09-21"], plaatsing.Momenten.Select(m => m.Datum));
        Assert.All(plaatsing.Momenten, m => Assert.Equal(("10:30:00", "11:20:00"), (m.Begin, m.Einde)));

        var doel = await DoelAsync(client, klasId, "LO-API-01");
        Assert.True(doel.IsGedekt);
        Assert.Equal(["Turnen"], doel.DekkendeFiches);
        Assert.Empty(doel.DekkendeThemas);

        // The fiche now stands in the agenda, so deleting it is a Dutch 400, not a 23503 as a 500.
        var verwijderd = await client.DeleteAsync($"/api/algemene-fiches/{fiche.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, verwijderd.StatusCode);

        // Taking the run out of the agenda withdraws the goal from the figure again.
        (await client.DeleteAsync($"/api/algemene-ficheplaatsingen/{plaatsing.Id}")).EnsureSuccessStatusCode();
        Assert.False((await DoelAsync(client, klasId, "LO-API-01")).IsGedekt);
    }

    [PostgresFact]
    public async Task Een_zaterdag_kiezen_is_een_nederlandse_400()
    {
        var klasId = await ZetOpAsync();
        var client = _factory.CreateClient();
        var fiche = (await (await client.PostAsJsonAsync($"/api/klassen/{klasId}/algemene-fiches", new { naam = "Onthaal" }))
            .Content.ReadFromJsonAsync<FicheDto>())!;

        var antwoord = await client.PostAsJsonAsync($"/api/klassen/{klasId}/algemene-ficheplaatsingen", new
        {
            algemeneFicheId = fiche.Id,
            van = "2026-09-07",
            tot = "2026-09-25",
            weekdagen = new[] { 6 },
            begin = "08:30:00",
            einde = "09:00:00",
        });

        Assert.Equal(HttpStatusCode.BadRequest, antwoord.StatusCode);
        Assert.Contains("maandag tot vrijdag", await antwoord.Content.ReadAsStringAsync());
    }

    private static async Task<DoelDto> DoelAsync(HttpClient client, Guid klasId, string code)
    {
        var dekking = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{klasId}/dekking");
        return dekking!.Doelen.Single(d => d.Code == code);
    }

    /// <summary>A school year with one K3 class and one K3 goal, seeded directly: the class endpoints are not under test.</summary>
    private async Task<Guid> ZetOpAsync()
    {
        await using var context = _db.MaakContext();

        context.Leerplandoelen.Add(new Leerplandoel(
            "LO-API-01", Doelsoort.Gemeenschappelijk, "K3", "Motoriek", "Grove motoriek", "9.1", tekst: "loopt en springt."));

        var schooljaar = new Schooljaar($"2026-2027-{Guid.NewGuid():N}"[..20], new DateOnly(2026, 9, 1), new DateOnly(2027, 6, 30));
        var klas = schooljaar.VoegKlasToe($"K3-{Guid.NewGuid():N}", "K3");
        context.Schooljaren.Add(schooljaar);

        await context.SaveChangesAsync();
        return klas.Id;
    }

    private sealed record FicheDto(Guid Id, string Naam, int AantalPlaatsingen, List<FichedoelDto> Doelen);

    private sealed record FichedoelDto(Guid KoppelingId, string LeerplandoelCode, string Tekst);

    private sealed record PlaatsingDto(Guid Id, List<MomentDto> Momenten);

    private sealed record MomentDto(Guid Id, string Datum, string Begin, string Einde);

    private sealed record DekkingDto(List<DoelDto> Doelen);

    private sealed record DoelDto(string Code, bool IsGedekt, List<string> DekkendeThemas, List<string> DekkendeFiches);
}
