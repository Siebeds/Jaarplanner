using System.Net;
using System.Net.Http.Json;
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
/// Drives the E2-05 doelsuggestie-review endpoints end-to-end (HTTP → controller → service → EF) for
/// the FR-4.3 acceptance: a teacher lists a thema's AI suggestions and sets a status
/// (aanvaard/geweigerd/manueel), and that status <b>persists across a reload</b> (a fresh GET) and is the
/// exact value E5 coverage reads (Art. IV.1/IV.2). Nothing is auto-applied: the seeded suggestion stays
/// <c>voorgesteld</c> until an explicit PUT. The DbContext is the EF Core in-memory provider so no
/// Postgres container is needed — it runs in CI/dev exactly as written.
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

    private sealed record SuggestieDto(Guid Id, string LeerplandoelCode, string Status, string? AiMotivatie);

    /// <summary>
    /// WebApplicationFactory on the in-memory EF provider. It seeds the read-only leerplandoel the
    /// suggestion links to, then per test creates a thema carrying one <c>voorgesteld</c> doelsuggestie
    /// (as the E2-04 match run would have persisted it) and returns its ids.
    /// </summary>
    public sealed class Factory : WebApplicationFactory<Program>
    {
        private const string LeerdoelCode = "NAT-K3-01";
        private readonly string _dbNaam = $"e2_05_endpoints_{Guid.NewGuid():N}";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(Environments.Development);

            builder.ConfigureServices(services =>
            {
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

        /// <summary>Creates a thema with one <c>voorgesteld</c> doelsuggestie and returns (themaId, suggestieId).</summary>
        public async Task<(Guid ThemaId, Guid SuggestieId)> SeedThemaMetSuggestieAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureCreatedAsync();

            if (!await db.Leerplandoelen.AnyAsync(l => l.Code == LeerdoelCode))
            {
                db.Leerplandoelen.Add(new Leerplandoel(
                    LeerdoelCode, Doelsoort.Minimumdoel, "K3", "Natuur", "Levende natuur", "9", tekst: "herkent bomen."));
            }

            var thema = new Thema("Herfst", duurWeken: 4, invalshoeken: "natuur");
            var suggestie = thema.VoegDoelsuggestieToe(
                new DoelKoppeling(LeerdoelCode, KoppelingStatus.Voorgesteld, "past bij het observeren van bomen"));
            db.Themas.Add(thema);
            await db.SaveChangesAsync();

            return (thema.Id, suggestie.Id);
        }
    }
}
