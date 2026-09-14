using System.Net;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Eval;
using Jaarplanner.UnitTests.Ai;
using Jaarplanner.UnitTests.AiAuthoring;

namespace Jaarplanner.UnitTests.Eval;

/// <summary>
/// The eval runner end to end with fakes (TB-004): no model, no embeddings, no database. The ticket's first criterion
/// (a report per variant with precision, recall and the candidate ceiling, plus a row per case) and its second (an
/// unknown code is an error, never a hit) are pinned here.
/// </summary>
public sealed class EvalRunnerTests
{
    // The model always proposes one real K3 goal and one goal from another jaar/fase.
    private const string Antwoord =
        """{"suggesties":[{"code":"W-01","motivatie":"past bij water"},{"code":"L-01","motivatie":"andere jaarfase"}]}""";

    private static Evalset TweeGevallen() => new()
    {
        Omschrijving = "testset",
        Gevallen = [EvalTestData.WaterGeval("W-01", "W-02"), EvalTestData.ZandGeval("Z-01")],
    };

    private static Evalset EenGeval() => new() { Gevallen = [EvalTestData.WaterGeval("W-01")] };

    private static EvalRunner Runner(IAiClient client, IReadOnlyDictionary<string, ModelPrice>? prices = null) =>
        new(
            [new JaarfaseSelectie(new FakeLeerdoelCatalogus(EvalTestData.Catalogus()))],
            [new EvalModel("model", client)],
            DoelWeergave.Compact,
            maxSuggestions: 8,
            prices: prices,
            throttleWait: TimeSpan.Zero);

    private static EvalRunner EmbeddingRunner(IEmbeddingClient embedder) =>
        new(
            [
                new EmbeddingSelectie(
                    new FakeLeerdoelCatalogus(EvalTestData.Catalogus()),
                    embedder,
                    new EmbeddingCache(null),
                    top: 2,
                    throttleWait: TimeSpan.Zero),
            ],
            [new EvalModel("model", new FakeAiClient(Antwoord))],
            DoelWeergave.Compact,
            maxSuggestions: 8);

    [Fact]
    public async Task Een_run_met_nepdiensten_levert_een_rapport_per_variant_en_per_geval()
    {
        var catalogus = new FakeLeerdoelCatalogus(EvalTestData.Catalogus());
        var embedder = new EvalTestData.FakeEmbedder();
        var runner = new EvalRunner(
            [
                new JaarfaseSelectie(catalogus),
                new EmbeddingSelectie(catalogus, embedder, new EmbeddingCache(null), top: 2),
            ],
            [new EvalModel("model-a", new FakeAiClient(Antwoord)), new EvalModel("model-b", new FakeAiClient(Antwoord))],
            DoelWeergave.Compact,
            maxSuggestions: 8);

        var rapport = await runner.RunAsync(TweeGevallen());

        // 2 variants x 2 cases x 2 models.
        Assert.Equal(8, rapport.Resultaten.Count);
        Assert.All(rapport.Resultaten, r =>
        {
            Assert.Null(r.Fout);
            Assert.True(r.Beantwoord);
            Assert.Equal(1, r.Pogingen);
        });

        // Variant A, the water case: W-01 is a hit, L-01 is outside the K3 candidates and so an error.
        var a = rapport.Resultaten.Single(r =>
            r.Variant.StartsWith("A:", StringComparison.Ordinal) && r.Model == "model-a" && r.GevalId == "k3-water");
        Assert.Equal(["W-01"], a.Score.Treffers);
        Assert.Equal(["L-01"], a.Score.Onbekend);
        Assert.Equal(0.5, a.Score.Precisie);
        Assert.Equal(0.5, a.Score.Recall);
        Assert.Equal(3, a.Score.AantalKandidaten);

        // Variant B keeps the two water goals for the water case and drops the sand goal.
        var b = rapport.Kandidaten.Single(k => k.Variant.StartsWith("B:", StringComparison.Ordinal) && k.GevalId == "k3-water");
        Assert.Equal(2, b.AantalKandidaten);
        Assert.Equal(2, b.GoudenInKandidaten);
        Assert.Equal("fake-embedding", b.EmbeddingModel);

        // For the sand case the sand goal ranks first, so it is among B's two candidates.
        var bZand = rapport.Kandidaten.Single(k => k.Variant.StartsWith("B:", StringComparison.Ordinal) && k.GevalId == "k3-zand");
        Assert.Equal(1, bZand.GoudenInKandidaten);

        // Goal vectors are embedded once (one batch) and then read from the cache; each case embeds its own query.
        Assert.Equal(3, embedder.AantalAanroepen);
        Assert.Equal(40, b.EmbeddingTokens);
        Assert.Equal(10, bZand.EmbeddingTokens);

        var markdown = ReportWriter.Write(rapport);
        Assert.Contains("## Samenvatting", markdown);
        Assert.Contains("| A: jaarfase, zonder retrieval | model-a | 2 | 0 | ", markdown);
        Assert.Contains("| B: embeddings (fake-embedding), top 2 | model-b | 2 | 0 | ", markdown);
        Assert.Contains("| B: embeddings (fake-embedding), top 2 | fake-embedding | 50 | onbekend | 0 | 100% |", markdown);
        Assert.Contains("### A: jaarfase, zonder retrieval · model-a", markdown);
        Assert.Contains("| `k3-water` | 3 | 2 | `W-01` | `W-02` |  | `L-01` |", markdown);
        Assert.Contains("| `k3-zand` |", markdown);
    }

