using System.Text;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Eval;

/// <summary>The candidates one variant hands the model for one case, and what finding them cost.</summary>
/// <param name="Doelen">The leerplandoelen the model may choose from.</param>
/// <param name="EmbeddingTokens">Embedding tokens spent to find them (0 without retrieval).</param>
/// <param name="EmbeddingModel">The embedding deployment used, if any.</param>
public sealed record KandidaatSet(IReadOnlyList<Leerplandoel> Doelen, int EmbeddingTokens = 0, string? EmbeddingModel = null);

/// <summary>A way of choosing the candidate leerplandoelen for a subthema: one variant of the comparison.</summary>
public interface IKandidaatSelectie
{
    /// <summary>The variant's name as the report shows it.</summary>
    string Naam { get; }

    /// <summary>Chooses the candidates for <paramref name="geval"/>.</summary>
    Task<KandidaatSet> SelecteerAsync(EvalGeval geval, CancellationToken cancellationToken);
}

/// <summary>
/// Finding the candidates failed after embedding tokens were already spent. It carries them, so the report can still
/// show what the failed case cost.
/// </summary>
public sealed class CandidateSelectionException(string message, int embeddingTokens, string embeddingModel, Exception inner)
    : Exception(message, inner)
{
    /// <summary>The embedding tokens spent before the failure.</summary>
    public int EmbeddingTokens { get; } = embeddingTokens;

    /// <summary>The embedding deployment that was used.</summary>
    public string EmbeddingModel { get; } = embeddingModel;
}

/// <summary>
/// Variant A, without retrieval: every leerplandoel of the subthema's jaar/fase. What the model receives is then the
/// whole relevant part of the catalogue, and the only filter is the one the domain already fixes (Art. IX.2).
/// </summary>
public sealed class JaarfaseSelectie : IKandidaatSelectie
{
    private readonly ILeerdoelCatalogus _catalogus;

    /// <summary>Creates the variant over the read-only catalogue.</summary>
    public JaarfaseSelectie(ILeerdoelCatalogus catalogus)
    {
        ArgumentNullException.ThrowIfNull(catalogus);
        _catalogus = catalogus;
    }

    /// <inheritdoc />
    public string Naam => "A: jaarfase, zonder retrieval";

    /// <inheritdoc />
    public async Task<KandidaatSet> SelecteerAsync(EvalGeval geval, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(geval);
        return new KandidaatSet(await Jaarfase.DoelenAsync(_catalogus, geval, cancellationToken));
    }
}

/// <summary>
/// Variant B, with embeddings: the same jaar/fase set, ranked by cosine similarity between each goal and a text built
/// from the subthema, of which the top <c>n</c> go to the model. Goal vectors are cached on disk; they hold only the
/// public catalogue. The subthema's own vector is never cached, so no school content lands in the cache.
/// <para>
/// Each embedding call waits out a 429 on its own, so the tokens of batches that already succeeded stay counted; and a
/// call that fails for good raises a <see cref="CandidateSelectionException"/> that still carries them.
/// </para>
/// </summary>
public sealed class EmbeddingSelectie : IKandidaatSelectie
{
    private const int BatchSize = 64;

    private readonly ILeerdoelCatalogus _catalogus;
    private readonly IEmbeddingClient _embeddings;
    private readonly EmbeddingCache _cache;
    private readonly int _top;
    private readonly TimeSpan _throttleWait;
    private readonly Action<string>? _log;

    /// <summary>Creates the variant; <paramref name="top"/> is how many candidates reach the model.</summary>
    public EmbeddingSelectie(
        ILeerdoelCatalogus catalogus,
        IEmbeddingClient embeddings,
        EmbeddingCache cache,
        int top,
        TimeSpan? throttleWait = null,
        Action<string>? log = null)
    {
        ArgumentNullException.ThrowIfNull(catalogus);
        ArgumentNullException.ThrowIfNull(embeddings);
        ArgumentNullException.ThrowIfNull(cache);
        ArgumentOutOfRangeException.ThrowIfLessThan(top, 1);
        _catalogus = catalogus;
        _embeddings = embeddings;
        _cache = cache;
        _top = top;
        _throttleWait = throttleWait ?? TimeSpan.FromSeconds(15);
        _log = log;
    }

