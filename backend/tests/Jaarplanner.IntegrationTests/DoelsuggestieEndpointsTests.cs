using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Application.Ai;
using Jaarplanner.Domain.Curriculum;
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
/// Drives a thema's doelsuggestie endpoints end-to-end (HTTP → controller → service → EF), FB-053 (ADR-0049): the AI
/// proposes minimumdoelen as themadoel, and a decision accepts or rejects each.
/// <para>
/// The generation tests go <b>through</b> <c>POST …/doelsuggesties/genereer</c> (the real controller, the real
/// <c>DoelMatchingService</c>, the real EF store) and assert on rows only that path could have written. Accepting one
/// is asserted on the thema itself: its minimumdoel is then a themadoel.
/// </para>
/// <para>
/// The DbContext is the EF Core in-memory provider and the AI client is a stub, so the suite needs no Postgres container
/// and no network. <c>RechtenAfdwingingTests</c> pins who may call these routes.
/// </para>
/// </summary>
public sealed class DoelsuggestieEndpointsTests : IClassFixture<DoelsuggestieEndpointsTests.Factory>
{
    private readonly Factory _factory;

    public DoelsuggestieEndpointsTests(Factory factory) => _factory = factory;

    [Fact]
    public async Task Aanvaarden_maakt_het_minimumdoel_een_themadoel_en_overleeft_een_herlaad()
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        // A fresh proposal is queryable and still `voorgesteld`: never auto-applied (Art. IV.1).
        var voor = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        var suggestie = Assert.Single(voor!, s => s.Id == suggestieId);
        Assert.Equal("Voorgesteld", suggestie.Status);
        Assert.Equal("Het thema speelt met rijmpjes.", suggestie.AiMotivatie);
        Assert.Empty(await _factory.ThemadoelRefsAsync(themaId));

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/status", new { status = "Aanvaard" });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.Equal("Aanvaard", (await put.Content.ReadFromJsonAsync<SuggestieDto>())!.Status);

