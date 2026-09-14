using System.Net;
using System.Net.Http.Json;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The ADR-0030 §3 matrix, row by row, over HTTP against PostgreSQL (E6-02 slice 3, Art. VI.1). For each row, the
/// relation that is allowed gets through, and the nearest relation that is not gets 403: a hoofdleerkracht of K3 against
/// one of K2, a leerkracht of K3 blauw editing K3 content against editing K3 groen's planning, a maker with and without a
/// goal link, themabeheer on the ordinary subthema route.
/// <para>
/// <b>Why these exist beside the ~150 older tests.</b> Those run as the default directie identity, which every row
/// admits, so they prove that nothing broke for directie and nothing about denial (slice 1's audit). These use seeded
/// gebruikers holding exactly the relation under test. "Reaches the controller" is pinned by the status the service
/// then answers (201, 200, a 400 for a missing file, a 404 for an id that names nothing), never by "not 403" alone
/// where a precise answer exists.
/// </para>
/// <para>
/// The wizard's own write actions are in <see cref="WizardrunEndpointsTests"/>; the sweep that sends every write route
/// a gebruiker with no right at all is <see cref="ElkeWijzigendeRouteVraagtEenRechtTests"/>.
/// </para>
/// </summary>
public sealed class RechtenAfdwingingTests : IClassFixture<RechtenAfdwingingTests.Omgeving>
{
    private const string Doelcode = "AFDW-01";

    private readonly Omgeving _omgeving;

    public RechtenAfdwingingTests(Omgeving omgeving) => _omgeving = omgeving;

    private RechtenTestOpzet Opzet => new(_omgeving.Db, _omgeving.Factory);

    private static Task<HttpStatusCode> StatusAsync(Task<HttpResponseMessage> verzoek) => RechtenTestOpzet.StatusAsync(verzoek);

    // --- Gebruikers, klassen en schooljaren beheren (R2, R3, R16): directie only. ---

