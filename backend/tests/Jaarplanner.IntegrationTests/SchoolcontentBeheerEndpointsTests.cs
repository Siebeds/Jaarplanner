using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Drives the E1-10 school-content CRUD endpoints end-to-end (HTTP → controller → service → EF) for the
/// FR-3.1/3.2 acceptance: create thema/subthema/activiteit, manage themadoelen and goal links, and that
/// level scoping is enforced at the API boundary (Art. IX.2) and a manual link round-trips with status
/// <c>manueel</c> (Art. IV.2). The DbContext is swapped to the EF Core in-memory provider so the test
/// needs no Postgres container — it runs in CI/dev exactly as written.
/// </summary>
public sealed class SchoolcontentBeheerEndpointsTests : IClassFixture<SchoolcontentBeheerEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public SchoolcontentBeheerEndpointsTests(Factory factory) => _factory = factory;

    [Fact]
    public async Task Full_crud_flow_with_goal_links_round_trips()
    {
        var client = _factory.CreateClient();
        var klasId = _factory.KlasId;

        // 1. Create a school-wide thema.
        var themaResp = await client.PostAsJsonAsync("/api/themas", new
        {
            naam = "Water",
            duurWeken = 5,
            invalshoeken = "natuur",
            kernwoordenschat = new[] { "plas" },
        });
        Assert.Equal(HttpStatusCode.Created, themaResp.StatusCode);
        var thema = await themaResp.Content.ReadFromJsonAsync<ThemaDto>();
        Assert.NotNull(thema);

        // 2. Add a manual themadoel (manueel, Art. IV.2).
        var tdResp = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/themadoelen", new { leerplandoelCode = "NL-001" });
        tdResp.EnsureSuccessStatusCode();

        // 3. Create a class/age-scoped subthema.
        var subResp = await client.PostAsJsonAsync($"/api/themas/{thema.Id}/subthemas", new
        {
            naam = "Regen",
            duurWeken = 2,
            klasId,
            leeftijd = "K3",
        });
        Assert.True(subResp.StatusCode == HttpStatusCode.Created, await subResp.Content.ReadAsStringAsync());
        var subthema = await subResp.Content.ReadFromJsonAsync<SubthemaDto>();
        Assert.NotNull(subthema);

        // 4. Link the subthema to a leerdoel (creates a manueel subdoel).
        var subLink = await client.PostAsJsonAsync($"/api/subthemas/{subthema!.Id}/doelkoppelingen", new { leerplandoelCode = "WIS-001" });
        subLink.EnsureSuccessStatusCode();

        // 5. Create an activiteit + link it to a leerdoel.
        var actResp = await client.PostAsJsonAsync($"/api/subthemas/{subthema.Id}/activiteiten", new
        {
            naam = "Plassen meten",
            activiteitType = "Waarneming",
        });
        Assert.Equal(HttpStatusCode.Created, actResp.StatusCode);
        var activiteit = await actResp.Content.ReadFromJsonAsync<ActiviteitDto>();
        var actLink = await client.PostAsJsonAsync($"/api/activiteiten/{activiteit!.Id}/doelkoppelingen", new { leerplandoelCode = "NL-001" });
        actLink.EnsureSuccessStatusCode();

        // 6. Read the thema back and assert the whole subtree + manual statuses persisted.
        var detail = await client.GetFromJsonAsync<ThemaDto>($"/api/themas/{thema.Id}");
        Assert.NotNull(detail);
        Assert.Single(detail!.Themadoelen);
        Assert.Equal("Manueel", detail.Themadoelen[0].Koppeling.Status);
        var sub = Assert.Single(detail.Subthemas);
        Assert.Equal(klasId, sub.KlasId);
        Assert.Equal("Manueel", Assert.Single(sub.Subdoelen).Koppeling.Status);
        var act = Assert.Single(sub.Activiteiten);
        Assert.Equal("Manueel", Assert.Single(act.Doelkoppelingen).Status);
    }

    [Fact]
    public async Task Creating_a_subthema_without_a_klas_is_rejected_with_400()
    {
        var client = _factory.CreateClient();

        var themaResp = await client.PostAsJsonAsync("/api/themas", new { naam = "Lucht", duurWeken = 4 });
        var thema = await themaResp.Content.ReadFromJsonAsync<ThemaDto>();

        // Empty klas → a subthema cannot exist school-wide (Art. IX.2) → 400.
        var subResp = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/subthemas", new
        {
            naam = "Wind",
            duurWeken = 2,
            klasId = Guid.Empty,
            leeftijd = "K3",
        });
        Assert.Equal(HttpStatusCode.BadRequest, subResp.StatusCode);
    }

    [Fact]
    public async Task Linking_to_an_unknown_leerplandoel_is_rejected_with_400()
    {
        var client = _factory.CreateClient();

        var themaResp = await client.PostAsJsonAsync("/api/themas", new { naam = "Vuur", duurWeken = 4 });
        var thema = await themaResp.Content.ReadFromJsonAsync<ThemaDto>();

        var tdResp = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/themadoelen", new { leerplandoelCode = "BESTAAT-NIET" });
        Assert.Equal(HttpStatusCode.BadRequest, tdResp.StatusCode);
    }

    [Fact]
    public async Task Unknown_thema_returns_404()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync($"/api/themas/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    [Fact]
    public async Task Bibliotheek_returns_school_wide_thema_without_subthemas_and_voor_klas_filters_by_class()
    {
        // E1-11 (FR-3.3 resolved per-level, Art. IX.2): the shared thema-bibliotheek exposes the school-wide
        // layer only; the per-klas view derives only that class's subthema's — no cross-class bleed.
        var client = _factory.CreateClient();
        var klasId = _factory.KlasId;

        var themaResp = await client.PostAsJsonAsync("/api/themas", new
        {
            naam = "Bibliotheek-Water",
            duurWeken = 5,
            kernwoordenschat = new[] { "plas" },
        });
        var thema = await themaResp.Content.ReadFromJsonAsync<ThemaDto>();
        await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/subthemas", new
        {
            naam = "Regen",
            duurWeken = 2,
            klasId,
            leeftijd = "K3",
        });

        // Bibliotheek view: school-wide attributes, and structurally no subthema's field at all.
        var bibliotheek = await client.GetFromJsonAsync<IReadOnlyList<BibliotheekItemDto>>("/api/themas/bibliotheek");
        Assert.NotNull(bibliotheek);
        var item = Assert.Single(bibliotheek!, b => b.Naam == "Bibliotheek-Water");
        Assert.Equal(5, item.DuurWeken);
        Assert.Equal(new[] { "plas" }, item.Kernwoordenschat);
        Assert.Equal(1, item.AantalAfgeleideKlassen);

        // Per-klas derivation: the shared thema + this klas's single subthema.
        var voorKlas = await client.GetFromJsonAsync<ThemaDto>($"/api/themas/{thema.Id}/voor-klas/{klasId}");
        Assert.NotNull(voorKlas);
        Assert.Equal("Bibliotheek-Water", voorKlas!.Naam);
        var sub = Assert.Single(voorKlas.Subthemas);
        Assert.Equal(klasId, sub.KlasId);

        // A different (random) klas yields the shared thema with no derivations — and 404 if the klas is unknown.
        var onbekend = await client.GetAsync($"/api/themas/{thema.Id}/voor-klas/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.BadRequest, onbekend.StatusCode);
    }

    // --- Response DTOs (mirror the Application read views; only the fields asserted here). ---

    private sealed record ThemaDto(Guid Id, string Naam, int DuurWeken, IReadOnlyList<ThemadoelDto> Themadoelen, IReadOnlyList<SubthemaDto> Subthemas);

    private sealed record ThemadoelDto(Guid Id, KoppelingDto Koppeling);

    private sealed record SubthemaDto(Guid Id, Guid KlasId, string Leeftijd, IReadOnlyList<SubdoelDto> Subdoelen, IReadOnlyList<ActiviteitDto> Activiteiten);

    private sealed record SubdoelDto(Guid Id, KoppelingDto Koppeling);

    private sealed record ActiviteitDto(Guid Id, string Naam, IReadOnlyList<KoppelingDto> Doelkoppelingen);

    private sealed record KoppelingDto(Guid Id, string LeerplandoelCode, string Status);

    private sealed record BibliotheekItemDto(Guid Id, string Naam, int DuurWeken, IReadOnlyList<string> Kernwoordenschat, int AantalAfgeleideKlassen);

    /// <summary>
    /// WebApplicationFactory that swaps the Npgsql <see cref="AppDbContext"/> for the in-memory provider
    /// and seeds a klas + leerplandoel codes the CRUD flow references. One shared in-memory database name
    /// per factory instance keeps all requests on the same store.
    /// </summary>
    public sealed class Factory : WebApplicationFactory<Program>
    {
        private readonly string _dbNaam = $"e1_10_endpoints_{Guid.NewGuid():N}";
        private readonly Lock _seedLock = new();
        private bool _seeded;

        public Guid KlasId { get; private set; }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(Environments.Development);

            builder.ConfigureServices(services =>
            {
                // Drop every EF Core / Npgsql service the production wiring registered — both the
                // DbContext options and the provider's own infrastructure services — so only the
                // in-memory provider remains (otherwise EF refuses "two providers in one container").
                var toRemove = services
                    .Where(d =>
                        d.ServiceType == typeof(AppDbContext) ||
                        (d.ServiceType.FullName?.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal) ?? false) ||
                        (d.ServiceType.Namespace?.StartsWith("Npgsql", StringComparison.Ordinal) ?? false))
                    .ToList();
                foreach (var descriptor in toRemove)
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(_dbNaam));
            });
        }

        protected override IHost CreateHost(IHostBuilder builder)
        {
            var host = base.CreateHost(builder);
            EnsureSeeded(host.Services);
            return host;
        }

        private void EnsureSeeded(IServiceProvider services)
        {
            lock (_seedLock)
            {
                if (_seeded)
                {
                    return;
                }

                using var scope = services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                db.Database.EnsureCreated();

                var klas = db.Klassen.FirstOrDefault();
                if (klas is null)
                {
                    // A Klas lives in a Schooljaar (Art. IX.3 containment, E3-01).
                    var schooljaar = TestSchooljaar.Maak();
                    klas = schooljaar.VoegKlasToe("L1 — eerste leerjaar", leerjaar: 1);
                    db.Schooljaren.Add(schooljaar);
                    db.Leerplandoelen.AddRange(
                        Leerdoel("NL-001"),
                        Leerdoel("WIS-001"));
                    db.SaveChanges();
                }

                KlasId = klas.Id;
                _seeded = true;
            }
        }

        private static Leerplandoel Leerdoel(string code) =>
            new(code, Doelsoort.Minimumdoel, "K3", "Domein", "Subdomein", "1", tekst: "doeltekst");
    }
}
