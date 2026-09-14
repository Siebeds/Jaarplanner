using System.Diagnostics;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiMatching.Response;

namespace Jaarplanner.Eval;

/// <summary>A chat deployment under test.</summary>
/// <param name="Naam">The deployment name, as the report and the price list name it.</param>
/// <param name="Client">The client that calls it.</param>
public sealed record EvalModel(string Naam, IAiClient Client);

/// <summary>A price list entry, per million tokens, in whatever currency the list is in.</summary>
public sealed record ModelPrice
{
    /// <summary>Price per million input tokens.</summary>
    public decimal? Input { get; init; }

    /// <summary>Price per million cached input tokens; the input price when not set.</summary>
    public decimal? CachedInput { get; init; }

    /// <summary>Price per million output tokens (reasoning tokens included).</summary>
    public decimal? Output { get; init; }
}

/// <summary>What one variant found for one case, before any model was asked.</summary>
public sealed record KandidaatMeting
{
    /// <summary>The variant's name.</summary>
    public required string Variant { get; init; }

    /// <summary>The case.</summary>
    public required string GevalId { get; init; }

    /// <summary>The subthema's jaar/fase.</summary>
    public required string Leeftijd { get; init; }

    /// <summary>How many candidates the variant found.</summary>
    public required int AantalKandidaten { get; init; }

    /// <summary>How many gold codes the case has.</summary>
    public required int AantalGouden { get; init; }

    /// <summary>How many of them were among the candidates.</summary>
    public required int GoudenInKandidaten { get; init; }

    /// <summary>Embedding tokens spent on this case, retries and a failed selection included.</summary>
    public int EmbeddingTokens { get; init; }

    /// <summary>The embedding deployment, if the variant used one.</summary>
    public string? EmbeddingModel { get; init; }

    /// <summary>Why no candidates could be found, if so.</summary>
    public string? Fout { get; init; }
}

/// <summary>One model's answer to one case in one variant.</summary>
public sealed record GevalResultaat
{
    /// <summary>The variant's name.</summary>
    public required string Variant { get; init; }

    /// <summary>The deployment.</summary>
    public required string Model { get; init; }

    /// <summary>The case.</summary>
    public required string GevalId { get; init; }

    /// <summary>The score; a failed call scores as "nothing proposed".</summary>
    public required GevalScore Score { get; init; }

    /// <summary>
    /// Whether the deployment returned a response, valid or not. Such a call was billed, so it counts in the cost and
    /// the latency even when its answer was rejected.
    /// </summary>
    public bool Beantwoord { get; init; }

    /// <summary>How many attempts the call took (more than one after a 429).</summary>
    public int Pogingen { get; init; } = 1;

    /// <summary>The token usage the provider reported, if any.</summary>
    public AiUsage? Verbruik { get; init; }

    /// <summary>How long the last attempt took; waits after a 429 are not included.</summary>
    public TimeSpan Duur { get; init; }

    /// <summary>What went wrong, if something did.</summary>
    public string? Fout { get; init; }
}

/// <summary>Everything a run measured; <see cref="ReportWriter"/> turns it into markdown.</summary>
public sealed record EvalRapport
{
    /// <summary>When the run started.</summary>
    public required DateTimeOffset Gestart { get; init; }

    /// <summary>The evalset's description.</summary>
    public string? Omschrijving { get; init; }

    /// <summary>The Op.stap version the gold codes refer to.</summary>
    public string? OpstapVersie { get; init; }

    /// <summary>How many cases the evalset has.</summary>
    public required int AantalGevallen { get; init; }

    /// <summary>How the goals were written out.</summary>
    public required DoelWeergave Weergave { get; init; }

    /// <summary>The ceiling on suggestions per case.</summary>
    public required int MaxSuggesties { get; init; }

    /// <summary>The variants, in run order.</summary>
    public required IReadOnlyList<string> Varianten { get; init; }

    /// <summary>The deployments, in run order.</summary>
    public required IReadOnlyList<string> Modellen { get; init; }

    /// <summary>What each variant found per case.</summary>
    public required IReadOnlyList<KandidaatMeting> Kandidaten { get; init; }

    /// <summary>Every model answer.</summary>
    public required IReadOnlyList<GevalResultaat> Resultaten { get; init; }

    /// <summary>The price list, by deployment name.</summary>
    public required IReadOnlyDictionary<string, ModelPrice> Prijzen { get; init; }
}

