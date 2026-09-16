using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Azure.Identity;
using Jaarplanner.Application.Ai;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Ai;

/// <summary>
/// The real <see cref="IAiClient"/> — a thin adapter over the Azure AI Foundry (Azure OpenAI)
/// chat-completions REST API (Art. VIII: the AI client lives in Infrastructure). It reads its
/// endpoint, deployment and credentials from <see cref="AzureAIOptions"/> (server-side config only, Art. VI.4)
/// and returns the model's <b>raw</b> completion text — validation of that text against the
/// structured-JSON contract is a separate concern (E2-03).
/// <para>
/// <b>Prompt order (TB-043).</b> The system message is the system prompt followed by the stable context
/// (<see cref="AiRequest.VasteContext"/>), the user message the user prompt. The service caches an identical prefix on
/// its own, so the order is all it needs. An answer cut off at <c>max_completion_tokens</c>
/// (<c>finish_reason</c> <c>length</c>) becomes an <see cref="AiAntwoordAfgekaptFout"/>.
/// </para>
/// <para>
/// <b>The v1 API (ADR-0036).</b> Requests go to <c>{endpoint}/openai/v1/chat/completions</c> with the deployment as
/// <c>model</c>. That route needs no monthly <c>api-version</c>, and it is the one the gpt-5 family is served on.
/// </para>
/// <para>
/// <b>Authentication.</b> By default the key is set on the request's <c>api-key</c> header here and nowhere else, and it
/// never reaches the frontend (Art. VI.4). Only when <see cref="AzureAIOptions.Authentication"/> says
/// <see cref="AzureAIAuthentication.Entra"/> does the client ask Microsoft Entra for a token instead; that is an
/// explicit choice, never a fallback for a missing key. Incomplete configuration fails loudly on first use (rather than
/// at startup) and sends nothing, so local/dev/test hosts that never call AI keep running with no AI config.
/// </para>
/// </summary>
public sealed class AzureAiFoundryClient : IAiClient
{
    // Created only when a host opts into Entra, and shared by every client instance the typed HttpClient factory makes,
    // so the token cache in EntraTokenProvider is shared too.
    private static readonly Lazy<EntraTokenProvider> SharedEntra =
        new(() => new EntraTokenProvider(new DefaultAzureCredential()));

    private readonly HttpClient _httpClient;
    private readonly AzureAIOptions _options;
    private readonly Func<EntraTokenProvider> _entra;

    /// <summary>Constructs the client from the typed <see cref="HttpClient"/> and bound options (DI).</summary>
    [ActivatorUtilitiesConstructor]
    public AzureAiFoundryClient(HttpClient httpClient, IOptions<AzureAIOptions> options)
        : this(httpClient, options, () => SharedEntra.Value)
    {
    }

    /// <summary>
    /// The same client with a given Entra token provider, used when <see cref="AzureAIOptions.Authentication"/> is
    /// <see cref="AzureAIAuthentication.Entra"/>. The eval runner passes one over the Azure CLI.
    /// </summary>
    public AzureAiFoundryClient(HttpClient httpClient, IOptions<AzureAIOptions> options, EntraTokenProvider entra)
        : this(httpClient, options, Returning(entra))
    {
    }

    private AzureAiFoundryClient(HttpClient httpClient, IOptions<AzureAIOptions> options, Func<EntraTokenProvider> entra)
    {
        ArgumentNullException.ThrowIfNull(httpClient);
        ArgumentNullException.ThrowIfNull(options);
        _httpClient = httpClient;
        _options = options.Value;
        _entra = entra;
    }

