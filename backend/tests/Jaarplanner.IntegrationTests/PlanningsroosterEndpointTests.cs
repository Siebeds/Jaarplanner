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
/// Reachability + correctness for <c>GET /api/schooljaren/{id}/rooster</c> (E3-06) — the derived planning grid the
/// kalender renders its ribbon from.
/// <para>
/// The endpoint exists because a calendar built from placements alone cannot show an <b>empty</b> period. These
/// tests therefore assert the properties the ribbon actually depends on: blocks in order, vacations reported as the
/// gaps between them, a <c>VrijeDag</c> deliberately <i>not</i> a gap, and teaching days discounted inside a block.
/// Getting any of those wrong makes the picture lie about the school year, which is the one thing the approved
/// wireframe is built to avoid.
/// </para>
/// </summary>
public sealed class PlanningsroosterEndpointTests : IClassFixture<PlanningsroosterEndpointTests.Factory>
{
    private readonly Factory _factory;

    public PlanningsroosterEndpointTests(Factory factory) => _factory = factory;

    /// <summary>
    /// The ribbon's shape: consecutive 1-based blocks, chronological, none of them straddling a vakantie, and the
    /// four vakanties reported as the gaps. This is FR-6.1's "renders per block" reduced to what can be asserted.
    /// </summary>
    [Fact]
    public async Task Het_rooster_levert_de_blokken_en_de_vakanties_als_gaten()
    {
        var client = _factory.CreateClient();
        var schooljaarId = await _factory.SeedAsync();

        var rooster = await client.GetFromJsonAsync<RoosterDto>($"/api/schooljaren/{schooljaarId}/rooster");

        Assert.NotNull(rooster);
        Assert.Equal("Themaperiode", rooster!.Niveau);
        Assert.NotEmpty(rooster.Blokken);
        Assert.False(string.IsNullOrWhiteSpace(rooster.Blokindeling));

        // Ordinals are 1..n in order, and the blocks march forward in time without overlapping.
        Assert.Equal(
            Enumerable.Range(1, rooster.Blokken.Count),
            rooster.Blokken.Select(b => b.Ordinaal));
        foreach (var (vorige, volgende) in rooster.Blokken.Zip(rooster.Blokken.Skip(1)))
        {
            Assert.True(vorige.Eind < volgende.Start, $"blok {vorige.Ordinaal} overlapt blok {volgende.Ordinaal}");
        }

        // A themaperiode has no parent; that is the subthemaperiode's job.
        Assert.All(rooster.Blokken, b => Assert.Null(b.OuderOrdinaal));

        // The four vakanties are the gaps — and the VrijeDag is NOT among them (ADR-0020 §5): drawing a single
        // free day as a break in the ribbon is exactly the sliver problem the Vakantie/VrijeDag split removed.
        Assert.Equal(4, rooster.Onderbrekingen.Count);
        Assert.Contains(rooster.Onderbrekingen, o => o.Naam == "Herfstvakantie");
        Assert.DoesNotContain(rooster.Onderbrekingen, o => o.Naam == "Pinkstermaandag");

        // No block may span a vakantie — the property the whole "vacations are literal gaps" design rests on.
        foreach (var blok in rooster.Blokken)
        {
            Assert.DoesNotContain(
                rooster.Onderbrekingen,
                o => o.Start <= blok.Eind && blok.Start <= o.Eind);
        }
    }

    /// <summary>
    /// A <c>VrijeDag</c> does not break a block, but it must not be counted as teaching time either — otherwise a
    /// period containing Hemelvaart renders exactly as wide as an unbroken one and the ribbon overstates how much
    /// teaching fits in it.
    /// </summary>
    [Fact]
    public async Task Een_vrije_dag_binnen_een_blok_telt_niet_als_lesdag()
    {
        var client = _factory.CreateClient();
        var schooljaarId = await _factory.SeedAsync();

        var rooster = await client.GetFromJsonAsync<RoosterDto>($"/api/schooljaren/{schooljaarId}/rooster");

        var pinkstermaandag = new DateOnly(2027, 5, 17);
        var blok = Assert.Single(rooster!.Blokken, b => b.Start <= pinkstermaandag && pinkstermaandag <= b.Eind);

        var kalenderdagen = blok.Eind.DayNumber - blok.Start.DayNumber + 1;
        Assert.Equal(kalenderdagen - 1, blok.AantalOpenDagen);
    }

