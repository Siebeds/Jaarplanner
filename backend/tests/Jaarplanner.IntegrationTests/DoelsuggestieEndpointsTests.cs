using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Drives the doelsuggestie endpoints end-to-end (HTTP → controller → service → EF).
/// <para>
/// <b>E2-05 (FR-4.3):</b> a teacher lists a thema's AI suggestions and sets a status
/// (aanvaard/geweigerd/manueel), and that status <b>persists across a reload</b> (a fresh GET) and is the
/// exact value E5 coverage reads (Art. IV.1/IV.2). Nothing is auto-applied: a fresh suggestion stays
/// <c>voorgesteld</c> until an explicit PUT.
/// </para>
/// <para>
/// <b>E2-08 (FR-4.1) — and this is the half that was missing.</b> Every test in this file used to seed its
/// suggestions straight into the database, so the suite passed while <b>no suggestion could be created by a
/// running application at all</b>: nothing but a unit test ever called the matching service. The generation
/// tests below therefore go <b>through</b> <c>POST …/doelsuggesties/genereer</c> — the real controller, the
/// real <c>DoelMatchingService</c>, the real EF store — and assert on rows that only that path could have
/// written. A seeding shortcut here would recreate the exact blind spot this story exists to close.
/// </para>
/// <para>
/// The DbContext is the EF Core in-memory provider and the AI client is a stub, so the suite needs no
/// Postgres container and no network and never skips — the two things a test must not do for real are the
/// only two things replaced.
/// </para>
/// </summary>
public sealed class DoelsuggestieEndpointsTests : IClassFixture<DoelsuggestieEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public DoelsuggestieEndpointsTests(Factory factory) => _factory = factory;

    [Theory]
    [InlineData("Aanvaard")]
    [InlineData("Geweigerd")]
    [InlineData("Manueel")]
    public async Task Teacher_decision_persists_across_a_reload(string beslissing)
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        // A fresh suggestion is queryable and still `voorgesteld` — never auto-applied (Art. IV.1).
        var voor = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        var suggestie = Assert.Single(voor!, s => s.Id == suggestieId);
        Assert.Equal("Voorgesteld", suggestie.Status);
        Assert.Equal("past bij het observeren van bomen", suggestie.AiMotivatie);

        // Teacher records a decision.
        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/status", new { status = beslissing });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        var bijgewerkt = await put.Content.ReadFromJsonAsync<SuggestieDto>();
        Assert.Equal(beslissing, bijgewerkt!.Status);

        // Reload (a brand-new request/GET) — the status survived, proving it was persisted.
        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Equal(beslissing, Assert.Single(na!, s => s.Id == suggestieId).Status);
    }

    [Fact]
    public async Task Setting_voorgesteld_by_hand_is_rejected_with_400()
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/status", new { status = "Voorgesteld" });
        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
    }

    [Fact]
    public async Task Unknown_suggestie_returns_404()
    {
        var client = _factory.CreateClient();
        var (themaId, _) = await _factory.SeedThemaMetSuggestieAsync();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{Guid.NewGuid()}/status", new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
    }

    [Fact]
    public async Task Unknown_thema_returns_404()
    {
        var client = _factory.CreateClient();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{Guid.NewGuid()}/doelsuggesties/{Guid.NewGuid()}/status", new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.NotFound, put.StatusCode);
    }

    // -------------------------------------------------------------------------------------------------
    // E2-08 — FR-4.1: generation through the real service. No row below is seeded; the endpoint creates it.
    // -------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Genereren_maakt_voorgestelde_suggesties_die_de_lijst_daarna_toont()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord =
            """{"suggesties":[{"code":"NAT-K3-01","motivatie":"past bij het observeren van bomen"}]}""";

        // Precondition: the thema has nothing. This is what a deployed app showed forever before E2-08.
        var voor = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Empty(voor!);

        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.True(resultaat!.IsGeslaagd);
        Assert.Equal(3, resultaat.AantalKandidaten);
        var voorgesteld = Assert.Single(resultaat.Bewaard);
        Assert.Equal("Voorgesteld", voorgesteld.Status);

        // A fresh GET — i.e. read back out of the database — shows what generation persisted, with the
        // leerplandoel's own text and doelsoort so the teacher can judge it (FR-4.2).
        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        var suggestie = Assert.Single(na!);
        Assert.Equal("NAT-K3-01", suggestie.LeerplandoelCode);
        Assert.Equal("Voorgesteld", suggestie.Status);
        Assert.Equal("past bij het observeren van bomen", suggestie.AiMotivatie);
        Assert.Equal("herkent bomen.", suggestie.Tekst);
        Assert.Equal("Minimumdoel", suggestie.Doelsoort);
    }

    [Fact]
    public async Task Een_selectie_in_de_aanvraag_begrenst_de_kandidaten()
    {
        // The scope of a run is the caller's explicit, per-run choice — "which disciplines first" is still an
        // open Art. XIV question, so no layer may answer it silently.
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord = """{"suggesties":[]}""";

        var post = await client.PostAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/genereer",
            new { selectie = new { jaarFasen = new[] { "L1" } } });

        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.True(resultaat!.IsGeslaagd);
        Assert.Equal(1, resultaat.AantalKandidaten);
    }

    [Fact]
    public async Task Kapot_ai_antwoord_geeft_422_en_persisteert_niets()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord = "dit is geen JSON {kapot";

        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });
        Assert.Equal(HttpStatusCode.UnprocessableEntity, post.StatusCode);

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Empty(na!);
    }

    [Fact]
    public async Task Een_verzonnen_code_belandt_niet_in_de_databank()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord =
            """{"suggesties":[{"code":"NAT-K3-02","motivatie":"geldig"},{"code":"VERZONNEN-99","motivatie":"bestaat niet"}]}""";

        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });
        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.Equal("VERZONNEN-99", Assert.Single(resultaat!.OvergeslagenOnbekend));

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Equal("NAT-K3-02", Assert.Single(na!).LeerplandoelCode);
    }

    [Fact]
    public async Task Opnieuw_genereren_dupliceert_niets()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord = """{"suggesties":[{"code":"NAT-K3-01","motivatie":"past"}]}""";

        await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });
        var tweede = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });

        var resultaat = await tweede.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.Empty(resultaat!.Bewaard);
        Assert.Equal("NAT-K3-01", Assert.Single(resultaat.OvergeslagenDuplicaat));

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Single(na!);
    }

    // -------------------------------------------------------------------------------------------------
    // E2-08 — FR-4.3 "aanpassen": substituting a different leerplandoel, landing as `manueel`.
    // -------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Aanpassen_vervangt_het_doel_en_overleeft_een_herlaad()
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/leerplandoel",
            new { leerplandoelCode = "NAT-K3-02" });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        var suggestie = Assert.Single(na!, s => s.Id == suggestieId);
        Assert.Equal("NAT-K3-02", suggestie.LeerplandoelCode);
        Assert.Equal("Manueel", suggestie.Status);
        // The AI motivation went with the code it described (Art. IV.3), and the new goal's text is shown.
        Assert.Null(suggestie.AiMotivatie);
        Assert.Equal("observeert de natuur.", suggestie.Tekst);
    }

    [Fact]
    public async Task Aanpassen_naar_een_onbestaande_code_geeft_400_en_wijzigt_niets()
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/leerplandoel",
            new { leerplandoelCode = "VERZONNEN-99" });
        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        var suggestie = Assert.Single(na!, s => s.Id == suggestieId);
        Assert.Equal("NAT-K3-01", suggestie.LeerplandoelCode);
        Assert.Equal("Voorgesteld", suggestie.Status);
    }

    private sealed record SuggestieDto(
        Guid Id,
        string LeerplandoelCode,
        string Status,
        string? AiMotivatie,
        string? Tekst,
        string? Doelsoort);

    private sealed record GeneratieDto(
        bool IsGeslaagd,
        string? Fout,
        int AantalKandidaten,
        List<SuggestieDto> Bewaard,
        List<string> OvergeslagenOnbekend,
        List<string> OvergeslagenDuplicaat);

    /// <summary>
    /// WebApplicationFactory on the in-memory EF provider with a <b>stub AI client</b>. The container is
    /// otherwise production wiring: the real controller, the real <c>DoelMatchingService</c>, the real EF
    /// store and the real <c>EfLeerdoelCatalogus</c>. Only the two things a test must not do for real —
    /// call Azure and touch Postgres — are replaced (Art. IV.6, VI.4: no key is needed anywhere here).
    /// <para>
    /// It seeds the read-only leerplandoelen a suggestion can point at (two K3 + one L1, so a jaar/fase
    /// selection is actually observable) and offers two thema seeds: one bare, for the generation tests,
    /// and one already carrying a <c>voorgesteld</c> suggestion, for the review tests.
    /// </para>
    /// </summary>
    public sealed class Factory : WebApplicationFactory<Program>
    {
        private const string LeerdoelCode = "NAT-K3-01";
        private readonly string _dbNaam = $"e2_05_endpoints_{Guid.NewGuid():N}";

        /// <summary>The canned completion the stub AI client returns; set per test before generating.</summary>
        public string AiAntwoord { get; set; } = """{"suggesties":[]}""";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
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

                // Reads the canned answer at call time so a test can set it after the host is built.
                services.AddSingleton<IAiClient>(new StubAiClient(() => AiAntwoord));
            });
        }

        /// <summary>Creates a thema with one <c>voorgesteld</c> doelsuggestie and returns (themaId, suggestieId).</summary>
        public async Task<(Guid ThemaId, Guid SuggestieId)> SeedThemaMetSuggestieAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await SeedLeerplandoelenAsync(db);

            var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur");
            var suggestie = thema.VoegDoelsuggestieToe(
                new DoelKoppeling(LeerdoelCode, KoppelingStatus.Voorgesteld, "past bij het observeren van bomen"));
            db.Themas.Add(thema);
            await db.SaveChangesAsync();

            return (thema.Id, suggestie.Id);
        }

        /// <summary>Creates a thema with <b>no</b> suggestions — generation has to create them.</summary>
        public async Task<Guid> SeedThemaZonderSuggestiesAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await SeedLeerplandoelenAsync(db);

            var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur");
            thema.VoegSubthemaToe("Bladeren", duurWeken: 2, klasId: Guid.NewGuid(), leeftijd: "K3");
            db.Themas.Add(thema);
            await db.SaveChangesAsync();

            return thema.Id;
        }

        private static async Task SeedLeerplandoelenAsync(AppDbContext db)
        {
            await db.Database.EnsureCreatedAsync();

            if (await db.Leerplandoelen.AnyAsync(l => l.Code == LeerdoelCode))
            {
                return;
            }

            db.Leerplandoelen.AddRange(
                new Leerplandoel(LeerdoelCode, Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."),
                new Leerplandoel("NAT-K3-02", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9", tekst: "observeert de natuur."),
                new Leerplandoel("REK-L1-01", Doelsoort.Gemeenschappelijk, "L1", "Getallen", "Getalbegrip", "2", tekst: "telt tot 20."));
            await db.SaveChangesAsync();
        }

        private sealed class StubAiClient : IAiClient
        {
            private readonly Func<string> _antwoord;

            public StubAiClient(Func<string> antwoord) => _antwoord = antwoord;

            public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
                Task.FromResult(new AiCompletion { Content = _antwoord() });
        }
    }
}
