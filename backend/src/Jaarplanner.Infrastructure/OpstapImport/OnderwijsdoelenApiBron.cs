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
/// eindterm as <i>verdwenen</i> and invite a reviewer to believe the decree shrank. For the same reason a row that cannot
/// be identified by a well-formed <c>uniqueCode</c> refuses the whole read. Every failure to read (network, timeout, error
/// status, unexpected JSON, paging that does not end or leaves KOV's host, an unidentifiable row) becomes one
/// <see cref="OpstapBronFout"/>, raised before the import writes anything.
/// </para>
/// <para>
/// <b>Shared with the curriculum source (E1-21).</b> The leerplandoelen point at a minimumdoel by its href in this list,
/// so <see cref="CurriculumApiBron"/> reads it too, through <see cref="LeesRijenAsync"/>, under the same paging rules.
/// </para>
/// </summary>
public sealed class OnderwijsdoelenApiBron : IMinimumdoelBron
{
    /// <summary>The endpoint's path, relative to <see cref="OpstapApiOptions.BasisUrl"/>.</summary>
    internal const string Pad = "agodi/onderwijsdoelen/opstap";

    /// <summary>A bound on paging, far above the two or three pages a thousand rows take.</summary>
    internal const int MaxPaginas = 100;

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
        var peildatum = _tijd.GetUtcNow();
        var rijen = await LeesRijenAsync(_http, _opties, cancellationToken);

        var minimumdoelen = new List<Minimumdoel>();
        var problemen = new List<MinimumdoelBronProbleem>();
        var gezien = new HashSet<string>(StringComparer.Ordinal);

        foreach (var resultaat in rijen)
        {
            // A row that cannot be identified by a well-formed uniqueCode refuses the whole read. It could be a
            // minimumdoel that is already stored, and the report would then call that one vanished while the source
            // still lists it (antagonist, E1-12 round 2). Rows that are identified but unusable are reported instead.
            if (resultaat.Expanded is null)
            {
                throw NietExpanded(resultaat);
            }

            var (doel, probleem) = OnderwijsdoelMapping.Map(resultaat.Expanded, resultaat.Href, peildatum);
            if (probleem is { } reden)
            {
                if (!OnderwijsdoelMapping.IsWelgevormdeRef(reden.Sleutel))
                {
                    throw new OpstapBronFout(
                        $"Row {resultaat.Href ?? "(no href)"} of {Pad} has no usable uniqueCode ({reden.Reden}); " +
                        "a read whose rows cannot all be identified is refused.");
                }

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

        return new MinimumdoelBronResultaat(minimumdoelen, problemen);
    }

    /// <summary>
    /// Every row of the endpoint, all pages, under the all-or-nothing rules above: a paging link that loops or leaves
    /// KOV's host, a page without <c>results</c>, and a total that differs from <c>$$meta.count</c> each refuse the read.
    /// Identifying the rows is left to the caller, which knows what it needs from them.
    /// </summary>
    internal static async Task<IReadOnlyList<OnderwijsdoelResultaatDto>> LeesRijenAsync(
        HttpClient http,
        OpstapApiOptions opties,
        CancellationToken cancellationToken)
    {
        var basis = KovHttp.MetSlotSlash(opties.BasisUrl);
        var rijen = new List<OnderwijsdoelResultaatDto>();
        var bezocht = new HashSet<string>(StringComparer.Ordinal);
        int? aangekondigd = null;

        string? volgende = $"{Pad}?limit={opties.PaginaGrootte}";
        for (var pagina = 0; volgende is not null; pagina++)
        {
            if (pagina >= MaxPaginas || !bezocht.Add(volgende))
            {
                throw new OpstapBronFout(
                    $"Paging through {Pad} did not end after {pagina} pages (next = '{volgende}').");
            }

            var adres = new Uri(basis, volgende.TrimStart('/'));
            if (Uri.Compare(adres, basis, UriComponents.SchemeAndServer, UriFormat.Unescaped, StringComparison.OrdinalIgnoreCase) != 0)
            {
                // An absolute next link would otherwise be followed to whatever host the response names.
                throw new OpstapBronFout($"The next link '{volgende}' leaves {basis.GetLeftPart(UriPartial.Authority)}; refused.");
            }

            var inhoud = await KovHttp.LeesJsonAsync<OnderwijsdoelenPaginaDto>(http, adres, cancellationToken);
            aangekondigd ??= inhoud.Meta?.Count;

            rijen.AddRange(inhoud.Results ?? throw new OpstapBronFout($"A page of {Pad} has no 'results' array."));
            volgende = inhoud.Meta?.Next;
        }

        if (aangekondigd is { } totaal && totaal != rijen.Count)
        {
            throw new OpstapBronFout(
                $"{Pad} announced {totaal} rows and {rijen.Count} were read; a partial read is refused.");
        }

        return rijen;
    }

    /// <summary>The refusal for a row whose content was not expanded, shared with the curriculum source.</summary>
    internal static OpstapBronFout NietExpanded(OnderwijsdoelResultaatDto rij) =>
        new(
            $"Row {rij.Href ?? "(no href)"} of {Pad} is not expanded ($$expanded is missing); " +
            "a read whose rows cannot all be identified is refused.");
}
