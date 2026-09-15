using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Testhulp;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// The kindtekening per report over the real API and PostgreSQL (FB-005, R10, FR-13.5, ADR-0035 §3.6, D15):
/// <list type="bullet">
/// <item>one drawing per report, on that report only, and a second one replaces the first (AC1);</item>
/// <item>what is stored and served carries none of the upload's metadata (AC2);</item>
/// <item>anything but a JPEG or a PNG, and anything over the size or pixel limit, is refused in Dutch, naming the limit
/// (AC3);</item>
/// <item>the image is served only to who may read the report, never to a leerkracht of another klas or a browser with
/// no session (AC4);</item>
/// <item>deleting works, and after the schooljaar the leerkracht still sees it but changes nothing (AC5); it goes with
/// its child (D8).</item>
/// </list>
/// <b>Every name here is made up, and every image is a flat two-colour test picture</b> (Art. VI.7).
/// </summary>
public sealed class KindtekeningEndpointsTests : IAsyncLifetime
{
    private const string GeenTekening = "Er is geen tekening bij dit rapport.";
    private const string GeenJpegOfPng =
        "Dit bestand kon niet gelezen worden als JPEG of PNG. Kies een foto of scan als JPEG- of PNG-bestand.";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;
    private RechtenTestOpzet _opzet = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("tekeningen");
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

    // --- One per report, replaced by the next (AC1), with no metadata (AC2). ---

    [PostgresFact]
    public async Task De_leerkracht_voegt_een_tekening_toe_zonder_metagegevens_en_alleen_bij_dat_rapport()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        var bewaard = await BewaarAsync(lk, o.Kind, 1, Testbeelden.JpegMetMetagegevens(40, 20, orientatie: 6), "IMG_0001.jpg", "image/jpeg");
        Assert.Equal((20, 40), (bewaard.Breedte, bewaard.Hoogte));

        using (var antwoord = await lk.GetAsync(Tekening(o.Kind, 1)))
        {
            Assert.Equal(HttpStatusCode.OK, antwoord.StatusCode);
            Assert.Equal("image/jpeg", antwoord.Content.Headers.ContentType?.MediaType);
            Assert.True(antwoord.Headers.CacheControl?.NoStore, "A drawing is pupil data: no cache may keep it.");
            Assert.Equal(["nosniff"], antwoord.Headers.GetValues("X-Content-Type-Options"));
            Assert.Null(antwoord.Content.Headers.ContentDisposition);

            var beeld = await antwoord.Content.ReadAsByteArrayAsync();
            Assert.DoesNotContain(Testbeelden.JpegMarkers(beeld), m => m is >= 0xE1 and <= 0xEF or 0xFE);
            foreach (var spoor in new[] { "Exif", Testbeelden.Camera, Testbeelden.Plaats, "IMG_0001" })
            {
                Assert.False(Testbeelden.Bevat(beeld, spoor), $"The served drawing still carries '{spoor}'.");
            }
        }

        // The report shows which drawing it has; Rapport 2 has none.
        Assert.Equal(bewaard.Versie, (await LeesRapportAsync(lk, o.Kind, 1)).Tekening?.Versie);
        Assert.Null((await LeesRapportAsync(lk, o.Kind, 2)).Tekening);
        await RechtenTestOpzet.VerwachtAsync(lk.GetAsync(Tekening(o.Kind, 2)), HttpStatusCode.NotFound, GeenTekening);