    /// <summary>
    /// The finer tier nests inside the coarse one (E3-08's zoom): every subthemaperiode names the themaperiode it
    /// sits in, and never straddles a boundary.
    /// </summary>
    [Fact]
    public async Task Het_subthemaperiode_niveau_nest_binnen_de_themaperiodes()
    {
        var client = _factory.CreateClient();
        var schooljaarId = await _factory.SeedAsync();

        var grof = await client.GetFromJsonAsync<RoosterDto>($"/api/schooljaren/{schooljaarId}/rooster");
        var fijn = await client.GetFromJsonAsync<RoosterDto>(
            $"/api/schooljaren/{schooljaarId}/rooster?niveau=Subthemaperiode");

        Assert.Equal("Subthemaperiode", fijn!.Niveau);
        Assert.True(fijn.Blokken.Count > grof!.Blokken.Count, "de fijne indeling moet meer blokken opleveren");
        Assert.All(fijn.Blokken, b => Assert.NotNull(b.OuderOrdinaal));

        // Each subthemaperiode lies entirely within the themaperiode whose ordinal it claims as parent.
        foreach (var sub in fijn.Blokken)
        {
            var ouder = Assert.Single(grof.Blokken, b => b.Ordinaal == sub.OuderOrdinaal);
            Assert.True(
                sub.Start >= ouder.Start && sub.Eind <= ouder.Eind,
                $"subblok {sub.Start}–{sub.Eind} valt buiten periode {ouder.Ordinaal}");
        }
    }

    /// <summary>
    /// Regression (E3-02 code review): ASP.NET Core binds any integer to an enum parameter, so
    /// <c>?niveau=99</c> passed model validation, reached the indeling seam and threw an unmapped
    /// <c>ArgumentOutOfRangeException</c> — a 500 on a public GET for a plainly bad request. The named form
    /// (<c>?niveau=Maand</c>) always 400'd correctly; only the numeric form slipped through, which is why it is
    /// the one asserted here.
    /// </summary>
    [Fact]
    public async Task Een_ongeldig_niveau_geeft_400_en_geen_500()
    {
        var client = _factory.CreateClient();
        var schooljaarId = await _factory.SeedAsync();

        var numeriek = await client.GetAsync($"/api/schooljaren/{schooljaarId}/rooster?niveau=99");
        Assert.Equal(HttpStatusCode.BadRequest, numeriek.StatusCode);

        var benoemd = await client.GetAsync($"/api/schooljaren/{schooljaarId}/rooster?niveau=Maand");
        Assert.Equal(HttpStatusCode.BadRequest, benoemd.StatusCode);
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
        string Niveau,
        string Blokindeling,
        List<BlokDto> Blokken,
        List<OnderbrekingDto> Onderbrekingen);

    private sealed record BlokDto(int Ordinaal, DateOnly Start, DateOnly Eind, int? OuderOrdinaal, int AantalOpenDagen);

    private sealed record OnderbrekingDto(string Naam, DateOnly Start, DateOnly Eind);

    /// <summary>In-memory host: real controller, real configured indeling seam, no Postgres and no AI.</summary>
    public sealed class Factory : WebApplicationFactory<Program>
    {
        private readonly string _dbNaam = $"e3_06_rooster_{Guid.NewGuid():N}";
        private Guid? _schooljaarId;

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

        /// <summary>
        /// Seeds the realistic 2026-2027 year (four vakanties) plus Pinkstermaandag as a <c>VrijeDag</c>, which is
        /// the case that distinguishes a gap from a day off inside a block. Seeded once per fixture.
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
