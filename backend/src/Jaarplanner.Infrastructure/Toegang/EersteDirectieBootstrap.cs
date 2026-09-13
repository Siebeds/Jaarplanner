using Jaarplanner.Application.Toegang;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Jaarplanner.Infrastructure.Toegang;

/// <summary>
/// Provisions the first directie account at startup (ADR-0031 decision 7, ADR-0030 D1): nobody exists yet who could
/// invite anyone, so the address comes from configuration (<see cref="ConfiguratieSleutel"/>).
/// <para>
/// <b>Only registered when the key is set</b>, and <see cref="IToegangService.ZorgVoorEersteDirectieAsync"/> only acts
/// on an empty table, so this is a no-op on every start after the first.
/// </para>
/// <para>
/// <b>It never stops the app.</b> A database that is down or not yet migrated is logged as an error and the app starts
/// anyway, the same way the health check reports a missing database instead of crashing on it.
/// </para>
/// </summary>
public sealed class EersteDirectieBootstrap : IHostedService
{
    /// <summary>The configuration key holding the first directie's address.</summary>
    public const string ConfiguratieSleutel = "Authenticatie:EersteDirectie";

    private readonly IServiceScopeFactory _scopes;
    private readonly string _email;
    private readonly ILogger<EersteDirectieBootstrap> _logger;

    public EersteDirectieBootstrap(IServiceScopeFactory scopes, string email, ILogger<EersteDirectieBootstrap> logger)
    {
        _scopes = scopes;
        _email = email;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var scope = _scopes.CreateAsyncScope();
            var toegang = scope.ServiceProvider.GetRequiredService<IToegangService>();
            if (await toegang.ZorgVoorEersteDirectieAsync(_email, cancellationToken))
            {
                _logger.LogInformation("Provisioned the first directie account from {Sleutel}.", ConfiguratieSleutel);
            }
        }
        catch (Exception fout) when (fout is not OperationCanceledException)
        {
            _logger.LogError(fout, "Could not provision the first directie account from {Sleutel}; nobody can log in until it exists.", ConfiguratieSleutel);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
