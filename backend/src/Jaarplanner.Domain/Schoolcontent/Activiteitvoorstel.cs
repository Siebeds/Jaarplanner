namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// An activiteit the AI proposes under one <see cref="Subthema"/> to the gebruiker who asked (FB-025, ADR-0054). It is
/// hers: only she and directie see and decide it (D2, A3). It counts for nothing until accepted, and accepting it creates
/// an ordinary own <see cref="Activiteit"/> of hers (A2), whose id this proposal then keeps.
/// <para>
/// Deliberately not an <see cref="Activiteit"/> row with a status: the agenda, the dekking and the thema's counts read
/// activiteiten without one.
/// </para>
/// </summary>
public sealed class Activiteitvoorstel
{
    /// <summary>The longest name, in characters (D7).</summary>
    public const int MaxNaamlengte = 200;

    /// <summary>The longest expected outcomes, in characters (D7): a description, never a written-out lesson (Art. I.2).</summary>
    public const int MaxUitkomstlengte = 1000;

    /// <summary>The shortest length, in lesuren (D7).</summary>
    public const int MinLesuren = 1;

    /// <summary>The longest length, in lesuren (D7).</summary>
    public const int MaxLesuren = 4;

    private List<string> _leerplandoelCodes = [];

    // EF Core materialisation only.
    private Activiteitvoorstel()
    {
        Naam = null!;
        VerwachteUitkomsten = null!;
        AiMotivatie = null!;
    }

