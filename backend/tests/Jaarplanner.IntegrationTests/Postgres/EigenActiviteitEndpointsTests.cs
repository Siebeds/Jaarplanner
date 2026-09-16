using System.Net;
using System.Net.Http.Json;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// FB-015 over HTTP against PostgreSQL (ADR-0049): a leerkracht's new activiteit is her own; a colleague of her jaarfase
/// reads it and cannot change it, uses it as an own copy and plans that copy; a leerkracht of another jaarfase does not
/// see it; and its goal counts for a klas only once it is planned in that klas's agenda.
/// </summary>
public sealed class EigenActiviteitEndpointsTests : IClassFixture<EigenActiviteitEndpointsTests.Omgeving>
{
    private const string Doelcode = "EIGEN-01";

    private readonly Omgeving _omgeving;

    public EigenActiviteitEndpointsTests(Omgeving omgeving) => _omgeving = omgeving;

    private RechtenTestOpzet Opzet => new(_omgeving.Db, _omgeving.Factory);

    private static Task<HttpStatusCode> StatusAsync(Task<HttpResponseMessage> verzoek) => RechtenTestOpzet.StatusAsync(verzoek);

    [PostgresFact]
    public async Task Een_collega_van_de_jaarfase_leest_een_eigen_activiteit_en_verandert_ze_niet()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var themaId = await opzet.ThemaAsync();
        var subthemaId = await opzet.SubthemaAsync("K3", themaId);
        var anId = await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        using var an = opzet.Als(anId);
        using var collega = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Groen]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var k2 = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K2Rood]));
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));

        var eigen = await MaakAsync(an, subthemaId, "Plassen meten");
        Assert.Equal(anId, eigen.EigenaarId);

        // D3: her jaarfase's leerkrachten and hoofdleerkrachten see it, with its owner; anyone else does not.
        Assert.Equal(anId, (await ActiviteitInThemaAsync(collega, themaId, eigen.Id))?.EigenaarId);
        Assert.NotNull(await ActiviteitInThemaAsync(hoofdleerkracht, themaId, eigen.Id));
        Assert.Null(await ActiviteitInThemaAsync(k2, themaId, eigen.Id));
        Assert.Null(await ActiviteitInThemaAsync(themabeheer, themaId, eigen.Id));

        // D4: only the owner changes it, links its goals and deletes it, also with a goal linked.
        var wijziging = new { naam = "Van een ander", activiteitType = "Experiment" };
        var doel = new { leerplandoelCode = Doelcode };
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(collega.PutAsJsonAsync($"/api/activiteiten/{eigen.Id}", wijziging)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PutAsJsonAsync($"/api/activiteiten/{eigen.Id}", wijziging)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(collega.PostAsJsonAsync($"/api/activiteiten/{eigen.Id}/doelkoppelingen", doel)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.DeleteAsync($"/api/activiteiten/{eigen.Id}")));

        Assert.Equal(HttpStatusCode.OK, await StatusAsync(an.PutAsJsonAsync($"/api/activiteiten/{eigen.Id}", new { naam = "Plassen", activiteitType = "Experiment" })));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(an.PostAsJsonAsync($"/api/activiteiten/{eigen.Id}/doelkoppelingen", doel)));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(an.DeleteAsync($"/api/activiteiten/{eigen.Id}")));
    }

    [PostgresFact]
    public async Task Gebruiken_geeft_een_eigen_kopie_en_alleen_die_kopie_wordt_ingepland()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var themaId = await opzet.ThemaAsync();
        var subthemaId = await opzet.SubthemaAsync("K3", themaId);
        using var an = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var collegaId = await opzet.GebruikerAsync(school, klassen: [school.K3Groen]);
        using var collega = opzet.Als(collegaId);
        using var k2 = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K2Rood]));
        var origineel = await MaakAsync(an, subthemaId, "Plassen meten");

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(k2.PostAsJsonAsync($"/api/activiteiten/{origineel.Id}/kopie", new { })));
        using var gekopieerd = await collega.PostAsJsonAsync($"/api/activiteiten/{origineel.Id}/kopie", new { });
        Assert.Equal(HttpStatusCode.Created, gekopieerd.StatusCode);
        var kopie = (await gekopieerd.Content.ReadFromJsonAsync<RechtenTestOpzet.ActiviteitDto>())!;
        Assert.Equal(collegaId, kopie.EigenaarId);

        // Hers to change; the original stays as it was.
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(collega.PutAsJsonAsync($"/api/activiteiten/{kopie.Id}", new { naam = "Mijn plassen", activiteitType = "Experiment" })));
        Assert.Equal("Plassen meten", (await ActiviteitInThemaAsync(an, themaId, origineel.Id))?.Naam);

        // D6: she plans her copy, not the original.
        var dag = await LesdagAsync(collega, school.K3Groen, kopie.Id);
        using var origineelPlannen = await collega.PostAsJsonAsync(
            $"/api/klassen/{school.K3Groen}/jaarplan/weekplanning",
            new { activiteitId = origineel.Id, datum = dag, begin = "11:00:00", einde = "11:50:00" });
        Assert.Equal(HttpStatusCode.BadRequest, origineelPlannen.StatusCode);
        Assert.Contains("Gebruiken", await RechtenTestOpzet.DetailAsync(origineelPlannen), StringComparison.Ordinal);
    }

    [PostgresFact]
    public async Task Een_eigen_activiteit_dekt_haar_doel_alleen_waar_ze_ingepland_is()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var subthemaId = await opzet.SubthemaAsync("K3");
        using var an = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var collega = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Groen]));
        var eigen = await MaakAsync(an, subthemaId, $"Bladeren {Guid.NewGuid():N}", [Doelcode]);

        // Aimed at by its owner's klas, not yet planned: prognose there, nothing in the colleague's klas (D7).
        var voor = await DoelAsync(an, school.K3Blauw);
        Assert.Equal(("Prognose", false), (voor.Stap, voor.IsGedekt));
        Assert.Equal("Geen", (await DoelAsync(collega, school.K3Groen)).Stap);

        await LesdagAsync(an, school.K3Blauw, eigen.Id);

        var na = await DoelAsync(an, school.K3Blauw);
        Assert.True(na.IsGedekt);
        Assert.Equal([eigen.Naam], na.DekkendeActiviteiten);
        Assert.Empty(na.DekkendeThemas);
        var elders = await DoelAsync(collega, school.K3Groen);
        Assert.False(elders.IsGedekt);
        Assert.Empty(elders.DekkendeActiviteiten);
    }

    private static async Task<NieuweActiviteit> MaakAsync(HttpClient client, Guid subthemaId, string naam, string[]? codes = null)
    {
        using var antwoord = await client.PostAsJsonAsync(
            $"/api/subthemas/{subthemaId}/activiteiten",
            new { naam, activiteitType = "Experiment", leerplandoelCodes = codes });
        Assert.True(antwoord.StatusCode == HttpStatusCode.Created, await antwoord.Content.ReadAsStringAsync());
        return (await antwoord.Content.ReadFromJsonAsync<NieuweActiviteit>())!;
    }

    private static async Task<ActiviteitInThema?> ActiviteitInThemaAsync(HttpClient client, Guid themaId, Guid activiteitId)
    {
        var thema = await client.GetFromJsonAsync<ThemaDto>($"/api/themas/{themaId}");
        return thema!.Subthemas.SelectMany(s => s.Activiteiten).SingleOrDefault(a => a.Id == activiteitId);
    }

    /// <summary>
    /// Plans the activiteit at nine on a weekday of the running year, and returns that day. Tried on several Tuesdays, since
    /// a day the school calendar closes answers 400 for a reason of its own.
    /// </summary>
    private static async Task<DateOnly> LesdagAsync(HttpClient client, Guid klasId, Guid activiteitId)
    {
        var dag = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(7);
        while (dag.DayOfWeek != DayOfWeek.Tuesday)
        {
            dag = dag.AddDays(1);
        }

        string laatste = string.Empty;
        for (var poging = 0; poging < 6; poging++, dag = dag.AddDays(7))
        {
            using var antwoord = await client.PostAsJsonAsync(
                $"/api/klassen/{klasId}/jaarplan/weekplanning",
                new { activiteitId, datum = dag, begin = "09:00:00", einde = "09:50:00" });
            if (antwoord.StatusCode == HttpStatusCode.OK)
            {
                return dag;
            }

            laatste = $"{(int)antwoord.StatusCode} {await antwoord.Content.ReadAsStringAsync()}";
        }

        throw new InvalidOperationException($"No lesdag found to plan on: {laatste}");
    }

    private static async Task<DoelDto> DoelAsync(HttpClient client, Guid klasId)
    {
        var dekking = await client.GetFromJsonAsync<DekkingDto>($"/api/klassen/{klasId}/dekking");
        return dekking!.Doelen.Single(d => d.Code == Doelcode);
    }

    private sealed record NieuweActiviteit(Guid Id, string Naam, Guid? EigenaarId);

    private sealed record ThemaDto(List<SubthemaDto> Subthemas);

    private sealed record SubthemaDto(List<ActiviteitInThema> Activiteiten);

    private sealed record ActiviteitInThema(Guid Id, string Naam, Guid? EigenaarId, string? EigenaarNaam);

    private sealed record DekkingDto(List<DoelDto> Doelen);

    private sealed record DoelDto(
        string Code,
        bool IsGedekt,
        string Stap,
        List<string> DekkendeThemas,
        List<string> DekkendeActiviteiten);

    public sealed class Omgeving : IAsyncLifetime
    {
        public PostgresTestDatabase Db { get; private set; } = null!;

        public PostgresApiFactory Factory { get; private set; } = null!;

        public async Task InitializeAsync()
        {
            if (!PostgresTestDatabase.IsBeschikbaar)
            {
                return;
            }

            Db = await PostgresTestDatabase.MaakAsync("eigenactiviteit");
            Factory = new PostgresApiFactory(Db.ConnectionString);
            await RechtenTestOpzet.ZaaiDoelAsync(Db, Doelcode);
        }

        public async Task DisposeAsync()
        {
            if (Factory is not null)
            {
                await Factory.DisposeAsync();
            }

            if (Db is not null)
            {
                await Db.DisposeAsync();
            }
        }
    }
}
