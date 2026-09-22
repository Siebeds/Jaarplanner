using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Kat;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The cat's deurmat over HTTP against PostgreSQL (TB-057, ADR-0059 D2, D3, D5): who is shown what, that a signal is
/// re-derived before it is shown, and that a signal of someone else's does not exist for you.
/// <para>
/// The detector here is the test's own: the app ships none until FB-069 and FB-070. It sees no AI client, as a real
/// one will not (K1).
/// </para>
/// </summary>
public sealed class DeurmatEndpointsTests : IAsyncLifetime
{
    private static readonly DateOnly Vandaag = new(2026, 9, 22);

    /// <summary>The API writes enums as text (Program.cs registers the converter), so the reader must too.</summary>
    private static readonly JsonSerializerOptions Json =
        new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;
    private readonly StuurbareDetector _detector = new();

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("deurmat");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        _factory.Detectoren.Add(_detector);
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

    /// <summary>Runs one round in the host's own container, as the background job would.</summary>
    private async Task<Rondeverslag> TikAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var ronde = scope.ServiceProvider.GetRequiredService<Signaalronde>();
        return await ronde.VoerUitAsync(Vandaag, CancellationToken.None);
    }

    [PostgresFact]
    public async Task De_leerkracht_van_de_klas_krijgt_het_signaal_dat_de_tik_schreef()
    {
        var school = await Opzet.SchoolAsync();
        var juf = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        _detector.Zet(klas => [Vondst(klas, "MD-01")]);

        var verslag = await TikAsync();
        Assert.True(verslag.Nieuw >= 1);

        using var client = Opzet.Als(juf);
        var deurmat = await client.GetFromJsonAsync<Deurmat>("/api/deurmat", Json);

        var signaal = Assert.Single(deurmat!.Signalen, s => s.KlasId == school.K3Blauw);
        Assert.Equal(Signaalsoort.MinimumdoelInGevaar, signaal.Soort);
        Assert.Equal("Doel MD-01 komt in gevaar.", signaal.Titel);
        Assert.False(signaal.Gezien);
    }

    [PostgresFact]
    public async Task Een_leerkracht_van_een_andere_klas_krijgt_het_signaal_niet()
    {
        var school = await Opzet.SchoolAsync();
        await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        var andere = await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]);
        _detector.Zet(klas => klas == school.K3Blauw ? [Vondst(klas, "MD-01")] : []);
        await TikAsync();

        using var client = Opzet.Als(andere);
        var deurmat = await client.GetFromJsonAsync<Deurmat>("/api/deurmat", Json);

        Assert.Empty(deurmat!.Signalen);
    }

    [PostgresFact]
    public async Task Een_signaal_waarvan_de_reden_weg_is_wordt_niet_meer_getoond()
    {
        var school = await Opzet.SchoolAsync();
        var juf = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        _detector.Zet(klas => [Vondst(klas, "MD-01")]);
        await TikAsync();

        // The reason is gone before the next tick gets round to removing the row: the read must not show it anyway
        // (D2), because the cat may not assert a state the computation no longer supports.
        _detector.Zet(_ => []);

        using var client = Opzet.Als(juf);
        var deurmat = await client.GetFromJsonAsync<Deurmat>("/api/deurmat", Json);

        Assert.Empty(deurmat!.Signalen);

        await using var context = _db.MaakContext();
        Assert.True(await context.Signalen.AnyAsync(), "The row is still there; only the next tick removes it.");
    }

    [PostgresFact]
    public async Task Gezien_zetten_lukt_alleen_op_een_eigen_signaal()
    {
        var school = await Opzet.SchoolAsync();
        var juf = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        var andere = await Opzet.GebruikerAsync(school, klassen: [school.K2Rood]);
        _detector.Zet(klas => klas == school.K3Blauw ? [Vondst(klas, "MD-01")] : []);
        await TikAsync();

        await using var context = _db.MaakContext();
        var signaalId = (await context.Signalen.SingleAsync()).Id;

        using var vreemde = Opzet.Als(andere);
        Assert.Equal(
            HttpStatusCode.NotFound,
            await RechtenTestOpzet.StatusAsync(vreemde.PostAsync($"/api/deurmat/signalen/{signaalId}/gezien", content: null)));

        using var eigenaar = Opzet.Als(juf);
        Assert.Equal(
            HttpStatusCode.NoContent,
            await RechtenTestOpzet.StatusAsync(eigenaar.PostAsync($"/api/deurmat/signalen/{signaalId}/gezien", content: null)));

        var deurmat = await eigenaar.GetFromJsonAsync<Deurmat>("/api/deurmat", Json);
        Assert.True(Assert.Single(deurmat!.Signalen).Gezien);
    }

    [PostgresFact]
    public async Task Later_haalt_het_signaal_van_de_deurmat_tot_de_volgende_schooldag()
    {
        var school = await Opzet.SchoolAsync();
        var juf = await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        _detector.Zet(klas => [Vondst(klas, "MD-01")]);
        await TikAsync();

        await using var context = _db.MaakContext();
        var signaalId = (await context.Signalen.SingleAsync()).Id;

        using var client = Opzet.Als(juf);
        Assert.Equal(
            HttpStatusCode.NoContent,
            await RechtenTestOpzet.StatusAsync(client.PostAsync($"/api/deurmat/signalen/{signaalId}/later", content: null)));

        var deurmat = await client.GetFromJsonAsync<Deurmat>("/api/deurmat", Json);
        Assert.Empty(deurmat!.Signalen);

        // Put away, not thrown away: the row keeps the day it comes back on.
        await using var nalezen = _db.MaakContext();
        Assert.NotNull((await nalezen.Signalen.SingleAsync()).UitgesteldTot);
    }

    [PostgresFact]
    public async Task Een_gebruiker_zonder_enig_recht_krijgt_een_lege_deurmat()
    {
        var school = await Opzet.SchoolAsync();
        var niemand = await Opzet.GebruikerAsync(school);
        _detector.Zet(klas => [Vondst(klas, "MD-01")]);
        await TikAsync();

        using var client = Opzet.Als(niemand);
        var deurmat = await client.GetFromJsonAsync<Deurmat>("/api/deurmat", Json);

        Assert.Empty(deurmat!.Signalen);
        Assert.Empty(deurmat.Voorstellen);
    }

    [PostgresFact]
    public async Task Een_tik_over_een_ongewijzigde_toestand_schrijft_niets_bij()
    {
        var school = await Opzet.SchoolAsync();
        await Opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        _detector.Zet(klas => [Vondst(klas, "MD-01")]);

        await TikAsync();
        var tweede = await TikAsync();

        Assert.Equal(0, tweede.Nieuw);
        Assert.Equal(0, tweede.Verdwenen);

        await using var context = _db.MaakContext();
        Assert.Equal(1, await context.Signalen.CountAsync());
    }

    private static Signaalvondst Vondst(Guid klasId, string sleutel) =>
        new(Signaalsoort.MinimumdoelInGevaar, klasId, sleutel, [], $"Doel {sleutel} komt in gevaar.", $"/klassen/{klasId}/agenda");

    /// <summary>
    /// A detector the test steers. It addresses every leerkracht of the klas, which is what a real one does when the
    /// finding concerns the klas as a whole (ADR-0059 D5).
    /// </summary>
    private sealed class StuurbareDetector : ISignaaldetector
    {
        private Func<Guid, IReadOnlyList<Signaalvondst>> _vondsten = _ => [];

        public void Zet(Func<Guid, IReadOnlyList<Signaalvondst>> vondsten) => _vondsten = vondsten;

        public Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<Signaalvondst>>(
                _vondsten(context.KlasId).Select(v => v with { OntvangerIds = context.OntvangerIds }).ToList());
    }
}
