using System.Net;

namespace Jaarplanner.Eval;

/// <summary>Waits out a throttled deployment (HTTP 429) a few times; every other failure is the caller's.</summary>
internal static class Retry
{
    /// <summary>How many attempts, the first one included.</summary>
    internal const int Attempts = 4;

    /// <summary>
    /// Runs <paramref name="action"/>; after a 429 it waits <paramref name="wait"/> times the attempt number and tries
    /// again, up to <see cref="Attempts"/> attempts. A cancellation stops the wait.
    /// </summary>
    internal static async Task<T> WhenThrottledAsync<T>(
        Func<Task<T>> action,
        TimeSpan wait,
        Action<string>? log,
        CancellationToken cancellationToken)
    {
        for (var attempt = 1; ; attempt++)
        {
            try
            {
                return await action();
            }
            catch (HttpRequestException ex) when (ex.StatusCode == HttpStatusCode.TooManyRequests && attempt < Attempts)
            {
                var delay = wait * attempt;
                log?.Invoke($"Te veel aanvragen (429); nieuwe poging over {delay.TotalSeconds:0} s.");
                await Task.Delay(delay, cancellationToken);
            }
        }
    }
}