    /// <inheritdoc />
    public string Naam => $"B: embeddings ({_embeddings.Model}), top {_top}";

    /// <inheritdoc />
    public async Task<KandidaatSet> SelecteerAsync(EvalGeval geval, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(geval);

        var doelen = await Jaarfase.DoelenAsync(_catalogus, geval, cancellationToken);
        if (doelen.Count <= _top)
        {
            return new KandidaatSet(doelen, 0, _embeddings.Model);
        }

        var texts = doelen.Select(DoelTekst).ToList();
        var vectors = new float[doelen.Count][];
        var missing = new List<int>();
        for (var i = 0; i < doelen.Count; i++)
        {
            if (_cache.TryGet(_embeddings.Model, texts[i], out var vector))
            {
                vectors[i] = vector;
            }
            else
            {
                missing.Add(i);
            }
        }

        var tokens = 0;
        var added = false;
        float[] queryVector;
        try
        {
            foreach (var batch in missing.Chunk(BatchSize))
            {
                var answer = await EmbedAsync(batch.Select(i => texts[i]).ToList(), cancellationToken);
                if (answer.Vectoren.Count != batch.Length)
                {
                    throw new InvalidOperationException(
                        $"The embeddings call returned {answer.Vectoren.Count} vectors for {batch.Length} texts.");
                }

                tokens += answer.Tokens;
                for (var j = 0; j < batch.Length; j++)
                {
                    vectors[batch[j]] = answer.Vectoren[j];
                    _cache.Put(_embeddings.Model, texts[batch[j]], answer.Vectoren[j]);
                }

                added = true;
            }

            var query = await EmbedAsync([VraagTekst(geval)], cancellationToken);
            tokens += query.Tokens;
            queryVector = query.Vectoren[0];
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // The calls that did succeed were paid for; the report must still see them.
            throw new CandidateSelectionException(ex.Message, tokens, _embeddings.Model, ex);
        }
        finally
        {
            // Keep what was paid for, also when a later call failed.
            if (added)
            {
                _cache.Save();
            }
        }

        var top = doelen
            .Select((doel, i) => (doel, score: Cosinus(queryVector, vectors[i])))
            .OrderByDescending(x => x.score)
            .ThenBy(x => x.doel.Code, StringComparer.Ordinal)
            .Take(_top)
            .Select(x => x.doel)
            .ToList();

        return new KandidaatSet(top, tokens, _embeddings.Model);
    }

    private Task<EmbeddingAntwoord> EmbedAsync(IReadOnlyList<string> texts, CancellationToken cancellationToken) =>
        Retry.WhenThrottledAsync(() => _embeddings.EmbedAsync(texts, cancellationToken), _throttleWait, _log, cancellationToken);

    /// <summary>The text a goal is embedded with: its taxonomy, its text and its examples.</summary>
    internal static string DoelTekst(Leerplandoel doel)
    {
        var sb = new StringBuilder().Append(doel.Domein).Append(" > ").Append(doel.Subdomein);
        if (doel.Cluster is not null)
        {
            sb.Append(" > ").Append(doel.Cluster);
        }

        sb.Append(": ").Append(doel.Tekst);
        if (doel.Voorbeelden is not null)
        {
            sb.Append(" Voorbeelden: ").Append(doel.Voorbeelden);
        }

        return sb.ToString();
    }

