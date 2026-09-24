using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A verrijking the AI proposes for one hoek while one subthema runs (FB-028, ADR-0070).
/// <para>
/// <b>Keyed on the hoek and the subthema, not on a window.</b> A <see cref="Hoekverrijking"/> hangs on a stored
/// <see cref="Subthemaplaatsing"/>, but the agenda also draws a subthema that runs only because its activiteiten sit on
/// days, with no window stored. Asking for a proposal must change nothing in the plan (Art. IV.1), so it cannot store
/// that window first, as a save does. The proposal names the subthema; accepting it saves the verrijking through the
/// ordinary route, which finds or stores the window then.
/// </para>
/// <para>
/// <b>It belongs to the klas, not to whoever asked</b> (owner, 2026-09-24): the hoek says which klas, and whoever may
/// plan it, and admin, sees and decides it. So no gebruiker is stored.
/// </para>
/// <para>
/// Deliberately not a <see cref="Hoekverrijking"/> with a status: the agenda and the panel read verrijkingen without
/// one, and an open proposal must not show as what the corner holds.
/// </para>
/// </summary>
public sealed class Hoekverrijkingsvoorstel
{
    /// <summary>The longest proposed text, in characters: a few lines for a corner, never a written-out lesson (Art. I.2).</summary>
    public const int MaxTekstlengte = 1000;

    // EF Core materialisation only.
    private Hoekverrijkingsvoorstel()
    {
        Tekst = null!;
        AiMotivatie = null!;
    }

    /// <summary>A new open proposal.</summary>
    /// <exception cref="ArgumentException">An id is empty, or a text is blank or too long.</exception>
    public Hoekverrijkingsvoorstel(Guid hoekId, Guid subthemaId, string tekst, string aiMotivatie)
    {
        HoekId = RequireId(hoekId, nameof(hoekId));
        SubthemaId = RequireId(subthemaId, nameof(subthemaId));
        Tekst = Require(tekst, MaxTekstlengte, nameof(tekst));
        AiMotivatie = Require(aiMotivatie, int.MaxValue, nameof(aiMotivatie));
        Status = KoppelingStatus.Voorgesteld;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The corner it is for; the corner says which klas decides it.</summary>
    public Guid HoekId { get; private set; }

    /// <summary>The subthema during which the corner would hold it.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>The proposed text; after an accepted change, the text she kept.</summary>
    public string Tekst { get; private set; }

    /// <summary>Why the AI proposes it (Art. IV.3).</summary>
    public string AiMotivatie { get; private set; }

    /// <summary>Voorgesteld until decided; Aanvaard, Manueel (accepted after a change) or Geweigerd after (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>Whether it waits for a decision.</summary>
    public bool IsOpen => Status == KoppelingStatus.Voorgesteld;

    /// <summary>Records a rejection. The corner's verrijking is not touched.</summary>
    /// <exception cref="InvalidOperationException">It was already decided.</exception>
    public void Weiger()
    {
        VereisOpen();
        Status = KoppelingStatus.Geweigerd;
    }

    /// <summary>
    /// Records the acceptance with the text the corner got: <see cref="KoppelingStatus.Aanvaard"/> when it is the
    /// proposal's, <see cref="KoppelingStatus.Manueel"/> when she changed it first.
    /// </summary>
    /// <exception cref="InvalidOperationException">It was already decided.</exception>
    /// <exception cref="ArgumentException">The text is blank or too long.</exception>
    public void Aanvaard(string tekst)
    {
        VereisOpen();
        var gekozen = Require(tekst, MaxTekstlengte, nameof(tekst));
        Status = gekozen == Tekst ? KoppelingStatus.Aanvaard : KoppelingStatus.Manueel;
        Tekst = gekozen;
    }

    private void VereisOpen()
    {
        if (!IsOpen)
        {
            throw new InvalidOperationException("This hoekverrijkingsvoorstel has already been decided.");
        }
    }

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;

    private static string Require(string value, int max, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        var schoon = value.Trim();
        return schoon.Length <= max
            ? schoon
            : throw new ArgumentException($"'{paramName}' is longer than {max} characters.", paramName);
    }
}
