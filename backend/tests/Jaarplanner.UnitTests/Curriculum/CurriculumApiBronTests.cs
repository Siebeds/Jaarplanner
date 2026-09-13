using System.Net;
using System.Text;
using System.Text.Json;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Infrastructure.OpstapImport;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jaarplanner.UnitTests.Curriculum;

/// <summary>
/// Reading KOV's curriculum without a network (E1-21, ADR-0032): the numbered snapshot is pinned and never read as
/// <c>latest</c>, the tree is walked from each goal to its discipline, only goal set G is mapped and the rest counted,
/// and every way the read can be untrustworthy refuses it as a whole. The snapshot is a miniature of 1.2's real shape:
/// Wiskunde with a clustered and an unclustered G goal and a P goal, and <c>9-1</c> with only an S goal.
/// </summary>
public sealed class CurriculumApiBronTests
{
    private const string Minimumdoel = "/agodi/onderwijsdoelen/opstap/93408";
    private const string Document = "bdc19260-bd4c-46a8-8009-b2a54f381120";

    private readonly Snapshot _snapshot = new();
    private readonly List<string> _gevraagd = [];
    private string _hash = """{"version":"1.2","hash":"8f470a12-231f-5817-7a8b-6582195e2583"}""";
    private string _nieuwste = """{"version":"1.2","hash":"8f470a12-231f-5817-7a8b-6582195e2583"}""";
    private string _onderwijsdoelen =
        """{"$$meta":{"count":1},"results":[{"href":"/agodi/onderwijsdoelen/opstap/93408","$$expanded":{"key":93408,"code":"2.1.7","uniqueCode":"4-2.1.7","title":"<p>x</p>"}}]}""";
    private HttpStatusCode _snapshotStatus = HttpStatusCode.OK;
    private readonly OpvangLogger _logger = new();

    private CurriculumApiBron Bron()
    {
        var http = new HttpClient(new NepHandler(verzoek =>
        {
            var adres = verzoek.RequestUri!.AbsoluteUri;
            _gevraagd.Add(adres);
            var pad = verzoek.RequestUri.AbsolutePath;
            return pad.Contains("/agodi/onderwijsdoelen/opstap", StringComparison.Ordinal) ? Json(_onderwijsdoelen)
                : pad.EndsWith("/snapshots/latest/krcItems/hash", StringComparison.Ordinal) ? Json(_nieuwste)
                : pad.EndsWith("/krcItems/hash", StringComparison.Ordinal) ? Json(_hash)
                : pad.EndsWith("/krcItems", StringComparison.Ordinal) ? Json(_snapshot.Json(), _snapshotStatus)
                : new HttpResponseMessage(HttpStatusCode.NotFound);
        }));

        // Deliberately without a trailing slash: the source must not drop the "api" segment.
        return new CurriculumApiBron(http, Options.Create(new OpstapApiOptions { BasisUrl = new Uri("https://voorbeeld.test/api") }), _logger);
    }

