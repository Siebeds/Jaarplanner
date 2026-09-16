using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Jaarplanner.IntegrationTests;

/// <summary>
/// Reachability + correctness for <c>GET /api/schooljaren/{id}/rooster</c>: the school year's span and its vacations,
/// the frame the timeline and the agenda are drawn in (ADR-0053 decision 6). A <c>VrijeDag</c> is a day off inside a
/// week, never a gap, so it is not reported.
/// </summary>
public sealed class PlanningsroosterEndpointTests : IClassFixture<PlanningsroosterEndpointTests.Factory>
{
    private readonly Factory _factory;

    public PlanningsroosterEndpointTests(Factory factory) => _factory = factory;

    /// <summary>The frame: the year's span and the four vakanties, chronological, without the free day.</summary>
    [Fact]
    public async Task Het_rooster_levert_het_schooljaar_en_de_vakanties_als_gaten()
    {
        var client = _factory.CreateClient();
        var schooljaarId = await _factory.SeedAsync();

        var rooster = await client.GetFromJsonAsync<RoosterDto>($"/api/schooljaren/{schooljaarId}/rooster");

        Assert.NotNull(rooster);
        Assert.Equal(schooljaarId, rooster!.SchooljaarId);
        Assert.Equal(new DateOnly(2026, 9, 1), rooster.Start);
        Assert.Equal(new DateOnly(2027, 6, 30), rooster.Eind);

        Assert.Equal(
            ["Herfstvakantie", "Kerstvakantie", "Krokusvakantie", "Paasvakantie"],
            rooster.Onderbrekingen.Select(o => o.Naam));
        Assert.DoesNotContain(rooster.Onderbrekingen, o => o.Naam == "Pinkstermaandag");
    }

    /// <summary>The periods are gone from the frame: the read carries no blocks and no tier.</summary>
    [Fact]
    public async Task Het_rooster_kent_geen_periodes_meer()
    {
        var client = _factory.CreateClient();
        var schooljaarId = await _factory.SeedAsync();

        var response = await client.GetAsync($"/api/schooljaren/{schooljaarId}/rooster");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("blokken", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("niveau", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Een_onbekend_schooljaar_geeft_404()
    {
        var client = _factory.CreateClient();

        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/schooljaren/{Guid.NewGuid()}/rooster")).StatusCode);
    }

    private sealed record RoosterDto(
        Guid SchooljaarId,
        string SchooljaarNaam,
        DateOnly Start,
        DateOnly Eind,
        List<OnderbrekingDto> Onderbrekingen);

    private sealed record OnderbrekingDto(string Naam, DateOnly Start, DateOnly Eind);

    /// <summary>In-memory host: real controller, no Postgres and no AI.</summary>
    public sealed class Factory : JaarplannerApiFactory
    {
        private readonly string _dbNaam = $"e3_06_rooster_{Guid.NewGuid():N}";
        private Guid? _schooljaarId;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
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

        /// <summary>
        /// Seeds the realistic 2026-2027 year (four vakanties) plus Pinkstermaandag as a <c>VrijeDag</c>, which is
        /// the case that distinguishes a gap from a day off inside a week. Seeded once per fixture.
        /// </summary>
        public async Task<Guid> SeedAsync()
        {
            if (_schooljaarId is { } bestaand)
            {
                return bestaand;
            }

            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.EnsureCreatedAsync();

            var schooljaar = TestSchooljaar.MetVakanties(TestSchooljaar.UniekeNaam("rooster"));
            schooljaar.VoegSluitingToe(new Schoolsluiting(
                "Pinkstermaandag", new DateOnly(2027, 5, 17), new DateOnly(2027, 5, 17), Sluitingssoort.VrijeDag));

            db.Schooljaren.Add(schooljaar);
            await db.SaveChangesAsync();

            _schooljaarId = schooljaar.Id;

            return schooljaar.Id;
        }
    }
}
