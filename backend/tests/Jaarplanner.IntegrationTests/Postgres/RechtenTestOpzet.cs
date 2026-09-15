using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Toegang;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Seeding shared by the E6-02 slice 3 rights tests: a school year with K3 blauw, K3 groen and K2 rood that has not
/// ended (so R20's relations count), gebruikers with exactly the relations a test names, and content made over HTTP as
/// the default directie identity, so the content paths are the ones a screen uses.
/// </summary>
internal sealed class RechtenTestOpzet
{
    /// <summary>The detail of every authorisation 403 (<c>Aanmelding.GeenToegangDetail</c>), written out so a test reads the value.</summary>
    public const string GeenToegang = "Je hebt geen toegang tot deze actie.";

    /// <summary>The write's refusal of a missing or blank leeftijd, written out for the same reason.</summary>
    public const string GeenLeeftijd = "Een subthema heeft een leeftijd nodig. Kies er een uit: JK, K2, K3, L1, L2, L3, L4, L5, L6.";

    public const string Wizard = "/api/thema-opbouw/wizardruns";

    private readonly PostgresTestDatabase _db;
    private readonly PostgresApiFactory _factory;

    public RechtenTestOpzet(PostgresTestDatabase db, PostgresApiFactory factory)
    {
        _db = db;
        _factory = factory;
    }

