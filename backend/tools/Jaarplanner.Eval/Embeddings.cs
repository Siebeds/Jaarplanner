using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Jaarplanner.Infrastructure.Ai;

namespace Jaarplanner.Eval;

/// <summary>The vectors for a batch of texts, in the order the texts were given, and the tokens it cost.</summary>
public sealed record EmbeddingAntwoord(IReadOnlyList<float[]> Vectoren, int Tokens);

/// <summary>Turns texts into vectors. Faked in tests; the real one is <see cref="AzureEmbeddingClient"/>.</summary>
public interface IEmbeddingClient
{
    /// <summary>The embedding deployment, as the report and the cache name it.</summary>
    string Model { get; }

    /// <summary>Embeds <paramref name="teksten"/>.</summary>
    Task<EmbeddingAntwoord> EmbedAsync(IReadOnlyList<string> teksten, CancellationToken cancellationToken);
}

/// <summary>
/// Calls the Azure OpenAI v1 embeddings route, <c>{endpoint}/openai/v1/embeddings</c> (ADR-0036), with a key or with a
/// Microsoft Entra token, like <see cref="AzureAiFoundryClient"/>. Used by the eval runner only.
/// </summary>
public sealed class AzureEmbeddingClient : IEmbeddingClient
{
    private readonly HttpClient _http;
    private readonly string _endpoint;
    private readonly string? _apiKey;
    private readonly EntraTokenProvider? _entra;

    /// <summary>Creates the client for one embedding deployment; give either a key or an Entra token provider.</summary>
    public AzureEmbeddingClient(HttpClient http, string endpoint, string model, string? apiKey, EntraTokenProvider? entra)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentException.ThrowIfNullOrWhiteSpace(endpoint);
        ArgumentException.ThrowIfNullOrWhiteSpace(model);
        if (string.IsNullOrWhiteSpace(apiKey) && entra is null)
        {
            throw new ArgumentException("Give an API key or an Entra token provider.");
        }

        _http = http;
        _endpoint = endpoint.TrimEnd('/');
        _apiKey = string.IsNullOrWhiteSpace(apiKey) ? null : apiKey;
        _entra = entra;
        Model = model.Trim();
    }

    /// <inheritdoc />
    public string Model { get; }

    /// <inheritdoc />
    public async Task<EmbeddingAntwoord> EmbedAsync(IReadOnlyList<string> teksten, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(teksten);

        using var request = new HttpRequestMessage(HttpMethod.Post, $"{_endpoint}/openai/v1/embeddings")
        {
            Content = JsonContent.Create(new { model = Model, input = teksten }),
        };

        if (_apiKey is not null)
        {
            request.Headers.Add("api-key", _apiKey);
        }
        else
        {
            request.Headers.Authorization =
                new AuthenticationHeaderValue("Bearer", await _entra!.GetTokenAsync(cancellationToken));
        }

        using var response = await _http.SendAsync(request, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);

        var vectors = new float[teksten.Count][];
        foreach (var item in document.RootElement.GetProperty("data").EnumerateArray())
        {
            var index = item.GetProperty("index").GetInt32();
            vectors[index] = item.GetProperty("embedding").EnumerateArray().Select(v => v.GetSingle()).ToArray();
        }

        if (vectors.Any(v => v is null))
        {
            throw new InvalidOperationException("The embeddings response did not contain a vector for every text.");
        }

        var tokens = document.RootElement.TryGetProperty("usage", out var usage)
            && usage.TryGetProperty("prompt_tokens", out var promptTokens)
            && promptTokens.ValueKind == JsonValueKind.Number
                ? promptTokens.GetInt32()
                : 0;

        return new EmbeddingAntwoord(vectors, tokens);
    }
}

/// <summary>
/// Goal vectors on disk, one JSON file per embedding deployment, keyed by a hash of the embedded text. It holds the
/// public catalogue only. Without a folder it lives in memory, which is what the tests use.
/// </summary>
public sealed class EmbeddingCache
{
    private readonly string? _folder;
    private readonly Dictionary<string, Dictionary<string, string>> _byModel = new(StringComparer.Ordinal);

    /// <summary>Creates the cache in <paramref name="folder"/>, or in memory when it is null.</summary>
    public EmbeddingCache(string? folder) => _folder = folder;

    /// <summary>The vector stored for <paramref name="text"/> under <paramref name="model"/>, if any.</summary>
    public bool TryGet(string model, string text, out float[] vector)
    {
        if (ForModel(model).TryGetValue(Key(text), out var stored))
        {
            vector = ToVector(stored);
            return true;
        }

        vector = [];
        return false;
    }

    /// <summary>Stores a vector; call <see cref="Save"/> to write it to disk.</summary>
    public void Put(string model, string text, float[] vector) => ForModel(model)[Key(text)] = ToText(vector);

    /// <summary>Writes every loaded model's vectors to disk (nothing when the cache lives in memory).</summary>
    public void Save()
    {
        if (_folder is null)
        {
            return;
        }

        Directory.CreateDirectory(_folder);
        foreach (var (model, vectors) in _byModel)
        {
            File.WriteAllText(PathFor(model), JsonSerializer.Serialize(vectors));
        }
    }

    private Dictionary<string, string> ForModel(string model)
    {
        if (!_byModel.TryGetValue(model, out var vectors))
        {
            vectors = Load(model);
            _byModel[model] = vectors;
        }

        return vectors;
    }

    private Dictionary<string, string> Load(string model)
    {
        if (_folder is null || !File.Exists(PathFor(model)))
        {
            return new Dictionary<string, string>(StringComparer.Ordinal);
        }

        return JsonSerializer.Deserialize<Dictionary<string, string>>(File.ReadAllText(PathFor(model)))
            ?? new Dictionary<string, string>(StringComparer.Ordinal);
    }

    private string PathFor(string model) =>
        Path.Combine(_folder!, $"embeddings-{string.Concat(model.Select(c => char.IsLetterOrDigit(c) || c is '-' or '.' ? c : '_'))}.json");

    private static string Key(string text) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(text)));

    private static string ToText(float[] vector)
    {
        var bytes = new byte[vector.Length * sizeof(float)];
        Buffer.BlockCopy(vector, 0, bytes, 0, bytes.Length);
        return Convert.ToBase64String(bytes);
    }

    private static float[] ToVector(string text)
    {
        var bytes = Convert.FromBase64String(text);
        var vector = new float[bytes.Length / sizeof(float)];
        Buffer.BlockCopy(bytes, 0, vector, 0, bytes.Length);
        return vector;
    }
}
