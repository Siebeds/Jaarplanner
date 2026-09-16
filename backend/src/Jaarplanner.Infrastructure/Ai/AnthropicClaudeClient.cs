using Anthropic;
using Anthropic.Core;
using Anthropic.Models.Messages;
using Jaarplanner.Application.Ai;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Ai;

/// <summary>
/// An <see cref="IAiClient"/> over the Anthropic Claude Messages API (TB-041, ADR-0048), through the official Anthropic
/// SDK. The second provider next to <see cref="AzureAiFoundryClient"/>; <c>Ai:Provider</c> picks one of the two.
/// <para>
/// It sends the caller's system prompt and user prompt unchanged and returns the model's <b>raw</b> text: the JSON
/// contract (Art. IV.5) is asked for in each prompt and validated by each caller's parser, which also strips a markdown
/// fence. The key is set on the SDK client here and nowhere else, and never reaches the frontend (Art. VI.4).
/// Incomplete configuration fails loudly on first use and sends nothing, so a host that never calls AI starts without
/// any AI configuration.
/// </para>
/// </summary>
public sealed class AnthropicClaudeClient : IAiClient
{
    private readonly HttpClient _httpClient;
    private readonly AnthropicOptions _options;

    /// <summary>Constructs the client from the typed <see cref="HttpClient"/> and bound options (DI).</summary>
    public AnthropicClaudeClient(HttpClient httpClient, IOptions<AnthropicOptions> options)
    {
        ArgumentNullException.ThrowIfNull(httpClient);
        ArgumentNullException.ThrowIfNull(options);
        _httpClient = httpClient;
        _options = options.Value;
    }

    /// <inheritdoc />
    public async Task<AiCompletion> CompleteAsync(AiRequest request, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(request);
        EnsureConfigured();

        // Only the configured key authenticates. The SDK would otherwise also send ANTHROPIC_AUTH_TOKEN from the
        // environment as a bearer token, so that is cleared explicitly.
        var client = new AnthropicClient
        {
            HttpClient = _httpClient,
            ApiKey = _options.ApiKey!.Trim(),
            AuthToken = null,
            BaseUrl = string.IsNullOrWhiteSpace(_options.Endpoint)
                ? EnvironmentUrl.Production
                : _options.Endpoint.Trim().TrimEnd('/'),
        };

        var parameters = new MessageCreateParams
        {
            Model = _options.Model!.Trim(),
            MaxTokens = _options.MaxTokens,
            System = request.SystemPrompt,
            Messages = [new() { Role = Role.User, Content = request.UserPrompt }],
            OutputConfig = ParseEffort(_options.Effort) is { } effort ? new OutputConfig { Effort = effort } : null,
        };

        var message = await client.Messages.Create(parameters, cancellationToken).ConfigureAwait(false);

        // A refusal carries no usable answer. The message names no content: a request can carry pupil text (ADR-0035 §3.8).
        if (message.StopReason == StopReason.Refusal)
        {
            throw new InvalidOperationException("The Claude API declined the request (stop_reason 'refusal').");
        }

        var content = string.Concat(message.Content.Select(b => b.Value).OfType<TextBlock>().Select(t => t.Text));
        return new AiCompletion { Content = content, Usage = ReadUsage(message.Usage) };
    }

    // The provider's own count, for measuring cost (TB-004). Cache writes are billed as input, so they count as input.
    private static AiUsage ReadUsage(Usage usage) => new()
    {
        InputTokens = ToInt(usage.InputTokens + (usage.CacheCreationInputTokens ?? 0) + (usage.CacheReadInputTokens ?? 0)),
        CachedInputTokens = ToInt(usage.CacheReadInputTokens ?? 0),
        OutputTokens = ToInt(usage.OutputTokens),
    };

    private static int ToInt(long value) => (int)Math.Clamp(value, 0, int.MaxValue);

    private static Effort? ParseEffort(string? effort) => effort?.Trim().ToLowerInvariant() switch
    {
        null or "" => null,
        "low" => Effort.Low,
        "medium" => Effort.Medium,
        "high" => Effort.High,
        "xhigh" => Effort.Xhigh,
        "max" => Effort.Max,
        _ => throw new InvalidOperationException(
            $"'Anthropic:Effort' is '{effort}'; use low, medium, high, xhigh or max, or leave it empty."),
    };

    private void EnsureConfigured()
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey) || string.IsNullOrWhiteSpace(_options.Model))
        {
            throw new InvalidOperationException(
                "The Claude API is not configured. Set 'Anthropic:Model' and the server-side secret 'Anthropic:ApiKey' " +
                "(user-secrets locally / Key Vault in the cloud), and optionally 'Anthropic:Endpoint'.");
        }

        if (_options.MaxTokens < 1)
        {
            throw new InvalidOperationException("'Anthropic:MaxTokens' must be at least 1.");
        }

        _ = ParseEffort(_options.Effort);
    }
}
