using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Api.Infrastructure;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// <b>The reachability test for the jaarplan endpoints.</b> It drives them the way a caller reaches them — HTTP →
/// controller → <c>JaarplanService</c> → EF — through the <b>real DI container</b> with only the AI client and the
/// database provider swapped. The calendar arithmetic (splits around a vacation, proposed ends, overlap) is asserted
/// against real Postgres in <c>Postgres/ThemaplaatsingEndpointsTests</c>; this file pins the route surface.
/// </summary>
public sealed class JaarplanEndpointsTests : IClassFixture<JaarplanEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public JaarplanEndpointsTests(Factory factory) => _factory = factory;

    /// <summary>
    /// A class without a plan reads an empty one (Art. IX.3), and a hand-placement creates it: the thema lands as
    /// <c>manueel</c>, without motivation, on the days asked for.
    /// </summary>
    [Fact]
    public async Task Een_klas_krijgt_een_jaarplan_door_een_handmatige_plaatsing()
    {
        var client = _factory.CreateClient();
        var (klasId, themaId) = await _factory.SeedAsync();

        var leeg = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        Assert.Empty(leeg!.Plaatsingen);
        Assert.Equal(new DateOnly(2026, 9, 1), leeg.EersteSchooldag);

        var plaatsen = await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen",
            new { themaId, van = "2026-09-07", tot = "2026-09-25" });
        Assert.Equal(HttpStatusCode.OK, plaatsen.StatusCode);

        var plan = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var plaatsing = Assert.Single(plan!.Plaatsingen);
        Assert.Equal("Herfst", plaatsing.ThemaNaam);
        Assert.Equal("Manueel", plaatsing.Status);
        Assert.Null(plaatsing.AiMotivatie);
        Assert.Equal((new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 25)), (plaatsing.Van, plaatsing.Tot));
        Assert.False(plaatsing.IsVervallen);
    }

    /// <summary>The generation is switched off (ADR-0053 decision 9): 409 with the Dutch reason, and nothing changes.</summary>
    [Fact]
    public async Task Genereren_staat_uit_en_geeft_409()
    {
        var client = _factory.CreateClient();
        var (klasId, _) = await _factory.SeedAsync();

        var response = await client.PostAsync($"/api/klassen/{klasId}/jaarplan/generatie", content: null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var probleem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal(Probleemtitels.GeneratieUitgeschakeld, probleem!.Title);
        Assert.Contains("tijdelijk uit", probleem.Detail);

        Assert.Empty((await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan"))!.Plaatsingen);
    }

    /// <summary>The removed period routes answer as routes that do not exist.</summary>
    [Fact]
    public async Task De_periode_routes_bestaan_niet_meer()
    {
        var client = _factory.CreateClient();
        var (klasId, themaId) = await _factory.SeedAsync();
        var plan = await (await client.PostAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen",
            new { themaId, van = "2026-09-07", tot = "2026-09-25" })).Content.ReadFromJsonAsync<JaarplanDto>();
        var plaatsingId = Assert.Single(plan!.Plaatsingen).Id;

        var hergeneratie = await client.PostAsync(
            $"/api/klassen/{klasId}/jaarplan/periodes/2026-09-01/generatie", content: null);
        Assert.Contains(hergeneratie.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });

        var blok = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/blok", new { blokStart = "2026-10-05" });
        Assert.Contains(blok.StatusCode, new[] { HttpStatusCode.NotFound, HttpStatusCode.MethodNotAllowed });
    }

    /// <summary>A class with nothing kept reads empty generation parameters, never a 404.</summary>
    [Fact]
    public async Task Bewaarde_parameters_zijn_leeg_uitleesbaar()
    {
        var client = _factory.CreateClient();
        var (klasId, _) = await _factory.SeedAsync();

        var parameters = await client.GetFromJsonAsync<ParametersDto>($"/api/klassen/{klasId}/jaarplan/parameters");

        Assert.Empty(parameters!.GewensteStartthemas);
        Assert.Empty(parameters.VasteMomenten);
    }

    /// <summary>The teacher's decision and lock both persist across a reload (Art. IV.2, Art. IX.3).</summary>
    [Fact]
    public async Task Beslissing_en_vergrendeling_overleven_een_herlaad()
    {
        var client = _factory.CreateClient();
        var (klasId, themaId) = await _factory.SeedAsync();
        var plaatsingId = await _factory.VoegVoorstelToeAsync(klasId, themaId);

        var status = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);

        var slot = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/vergrendeling", new { vergrendeld = true });
        Assert.Equal(HttpStatusCode.OK, slot.StatusCode);

        var na = await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan");
        var bijgewerkt = Assert.Single(na!.Plaatsingen);
        Assert.Equal("Aanvaard", bijgewerkt.Status);
        Assert.True(bijgewerkt.Vergrendeld);
        Assert.Equal("seizoen", bijgewerkt.AiMotivatie);
    }

    /// <summary>
    /// Removal works whatever the status or lock — the escape hatch the <c>Klas</c> delete guard depends on — and a
    /// second delete is a 404.
    /// </summary>
    [Fact]
    public async Task Een_plaatsing_kan_verwijderd_worden_ook_als_ze_aanvaard_en_vergrendeld_is()
    {
        var client = _factory.CreateClient();
        var (klasId, themaId) = await _factory.SeedAsync();
        var plaatsingId = await _factory.VoegVoorstelToeAsync(klasId, themaId);

        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status = "Aanvaard" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/vergrendeling", new { vergrendeld = true })).StatusCode);

        var verwijder = await client.DeleteAsync($"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}");
        Assert.Equal(HttpStatusCode.OK, verwijder.StatusCode);
        Assert.Empty((await verwijder.Content.ReadFromJsonAsync<JaarplanDto>())!.Plaatsingen);
        Assert.Empty((await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan"))!.Plaatsingen);

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.DeleteAsync($"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}")).StatusCode);
    }

    /// <summary>
    /// A teacher sets neither <c>voorgesteld</c> (AI-only) nor <c>geweigerd</c> (a proposal is rejected by removing it,
    /// ADR-0053 R12): both are a 400 and the placement is unchanged.
    /// </summary>
    [Theory]
    [InlineData("Voorgesteld")]
    [InlineData("Geweigerd")]
    public async Task Een_status_die_geen_beslissing_is_geeft_400(string status)
    {
        var client = _factory.CreateClient();
        var (klasId, themaId) = await _factory.SeedAsync();
        var plaatsingId = await _factory.VoegVoorstelToeAsync(klasId, themaId);

        var response = await client.PutAsJsonAsync(
            $"/api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/status", new { status });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(
            "Voorgesteld",
            Assert.Single((await client.GetFromJsonAsync<JaarplanDto>($"/api/klassen/{klasId}/jaarplan"))!.Plaatsingen).Status);
    }

    [Fact]
    public async Task Onbekende_klas_geeft_404()
    {
        var client = _factory.CreateClient();

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/klassen/{Guid.NewGuid()}/jaarplan")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.PostAsync($"/api/klassen/{Guid.NewGuid()}/jaarplan/generatie", content: null)).StatusCode);
    }

    /// <summary>
    /// The Art. IX.3 containment, over HTTP: a class is created <b>inside</b> a school year and the year reports the
    /// classes it contains.
    /// </summary>
    [Fact]
    public async Task Een_schooljaar_bevat_zijn_klassen()
    {
        var client = _factory.CreateClient();

        var schooljaar = await (await client.PostAsJsonAsync("/api/schooljaren", new
        {
            naam = TestSchooljaar.UniekeNaam("beheer"),
            start = "2028-09-01",
            eind = "2029-06-30",
            sluitingen = new[]
            {
                new { naam = "Herfstvakantie", start = "2028-10-30", eind = "2028-11-05", soort = "Vakantie" },
                new { naam = "Pinkstermaandag", start = "2029-05-21", eind = "2029-05-21", soort = "VrijeDag" },
            },
        })).Content.ReadFromJsonAsync<SchooljaarWeergave>();

        Assert.NotNull(schooljaar);
        Assert.Equal(2, schooljaar!.Sluitingen.Count);
        Assert.Equal("VrijeDag", schooljaar.Sluitingen.Single(s => s.Naam == "Pinkstermaandag").Soort);
        Assert.Empty(schooljaar.Klassen);

        var klasNaam = $"K3-{Guid.NewGuid():N}";
        var klasResponse = await client.PostAsJsonAsync(
            $"/api/schooljaren/{schooljaar.Id}/klassen", new { naam = klasNaam, jaarfase = "K3" });
        Assert.Equal(HttpStatusCode.Created, klasResponse.StatusCode);

        var klas = await klasResponse.Content.ReadFromJsonAsync<KlasWeergave>();
        Assert.Equal(schooljaar.Id, klas!.SchooljaarId);

        var opnieuw = await client.GetFromJsonAsync<SchooljaarWeergave>($"/api/schooljaren/{schooljaar.Id}");
        Assert.Contains(opnieuw!.Klassen, k => k.Id == klas.Id && k.Naam == klasNaam);
    }

    [Fact]
    public async Task Een_klas_in_een_onbekend_schooljaar_geeft_404()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            $"/api/schooljaren/{Guid.NewGuid()}/klassen", new { naam = $"L9-{Guid.NewGuid():N}", jaarfase = "L6" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private sealed record JaarplanDto(
        Guid KlasId,
        string KlasNaam,
        Guid SchooljaarId,
        string SchooljaarNaam,
        DateOnly EersteSchooldag,
        DateOnly LaatsteSchooldag,
        List<PlaatsingDto> Plaatsingen);

    private sealed record PlaatsingDto(
        Guid Id,
        Guid ThemaId,
        string ThemaNaam,
        DateOnly Van,
        DateOnly Tot,
        bool IsVervallen,
        string Status,
        string? AiMotivatie,
        bool Vergrendeld,
        List<string> Doelcodes);

    private sealed record ParametersDto(IReadOnlyList<object> GewensteStartthemas, IReadOnlyList<object> VasteMomenten);

    /// <summary>
    /// WebApplicationFactory on the in-memory EF provider with a <b>stub AI client</b>. The container is otherwise
    /// production wiring. Only the two things a test must not do for real — call a model and touch Postgres — are
    /// replaced.
    /// </summary>
    public sealed class Factory : JaarplannerApiFactory
    {
        private readonly string _dbNaam = $"e3_01_endpoints_{Guid.NewGuid():N}";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseEnvironment(Environments.Development);

            builder.ConfigureServices(services =>
            {
                var toRemove = services
                    .Where(d =>
                        d.ServiceType == typeof(AppDbContext) ||
                        d.ServiceType == typeof(IAiClient) ||
                        (d.ServiceType.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false) ||
                        (d.ServiceType.Namespace?.StartsWith("Npgsql", StringComparison.Ordinal) ?? false))
                    .ToList();
                foreach (var descriptor in toRemove)
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(_dbNaam));
                services.AddSingleton<IAiClient>(new OntploffendeAiClient());
            });
        }

        /// <summary>
        /// Seeds a school year (with the standard Belgian vacations), a class inside it and the "Herfst" thema, and
        /// returns both ids.
        /// </summary>
        public async Task<(Guid KlasId, Guid ThemaId)> SeedAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureCreatedAsync();

            var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("jaarplan"));
            var klas = schooljaar.VoegKlasToe($"L3-{Guid.NewGuid():N}", "L3");
            db.Schooljaren.Add(schooljaar);

            var thema = await db.Themas.FirstOrDefaultAsync(t => t.Naam == "Herfst");
            if (thema is null)
            {
                thema = new Thema("Herfst", duurWeken: 5, invalshoeken: "natuur");
                db.Themas.Add(thema);
            }

            await db.SaveChangesAsync();

            return (klas.Id, thema.Id);
        }

        /// <summary>An open AI proposal from 7 to 25 September, as a generation run left it.</summary>
        public async Task<Guid> VoegVoorstelToeAsync(Guid klasId, Guid themaId)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var jaarplan = new Jaarplan(klasId);
            var plaatsing = jaarplan.VoegPlaatsingToe(
                themaId, new DateOnly(2026, 9, 7), new DateOnly(2026, 9, 25), KoppelingStatus.Voorgesteld, "seizoen");
            db.Jaarplannen.Add(jaarplan);
            await db.SaveChangesAsync();

            return plaatsing.Id;
        }

        private sealed class OntploffendeAiClient : IAiClient
        {
            public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
                throw new InvalidOperationException("No jaarplan endpoint may call the model while generation is off.");
        }
    }
}