        // Reload: the decision survived, and the minimumdoel is a themadoel of the thema, as FB-043 makes it.
        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Equal("Aanvaard", Assert.Single(na!, s => s.Id == suggestieId).Status);
        Assert.Equal(["K-1.1.1"], await _factory.ThemadoelRefsAsync(themaId));
        var thema = await client.GetFromJsonAsync<JsonElement>($"/api/themas/{themaId}");
        Assert.Equal("K-1.1.1", thema.GetProperty("minimumdoelen")[0].GetProperty("minimumdoelRef").GetString());
    }

    [Fact]
    public async Task Een_geweigerd_voorstel_komt_bij_een_volgende_vraag_niet_terug()
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/status", new { status = "Geweigerd" });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.Empty(await _factory.ThemadoelRefsAsync(themaId));

        _factory.AiAntwoord = """{"suggesties":[{"code":"K-1.1.1","motivatie":"toch weer"},{"code":"K-9.1.1","motivatie":"nieuw"}]}""";
        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });

        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.Equal(["K-9.1.1"], resultaat!.Bewaard.Select(b => b.MinimumdoelRef));
        Assert.Equal(["K-1.1.1"], resultaat.OvergeslagenDuplicaat);
        Assert.Contains("Niet voorstellen (al themadoel of al voorgesteld): K-1.1.1", _factory.LaatsteUserPrompt, StringComparison.Ordinal);

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Equal("Geweigerd", Assert.Single(na!, s => s.MinimumdoelRef == "K-1.1.1").Status);
        Assert.Equal("Voorgesteld", Assert.Single(na!, s => s.MinimumdoelRef == "K-9.1.1").Status);
    }

    [Theory]
    [InlineData("Voorgesteld")]
    [InlineData("Manueel")]
    public async Task Een_andere_beslissing_dan_aanvaarden_of_weigeren_geeft_400(string status)
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/status", new { status });
        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
    }

    [Fact]
    public async Task Een_beslist_voorstel_opnieuw_beslissen_geeft_400()
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();
        await client.PutAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/{suggestieId}/status", new { status = "Geweigerd" });

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/status", new { status = "Aanvaard" });

        Assert.Equal(HttpStatusCode.BadRequest, put.StatusCode);
        var probleem = await put.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Over dit voorstel is al beslist.", probleem!.Detail);
        Assert.Empty(await _factory.ThemadoelRefsAsync(themaId));
    }

    [Fact]
    public async Task De_route_om_een_leerplandoel_in_te_ruilen_bestaat_niet_meer()
    {
        var client = _factory.CreateClient();
        var (themaId, suggestieId) = await _factory.SeedThemaMetSuggestieAsync();

        var put = await client.PutAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/{suggestieId}/leerplandoel", new { leerplandoelCode = "NAT-K3-01" });

        // No endpoint takes it: the path answers 405 because the status route shares its prefix.
        Assert.Equal(HttpStatusCode.MethodNotAllowed, put.StatusCode);
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
    // FR-4.1: generation through the real service. No row below is seeded; the endpoint creates it.
    // -------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Genereren_maakt_voorgestelde_minimumdoelen_die_de_lijst_daarna_toont()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord =
            """{"suggesties":[{"code":"K-9.1.1","motivatie":"Het thema volgt de seizoenen."}]}""";

        var voor = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Empty(voor!);

        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.True(resultaat!.IsGeslaagd);
        // The thema's one subthema is K3, so the candidates are the two minimumdoelen of mijlpaal K-.
        Assert.Equal(2, resultaat.AantalKandidaten);
        Assert.Equal(["K3"], resultaat.JaarFasen);
        Assert.Equal(["K-"], resultaat.Mijlpalen);
        Assert.Equal("Voorgesteld", Assert.Single(resultaat.Bewaard).Status);

        // Read back out of the database, with the minimumdoel's own text (FR-4.2), and not yet a themadoel.
        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        var suggestie = Assert.Single(na!);
        Assert.Equal("K-9.1.1", suggestie.MinimumdoelRef);
        Assert.Equal("Voorgesteld", suggestie.Status);
        Assert.Equal("Het thema volgt de seizoenen.", suggestie.AiMotivatie);
        Assert.Equal("De kleuters kunnen seizoenen onderscheiden.", suggestie.Omschrijving);
        Assert.Equal("K-", suggestie.Mijlpaal);
        Assert.Empty(await _factory.ThemadoelRefsAsync(themaId));
    }

    [Theory]
    [InlineData("L1")]
    [InlineData("l1")]
    public async Task Een_keuze_in_de_aanvraag_bepaalt_de_mijlpaal(string jaarFase)
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord = """{"suggesties":[]}""";

        var post = await client.PostAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/genereer",
            new { jaarFasen = new[] { jaarFase } });

        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.True(resultaat!.IsGeslaagd);
        Assert.Equal(["4-"], resultaat.Mijlpalen);
        Assert.Equal(1, resultaat.AantalKandidaten);
    }

    [Fact]
    public async Task Een_thema_zonder_subthemas_en_zonder_keuze_geeft_400_en_roept_de_ai_niet_aan()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSubthemasAsync();
        var voor = _factory.AantalAiAanroepen;

        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });

        Assert.Equal(HttpStatusCode.BadRequest, post.StatusCode);
        var probleem = await post.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Kies eerst voor welke leeftijden je doelsuggesties wil.", probleem!.Detail);
        Assert.Equal(voor, _factory.AantalAiAanroepen);
    }

    [Fact]
    public async Task Een_thema_zonder_subthemas_zoekt_in_de_gekozen_leeftijden()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSubthemasAsync();
        _factory.AiAntwoord = """{"suggesties":[]}""";

        var post = await client.PostAsJsonAsync(
            $"/api/themas/{themaId}/doelsuggesties/genereer",
            new { jaarFasen = new[] { "K2" } });

        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.Equal(2, resultaat!.AantalKandidaten);
        Assert.Equal(["K2"], resultaat.JaarFasen);
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
    public async Task Een_verzonnen_code_of_een_leerplandoel_belandt_niet_in_de_databank()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord =
            """{"suggesties":[{"code":"K-1.1.1","motivatie":"geldig"},{"code":"VERZONNEN-99","motivatie":"bestaat niet"},{"code":"NAT-K3-01","motivatie":"een leerplandoel"}]}""";

        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });
        var resultaat = await post.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.Equal(["VERZONNEN-99", "NAT-K3-01"], resultaat!.OvergeslagenOnbekend);

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Equal("K-1.1.1", Assert.Single(na!).MinimumdoelRef);
    }

    [Fact]
    public async Task Opnieuw_genereren_dupliceert_niets()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord = """{"suggesties":[{"code":"K-1.1.1","motivatie":"past"}]}""";

        await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });
        var tweede = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });

        var resultaat = await tweede.Content.ReadFromJsonAsync<GeneratieDto>();
        Assert.Empty(resultaat!.Bewaard);
        Assert.Equal("K-1.1.1", Assert.Single(resultaat.OvergeslagenDuplicaat));

        var na = await client.GetFromJsonAsync<List<SuggestieDto>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Single(na!);
    }

    private sealed record SuggestieDto(
        Guid Id,
        string MinimumdoelRef,
        string Status,
        string? AiMotivatie,
        string? Omschrijving,
        string? Mijlpaal);

    private sealed record GeneratieDto(
        bool IsGeslaagd,
        string? Fout,
        int AantalKandidaten,
        List<string> JaarFasen,
        List<string> Mijlpalen,
        List<SuggestieDto> Bewaard,
        List<string> OvergeslagenOnbekend,
        List<string> OvergeslagenDuplicaat);

    /// <summary>
    /// WebApplicationFactory on the in-memory EF provider with a <b>stub AI client</b>. The container is
    /// otherwise production wiring: the real controller, the real <c>DoelMatchingService</c>, the real EF
    /// store and the real <c>EfLeerdoelCatalogus</c>. Only the two things a test must not do for real —
    /// call Azure and touch Postgres — are replaced (Art. IV.6, VI.4: no key is needed anywhere here).
    /// <para>
    /// It seeds the read-only minimumdoelen a proposal can point at (two of mijlpaal K-, one of 4-, so a leeftijd
    /// choice is observable) and a leerplandoel, and offers thema seeds: bare, without subthema's, and one already
    /// carrying a <c>voorgesteld</c> proposal, for the decision tests.
    /// </para>
    /// </summary>
    public class Factory : JaarplannerApiFactory
    {
        private readonly string _dbNaam = $"e2_05_endpoints_{Guid.NewGuid():N}";

        /// <summary>The canned completion the stub AI client returns; set per test before generating.</summary>
        public string AiAntwoord { get; set; } = """{"suggesties":[]}""";

        /// <summary>How often the stub AI client was called, so a test can prove a refused run never reached it.</summary>
        public int AantalAiAanroepen { get; private set; }

        /// <summary>The user prompt of the stub's last call.</summary>
        public string LaatsteUserPrompt { get; private set; } = string.Empty;

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

                // Reads the canned answer at call time so a test can set it after the host is built.
                services.AddSingleton<IAiClient>(new StubAiClient(request =>
                {
                    AantalAiAanroepen++;
                    LaatsteUserPrompt = request.UserPrompt;
                    return AiAntwoord;
                }));
            });
        }

        /// <summary>Creates a thema with no subthema's, so no leeftijd can be taken from it (TB-007).</summary>
        public async Task<Guid> SeedThemaZonderSubthemasAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await SeedLeerplandoelenAsync(db);

            var thema = new Thema("Water", duurWeken: 4);
            db.Themas.Add(thema);
            await db.SaveChangesAsync();

            return thema.Id;
        }

        /// <summary>The refs of the thema's minimumdoel themadoelen, read from the database.</summary>
        public async Task<List<string>> ThemadoelRefsAsync(Guid themaId)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            return await db.ThemaMinimumdoelen
                .Where(m => m.ThemaId == themaId)
                .Select(m => m.MinimumdoelRef)
                .ToListAsync();
        }

        /// <summary>Creates a thema with one <c>voorgesteld</c> doelsuggestie and returns (themaId, suggestieId).</summary>
        public async Task<(Guid ThemaId, Guid SuggestieId)> SeedThemaMetSuggestieAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await SeedLeerplandoelenAsync(db);

            var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur");
            thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K3");
            var suggestie = thema.VoegDoelsuggestieToe("K-1.1.1", "Het thema speelt met rijmpjes.");
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
            thema.VoegSubthemaToe("Bladeren", duurWeken: 2, leeftijd: "K3");
            db.Themas.Add(thema);
            await db.SaveChangesAsync();

            return thema.Id;
        }

        private static async Task SeedLeerplandoelenAsync(AppDbContext db)
        {
            await db.Database.EnsureCreatedAsync();

            if (await db.Minimumdoelen.AnyAsync(m => m.Ref == "K-1.1.1"))
            {
                return;
            }

            db.Minimumdoelen.AddRange(
                new Minimumdoel("K-1.1.1", "K-", "1.1.1", "De kleuters kunnen rijm herkennen.", "Nederlands", "Lezen"),
                new Minimumdoel("K-9.1.1", "K-", "9.1.1", "De kleuters kunnen seizoenen onderscheiden.", "Wereldoriëntatie", "Natuur"),
                new Minimumdoel("4-2.1.1", "4-", "2.1.1", "De leerlingen tellen tot honderd.", "Wiskunde", "Getallen"));
            db.Leerplandoelen.Add(
                new Leerplandoel("NAT-K3-01", Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."));
            await db.SaveChangesAsync();
        }

        private sealed class StubAiClient : IAiClient
        {
            private readonly Func<AiRequest, string> _antwoord;

            public StubAiClient(Func<AiRequest, string> antwoord) => _antwoord = antwoord;

            public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
                Task.FromResult(new AiCompletion { Content = _antwoord(request) });
        }
    }
}

