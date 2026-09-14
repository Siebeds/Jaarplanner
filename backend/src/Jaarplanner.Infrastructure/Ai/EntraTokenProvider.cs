using Azure.Core;

namespace Jaarplanner.Infrastructure.Ai;

/// <summary>
/// Hands out a Microsoft Entra access token for Azure OpenAI and keeps it until shortly before it expires (ADR-0036).
/// <para>
/// A <see cref="TokenCredential"/> does not necessarily cache: <c>AzureCliCredential</c> starts the Azure CLI on every
/// call, and caching is normally done by Azure.Core's bearer-token pipeline policy, which a plain
/// <see cref="HttpClient"/> does not have. Without this class every AI call would pay for a fresh sign-in.
/// </para>
/// </summary>
public sealed class EntraTokenProvider
{
    /// <summary>The token scope Azure OpenAI accepts for Microsoft Entra authentication.</summary>
    public const string Scope = "https://cognitiveservices.azure.com/.default";

    // Renew this long before expiry, so a token never runs out between being handed out and being checked.
    private static readonly TimeSpan RenewalMargin = TimeSpan.FromMinutes(5);

    private readonly TokenCredential _credential;
    private readonly TimeProvider _time;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private AccessToken? _token;

    /// <summary>Creates a provider over <paramref name="credential"/>.</summary>
    public EntraTokenProvider(TokenCredential credential, TimeProvider? time = null)
    {
        ArgumentNullException.ThrowIfNull(credential);
        _credential = credential;
        _time = time ?? TimeProvider.System;
    }

    /// <summary>A valid token, from the cache when it is still good for more than five minutes.</summary>
    public async Task<string> GetTokenAsync(CancellationToken cancellationToken = default)
    {
        await _lock.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            if (_token is not { } token || token.ExpiresOn - RenewalMargin <= _time.GetUtcNow())
            {
                token = await _credential
                    .GetTokenAsync(new TokenRequestContext([Scope]), cancellationToken)
                    .ConfigureAwait(false);
                _token = token;
            }

            return token.Token;
        }
        finally
        {
            _lock.Release();
        }
    }
}
