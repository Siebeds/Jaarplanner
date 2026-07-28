namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// The Op.stap goal type (Excel column A — Art. VII.1). Distinguishes the decreed
/// <see cref="MD"/> (minimumdoel) from the leerplan-only types. Only <see cref="MD"/>
/// participates in the inspectie-tested minimumdoel coverage; the other types refine,
/// extend or illustrate (P/S/A are illustratief).
/// <para>
/// The official short codes contain non-identifier characters (<c>+</c>) and overlap
/// with single letters, so the enum members use descriptive English names while the
/// authoritative short code is exposed via <see cref="DoelsoortCode"/>. The mapping
/// between the two lives in exactly one place (<see cref="DoelsoortCodes"/>, Art. III.3).
/// </para>
/// </summary>
public enum Doelsoort
{
    /// <summary>MD — minimumdoel (the decreed eindterm; concorded, inspectie-tested).</summary>
    Minimumdoel = 0,

    /// <summary>G — gemeenschappelijk leerplandoel.</summary>
    Gemeenschappelijk = 1,

    /// <summary>+ — verdieping (deepening, beyond the common goals).</summary>
    Verdieping = 2,

    /// <summary>P — precurriculum (illustratief).</summary>
    Precurriculum = 3,

    /// <summary>S — specifiek (illustratief).</summary>
    Specifiek = 4,

    /// <summary>A — anderstalige nieuwkomers (illustratief).</summary>
    AnderstaligeNieuwkomers = 5,
}
