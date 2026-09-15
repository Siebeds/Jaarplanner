using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Toegang;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The children of a K3 klas over the real API and PostgreSQL (FB-001, FR-13.1, Art. VI.7, ADR-0030 §3 footnote ⁶,
/// ADR-0035 §3.3, §3.9): the klas's own K3 leerkracht adds, renames and deletes them during the schooljaar and only reads
/// them afterwards; directie always; nobody else, not even to read (R17); only a K3 klas has children (D9); and a klas
/// with children is neither deleted nor made non-K3. On Postgres because the Restrict FK and the rights read from the
/// database are what is under test. <b>Every name here is made up</b> (Art. VI.7: no real child's name in the repo).
/// </summary>
public sealed class LeerlingEndpointsTests : IAsyncLifetime
{
    private const string GeenK3 = "Alleen een klas van de derde kleuter kan kinderen hebben.";
    private const string KindWeg = "Dit kind bestaat niet meer. Iemand anders heeft het verwijderd.";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;
    private RechtenTestOpzet _opzet = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("leerlingen");
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

    private static DateOnly Vandaag => DateOnly.FromDateTime(DateTime.UtcNow);

    // --- The klas's own K3 leerkracht, during the schooljaar (R14, R15, R16, D8). ---

    [PostgresFact]
    public async Task De_leerkracht_van_de_K3_klas_voegt_haar_kinderen_toe_hernoemt_en_verwijdert_ze()
    {
        var school = await _opzet.SchoolAsync();
        using var lk = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var route = $"/api/klassen/{school.K3Blauw}/leerlingen";

        Assert.Empty(await LijstAsync(lk, school.K3Blauw));

        // The shape the frontend reads, exactly: the two names, the klas and the id, nothing else about the child.
        using (var antwoord = await lk.PostAsJsonAsync(route, new { voornaam = " Staf ", achternaam = "Voorbeeld" }))
        {
            Assert.Equal(HttpStatusCode.Created, antwoord.StatusCode);
            using var json = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());
            Assert.Equal(
                ["achternaam", "id", "klasId", "voornaam"],
                json.RootElement.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
            Assert.Equal("Staf", json.RootElement.GetProperty("voornaam").GetString());
        }

        var fien = await MaakAsync(lk, school.K3Blauw, "Fien", "Proefmans");
        Assert.Equal(school.K3Blauw, fien.KlasId);

        // By voornaam: Fien before Staf, though Staf came first.
        var lijst = await LijstAsync(lk, school.K3Blauw);
        Assert.Equal(["Fien Proefmans", "Staf Voorbeeld"], lijst.Select(l => $"{l.Voornaam} {l.Achternaam}"));

        var staf = lijst[1];
        using (var hernoem = await lk.PutAsJsonAsync($"/api/leerlingen/{staf.Id}", new { voornaam = "Stef", achternaam = "Voorbeeld" }))
        {
            Assert.Equal(HttpStatusCode.OK, hernoem.StatusCode);
            Assert.Equal("Stef", (await hernoem.Content.ReadFromJsonAsync<LeerlingDto>())!.Voornaam);
        }

        // Kept after a reload: a fresh read of the list.
        Assert.Equal(["Fien Proefmans", "Stef Voorbeeld"], (await LijstAsync(lk, school.K3Blauw)).Select(l => $"{l.Voornaam} {l.Achternaam}"));

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync($"/api/leerlingen/{staf.Id}")));
        Assert.Equal([fien.Id], (await LijstAsync(lk, school.K3Blauw)).Select(l => l.Id));

        await using var context = _db.MaakContext();
        Assert.Equal(1, await context.Leerlingen.CountAsync(l => l.KlasId == school.K3Blauw));
    }

    // --- Nobody else reads or writes (R17). ---

    [PostgresFact]
    public async Task Een_leerkracht_van_een_andere_K3_klas_krijgt_403_op_elke_route_en_verandert_niets()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await MaakAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        using var groen = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Groen]));

        await Verwacht403Async(groen.GetAsync($"/api/klassen/{school.K3Blauw}/leerlingen"));
        await Verwacht403Async(groen.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/leerlingen", new { voornaam = "Staf", achternaam = "Voorbeeld" }));
        await Verwacht403Async(groen.PutAsJsonAsync($"/api/leerlingen/{fien.Id}", new { voornaam = "Stef", achternaam = "Voorbeeld" }));
        await Verwacht403Async(groen.DeleteAsync($"/api/leerlingen/{fien.Id}"));

        // Their own K3 klas is theirs, and holds nobody.
        Assert.Empty(await LijstAsync(groen, school.K3Groen));

        await using var context = _db.MaakContext();
        var bewaard = await context.Leerlingen.SingleAsync(l => l.KlasId == school.K3Blauw);
        Assert.Equal(("Fien", "Proefmans"), (bewaard.Voornaam, bewaard.Achternaam));
    }

    [PostgresFact]
    public async Task Een_leerkracht_van_een_K2_klas_ziet_geen_kinderen_ook_niet_in_de_eigen_klas()
    {
        var school = await _opzet.SchoolAsync();
        using var rood = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K2Rood]));

        await Verwacht403Async(rood.GetAsync($"/api/klassen/{school.K3Blauw}/leerlingen"));
        await Verwacht403Async(rood.GetAsync($"/api/klassen/{school.K2Rood}/leerlingen"));
        await Verwacht403Async(rood.PostAsJsonAsync($"/api/klassen/{school.K2Rood}/leerlingen", new { voornaam = "Fien", achternaam = "Proefmans" }));
    }

    [PostgresFact]
    public async Task Een_hoofdleerkracht_en_themabeheerder_van_K3_zonder_klastoewijzing_lezen_geen_kinderen()
    {
        var school = await _opzet.SchoolAsync();
        using var hlEnTb = _opzet.Als(await _opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3"]));

        await Verwacht403Async(hlEnTb.GetAsync($"/api/klassen/{school.K3Blauw}/leerlingen"));
        await Verwacht403Async(hlEnTb.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/leerlingen", new { voornaam = "Fien", achternaam = "Proefmans" }));
    }

    // --- Only a K3 klas has children (D9), directie included. ---

    [PostgresFact]
    public async Task Niemand_voegt_een_kind_toe_aan_een_klas_die_geen_K3_geeft_ook_de_directie_niet()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();

        await RechtenTestOpzet.VerwachtAsync(
            directie.PostAsJsonAsync($"/api/klassen/{school.K2Rood}/leerlingen", new { voornaam = "Fien", achternaam = "Proefmans" }),
            HttpStatusCode.BadRequest,
            GeenK3);

        Assert.Empty(await LijstAsync(directie, school.K2Rood));
    }

    // --- After the schooljaar: the leerkracht reads, directie still does everything (R26). ---

    [PostgresFact]
    public async Task Na_het_schooljaar_leest_de_leerkracht_de_kinderen_nog_maar_verandert_ze_niets_meer()
    {
        var voorbij = new Schooljaar(TestSchooljaar.UniekeNaam("voorbij"), Vandaag.AddDays(-400), Vandaag.AddDays(-35));
        var klas = voorbij.VoegKlasToe($"K3v-{Guid.NewGuid():N}", "K3");
        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(voorbij);
            await context.SaveChangesAsync();
        }

        using var directie = _opzet.Directie();
        var fien = await MaakAsync(directie, klas.Id, "Fien", "Proefmans");
        var lkId = await _opzet.GebruikerAsync(klassen: [klas.Id]);
        using var lk = _opzet.Als(lkId);

        Assert.Equal([fien.Id], (await LijstAsync(lk, klas.Id)).Select(l => l.Id));
        await Verwacht403Async(lk.PostAsJsonAsync($"/api/klassen/{klas.Id}/leerlingen", new { voornaam = "Staf", achternaam = "Voorbeeld" }));
        await Verwacht403Async(lk.PutAsJsonAsync($"/api/leerlingen/{fien.Id}", new { voornaam = "Fiene", achternaam = "Proefmans" }));
        await Verwacht403Async(lk.DeleteAsync($"/api/leerlingen/{fien.Id}"));

        // /api/ik says the same, so the screen can hide the buttons: a rapportklas to read, none to fill in.
        var ik = await IkAsync(lk);
        Assert.Equal([klas.Id], ik.RapportklasIds);
        Assert.Empty(ik.LopendeRapportklasIds);

        using (var hernoem = await directie.PutAsJsonAsync($"/api/leerlingen/{fien.Id}", new { voornaam = "Fiene", achternaam = "Proefmans" }))
        {
            Assert.Equal(HttpStatusCode.OK, hernoem.StatusCode);
        }

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync($"/api/leerlingen/{fien.Id}")));
        Assert.Empty(await LijstAsync(lk, klas.Id));
    }

    // --- Sessions, unknown ids and validation. ---

    [PostgresFact]
    public async Task Zonder_sessie_antwoordt_elke_leerlingroute_401()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await MaakAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        using var anoniem = _factory.CreateClient();
        anoniem.DefaultRequestHeaders.Add(TestAuthenticatie.AnoniemHeader, "1");

        Assert.Equal(HttpStatusCode.Unauthorized, await RechtenTestOpzet.StatusAsync(anoniem.GetAsync($"/api/klassen/{school.K3Blauw}/leerlingen")));
        Assert.Equal(HttpStatusCode.Unauthorized, await RechtenTestOpzet.StatusAsync(
            anoniem.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/leerlingen", new { voornaam = "Staf", achternaam = "Voorbeeld" })));
        Assert.Equal(HttpStatusCode.Unauthorized, await RechtenTestOpzet.StatusAsync(
            anoniem.PutAsJsonAsync($"/api/leerlingen/{fien.Id}", new { voornaam = "Stef", achternaam = "Voorbeeld" })));
        Assert.Equal(HttpStatusCode.Unauthorized, await RechtenTestOpzet.StatusAsync(anoniem.DeleteAsync($"/api/leerlingen/{fien.Id}")));
    }

    [PostgresFact]
    public async Task Een_onbekende_klas_of_een_verdwenen_kind_is_een_404_ook_voor_wie_er_geen_recht_op_zou_hebben()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        using var groen = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Groen]));
        var onbekend = Guid.NewGuid();

        await RechtenTestOpzet.VerwachtAsync(
            directie.GetAsync($"/api/klassen/{onbekend}/leerlingen"), HttpStatusCode.NotFound, $"Klas {onbekend} is niet gevonden.");
        await RechtenTestOpzet.VerwachtAsync(
            directie.PostAsJsonAsync($"/api/klassen/{onbekend}/leerlingen", new { voornaam = "Fien", achternaam = "Proefmans" }),
            HttpStatusCode.NotFound,
            $"Klas {onbekend} is niet gevonden.");
        await RechtenTestOpzet.VerwachtAsync(
            directie.PutAsJsonAsync($"/api/leerlingen/{onbekend}", new { voornaam = "Fien", achternaam = "Proefmans" }), HttpStatusCode.NotFound, KindWeg);
        await RechtenTestOpzet.VerwachtAsync(directie.DeleteAsync($"/api/leerlingen/{onbekend}"), HttpStatusCode.NotFound, KindWeg);

        // Lookup before authorisation, as for every resource row: an id that names nothing is a 404 for anyone.
        await RechtenTestOpzet.VerwachtAsync(groen.DeleteAsync($"/api/leerlingen/{onbekend}"), HttpStatusCode.NotFound, KindWeg);
    }

    [PostgresFact]
    public async Task Een_ontbrekende_of_te_lange_naam_wordt_in_het_Nederlands_geweigerd_zonder_de_naam_te_herhalen()
    {
        var school = await _opzet.SchoolAsync();
        using var lk = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var route = $"/api/klassen/{school.K3Blauw}/leerlingen";
        var teLang = "Proefmans" + new string('x', 92);

        await RechtenTestOpzet.VerwachtAsync(lk.PostAsJsonAsync(route, new { voornaam = "", achternaam = "Proefmans" }), HttpStatusCode.BadRequest, "Vul een voornaam in.");
        await RechtenTestOpzet.VerwachtAsync(lk.PostAsJsonAsync(route, new { achternaam = "Proefmans" }), HttpStatusCode.BadRequest, "Vul een voornaam in.");
        await RechtenTestOpzet.VerwachtAsync(lk.PostAsJsonAsync(route, new { voornaam = "Fien", achternaam = "   " }), HttpStatusCode.BadRequest, "Vul een achternaam in.");
        await RechtenTestOpzet.VerwachtAsync(
            lk.PostAsJsonAsync(route, new { voornaam = teLang, achternaam = "Proefmans" }), HttpStatusCode.BadRequest, "Een voornaam is hoogstens 100 tekens lang.");
        await RechtenTestOpzet.VerwachtAsync(
            lk.PostAsJsonAsync(route, new { voornaam = "Fien", achternaam = teLang }), HttpStatusCode.BadRequest, "Een achternaam is hoogstens 100 tekens lang.");

        // A hundred characters is allowed, and a refused rename leaves the name as it was.
        var fien = await MaakAsync(lk, school.K3Blauw, "Fien", new string('a', 100));
        await RechtenTestOpzet.VerwachtAsync(
            lk.PutAsJsonAsync($"/api/leerlingen/{fien.Id}", new { voornaam = " ", achternaam = "Proefmans" }), HttpStatusCode.BadRequest, "Vul een voornaam in.");

        var lijst = await LijstAsync(lk, school.K3Blauw);
        Assert.Equal("Fien", Assert.Single(lijst).Voornaam);
    }

    // --- The klas guards: a klas with children is not deleted, and stays K3 (D9). ---

    [PostgresFact]
    public async Task Een_klas_met_kinderen_wordt_pas_verwijderd_als_de_kinderen_weg_zijn()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await MaakAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        var naam = await KlasnaamAsync(school.K3Blauw);

        await RechtenTestOpzet.VerwachtAsync(
            directie.DeleteAsync($"/api/klassen/{school.K3Blauw}"),
            HttpStatusCode.BadRequest,
            $"Klas '{naam}' heeft nog 1 kind(eren) in het ontwikkelingsrapport en kan niet verwijderd worden. "
            + "Verwijder die kinderen eerst bij Ontwikkelingsrapport.");

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync($"/api/leerlingen/{fien.Id}")));
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync($"/api/klassen/{school.K3Blauw}")));
    }

    [PostgresFact]
    public async Task Een_klas_met_kinderen_blijft_een_klas_van_de_derde_kleuter()
    {
        var school = await _opzet.SchoolAsync();
        using var directie = _opzet.Directie();
        var fien = await MaakAsync(directie, school.K3Blauw, "Fien", "Proefmans");
        var naam = await KlasnaamAsync(school.K3Blauw);

        await RechtenTestOpzet.VerwachtAsync(
            directie.PutAsJsonAsync($"/api/klassen/{school.K3Blauw}", new { naam, jaarfase = "K2" }),
            HttpStatusCode.BadRequest,
            $"Klas '{naam}' heeft nog 1 kind(eren) in het ontwikkelingsrapport. Een klas met kinderen blijft een klas van "
            + "de derde kleuter. Verwijder die kinderen eerst bij Ontwikkelingsrapport.");

        // A rename that keeps it K3 goes through.
        var nieuweNaam = $"K3b2-{Guid.NewGuid():N}";
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            directie.PutAsJsonAsync($"/api/klassen/{school.K3Blauw}", new { naam = nieuweNaam, jaarfase = "K3" })));

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync($"/api/leerlingen/{fien.Id}")));
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            directie.PutAsJsonAsync($"/api/klassen/{school.K3Blauw}", new { naam = nieuweNaam, jaarfase = "K2" })));
    }

    // --- GET /api/ik carries the two lists the frontend hides the tab and the buttons with (D18). ---

    [PostgresFact]
    public async Task Ik_geeft_de_rapportklassen_van_de_leerkracht()
    {
        var school = await _opzet.SchoolAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw, school.K2Rood]));
        using var rood = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K2Rood]));
        using var directie = _opzet.Als(await _opzet.GebruikerAsync(directie: true));

        var ikBlauw = await IkAsync(blauw);
        Assert.Equal([school.K3Blauw], ikBlauw.RapportklasIds);
        Assert.Equal([school.K3Blauw], ikBlauw.LopendeRapportklasIds);

        var ikRood = await IkAsync(rood);
        Assert.Empty(ikRood.RapportklasIds);
        Assert.Empty(ikRood.LopendeRapportklasIds);

        // Directie sees the tab through IsDirectie, not through these lists.
        var ikDirectie = await IkAsync(directie);
        Assert.True(ikDirectie.IsDirectie);
        Assert.Empty(ikDirectie.RapportklasIds);
    }

    private static async Task<List<LeerlingDto>> LijstAsync(HttpClient client, Guid klasId)
    {
        using var antwoord = await client.GetAsync($"/api/klassen/{klasId}/leerlingen");
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<List<LeerlingDto>>())!;
    }

    private static async Task<LeerlingDto> MaakAsync(HttpClient client, Guid klasId, string voornaam, string achternaam)
    {
        using var antwoord = await client.PostAsJsonAsync($"/api/klassen/{klasId}/leerlingen", new { voornaam, achternaam });
        Assert.True(antwoord.StatusCode == HttpStatusCode.Created, $"Expected 201, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<LeerlingDto>())!;
    }

    private static async Task<IkDto> IkAsync(HttpClient client) => (await client.GetFromJsonAsync<IkDto>("/api/ik"))!;

    private static Task Verwacht403Async(Task<HttpResponseMessage> verzoek) =>
        RechtenTestOpzet.VerwachtAsync(verzoek, HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);

    private async Task<string> KlasnaamAsync(Guid klasId)
    {
        await using var context = _db.MaakContext();
        return (await context.Klassen.SingleAsync(k => k.Id == klasId)).Naam;
    }

    private sealed record LeerlingDto(Guid Id, Guid KlasId, string Voornaam, string Achternaam);

    private sealed record IkDto(bool IsDirectie, List<Guid> RapportklasIds, List<Guid> LopendeRapportklasIds);
}
