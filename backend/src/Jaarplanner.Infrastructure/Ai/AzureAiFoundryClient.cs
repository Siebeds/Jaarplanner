using System.Net.Http.Json;
using System.Text.Json;
using Jaarplanner.Application.Ai;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Ai;

/// <summary>
/// The real <see cref="IAiClient"/> — a thin adapter over the Azure AI Foundry (Azure OpenAI)
/// chat-completions REST API (Art. VIII: the AI client lives in Infrastructure). It reads its
/// endpoint/key/deployment from <see cref="AzureAIOptions"/> (server-side config only, Art. VI.4)
/// and returns the model's <b>raw</b> completion text — validation of that text against the
/// structured-JSON contract is a separate concern (E2-03).
/// <para>
/// The key never leaves the backend: it is set on the request's <c>api-key</c> header here and is
/// never surfaced to the frontend. Missing configuration fails loudly on first use (rather than at
/// startup), so local/dev/test hosts that never call AI keep running with no AI config.
/// </para>
/// </summary>
public sealed class AzureAiFoundryClient : IAiClient
{
    private readonly HttpClient _httpClient;
    private readonly AzureAIOptions _options;

    /// <summary>Constructs the client from the typed <see cref="HttpClient"/> and bound options (DI).</summary>
    public AzureAiFoundryClient(HttpClient httpClient, IOptions<AzureAIOptions> options)
    {
        ArgumentNullException.ThrowIfNull(httpClient);
        ArgumentNullException.ThrowIfNull(options);
        _httpClient = httpClient;
        _options = options.Value;
    }

    /// <inheritdoc />
    public async Task<AiCompletion> CompleteAsync(
        AiRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        EnsureConfigured();

        // Azure OpenAI chat-completions: POST {endpoint}/openai/deployments/{deployment}/chat/completions?api-version=...
        var uri =
            $"{_options.Endpoint!.TrimEnd('/')}/openai/deployments/{_options.Deployment}/chat/completions" +
            $"?api-version={_options.ApiVersion}";

        var payload = new
        {
            messages = new[]
            {
                new { role = "system", content = request.SystemPrompt },
                new { role = "user", content = request.UserPrompt },
            },
            // Always ask the model for structured JSON (Art. IV.5); it is validated downstream (E2-03).
            response_format = new { type = "json_object" },
        };

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = JsonContent.Create(payload),
        };
        // Server-side secret set here only — never exposed to the frontend (Art. VI.4).
        httpRequest.Headers.Add("api-key", _options.ApiKey);

        using var response = await _httpClient
            .SendAsync(httpRequest, cancellationToken)
            .ConfigureAwait(false);
        response.EnsureSuccessStatusCode();

        await using var stream = await response.Content
            .ReadAsStreamAsync(cancellationToken)
            .ConfigureAwait(false);
        using var document = await JsonDocument
            .ParseAsync(stream, cancellationToken: cancellationToken)
            .ConfigureAwait(false);

        // Extract the raw assistant message (choices[0].message.content); leave parsing to E2-03.
        var content = document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;

        return new AiCompletion { Content = content };
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.Endpoint) ||
            string.IsNullOrWhiteSpace(_options.ApiKey) ||
            string.IsNullOrWhiteSpace(_options.Deployment))
        {
            throw new InvalidOperationException(
                "Azure AI Foundry is not configured. Set 'AzureAI:Endpoint', 'AzureAI:Deployment' and " +
                "the server-side secret 'AzureAI:ApiKey' (user-secrets locally / Key Vault in the cloud).");
        }
    }
}