    private static DateOnly Vandaag => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>A leerplandoel to link, once per database.</summary>
    public static async Task ZaaiDoelAsync(PostgresTestDatabase db, string code)
    {
        await using var context = db.MaakContext();
        context.Leerplandoelen.Add(new Leerplandoel(
            code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9.1", tekst: "Tekst"));
        await context.SaveChangesAsync();
    }

    /// <summary>A running school year (a month in, two hundred days to go) with three klassen.</summary>
    public async Task<School> SchoolAsync()
    {
        var jaar = new Schooljaar(TestSchooljaar.UniekeNaam("rechten"), Vandaag.AddDays(-30), Vandaag.AddDays(200));
        var blauw = jaar.VoegKlasToe($"K3b-{Guid.NewGuid():N}", "K3");
        var groen = jaar.VoegKlasToe($"K3g-{Guid.NewGuid():N}", "K3");
        var rood = jaar.VoegKlasToe($"K2r-{Guid.NewGuid():N}", "K2");

        await using var context = _db.MaakContext();
        context.Schooljaren.Add(jaar);
        await context.SaveChangesAsync();
        return new School(jaar.Id, blauw.Id, groen.Id, rood.Id);
    }

    /// <summary>
    /// A school year that ended a hundred days ago, with a K3 and a K2 klas: for reading the klassen of an earlier year
    /// (FB-013, ADR-0040 default Z6).
    /// </summary>
    public async Task<VorigJaar> VorigSchooljaarAsync()
    {
        var jaar = new Schooljaar(TestSchooljaar.UniekeNaam("vorig"), Vandaag.AddDays(-400), Vandaag.AddDays(-100));
        var k3 = jaar.VoegKlasToe($"K3v-{Guid.NewGuid():N}", "K3");
        var k2 = jaar.VoegKlasToe($"K2v-{Guid.NewGuid():N}", "K2");

        await using var context = _db.MaakContext();
        context.Schooljaren.Add(jaar);
        await context.SaveChangesAsync();
        return new VorigJaar(jaar.Id, k3.Id, k2.Id);
    }

    /// <summary>The ids of the klassen <c>GET /api/klassen</c> offers this client.</summary>
    public static async Task<List<Guid>> KlasIdsAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<IdDto>>("/api/klassen"))!.Select(k => k.Id).ToList();

    /// <summary>
    /// A gebruiker with exactly these relations: directie, themabeheer, hoofdleerkracht of the given leeftijden in the
    /// school's year, and klastoewijzingen on the given klassen. With none of them, a gebruiker who may do nothing.
    /// </summary>
    public async Task<Guid> GebruikerAsync(
        School? school = null,
        bool directie = false,
        bool themabeheer = false,
        string[]? hoofdleerkrachtVan = null,
        Guid[]? klassen = null)
    {
        var gebruiker = new Gebruiker($"{Guid.NewGuid():N}@school.be", "Test", isDirectie: directie);
        if (themabeheer)
        {
            gebruiker.GeefThemabeheer();
        }

        await using var context = _db.MaakContext();
        context.Gebruikers.Add(gebruiker);
        await context.SaveChangesAsync();

        foreach (var leeftijd in hoofdleerkrachtVan ?? [])
        {
            context.Hoofdleerkrachtaanstellingen.Add(new Hoofdleerkrachtaanstelling(gebruiker.Id, school!.SchooljaarId, leeftijd));
        }

        foreach (var klasId in klassen ?? [])
        {
            context.Klastoewijzingen.Add(new Klastoewijzing(gebruiker.Id, klasId));
        }

        await context.SaveChangesAsync();
        return gebruiker.Id;
    }

    /// <summary>The default test identity, directie with no row: for seeding content.</summary>
    public HttpClient Directie() => _factory.CreateClient();

    /// <summary>A client acting as the seeded gebruiker.</summary>
    public HttpClient Als(Guid gebruikerId) => _factory.MaakClientVoor(gebruikerId);

    public async Task<Guid> ThemaAsync()
    {
        using var client = Directie();
        using var antwoord = await client.PostAsJsonAsync("/api/themas", new { naam = $"Thema {Guid.NewGuid():N}", duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<IdDto>())!.Id;
    }

    public async Task<Guid> SubthemaAsync(string leeftijd, Guid? themaId = null)
    {
        var thema = themaId ?? await ThemaAsync();
        using var client = Directie();
        using var antwoord = await client.PostAsJsonAsync(
            $"/api/themas/{thema}/subthemas", new { naam = "Regen", duurWeken = 2, leeftijd });
        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<IdDto>())!.Id;
    }

    /// <summary>An activiteit, made by <paramref name="client"/> (directie when none), so its maker is that caller.</summary>
    public async Task<ActiviteitDto> ActiviteitAsync(Guid subthemaId, HttpClient? client = null)
    {
        using var eigen = client is null ? Directie() : null;
        using var antwoord = await (client ?? eigen!).PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/activiteiten",
            new { naam = $"Proef {Guid.NewGuid():N}", activiteitType = "Experiment" });
        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<ActiviteitDto>())!;
    }

    /// <summary>Links a goal to an activiteit, as directie. Returns the link's id.</summary>
    public async Task<Guid> KoppelAsync(Guid activiteitId, string code)
    {
        using var client = Directie();
        using var antwoord = await client.PostAsJsonAsync($"/api/activiteiten/{activiteitId}/doelkoppelingen", new { leerplandoelCode = code });
        Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<IdDto>())!.Id;
    }

    /// <summary>Starts a wizard run as <paramref name="client"/>.</summary>
    public static async Task<RunDto> StartWizardAsync(HttpClient client)
    {
        using var antwoord = await client.PostAsJsonAsync(Wizard, new { naam = $"Wizard {Guid.NewGuid():N}", duurWeken = 4 });
        Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
        return (await antwoord.Content.ReadFromJsonAsync<RunDto>())!;
    }

    /// <summary>The id a successful request created or returned, failing with the body when it did not succeed.</summary>
    public static async Task<Guid> IdAsync(Task<HttpResponseMessage> verzoek, HttpStatusCode verwacht)
    {
        using var antwoord = await verzoek;
        Assert.True(antwoord.StatusCode == verwacht, $"Expected {verwacht}, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<IdDto>())!.Id;
    }

    /// <summary>The status of a request, with the response disposed.</summary>
    public static async Task<HttpStatusCode> StatusAsync(Task<HttpResponseMessage> verzoek)
    {
        using var antwoord = await verzoek;
        return antwoord.StatusCode;
    }

    /// <summary>The ProblemDetails <c>detail</c> of a response, or <c>null</c> when it has none.</summary>
    public static async Task<string?> DetailAsync(HttpResponseMessage antwoord)
    {
        var tekst = await antwoord.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(tekst))
        {
            return null;
        }

        using var json = JsonDocument.Parse(tekst);
        return json.RootElement.ValueKind == JsonValueKind.Object && json.RootElement.TryGetProperty("detail", out var detail)
            ? detail.GetString()
            : null;
    }

    /// <summary>
    /// The request answers <paramref name="status"/> with exactly <paramref name="zin"/> as its detail: server-composed
    /// Dutch is checked by its value (Art. II.3), and it never carries an em dash (CLAUDE.md, owner 2026-07-29).
    /// </summary>
    public static async Task VerwachtAsync(Task<HttpResponseMessage> verzoek, HttpStatusCode status, string zin)
    {
        using var antwoord = await verzoek;
        var detail = await DetailAsync(antwoord);
        Assert.True(
            antwoord.StatusCode == status && detail == zin,
            $"Expected {(int)status} \"{zin}\", got {(int)antwoord.StatusCode} \"{detail}\".");
        Assert.DoesNotContain('—', zin);
    }

    public sealed record School(Guid SchooljaarId, Guid K3Blauw, Guid K3Groen, Guid K2Rood);

    public sealed record VorigJaar(Guid SchooljaarId, Guid K3, Guid K2);

    public sealed record IdDto(Guid Id);

    public sealed record ActiviteitDto(Guid Id, Guid? MakerId);

    public sealed record RunDto(
        Guid Id,
        Guid ThemaId,
        Guid? GestartDoorId,
        bool IsOpen,
        DateTimeOffset LaatsteSchrijfactieOp,
        List<ItemDto> Aangemaakt);

    public sealed record ItemDto(string Soort, Guid Id);
}
