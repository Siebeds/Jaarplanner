namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// The AI's proposal of a minimumdoel as a themadoel of a <see cref="Thema"/> (FB-053, ADR-0049, Art. IX.2): a
/// thema's doelsuggestie. It starts <see cref="KoppelingStatus.Voorgesteld"/> with the model's
/// <see cref="AiMotivatie"/>, and only a person decides it (Art. IV.1): accepted, the minimumdoel becomes a themadoel
/// through <see cref="Thema.AanvaardDoelsuggestie"/>; rejected, it stays stored so a next run does not propose it again.
/// <para>
/// It names the minimumdoel by its stable <see cref="MinimumdoelRef"/> only (Art. III.5). It never counts for dekking
/// itself: the themadoel its acceptance makes does (Art. V.1).
/// </para>
/// </summary>
public sealed class Minimumdoelsuggestie
{
    // EF Core materialisation only.
    private Minimumdoelsuggestie()
    {
        MinimumdoelRef = null!;
        AiMotivatie = null!;
    }

    internal Minimumdoelsuggestie(Guid themaId, string minimumdoelRef, string aiMotivatie)
    {
        if (string.IsNullOrWhiteSpace(minimumdoelRef))
        {
            throw new ArgumentException("'minimumdoelRef' is required.", nameof(minimumdoelRef));
        }

        if (string.IsNullOrWhiteSpace(aiMotivatie))
        {
            // Art. IV.3: every suggestion carries a motivation.
            throw new ArgumentException("'aiMotivatie' is required.", nameof(aiMotivatie));
        }

        ThemaId = themaId;
        MinimumdoelRef = minimumdoelRef.Trim();
        AiMotivatie = aiMotivatie.Trim();
        Status = KoppelingStatus.Voorgesteld;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The (school-scoped) thema the proposal is for.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The proposed read-only minimumdoel's stable ref (Art. III.5).</summary>
    public string MinimumdoelRef { get; private set; }

    /// <summary>
    /// <see cref="KoppelingStatus.Voorgesteld"/> until a person decides, then <see cref="KoppelingStatus.Aanvaard"/> or
    /// <see cref="KoppelingStatus.Geweigerd"/> (Art. IV.2). <see cref="KoppelingStatus.Manueel"/> never occurs: a
    /// minimumdoel a person picks is linked by hand, not proposed.
    /// </summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>The model's one-sentence motivation (Art. IV.3).</summary>
    public string AiMotivatie { get; private set; }

    /// <summary>Records the person's decision. A proposal is decided once, from <c>voorgesteld</c> (ADR-0049 D2).</summary>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="besluit"/> is not aanvaard or geweigerd.</exception>
    /// <exception cref="InvalidOperationException">The proposal was already decided.</exception>
    internal void Beslis(KoppelingStatus besluit)
    {
        if (besluit is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new ArgumentOutOfRangeException(nameof(besluit), besluit, "Een voorstel wordt aanvaard of geweigerd.");
        }

        if (Status != KoppelingStatus.Voorgesteld)
        {
            throw new InvalidOperationException("Over dit voorstel is al beslist.");
        }

        Status = besluit;
    }
}
