using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The ontwikkelingsrapport per child and moment over the real API and PostgreSQL (FB-003, FR-13.3, FR-13.7, FR-13.9,
/// Art. IX.4, ADR-0030 §3 footnote ⁶, ADR-0035 §3.1 to §3.3):
/// <list type="bullet">
/// <item>every rapportdoel of the set is on every report, with its subdoelen, and the three moments are apart (R8, D2);</item>
/// <item>the klas's own K3 leerkracht fills in during the schooljaar and only reads afterwards (R26); directie always;
/// nobody else reads, also not by the address (R17);</item>
/// <item>a gradatie or rapportdoel a report uses is not deleted, and a rename shows on the report (D1, R7);</item>
/// <item>a report never changes the dekking (FR-13.9), and goes with its child (D8).</item>
/// </list>
/// On Postgres because the cascade and the Restrict foreign keys, the unique (leerling, moment) and the rights read from
/// the database are what is under test. <b>Every name and text here is made up</b> (Art. VI.7).
/// </summary>
public sealed class OntwikkelingsrapportEndpointsTests : IAsyncLifetime
{
    private const string GradatieInGebruik =
        "Deze gradatie staat al op een rapport en kan niet verwijderd worden. Je kan ze wel hernoemen of verschuiven.";

    private const string RapportdoelInGebruik =
        "Dit rapportdoel staat al op een rapport en kan niet verwijderd worden. Je kan het wel hernoemen of verschuiven.";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;
    private RechtenTestOpzet _opzet = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("rapporten");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        _opzet = new RechtenTestOpzet(_db, _factory);

        await using var context = _db.MaakContext();
        foreach (var (code, tekst) in new[]
                 {
                     ("OR-01", "Luistert aandachtig naar een verhaal."),
                     ("OR-02", "Telt tot tien."),
                 })
        {
            context.Leerplandoelen.Add(new Leerplandoel(
                code, Doelsoort.Gemeenschappelijk, "K3", "Natuur", "Levende natuur", "9.1", tekst: tekst));
        }

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

    private static DateOnly Vandaag => DateOnly.FromDateTime(DateTime.UtcNow);

    // --- Filling in, moment by moment (AC1, AC2; R8, R9). ---

    [PostgresFact]
    public async Task De_leerkracht_vult_rapport_1_in_en_rapport_2_blijft_leeg()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        // Opening an empty report shows every rapportdoel with its subdoelen, and stores nothing.
        using (var antwoord = await lk.GetAsync(Rapport(o.Kind, 1)))
        {
            Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
            Assert.True(antwoord.Headers.CacheControl?.NoStore, "A report is pupil data: no cache may keep it.");
            using var json = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());
            Assert.Equal(
                ["achternaam", "besluit", "besluitStatus", "klasId", "klasNaam", "leerlingId", "moment", "rapportdoelen", "schooljaarNaam", "tekening", "voornaam"],
                json.RootElement.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
        }

        var leeg = await LeesAsync(lk, o.Kind, 1);
        Assert.Equal(("Fien", "Proefmans", 1), (leeg.Voornaam, leeg.Achternaam, leeg.Moment));
        Assert.Equal(["Luisteren en spreken", "Tellen en meten"], leeg.Rapportdoelen.Select(r => r.Titel));
        Assert.Equal(["OR-01"], leeg.Rapportdoelen[0].Subdoelen.Select(s => s.LeerplandoelCode));
        Assert.All(leeg.Rapportdoelen, r => Assert.True(r.GradatieId is null && r.Tekst is null && r.TekstStatus is null));
        Assert.Null(leeg.Besluit);
        Assert.Equal(0, await AantalRapportenAsync());

        using (var bewaar = await lk.PutAsJsonAsync(Beoordeling(o.Kind, 1, o.Luisteren), new { gradatieId = o.VolledigBereikt, tekst = " Luistert graag naar verhalen. " }))
        {
            Assert.Equal(HttpStatusCode.OK, bewaar.StatusCode);
            var bewaard = (await bewaar.Content.ReadFromJsonAsync<BeoordelingDto>())!;
            Assert.Equal((o.Luisteren, o.VolledigBereikt, "Luistert graag naar verhalen.", "Manueel"), (bewaard.RapportdoelId, bewaard.GradatieId, bewaard.Tekst, bewaard.TekstStatus));
        }

        using (var besluit = await lk.PutAsJsonAsync(Besluit(o.Kind, 1), new { tekst = "Een fijne eerste periode." }))
        {
            Assert.Equal(HttpStatusCode.OK, besluit.StatusCode);
            var bewaard = (await besluit.Content.ReadFromJsonAsync<BesluitDto>())!;
            Assert.Equal(("Een fijne eerste periode.", "Manueel"), (bewaard.Besluit, bewaard.BesluitStatus));
        }

        // After a reload: Rapport 1 as filled in.
        var een = await LeesAsync(lk, o.Kind, 1);
        Assert.Equal((o.VolledigBereikt, "Luistert graag naar verhalen.", "Manueel"), (een.Rapportdoelen[0].GradatieId, een.Rapportdoelen[0].Tekst, een.Rapportdoelen[0].TekstStatus));
        Assert.True(een.Rapportdoelen[1].GradatieId is null && een.Rapportdoelen[1].Tekst is null);
        Assert.Equal(("Een fijne eerste periode.", "Manueel"), (een.Besluit, een.BesluitStatus));

        // Rapport 2 is its own, and empty.
        var twee = await LeesAsync(lk, o.Kind, 2);
        Assert.All(twee.Rapportdoelen, r => Assert.True(r.GradatieId is null && r.Tekst is null));
        Assert.Null(twee.Besluit);

        await using var context = _db.MaakContext();
        var rapport = await context.Ontwikkelingsrapporten.Include(r => r.Beoordelingen).SingleAsync();
        Assert.Equal((o.Kind, 1), (rapport.LeerlingId, rapport.Moment));
        Assert.Single(rapport.Beoordelingen);
    }

    [PostgresFact]
    public async Task Een_ster_en_tekst_wissen_laat_het_rapportdoel_leeg()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, o.Luisteren, o.VolledigBereikt, "Luistert goed.");

        using (var wis = await lk.PutAsJsonAsync(Beoordeling(o.Kind, 1, o.Luisteren), new { gradatieId = (Guid?)null, tekst = "  " }))
        {
            Assert.Equal(HttpStatusCode.OK, wis.StatusCode);
            var bewaard = (await wis.Content.ReadFromJsonAsync<BeoordelingDto>())!;
            Assert.True(bewaard.GradatieId is null && bewaard.Tekst is null && bewaard.TekstStatus is null);
        }

        Assert.True((await LeesAsync(lk, o.Kind, 1)).Rapportdoelen[0].Tekst is null);
        await using var context = _db.MaakContext();
        Assert.Equal(0, await context.Rapportbeoordelingen.CountAsync());
    }

    [PostgresFact]
    public async Task Een_rapportdoel_dat_later_bijkomt_staat_leeg_op_een_rapport_dat_al_ingevuld_is()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, o.Luisteren, o.VolledigBereikt, "Luistert goed.");

        await MaakRapportdoelAsync(lk, "Bewegen", o.TellenSubdoel);

        var rapport = await LeesAsync(lk, o.Kind, 1);
        Assert.Equal(["Luisteren en spreken", "Tellen en meten", "Bewegen"], rapport.Rapportdoelen.Select(r => r.Titel));
        Assert.True(rapport.Rapportdoelen[2].GradatieId is null && rapport.Rapportdoelen[2].Tekst is null);
        Assert.Equal("Luistert goed.", rapport.Rapportdoelen[0].Tekst);
    }

    [PostgresFact]
    public async Task Twee_eerste_bewaringen_tegelijk_gaan_allebei_mee_in_een_rapport()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        var antwoorden = await Task.WhenAll(
            lk.PutAsJsonAsync(Beoordeling(o.Kind, 3, o.Luisteren), new { gradatieId = o.VolledigBereikt, tekst = "Luistert goed." }),
            lk.PutAsJsonAsync(Beoordeling(o.Kind, 3, o.Tellen), new { gradatieId = o.NogNietVolledig, tekst = "Telt tot vijf." }),
            lk.PutAsJsonAsync(Besluit(o.Kind, 3), new { tekst = "Een fijn jaar." }));
        Assert.All(antwoorden, a => Assert.Equal(HttpStatusCode.OK, a.StatusCode));
        foreach (var antwoord in antwoorden)
        {
            antwoord.Dispose();
        }

        var rapport = await LeesAsync(lk, o.Kind, 3);
        Assert.Equal(["Luistert goed.", "Telt tot vijf."], rapport.Rapportdoelen.Select(r => r.Tekst));
        Assert.Equal("Een fijn jaar.", rapport.Besluit);
        Assert.Equal(1, await AantalRapportenAsync());
    }

    [PostgresFact]
    public async Task Twee_eerste_bewaringen_van_hetzelfde_rapportdoel_tegelijk_geven_geen_fout()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        using (var besluit = await lk.PutAsJsonAsync(Besluit(o.Kind, 1), new { tekst = "Het rapport bestaat al." }))
        {
            Assert.Equal(HttpStatusCode.OK, besluit.StatusCode);
        }

        // Two co-teachers rate the same rapportdoel for the first time at once (R16): both rows would share one key.
        var antwoorden = await Task.WhenAll(
            lk.PutAsJsonAsync(Beoordeling(o.Kind, 1, o.Luisteren), new { gradatieId = o.VolledigBereikt, tekst = "Van de ene." }),
            lk.PutAsJsonAsync(Beoordeling(o.Kind, 1, o.Luisteren), new { gradatieId = o.NogNietVolledig, tekst = "Van de andere." }));
        Assert.All(antwoorden, a => Assert.Equal(HttpStatusCode.OK, a.StatusCode));
        foreach (var antwoord in antwoorden)
        {
            antwoord.Dispose();
        }

        Assert.Contains((await LeesAsync(lk, o.Kind, 1)).Rapportdoelen[0].Tekst, new[] { "Van de ene.", "Van de andere." });
        await using var context = _db.MaakContext();
        Assert.Equal(1, await context.Rapportbeoordelingen.CountAsync());
    }

    // --- Who (AC3, AC4; R16, R17, R26). ---

    [PostgresFact]
    public async Task Niemand_buiten_de_klas_leest_of_vult_in_ook_niet_via_het_adres_en_de_directie_wel()
    {
        var o = await OpzetAsync();
        using var groen = _opzet.Als(await _opzet.GebruikerAsync(o.School, klassen: [o.School.K3Groen]));
        using var rood = _opzet.Als(await _opzet.GebruikerAsync(o.School, klassen: [o.School.K2Rood]));
        using var hlEnTb = _opzet.Als(await _opzet.GebruikerAsync(o.School, themabeheer: true, hoofdleerkrachtVan: ["K3"]));
        using var niemand = _opzet.Als(await _opzet.GebruikerAsync());

        foreach (var client in new[] { groen, rood, hlEnTb, niemand })
        {
            await Verwacht403Async(client.GetAsync(Rapport(o.Kind, 1)));
            await Verwacht403Async(client.PutAsJsonAsync(Beoordeling(o.Kind, 1, o.Luisteren), new { gradatieId = o.VolledigBereikt, tekst = "Andermans tekst." }));
            await Verwacht403Async(client.PutAsJsonAsync(Besluit(o.Kind, 1), new { tekst = "Andermans besluit." }));
        }

        Assert.Equal(0, await AantalRapportenAsync());

        using var directie = _opzet.Directie();
        await BewaarAsync(directie, o.Kind, 1, o.Luisteren, o.VolledigBereikt, "Door de directie.");
        Assert.Equal("Door de directie.", (await LeesAsync(directie, o.Kind, 1)).Rapportdoelen[0].Tekst);
    }

    [PostgresFact]
    public async Task Na_het_schooljaar_leest_de_leerkracht_het_rapport_nog_maar_wijzigt_niets_en_de_directie_wel()
    {
        var o = await OpzetAsync();
        var voorbij = new Schooljaar(TestSchooljaar.UniekeNaam("voorbij"), Vandaag.AddDays(-400), Vandaag.AddDays(-35));
        var klas = voorbij.VoegKlasToe($"K3v-{Guid.NewGuid():N}", "K3");
        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(voorbij);
            await context.SaveChangesAsync();
        }

        using var directie = _opzet.Directie();
        var staf = await RechtenTestOpzet.IdAsync(
            directie.PostAsJsonAsync($"/api/klassen/{klas.Id}/leerlingen", new { voornaam = "Staf", achternaam = "Voorbeeld" }), HttpStatusCode.Created);
        await BewaarAsync(directie, staf, 2, o.Luisteren, o.VolledigBereikt, "Een verzonnen tekst.");

        using var lk = _opzet.Als(await _opzet.GebruikerAsync(klassen: [klas.Id]));
        var rapport = await LeesAsync(lk, staf, 2);
        Assert.Equal("Een verzonnen tekst.", rapport.Rapportdoelen[0].Tekst);
        Assert.Equal(voorbij.Naam, rapport.SchooljaarNaam);

        await Verwacht403Async(lk.PutAsJsonAsync(Beoordeling(staf, 2, o.Luisteren), new { gradatieId = o.NogNietVolledig, tekst = "Gewijzigd." }));
        await Verwacht403Async(lk.PutAsJsonAsync(Besluit(staf, 2), new { tekst = "Gewijzigd." }));

        await BewaarAsync(directie, staf, 2, o.Luisteren, o.NogNietVolledig, "Na het schooljaar door de directie.");
        Assert.Equal("Na het schooljaar door de directie.", (await LeesAsync(lk, staf, 2)).Rapportdoelen[0].Tekst);
    }

    // --- The K3 set once reports use it (AC5; D1, R7). ---

    [PostgresFact]
    public async Task Een_gebruikte_gradatie_of_rapportdoel_wordt_niet_verwijderd_en_een_nieuwe_naam_staat_op_het_rapport()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, o.Luisteren, o.VolledigBereikt, tekst: null);

        await RechtenTestOpzet.VerwachtAsync(lk.DeleteAsync($"/api/gradaties/{o.VolledigBereikt}"), HttpStatusCode.BadRequest, GradatieInGebruik);
        await RechtenTestOpzet.VerwachtAsync(lk.DeleteAsync($"/api/rapportdoelen/{o.Luisteren}"), HttpStatusCode.BadRequest, RapportdoelInGebruik);

        // Renaming both works, and the report shows the new names (R7).
        using (var hernoem = await lk.PutAsJsonAsync($"/api/gradaties/{o.VolledigBereikt}", new { label = "Bereikt", kleur = "Groen" }))
        {
            Assert.Equal(HttpStatusCode.OK, hernoem.StatusCode);
        }

        using (var hernoem = await lk.PutAsJsonAsync($"/api/rapportdoelen/{o.Luisteren}", new { titel = "Luisteren", subdoelIds = new[] { o.LuisterenSubdoel } }))
        {
            Assert.Equal(HttpStatusCode.OK, hernoem.StatusCode);
        }

        var rapport = await LeesAsync(lk, o.Kind, 1);
        Assert.Equal("Luisteren", rapport.Rapportdoelen[0].Titel);
        Assert.Equal(o.VolledigBereikt, rapport.Rapportdoelen[0].GradatieId);
        var gradaties = (await lk.GetFromJsonAsync<List<GradatieDto>>("/api/gradaties"))!;
        Assert.Equal("Bereikt", gradaties.Single(g => g.Id == o.VolledigBereikt).Label);

        // What no report uses goes as before.
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync($"/api/gradaties/{o.NogNietVolledig}")));
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync($"/api/rapportdoelen/{o.Tellen}")));
        Assert.Equal(["Luisteren"], (await LeesAsync(lk, o.Kind, 1)).Rapportdoelen.Select(r => r.Titel));

        // Once the report no longer shows the star, it can go too.
        await BewaarAsync(lk, o.Kind, 1, o.Luisteren, gradatieId: null, tekst: null);
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync($"/api/gradaties/{o.VolledigBereikt}")));
    }

    // --- Never dekking (AC6; FR-13.9), and gone with the child (D8). ---

    [PostgresFact]
    public async Task Het_dekkingsoverzicht_is_hetzelfde_voor_en_na_het_invullen()
    {
        var o = await OpzetAsync();
        using var directie = _opzet.Directie();
        var dekking = $"/api/klassen/{o.School.K3Blauw}/dekking";
        var voor = await directie.GetStringAsync(dekking);

        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, o.Luisteren, o.VolledigBereikt, "Luistert goed.");
        await BewaarAsync(lk, o.Kind, 2, o.Tellen, o.NogNietVolledig, "Telt tot vijf.");

        Assert.Equal(voor, await directie.GetStringAsync(dekking));
    }

    [PostgresFact]
    public async Task Een_kind_verwijderen_verwijdert_al_zijn_rapporten()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, o.Luisteren, o.VolledigBereikt, "Luistert goed.");
        await BewaarAsync(lk, o.Kind, 3, o.Tellen, o.NogNietVolledig, "Telt tot vijf.");
        using (var besluit = await lk.PutAsJsonAsync(Besluit(o.Kind, 2), new { tekst = "Een fijne periode." }))
        {
            Assert.Equal(HttpStatusCode.OK, besluit.StatusCode);
        }

        Assert.Equal(3, await AantalRapportenAsync());
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync($"/api/leerlingen/{o.Kind}")));

        Assert.Equal(0, await AantalRapportenAsync());
        await using var context = _db.MaakContext();
        Assert.Equal(0, await context.Rapportbeoordelingen.CountAsync());
        Assert.Equal(HttpStatusCode.NotFound, await RechtenTestOpzet.StatusAsync(lk.GetAsync(Rapport(o.Kind, 1))));
    }

    // --- Refusals, in Dutch, and nothing stored. ---

    [PostgresFact]
    public async Task Een_ongeldige_invoer_wordt_in_het_Nederlands_geweigerd_en_er_wordt_niets_bewaard()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        await RechtenTestOpzet.VerwachtAsync(
            lk.PutAsJsonAsync(Beoordeling(o.Kind, 1, o.Luisteren), new { gradatieId = Guid.NewGuid(), tekst = "Tekst." }),
            HttpStatusCode.BadRequest,
            "Deze ster is niet gevonden in de sterrenschaal. Vernieuw de pagina en kies opnieuw.");
        await RechtenTestOpzet.VerwachtAsync(
            lk.PutAsJsonAsync(Beoordeling(o.Kind, 1, Guid.NewGuid()), new { gradatieId = o.VolledigBereikt, tekst = "Tekst." }),
            HttpStatusCode.NotFound,
            "Dit rapportdoel is niet gevonden. Vernieuw de pagina.");
        await RechtenTestOpzet.VerwachtAsync(
            lk.PutAsJsonAsync(Beoordeling(o.Kind, 1, o.Luisteren), new { gradatieId = o.VolledigBereikt, tekst = new string('x', 2001) }),
            HttpStatusCode.BadRequest,
            "Een tekst is hoogstens 2000 tekens lang.");
        await RechtenTestOpzet.VerwachtAsync(
            lk.PutAsJsonAsync(Besluit(o.Kind, 1), new { tekst = new string('x', 4001) }),
            HttpStatusCode.BadRequest,
            "Een algemeen besluit is hoogstens 4000 tekens lang.");
        await RechtenTestOpzet.VerwachtAsync(
            lk.GetAsync(Rapport(Guid.NewGuid(), 1)), HttpStatusCode.NotFound, "Dit kind is niet gevonden.");

        // Only three moments: any other number names no report.
        Assert.Equal(HttpStatusCode.NotFound, await RechtenTestOpzet.StatusAsync(lk.GetAsync(Rapport(o.Kind, 4))));
        Assert.Equal(HttpStatusCode.NotFound, await RechtenTestOpzet.StatusAsync(lk.PutAsJsonAsync(Besluit(o.Kind, 0), new { tekst = "Tekst." })));

        Assert.Equal(0, await AantalRapportenAsync());
    }

    // --- Setup and helpers. ---

    /// <summary>
    /// A running school with a K3 leerkracht of K3 blauw, the set "Luisteren en spreken" (OR-01) and "Tellen en meten"
    /// (OR-02) made by that leerkracht, the seeded scale, and the made-up child Fien Proefmans in K3 blauw.
    /// </summary>
    private async Task<Opzet> OpzetAsync()
    {
        var school = await _opzet.SchoolAsync();
        var leerkrachtId = await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);

        using var directie = _opzet.Directie();
        var thema = await RechtenTestOpzet.IdAsync(
            directie.PostAsJsonAsync("/api/themas", new { naam = $"Water {Guid.NewGuid():N}", duurWeken = 4 }), HttpStatusCode.Created);
        var subthema = await RechtenTestOpzet.IdAsync(
            directie.PostAsJsonAsync($"/api/themas/{thema}/subthemas", new { naam = "Regen", duurWeken = 2, leeftijd = "K3" }), HttpStatusCode.Created);
        var luisterenSubdoel = await RechtenTestOpzet.IdAsync(
            directie.PostAsJsonAsync($"/api/subthemas/{subthema}/doelkoppelingen", new { leerplandoelCode = "OR-01" }), HttpStatusCode.OK);
        var tellenSubdoel = await RechtenTestOpzet.IdAsync(
            directie.PostAsJsonAsync($"/api/subthemas/{subthema}/doelkoppelingen", new { leerplandoelCode = "OR-02" }), HttpStatusCode.OK);

        using var lk = _opzet.Als(leerkrachtId);
        var luisteren = await MaakRapportdoelAsync(lk, "Luisteren en spreken", luisterenSubdoel);
        var tellen = await MaakRapportdoelAsync(lk, "Tellen en meten", tellenSubdoel);

        var kind = await RechtenTestOpzet.IdAsync(
            directie.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/leerlingen", new { voornaam = "Fien", achternaam = "Proefmans" }), HttpStatusCode.Created);

        var gradaties = (await lk.GetFromJsonAsync<List<GradatieDto>>("/api/gradaties"))!;
        return new Opzet(
            school,
            leerkrachtId,
            kind,
            luisteren,
            tellen,
            luisterenSubdoel,
            tellenSubdoel,
            gradaties.Single(g => g.Label == "Volledig bereikt").Id,
            gradaties.Single(g => g.Label == "Nog niet volledig").Id);
    }

    private static string Rapport(Guid leerlingId, int moment) => $"/api/leerlingen/{leerlingId}/rapporten/{moment}";

    private static string Beoordeling(Guid leerlingId, int moment, Guid rapportdoelId) =>
        $"{Rapport(leerlingId, moment)}/rapportdoelen/{rapportdoelId}";

    private static string Besluit(Guid leerlingId, int moment) => $"{Rapport(leerlingId, moment)}/besluit";

    private static async Task<RapportDto> LeesAsync(HttpClient client, Guid leerlingId, int moment)
    {
        using var antwoord = await client.GetAsync(Rapport(leerlingId, moment));
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<RapportDto>())!;
    }

    private static async Task BewaarAsync(HttpClient client, Guid leerlingId, int moment, Guid rapportdoelId, Guid? gradatieId, string? tekst)
    {
        using var antwoord = await client.PutAsJsonAsync(Beoordeling(leerlingId, moment, rapportdoelId), new { gradatieId, tekst });
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
    }

    private static async Task<Guid> MaakRapportdoelAsync(HttpClient client, string titel, params Guid[] subdoelIds) =>
        await RechtenTestOpzet.IdAsync(client.PostAsJsonAsync("/api/rapportdoelen", new { titel, subdoelIds }), HttpStatusCode.Created);

    private async Task<int> AantalRapportenAsync()
    {
        await using var context = _db.MaakContext();
        return await context.Ontwikkelingsrapporten.CountAsync();
    }

    private static Task Verwacht403Async(Task<HttpResponseMessage> verzoek) =>
        RechtenTestOpzet.VerwachtAsync(verzoek, HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);

    private sealed record Opzet(
        RechtenTestOpzet.School School,
        Guid LeerkrachtId,
        Guid Kind,
        Guid Luisteren,
        Guid Tellen,
        Guid LuisterenSubdoel,
        Guid TellenSubdoel,
        Guid VolledigBereikt,
        Guid NogNietVolledig);

    private sealed record RapportDto(
        Guid LeerlingId,
        Guid KlasId,
        string Voornaam,
        string Achternaam,
        string KlasNaam,
        string SchooljaarNaam,
        int Moment,
        List<RegelDto> Rapportdoelen,
        string? Besluit,
        string? BesluitStatus);

    private sealed record RegelDto(Guid RapportdoelId, string Titel, List<SubdoelDto> Subdoelen, Guid? GradatieId, string? Tekst, string? TekstStatus);

    private sealed record SubdoelDto(Guid Id, string LeerplandoelCode);

    private sealed record BeoordelingDto(Guid RapportdoelId, Guid? GradatieId, string? Tekst, string? TekstStatus);

    private sealed record BesluitDto(string? Besluit, string? BesluitStatus);

    private sealed record GradatieDto(Guid Id, string Label, string Kleur, int Volgorde);
}
