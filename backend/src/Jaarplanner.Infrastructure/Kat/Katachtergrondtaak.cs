using Jaarplanner.Application.Kat;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.Kat;

/// <summary>
/// The cat's background job (TB-057, ADR-0059 D1): it wakes at the scheduled moments on the school's clock, claims
/// the tick, and runs one <see cref="Signaalronde"/>.
/// <para>
/// <b>Claiming is inserting.</b> The scheduled moment is <see cref="Kattik"/>'s key, so two instances that wake
/// together both try to insert it and exactly one succeeds; the other sees the key violation and goes back to sleep.
/// No lock is held for the length of the round, and no second instance can take it over: see <see cref="Kattik"/>
/// for why that trade is the right way round here.
/// </para>
/// <para>
/// <b>It never stops the app</b>, the way <c>EersteAdminBootstrap</c> does not: a round that throws is logged and the
/// job waits for the next moment. A tick that is lost costs a delay, never a wrong answer, because the next round
/// recomputes everything from the data (D2).
/// </para>
/// </summary>
public sealed class Katachtergrondtaak : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly KatOpties _opties;
    private readonly TimeProvider _tijd;
    private readonly ILogger<Katachtergrondtaak> _logger;

    public Katachtergrondtaak(
        IServiceScopeFactory scopes,
        IOptions<KatOpties> opties,
        TimeProvider tijd,
        ILogger<Katachtergrondtaak> logger)
    {
        ArgumentNullException.ThrowIfNull(opties);

        _scopes = scopes;
        _opties = opties.Value;
        _tijd = tijd;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var momenten = _opties.Momenten();
        _logger.LogInformation(
            "The cat's background job is on, ticking at {Momenten} {Zone}.",
            string.Join(", ", momenten),
            Schoolklok.Zone?.Id ?? "UTC (the host does not know the school's zone)");

        while (!stoppingToken.IsCancellationRequested)
        {
            var nu = _tijd.GetUtcNow();
            var volgende = Tikschema.VolgendeNa(nu, momenten, Schoolklok.Zone);

            try
            {
                await Task.Delay(volgende - nu, _tijd, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }

            await TikAsync(volgende, stoppingToken);
        }
    }

    /// <summary>
    /// Claims <paramref name="moment"/> and runs the round when the claim is ours. Public so an integration test can
    /// let two instances race one moment without waiting for the clock.
    /// </summary>
    public async Task TikAsync(DateTimeOffset moment, CancellationToken ct)
    {
        try
        {
            await using var scope = _scopes.CreateAsyncScope();
            var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var tik = new Kattik(moment, Environment.MachineName, _tijd.GetUtcNow());
            context.Kattikken.Add(tik);
            try
            {
                await context.SaveChangesAsync(ct);
            }
            catch (DbUpdateException)
            {
                // Another instance owns this tick. Nothing to do and nothing wrong.
                _logger.LogDebug("The tick of {Moment} is already claimed elsewhere; skipping it.", moment);
                return;
            }

            var ronde = scope.ServiceProvider.GetRequiredService<Signaalronde>();
            var vandaag = Schoolklok.Vandaag(_tijd, _logger);
            Rapporteer(await ronde.VoerUitAsync(vandaag, ct));

            tik.MarkeerVoltooid(_tijd.GetUtcNow());
            await context.SaveChangesAsync(ct);
        }
        catch (Exception fout) when (fout is not OperationCanceledException)
        {
            _logger.LogError(fout, "The cat's round of {Moment} failed; the job waits for the next moment.", moment);
        }
    }

    /// <summary>
    /// Writes what the round reported. The round itself takes no logger (Application depends on nothing outside the
    /// domain), so this is the one place a failed klas or a failed task becomes visible.
    /// </summary>
    private void Rapporteer(Rondeverslag verslag)
    {
        foreach (var mislukking in verslag.Mislukkingen)
        {
            _logger.LogError(mislukking.Fout, "The cat's round failed for klas {KlasId}; the other klassen continued.", mislukking.KlasId);
        }

        foreach (var taakfout in verslag.Taakfouten)
        {
            _logger.LogError(taakfout.Fout, "A task of the cat failed on klas {KlasId}; its signal stands.", taakfout.KlasId);
        }

        _logger.LogInformation(
            "The cat's round covered {Klassen} klassen: {Nieuw} new signals, {Verdwenen} withdrawn, {Taken} tasks run, {Mislukt} klassen failed.",
            verslag.Klassen,
            verslag.Nieuw,
            verslag.Verdwenen,
            verslag.Taken,
            verslag.Mislukkingen.Count);
    }
}
