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
    /// <summary>
    /// The jaar/fase the seeded klas teaches, and one it does not. Named rather than spelled out at every call
    /// site because the two have to stay in step with <see cref="Factory"/>: since 2026-08-30 a subthema reaches
    /// a class through this string alone (Art. IX.2), so a fixture that seeds "L1" and posts "K3" silently tests
    /// an empty derivation instead of the thing it says it tests. That is exactly how three of these tests broke.
    /// </summary>
    private const string Leeftijd = "L1";

    private const string AndereLeeftijd = "K3";

    private readonly Factory _factory;

    public SchoolcontentBeheerEndpointsTests(Factory factory) => _factory = factory;

    [Fact]
    public async Task Full_crud_flow_with_goal_links_round_trips()
    {
        var client = _factory.CreateClient();

        // 1. Create a school-wide thema.
        //    No klasId anywhere in this flow: content is school-wide and age-scoped since 2026-08-30, and the
        //    class only comes back into it when something is READ for one class or PLANNED in one.
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

        // 3. Create an age-scoped subthema, at the age the seeded klas teaches (Art. IX.2, 2026-08-30). The
        //    request no longer carries a klasId: the API takes none, and posting one would only make this read
        //    like content still belongs to a class.
        var subResp = await client.PostAsJsonAsync($"/api/themas/{thema.Id}/subthemas", new
        {
            naam = "Regen",
            duurWeken = 2,
            leeftijd = Leeftijd,
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
        Assert.Equal(Leeftijd, sub.Leeftijd);
        Assert.Equal("Manueel", Assert.Single(sub.Subdoelen).Koppeling.Status);
        var act = Assert.Single(sub.Activiteiten);
        Assert.Equal("Manueel", Assert.Single(act.Doelkoppelingen).Status);
    }

    /// <summary>
    /// <b>The structural requirement is the leeftijd, and since 2026-08-30 it is the only one.</b> This test used
    /// to post an empty <c>klasId</c> and assert that a subthema cannot exist school-wide. That invariant was
    /// abolished by Art. IX.2: a subthema is school-wide now, and what it may never be is ageless. So the same
    /// property is asserted about the field that still carries the scope.
    /// <para>
    /// Both halves are worth a request. A <b>blank</b> age is refused by the aggregate's own <c>Require</c>, an
    /// <b>unknown</b> one by the service against the nine ruled jaar/fase codes, and only the second of those
    /// would let "K3 " or "derde kleuter" into a column every scope comparison reads with an ordinal equals.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Creating_a_subthema_without_a_valid_leeftijd_is_rejected_with_400()
    {
        var client = _factory.CreateClient();

        var themaResp = await client.PostAsJsonAsync("/api/themas", new { naam = "Lucht", duurWeken = 4 });
        var thema = await themaResp.Content.ReadFromJsonAsync<ThemaDto>();

        var zonder = await client.PostAsJsonAsync($"/api/themas/{thema!.Id}/subthemas", new
        {
            naam = "Wind",
            duurWeken = 2,
            leeftijd = "",
        });
        Assert.Equal(HttpStatusCode.BadRequest, zonder.StatusCode);

        var onbekend = await client.PostAsJsonAsync($"/api/themas/{thema.Id}/subthemas", new
        {
            naam = "Wind",
            duurWeken = 2,
            leeftijd = "derde kleuter",
        });
        Assert.Equal(HttpStatusCode.BadRequest, onbekend.StatusCode);

        // Dutch, and it names the vocabulary rather than only refusing: a teacher who typed the age out in words
        // cannot guess "K3" from "ongeldig" (Art. II.3).
        var probleem = await onbekend.Content.ReadFromJsonAsync<ProbleemDto>();
        Assert.Contains("geen geldige leeftijd", probleem!.Detail, StringComparison.Ordinal);
        Assert.Contains("K3", probleem.Detail, StringComparison.Ordinal);

        // And nothing was created by either attempt.
        var detail = await client.GetFromJsonAsync<ThemaDto>($"/api/themas/{thema.Id}");
        Assert.Empty(detail!.Subthemas);
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

    /// <summary>
    /// E1-11 (FR-3.3 resolved per-level, Art. IX.2): the shared thema-bibliotheek exposes the school-wide layer
    /// only, and the per-klas view derives the subthema's at the ages that class teaches.
    /// <para>
    /// <b>"No cross-class bleed" is no longer what this proves, and the fixture had to change to keep proving
    /// anything.</b> Since 2026-08-30 two classes at one age share every subthema by design, so a second class
    /// can no longer stand for content that must stay out. What still separates is the AGE, so the exclusion is
    /// asserted with a subthema at an age this class does not teach.
    /// </para>
    /// </summary>
    [Fact]
    public async Task Bibliotheek_returns_school_wide_thema_without_subthemas_and_voor_klas_filters_by_leeftijd()
    {
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
            leeftijd = Leeftijd,
        });

        // A second subthema on the same thema, at an age this klas does not teach. It is what makes the read
        // below an assertion about a filter rather than about a fixture with one row in it.
        await client.PostAsJsonAsync($"/api/themas/{thema.Id}/subthemas", new
        {
            naam = "Sneeuw",
            duurWeken = 2,
            leeftijd = AndereLeeftijd,
        });

        // Bibliotheek view: school-wide attributes, and structurally no subthema's field at all.
        var bibliotheek = await client.GetFromJsonAsync<IReadOnlyList<BibliotheekItemDto>>("/api/themas/bibliotheek");
        Assert.NotNull(bibliotheek);
        var item = Assert.Single(bibliotheek!, b => b.Naam == "Bibliotheek-Water");
        Assert.Equal(5, item.DuurWeken);
        Assert.Equal(new[] { "plas" }, item.Kernwoordenschat);
        Assert.Equal(2, item.AantalAfgeleideLeeftijden);

        // Per-klas derivation: the shared thema plus the subthema at THIS class's age, and not the other one.
        var voorKlas = await client.GetFromJsonAsync<ThemaDto>($"/api/themas/{thema.Id}/voor-klas/{klasId}");
        Assert.NotNull(voorKlas);
        Assert.Equal("Bibliotheek-Water", voorKlas!.Naam);
        var sub = Assert.Single(voorKlas.Subthemas);
        Assert.Equal(Leeftijd, sub.Leeftijd);
        Assert.Equal("Regen", sub.Naam);

        // An unknown klas is a 400 and not an empty derivation: "we do not know this class" and "this class has
        // no content" are different facts, and a screen that reads the second from the first hides its own
        // control (the antagonist finding behind the same refusal on /api/subthemas/voor-klas).
        var onbekend = await client.GetAsync($"/api/themas/{thema.Id}/voor-klas/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.BadRequest, onbekend.StatusCode);
    }

    // --- Response DTOs (mirror the Application read views; only the fields asserted here). ---

    private sealed record ThemaDto(Guid Id, string Naam, int DuurWeken, IReadOnlyList<ThemadoelDto> Themadoelen, IReadOnlyList<SubthemaDto> Subthemas);

    private sealed record ThemadoelDto(Guid Id, KoppelingDto Koppeling);

    private sealed record SubthemaDto(Guid Id, string Naam, string Leeftijd, IReadOnlyList<SubdoelDto> Subdoelen, IReadOnlyList<ActiviteitDto> Activiteiten);

    private sealed record SubdoelDto(Guid Id, KoppelingDto Koppeling);

    private sealed record ActiviteitDto(Guid Id, string Naam, IReadOnlyList<KoppelingDto> Doelkoppelingen);

    private sealed record KoppelingDto(Guid Id, string LeerplandoelCode, string Status);

    private sealed record BibliotheekItemDto(Guid Id, string Naam, int DuurWeken, IReadOnlyList<string> Kernwoordenschat, int AantalAfgeleideLeeftijden);

    /// <summary>RFC 7807 problem details, of which only the teacher-facing sentence is asserted here.</summary>
    private sealed record ProbleemDto(string Detail);

    /// <summary>
    /// WebApplicationFactory that swaps the Npgsql <see cref="AppDbContext"/> for the in-memory provider
    /// and seeds a klas + leerplandoel codes the CRUD flow references. One shared in-memory database name
    /// per factory instance keeps all requests on the same store.
    /// </summary>
    public sealed class Factory : JaarplannerApiFactory
    {
        private readonly string _dbNaam = $"e1_10_endpoints_{Guid.NewGuid():N}";
        private readonly Lock _seedLock = new();
        private bool _seeded;

        public Guid KlasId { get; private set; }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
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
                    klas = schooljaar.VoegKlasToe("L1 — eerste leerjaar", "L1");
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