        // What the database holds is the re-encoded image, and nothing names the upload.
        await using var context = _db.MaakContext();
        var opgeslagen = await context.Kindtekeningen.SingleAsync();
        Assert.False(Testbeelden.Bevat(opgeslagen.Inhoud, "Exif"));
        Assert.False(Testbeelden.Bevat(opgeslagen.Inhoud, Testbeelden.Camera));
    }

    [PostgresFact]
    public async Task Een_tweede_tekening_vervangt_de_eerste()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        var eerste = await BewaarAsync(lk, o.Kind, 1, Testbeelden.Jpeg(), "eerste.jpg", "image/jpeg");
        var tweede = await BewaarAsync(lk, o.Kind, 1, Testbeelden.PngMetMetagegevens(30, 60), "tweede.png", "image/png");

        Assert.NotEqual(eerste.Versie, tweede.Versie);
        Assert.Equal((30, 60), (tweede.Breedte, tweede.Hoogte));
        Assert.Equal(tweede.Versie, (await LeesRapportAsync(lk, o.Kind, 1)).Tekening?.Versie);

        using var antwoord = await lk.GetAsync(Tekening(o.Kind, 1));
        Assert.Equal("image/png", antwoord.Content.Headers.ContentType?.MediaType);
        Assert.False(Testbeelden.Bevat(await antwoord.Content.ReadAsByteArrayAsync(), Testbeelden.Plaats));

        await using var context = _db.MaakContext();
        Assert.Equal(1, await context.Kindtekeningen.CountAsync());
        Assert.Equal(1, await context.Ontwikkelingsrapporten.CountAsync());
    }

    [PostgresFact]
    public async Task Een_tekening_en_een_tekst_bij_een_nieuw_rapport_komen_in_hetzelfde_rapport()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        using (var besluit = await lk.PutAsJsonAsync($"{Rapport(o.Kind, 3)}/besluit", new { tekst = "Een fijne periode." }))
        {
            Assert.Equal(HttpStatusCode.OK, besluit.StatusCode);
        }

        await BewaarAsync(lk, o.Kind, 3, Testbeelden.Jpeg(), "tekening.jpg", "image/jpeg");

        var rapport = await LeesRapportAsync(lk, o.Kind, 3);
        Assert.Equal("Een fijne periode.", rapport.Besluit);
        Assert.NotNull(rapport.Tekening);
        await using var context = _db.MaakContext();
        Assert.Equal(1, await context.Ontwikkelingsrapporten.CountAsync());
    }

    // --- Refusals, in Dutch, naming the limit, and nothing stored (AC3). ---

    [PostgresFact]
    public async Task Geen_JPEG_of_PNG_of_te_groot_wordt_geweigerd_met_de_grens_en_er_wordt_niets_bewaard()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        await RechtenTestOpzet.VerwachtAsync(Upload(lk, o.Kind, 1, Testbeelden.Pdf(), "brief.pdf", "application/pdf"), HttpStatusCode.BadRequest, GeenJpegOfPng);
        await RechtenTestOpzet.VerwachtAsync(Upload(lk, o.Kind, 1, Testbeelden.Webp(), "foto.webp", "image/webp"), HttpStatusCode.BadRequest, GeenJpegOfPng);

        // A PDF named and typed as a JPEG is still no JPEG: the content decides, not the name.
        await RechtenTestOpzet.VerwachtAsync(Upload(lk, o.Kind, 1, Testbeelden.Pdf(), "tekening.jpg", "image/jpeg"), HttpStatusCode.BadRequest, GeenJpegOfPng);

        await RechtenTestOpzet.VerwachtAsync(
            Upload(lk, o.Kind, 1, Testbeelden.PngMetKop(8000, 6000), "groot.png", "image/png"),
            HttpStatusCode.BadRequest,
            "Deze foto heeft meer dan 40 miljoen pixels. Kies een foto met een lagere resolutie.");

        await RechtenTestOpzet.VerwachtAsync(
            Upload(lk, o.Kind, 1, new byte[(20 * 1024 * 1024) + 1], "zwaar.jpg", "image/jpeg"),
            HttpStatusCode.BadRequest,
            "Dit bestand is groter dan 20 MB. Kies een kleinere foto of scan.");

        await RechtenTestOpzet.VerwachtAsync(
            Upload(lk, o.Kind, 1, [], "leeg.jpg", "image/jpeg"),
            HttpStatusCode.BadRequest,
            "Er is geen bestand meegestuurd. Kies een foto of scan van de tekening.");

        // Far over the limit. Kestrel stops reading at the route's request limit and answers 413, which the screen puts in
        // the same words (RapportScherm.test.tsx). The test host does not enforce Kestrel's limit, so here the request
        // reaches the service, which must still refuse it in Dutch, naming the limit.
        await RechtenTestOpzet.VerwachtAsync(
            Upload(lk, o.Kind, 1, new byte[23 * 1024 * 1024], "enorm.jpg", "image/jpeg"),
            HttpStatusCode.BadRequest,
            "Dit bestand is groter dan 20 MB. Kies een kleinere foto of scan.");

        await using var context = _db.MaakContext();
        Assert.Equal(0, await context.Kindtekeningen.CountAsync());
        Assert.Equal(0, await context.Ontwikkelingsrapporten.CountAsync());
    }

    // --- Who (AC4, AC5; R16, R17, R26). ---

    [PostgresFact]
    public async Task Niemand_buiten_de_klas_ziet_of_wijzigt_de_tekening_ook_niet_via_het_adres()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, Testbeelden.Jpeg(), "tekening.jpg", "image/jpeg");

        using var groen = _opzet.Als(await _opzet.GebruikerAsync(o.School, klassen: [o.School.K3Groen]));
        using var rood = _opzet.Als(await _opzet.GebruikerAsync(o.School, klassen: [o.School.K2Rood]));
        using var hlEnTb = _opzet.Als(await _opzet.GebruikerAsync(o.School, themabeheer: true, hoofdleerkrachtVan: ["K3"]));
        using var niemand = _opzet.Als(await _opzet.GebruikerAsync());

        foreach (var client in new[] { groen, rood, hlEnTb, niemand })
        {
            await Verwacht403Async(client.GetAsync(Tekening(o.Kind, 1)));
            await Verwacht403Async(Upload(client, o.Kind, 1, Testbeelden.Png(), "andere.png", "image/png"));
            await Verwacht403Async(client.DeleteAsync(Tekening(o.Kind, 1)));
        }

        // A window where nobody is signed in gets no image either.
        using var anoniem = _factory.MaakAnoniemeClient();
        Assert.Equal(HttpStatusCode.Unauthorized, await RechtenTestOpzet.StatusAsync(anoniem.GetAsync(Tekening(o.Kind, 1))));

        // Still the leerkracht's own drawing, and directie sees and replaces it.
        using var directie = _opzet.Directie();
        using (var gezien = await directie.GetAsync(Tekening(o.Kind, 1)))
        {
            Assert.Equal("image/jpeg", gezien.Content.Headers.ContentType?.MediaType);
        }

        await BewaarAsync(directie, o.Kind, 1, Testbeelden.Png(), "directie.png", "image/png");
        using var nu = await lk.GetAsync(Tekening(o.Kind, 1));
        Assert.Equal("image/png", nu.Content.Headers.ContentType?.MediaType);
    }

    [PostgresFact]
    public async Task Na_het_schooljaar_ziet_de_leerkracht_de_tekening_nog_maar_vervangt_of_verwijdert_ze_niet()
    {
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
        await BewaarAsync(directie, staf, 2, Testbeelden.Jpeg(), "tekening.jpg", "image/jpeg");

        using var lk = _opzet.Als(await _opzet.GebruikerAsync(klassen: [klas.Id]));
        using (var gezien = await lk.GetAsync(Tekening(staf, 2)))
        {
            Assert.Equal(HttpStatusCode.OK, gezien.StatusCode);
        }

        Assert.NotNull((await LeesRapportAsync(lk, staf, 2)).Tekening);
        await Verwacht403Async(Upload(lk, staf, 2, Testbeelden.Png(), "nieuw.png", "image/png"));
        await Verwacht403Async(lk.DeleteAsync(Tekening(staf, 2)));

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(directie.DeleteAsync(Tekening(staf, 2))));
        Assert.Null((await LeesRapportAsync(lk, staf, 2)).Tekening);
    }

    // --- Deleting (AC5), and with the child (D8). ---

    [PostgresFact]
    public async Task Een_verwijderde_tekening_is_weg_uit_het_rapport()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, Testbeelden.Jpeg(), "tekening.jpg", "image/jpeg");

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync(Tekening(o.Kind, 1))));

        Assert.Null((await LeesRapportAsync(lk, o.Kind, 1)).Tekening);
        await RechtenTestOpzet.VerwachtAsync(lk.GetAsync(Tekening(o.Kind, 1)), HttpStatusCode.NotFound, GeenTekening);

        // Deleting what is not there is no fault.
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync(Tekening(o.Kind, 1))));
        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync(Tekening(o.Kind, 2))));
    }

    [PostgresFact]
    public async Task Een_kind_verwijderen_verwijdert_ook_zijn_tekeningen()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);
        await BewaarAsync(lk, o.Kind, 1, Testbeelden.Jpeg(), "een.jpg", "image/jpeg");
        await BewaarAsync(lk, o.Kind, 2, Testbeelden.Png(), "twee.png", "image/png");

        Assert.Equal(HttpStatusCode.NoContent, await RechtenTestOpzet.StatusAsync(lk.DeleteAsync($"/api/leerlingen/{o.Kind}")));

        await using var context = _db.MaakContext();
        Assert.Equal(0, await context.Kindtekeningen.CountAsync());
        Assert.Equal(HttpStatusCode.NotFound, await RechtenTestOpzet.StatusAsync(lk.GetAsync(Tekening(o.Kind, 1))));
    }

    [PostgresFact]
    public async Task Een_onbekend_kind_of_moment_heeft_geen_tekening()
    {
        var o = await OpzetAsync();
        using var lk = _opzet.Als(o.LeerkrachtId);

        await RechtenTestOpzet.VerwachtAsync(lk.GetAsync(Tekening(Guid.NewGuid(), 1)), HttpStatusCode.NotFound, "Dit kind is niet gevonden.");
        Assert.Equal(HttpStatusCode.NotFound, await RechtenTestOpzet.StatusAsync(lk.GetAsync(Tekening(o.Kind, 4))));
        Assert.Equal(HttpStatusCode.NotFound, await RechtenTestOpzet.StatusAsync(Upload(lk, o.Kind, 0, Testbeelden.Jpeg(), "t.jpg", "image/jpeg")));
    }

    // --- Setup and helpers. ---

    /// <summary>A running school with a K3 leerkracht of K3 blauw and the made-up child Fien Proefmans in K3 blauw.</summary>
    private async Task<Opzet> OpzetAsync()
    {
        var school = await _opzet.SchoolAsync();
        var leerkrachtId = await _opzet.GebruikerAsync(school, klassen: [school.K3Blauw]);

        using var directie = _opzet.Directie();
        var kind = await RechtenTestOpzet.IdAsync(
            directie.PostAsJsonAsync($"/api/klassen/{school.K3Blauw}/leerlingen", new { voornaam = "Fien", achternaam = "Proefmans" }), HttpStatusCode.Created);

        return new Opzet(school, leerkrachtId, kind);
    }

    private static string Rapport(Guid leerlingId, int moment) => $"/api/leerlingen/{leerlingId}/rapporten/{moment}";

    private static string Tekening(Guid leerlingId, int moment) => $"{Rapport(leerlingId, moment)}/tekening";

    private static Task<HttpResponseMessage> Upload(HttpClient client, Guid leerlingId, int moment, byte[] bestand, string naam, string type)
    {
        var inhoud = new ByteArrayContent(bestand);
        inhoud.Headers.ContentType = new MediaTypeHeaderValue(type);
        var formulier = new MultipartFormDataContent { { inhoud, "bestand", naam } };
        return client.PutAsync(Tekening(leerlingId, moment), formulier);
    }

    private static async Task<TekeningDto> BewaarAsync(HttpClient client, Guid leerlingId, int moment, byte[] bestand, string naam, string type)
    {
        using var antwoord = await Upload(client, leerlingId, moment, bestand, naam, type);
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<TekeningDto>())!;
    }

    private static async Task<RapportDto> LeesRapportAsync(HttpClient client, Guid leerlingId, int moment)
    {
        using var antwoord = await client.GetAsync(Rapport(leerlingId, moment));
        Assert.True(antwoord.StatusCode == HttpStatusCode.OK, $"Expected 200, got {(int)antwoord.StatusCode}: {await antwoord.Content.ReadAsStringAsync()}");
        return (await antwoord.Content.ReadFromJsonAsync<RapportDto>())!;
    }

    private static Task Verwacht403Async(Task<HttpResponseMessage> verzoek) =>
        RechtenTestOpzet.VerwachtAsync(verzoek, HttpStatusCode.Forbidden, RechtenTestOpzet.GeenToegang);

    private sealed record Opzet(RechtenTestOpzet.School School, Guid LeerkrachtId, Guid Kind);

    private sealed record RapportDto(Guid LeerlingId, int Moment, string? Besluit, TekeningDto? Tekening);

    private sealed record TekeningDto(Guid Versie, int Breedte, int Hoogte);
}
