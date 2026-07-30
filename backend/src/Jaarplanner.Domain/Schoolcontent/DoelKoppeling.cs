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

    /// <summary>
    /// The teacher substitutes a <b>different</b> leerplandoel on this link — FR-4.3's third action,
    /// <i>"aanpassen"</i> ("the AI proposed this doel; I think it should be that one"). The link becomes
    /// <see cref="KoppelingStatus.Manueel"/>, which is what that status means: a link the human chose.
    /// <para>
    /// <b><see cref="AiMotivatie"/> is cleared, deliberately.</b> The motivation answered "waarom past
    /// <i>dit</i> doel hier?" about the doel the AI proposed. Carrying it over would present an AI
    /// justification for a goal the AI never suggested, which is exactly the kind of thing Art. IV.3
    /// exists to prevent; and this class already documents a manual link as one with no AI motivation.
    /// The consequence is accepted and recorded: after a substitution the tool no longer knows which code
    /// the AI had originally proposed. Keeping that history needs a column and is not built here.
    /// </para>
    /// <para>
    /// Validating that <paramref name="leerplandoelCode"/> is a code the read-only Op.stap set actually
    /// carries is the application layer's job (Art. III.5) — the domain cannot see the curriculum table.
    /// </para>
    /// </summary>
    public void VervangLeerplandoel(string leerplandoelCode)
    {
        LeerplandoelCode = Require(leerplandoelCode, nameof(leerplandoelCode));
        Status = KoppelingStatus.Manueel;
        AiMotivatie = null;
    }

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
