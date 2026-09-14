using System.Text.Json;
using Jaarplanner.Application.AiAuthoring;

namespace Jaarplanner.Eval;

/// <summary>
/// A frozen evaluation set (TB-004): subthema's as a teacher knows them, each with the leerplandoel codes a teacher
/// linked to it by hand (the gold set). Frozen on purpose: a prompt or model change is only comparable against the
/// same set, and the set records which Op.stap version its codes refer to.
/// <para>
/// The thema and subthema reuse the wizard's own transient records (<see cref="ThemaOpbouwContext"/>,
/// <see cref="SubthemaOpbouwContext"/>), so an eval case reaches the model through exactly the fields the production
/// step 6 prompt renders. The JSON format is documented in this project's README.
/// </para>
/// </summary>
public sealed record Evalset
{
    /// <summary>The format version; <see cref="EvalsetReader.SupportedFormat"/> is the only one read.</summary>
    public int Formaatversie { get; init; } = EvalsetReader.SupportedFormat;

    /// <summary>Free text describing where the set came from; shown in the report.</summary>
    public string? Omschrijving { get; init; }

    /// <summary>The Op.stap version the gold codes refer to; shown in the report.</summary>
    public string? OpstapVersie { get; init; }

    /// <summary>The cases, at least one.</summary>
    public required IReadOnlyList<EvalGeval> Gevallen { get; init; }
}

/// <summary>One subthema with its gold leerplandoel codes.</summary>
public sealed record EvalGeval
{
    /// <summary>A stable, unique id, so a case can be followed across reports.</summary>
    public required string Id { get; init; }

    /// <summary>The thema the subthema belongs to (at least its name).</summary>
    public required ThemaOpbouwContext Thema { get; init; }

    /// <summary>The subthema; its <see cref="SubthemaOpbouwContext.Leeftijd"/> is the jaar/fase the candidates come from.</summary>
    public required SubthemaOpbouwContext Subthema { get; init; }

    /// <summary>The leerplandoel codes a teacher linked to this subthema without seeing an AI suggestion.</summary>
    public required IReadOnlyList<string> GoudenCodes { get; init; }
}

/// <summary>An evalset or a configuration the runner cannot use; the message says what to fix.</summary>
public sealed class EvalException(string message) : Exception(message);

/// <summary>Reads and checks an <see cref="Evalset"/> from JSON.</summary>
public static class EvalsetReader
{
    /// <summary>The one format version this runner reads.</summary>
    public const int SupportedFormat = 1;

    private static readonly JsonSerializerOptions Opties = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    /// <summary>Reads the evalset at <paramref name="pad"/>.</summary>
    public static Evalset ReadFile(string pad) => Read(File.ReadAllText(pad));

    /// <summary>Reads an evalset from JSON text and checks it; throws <see cref="EvalException"/> when it is unusable.</summary>
    public static Evalset Read(string json)
    {
        Evalset? evalset;
        try
        {
            evalset = JsonSerializer.Deserialize<Evalset>(json, Opties);
        }
        catch (JsonException ex)
        {
            throw new EvalException($"De evalset is geen geldige JSON in het verwachte formaat: {ex.Message}");
        }

        if (evalset is null)
        {
            throw new EvalException("De evalset is leeg.");
        }

        if (evalset.Formaatversie != SupportedFormat)
        {
            throw new EvalException(
                $"Formaatversie {evalset.Formaatversie} wordt niet ondersteund; deze runner leest versie {SupportedFormat}.");
        }

        if (evalset.Gevallen.Count == 0)
        {
            throw new EvalException("De evalset bevat geen gevallen.");
        }

        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var geval in evalset.Gevallen)
        {
            if (string.IsNullOrWhiteSpace(geval.Id) || !ids.Add(geval.Id))
            {
                throw new EvalException($"Het geval-id '{geval.Id}' is leeg of komt meer dan eens voor.");
            }

            if (string.IsNullOrWhiteSpace(geval.Subthema.Leeftijd))
            {
                throw new EvalException($"Geval '{geval.Id}' heeft geen leeftijd bij het subthema.");
            }

            if (geval.GoudenCodes.Count == 0 || geval.GoudenCodes.Any(string.IsNullOrWhiteSpace))
            {
                throw new EvalException($"Geval '{geval.Id}' heeft geen gouden codes, of een lege.");
            }
        }

        return evalset;
    }
}