    [PostgresFact]
    public async Task Schooljaren_en_klassen_beheren_is_alleen_voor_directie()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        // Every other relation in one gebruiker: the union rule must not add up to a right no column grants.
        using var alles = opzet.Als(await opzet.GebruikerAsync(
            school, themabeheer: true, hoofdleerkrachtVan: ["K3"], klassen: [school.K3Blauw]));
        using var directie = opzet.Als(await opzet.GebruikerAsync(directie: true));
        var jaar = new { naam = TestSchooljaar.UniekeNaam("beheer"), start = "2027-09-01", eind = "2028-06-30" };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(alles.PostAsJsonAsync("/api/schooljaren", jaar)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(alles.PostAsJsonAsync(
            $"/api/schooljaren/{school.SchooljaarId}/klassen", new { naam = $"K1-{Guid.NewGuid():N}", jaarfase = "L1" })));
        // The klaskiezer's jaarfase field travels on this PUT, which makes it directie-only now.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(alles.PutAsJsonAsync(
            $"/api/klassen/{school.K3Blauw}", new { naam = "K3 blauw", jaarfase = "K2" })));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(alles.DeleteAsync($"/api/klassen/{school.K3Blauw}")));

        Assert.Equal(HttpStatusCode.Created, await StatusAsync(directie.PostAsJsonAsync("/api/schooljaren", jaar)));
    }

    // --- Thema, themadoelen, kernwoordenschat aanpassen (R4, R18): directie, themabeheer. ---

    [PostgresFact]
    public async Task Een_thema_en_zijn_themadoelen_zijn_van_themabeheer_niet_van_de_hoofdleerkracht()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var thema = new { naam = $"Thema {Guid.NewGuid():N}", duurWeken = 4 };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsJsonAsync("/api/themas", thema)));
        using var gemaakt = await themabeheer.PostAsJsonAsync("/api/themas", thema);
        Assert.Equal(HttpStatusCode.Created, gemaakt.StatusCode);
        var themaId = (await gemaakt.Content.ReadFromJsonAsync<RechtenTestOpzet.IdDto>())!.Id;

        var doel = new { leerplandoelCode = Doelcode };
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsJsonAsync($"/api/themas/{themaId}/themadoelen", doel)));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(themabeheer.PostAsJsonAsync($"/api/themas/{themaId}/themadoelen", doel)));

        var wijziging = new { naam = $"Hernoemd {Guid.NewGuid():N}", duurWeken = 5, kernwoordenschat = new[] { "regen" } };
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PutAsJsonAsync($"/api/themas/{themaId}", wijziging)));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(themabeheer.PutAsJsonAsync($"/api/themas/{themaId}", wijziging)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.DeleteAsync($"/api/themas/{themaId}")));
    }

    // --- The FR-1 import (R9, R27, R34), and its option to delete human decisions (R35): directie only. ---

    [PostgresFact]
    public async Task De_import_is_van_themabeheer_en_menselijke_beslissingen_verwijderen_van_directie()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var directie = opzet.Als(await opzet.GebruikerAsync(directie: true));

        // No file in any of these: a caller who reaches the controller is refused for that, with a 400.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsync("/api/schoolcontent-import/voorbeeld", Formulier(false))));
        Assert.Equal(HttpStatusCode.BadRequest, await StatusAsync(themabeheer.PostAsync("/api/schoolcontent-import/voorbeeld", Formulier(false))));
        Assert.Equal(HttpStatusCode.BadRequest, await StatusAsync(themabeheer.PostAsync("/api/schoolcontent-import", Formulier(false))));

        // R35, on the preview as well as on the apply.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(themabeheer.PostAsync("/api/schoolcontent-import/voorbeeld", Formulier(true))));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(themabeheer.PostAsync("/api/schoolcontent-import", Formulier(true))));
        Assert.Equal(HttpStatusCode.BadRequest, await StatusAsync(directie.PostAsync("/api/schoolcontent-import/voorbeeld", Formulier(true))));
        Assert.Equal(HttpStatusCode.BadRequest, await StatusAsync(directie.PostAsync("/api/schoolcontent-import", Formulier(true))));
    }

    // --- Doelsuggesties (R14) and the wizard's AI assist (R29): directie, themabeheer. ---

    [PostgresFact]
    public async Task Doelsuggesties_en_de_wizardhulp_zijn_van_themabeheer_niet_van_de_hoofdleerkracht()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var themaId = await opzet.ThemaAsync();
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var suggestie = Guid.NewGuid();
        var status = new { status = "Aanvaard" };
        var vervanging = new { leerplandoelCode = Doelcode };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsync($"/api/themas/{themaId}/doelsuggesties/genereer", null)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PutAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/{suggestie}/status", status)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PutAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/{suggestie}/leerplandoel", vervanging)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsJsonAsync("/api/thema-opbouw/themadoel-suggesties", new { })));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsJsonAsync("/api/thema-opbouw/subdoel-suggesties", new { })));

        // Themabeheer reaches the service, which answers for the suggestion that does not exist.
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(themabeheer.PutAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/{suggestie}/status", status)));
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(themabeheer.PutAsJsonAsync($"/api/themas/{themaId}/doelsuggesties/{suggestie}/leerplandoel", vervanging)));
    }

    // --- Subthema's van een jaar (R5, R21; I13, I16): directie, the hoofdleerkracht of that leeftijd. ---

    [PostgresFact]
    public async Task Een_subthema_maken_mag_de_hoofdleerkracht_van_die_leeftijd_en_niemand_anders()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var themaId = await opzet.ThemaAsync();
        using var hoofdleerkrachtK3 = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var hoofdleerkrachtK2 = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K2"]));
        using var leerkrachtK3 = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var subthema = new { naam = "Regen", duurWeken = 2, leeftijd = "K3" };
        var pad = $"/api/themas/{themaId}/subthemas";

        Assert.Equal(HttpStatusCode.Created, await StatusAsync(hoofdleerkrachtK3.PostAsJsonAsync(pad, subthema)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkrachtK2.PostAsJsonAsync(pad, subthema)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkrachtK3.PostAsJsonAsync(pad, subthema)));
        // I22: themabeheer has no right on the ordinary subthema route; the wizard has its own.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(themabeheer.PostAsJsonAsync(pad, subthema)));
    }

    [PostgresFact]
    public async Task Een_leeftijd_die_geen_leeftijd_is_krijgt_de_400_van_de_write_ook_zonder_recht()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var themaId = await opzet.ThemaAsync();
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var niemand = opzet.Als(await opzet.GebruikerAsync());
        var pad = $"/api/themas/{themaId}/subthemas";

        // Refused, with the write's own sentence, whoever asks: it neither reaches the write nor skips the check.
        foreach (var client in new[] { hoofdleerkracht, niemand })
        {
            using var antwoord = await client.PostAsJsonAsync(pad, new { naam = "Regen", duurWeken = 2, leeftijd = "L7" });
            Assert.Equal(HttpStatusCode.BadRequest, antwoord.StatusCode);
            Assert.Contains("'L7' is geen geldige leeftijd", await antwoord.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        }

        // A padded code is the same leeftijd to the rights check as to the write (Leeftijdsinhoud.UitInvoer trims).
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(hoofdleerkracht.PostAsJsonAsync(pad, new { naam = "Wind", duurWeken = 2, leeftijd = " K3 " })));
    }

    [PostgresFact]
    public async Task Een_subthema_naar_een_andere_leeftijd_verplaatsen_vraagt_het_recht_op_beide_leeftijden_I13()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var subthemaId = await opzet.SubthemaAsync("K3");
        using var alleenK3 = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        using var alleenK2 = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K2"]));
        using var beide = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3", "K2"]));
        var pad = $"/api/subthemas/{subthemaId}";
        object Naar(string leeftijd) => new { naam = "Regen", duurWeken = 2, leeftijd };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(alleenK3.PutAsJsonAsync(pad, Naar("K2"))));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(alleenK2.PutAsJsonAsync(pad, Naar("K2"))));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(alleenK3.PutAsJsonAsync(pad, Naar("K3"))));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(beide.PutAsJsonAsync(pad, Naar("K2"))));
    }

    [PostgresFact]
    public async Task Onderzoeksvragen_en_verwijderen_volgen_de_rij_van_het_subthema_I16()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var subthemaId = await opzet.SubthemaAsync("K3");
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var vraag = new { vraag = "Waarom regent het?" };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.PostAsJsonAsync($"/api/subthemas/{subthemaId}/onderzoeksvragen", vraag)));
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(hoofdleerkracht.PostAsJsonAsync($"/api/subthemas/{subthemaId}/onderzoeksvragen", vraag)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.DeleteAsync($"/api/subthemas/{subthemaId}")));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(hoofdleerkracht.DeleteAsync($"/api/subthemas/{subthemaId}")));
    }

    // --- Subdoelen (R24): directie, the hoofdleerkracht of that leeftijd. ---

    [PostgresFact]
    public async Task Subdoelen_zijn_van_de_hoofdleerkracht_niet_van_de_leerkracht_van_die_leeftijd()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var subthemaId = await opzet.SubthemaAsync("K3");
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var doel = new { leerplandoelCode = Doelcode };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", doel)));
        using var gekoppeld = await hoofdleerkracht.PostAsJsonAsync($"/api/subthemas/{subthemaId}/doelkoppelingen", doel);
        Assert.Equal(HttpStatusCode.OK, gekoppeld.StatusCode);
        var subdoelId = (await gekoppeld.Content.ReadFromJsonAsync<RechtenTestOpzet.IdDto>())!.Id;

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.DeleteAsync($"/api/subthemas/{subthemaId}/subdoelen/{subdoelId}")));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(hoofdleerkracht.DeleteAsync($"/api/subthemas/{subthemaId}/subdoelen/{subdoelId}")));
    }

    // --- Gedeelde activiteiten aanmaken en hun inhoud aanpassen (R17, R23; I15): directie, HL, LK leeftijd. ---

    [PostgresFact]
    public async Task Een_leerkracht_van_die_leeftijd_maakt_en_bewerkt_gedeelde_activiteiten_van_die_leeftijd()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var subthemaId = await opzet.SubthemaAsync("K3");
        var leerkrachtK3Id = await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);
        using var leerkrachtK3 = opzet.Als(leerkrachtK3Id);
        using var leerkrachtK2 = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K2Rood]));
        using var themabeheer = opzet.Als(await opzet.GebruikerAsync(themabeheer: true));
        var nieuw = new { naam = "Proef", activiteitType = "Experiment" };

        var activiteit = await opzet.ActiviteitAsync(subthemaId, leerkrachtK3);
        Assert.Equal(leerkrachtK3Id, activiteit.MakerId);
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkrachtK2.PostAsJsonAsync($"/api/subthemas/{subthemaId}/activiteiten", nieuw)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(themabeheer.PostAsJsonAsync($"/api/subthemas/{subthemaId}/activiteiten", nieuw)));

        var inhoud = new { naam = "Proef met ijs", activiteitType = "Experiment", hoek = "ontdektafel" };
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(leerkrachtK3.PutAsJsonAsync($"/api/activiteiten/{activiteit.Id}", inhoud)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkrachtK2.PutAsJsonAsync($"/api/activiteiten/{activiteit.Id}", inhoud)));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(leerkrachtK3.PutAsJsonAsync(
            $"/api/activiteiten/{activiteit.Id}/onderzoeksvraag", new { onderzoeksvraagId = (Guid?)null })));
    }

    [PostgresFact]
    public async Task Doelen_meegeven_bij_het_maken_van_een_activiteit_vraagt_het_koppelrecht_R19()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var subthemaId = await opzet.SubthemaAsync("K3");
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var pad = $"/api/subthemas/{subthemaId}/activiteiten";
        var metDoel = new { naam = "Proef", activiteitType = "Experiment", leerplandoelCodes = new[] { Doelcode } };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.PostAsJsonAsync(pad, metDoel)));
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(hoofdleerkracht.PostAsJsonAsync(pad, metDoel)));
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(leerkracht.PostAsJsonAsync(pad, new { naam = "Proef", activiteitType = "Experiment" })));
    }

    // --- Een activiteit verwijderen (R25, R26, R33): the maker while no goal is linked, the hoofdleerkracht always. ---

    [PostgresFact]
    public async Task De_maker_verwijdert_zijn_activiteit_zolang_er_geen_doel_aan_hangt()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var subthemaId = await opzet.SubthemaAsync("K3");
        using var maker = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var collega = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Groen]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var zonder = await opzet.ActiviteitAsync(subthemaId, maker);
        var met = await opzet.ActiviteitAsync(subthemaId, maker);
        await opzet.KoppelAsync(met.Id, Doelcode);

        // The same leeftijd is not enough: only the maker, or the hoofdleerkracht.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(collega.DeleteAsync($"/api/activiteiten/{zonder.Id}")));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(maker.DeleteAsync($"/api/activiteiten/{zonder.Id}")));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(maker.DeleteAsync($"/api/activiteiten/{met.Id}")));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(hoofdleerkracht.DeleteAsync($"/api/activiteiten/{met.Id}")));
    }

    // --- Doelen met de hand koppelen aan gedeelde activiteiten (R19): directie, HL. ---

    [PostgresFact]
    public async Task Doelen_koppelen_aan_een_gedeelde_activiteit_is_van_de_hoofdleerkracht()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var activiteit = await opzet.ActiviteitAsync(await opzet.SubthemaAsync("K3"));
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var doel = new { leerplandoelCode = Doelcode };

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.PostAsJsonAsync($"/api/activiteiten/{activiteit.Id}/doelkoppelingen", doel)));
        using var gekoppeld = await hoofdleerkracht.PostAsJsonAsync($"/api/activiteiten/{activiteit.Id}/doelkoppelingen", doel);
        Assert.Equal(HttpStatusCode.OK, gekoppeld.StatusCode);
        var koppelingId = (await gekoppeld.Content.ReadFromJsonAsync<RechtenTestOpzet.IdDto>())!.Id;

        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.DeleteAsync($"/api/activiteiten/{activiteit.Id}/doelkoppelingen/{koppelingId}")));
        Assert.Equal(HttpStatusCode.NoContent, await StatusAsync(hoofdleerkracht.DeleteAsync($"/api/activiteiten/{activiteit.Id}/doelkoppelingen/{koppelingId}")));
    }

    // --- Een activiteit naar een ander thema verplaatsen (R19, R23; I19). ---

    [PostgresFact]
    public async Task Verplaatsen_mag_een_leerkracht_zonder_koppelingen_en_met_koppelingen_alleen_de_hoofdleerkracht()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var bron = await opzet.SubthemaAsync("K3");
        var doel = await opzet.SubthemaAsync("K3");
        var zonder = await opzet.ActiviteitAsync(bron);
        var met = await opzet.ActiviteitAsync(bron);
        await opzet.KoppelAsync(met.Id, Doelcode);
        using var leerkracht = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var naar = new { doelSubthemaId = doel };

        Assert.Equal(HttpStatusCode.OK, await StatusAsync(leerkracht.PutAsJsonAsync($"/api/activiteiten/{zonder.Id}/subthema", naar)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(leerkracht.PutAsJsonAsync($"/api/activiteiten/{met.Id}/subthema", naar)));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(hoofdleerkracht.PutAsJsonAsync($"/api/activiteiten/{met.Id}/subthema", naar)));
    }

    // --- Jaarplan bewerken, (her)genereren, agenda, hoeken, algemene fiches (R7, R15; I21): directie, LK eigen. ---

    [PostgresFact]
    public async Task De_leerkracht_van_K3_blauw_bewerkt_K3_inhoud_en_de_planning_van_blauw_maar_niet_die_van_groen()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        var activiteit = await opzet.ActiviteitAsync(await opzet.SubthemaAsync("K3"));
        using var blauw = opzet.Als(await opzet.GebruikerAsync(school, klassen: [school.K3Blauw]));
        using var hoofdleerkracht = opzet.Als(await opzet.GebruikerAsync(school, hoofdleerkrachtVan: ["K3"]));
        var hoek = new { naam = $"bouwhoek {Guid.NewGuid():N}" };

        // Shared K3 content: every leerkracht of K3 (R17).
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(blauw.PutAsJsonAsync(
            $"/api/activiteiten/{activiteit.Id}", new { naam = "Proef met ijs", activiteitType = "Experiment" })));

        // Its own klas's planning: yes. The parallel klas's planning: no, although both are K3.
        Assert.Equal(HttpStatusCode.Created, await StatusAsync(blauw.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/hoeken", hoek)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(blauw.PostAsJsonAsync($"/api/klassen/{school.K3Groen}/hoeken", hoek)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(blauw.PostAsJsonAsync($"/api/klassen/{school.K3Groen}/algemene-fiches", new { naam = "Turnen" })));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(blauw.PostAsync($"/api/klassen/{school.K3Groen}/jaarplan/generatie", null)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(blauw.DeleteAsync($"/api/klassen/{school.K3Groen}/jaarplan/plaatsingen/{Guid.NewGuid()}")));
        // Its own plan reaches the service, which says the klas has no plan yet.
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(blauw.DeleteAsync($"/api/klassen/{school.K3Blauw}/jaarplan/plaatsingen/{Guid.NewGuid()}")));

        // A route keyed on the hoek alone is checked against the hoek's own klas.
        using var directie = opzet.Directie();
        using var gemaakt = await directie.PostAsJsonAsync($"/api/klassen/{school.K3Groen}/hoeken", hoek);
        var groenHoek = (await gemaakt.Content.ReadFromJsonAsync<RechtenTestOpzet.IdDto>())!.Id;
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(blauw.PutAsJsonAsync($"/api/hoeken/{groenHoek}", hoek)));
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(blauw.DeleteAsync($"/api/hoeken/{groenHoek}")));

        // A hoofdleerkracht of K3 teaches no klas by being one (I20), so it plans none.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(hoofdleerkracht.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/hoeken", hoek)));
    }

    // --- 404 before 403 for a resource row; 403 first for a resource-free row. ---

    [PostgresFact]
    public async Task Een_bron_die_niet_bestaat_is_404_ook_voor_wie_geen_recht_heeft()
    {
        var opzet = Opzet;
        using var niemand = opzet.Als(await opzet.GebruikerAsync());

        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(niemand.PostAsJsonAsync($"/api/klassen/{Guid.NewGuid()}/hoeken", new { naam = "x" })));
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(niemand.PutAsJsonAsync($"/api/activiteiten/{Guid.NewGuid()}", new { })));
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(niemand.DeleteAsync($"/api/subthemas/{Guid.NewGuid()}")));
        Assert.Equal(HttpStatusCode.NotFound, await StatusAsync(niemand.DeleteAsync($"/api/hoekplaatsingen/{Guid.NewGuid()}")));
        // The thema row's answer does not depend on the thema, so it is given before anything is looked up.
        Assert.Equal(HttpStatusCode.Forbidden, await StatusAsync(niemand.DeleteAsync($"/api/themas/{Guid.NewGuid()}")));
    }

    // --- Jaarplan, agenda en dekking bekijken (R3, R7; I9): every signed-in gebruiker reads every klas. ---

    [PostgresFact]
    public async Task Lezen_mag_elke_gebruiker_ook_de_planning_van_een_andere_klas_I9()
    {
        var opzet = Opzet;
        var school = await opzet.SchoolAsync();
        using var niemand = opzet.Als(await opzet.GebruikerAsync());

        Assert.Equal(HttpStatusCode.OK, await StatusAsync(niemand.GetAsync($"/api/klassen/{school.K3Groen}/jaarplan")));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(niemand.GetAsync($"/api/klassen/{school.K3Groen}/dekking")));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(niemand.GetAsync($"/api/klassen/{school.K3Groen}/hoeken")));
        Assert.Equal(HttpStatusCode.OK, await StatusAsync(niemand.GetAsync("/api/themas")));
    }

    private static MultipartFormDataContent Formulier(bool menselijkeBeslissingenVerwijderen) =>
        new() { { new StringContent(menselijkeBeslissingenVerwijderen ? "true" : "false"), "menselijkeBeslissingenVerwijderen" } };

    /// <summary>One database for the class: every test seeds its own school, gebruikers and content, uniquely named.</summary>
    public sealed class Omgeving : IAsyncLifetime
    {
        public PostgresTestDatabase Db { get; private set; } = null!;

        public PostgresApiFactory Factory { get; private set; } = null!;

        public async Task InitializeAsync()
        {
            if (!PostgresTestDatabase.IsBeschikbaar)
            {
                return;
            }

            Db = await PostgresTestDatabase.MaakAsync("afdwinging");
            Factory = new PostgresApiFactory(Db.ConnectionString);
            await RechtenTestOpzet.ZaaiDoelAsync(Db, Doelcode);
        }

        public async Task DisposeAsync()
        {
            if (Factory is not null)
            {
                await Factory.DisposeAsync();
            }

            if (Db is not null)
            {
                await Db.DisposeAsync();
            }
        }
    }
}
