namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// Where the leerplandoelen of one import came from. The shared re-import behaves the same for both; only the Dutch
/// wording of its notices differs, because "dit bestand" is false about goals that were read from KOV's API (E1-21).
/// </summary>
public enum OpstapHerkomst
{
    /// <summary>A per-discipline Op.stap Excel file uploaded by a person (E1-15, the demoted route).</summary>
    Bestand = 0,

    /// <summary>KOV's Op.stap API, read by the backend (E1-21, ADR-0032).</summary>
    OpstapApi = 1,
}
