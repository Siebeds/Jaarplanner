namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// One word of a <see cref="Woordweb"/>, with the Art. IV.2 status that says whose it is: typed by the teacher
/// (<see cref="KoppelingStatus.Manueel"/>), proposed by the AI and not yet decided
/// (<see cref="KoppelingStatus.Voorgesteld"/>), or proposed and then accepted or rejected. Changed only through its web.
/// </summary>
public sealed class WoordwebWoord
{
    // EF Core materialisation only.
    private WoordwebWoord()
    {
        Woord = null!;
    }

    internal WoordwebWoord(Guid woordwebId, string woord, KoppelingStatus status, string? aiMotivatie, int volgnummer)
    {
        WoordwebId = woordwebId;
        Woord = woord;
        Status = status;
        AiMotivatie = aiMotivatie;
        Volgnummer = volgnummer;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The web this word belongs to.</summary>
    public Guid WoordwebId { get; private set; }

    /// <summary>The word, trimmed, in the spelling first entered.</summary>
    public string Woord { get; private set; }

    /// <summary>Whose word it is, and for an AI word whether the teacher decided on it (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>Why the AI proposed it (Art. IV.3); <c>null</c> for a word the teacher typed.</summary>
    public string? AiMotivatie { get; private set; }

    /// <summary>The order in which words were first added; the web shows them in it.</summary>
    public int Volgnummer { get; private set; }

    /// <summary>Whether the word stands in the web: typed, or proposed and accepted.</summary>
    public bool StaatInWeb => Status is KoppelingStatus.Manueel or KoppelingStatus.Aanvaard;

    /// <summary>The teacher typed a word the AI had proposed, or that she had rejected: it is hers now, without the AI's reason.</summary>
    internal void MaakEigen()
    {
        Status = KoppelingStatus.Manueel;
        AiMotivatie = null;
    }

    internal void Beslis(KoppelingStatus status) => Status = status;
}