/// <summary>
/// Runs every case through every variant and every model, and records what happened. It never persists anything and
/// never touches a school's data: the only calls are the catalogue (read-only), the embedding deployment and the chat
/// deployments. A failed call, a timeout included, is recorded and the run goes on; only a cancellation the caller
/// requested stops it.
/// </summary>
public sealed class EvalRunner
{
    private readonly IReadOnlyList<IKandidaatSelectie> _variants;
    private readonly IReadOnlyList<EvalModel> _models;
    private readonly DoelWeergave _goalFormat;
    private readonly int _maxSuggestions;
    private readonly IReadOnlyDictionary<string, ModelPrice> _prices;
    private readonly Action<string>? _log;
    private readonly TimeProvider _time;
    private readonly TimeSpan _throttleWait;

    /// <summary>Creates a runner over the given variants and models.</summary>
    public EvalRunner(
        IReadOnlyList<IKandidaatSelectie> variants,
        IReadOnlyList<EvalModel> models,
        DoelWeergave goalFormat,
        int maxSuggestions,
        IReadOnlyDictionary<string, ModelPrice>? prices = null,
        Action<string>? log = null,
        TimeProvider? time = null,
        TimeSpan? throttleWait = null)
    {
        ArgumentNullException.ThrowIfNull(variants);
        ArgumentNullException.ThrowIfNull(models);
        if (variants.Count == 0 || models.Count == 0)
        {
            throw new ArgumentException("A run needs at least one variant and one model.");
        }

        ArgumentOutOfRangeException.ThrowIfLessThan(maxSuggestions, 1);
        _variants = variants;
        _models = models;
        _goalFormat = goalFormat;
        _maxSuggestions = maxSuggestions;
        _prices = prices ?? new Dictionary<string, ModelPrice>();
        _log = log;
        _time = time ?? TimeProvider.System;
        _throttleWait = throttleWait ?? TimeSpan.FromSeconds(15);
    }

    /// <summary>Runs the evalset.</summary>
    public async Task<EvalRapport> RunAsync(Evalset evalset, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(evalset);

        var started = _time.GetUtcNow();
        var metingen = new List<KandidaatMeting>();
        var resultaten = new List<GevalResultaat>();

        foreach (var variant in _variants)
        {
            foreach (var geval in evalset.Gevallen)
            {
                // A requested stop ends the run here, between cases, whatever the last call did.
                cancellationToken.ThrowIfCancellationRequested();

                // A variant retries its own throttled calls (EmbeddingSelectie), so its token count survives a retry.
                KandidaatSet kandidaten;
                try
                {
                    kandidaten = await variant.SelectAsync(geval, cancellationToken);
                }
                catch (Exception ex) when (IsFailure(ex, cancellationToken))
                {
                    // A failed selection may still have spent embedding tokens: they stay in the report.
                    var spent = ex as CandidateSelectionException;
                    var leeg = Scoring.Score(geval.GoudenCodes, [], []);
                    metingen.Add(new KandidaatMeting
                    {
                        Variant = variant.Naam,
                        GevalId = geval.Id,
                        Leeftijd = geval.Subthema.Leeftijd,
                        AantalKandidaten = 0,
                        AantalGouden = leeg.Gouden.Count,
                        GoudenInKandidaten = 0,
                        EmbeddingTokens = spent?.EmbeddingTokens ?? 0,
                        EmbeddingModel = spent?.EmbeddingModel,
                        Fout = ex.Message,
                    });
                    resultaten.AddRange(_models.Select(m => new GevalResultaat
                    {
                        Variant = variant.Naam,
                        Model = m.Naam,
                        GevalId = geval.Id,
                        Score = leeg,
                        Pogingen = 0,
                        Fout = $"kandidaten niet gevonden: {ex.Message}",
                    }));
                    _log?.Invoke($"{variant.Naam} | {geval.Id}: kandidaten niet gevonden ({ex.Message})");
                    continue;
                }

                var codes = kandidaten.Doelen.Select(d => d.Code).ToList();
                var zonderAntwoord = Scoring.Score(geval.GoudenCodes, codes, []);
                metingen.Add(new KandidaatMeting
                {
                    Variant = variant.Naam,
                    GevalId = geval.Id,
                    Leeftijd = geval.Subthema.Leeftijd,
                    AantalKandidaten = zonderAntwoord.AantalKandidaten,
                    AantalGouden = zonderAntwoord.Gouden.Count,
                    GoudenInKandidaten = zonderAntwoord.GoudenInKandidaten,
                    EmbeddingTokens = kandidaten.EmbeddingTokens,
                    EmbeddingModel = kandidaten.EmbeddingModel,
                });

                var request = EvalPrompt.Build(geval, kandidaten.Doelen, _goalFormat, _maxSuggestions);
                foreach (var model in _models)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    resultaten.Add(await AskAsync(variant.Naam, model, geval, codes, request, cancellationToken));
                }
            }
        }

