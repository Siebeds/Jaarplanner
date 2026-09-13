namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// Where KOV's Op.stap API lives and how patiently to read it (ADR-0032). Bound from the <c>Opstap:Api</c> configuration
/// section; every value has a working default, so a deployment needs no configuration at all. Nothing here is a secret:
/// the API is read without credentials (Art. VI.4).
/// </summary>
public sealed class OpstapApiOptions
{
    /// <summary>Configuration section name: <c>Opstap:Api</c>.</summary>
    public const string SectionName = "Opstap:Api";

    /// <summary>The API's base address. Default: KOV's production API.</summary>
    public Uri BasisUrl { get; set; } = new("https://api.katholiekonderwijs.vlaanderen/");

    /// <summary>
    /// How long one HTTP request may take. The full curriculum (E1-21) is about 13 MB in one response, so this is
    /// generous rather than tight.
    /// </summary>
    public TimeSpan Tijdslimiet { get; set; } = TimeSpan.FromSeconds(100);

    /// <summary>Rows per page when reading the minimumdoelen list. About a thousand exist, so 500 means two requests.</summary>
    public int PaginaGrootte { get; set; } = 500;
}
