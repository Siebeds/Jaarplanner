using System.Net;
using System.Net.Http.Json;
using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Curriculum;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The cat's read port against real PostgreSQL (FB-069), pinned to the dekking's own read.
/// <para>
/// <b>Why pinned rather than shared.</b> <see cref="IKatplanbron"/> asks two questions <c>EfDekkingOpslag</c> also
/// asks, on purpose: the dekking's port serves the highest-risk logic in the system (Art. V.6) and nothing the cat
/// needs should widen it. A duplicate that nobody compares is a duplicate that drifts, and a cat that counted
/// differently from the dekkingsoverzicht beside it would be worse than no cat. So this test asks both and demands
/// the same answer.
/// </para>
/// </summary>
public sealed class KatplanbronPostgresTests : IAsyncLifetime
{
    private const string ViaSubdoel = "KPB-K3-01";
    private const string ViaActiviteit = "KPB-K3-02";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("katplanbron");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        await using var context = _db.MaakContext();
        context.Leerplandoelen.AddRange(
            new Leerplandoel(ViaSubdoel, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Water", "9.1", tekst: "Onderzoekt wat drijft."),
            new Leerplandoel(ViaActiviteit, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Water", "9.1", tekst: "Beschrijft hoe water beweegt."));
        await context.SaveChangesAsync();
    }

    public async Task DisposeAsync()
    {
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }

        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    private RechtenTestOpzet Opzet => new(_db, _factory);

    [PostgresFact]
    public async Task Een_subthema_dekt_zowel_via_zijn_subdoelen_als_via_zijn_gedeelde_activiteiten()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3");

        using (var admin = Opzet.Admin())
        {
            // One goal through a subdoel of the subthema.
            Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
                admin.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = ViaSubdoel })));
        }

        // The other through a shared activiteit under it: Art. V.1 counts that route too.
        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        await Opzet.KoppelAsync(activiteit.Id, ViaActiviteit);

        using var scope = _factory.Services.CreateScope();
        var bron = scope.ServiceProvider.GetRequiredService<IKatplanbron>();

        var subthema = Assert.Single(
            await bron.HaalSubthemasAsync(school.K3Blauw, CancellationToken.None),
            s => s.SubthemaId == subthemaId);

        Assert.Contains(ViaSubdoel, subthema.Leerplandoelcodes);
        Assert.Contains(ViaActiviteit, subthema.Leerplandoelcodes);
    }

    [PostgresFact]
    public async Task De_kat_leest_dezelfde_doelen_per_subthema_als_de_dekking()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3");

        using (var admin = Opzet.Admin())
        {
            Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
                admin.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = ViaSubdoel })));
        }

        var activiteit = await Opzet.ActiviteitAsync(subthemaId);
        await Opzet.KoppelAsync(activiteit.Id, ViaActiviteit);

        using var scope = _factory.Services.CreateScope();
        var bron = scope.ServiceProvider.GetRequiredService<IKatplanbron>();
        var dekkingsopslag = scope.ServiceProvider.GetRequiredService<IDekkingOpslag>();

        var vanDeKat = (await bron.HaalSubthemasAsync(school.K3Blauw, CancellationToken.None))
            .Where(s => s.SubthemaId == subthemaId)
            .SelectMany(s => s.Leerplandoelcodes)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();

        var vanDeDekking = (await dekkingsopslag.HaalSubthemakoppelingenAsync(school.K3Blauw))
            .Select(k => k.LeerplandoelCode)
            .Distinct(StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();

        Assert.Equal(vanDeDekking, vanDeKat);
    }

    [PostgresFact]
    public async Task Een_subthema_dat_de_klas_niet_geplaatst_heeft_is_niet_gepland()
    {
        var school = await Opzet.SchoolAsync();
        var subthemaId = await Opzet.SubthemaAsync("K3");

        using var scope = _factory.Services.CreateScope();
        var bron = scope.ServiceProvider.GetRequiredService<IKatplanbron>();

        var subthema = Assert.Single(
            await bron.HaalSubthemasAsync(school.K3Blauw, CancellationToken.None),
            s => s.SubthemaId == subthemaId);

        Assert.False(subthema.IsGepland);
    }

    [PostgresFact]
    public async Task Het_schooljaar_van_de_klas_komt_met_zijn_sluitingen_mee()
    {
        var school = await Opzet.SchoolAsync();

        using var scope = _factory.Services.CreateScope();
        var bron = scope.ServiceProvider.GetRequiredService<IKatplanbron>();

        var schooljaar = await bron.HaalSchooljaarAsync(school.K3Blauw, CancellationToken.None);

        // Without the closures the calendar would put the next schooldag inside a vacation.
        Assert.NotNull(schooljaar);
        Assert.NotNull(schooljaar.Vakanties);
    }
}
