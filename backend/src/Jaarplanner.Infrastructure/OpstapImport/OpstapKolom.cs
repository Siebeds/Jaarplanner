namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// The single source of truth for the Op.stap per-discipline goal Excel column layout
/// (Art. III.3, VII.1). The A–M column→field mapping lives here and <b>only</b> here:
/// Op.stap is still rolling out and columns may shift, so a column move is a one-line
/// change in this enum, never a scattered edit across the parser.
/// <para>
/// Values are the 1-based ClosedXML column indices (A = 1 … M = 13). The parser reads a
/// cell exclusively via <c>(int)OpstapKolom.X</c>; it never hard-codes a literal column
/// index or letter elsewhere.
/// </para>
/// <para>
/// The doelsoort short code (column A) is still resolved through
/// <see cref="Domain.Curriculum.DoelsoortCodes"/> — the single source for code↔enum — so
/// this enum only owns <i>where</i> each field sits, not how a doelsoort code is interpreted.
/// </para>
/// </summary>
public enum OpstapKolom
{
    /// <summary>Column A — Doelsoort short code (MD/G/+/P/S/A).</summary>
    Doelsoort = 1,

    /// <summary>Column B — LfMD: the minimumdoel leeftijd (K-, 4-, 6-). Part of the concordance key.</summary>
    LeeftijdMinimumdoel = 2,

    /// <summary>Column C — nrMD: the decreed minimumdoel number. Part of the concordance key.</summary>
    NummerMinimumdoel = 3,

    /// <summary>Column D — MD: B+C combined = the concordance key (<c>minimumdoelRef</c>).</summary>
    MinimumdoelRef = 4,

    /// <summary>Column E — Code: the unique leerplandoel code (identity).</summary>
    Code = 5,

    /// <summary>Column F — Jaar/fase (JK, K2, K3, L1–L6, or a fase for P/S).</summary>
    JaarFase = 6,

    /// <summary>Column G — Domein. Part of the composite grouping key (domein, subdomein).</summary>
    Domein = 7,

    /// <summary>Column H — Subdomein. Unique only together with domein (Art. VII.0).</summary>
    Subdomein = 8,

    /// <summary>Column I — Cluster (optional/nullable; lives in the goal Excel, not the ordeningskader).</summary>
    Cluster = 9,

    /// <summary>Column J — Leerplandoel text.</summary>
    Tekst = 10,

    /// <summary>Column K — Voorbeelden (illustratief, optional).</summary>
    Voorbeelden = 11,

    /// <summary>Column L — Toelichting (optional).</summary>
    Toelichting = 12,

    /// <summary>Column M — Woordenschat (richtinggevend, optional).</summary>
    Woordenschat = 13,
}
