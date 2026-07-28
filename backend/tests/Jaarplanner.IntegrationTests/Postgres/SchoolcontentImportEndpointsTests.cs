using System.Net;
using System.Net.Http.Json;
using ClosedXML.Excel;
using Jaarplanner.Infrastructure.SchoolcontentImport;

namespace Jaarplanner.IntegrationTests.Postgres;

/// <summary>
/// Drives the school-content Excel import over HTTP against real PostgreSQL — E1-07's actual acceptance
/// criteria ("upload .xlsx; validate; clear per-row error messages; invalid rows reported precisely,
/// valid file proceeds"), which had no endpoint to exercise until now.
/// </summary>
public sealed class SchoolcontentImportEndpointsTests : IAsyncLifetime
{
    private const string KlasNaam = "L1 — eerste leerjaar";

    private PostgresTestDatabase _db = null!;
    private PostgresApiFactory _factory = null!;

    public async Task InitializeAsync()
    {
        if (!PostgresTestDatabase.IsBeschikbaar)
        {
            return;
        }

        _db = await PostgresTestDatabase.MaakAsync("import");
        _factory = new PostgresApiFactory(_db.ConnectionString);

        // The import resolves subthema's klas BY NAME, so the class must exist first — created through
        // the API the same way a school would.
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/klassen", new { naam = KlasNaam, leerjaar = 1 });
        response.EnsureSuccessStatusCode();
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        if (_db is not null)
        {
            await _db.DisposeAsync();
        }
    }

    [PostgresFact]
    public async Task Sjabloon_is_downloadbaar_als_xlsx()
    {
        var response = await _factory.CreateClient().GetAsync("/api/schoolcontent-import/sjabloon");

        response.EnsureSuccessStatusCode();
        Assert.Equal(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            response.Content.Headers.ContentType?.MediaType);
        Assert.NotEmpty(await response.Content.ReadAsByteArrayAsync());
    }