        // The last check: a stop that arrived with the very last call ends the run as a cancellation too, not as a report.
        cancellationToken.ThrowIfCancellationRequested();

        return new EvalRapport
        {
            Gestart = started,
            Omschrijving = evalset.Omschrijving,
            OpstapVersie = evalset.OpstapVersie,
            AantalGevallen = evalset.Gevallen.Count,
            Weergave = _goalFormat,
            MaxSuggesties = _maxSuggestions,
            Varianten = _variants.Select(v => v.Naam).ToList(),
            Modellen = _models.Select(m => m.Naam).ToList(),
            Kandidaten = metingen,
            Resultaten = resultaten,
            Prijzen = _prices,
        };
    }

    private async Task<GevalResultaat> AskAsync(
        string variant,
        EvalModel model,
        EvalGeval geval,
        IReadOnlyList<string> codes,
        AiRequest request,
        CancellationToken cancellationToken)
    {
        // Only the last attempt is timed: a wait after a 429 says something about the quota, not about the model.
        var attempts = 0;
        var duration = TimeSpan.Zero;
        AiCompletion completion;
        try
        {
            completion = await Retry.WhenThrottledAsync(
                async () =>
                {
                    attempts++;
                    var stopwatch = Stopwatch.StartNew();
                    try
                    {
                        return await model.Client.CompleteAsync(request, cancellationToken);
                    }
                    finally
                    {
                        duration = stopwatch.Elapsed;
                    }
                },
                _throttleWait,
                _log,
                cancellationToken);
        }
        catch (Exception ex) when (IsFailure(ex, cancellationToken))
        {
            _log?.Invoke($"{variant} | {model.Naam} | {geval.Id}: aanroep mislukt ({ex.Message})");
            return new GevalResultaat
            {
                Variant = variant,
                Model = model.Naam,
                GevalId = geval.Id,
                Score = Scoring.Score(geval.GoudenCodes, codes, []),
                Pogingen = attempts,
                Duur = duration,
                Fout = ex.Message,
            };
        }

        // The production parser: an answer production would reject counts as "nothing proposed" here (Art. IV.5).
        var parse = DoelMatchResponseParser.Parse(completion);

        // As production step 6 does (ThemaOpbouwAssistService): a themadoel already chosen is never proposed again,
        // so such a code is dropped before scoring rather than counted as a hit or an error.
        var themadoelen = new HashSet<string>(
            (geval.Thema.GekozenThemadoelCodes ?? []).Where(c => !string.IsNullOrWhiteSpace(c)).Select(c => c.Trim()),
            StringComparer.Ordinal);
        var voorgesteld = parse.IsGeldig
            ? parse.Suggesties.Select(s => s.Code).Where(c => !themadoelen.Contains(c)).ToList()
            : new List<string>();
        var score = Scoring.Score(geval.GoudenCodes, codes, voorgesteld);

        _log?.Invoke(
            $"{variant} | {model.Naam} | {geval.Id}: {score.Treffers.Count} van {score.Gouden.Count} gouden doelen, " +
            $"{score.AantalVoorgesteld} voorgesteld");

        return new GevalResultaat
        {
            Variant = variant,
            Model = model.Naam,
            GevalId = geval.Id,
            Score = score,
            Beantwoord = true,
            Pogingen = attempts,
            Verbruik = completion.Usage,
            Duur = duration,
            Fout = parse.IsGeldig ? null : $"ongeldig antwoord: {parse.Fout}",
        };
    }

    /// <summary>
    /// Whether <paramref name="ex"/> is a failure to record rather than the stop the caller asked for. Only a
    /// cancellation that was requested is a stop; an HTTP timeout is an OperationCanceledException nobody asked for,
    /// and any other exception is a failure even when a stop happens to arrive at the same moment (the loop then stops
    /// at its next check).
    /// </summary>
    internal static bool IsFailure(Exception ex, CancellationToken cancellationToken) =>
        ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested;
}
