using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The right Leerlingzorg over the real API and PostgreSQL (FB-008, ADR-0035 R18, §3.3, §3.4; Art. VI.1, VI.7): a
/// gebruiker directie gave it reads the children and reports of every K3 klas, also of an earlier schooljaar, writes
/// nothing, and reads no klas's planning; themabeheer reads no report; and taking the right away closes the reports on
/// the next request. <b>Every name here is made up</b> (Art. VI.7: no real child's name in the repo).
/// </summary>
public sealed class LeerlingzorgEndpointsTests : IAsyncLifetime
{
    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;
    private RechtenTestOpzet _opzet = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("leerlingzorg");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        _opzet = new RechtenTestOpzet(_db, _factory);
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

    [PostgresFact]
    public async Task Leerlingzorg_leest_de_kinderen_en_rapporten_van_elke_K3_klas_ook_van_een_vorig_schooljaar()
    {
        var school = await _opzet.SchoolAsync();
        var vorig = await _opzet.VorigSchooljaarAsync();
        using var directie = _opzet.Directie();
        var fien = await KindAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        var staf = await KindAsync(directie, school.K3Groen, "Staf", "Voorbeeld");
        var roos = await KindAsync(directie, vorig.K3, "Roos", "Proefmans");
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            directie.PutAsJsonAsync($"{Rapport(fien, 1)}/besluit", new { tekst = "Een fijne eerste periode." })));

        using var zorg = _opzet.Als(await _opzet.GebruikerAsync(leerlingzorg: true));

        Assert.Equal(["Fien"], await VoornamenAsync(zorg, school.K3Blauw));
        Assert.Equal(["Staf"], await VoornamenAsync(zorg, school.K3Groen));
        Assert.Equal(["Roos"], await VoornamenAsync(zorg, vorig.K3));

        using (var rapport = await zorg.GetAsync(Rapport(fien, 1)))
        {
            Assert.Equal(HttpStatusCode.OK, rapport.StatusCode);
            using var json = JsonDocument.Parse(await rapport.Content.ReadAsStringAsync());
            Assert.Equal("Een fijne eerste periode.", json.RootElement.GetProperty("besluit").GetString());
        }

        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(zorg.GetAsync(Rapport(staf, 2))));
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(zorg.GetAsync(Rapport(roos, 3))));

        // The report's own klas choice holds every K3 klas, of both years, and no other klas.
        var rapportklassen = await RapportklasIdsAsync(zorg);
        Assert.Contains(school.K3Blauw, rapportklassen);
        Assert.Contains(school.K3Groen, rapportklassen);
        Assert.Contains(vorig.K3, rapportklassen);
        Assert.DoesNotContain(school.K2Rood, rapportklassen);
        Assert.DoesNotContain(vorig.K2, rapportklassen);

        // R18 "niets anders": no klas's planning, so the planning's klassen list offers nothing.
        Assert.Empty(await RechtenTestOpzet.KlasIdsAsync(zorg));

        using var ik = JsonDocument.Parse(await zorg.GetStringAsync("/api/ik"));
        Assert.True(ik.RootElement.GetProperty("heeftLeerlingzorg").GetBoolean());
    }

    [PostgresFact]
    public async Task Leerlingzorg_wijzigt_niets_ook_niet_via_het_adres()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await KindAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        var rapportenVooraf = await AantalRapportenAsync();

        using var zorg = _opzet.Als(await _opzet.GebruikerAsync(leerlingzorg: true));

        await Verwacht403Async(zorg.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/leerlingen", new { voornaam = "Staf", achternaam = "Voorbeeld" }));
        await Verwacht403Async(zorg.PutAsJsonAsync($"/api/leerlingen/{fien}", new { voornaam = "Fiene", achternaam = "Proefmans" }));
        await Verwacht403Async(zorg.DeleteAsync($"/api/leerlingen/{fien}"));
        await Verwacht403Async(zorg.PutAsJsonAsync($"{Rapport(fien, 1)}/besluit", new { tekst = "Andermans besluit." }));
        await Verwacht403Async(zorg.PutAsJsonAsync(
            $"{Rapport(fien, 1)}/rapportdoelen/{Guid.NewGuid()}", new { gradatieId = (Guid?)null, tekst = "Andermans tekst." }));
        await Verwacht403Async(zorg.PostAsJsonAsync("/api/rapportdoelen", new { titel = "Luisteren", subdoelIds = Array.Empty<Guid>() }));

        await using var context = _db.MaakContext();
        var bewaard = await context.Leerlingen.SingleAsync(l => l.Id == fien);
        Assert.Equal(("Fien", "Proefmans"), (bewaard.Voornaam, bewaard.Achternaam));
        Assert.Equal(rapportenVooraf, await AantalRapportenAsync());
    }

    [PostgresFact]
    public async Task Themabeheer_leest_geen_enkel_rapport_en_krijgt_geen_rapportklas_R18()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await KindAsync(directie, school.K3Blauw, "Fien", "Proefmans");

        using var tb = _opzet.Als(await _opzet.GebruikerAsync(themabeheer: true));

        await Verwacht403Async(tb.GetAsync($"/api/klassen/{school.K3Blauw}/leerlingen"));
        await Verwacht403Async(tb.GetAsync(Rapport(fien, 1)));
        Assert.DoesNotContain(school.K3Blauw, await RapportklasIdsAsync(tb));
        // It still reads the klas's planning (ADR-0040 Z3): that is not the report.
        Assert.Contains(school.K3Blauw, await RechtenTestOpzet.KlasIdsAsync(tb));
    }

    [PostgresFact]
    public async Task Een_hoofdleerkracht_van_K3_zonder_klas_krijgt_geen_rapportklas_R17()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await KindAsync(directie, school.K3Blauw, "Fien", "Proefmans");

        using var hl = _opzet.Als(await _opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));

        // The report's own list is empty for them, though the planning's list holds every K3 klas (ADR-0040 Z2).
        Assert.Empty(await RapportklasIdsAsync(hl));
        Assert.Contains(school.K3Blauw, await RechtenTestOpzet.KlasIdsAsync(hl));
        await Verwacht403Async(hl.GetAsync(Rapport(fien, 1)));
    }

    [PostgresFact]
    public async Task Na_het_afnemen_van_leerlingzorg_weigert_de_app_de_rapporten_bij_het_volgende_verzoek()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await KindAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        var zorgId = await _opzet.GebruikerAsync(leerlingzorg: true);
        using var zorg = _opzet.Als(zorgId);
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(zorg.GetAsync(Rapport(fien, 1))));

        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync($"/api/gebruikers/{zorgId}/leerlingzorg")));

        await Verwacht403Async(zorg.GetAsync(Rapport(fien, 1)));
        await Verwacht403Async(zorg.GetAsync($"/api/klassen/{school.K3Blauw}/leerlingen"));
        Assert.Empty(await RapportklasIdsAsync(zorg));
        using var ik = JsonDocument.Parse(await zorg.GetStringAsync("/api/ik"));
        Assert.False(ik.RootElement.GetProperty("heeftLeerlingzorg").GetBoolean());
    }

    [PostgresFact]
    public async Task Een_leerkracht_met_leerlingzorg_vult_de_eigen_klas_in_en_leest_een_andere_zonder_te_wijzigen()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await KindAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        var staf = await KindAsync(directie, school.K3Groen, "Staf", "Voorbeeld");

        using var lk = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw], leerlingzorg: true));

        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            lk.PutAsJsonAsync($"{Rapport(fien, 1)}/besluit", new { tekst = "Een fijne periode." })));
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(lk.GetAsync(Rapport(staf, 1))));
        await Verwacht403Async(lk.PutAsJsonAsync($"{Rapport(staf, 1)}/besluit", new { tekst = "Andermans besluit." }));
        await Verwacht403Async(lk.PostAsJsonAsync($"/api/klassen/{school.K3Groen}/leerlingen", new { voornaam = "Roos", achternaam = "Voorbeeld" }));
    }

    private static string Rapport(Guid leerlingId, int moment) => $"/api/leerlingen/{leerlingId}/rapporten/{moment}";

    private static Task<Guid> KindAsync(HttpClient client, Guid klasId, string voornaam, string achternaam) =>
        RechtenTestOpzet.IdAsync(
            client.PostAsJsonAsync($"/api/klassen/{klasId}/leerlingen", new { voornaam, achternaam }), HttpStatusCode.Created);

    private static async Task<List<string>> VoornamenAsync(HttpClient client, Guid klasId)
    {
        using var antwoord = await client.GetAsync($"/api/klassen/{klasId}/leerlingen");
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}");
        return (await antwoord.Content.ReadFromJsonAsync<List<LeerlingDto>>())!.Select(l => l.Voornaam).ToList();
    }

    private static async Task<List<Guid>> RapportklasIdsAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<RechtenTestOpzet.IdDto>>("/api/rapportklassen"))!.Select(k => k.Id).ToList();

    private async Task<int> AantalRapportenAsync()
    {
        await using var context = _db.MaakContext();
        return await context.Ontwikkelingsrapporten.CountAsync();
    }

    private static Task Verwacht403Async(Task<HttpResponseMessage> verzoek) =>
        RechtenTestOpzet.VerwachtAsync(verzoek, HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);

    private sealed record LeerlingDto(Guid Id, Guid KlasId, string Voornaam, string Achternaam);
}