    /// <inheritdoc />
    public async Task<AiCompletion> CompleteAsync(
        AiRequest request,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        EnsureConfigured();

        var uri = $"{_options.Endpoint!.TrimEnd('/')}/openai/v1/chat/completions";

        var payload = new Dictionary<string, object>
        {
            ["model"] = _options.Deployment!.Trim(),
            ["messages"] = new[]
            {
                new { role = "system", content = Systeembericht(request) },
                new { role = "user", content = request.UserPrompt },
            },
            // Always ask the model for structured JSON (Art. IV.5); it is validated downstream (E2-03).
            ["response_format"] = new { type = "json_object" },
        };

        // Only when configured: a model that does not know these parameters must never receive them.
        if (!string.IsNullOrWhiteSpace(_options.ReasoningEffort))
        {
            payload["reasoning_effort"] = _options.ReasoningEffort.Trim();
        }

        if (_options.MaxCompletionTokens is { } maxCompletionTokens)
        {
            payload["max_completion_tokens"] = maxCompletionTokens;
        }

        using var httpRequest = new HttpRequestMessage(HttpMethod.Post, uri)
        {
            Content = JsonContent.Create(payload),
        };
        await AuthenticateAsync(httpRequest, cancellationToken).ConfigureAwait(false);

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
        var choice = document.RootElement.GetProperty("choices")[0];

        // Cut off at max_completion_tokens: the JSON is incomplete, so no caller may parse or persist it (TB-043).
        if (choice.TryGetProperty("finish_reason", out var finishReason)
            && finishReason.ValueKind == JsonValueKind.String
            && finishReason.GetString() == "length")
        {
            throw new AiAntwoordAfgekaptFout();
        }

        var content = choice
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;

        return new AiCompletion { Content = content, Usage = ReadUsage(document.RootElement) };
    }

    // The system prompt, then the stable context after a blank line (TB-043): the same bytes for every request of the
    // same kind, so the provider's automatic prompt cache (identical prefixes from 1,024 tokens) can match them.
    private static string Systeembericht(AiRequest request) =>
        string.IsNullOrEmpty(request.VasteContext)
            ? request.SystemPrompt
            : request.SystemPrompt + "\n\n" + request.VasteContext;

    // Server-side credentials are attached here only — never exposed to the frontend (Art. VI.4).
    private async Task AuthenticateAsync(HttpRequestMessage httpRequest, CancellationToken cancellationToken)
    {
        if (_options.Authentication == AzureAIAuthentication.Entra)
        {
            var token = await _entra().GetTokenAsync(cancellationToken).ConfigureAwait(false);
            httpRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
            return;
        }

        httpRequest.Headers.Add("api-key", _options.ApiKey);
    }

    // The provider's own count. Absent or malformed usage yields null or zeroes, never an exception: usage is for
    // measuring cost (TB-004) and must not be able to fail a request whose content arrived fine.
    private static AiUsage? ReadUsage(JsonElement root)
    {
        if (!root.TryGetProperty("usage", out var usage) || usage.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return new AiUsage
        {
            InputTokens = ReadInt(usage, "prompt_tokens"),
            OutputTokens = ReadInt(usage, "completion_tokens"),
            CachedInputTokens = ReadNestedInt(usage, "prompt_tokens_details", "cached_tokens"),
            ReasoningTokens = ReadNestedInt(usage, "completion_tokens_details", "reasoning_tokens"),
        };
    }

    private static int ReadNestedInt(JsonElement element, string objectName, string name) =>
        element.TryGetProperty(objectName, out var nested) && nested.ValueKind == JsonValueKind.Object
            ? ReadInt(nested, name)
            : 0;

    private static int ReadInt(JsonElement element, string name) =>
        element.TryGetProperty(name, out var value)
        && value.ValueKind == JsonValueKind.Number
        && value.TryGetInt32(out var number)
            ? number
            : 0;

    private static Func<EntraTokenProvider> Returning(EntraTokenProvider entra)
    {
        ArgumentNullException.ThrowIfNull(entra);
        return () => entra;
    }

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.Endpoint) ||
            string.IsNullOrWhiteSpace(_options.Deployment) ||
            (_options.Authentication == AzureAIAuthentication.Key && string.IsNullOrWhiteSpace(_options.ApiKey)))
        {
            throw new InvalidOperationException(
                "Azure AI Foundry is not configured. Set 'AzureAI:Endpoint', 'AzureAI:Deployment' and " +
                "the server-side secret 'AzureAI:ApiKey' (user-secrets locally / Key Vault in the cloud), " +
                "or set 'AzureAI:Authentication' to 'Entra' to sign in with Microsoft Entra instead.");
        }
    }
}
