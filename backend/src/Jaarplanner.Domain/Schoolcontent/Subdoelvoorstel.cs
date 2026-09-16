namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// The AI's proposal to place one open leerplandoel of a thema's themadoelen at one leeftijd (FB-057, ADR-0050): as
/// subdoel of an existing <see cref="Subthema"/>, or in a proposed new one (<see cref="Subthemavoorstel"/>). Exactly one
/// of <see cref="SubthemaId"/> and <see cref="SubthemavoorstelId"/> is set. It counts for nothing until accepted, and
/// accepting it writes an ordinary subdoel (D5).
/// </summary>
public sealed class Subdoelvoorstel
{
    // EF Core materialisation only.
    private Subdoelvoorstel()
    {
        Leeftijd = null!;
        LeerplandoelCode = null!;
        AiMotivatie = null!;
    }

    private Subdoelvoorstel(Guid themaId, string leeftijd, string leerplandoelCode, Guid? subthemaId, Guid? subthemavoorstelId, string aiMotivatie)
    {
        if (string.IsNullOrWhiteSpace(leeftijd))
        {
            throw new ArgumentException("'leeftijd' is required.", nameof(leeftijd));
        }

        if (string.IsNullOrWhiteSpace(leerplandoelCode))
        {
            throw new ArgumentException("'leerplandoelCode' is required.", nameof(leerplandoelCode));
        }

        if (string.IsNullOrWhiteSpace(aiMotivatie))
        {
            throw new ArgumentException("'aiMotivatie' is required.", nameof(aiMotivatie));
        }

        ThemaId = themaId;
        Leeftijd = leeftijd.Trim();
        LeerplandoelCode = leerplandoelCode.Trim();
        SubthemaId = subthemaId;
        SubthemavoorstelId = subthemavoorstelId;
        AiMotivatie = aiMotivatie.Trim();
        Status = KoppelingStatus.Voorgesteld;
    }

    /// <summary>A proposal to add the goal to an existing subthema.</summary>
    public static Subdoelvoorstel InSubthema(Guid themaId, string leeftijd, string leerplandoelCode, Guid subthemaId, string aiMotivatie) =>
        new(themaId, leeftijd, leerplandoelCode, subthemaId, null, aiMotivatie);

    /// <summary>A proposal to place the goal in a proposed new subthema.</summary>
    public static Subdoelvoorstel InNieuwSubthema(Guid themaId, string leeftijd, string leerplandoelCode, Guid subthemavoorstelId, string aiMotivatie) =>
        new(themaId, leeftijd, leerplandoelCode, null, subthemavoorstelId, aiMotivatie);

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The thema whose themadoel brought the goal along.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The jaar/fase code of the goal and of its destination.</summary>
    public string Leeftijd { get; private set; }

    /// <summary>The leerplandoel to place.</summary>
    public string LeerplandoelCode { get; private set; }

    /// <summary>The existing subthema it would join; <c>null</c> for a goal in a proposed new subthema.</summary>
    public Guid? SubthemaId { get; private set; }

    /// <summary>The proposed new subthema it belongs to; <c>null</c> for a goal placed in an existing one.</summary>
    public Guid? SubthemavoorstelId { get; private set; }

    /// <summary>Voorgesteld until decided (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>Why the AI proposes this place (Art. IV.3).</summary>
    public string AiMotivatie { get; private set; }

    /// <summary>Whether it waits for a decision.</summary>
    public bool IsOpen => Status == KoppelingStatus.Voorgesteld;

    /// <summary>Records the decision: <see cref="KoppelingStatus.Aanvaard"/> or <see cref="KoppelingStatus.Geweigerd"/>.</summary>
    public void Beslis(KoppelingStatus status)
    {
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new ArgumentOutOfRangeException(nameof(status), status, "A subdoelvoorstel is accepted or rejected.");
        }

        if (!IsOpen)
        {
            throw new InvalidOperationException("This subdoelvoorstel has already been decided.");
        }

        Status = status;
    }
}
