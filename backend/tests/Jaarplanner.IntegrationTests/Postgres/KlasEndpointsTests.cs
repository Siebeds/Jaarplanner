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
    private Guid _schooljaarId;

    /// <summary>
    /// Creation is nested under the school year that contains the class (Art. IX.3, E3-01) — the route carries the
    /// containment so the body cannot disagree with it, and a rename can never move a class to another year.
    /// </summary>
    private string KlassenRoute => $"/api/schooljaren/{_schooljaarId}/klassen";

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("klas");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        // A Klas now requires a Schooljaar, so the container is created through its own endpoint first — which is
        // also the check that the container is reachable at all.
        var schooljaar = await (await _factory.CreateClient().PostAsJsonAsync("/api/schooljaren", new
        {
            naam = "2026-2027",
            start = "2026-09-01",
            eind = "2027-06-30",
        })).Content.ReadFromJsonAsync<SchooljaarWeergave>();
        _schooljaarId = schooljaar!.Id;
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

        var created = await client.PostAsJsonAsync(KlassenRoute, new { naam = "L3 — derde leerjaar", leerjaar = 3 });
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

        var eerste = await client.PostAsJsonAsync(KlassenRoute, new { naam = "L1 — eerste leerjaar", leerjaar = 1 });
        Assert.Equal(HttpStatusCode.Created, eerste.StatusCode);

        // Case-variant: caught by the ILIKE pre-check, which is evaluated in Postgres precisely because
        // an OrdinalIgnoreCase comparer in LINQ translates to a case-sensitive SQL predicate.
        var tweede = await client.PostAsJsonAsync(KlassenRoute, new { naam = "l1 — EERSTE leerjaar", leerjaar = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, tweede.StatusCode);
    }

    /// <summary>
    /// A rename round-trips, including keeping its own name (the `uitgezonderd` branch), and is refused
    /// when the target name is taken. `PUT` was previously untested altogether.
    /// </summary>
    [PostgresFact]
    public async Task Klas_kan_hernoemd_worden()
    {
        var client = _factory.CreateClient();

        var klas = await Maak(client, "L4 — vierde leerjaar", 4);
        var ander = await Maak(client, "L5 — vijfde leerjaar", 5);

        // Rename to a free name.
        var hernoemd = await client.PutAsJsonAsync($"/api/klassen/{klas.Id}", new { naam = "L4A — vierde leerjaar A", leerjaar = 4 });
        Assert.Equal(HttpStatusCode.OK, hernoemd.StatusCode);
        var na = await hernoemd.Content.ReadFromJsonAsync<KlasWeergave>();
        Assert.Equal("L4A — vierde leerjaar A", na!.Naam);

        // Keeping its own name must be allowed — the uniqueness check excludes the class itself.
        var zelfde = await client.PutAsJsonAsync($"/api/klassen/{klas.Id}", new { naam = "L4A — vierde leerjaar A", leerjaar = 5 });
        Assert.Equal(HttpStatusCode.OK, zelfde.StatusCode);
        Assert.Equal(5, (await zelfde.Content.ReadFromJsonAsync<KlasWeergave>())!.Leerjaar);

        // Taking another class's name must be refused.
        var conflict = await client.PutAsJsonAsync($"/api/klassen/{klas.Id}", new { naam = ander.Naam, leerjaar = 4 });
        Assert.Equal(HttpStatusCode.BadRequest, conflict.StatusCode);
    }

    /// <summary>A class with no school content deletes cleanly — the happy path of the Restrict-FK guard.</summary>
    [PostgresFact]
    public async Task Lege_klas_kan_verwijderd_worden()
    {
        var client = _factory.CreateClient();
        var klas = await Maak(client, "L6 — zesde leerjaar", 6);

        var verwijderd = await client.DeleteAsync($"/api/klassen/{klas.Id}");
        Assert.Equal(HttpStatusCode.NoContent, verwijderd.StatusCode);

        var opnieuw = await client.GetAsync($"/api/klassen/{klas.Id}");
        Assert.Equal(HttpStatusCode.NotFound, opnieuw.StatusCode);
    }

    /// <summary>
    /// A name containing LIKE metacharacters is stored and matched literally. The duplicate pre-check
    /// once passed the raw name as an <c>ILIKE</c> <i>pattern</i>, so "K3_groen" matched the existing
    /// "K3-groen" — any single character in that position — and a valid class was refused as a duplicate
    /// that did not exist.
    /// </summary>
    [PostgresFact]
    public async Task Naam_met_jokertekens_wordt_letterlijk_vergeleken()
    {
        var client = _factory.CreateClient();

        await Maak(client, "K3-groen", 0);

        // Differs from the existing name only in the character an unescaped LIKE pattern would wildcard.
        var response = await client.PostAsJsonAsync(KlassenRoute, new { naam = "K3_groen", leerjaar = 0 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        // A 100%-literal name must also survive.
        var procent = await client.PostAsJsonAsync(KlassenRoute, new { naam = "100% instroom", leerjaar = 0 });
        Assert.Equal(HttpStatusCode.Created, procent.StatusCode);
    }

    private async Task<KlasWeergave> Maak(HttpClient client, string naam, int leerjaar)
    {
        var response = await client.PostAsJsonAsync(KlassenRoute, new { naam, leerjaar });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return (await response.Content.ReadFromJsonAsync<KlasWeergave>())!;
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

        var klas = await (await client.PostAsJsonAsync(KlassenRoute, new { naam = "L2 — tweede leerjaar", leerjaar = 2 }))
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