    [Fact]
    public async Task Zonder_versie_leest_het_de_nieuwste_versie_bij_nummer_en_nooit_latest_zelf()
    {
        var resultaat = await Bron().HaalOpAsync(versie: null);

        Assert.Equal("1.2", resultaat.Versie);
        Assert.Equal("8f470a12-231f-5817-7a8b-6582195e2583", resultaat.Hash);
        Assert.Equal($"https://voorbeeld.test/api/documents/{Document}/snapshots/latest/krcItems/hash", _gevraagd[0]);
        Assert.Contains($"https://voorbeeld.test/api/documents/{Document}/snapshots/1.2/krcItems/hash", _gevraagd);
        Assert.Contains($"https://voorbeeld.test/api/documents/{Document}/snapshots/1.2/krcItems", _gevraagd);
        // "latest" only ever names a version; the curriculum itself is read by number.
        Assert.DoesNotContain(_gevraagd, a => a.EndsWith("/snapshots/latest/krcItems", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Met_een_versie_wordt_latest_niet_gevraagd()
    {
        await Bron().HaalOpAsync("1.2");

        Assert.DoesNotContain(_gevraagd, a => a.Contains("/latest/", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Mapt_de_G_doelen_per_discipline_en_telt_de_andere_doelsets()
    {
        var resultaat = await Bron().HaalOpAsync("1.2");

        Assert.Equal(["2", "9.1"], resultaat.Disciplines.Select(d => d.DisciplineNummer).ToArray());
        var wiskunde = resultaat.Disciplines[0];
        Assert.Equal("Wiskunde", wiskunde.DisciplineNaam);
        Assert.Equal(["2.1.GL3.10", "2.1.GL2.1"], wiskunde.Leerplandoelen.Select(l => l.Code).ToArray());
        Assert.Equal("4-2.1.7", wiskunde.Leerplandoelen[0].MinimumdoelRef);
        Assert.Equal("Tellen", wiskunde.Leerplandoelen[0].Cluster);
        Assert.Equal("- Wel 105, 110", wiskunde.Leerplandoelen[0].Voorbeelden);
        Assert.Null(wiskunde.Leerplandoelen[1].Cluster);
        Assert.Null(wiskunde.Leerplandoelen[1].MinimumdoelRef);
        Assert.Equal("L2", wiskunde.Leerplandoelen[1].JaarFase);
        Assert.Equal(["2.1.PF3.1"], wiskunde.BuitenBereikCodes);
        Assert.Equal([new DoelsetTelling("P", 1)], wiskunde.OvergeslagenDoelsets);

        var veilig = resultaat.Disciplines[1];
        Assert.Empty(veilig.Leerplandoelen);
        Assert.Equal(["9-1.1.SF2.1"], veilig.BuitenBereikCodes);

        Assert.Empty(resultaat.Problemen);
        Assert.Equal([new DoelsetTelling("P", 1), new DoelsetTelling("S", 1)], resultaat.OvergeslagenDoelsets);
    }

    [Fact]
    public async Task Het_wijzigingslog_en_het_tijdstip_komen_mee()
    {
        var resultaat = await Bron().HaalOpAsync("1.2");

        Assert.Equal("TOEGEVOEGD\n- 2.1.GL2.1 - nieuw doel", resultaat.Wijzigingslog);
        Assert.Equal(new DateTimeOffset(2026, 8, 27, 10, 3, 7, TimeSpan.Zero), resultaat.SnapshotTijdstip!.Value.AddTicks(-resultaat.SnapshotTijdstip.Value.Ticks % TimeSpan.TicksPerSecond));
    }

    /// <summary>
    /// A changelog the conversion cannot keep is left out rather than guessed at, and because the report cannot say which
    /// of its two nulls it is, the refusal goes to the operator log (antagonist round 1, MINOR 3). The read goes on: the
    /// changelog is KOV's note, not curriculum data.
    /// </summary>
    [Fact]
    public async Task Een_wijzigingslog_dat_niet_trouw_om_te_zetten_is_valt_weg_en_wordt_gelogd()
    {
        _snapshot.Changelog = "<p>H<sub>2</sub>O</p>";

        var resultaat = await Bron().HaalOpAsync("1.2");

        Assert.Null(resultaat.Wijzigingslog);
        Assert.Equal(2, resultaat.Disciplines[0].Leerplandoelen.Count);
        var melding = Assert.Single(_logger.Meldingen);
        Assert.Equal(LogLevel.Warning, melding.Niveau);
        Assert.Contains("snapshot 1.2", melding.Tekst, StringComparison.Ordinal);
        Assert.Contains("<sub>", melding.Tekst, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Zonder_wijzigingslog_is_er_niets_te_melden()
    {
        _snapshot.Changelog = null;

        var resultaat = await Bron().HaalOpAsync("1.2");

        Assert.Null(resultaat.Wijzigingslog);
        Assert.Empty(_logger.Meldingen);
    }

    [Fact]
    public async Task Een_doel_dat_de_mapping_weigert_wordt_gemeld_en_de_rest_ingelezen()
    {
        _snapshot.Doel("2.1.GL3.10")["description"] = "H<sub>2</sub>O";

        var resultaat = await Bron().HaalOpAsync("1.2");

        var probleem = Assert.Single(resultaat.Problemen);
        Assert.Equal("2.1.GL3.10", probleem.Code);
        Assert.Equal(["2.1.GL3.10"], resultaat.Disciplines[0].NietIngelezenCodes);
        Assert.Equal(["2.1.GL2.1"], resultaat.Disciplines[0].Leerplandoelen.Select(l => l.Code).ToArray());
    }

    [Fact]
    public async Task Een_hash_voor_een_andere_versie_weigert_de_lezing()
    {
        _hash = """{"version":"1.3","hash":"x"}""";

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Equal(OpstapBronFout.Melding, fout.Message);
        Assert.Contains("came back as version '1.3'", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_snapshot_van_een_andere_versie_weigert_de_lezing()
    {
        _snapshot.Versie = "1.1";

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Contains("version '1.1' came back", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_nieuwste_versie_zonder_nummer_weigert_de_lezing()
    {
        _nieuwste = """{"version":"latest","hash":"x"}""";

        await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync(versie: null));
    }

    /// <summary>The version lands in a request path; only digits and dots pass, and nothing is requested otherwise.</summary>
    [Theory]
    [InlineData("latest")]
    [InlineData("1.2/../../x")]
    [InlineData("1.2?x=y")]
    public async Task Een_versie_die_geen_nummer_is_wordt_niet_gevraagd(string versie)
    {
        await Assert.ThrowsAsync<ArgumentException>(() => Bron().HaalOpAsync(versie));

        Assert.Empty(_gevraagd);
    }

    [Fact]
    public async Task Een_foutstatus_wordt_een_bronfout()
    {
        _snapshotStatus = HttpStatusCode.NotFound;

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Contains("404", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    /// <summary>
    /// A goal nobody can identify could be one that is stored, and the report would then call it vanished while KOV
    /// still lists it. So it refuses the whole read, as E1-12 does for minimumdoelen.
    /// </summary>
    [Theory]
    [InlineData("identifier", null)]
    [InlineData("identifier", "  ")]
    [InlineData("key", "geen-uuid")]
    public async Task Een_doel_zonder_code_of_sleutel_weigert_de_hele_lezing(string veld, string? waarde)
    {
        _snapshot.Doel("2.1.GL2.1")[veld] = waarde;

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Contains("cannot all be identified", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_code_die_twee_keer_voorkomt_weigert_de_hele_lezing()
    {
        _snapshot.Doel("2.1.GL2.1")["identifier"] = "2.1.GL3.10";

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Contains("occurs more than once", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_doel_op_een_onverwachte_plek_weigert_de_hele_lezing()
    {
        // Hung directly under its goal set, skipping the age range.
        var doel = _snapshot.Doel("2.1.GL2.1");
        doel["parentHref"] = _snapshot.Leeftijd("L2")["parentHref"];

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Contains("does not sit where a goal belongs", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_disciplinenummer_van_een_onbekende_vorm_weigert_de_hele_lezing()
    {
        _snapshot.Items.Single(i => (string?)i["identifier"] == "9-1")["identifier"] = "negen";

        await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));
    }

    /// <summary>Absence of input is not a curriculum change: a snapshot without G goals would make every stored goal look gone.</summary>
    [Fact]
    public async Task Een_snapshot_zonder_G_doelen_weigert_de_lezing()
    {
        foreach (var doelset in _snapshot.Items.Where(i => (string?)i["type"] == CurriculumApiBron.TypeDoelset))
        {
            doelset["identifier"] = "P";
        }

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Contains("holds no goal of goal set G", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Een_minimumdoelrij_zonder_uniqueCode_weigert_de_lezing()
    {
        _onderwijsdoelen = _onderwijsdoelen.Replace("\"uniqueCode\":\"4-2.1.7\",", string.Empty, StringComparison.Ordinal);

        var fout = await Assert.ThrowsAsync<OpstapBronFout>(() => Bron().HaalOpAsync("1.2"));

        Assert.Contains("could not be concorded", fout.TechnischeOorzaak, StringComparison.Ordinal);
    }

    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    /// <summary>A miniature <c>krcItems</c>, built as dictionaries so each test can break one thing.</summary>
    private sealed class Snapshot
    {
        public Snapshot()
        {
            var root = Voeg("KRC_CURRICULUM", null, titel: "Op.stap");
            var container = Voeg("KRC_DISCIPLINE_CONTAINER", root);

            var wiskunde = Voeg(CurriculumApiBron.TypeDiscipline, container, "2", "Wiskunde");
            var getallen = Voeg(CurriculumApiBron.TypeDomein, wiskunde, "1", "Getallenkennis");
            var natuurlijk = Voeg(CurriculumApiBron.TypeSubdomein, getallen, titel: "Natuurlijke getallen");
            var tellen = Voeg(CurriculumApiBron.TypeCluster, natuurlijk, titel: "Tellen");
            var g = Voeg(CurriculumApiBron.TypeDoelset, tellen, "G", "Routedoelen");
            var l3 = Voeg(CurriculumApiBron.TypeLeeftijd, g, "L3", "3de leerjaar");
            Voeg(CurriculumApiBron.TypeDoel, l3, "2.1.GL3.10", "De leerlingen kunnen tellen tot 1000.",
                beschrijving: "<strong>Voorbeeld(en):</strong><ul><li>Wel 105, 110</li></ul>", minimumdoelen: [Minimumdoel]);
            var gZonderCluster = Voeg(CurriculumApiBron.TypeDoelset, natuurlijk, "G", "Routedoelen");
            var l2 = Voeg(CurriculumApiBron.TypeLeeftijd, gZonderCluster, "L2", "2de leerjaar");
            Voeg(CurriculumApiBron.TypeDoel, l2, "2.1.GL2.1", "De leerlingen kennen getallen tot 100.");
            var p = Voeg(CurriculumApiBron.TypeDoelset, tellen, "P", "Routedoelen");
            var f3 = Voeg(CurriculumApiBron.TypeLeeftijd, p, "F3", "fase 3");
            Voeg(CurriculumApiBron.TypeDoel, f3, "2.1.PF3.1", "Een precurriculair doel.");

            var veilig = Voeg(CurriculumApiBron.TypeDiscipline, container, "9-1", "Veilige en gezonde levensstijl");
            var gezondheid = Voeg(CurriculumApiBron.TypeDomein, veilig, "1", "Gezondheid");
            var voeding = Voeg(CurriculumApiBron.TypeSubdomein, gezondheid, titel: "Voeding");
            var s = Voeg(CurriculumApiBron.TypeDoelset, voeding, "S", "Routedoelen");
            var f2 = Voeg(CurriculumApiBron.TypeLeeftijd, s, "F2", "fase 2");
            Voeg(CurriculumApiBron.TypeDoel, f2, "9-1.1.SF2.1", "Een specifiek doel.");
        }

        public string Versie { get; set; } = "1.2";

        public string? Changelog { get; set; } =
            "<p class=\"snapshot-change-section\"><strong>TOEGEVOEGD</strong></p><ul><li>2.1.GL2.1 - nieuw doel</li></ul>";

        public List<Dictionary<string, object?>> Items { get; } = [];

        public Dictionary<string, object?> Doel(string code) =>
            Items.Single(i => (string?)i["type"] == CurriculumApiBron.TypeDoel && (string?)i["identifier"] == code);

        public Dictionary<string, object?> Leeftijd(string code) =>
            Items.Single(i => (string?)i["type"] == CurriculumApiBron.TypeLeeftijd && (string?)i["identifier"] == code);

        public string Json() =>
            JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["version"] = Versie,
                ["timestamp"] = "2026-08-27T10:03:07.098307+00:00",
                ["changelog"] = Changelog,
                ["snapshotKey"] = "ffe87311-61c8-410e-8b58-97a5501d6696",
                ["items"] = Items,
            });

        private Dictionary<string, object?> Voeg(
            string type,
            Dictionary<string, object?>? ouder,
            string? identifier = null,
            string? titel = null,
            string? beschrijving = null,
            string[]? minimumdoelen = null)
        {
            var sleutel = Guid.NewGuid().ToString();
            var item = new Dictionary<string, object?>
            {
                ["key"] = sleutel,
                ["href"] = $"/content/{sleutel}",
                ["type"] = type,
                ["parentHref"] = ouder?["href"],
                ["identifier"] = identifier,
                ["title"] = titel,
            };
            if (beschrijving is not null)
            {
                item["description"] = beschrijving;
            }

            if (minimumdoelen is not null)
            {
                item["minimumGoals"] = minimumdoelen;
            }

            Items.Add(item);
            return item;
        }
    }

    /// <summary>Records what the source logs, so a test can read the operator warning.</summary>
    private sealed class OpvangLogger : ILogger<CurriculumApiBron>
    {
        public List<(LogLevel Niveau, string Tekst)> Meldingen { get; } = [];

        public IDisposable? BeginScope<TState>(TState state)
            where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            Meldingen.Add((logLevel, formatter(state, exception)));
    }

    private sealed class NepHandler(Func<HttpRequestMessage, HttpResponseMessage> antwoord) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(antwoord(request));
    }
}