    /// <summary>A preview reports what would change and writes nothing (FR-1.3).</summary>
    [PostgresFact]
    public async Task Voorbeeld_wijzigt_niets()
    {
        var client = _factory.CreateClient();

        var antwoord = await Upload(client, "voorbeeld", Werkboek(("Herfst", "Bladeren", KlasNaam)));

        Assert.True(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.True(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.False(antwoord.GetProperty("toegepast").GetBoolean());

        // Nothing persisted.
        var themas = await client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/themas");
        Assert.Empty(themas!);
    }

    /// <summary>A valid file proceeds and lands the hierarchy (FR-1.1/1.4).</summary>
    [PostgresFact]
    public async Task Geldig_bestand_wordt_geimporteerd()
    {
        var client = _factory.CreateClient();

        var antwoord = await Upload(client, string.Empty, Werkboek(("Herfst", "Bladeren", KlasNaam)));

        Assert.True(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.True(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.True(antwoord.GetProperty("toegepast").GetBoolean());

        var themas = await client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/themas");
        Assert.Single(themas!);
        Assert.Equal("Herfst", themas![0].GetProperty("naam").GetString());
    }

    /// <summary>
    /// A row missing its required klas is reported with its row number and the offending column, while
    /// the valid row still imports — "report, never silently drop" (ADR-0006 §4, FR-1.2).
    /// </summary>
    [PostgresFact]
    public async Task Ongeldige_rij_wordt_precies_gerapporteerd_en_geldige_rij_gaat_door()
    {
        var client = _factory.CreateClient();

        var werkboek = Werkboek(
            ("Herfst", "Bladeren", KlasNaam),
            ("Winter", "Sneeuw", null)); // row 3: no klas

        var antwoord = await Upload(client, string.Empty, werkboek);

        Assert.False(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.False(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());

        var problemen = antwoord.GetProperty("problemen").EnumerateArray().ToList();
        var probleem = Assert.Single(problemen);
        Assert.Equal(3, probleem.GetProperty("rijNummer").GetInt32());
        Assert.Contains("Klas", probleem.GetProperty("melding").GetString()!);

        // The good row still landed.
        var themas = await client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/themas");
        Assert.Single(themas!);
        Assert.Equal("Herfst", themas![0].GetProperty("naam").GetString());
    }

    /// <summary>
    /// The two flags are not the same question, and this is the case that separates them: a file that
    /// parses perfectly but still loses content during the import. The klas cell is filled, so the parser
    /// has nothing to complain about (<c>isBestandGeldig</c> stays true), yet the named klas does not
    /// exist, so the subthema is skipped and reported as an opmerking — <c>isVolledigVerwerkt</c> must be
    /// false. Collapsing these into one flag is exactly what E1-07's audit rejected (finding 3): a UI
    /// trusting a single "geldig" would have told the teacher the file was fine while content vanished.
    /// </summary>
    [PostgresFact]
    public async Task Geldig_bestand_dat_inhoud_laat_vallen_is_niet_volledig_verwerkt()
    {
        var client = _factory.CreateClient();

        var antwoord = await Upload(
            client,
            string.Empty,
            Werkboek(("Herfst", "Bladeren", "L6 — bestaat niet")));

        Assert.True(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.False(antwoord.GetProperty("isVolledigVerwerkt").GetBoolean());
        Assert.Empty(antwoord.GetProperty("problemen").EnumerateArray());

        // The reason the content was dropped is stated, not silent (ADR-0006 §4).
        var opmerkingen = antwoord.GetProperty("diff").GetProperty("opmerkingen")
            .EnumerateArray().Select(o => o.GetString()!).ToList();
        Assert.Contains(opmerkingen, o => o.Contains("L6 — bestaat niet", StringComparison.Ordinal));

        // Observe the *drop*, not merely the report. Asserting the opmerking alone would stay green if a
        // future change quietly resolved the unknown klas to a fallback (or created it) while still
        // reporting — and the story text would then credit an assertion that does not exist.
        // Note the asymmetry this pins: the thema is school-scoped and lands, while the klas-bound
        // subthema does not (Art. IX.2). The thema is added before the subthema pass runs.
        var themas = await client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/themas");
        var thema = Assert.Single(themas!);
        Assert.Equal("Herfst", thema.GetProperty("naam").GetString());
        Assert.Empty(thema.GetProperty("subthemas").EnumerateArray());
    }

    /// <summary>A reordered header is refused wholesale — a shifted layout cannot be read safely.</summary>
    [PostgresFact]
    public async Task Verwisselde_koprij_importeert_niets()
    {
        var client = _factory.CreateClient();

        var antwoord = await Upload(
            client,
            string.Empty,
            Werkboek(new[] { ("Herfst", "Bladeren", (string?)KlasNaam) },
                verwissel: (SchoolcontentKolom.ThemaNaam, SchoolcontentKolom.SubthemaNaam)));

        Assert.False(antwoord.GetProperty("isBestandGeldig").GetBoolean());
        Assert.Contains(
            "kolomindeling",
            antwoord.GetProperty("problemen").EnumerateArray().First().GetProperty("melding").GetString()!,
            StringComparison.OrdinalIgnoreCase);

        var themas = await client.GetFromJsonAsync<List<System.Text.Json.JsonElement>>("/api/themas");
        Assert.Empty(themas!);
    }

    [PostgresFact]
    public async Task Niet_xlsx_bestand_geeft_400()
    {
        using var inhoud = new MultipartFormDataContent();
        var bestand = new ByteArrayContent([1, 2, 3]);
        inhoud.Add(bestand, "bestand", "themas.csv");

        var response = await _factory.CreateClient().PostAsync("/api/schoolcontent-import", inhoud);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static async Task<System.Text.Json.JsonElement> Upload(
        HttpClient client,
        string pad,
        byte[] werkboek)
    {
        using var inhoud = new MultipartFormDataContent();
        var bestand = new ByteArrayContent(werkboek);
        bestand.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        inhoud.Add(bestand, "bestand", "themas.xlsx");

        var url = string.IsNullOrEmpty(pad) ? "/api/schoolcontent-import" : $"/api/schoolcontent-import/{pad}";
        var response = await client.PostAsync(url, inhoud);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    }

    private static byte[] Werkboek(params (string Thema, string Subthema, string? Klas)[] rijen) =>
        Werkboek(rijen, verwissel: null);

    /// <summary>
    /// Builds a school-content workbook through the single-source column mapping, optionally swapping two
    /// header labels to simulate a reordered template.
    /// </summary>
    private static byte[] Werkboek(
        IReadOnlyList<(string Thema, string Subthema, string? Klas)> rijen,
        (SchoolcontentKolom A, SchoolcontentKolom B)? verwissel)
    {
        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet("Schoolcontent");

        foreach (SchoolcontentKolom kolom in Enum.GetValues<SchoolcontentKolom>())
        {
            var label = verwissel is null
                ? kolom
                : kolom == verwissel.Value.A ? verwissel.Value.B
                : kolom == verwissel.Value.B ? verwissel.Value.A
                : kolom;
            sheet.Cell(1, (int)kolom).Value = SchoolcontentKolommen.Label(label);
        }

        for (var i = 0; i < rijen.Count; i++)
        {
            var (thema, subthema, klas) = rijen[i];
            var r = i + 2;
            sheet.Cell(r, (int)SchoolcontentKolom.ThemaNaam).Value = thema;
            sheet.Cell(r, (int)SchoolcontentKolom.ThemaDuurWeken).Value = "5";
            sheet.Cell(r, (int)SchoolcontentKolom.SubthemaNaam).Value = subthema;
            sheet.Cell(r, (int)SchoolcontentKolom.SubthemaDuurWeken).Value = "2";
            if (klas is not null)
            {
                sheet.Cell(r, (int)SchoolcontentKolom.SubthemaKlas).Value = klas;
            }

            sheet.Cell(r, (int)SchoolcontentKolom.SubthemaLeeftijd).Value = "6";
            sheet.Cell(r, (int)SchoolcontentKolom.ActiviteitNaam).Value = "Bladeren rapen";
            sheet.Cell(r, (int)SchoolcontentKolom.ActiviteitType).Value = "waarneming";
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return stream.ToArray();
    }
}
