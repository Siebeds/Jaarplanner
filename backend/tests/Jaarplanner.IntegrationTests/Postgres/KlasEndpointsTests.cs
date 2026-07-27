using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Planning.Beheer;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Drives the <c>Klas</c> CRUD endpoints end-to-end against real PostgreSQL — the creation path that did
/// not exist before, and without which a fresh deployment could hold no class-scoped school content and
/// E3 had no class to generate a jaarplan for.
/// </summary>
public sealed class KlasEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("klas");
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

    [PostgresFact]
    public async Task Klas_kan_aangemaakt_en_opgehaald_worden()
    {
        var client = _factory.CreateClient();

        var created = await client.PostAsJsonAsync("/api/klassen", new { naam = "L3 — derde leerjaar", leerjaar = 3 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);

        var klas = await created.Content.ReadFromJsonAsync<KlasWeergave>();
        Assert.NotNull(klas);
        Assert.Equal("L3 — derde leerjaar", klas!.Naam);
        Assert.Equal(3, klas.Leerjaar);
        Assert.Equal(0, klas.AantalSubthemas);

        // Readable by id and present in the list.
        var detail = await client.GetFromJsonAsync<KlasWeergave>($"/api/klassen/{klas.Id}");
        Assert.Equal(klas.Id, detail!.Id);

        var lijst = await client.GetFromJsonAsync<List<KlasWeergave>>("/api/klassen");
        Assert.Contains(lijst!, k => k.Id == klas.Id);
    }

    [PostgresFact]
    public async Task Dubbele_klasnaam_geeft_400_geen_500()
    {
        var client = _factory.CreateClient();

        var eerste = await client.PostAsJsonAsync("/api/klassen", new { naam = "L1 — eerste leerjaar", leerjaar = 1 });
        Assert.Equal(HttpStatusCode.Created, eerste.StatusCode);

        // Case-variant: caught by the ILIKE pre-check, which is evaluated in Postgres precisely because
        // an OrdinalIgnoreCase comparer in LINQ translates to a case-sensitive SQL predicate.
        var tweede = await client.PostAsJsonAsync("/api/klassen", new { naam = "l1 — EERSTE leerjaar", leerjaar = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, tweede.StatusCode);
    }

    [PostgresFact]
    public async Task Onbekende_klas_geeft_404()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync($"/api/klassen/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    /// <summary>
    /// A class carrying school content cannot be deleted, and the refusal is a friendly 400 with a count
    /// rather than the Restrict FK surfacing as an opaque 500 (ADR-0006 §4).
    /// </summary>
    [PostgresFact]
    public async Task Klas_met_subthema_kan_niet_verwijderd_worden()
    {
        var client = _factory.CreateClient();

        var klas = await (await client.PostAsJsonAsync("/api/klassen", new { naam = "L2 — tweede leerjaar", leerjaar = 2 }))
            .Content.ReadFromJsonAsync<KlasWeergave>();

        // A thema is school-scoped; its subthema is class-scoped and pins the klas.
        var thema = await (await client.PostAsJsonAsync("/api/themas", new
        {
            naam = "Water",
            duurWeken = 5,
            invalshoeken = "natuur",
            kernwoordenschat = new[] { "plas" },
        })).Content.ReadFromJsonAsync<Application.Schoolcontent.Beheer.ThemaWeergave>();

        var subthema = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/subthemas", new
        {
            naam = "Regen",
            duurWeken = 2,
            klasId = klas!.Id,
            leeftijd = "7",
        });
        Assert.Equal(HttpStatusCode.Created, subthema.StatusCode);

        var verwijder = await client.DeleteAsync($"/api/klassen/{klas.Id}");
        Assert.Equal(HttpStatusCode.BadRequest, verwijder.StatusCode);
    }
}