    /// <summary>
    /// The text a subthema is embedded with. A subthema's name alone ("De bakker") says little about goals; its
    /// questions, activities and expected outcomes carry the signal, so they are all in it.
    /// </summary>
    internal static string VraagTekst(EvalGeval geval)
    {
        var sb = new StringBuilder();
        sb.Append("Thema: ").Append(geval.Thema.Naam).Append('\n');
        sb.Append("Subthema: ").Append(geval.Subthema.Naam).Append('\n');

        foreach (var ov in geval.Subthema.Onderzoeksvragen ?? [])
        {
            sb.Append("Onderzoeksvraag: ").Append(ov.Vraag).Append('\n');
            if (!string.IsNullOrWhiteSpace(ov.Probleemstelling))
            {
                sb.Append("Probleemstelling: ").Append(ov.Probleemstelling).Append('\n');
            }
        }

        if (!string.IsNullOrWhiteSpace(geval.Subthema.Onderzoeksvraag))
        {
            sb.Append("Onderzoeksvraag: ").Append(geval.Subthema.Onderzoeksvraag).Append('\n');
        }

        if (!string.IsNullOrWhiteSpace(geval.Subthema.Probleemstelling))
        {
            sb.Append("Probleemstelling: ").Append(geval.Subthema.Probleemstelling).Append('\n');
        }

        foreach (var activiteit in geval.Subthema.Activiteiten ?? [])
        {
            sb.Append("Activiteit: ").Append(activiteit.Naam);
            if (!string.IsNullOrWhiteSpace(activiteit.Hoek))
            {
                sb.Append(" (hoek: ").Append(activiteit.Hoek).Append(')');
            }

            if (!string.IsNullOrWhiteSpace(activiteit.VerwachteUitkomsten))
            {
                sb.Append(". Verwachte uitkomsten: ").Append(activiteit.VerwachteUitkomsten);
            }

            sb.Append('\n');
        }

        return sb.ToString();
    }

    /// <summary>The cosine similarity of two vectors of equal length; 0 when either has no length.</summary>
    internal static double Cosinus(float[] a, float[] b)
    {
        if (a.Length != b.Length)
        {
            throw new InvalidOperationException($"Vectors of different length: {a.Length} and {b.Length}.");
        }

        double dot = 0, lengthA = 0, lengthB = 0;
        for (var i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            lengthA += a[i] * a[i];
            lengthB += b[i] * b[i];
        }

        return lengthA == 0 || lengthB == 0 ? 0 : dot / (Math.Sqrt(lengthA) * Math.Sqrt(lengthB));
    }
}

/// <summary>The one filter both variants share: the subthema's jaar/fase.</summary>
internal static class Jaarfase
{
    internal static Task<IReadOnlyList<Leerplandoel>> DoelenAsync(
        ILeerdoelCatalogus catalogus,
        EvalGeval geval,
        CancellationToken cancellationToken) =>
        catalogus.HaalLeerdoelenAsync(new LeerdoelSelectie { JaarFasen = [geval.Subthema.Leeftijd] }, cancellationToken);
}

/// <summary>
/// Remembers what the catalogue returned per selection, so a run with many cases and two variants reads each jaar/fase
/// from the database once. The catalogue is read-only reference data, so nothing can go stale within a run.
/// </summary>
public sealed class CachingCatalogus : ILeerdoelCatalogus
{
    private readonly ILeerdoelCatalogus _source;
    private readonly Dictionary<string, IReadOnlyList<Leerplandoel>> _seen = new(StringComparer.Ordinal);

    /// <summary>Wraps <paramref name="source"/>.</summary>
    public CachingCatalogus(ILeerdoelCatalogus source)
    {
        ArgumentNullException.ThrowIfNull(source);
        _source = source;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<Leerplandoel>> HaalLeerdoelenAsync(
        LeerdoelSelectie selectie,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(selectie);
        var key = string.Join(
            "|",
            KeyPart(selectie.Disciplines),
            KeyPart(selectie.JaarFasen),
            KeyPart(selectie.Codes));

        if (!_seen.TryGetValue(key, out var doelen))
        {
            doelen = await _source.HaalLeerdoelenAsync(selectie, cancellationToken);
            _seen[key] = doelen;
        }

        return doelen;
    }

    private static string KeyPart(IReadOnlyCollection<string>? values) =>
        string.Join(",", (values ?? []).Select(v => v.Trim().ToLowerInvariant()).Order(StringComparer.Ordinal));
}