    /// <summary>A failing call is recorded in its row and the run carries on with the next one.</summary>
    [Fact]
    public async Task Een_mislukte_aanroep_wordt_genoteerd_en_de_run_gaat_door()
    {
        var catalogus = new FakeLeerdoelCatalogus(EvalTestData.Catalogus());
        var runner = new EvalRunner(
            [new JaarfaseSelectie(catalogus)],
            [
                new EvalModel("stuk", new GooiendeClient(() => new HttpRequestException("nep-fout", null, HttpStatusCode.InternalServerError))),
                new EvalModel("heel", new FakeAiClient(Antwoord)),
            ],
            DoelWeergave.Compact,
            maxSuggestions: 8);

        var rapport = await runner.RunAsync(TweeGevallen());

        Assert.All(rapport.Resultaten.Where(r => r.Model == "stuk"), r =>
        {
            Assert.NotNull(r.Fout);
            Assert.False(r.Beantwoord);
            Assert.Equal(0.0, r.Score.Recall);
        });
        Assert.All(rapport.Resultaten.Where(r => r.Model == "heel"), r => Assert.Null(r.Fout));
        Assert.Contains("| A: jaarfase, zonder retrieval | stuk | 2 | 2 | ", ReportWriter.Write(rapport));
    }

    /// <summary>
    /// An HTTP timeout is an OperationCanceledException nobody asked for: it is recorded like any failed call and the
    /// run goes on, instead of ending with "Gestopt" and losing every result.
    /// </summary>
    [Fact]
    public async Task Een_timeout_van_een_chataanroep_stopt_de_run_niet()
    {
        var runner = Runner(new GooiendeClient(() => new TaskCanceledException("timeout")));

        var rapport = await runner.RunAsync(TweeGevallen());

        Assert.Equal(2, rapport.Resultaten.Count);
        Assert.All(rapport.Resultaten, r =>
        {
            Assert.Equal("timeout", r.Fout);
            Assert.False(r.Beantwoord);
        });
    }

    /// <summary>A timeout of an embedding call fails that case only, with the tokens already paid for.</summary>
    [Fact]
    public async Task Een_timeout_van_een_embeddingaanroep_stopt_de_run_niet()
    {
        var rapport = await EmbeddingRunner(new WisselendeEmbedder(n => n == 2 ? new TaskCanceledException("timeout") : null))
            .RunAsync(EenGeval());

        var meting = Assert.Single(rapport.Kandidaten);
        Assert.Equal("timeout", meting.Fout);
        Assert.Equal(30, meting.EmbeddingTokens);
    }

