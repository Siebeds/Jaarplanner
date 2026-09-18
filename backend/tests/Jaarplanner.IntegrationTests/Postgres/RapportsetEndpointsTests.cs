using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The one K3 set of rapportdoelen and the one sterrenschaal over the real API and PostgreSQL (FB-002, FR-13.2, Art.
/// IX.4, ADR-0030 §3 footnote ⁶, ADR-0035 §3.2, §3.3):
/// <list type="bullet">
/// <item>the scale starts with the owner's example (two stars) and the palette is the six fixed colours;</item>
/// <item>every K3 leerkracht in a running schooljaar edits both, and every other K3 leerkracht sees the change (R4-R7);</item>
/// <item>admin, a hoofdleerkracht of K3 without a K3 klastoewijzing, a K2 leerkracht, themabeheer and a K3 leerkracht
/// after the schooljaar view them and change nothing, also by URL (R31, D4);</item>
/// <item>only decided K3 subdoelen are bundled, and one that is refused, deleted or re-scoped leaves every rapportdoel,
/// which keeps its titel (D3, D11, D12).</item>
/// </list>
/// On Postgres because the cascade from a subdoel to its join rows, the status filter's translation and the rights read
/// from the database are what is under test. Each test gets its own database, so each starts from the seeded scale.
/// </summary>
public sealed class RapportsetEndpointsTests : IAsyncLifetime
{
    private const string Gradaties = "/api/gradaties";
    private const string Rapportdoelen = "/api/rapportdoelen";

    private const string GeenKandidaat =
        "Kies alleen subdoelen van de derde kleuter waarvan het doel aanvaard of manueel is. Vernieuw de pagina om de keuzelijst opnieuw te laden.";

    private static readonly Guid VolledigBereikt = Guid.Parse("3b0f6a52-8c1e-4d7a-9f25-6e4b1c0d2a71");
    private static readonly Guid NogNietVolledig = Guid.Parse("9d4e2c18-5a73-4b6f-8e01-2f7c3a9b4d56");

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;
    private RechtenTestOpzet _opzet = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("rapportset");
        _factory = new PostgresApiFactory(_db.ConnectionString);
        _opzet = new RechtenTestOpzet(_db, _factory);

        await using var context = _db.MaakContext();
        foreach (var (code, tekst) in new[]
                 {
                     ("RS-01", "Luistert aandachtig naar een verhaal."),
                     ("RS-02", "Vertelt over een eigen ervaring."),
                     ("RS-03", "Telt tot tien."),
                     ("RS-04", "Benoemt kleuren."),
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

    // --- The scale: the owner's example to start, and the fixed palette (owner rulings 2026-09-15). ---

    [PostgresFact]
    public async Task De_sterrenschaal_begint_met_het_voorbeeld_van_de_eigenaar_en_de_kleurenlijst_is_vast()
    {
        using var admin = _opzet.Admin();

        using (var antwoord = await admin.GetAsync(Gradaties))
        {
            Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
            using var json = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());
            var eerste = json.RootElement[0];
            // The shape the frontend reads, exactly, and the colour as its name.
            Assert.Equal(["id", "kleur", "label", "volgorde"], eerste.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
            Assert.Equal("Groen", eerste.GetProperty("kleur").GetString());
        }

        Assert.Equal(
            [(VolledigBereikt, "Volledig bereikt", "Groen", 1), (NogNietVolledig, "Nog niet volledig", "Oranje", 2)],
            (await GradatiesAsync(admin)).Select(g => (g.Id, g.Label, g.Kleur, g.Volgorde)));

        Assert.Equal(
            ["Groen", "Lichtgroen", "Geel", "Oranje", "Rood", "Blauw"],
            (await admin.GetFromJsonAsync<List<string>>($"{Gradaties}/kleuren"))!);
    }

    [PostgresFact]
    public async Task Een_K3_leerkracht_beheert_de_sterrenschaal_en_elke_K3_leerkracht_ziet_dezelfde()
    {
        var school = await _opzet.SchoolAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var groen = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Groen]));

        // Added at the end, trimmed.
        var bijna = await MaakGradatieAsync(blauw, " Bijna ", "Geel");
        Assert.Equal(("Bijna", "Geel", 3), (bijna.Label, bijna.Kleur, bijna.Volgorde));

        // Another K3 klas's leerkracht renames and recolours a star of the same scale.
        using (var wijzig = await groen.PutAsJsonAsync($"{Gradaties}/{VolledigBereikt}", new { label = "Helemaal", kleur = "Lichtgroen" }))
        {
            Assert.Equal(HttpStatusCode.OK, wijzig.StatusCode);
            var gewijzigd = (await wijzig.Content.ReadFromJsonAsync<GradatieDto>())!;
            Assert.Equal(("Helemaal", "Lichtgroen", 1), (gewijzigd.Label, gewijzigd.Kleur, gewijzigd.Volgorde));
        }

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            blauw.PutAsJsonAsync($"{Gradaties}/volgorde", new { ids = new[] { bijna.Id, VolledigBereikt, NogNietVolledig } })));

        // One scale for all of K3 (R5): the other leerkracht reads what the first made, in the chosen order.
        Assert.Equal(
            [("Bijna", "Geel", 1), ("Helemaal", "Lichtgroen", 2), ("Nog niet volledig", "Oranje", 3)],
            (await GradatiesAsync(groen)).Select(g => (g.Label, g.Kleur, g.Volgorde)));

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(groen.DeleteAsync($"{Gradaties}/{bijna.Id}")));
        Assert.Equal(["Helemaal", "Nog niet volledig"], (await GradatiesAsync(blauw)).Select(g => g.Label));
    }

    // --- The set (R3, R4, D11). ---

    [PostgresFact]
    public async Task Een_K3_leerkracht_bundelt_beslist_K3_subdoelen_en_elke_K3_leerkracht_ziet_dezelfde_set()
    {
        var school = await _opzet.SchoolAsync();
        var inhoud = await InhoudAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var groen = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Groen]));

        // The picker: decided K3 subdoelen only, by thema, subthema and code. Herfst before Water.
        using (var antwoord = await blauw.GetAsync($"{Rapportdoelen}/kandidaten"))
        {
            Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
            using var json = JsonDocument.Parse(await antwoord.Content.ReadAsStringAsync());
            var eerste = json.RootElement[0];
            Assert.Equal(
                ["doelsoort", "id", "leerplandoelCode", "leerplandoelTekst", "subthemaNaam", "themaNaam"],
                eerste.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal));
            Assert.Equal("Gemeenschappelijk", eerste.GetProperty("doelsoort").GetString());
        }

        var kandidaten = await KandidatenAsync(blauw);
        Assert.Equal([inhoud.Tellen, inhoud.Luisteren, inhoud.Vertellen], kandidaten.Select(k => k.Id));
        Assert.Equal(
            ("RS-03", "Telt tot tien.", "Herfst", "Bladeren"),
            (kandidaten[0].LeerplandoelCode, kandidaten[0].LeerplandoelTekst, kandidaten[0].ThemaNaam, kandidaten[0].SubthemaNaam));

        var luisteren = await MaakRapportdoelAsync(blauw, " Luisteren en spreken ", inhoud.Vertellen, inhoud.Luisteren, inhoud.Luisteren);
        Assert.Equal(("Luisteren en spreken", 1), (luisteren.Titel, luisteren.Volgorde));
        Assert.Equal([inhoud.Luisteren, inhoud.Vertellen], luisteren.Subdoelen.Select(s => s.Id));

        var rekenen = await MaakRapportdoelAsync(blauw, "Rekenen", inhoud.Tellen);
        Assert.Equal(2, rekenen.Volgorde);

        // At least one subdoel (owner, 2026-09-15): a titel alone is refused, with or without the list, and nothing is made.
        await VerwachtAsync(blauw.PostAsJsonAsync(Rapportdoelen, new { titel = "Nog te vullen" }), "Kies minstens één subdoel.");
        await VerwachtAsync(
            blauw.PostAsJsonAsync(Rapportdoelen, new { titel = "Nog te vullen", subdoelIds = Array.Empty<Guid>() }), "Kies minstens één subdoel.");
        // The last subdoel cannot be taken out either; the rapportdoel is deleted instead.
        await VerwachtAsync(
            blauw.PutAsJsonAsync($"{Rapportdoelen}/{rekenen.Id}", new { titel = "Rekenen", subdoelIds = Array.Empty<Guid>() }), "Kies minstens één subdoel.");

        // One set for all of K3 (R4).
        var gezien = await RapportdoelenAsync(groen);
        Assert.Equal(["Luisteren en spreken", "Rekenen"], gezien.Select(r => r.Titel));
        Assert.Equal([inhoud.Tellen], gezien[1].Subdoelen.Select(s => s.Id));
        Assert.Equal([inhoud.Luisteren, inhoud.Vertellen], gezien[0].Subdoelen.Select(s => s.Id));

        // The other leerkracht changes it: another titel, one subdoel out, one in, sorted Herfst first.
        using (var wijzig = await groen.PutAsJsonAsync($"{Rapportdoelen}/{luisteren.Id}", new { titel = "Luisteren", subdoelIds = new[] { inhoud.Luisteren, inhoud.Tellen } }))
        {
            Assert.Equal(HttpStatusCode.OK, wijzig.StatusCode);
            var gewijzigd = (await wijzig.Content.ReadFromJsonAsync<RapportdoelDto>())!;
            Assert.Equal("Luisteren", gewijzigd.Titel);
            Assert.Equal([inhoud.Tellen, inhoud.Luisteren], gewijzigd.Subdoelen.Select(s => s.Id));
        }

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            blauw.PutAsJsonAsync($"{Rapportdoelen}/volgorde", new { ids = new[] { rekenen.Id, luisteren.Id } })));
        Assert.Equal(["Rekenen", "Luisteren"], (await RapportdoelenAsync(groen)).Select(r => r.Titel));

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(blauw.DeleteAsync($"{Rapportdoelen}/{rekenen.Id}")));
        Assert.Equal(["Luisteren"], (await RapportdoelenAsync(blauw)).Select(r => r.Titel));

        await using var context = _db.MaakContext();
        Assert.Equal(2, await context.RapportdoelSubdoelen.CountAsync(rs => rs.RapportdoelId == luisteren.Id));
    }

    [PostgresFact]
    public async Task Alleen_beslist_K3_subdoelen_zijn_te_kiezen_en_een_geweigerd_doel_verdwijnt_uit_het_rapportdoel()
    {
        var school = await _opzet.SchoolAsync();
        var inhoud = await InhoudAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));

        // Not a candidate: a K2 subdoel, an undecided K3 subdoel, an id that names nothing. One sentence for all three.
        var kandidaten = (await KandidatenAsync(blauw)).Select(k => k.Id).ToList();
        Assert.DoesNotContain(inhoud.K2, kandidaten);
        Assert.DoesNotContain(inhoud.Voorgesteld, kandidaten);

        foreach (var id in new[] { inhoud.K2, inhoud.Voorgesteld, Guid.NewGuid() })
        {
            await RechtenTestOpzet.VerwachtAsync(
                blauw.PostAsJsonAsync(Rapportdoelen, new { titel = "Luisteren", subdoelIds = new[] { inhoud.Luisteren, id } }),
                HttpStatusCode.BadRequest,
                GeenKandidaat);
        }

        Assert.Empty(await RapportdoelenAsync(blauw));

        var luisteren = await MaakRapportdoelAsync(blauw, "Luisteren", inhoud.Luisteren, inhoud.Vertellen);
        await RechtenTestOpzet.VerwachtAsync(
            blauw.PutAsJsonAsync($"{Rapportdoelen}/{luisteren.Id}", new { titel = "Anders", subdoelIds = new[] { inhoud.Luisteren, inhoud.Voorgesteld } }),
            HttpStatusCode.BadRequest,
            GeenKandidaat);
        Assert.Equal(("Luisteren", 2), (await RapportdoelenAsync(blauw)).Select(r => (r.Titel, r.Subdoelen.Count)).Single());

        // A row for an undecided subdoel that got in some other way (a legacy row) is filtered on read.
        await using (var context = _db.MaakContext())
        {
            var rapportdoel = await context.Rapportdoelen.Include(r => r.Subdoelen).SingleAsync(r => r.Id == luisteren.Id);
            rapportdoel.Wijzig(rapportdoel.Titel, [.. rapportdoel.Subdoelen.Select(rs => rs.SubdoelId), inhoud.Voorgesteld]);
            await context.SaveChangesAsync();
        }

        Assert.Equal([inhoud.Luisteren, inhoud.Vertellen], (await RapportdoelenAsync(blauw)).Single().Subdoelen.Select(s => s.Id));

        // D11 and scenario 6: the goal of one of the two is refused. It leaves the rapportdoel, which keeps its titel.
        await ZetStatusAsync(inhoud.Luisteren, KoppelingStatus.Geweigerd);

        var nu = (await RapportdoelenAsync(blauw)).Single();
        Assert.Equal("Luisteren", nu.Titel);
        Assert.Equal([inhoud.Vertellen], nu.Subdoelen.Select(s => s.Id));
        Assert.DoesNotContain(inhoud.Luisteren, (await KandidatenAsync(blauw)).Select(k => k.Id));

        // Aanvaard counts as decided, like Manueel.
        await ZetStatusAsync(inhoud.Voorgesteld, KoppelingStatus.Aanvaard);
        Assert.Contains(inhoud.Voorgesteld, (await KandidatenAsync(blauw)).Select(k => k.Id));
    }

    // --- A subdoel that goes, or leaves K3, leaves every rapportdoel (D3, D12). ---

    [PostgresFact]
    public async Task Een_verwijderd_subdoel_subthema_of_thema_verlaat_elk_rapportdoel_dat_zijn_titel_houdt()
    {
        var school = await _opzet.SchoolAsync();
        var inhoud = await InhoudAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var admin = _opzet.Admin();
        var luisteren = await MaakRapportdoelAsync(blauw, "Luisteren en spreken", inhoud.Luisteren, inhoud.Vertellen, inhoud.Tellen);

        // A hoofdleerkracht's (here admin's) subdoel delete, on its own route.
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(
            admin.DeleteAsync($"/api/subthemas/{inhoud.Regen}/subdoelen/{inhoud.Luisteren}")));
        Assert.Equal([inhoud.Tellen, inhoud.Vertellen], (await RapportdoelenAsync(blauw)).Single().Subdoelen.Select(s => s.Id));

        // A subthema delete takes its subdoelen with it.
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(admin.DeleteAsync($"/api/subthemas/{inhoud.Bladeren}")));
        Assert.Equal([inhoud.Vertellen], (await RapportdoelenAsync(blauw)).Single().Subdoelen.Select(s => s.Id));

        // And a thema delete, two cascades away.
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(admin.DeleteAsync($"/api/themas/{inhoud.Water}")));
        var over = (await RapportdoelenAsync(blauw)).Single();
        Assert.Equal(("Luisteren en spreken", 0), (over.Titel, over.Subdoelen.Count));

        // The rows are gone from the database, not only from the answer.
        await using var context = _db.MaakContext();
        Assert.Equal(0, await context.RapportdoelSubdoelen.CountAsync(rs => rs.RapportdoelId == luisteren.Id));
        Assert.True(await context.Rapportdoelen.AnyAsync(r => r.Id == luisteren.Id));
    }

    [PostgresFact]
    public async Task Een_subthema_dat_K3_verlaat_neemt_zijn_subdoelen_mee_uit_elk_rapportdoel_en_brengt_ze_niet_terug()
    {
        var school = await _opzet.SchoolAsync();
        var inhoud = await InhoudAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var admin = _opzet.Admin();
        var luisteren = await MaakRapportdoelAsync(blauw, "Luisteren en spreken", inhoud.Luisteren, inhoud.Vertellen, inhoud.Tellen);

        // An edit that stays in K3 changes nothing about membership; the new name shows.
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemas/{inhoud.Regen}", new { naam = "Regenbui", duurWeken = 2, leeftijd = "K3" })));
        var ongewijzigd = (await RapportdoelenAsync(blauw)).Single();
        Assert.Equal([inhoud.Tellen, inhoud.Luisteren, inhoud.Vertellen], ongewijzigd.Subdoelen.Select(s => s.Id));
        Assert.Equal("Regenbui", ongewijzigd.Subdoelen[1].SubthemaNaam);

        // D12: re-scoped to K2, its two subdoelen leave.
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemas/{inhoud.Regen}", new { naam = "Regenbui", duurWeken = 2, leeftijd = "K2" })));
        Assert.Equal([inhoud.Tellen], (await RapportdoelenAsync(blauw)).Single().Subdoelen.Select(s => s.Id));

        // Back to K3: they are candidates again, and not back in the rapportdoel unasked.
        Assert.Equal(HttpStatusCode.OK, await RechtenTestOpzet.StatusAsync(
            admin.PutAsJsonAsync($"/api/subthemas/{inhoud.Regen}", new { naam = "Regenbui", duurWeken = 2, leeftijd = "K3" })));
        var terug = (await RapportdoelenAsync(blauw)).Single();
        Assert.Equal("Luisteren en spreken", terug.Titel);
        Assert.Equal([inhoud.Tellen], terug.Subdoelen.Select(s => s.Id));
        Assert.Contains(inhoud.Luisteren, (await KandidatenAsync(blauw)).Select(k => k.Id));

        await using var context = _db.MaakContext();
        Assert.Equal([inhoud.Tellen], await context.RapportdoelSubdoelen.Where(rs => rs.RapportdoelId == luisteren.Id).Select(rs => rs.SubdoelId).ToListAsync());
    }

    // --- Who (R6, R31, D4): view for everyone signed in, edit for the K3 leerkrachten of a running schooljaar. ---

    [PostgresFact]
    public async Task Admin_hoofdleerkracht_K2_leerkracht_en_themabeheer_bekijken_de_set_maar_wijzigen_niets()
    {
        var school = await _opzet.SchoolAsync();
        var inhoud = await InhoudAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var luisteren = await MaakRapportdoelAsync(blauw, "Luisteren", inhoud.Luisteren);

        var kijkers = new List<HttpClient>
        {
            _opzet.Admin(),
            _opzet.Als(await _opzet.GebruikerAsync(admin: true)),
            // D4: a hoofdleerkracht of K3 without a K3 klastoewijzing, also holding themabeheer.
            _opzet.Als(await _opzet.GebruikerAsync(school, themabeheer: true, hoofdleerkrachtVan: ["K3"])),
            _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K2Rood])),
        };

        try
        {
            foreach (var kijker in kijkers)
            {
                Assert.Equal(2, (await GradatiesAsync(kijker)).Count);
                Assert.Equal(6, (await kijker.GetFromJsonAsync<List<string>>($"{Gradaties}/kleuren"))!.Count);
                Assert.Equal([luisteren.Id], (await RapportdoelenAsync(kijker)).Select(r => r.Id));
                Assert.NotEmpty(await KandidatenAsync(kijker));

                await VerwachtGeenWijzigingAsync(kijker, luisteren.Id, inhoud.Vertellen);
            }
        }
        finally
        {
            kijkers.ForEach(k => k.Dispose());
        }

        Assert.Equal(["Volledig bereikt", "Nog niet volledig"], (await GradatiesAsync(blauw)).Select(g => g.Label));
        var bewaard = (await RapportdoelenAsync(blauw)).Single();
        Assert.Equal("Luisteren", bewaard.Titel);
        Assert.Equal([inhoud.Luisteren], bewaard.Subdoelen.Select(s => s.Id));
    }

    [PostgresFact]
    public async Task Na_het_schooljaar_wijzigt_de_K3_leerkracht_de_set_niet_meer_maar_bekijkt_ze_nog()
    {
        var voorbij = new Schooljaar(TestSchooljaar.UniekeNaam("voorbij"), Vandaag.AddDays(-400), Vandaag.AddDays(-35));
        var klas = voorbij.VoegKlasToe($"K3v-{Guid.NewGuid():N}", "K3");
        await using (var context = _db.MaakContext())
        {
            context.Schooljaren.Add(voorbij);
            await context.SaveChangesAsync();
        }

        var school = await _opzet.SchoolAsync();
        var inhoud = await InhoudAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var luisteren = await MaakRapportdoelAsync(blauw, "Luisteren", inhoud.Luisteren);
        using var vorigJaar = _opzet.Als(await _opzet.GebruikerAsync(klassen: [klas.Id]));

        Assert.Equal(2, (await GradatiesAsync(vorigJaar)).Count);
        Assert.Single(await RapportdoelenAsync(vorigJaar));
        await VerwachtGeenWijzigingAsync(vorigJaar, luisteren.Id, inhoud.Vertellen);
    }

    [PostgresFact]
    public async Task Een_directeur_die_zelf_een_K3_klas_heeft_wijzigt_de_set_toch_niet()
    {
        // R31 as the owner read it on 2026-09-15 ("Nooit wie admin heeft"): not even with a running K3 klastoewijzing.
        var school = await _opzet.SchoolAsync();
        using var directeurMetKlas = _opzet.Als(await _opzet.GebruikerAsync(school, admin: true, klassen: [school.K3Blauw]));

        await RechtenTestOpzet.VerwachtAsync(
            directeurMetKlas.PostAsJsonAsync(Gradaties, new { label = "Bijna", kleur = "Geel" }), HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);
        Assert.Equal(2, (await GradatiesAsync(directeurMetKlas)).Count);
    }

    // --- The teacher's sentences (Art. II.3) and the 404s. ---

    [PostgresFact]
    public async Task Een_ontbrekend_of_ongeldig_veld_wordt_in_het_Nederlands_geweigerd()
    {
        var school = await _opzet.SchoolAsync();
        using var blauw = _opzet.Als(await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        var onbekend = Guid.NewGuid();

        // A star.
        await VerwachtAsync(blauw.PostAsJsonAsync(Gradaties, new { label = "", kleur = "Geel" }), "Vul een label in.");
        await VerwachtAsync(blauw.PostAsJsonAsync(Gradaties, new { kleur = "Geel" }), "Vul een label in.");
        await VerwachtAsync(blauw.PostAsJsonAsync(Gradaties, new { label = new string('a', 61), kleur = "Geel" }), "Een label is hoogstens 60 tekens lang.");
        await VerwachtAsync(blauw.PostAsJsonAsync(Gradaties, new { label = "Bijna" }), "Kies een kleur uit de lijst.");
        await VerwachtAsync(blauw.PostAsJsonAsync(Gradaties, new { label = "Bijna", kleur = "Paars" }), "Kies een kleur uit de lijst.");
        await VerwachtAsync(blauw.PostAsJsonAsync(Gradaties, new { label = "Bijna", kleur = "3" }), "Kies een kleur uit de lijst.");
        await VerwachtAsync(
            blauw.PutAsJsonAsync($"{Gradaties}/{VolledigBereikt}", new { label = " ", kleur = "Rood" }), "Vul een label in.");
        await RechtenTestOpzet.VerwachtAsync(
            blauw.PutAsJsonAsync($"{Gradaties}/{onbekend}", new { label = "Bijna", kleur = "Geel" }), HttpStatusCode.NotFound, "Deze gradatie is niet gevonden.");
        await RechtenTestOpzet.VerwachtAsync(blauw.DeleteAsync($"{Gradaties}/{onbekend}"), HttpStatusCode.NotFound, "Deze gradatie is niet gevonden.");

        // Sixty characters, and a colour in another case, are accepted. A refused rename changed nothing.
        var zestig = await MaakGradatieAsync(blauw, new string('a', 60), "geel");
        Assert.Equal("Geel", zestig.Kleur);
        Assert.Equal("Volledig bereikt", (await GradatiesAsync(blauw))[0].Label);

        // The order names every star once.
        const string OnvolledigeSchaal = "De volgorde moet elke gradatie één keer bevatten.";
        await VerwachtAsync(blauw.PutAsJsonAsync($"{Gradaties}/volgorde", new { ids = new[] { NogNietVolledig, VolledigBereikt } }), OnvolledigeSchaal);
        await VerwachtAsync(
            blauw.PutAsJsonAsync($"{Gradaties}/volgorde", new { ids = new[] { NogNietVolledig, VolledigBereikt, VolledigBereikt, zestig.Id } }), OnvolledigeSchaal);
        await VerwachtAsync(
            blauw.PutAsJsonAsync($"{Gradaties}/volgorde", new { ids = new[] { NogNietVolledig, VolledigBereikt, onbekend } }), OnvolledigeSchaal);
        await VerwachtAsync(blauw.PutAsJsonAsync($"{Gradaties}/volgorde", new { }), OnvolledigeSchaal);
        Assert.Equal([VolledigBereikt, NogNietVolledig, zestig.Id], (await GradatiesAsync(blauw)).Select(g => g.Id));

        // A rapportdoel.
        await VerwachtAsync(blauw.PostAsJsonAsync(Rapportdoelen, new { titel = " " }), "Vul een titel in.");
        await VerwachtAsync(blauw.PostAsJsonAsync(Rapportdoelen, new { subdoelIds = Array.Empty<Guid>() }), "Vul een titel in.");
        await VerwachtAsync(blauw.PostAsJsonAsync(Rapportdoelen, new { titel = new string('a', 121) }), "Een titel is hoogstens 120 tekens lang.");
        await RechtenTestOpzet.VerwachtAsync(
            blauw.PutAsJsonAsync($"{Rapportdoelen}/{onbekend}", new { titel = "Luisteren" }), HttpStatusCode.NotFound, "Dit rapportdoel is niet gevonden.");
        await RechtenTestOpzet.VerwachtAsync(blauw.DeleteAsync($"{Rapportdoelen}/{onbekend}"), HttpStatusCode.NotFound, "Dit rapportdoel is niet gevonden.");

        // A rapportdoel always holds a subdoel (owner, 2026-09-15), so the one that is 120 characters long gets one.
        var inhoud = await InhoudAsync();
        var luisteren = await MaakRapportdoelAsync(blauw, new string('a', 120), inhoud.Luisteren);
        await VerwachtAsync(
            blauw.PutAsJsonAsync($"{Rapportdoelen}/volgorde", new { ids = new[] { luisteren.Id, onbekend } }), "De volgorde moet elk rapportdoel één keer bevatten.");
    }

    // --- Helpers. ---

    /// <summary>
    /// Every write of FB-002 answers the authorisation's own 403 to <paramref name="client"/>, with real ids and valid
    /// bodies, so a pass cannot come from a 400 or a 404.
    /// </summary>
    private static async Task VerwachtGeenWijzigingAsync(HttpClient client, Guid rapportdoelId, Guid subdoelId)
    {
        await Verwacht403Async(client.PostAsJsonAsync(Gradaties, new { label = "Bijna", kleur = "Geel" }));
        await Verwacht403Async(client.PutAsJsonAsync($"{Gradaties}/{VolledigBereikt}", new { label = "Helemaal", kleur = "Groen" }));
        await Verwacht403Async(client.PutAsJsonAsync($"{Gradaties}/volgorde", new { ids = new[] { NogNietVolledig, VolledigBereikt } }));
        await Verwacht403Async(client.DeleteAsync($"{Gradaties}/{NogNietVolledig}"));
        await Verwacht403Async(client.PostAsJsonAsync(Rapportdoelen, new { titel = "Rekenen", subdoelIds = new[] { subdoelId } }));
        await Verwacht403Async(client.PutAsJsonAsync($"{Rapportdoelen}/{rapportdoelId}", new { titel = "Anders", subdoelIds = new[] { subdoelId } }));
        await Verwacht403Async(client.PutAsJsonAsync($"{Rapportdoelen}/volgorde", new { ids = new[] { rapportdoelId } }));
        await Verwacht403Async(client.DeleteAsync($"{Rapportdoelen}/{rapportdoelId}"));
    }

    private static Task Verwacht403Async(Task<HttpResponseMessage> verzoek) =>
        RechtenTestOpzet.VerwachtAsync(verzoek, HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);

    private static Task VerwachtAsync(Task<HttpResponseMessage> verzoek, string zin) =>
        RechtenTestOpzet.VerwachtAsync(verzoek, HttpStatusCode.BadRequest, zin);

    /// <summary>
    /// K3 content made the way a screen makes it, as admin: Water › Regen (K3) with RS-01 and RS-02, Herfst › Bladeren
    /// (K3) with RS-03, Water › Plassen (K2) with RS-04, all <c>Manueel</c>; and an undecided RS-04 under Regen, seeded
    /// directly because no route creates one.
    /// </summary>
    private async Task<Inhoud> InhoudAsync()
    {
        using var admin = _opzet.Admin();
        var water = await RechtenTestOpzet.IdAsync(admin.PostAsJsonAsync("/api/themas", new { naam = "Water", duurWeken = 4 }), HttpStatusCode.Created);
        var herfst = await RechtenTestOpzet.IdAsync(admin.PostAsJsonAsync("/api/themas", new { naam = "Herfst", duurWeken = 4 }), HttpStatusCode.Created);
        var regen = await SubthemaAsync(admin, water, "Regen", "K3");
        var plassen = await SubthemaAsync(admin, water, "Plassen", "K2");
        var bladeren = await SubthemaAsync(admin, herfst, "Bladeren", "K3");

        var luisteren = await SubdoelAsync(admin, regen, "RS-01");
        var vertellen = await SubdoelAsync(admin, regen, "RS-02");
        var tellen = await SubdoelAsync(admin, bladeren, "RS-03");
        var k2 = await SubdoelAsync(admin, plassen, "RS-04");

        await using var context = _db.MaakContext();
        var subthema = await context.Subthemas.Include(s => s.Subdoelen).SingleAsync(s => s.Id == regen);
        var voorgesteld = subthema.VoegSubdoelToe("K3", new DoelKoppeling("RS-04", KoppelingStatus.Voorgesteld, "Past bij het thema."));
        context.Subdoelen.Add(voorgesteld);
        await context.SaveChangesAsync();

        return new Inhoud(water, regen, bladeren, luisteren, vertellen, tellen, k2, voorgesteld.Id);
    }

    private static Task<Guid> SubthemaAsync(HttpClient admin, Guid themaId, string naam, string leeftijd) =>
        RechtenTestOpzet.IdAsync(
            admin.PostAsJsonAsync($"/api/themas/{themaId}/subthemas", new { naam, duurWeken = 2, leeftijd }), HttpStatusCode.Created);

    private static Task<Guid> SubdoelAsync(HttpClient admin, Guid subthemaId, string code) =>
        RechtenTestOpzet.IdAsync(
            admin.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", new { leerplandoelCode = code }), HttpStatusCode.OK);

    private async Task ZetStatusAsync(Guid subdoelId, KoppelingStatus status)
    {
        await using var context = _db.MaakContext();
        var subdoel = await context.Subdoelen.SingleAsync(sd => sd.Id == subdoelId);
        subdoel.Koppeling.WijzigStatus(status);
        await context.SaveChangesAsync();
    }

    private static async Task<GradatieDto> MaakGradatieAsync(HttpClient client, string label, string kleur)
    {
        using var antwoord = await client.PostAsJsonAsync(Gradaties, new { label, kleur });
        Assert.True(antwoord.StatusCode == HttpStatusCode.Created, $"Expected 201, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<GradatieDto>())!;
    }

    private static async Task<RapportdoelDto> MaakRapportdoelAsync(HttpClient client, string titel, params Guid[] subdoelIds)
    {
        using var antwoord = await client.PostAsJsonAsync(Rapportdoelen, new { titel, subdoelIds });
        Assert.True(antwoord.StatusCode == HttpStatusCode.Created, $"Expected 201, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<RapportdoelDto>())!;
    }

    private static async Task<List<GradatieDto>> GradatiesAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<GradatieDto>>(Gradaties))!;

    private static async Task<List<RapportdoelDto>> RapportdoelenAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<RapportdoelDto>>(Rapportdoelen))!;

    private static async Task<List<SubdoelDto>> KandidatenAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<List<SubdoelDto>>($"{Rapportdoelen}/kandidaten"))!;

    private sealed record Inhoud(
        Guid Water,
        Guid Regen,
        Guid Bladeren,
        Guid Luisteren,
        Guid Vertellen,
        Guid Tellen,
        Guid K2,
        Guid Voorgesteld);

    private sealed record GradatieDto(Guid Id, string Label, string Kleur, int Volgorde);

    private sealed record RapportdoelDto(Guid Id, string Titel, int Volgorde, List<SubdoelDto> Subdoelen);

    private sealed record SubdoelDto(
        Guid Id,
        string LeerplandoelCode,
        string LeerplandoelTekst,
        string Doelsoort,
        string ThemaNaam,
        string SubthemaNaam);
}
