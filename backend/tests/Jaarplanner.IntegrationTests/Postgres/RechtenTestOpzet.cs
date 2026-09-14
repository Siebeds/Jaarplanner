using System.Net;
using System.Net.Http.Json;
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

    /// <summary>The status of a request, with the response disposed.</summary>
    public static async Task<HttpStatusCode> StatusAsync(Task<HttpResponseMessage> verzoek)
    {
        using var antwoord = await verzoek;
        return antwoord.StatusCode;
    }

    public sealed record School(Guid SchooljaarId, Guid K3Blauw, Guid K3Groen, Guid K2Rood);

    public sealed record IdDto(Guid Id);

    public sealed record ActiviteitDto(Guid Id, Guid? MakerId);
}
