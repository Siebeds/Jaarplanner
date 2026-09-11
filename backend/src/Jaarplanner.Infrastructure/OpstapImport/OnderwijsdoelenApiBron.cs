using System.Text.Json;
using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Microsoft.Extensions.Options;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Reads the decreed minimumdoelen from KOV's Op.stap API (<c>GET /agodi/onderwijsdoelen/opstap</c>, ADR-0032) and maps
/// each row through <see cref="OnderwijsdoelMapping"/>. A typed <see cref="HttpClient"/>, registered by
/// <see cref="OpstapApiRegistratie"/>; the only caller is the import, never a teacher request (ADR-0032 decision 2).
/// <para>
/// <b>All or nothing.</b> The endpoint pages through <c>$$meta.next</c> and announces the total in <c>$$meta.count</c>. A
/// read that ends with fewer rows than announced is refused as a whole, because a partial list would report every missing
/// eindterm as <i>verdwenen</i> and invite a reviewer to believe the decree shrank. Every failure to read (network,
/// timeout, error status, unexpected JSON, paging that does not end) becomes one <see cref="OpstapBronFout"/>, raised
/// before the import writes anything.
/// </para>
/// </summary>
public sealed class OnderwijsdoelenApiBron : IMinimumdoelBron
{
    /// <summary>The endpoint's path, relative to <see cref="OpstapApiOptions.BasisUrl"/>.</summary>
    internal const string Pad = "agodi/onderwijsdoelen/opstap";

    /// <summary>A bound on paging, far above the two or three pages a thousand rows take.</summary>
    internal const int MaxPaginas = 100;

    private static readonly JsonSerializerOptions JsonOpties = new(JsonSerializerDefaults.Web);

    private readonly HttpClient _http;
    private readonly OpstapApiOptions _opties;
    private readonly TimeProvider _tijd;

    /// <summary>The DI constructor.</summary>
    public OnderwijsdoelenApiBron(HttpClient http, IOptions<OpstapApiOptions> opties)
        : this(http, opties, TimeProvider.System)
    {
    }

    /// <summary>The test constructor: a fixed clock decides which rows have expired.</summary>
    internal OnderwijsdoelenApiBron(HttpClient http, IOptions<OpstapApiOptions> opties, TimeProvider tijd)
    {
        ArgumentNullException.ThrowIfNull(http);
        ArgumentNullException.ThrowIfNull(opties);
        ArgumentNullException.ThrowIfNull(tijd);

        _http = http;
        _opties = opties.Value;
        _tijd = tijd;
    }

    /// <inheritdoc />
    public async Task<MinimumdoelBronResultaat> HaalOpAsync(CancellationToken cancellationToken = default)
    {
        var basis = MetSlotSlash(_opties.BasisUrl);
        var peildatum = _tijd.GetUtcNow();

        var minimumdoelen = new List<Minimumdoel>();
        var problemen = new List<MinimumdoelBronProbleem>();
        var gezien = new HashSet<string>(StringComparer.Ordinal);
        var bezocht = new HashSet<string>(StringComparer.Ordinal);
        int? aangekondigd = null;
        var gelezen = 0;

        string? volgende = $"{Pad}?limit={_opties.PaginaGrootte}";
        for (var pagina = 0; volgende is not null; pagina++)
        {
            if (pagina >= MaxPaginas || !bezocht.Add(volgende))
            {
                throw new OpstapBronFout(
                    $"Paging through {Pad} did not end after {pagina} pages (next = '{volgende}').");
            }

            var inhoud = await LeesPaginaAsync(new Uri(basis, volgende.TrimStart('/')), cancellationToken);
            aangekondigd ??= inhoud.Meta?.Count;

            foreach (var resultaat in inhoud.Results
                ?? throw new OpstapBronFout($"A page of {Pad} has no 'results' array."))
            {
                gelezen++;
                if (resultaat.Expanded is null)
                {
                    problemen.Add(new MinimumdoelBronProbleem(
                        resultaat.Href ?? "(no href)",
                        "The row is not expanded ($$expanded is missing)."));
                    continue;
                }

                var (doel, probleem) = OnderwijsdoelMapping.Map(resultaat.Expanded, resultaat.Href, peildatum);
                if (probleem is { } reden)
                {
                    problemen.Add(reden);
                }
                else if (!gezien.Add(doel!.Ref))
                {
                    problemen.Add(new MinimumdoelBronProbleem(
                        doel.Ref,
                        "uniqueCode occurs more than once in the source; the first row was kept."));
                }
                else
                {
                    minimumdoelen.Add(doel);
                }
            }

            volgende = inhoud.Meta?.Next;
        }

        if (aangekondigd is { } totaal && totaal != gelezen)
        {
            throw new OpstapBronFout(
                $"{Pad} announced {totaal} rows and {gelezen} were read; a partial read is refused.");
        }

        return new MinimumdoelBronResultaat(minimumdoelen, problemen);
    }

    private async Task<OnderwijsdoelenPaginaDto> LeesPaginaAsync(Uri adres, CancellationToken cancellationToken)
    {
        try
        {
            using var antwoord = await _http.GetAsync(adres, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
            if (!antwoord.IsSuccessStatusCode)
            {
                throw new OpstapBronFout(
                    $"GET {adres} answered {(int)antwoord.StatusCode} {antwoord.ReasonPhrase}.");
            }

            await using var stroom = await antwoord.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonSerializer.DeserializeAsync<OnderwijsdoelenPaginaDto>(stroom, JsonOpties, cancellationToken)
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
            throw new OpstapBronFout($"GET {adres} timed out after {_http.Timeout}.", ex);
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
    private static Uri MetSlotSlash(Uri basis) =>
        basis.AbsoluteUri.EndsWith('/') ? basis : new Uri(basis.AbsoluteUri + "/");
}
