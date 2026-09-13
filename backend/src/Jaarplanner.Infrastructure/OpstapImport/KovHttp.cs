using System.Text.Json;
using Jaarplanner.Application.Curriculum.Import;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The one way this codebase reads a JSON document from KOV's API (ADR-0032), shared by the minimumdoelen source (E1-12)
/// and the curriculum source (E1-21) so both translate every failure the same way: into one <see cref="OpstapBronFout"/>
/// with an English cause, raised before anything is written.
/// </summary>
internal static class KovHttp
{
    private static readonly JsonSerializerOptions JsonOpties = new(JsonSerializerDefaults.Web);

    /// <summary>
    /// GETs <paramref name="adres"/> and deserialises the body as <typeparamref name="T"/>. The body is streamed, so the
    /// 13 MB curriculum is never held as one string.
    /// </summary>
    public static async Task<T> LeesJsonAsync<T>(HttpClient http, Uri adres, CancellationToken cancellationToken)
        where T : class
    {
        try
        {
            using var antwoord = await http.GetAsync(adres, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!antwoord.IsSuccessStatusCode)
            {
                throw new OpstapBronFout(
                    $"GET {adres} answered {(int)antwoord.StatusCode} {antwoord.ReasonPhrase}.");
            }

            await using var stroom = await antwoord.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonSerializer.DeserializeAsync<T>(stroom, JsonOpties, cancellationToken)
                ?? throw new OpstapBronFout($"GET {adres} answered an empty body.");
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The caller gave up; that is not the source's fault and must not be reported as one.
            throw;
        }
        catch (OperationCanceledException ex)
        {
            // HttpClient reports its own timeout as a cancellation the caller never asked for.
            throw new OpstapBronFout($"GET {adres} timed out after {http.Timeout}.", ex);
        }
        catch (HttpRequestException ex)
        {
            throw new OpstapBronFout($"GET {adres} failed: {ex.Message}", ex);
        }
        catch (JsonException ex)
        {
            throw new OpstapBronFout($"GET {adres} did not answer the expected JSON: {ex.Message}", ex);
        }
    }

    /// <summary>
    /// A base address without a trailing slash would make <c>new Uri(basis, relative)</c> drop its last segment, so a
    /// configured <c>https://host/prefix</c> is read as <c>https://host/prefix/</c>.
    /// </summary>
    public static Uri MetSlotSlash(Uri basis) =>
        basis.AbsoluteUri.EndsWith('/') ? basis : new Uri(basis.AbsoluteUri + "/");
}
