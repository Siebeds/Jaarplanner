namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// The link between a piece of autonomous school content (a <see cref="Themadoel"/>,
/// <see cref="Subdoel"/> or <see cref="Activiteit"/>) and a read-only Op.stap
/// <c>Leerplandoel</c> (Art. IX.2 — "formerly ThemaDoel"). Carries the human-in-the-loop
/// <see cref="Status"/> (Art. IV.2) and the AI's short <see cref="AiMotivatie"/> ("waarom past
/// dit doel hier?", Art. IV.3).
/// <para>
/// The link references the leerplandoel by its stable <see cref="LeerplandoelCode"/> (Art. III.5);
/// minimumdoel-level coverage is then reached via the leerplandoel's own concordance — we do not
/// duplicate the concordance here. This entity is <b>mutable</b>: school content is autonomous
/// (Art. III), and the teacher updates the status as they accept/reject/adjust suggestions.
/// </para>
/// </summary>
public sealed class DoelKoppeling
{
    // EF Core materialisation only.
    private DoelKoppeling()
    {
        LeerplandoelCode = null!;
    }

    /// <summary>Creates a link to a leerplandoel.</summary>
    /// <param name="leerplandoelCode">The target leerplandoel's unique code (Art. III.5).</param>
    /// <param name="status">The initial status — AI suggestions start <see cref="KoppelingStatus.Voorgesteld"/>, manual links <see cref="KoppelingStatus.Manueel"/>.</param>
    /// <param name="aiMotivatie">The AI's short motivation (only meaningful for AI-originated links); optional.</param>
    public DoelKoppeling(string leerplandoelCode, KoppelingStatus status, string? aiMotivatie = null)
    {
        LeerplandoelCode = Require(leerplandoelCode, nameof(leerplandoelCode));
        Status = Validate(status);
        AiMotivatie = Optional(aiMotivatie);
    }

    /// <summary>Surrogate identity for the link row.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The target leerplandoel's unique code (FK to the read-only curriculum data).</summary>
    public string LeerplandoelCode { get; private set; }

    /// <summary>The human-in-the-loop status of this link (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>The AI's short motivation for the suggestion; null for purely manual links (Art. IV.3).</summary>
    public string? AiMotivatie { get; private set; }

    /// <summary>
    /// Records a teacher decision on an AI suggestion (Art. IV.1/IV.2). The teacher is the only
    /// actor that moves a link to <see cref="KoppelingStatus.Aanvaard"/> or
    /// <see cref="KoppelingStatus.Geweigerd"/>; the AI never auto-applies.
    /// </summary>
    public void WijzigStatus(KoppelingStatus status) => Status = Validate(status);

    private static KoppelingStatus Validate(KoppelingStatus status) =>
        Enum.IsDefined(status)
            ? status
            : throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown koppeling status.");

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
}