    /// <summary>A cancellation the caller asked for does stop the run.</summary>
    [Fact]
    public async Task Een_gevraagde_stop_stopt_de_run()
    {
        using var stop = new CancellationTokenSource();
        await stop.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            Runner(new GooiendeClient(() => new TaskCanceledException("gestopt"))).RunAsync(EenGeval(), stop.Token));
    }

    /// <summary>An answer the production parser rejects counts as "nothing proposed", with the reason in the row.</summary>
    [Fact]
    public async Task Een_ongeldig_antwoord_telt_als_niets_voorgesteld()
    {
        var rapport = await Runner(new FakeAiClient("Hier zijn mijn suggesties!")).RunAsync(EenGeval());

        var rij = Assert.Single(rapport.Resultaten);
        Assert.StartsWith("ongeldig antwoord", rij.Fout, StringComparison.Ordinal);
        Assert.True(rij.Beantwoord);
        Assert.Equal(0, rij.Score.AantalVoorgesteld);
    }

    /// <summary>A throttled deployment (429) is waited out and asked again; the answer then counts normally.</summary>
    [Fact]
    public async Task Te_veel_aanvragen_wordt_opnieuw_geprobeerd()
    {
        var client = new GooiendeClient(
            () => new HttpRequestException("druk", null, HttpStatusCode.TooManyRequests), aantalKeer: 1, daarna: Antwoord);

        var rapport = await Runner(client).RunAsync(EenGeval());

        var rij = Assert.Single(rapport.Resultaten);
        Assert.Null(rij.Fout);
        Assert.Equal(["W-01"], rij.Score.Treffers);
        Assert.Equal(2, rij.Pogingen);
        Assert.Equal(2, client.AantalAanroepen);
    }

    /// <summary>With usage and a price, the report shows the chat cost; without a price it says so instead of guessing.</summary>
    [Fact]
    public async Task De_kost_volgt_uit_verbruik_en_prijslijst()
    {
        var verbruik = new AiUsage { InputTokens = 1_000_000, CachedInputTokens = 0, OutputTokens = 0 };
        var runner = new EvalRunner(
            [new JaarfaseSelectie(new FakeLeerdoelCatalogus(EvalTestData.Catalogus()))],
            [
                new EvalModel("geprijsd", new VerbruikClient(Antwoord, verbruik)),
                new EvalModel("ongeprijsd", new VerbruikClient(Antwoord, verbruik)),
            ],
            DoelWeergave.Compact,
            maxSuggestions: 8,
            prices: new Dictionary<string, ModelPrice> { ["geprijsd"] = new() { Input = 0.5m, Output = 2m } });

        var markdown = ReportWriter.Write(await runner.RunAsync(EenGeval()));

        Assert.Contains("| 0,5000 |", Regel(markdown, "| A: jaarfase, zonder retrieval | geprijsd |"));
        Assert.Contains("| onbekend |", Regel(markdown, "| A: jaarfase, zonder retrieval | ongeprijsd |"));
    }

    /// <summary>A rejected answer was still billed: its tokens count in the cost, so tokens and cost agree.</summary>
    [Fact]
    public async Task Een_ongeldig_antwoord_telt_mee_in_de_kost()
    {
        var verbruik = new AiUsage { InputTokens = 1_000_000, CachedInputTokens = 0, OutputTokens = 0 };
        var prices = new Dictionary<string, ModelPrice> { ["model"] = new() { Input = 0.5m, Output = 2m } };

        var markdown = ReportWriter.Write(await Runner(new VerbruikClient("geen json", verbruik), prices).RunAsync(EenGeval()));

        var regel = Regel(markdown, "| A: jaarfase, zonder retrieval | model |");
        Assert.Contains("| 1 | 1 | ", regel);
        Assert.Contains("| 0,5000 |", regel);
    }

    /// <summary>As in production step 6, an already chosen themadoel is dropped from the answer before scoring.</summary>
    [Fact]
    public async Task Een_gekozen_themadoel_telt_niet_mee()
    {
        var geval = EvalTestData.WaterGeval("W-02") with
        {
            Thema = new ThemaOpbouwContext { Naam = "Water", GekozenThemadoelCodes = ["W-01"] },
        };
        const string antwoord =
            """{"suggesties":[{"code":"W-01","motivatie":"themadoel"},{"code":"W-02","motivatie":"past"}]}""";

        var rapport = await Runner(new FakeAiClient(antwoord)).RunAsync(new Evalset { Gevallen = [geval] });

        var score = Assert.Single(rapport.Resultaten).Score;
        Assert.Equal(["W-02"], score.Gekozen);
        Assert.Empty(score.Onbekend);
        Assert.Equal(1.0, score.Precisie);
    }

    /// <summary>After a throttled embedding call, the tokens of the calls that did succeed are still counted.</summary>
    [Fact]
    public async Task Embeddingtokens_blijven_geteld_na_een_nieuwe_poging()
    {
        var embedder = new WisselendeEmbedder(n => n == 2 ? new HttpRequestException("druk", null, HttpStatusCode.TooManyRequests) : null);
        var selectie = new EmbeddingSelectie(
            new FakeLeerdoelCatalogus(EvalTestData.Catalogus()), embedder, new EmbeddingCache(null), top: 2,
            throttleWait: TimeSpan.Zero);

        var set = await selectie.SelectAsync(EvalTestData.WaterGeval("W-01"), CancellationToken.None);

        // The goal batch (3 texts) succeeded, the query was throttled once and then succeeded.
        Assert.Equal(40, set.EmbeddingTokens);
        Assert.Equal(3, embedder.AantalAanroepen);
    }

    /// <summary>
    /// When a later embedding call fails for good, the tokens already paid for stay in the report, together with the
    /// embedding model and the reason; the failed case is counted apart and not as a retrieval miss.
    /// </summary>
    [Fact]
    public async Task Betaalde_embeddingtokens_blijven_zichtbaar_als_de_selectie_faalt()
    {
        var rapport = await EmbeddingRunner(
                new WisselendeEmbedder(n => n >= 2 ? new HttpRequestException("kapot", null, HttpStatusCode.InternalServerError) : null))
            .RunAsync(EenGeval());

        var meting = Assert.Single(rapport.Kandidaten);
        Assert.Equal("kapot", meting.Fout);
        Assert.Equal(30, meting.EmbeddingTokens);
        Assert.Equal("wisselend-embedding", meting.EmbeddingModel);

        // Both tables apply one rule: the failed case is an error, not a case where retrieval found nothing.
        var markdown = ReportWriter.Write(rapport);
        Assert.Contains("| wisselend-embedding | 30 | onbekend | 1 | - |", markdown);
        Assert.Contains("| B: embeddings (wisselend-embedding), top 2 | model | 1 | 1 | - | 0% | - | - |", markdown);
    }

    /// <summary>
    /// A call that fails while the caller's stop arrives is recorded, and the run then stops at its next check: a
    /// requested stop always ends the run as a cancellation, never as a crash.
    /// </summary>
    [Fact]
    public async Task Een_fout_tijdens_een_gevraagde_stop_stopt_de_run()
    {
        using var stop = new CancellationTokenSource();
        var client = new GooiendeClient(() =>
        {
            stop.Cancel();
            return new HttpRequestException("kapot", null, HttpStatusCode.InternalServerError);
        });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Runner(client).RunAsync(TweeGevallen(), stop.Token));
        Assert.Equal(1, client.AantalAanroepen);
    }

    /// <summary>
    /// A cache that cannot be written is only a lost optimisation: it neither replaces the selection's own error nor
    /// turns a selection that worked into a failure.
    /// </summary>
    [Fact]
    public async Task Een_cache_die_niet_bewaard_kan_worden_verandert_niets_aan_de_selectie()
    {
        // A file where the cache wants a folder: Directory.CreateDirectory then throws an IOException.
        var geblokkeerd = Path.GetTempFileName();
        try
        {
            var catalogus = new FakeLeerdoelCatalogus(EvalTestData.Catalogus());
            var faaltLater = new EmbeddingSelectie(
                catalogus,
                new WisselendeEmbedder(n => n >= 2 ? new HttpRequestException("kapot", null, HttpStatusCode.InternalServerError) : null),
                new EmbeddingCache(geblokkeerd),
                top: 2,
                throttleWait: TimeSpan.Zero);

            var fout = await Assert.ThrowsAsync<CandidateSelectionException>(() =>
                faaltLater.SelectAsync(EvalTestData.WaterGeval("W-01"), CancellationToken.None));
            Assert.Equal(30, fout.EmbeddingTokens);

            var lukt = new EmbeddingSelectie(catalogus, new EvalTestData.FakeEmbedder(), new EmbeddingCache(geblokkeerd), top: 2);
            var set = await lukt.SelectAsync(EvalTestData.WaterGeval("W-01"), CancellationToken.None);
            Assert.Equal(2, set.Doelen.Count);
        }
        finally
        {
            File.Delete(geblokkeerd);
        }
    }

    [Fact]
    public async Task De_catalogus_wordt_per_selectie_een_keer_gelezen()
    {
        var bron = new FakeLeerdoelCatalogus(EvalTestData.Catalogus());
        var catalogus = new CachingCatalogus(bron);

        await catalogus.HaalLeerdoelenAsync(new LeerdoelSelectie { JaarFasen = ["K3"] });
        var tweede = await catalogus.HaalLeerdoelenAsync(new LeerdoelSelectie { JaarFasen = ["k3 "] });

        Assert.Equal(1, bron.AantalAanroepen);
        Assert.Equal(3, tweede.Count);
    }

    [Fact]
    public void De_cache_bewaart_vectoren_op_schijf()
    {
        var map = Path.Combine(Path.GetTempPath(), $"jaarplanner-eval-{Guid.NewGuid():N}");
        try
        {
            var cache = new EmbeddingCache(map);
            cache.Put("model/x", "een tekst", [0.25f, -1f]);
            cache.Save();

            Assert.True(File.Exists(cache.FileFor("model/x")));
            Assert.True(new EmbeddingCache(map).TryGet("model/x", "een tekst", out var vector));
            Assert.Equal([0.25f, -1f], vector);
            Assert.False(new EmbeddingCache(map).TryGet("model/x", "een andere tekst", out _));
        }
        finally
        {
            if (Directory.Exists(map))
            {
                Directory.Delete(map, recursive: true);
            }
        }
    }

    [Fact]
    public void Cosinus_van_gelijke_en_loodrechte_vectoren()
    {
        Assert.Equal(1.0, EmbeddingSelectie.Cosine([1f, 1f], [2f, 2f]), precision: 6);
        Assert.Equal(0.0, EmbeddingSelectie.Cosine([1f, 0f], [0f, 1f]), precision: 6);
        Assert.Equal(0.0, EmbeddingSelectie.Cosine([0f, 0f], [1f, 0f]));
    }

    /// <summary>The subthema text that is embedded carries the activities and questions, not just the name.</summary>
    [Fact]
    public void De_vraagtekst_bevat_vragen_en_activiteiten()
    {
        var tekst = EmbeddingSelectie.VraagTekst(EvalTestData.WaterGeval("W-01"));

        Assert.Contains("Subthema: Plassen", tekst);
        Assert.Contains("Onderzoeksvraag: Waar blijft het water?", tekst);
        Assert.Contains("Activiteit: Watertafel (hoek: Waterhoek). Verwachte uitkomsten: De kleuters gieten over", tekst);
    }

    private static string Regel(string markdown, string begin) =>
        markdown.Split('\n').Single(l => l.StartsWith(begin, StringComparison.Ordinal));

    /// <summary>Throws the given exception a number of times (by default always), then answers.</summary>
    private sealed class GooiendeClient(Func<Exception> fout, int aantalKeer = int.MaxValue, string daarna = "{}") : IAiClient
    {
        public int AantalAanroepen { get; private set; }

        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default)
        {
            AantalAanroepen++;
            if (AantalAanroepen <= aantalKeer)
            {
                throw fout();
            }

            return Task.FromResult(new AiCompletion { Content = daarna });
        }
    }

    /// <summary>Answers with a fixed content and a fixed usage.</summary>
    private sealed class VerbruikClient(string inhoud, AiUsage verbruik) : IAiClient
    {
        public Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default) =>
            Task.FromResult(new AiCompletion { Content = inhoud, Usage = verbruik });
    }

    /// <summary>Embeds like <see cref="EvalTestData.FakeEmbedder"/>, but throws what <c>fout</c> gives for a call number.</summary>
    private sealed class WisselendeEmbedder(Func<int, Exception?> fout) : IEmbeddingClient
    {
        private readonly EvalTestData.FakeEmbedder _echt = new();

        public string Model => "wisselend-embedding";

        public int AantalAanroepen { get; private set; }

        public Task<EmbeddingResult> EmbedAsync(IReadOnlyList<string> texts, CancellationToken cancellationToken)
        {
            AantalAanroepen++;
            if (fout(AantalAanroepen) is { } ex)
            {
                throw ex;
            }

            return _echt.EmbedAsync(texts, cancellationToken);
        }
    }
}
