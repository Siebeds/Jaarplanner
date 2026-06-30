namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// An Op.stap curriculum goal (leerplandoel). Read-only reference data (Art. III.1):
/// the official content — text, code, doelsoort, jaar/fase, taxonomy, concordance — is
/// never mutated by the application; teachers may only add internal labels/ordering
/// elsewhere (Art. III.2).
/// <para>
/// <see cref="Code"/> is the unique, stable identity used for matching, coverage and
/// re-import (Art. III.5). The grouping/browse key is the composite
/// <c>(<see cref="Domein"/>, <see cref="Subdomein"/>)</c> because subdomein names are not
/// globally unique (Art. VII.0). <see cref="Cluster"/> is nullable — it lives in the goal
/// Excel, not the ordeningskader, and coverage roll-ups must not assume it is present.
/// </para>
/// <para>
/// Immutability is structural: private setters, a single validating constructor, and no
/// mutators. The private parameterless constructor exists only for EF Core materialisation.
/// </para>
/// </summary>
public sealed class Leerplandoel
{
    // EF Core materialisation only — not an application construction path.
    private Leerplandoel()
    {
        Code = null!;
        JaarFase = null!;
        Domein = null!;
        Subdomein = null!;
        Tekst = null!;
        DisciplineNummer = null!;
    }

    /// <summary>Constructs a leerplandoel from its official Op.stap content.</summary>
    /// <param name="code">The unique leerplandoel code (Excel E). Identity.</param>
    /// <param name="doelsoort">The goal type (Excel A).</param>
    /// <param name="jaarFase">The jaar/fase code (Excel F — JK, K2, K3, L1–L6, or a fase for P/S).</param>
    /// <param name="domein">The domein (Excel G).</param>
    /// <param name="subdomein">The subdomein (Excel H); unique only together with domein.</param>
    /// <param name="disciplineNummer">The owning discipline number (the source Excel's discipline).</param>
    /// <param name="cluster">The optional cluster (Excel I); nullable.</param>
    /// <param name="tekst">The goal text (Excel J).</param>
    /// <param name="voorbeelden">Optional illustrative examples (Excel K).</param>
    /// <param name="toelichting">Optional clarification (Excel L).</param>
    /// <param name="woordenschat">Optional indicative vocabulary (Excel M).</param>
    /// <param name="minimumdoelRef">Optional concordance key to a <see cref="Minimumdoel"/> (Excel D).</param>
    public Leerplandoel(
        string code,
        Doelsoort doelsoort,
        string jaarFase,
        string domein,
        string subdomein,
        string disciplineNummer,
        string? cluster = null,
        string tekst = "",
        string? voorbeelden = null,
        string? toelichting = null,
        string? woordenschat = null,
        string? minimumdoelRef = null)
    {
        Code = Require(code, nameof(code));
        Doelsoort = ValidateDoelsoort(doelsoort);
        JaarFase = Require(jaarFase, nameof(jaarFase));
        Domein = Require(domein, nameof(domein));
        Subdomein = Require(subdomein, nameof(subdomein));
        DisciplineNummer = Require(disciplineNummer, nameof(disciplineNummer));
        Tekst = Require(tekst, nameof(tekst));
        Cluster = Optional(cluster);
        Voorbeelden = Optional(voorbeelden);
        Toelichting = Optional(toelichting);
        Woordenschat = Optional(woordenschat);
        MinimumdoelRef = Optional(minimumdoelRef);
    }

    /// <summary>The unique leerplandoel code — stable identity (Art. III.5).</summary>
    public string Code { get; private set; }

    /// <summary>The goal type (MD/G/+/P/S/A).</summary>
    public Doelsoort Doelsoort { get; private set; }

    /// <summary>The jaar/fase code (JK, K2, K3, L1–L6, or a fase for P/S).</summary>
    public string JaarFase { get; private set; }

    /// <summary>The domein — part of the composite grouping key.</summary>
    public string Domein { get; private set; }

    /// <summary>The subdomein — unique only together with <see cref="Domein"/> (Art. VII.0).</summary>
    public string Subdomein { get; private set; }

    /// <summary>The owning discipline number (string), referencing <see cref="Discipline.Nummer"/>.</summary>
    public string DisciplineNummer { get; private set; }

    /// <summary>Optional cluster (Excel I) — lives in the goal Excel, not the ordeningskader; nullable.</summary>
    public string? Cluster { get; private set; }

    /// <summary>The goal text (Excel J).</summary>
    public string Tekst { get; private set; }

    /// <summary>Optional illustrative examples (Excel K).</summary>
    public string? Voorbeelden { get; private set; }

    /// <summary>Optional clarification (Excel L).</summary>
    public string? Toelichting { get; private set; }

    /// <summary>Optional indicative vocabulary (Excel M).</summary>
    public string? Woordenschat { get; private set; }

    /// <summary>Optional concordance key to a <see cref="Minimumdoel"/> (Excel D); null when not concorded.</summary>
    public string? MinimumdoelRef { get; private set; }

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static Doelsoort ValidateDoelsoort(Doelsoort doelsoort) =>
        Enum.IsDefined(doelsoort)
            ? doelsoort
            : throw new ArgumentOutOfRangeException(nameof(doelsoort), doelsoort, "Unknown doelsoort.");
}