    /// <summary>A new open proposal.</summary>
    /// <exception cref="ArgumentException">A required text is blank or too long, or a code is blank.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The length or the soort is out of range.</exception>
    public Activiteitvoorstel(
        Guid subthemaId,
        Guid gebruikerId,
        string naam,
        ActiviteitType? activiteitType,
        string verwachteUitkomsten,
        int lengteInLesuren,
        Guid? onderzoeksvraagId,
        IEnumerable<string> leerplandoelCodes,
        string aiMotivatie)
    {
        ArgumentNullException.ThrowIfNull(leerplandoelCodes);
        if (gebruikerId == Guid.Empty)
        {
            throw new ArgumentException("'gebruikerId' is required.", nameof(gebruikerId));
        }

        SubthemaId = subthemaId;
        GebruikerId = gebruikerId;
        Naam = Tekst(naam, MaxNaamlengte, nameof(naam));
        ActiviteitType = Soort(activiteitType);
        VerwachteUitkomsten = Tekst(verwachteUitkomsten, MaxUitkomstlengte, nameof(verwachteUitkomsten));
        LengteInLesuren = Lengte(lengteInLesuren);
        OnderzoeksvraagId = onderzoeksvraagId;
        _leerplandoelCodes = leerplandoelCodes
            .Select(c => string.IsNullOrWhiteSpace(c) ? throw new ArgumentException("A goal code is blank.", nameof(leerplandoelCodes)) : c.Trim())
            .Distinct(StringComparer.Ordinal)
            .ToList();
        AiMotivatie = Tekst(aiMotivatie, int.MaxValue, nameof(aiMotivatie));
        Status = KoppelingStatus.Voorgesteld;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The subthema it is proposed under.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>Who asked: she, and directie, see and decide it (D2, A3); an accepted one becomes her own activiteit.</summary>
    public Guid GebruikerId { get; private set; }

    /// <summary>The proposed name; after an accepted change, the name the activiteit got.</summary>
    public string Naam { get; private set; }

    /// <summary>The proposed soort, or none.</summary>
    public ActiviteitType? ActiviteitType { get; private set; }

    /// <summary>What the kleuters do and what is expected.</summary>
    public string VerwachteUitkomsten { get; private set; }

    /// <summary>The proposed length in lesuren.</summary>
    public int LengteInLesuren { get; private set; }

    /// <summary>The subthema's onderzoeksvraag it works on, or none.</summary>
    public Guid? OnderzoeksvraagId { get; private set; }

    /// <summary>The subdoel codes it works on, as proposed; after an accepted change, the ones kept.</summary>
    public IReadOnlyList<string> LeerplandoelCodes => _leerplandoelCodes;

    /// <summary>Voorgesteld until decided; Aanvaard, Manueel (accepted after a change) or Geweigerd after (Art. IV.2).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>Why the AI proposes it (Art. IV.3).</summary>
    public string AiMotivatie { get; private set; }

    /// <summary>The own activiteit an accepted proposal became; <c>null</c> otherwise, or once that activiteit is gone.</summary>
    public Guid? ActiviteitId { get; private set; }

    /// <summary>Whether it waits for a decision.</summary>
    public bool IsOpen => Status == KoppelingStatus.Voorgesteld;

    /// <summary>Records a rejection.</summary>
    /// <exception cref="InvalidOperationException">It was already decided.</exception>
    public void Weiger()
    {
        VereisOpen();
        Status = KoppelingStatus.Geweigerd;
    }

    /// <summary>
    /// Records the acceptance with what the activiteit got (D8): <see cref="KoppelingStatus.Aanvaard"/> when nothing
    /// differs from the proposal, <see cref="KoppelingStatus.Manueel"/> otherwise.
    /// </summary>
    /// <exception cref="InvalidOperationException">It was already decided.</exception>
    public void Aanvaard(
        Guid activiteitId,
        string naam,
        ActiviteitType? activiteitType,
        string verwachteUitkomsten,
        int lengteInLesuren,
        IReadOnlyCollection<string> leerplandoelCodes)
    {
        ArgumentNullException.ThrowIfNull(leerplandoelCodes);
        VereisOpen();

        var nieuweNaam = Tekst(naam, MaxNaamlengte, nameof(naam));
        var nieuweUitkomsten = Tekst(verwachteUitkomsten, MaxUitkomstlengte, nameof(verwachteUitkomsten));
        var nieuweLengte = Lengte(lengteInLesuren);
        var nieuweSoort = Soort(activiteitType);
        var gewijzigd = nieuweNaam != Naam
            || nieuweSoort != ActiviteitType
            || nieuweUitkomsten != VerwachteUitkomsten
            || nieuweLengte != LengteInLesuren
            || !leerplandoelCodes.ToHashSet(StringComparer.Ordinal).SetEquals(_leerplandoelCodes);

        Naam = nieuweNaam;
        ActiviteitType = nieuweSoort;
        VerwachteUitkomsten = nieuweUitkomsten;
        LengteInLesuren = nieuweLengte;
        _leerplandoelCodes = leerplandoelCodes.Distinct(StringComparer.Ordinal).ToList();
        ActiviteitId = activiteitId;
        Status = gewijzigd ? KoppelingStatus.Manueel : KoppelingStatus.Aanvaard;
    }

    private void VereisOpen()
    {
        if (!IsOpen)
        {
            throw new InvalidOperationException("This activiteitvoorstel has already been decided.");
        }
    }

    private static string Tekst(string waarde, int max, string naam)
    {
        if (string.IsNullOrWhiteSpace(waarde))
        {
            throw new ArgumentException($"'{naam}' is required.", naam);
        }

        var schoon = waarde.Trim();
        return schoon.Length <= max ? schoon : throw new ArgumentException($"'{naam}' is longer than {max} characters.", naam);
    }

    private static int Lengte(int lesuren) =>
        lesuren is >= MinLesuren and <= MaxLesuren
            ? lesuren
            : throw new ArgumentOutOfRangeException(nameof(lesuren), lesuren, $"An activiteitvoorstel takes {MinLesuren} to {MaxLesuren} lesuren.");

    private static ActiviteitType? Soort(ActiviteitType? soort) =>
        soort is null || Enum.IsDefined(soort.Value)
            ? soort
            : throw new ArgumentOutOfRangeException(nameof(soort), soort, "Unknown activiteit type.");
}