/// <summary>
/// The prompt ceiling of TB-007 through the real endpoint and the real configuration binding: with
/// <c>AiPrompt:MaxTokens</c> set to 10 every run is over it, so the answer is a 400 carrying the Dutch sentence, the model
/// is not called and nothing lands in the database.
/// </summary>
public sealed class DoelsuggestiePromptgrensTests : IClassFixture<DoelsuggestiePromptgrensTests.KleineGrensFactory>
{
    private readonly KleineGrensFactory _factory;

    public DoelsuggestiePromptgrensTests(KleineGrensFactory factory) => _factory = factory;

    [Fact]
    public async Task Boven_de_grens_geeft_400_roept_de_ai_niet_aan_en_bewaart_niets()
    {
        var client = _factory.CreateClient();
        var themaId = await _factory.SeedThemaZonderSuggestiesAsync();
        _factory.AiAntwoord = """{"suggesties":[{"code":"K-1.1.1","motivatie":"past"}]}""";

        var post = await client.PostAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/genereer", new { });

        Assert.Equal(HttpStatusCode.BadRequest, post.StatusCode);
        var probleem = await post.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Contains("de grens is 10)", probleem!.Detail, StringComparison.Ordinal);
        Assert.Equal(0, _factory.AantalAiAanroepen);

        var na = await client.GetFromJsonAsync<List<JsonElement>>($"/api/themas/{themaId}/doelsuggesties");
        Assert.Empty(na!);
    }

    /// <summary>The endpoint host of <see cref="DoelsuggestieEndpointsTests"/>, with a ceiling every prompt is over.</summary>
    public sealed class KleineGrensFactory : DoelsuggestieEndpointsTests.Factory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.UseSetting("AiPrompt:MaxTokens", "10");
        }
    }
}
