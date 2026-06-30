using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// One validated, denormalised school-content import row — one activiteit together with its parent
/// subthema and grandparent thema (the flat sheet shape described on <see cref="SchoolcontentKolom"/>).
/// This is a <b>pure parse/validation result</b>, not a domain entity: it carries no surrogate ids,
/// no persistence, and no goal-link resolution. Building the Thema → Subthema → Activiteit hierarchy
/// (grouping rows by thema/subthema, resolving the klas name to a <c>Klas</c>, resolving leerplandoel
/// codes, and committing) is E1-08; this story (FR-1.1/1.2) only validates and reports.
/// <para>
/// Goal links (<see cref="Themadoelen"/>, <see cref="Subdoelen"/>) are kept as the raw leerplandoel
/// <i>code</i> references read from the file; concordance/persistence happens later.
/// </para>
/// </summary>
public sealed class SchoolcontentRij
{
    /// <summary>The 1-based Excel row number this parsed row came from (for traceability).</summary>
    public required int RijNummer { get; init; }

    // --- Thema (school-wide). ---

    /// <summary>Thema naam (required).</summary>
    public required string ThemaNaam { get; init; }

    /// <summary>Thema duur in weken (required, positive).</summary>
    public required int ThemaDuurWeken { get; init; }

    /// <summary>Thema invalshoeken (optional).</summary>
    public string? ThemaInvalshoeken { get; init; }

    /// <summary>Kernwoordenschat list (possibly empty).</summary>
    public required IReadOnlyList<string> Kernwoordenschat { get; init; }

    /// <summary>Rijke woordenschat list (possibly empty).</summary>
    public required IReadOnlyList<string> RijkeWoordenschat { get; init; }

    /// <summary>Themadoel leerplandoel-code references (0–3; raw, unresolved).</summary>
    public required IReadOnlyList<string> Themadoelen { get; init; }

    // --- Subthema (class/age-scoped). ---

    /// <summary>Subthema naam (required).</summary>
    public required string SubthemaNaam { get; init; }

    /// <summary>Subthema duur in weken (required, positive).</summary>
    public required int SubthemaDuurWeken { get; init; }

    /// <summary>Subthema klas name (required — class scoping is structural, Art. IX.2).</summary>
    public required string SubthemaKlas { get; init; }

    /// <summary>Subthema leeftijd (required — age scoping is structural, Art. IX.2).</summary>
    public required string SubthemaLeeftijd { get; init; }

    /// <summary>Subthema probleemstelling (optional).</summary>
    public string? SubthemaProbleemstelling { get; init; }

    /// <summary>Subthema onderzoeksvraag (optional).</summary>
    public string? SubthemaOnderzoeksvraag { get; init; }

    /// <summary>Subdoel leerplandoel-code references (raw, unresolved).</summary>
    public required IReadOnlyList<string> Subdoelen { get; init; }

    // --- Activiteit (class/age-scoped). ---

    /// <summary>Activiteit naam (required).</summary>
    public required string ActiviteitNaam { get; init; }

    /// <summary>Activiteit type (required; validated against <see cref="ActiviteitType"/>).</summary>
    public required ActiviteitType ActiviteitType { get; init; }

    /// <summary>Activiteit hoek (optional).</summary>
    public string? ActiviteitHoek { get; init; }

    /// <summary>Activiteit verwachte uitkomsten (optional).</summary>
    public string? ActiviteitVerwachteUitkomsten { get; init; }
}
