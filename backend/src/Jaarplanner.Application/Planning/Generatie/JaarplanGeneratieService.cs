using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The AI jaarplan generation (FR-5.1), <b>switched off</b> (ADR-0049 decision 9).
/// <para>
/// The owner ruled on 2026-09-16 that thema placements carry their own dates and that the generation is reworked for
/// that in its own ticket. The run that lived here proposed thema's per themaperiode, several per period, which the
/// new rule that no two thema's share a day contradicts on every call. It was removed rather than left unreachable;
/// git history holds it for the rework. What stays is what that rework can build on: the prompt builder, the response
/// parser, and the class's kept pre-generation parameters, which this service still reads.
/// </para>
/// </summary>
public sealed class JaarplanGeneratieService
{
    private readonly IJaarplanOpslag _opslag;

    /// <summary>Constructs the service around its persistence port (DI / tests).</summary>
    public JaarplanGeneratieService(IJaarplanOpslag opslag)
    {
        _opslag = opslag ?? throw new ArgumentNullException(nameof(opslag));
    }

    /// <summary>
    /// Refuses a generation: it is off until its rework lands. Checks the class first, so an unknown class still
    /// answers not-found rather than a refusal about a feature.
    /// </summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class does not exist.</exception>
    /// <exception cref="GeneratieUitgeschakeldFout">Always, for an existing class.</exception>
    public async Task GenereerAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        await LaadKlasAsync(klasId, cancellationToken);

        throw new GeneratieUitgeschakeldFout();
    }

    /// <summary>
    /// The class's kept pre-generation settings (E3-04, FR-5.4). A class with nothing kept yields
    /// <see cref="JaarplanGeneratieParameters.Geen"/> rather than a not-found. Kept for the generation's rework; since
    /// ADR-0049 a kept vast moment blocks no placement.
    /// </summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class does not exist.</exception>
    public async Task<JaarplanGeneratieParameters> HaalParametersAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        var (_, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var bewaard = await _opslag.LaadGeneratieparametersAsync(klasId, schooljaar.Id, cancellationToken);

        return bewaard is null ? JaarplanGeneratieParameters.Geen : JaarplanGeneratieParameters.Van(bewaard);
    }

    private async Task<(Klas Klas, Schooljaar Schooljaar)> LaadKlasAsync(
        Guid klasId,
        CancellationToken cancellationToken) =>
        await _opslag.LaadKlasMetSchooljaarAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
}
