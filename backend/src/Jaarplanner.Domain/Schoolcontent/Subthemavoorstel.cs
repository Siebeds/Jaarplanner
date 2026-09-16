namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// A new subthema the AI proposes for one leeftijd of a thema, holding the open leerplandoelen it would place there
/// (FB-057, ADR-0050). Deliberately <b>not</b> a <see cref="Subthema"/>: a subthema row reaches the agenda, the
/// generation and the rights, and a proposal must reach none of them until a person accepts it (Art. IV.1). Its name
/// and onderzoeksvraag may come from the model's own knowledge (Art. IV.4); its goals never do.
/// </summary>
public sealed class Subthemavoorstel
{
    /// <summary>The shortest and longest subthemaperiode a proposal may have, in weeks (ADR-0050 D7).</summary>
    public const int MinDuurWeken = 1;

    /// <inheritdoc cref="MinDuurWeken"/>
    public const int MaxDuurWeken = 6;

    /// <summary>The longest name, as the subthema form allows.</summary>
    public const int MaxNaamlengte = 200;

    // EF Core materialisation only.
    private Subthemavoorstel()
    {
        Leeftijd = null!;
        Naam = null!;
        Onderzoeksvraag = null!;
        AiMotivatie = null!;
    }

    public Subthemavoorstel(Guid themaId, string leeftijd, string naam, string onderzoeksvraag, int duurWeken, string aiMotivatie)
    {
        ThemaId = themaId;
        Leeftijd = Vereis(leeftijd, nameof(leeftijd));
        Naam = Vereis(naam, nameof(naam));
        Onderzoeksvraag = Vereis(onderzoeksvraag, nameof(onderzoeksvraag));
        DuurWeken = VereisDuur(duurWeken);
        AiMotivatie = Vereis(aiMotivatie, nameof(aiMotivatie));
        Status = KoppelingStatus.Voorgesteld;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The thema the subthema would belong to.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The jaar/fase code the subthema would hold (JK, K2, K3, L1 to L6).</summary>
    public string Leeftijd { get; private set; }

    /// <summary>The proposed name; the accepted one once a person changed it.</summary>
    public string Naam { get; private set; }

    /// <summary>The proposed onderzoeksvraag; the accepted one once a person changed it.</summary>
    public string Onderzoeksvraag { get; private set; }

    /// <summary>The proposed length in weeks.</summary>
    public int DuurWeken { get; private set; }

    /// <summary>Voorgesteld until decided; then aanvaard, manueel (accepted after a change) or geweigerd (ADR-0050 D4).</summary>
    public KoppelingStatus Status { get; private set; }

    /// <summary>Why the AI proposes it (Art. IV.3).</summary>
    public string AiMotivatie { get; private set; }

    /// <summary>The subthema accepting it created, while that subthema exists.</summary>
    public Guid? SubthemaId { get; private set; }

    /// <summary>
    /// Records the acceptance: the values the subthema was made with, and whether they differ from the proposal
    /// (<see cref="KoppelingStatus.Manueel"/>) or not (<see cref="KoppelingStatus.Aanvaard"/>).
    /// </summary>
    public void Aanvaard(Guid subthemaId, string naam, string onderzoeksvraag, int duurWeken, bool doelenGewijzigd)
    {
        VereisOpen();
        var nieuweNaam = Vereis(naam, nameof(naam));
        var nieuweVraag = Vereis(onderzoeksvraag, nameof(onderzoeksvraag));
        var nieuweDuur = VereisDuur(duurWeken);

        var gewijzigd = doelenGewijzigd
            || !string.Equals(nieuweNaam, Naam, StringComparison.Ordinal)
            || !string.Equals(nieuweVraag, Onderzoeksvraag, StringComparison.Ordinal)
            || nieuweDuur != DuurWeken;

        Naam = nieuweNaam;
        Onderzoeksvraag = nieuweVraag;
        DuurWeken = nieuweDuur;
        SubthemaId = subthemaId;
        Status = gewijzigd ? KoppelingStatus.Manueel : KoppelingStatus.Aanvaard;
    }

    /// <summary>Rejects the proposal; its goals are rejected with it by the caller.</summary>
    public void Weiger()
    {
        VereisOpen();
        Status = KoppelingStatus.Geweigerd;
    }

    private void VereisOpen()
    {
        if (Status != KoppelingStatus.Voorgesteld)
        {
            throw new InvalidOperationException("This subthemavoorstel has already been decided.");
        }
    }

    private static string Vereis(string waarde, string naam)
    {
        if (string.IsNullOrWhiteSpace(waarde))
        {
            throw new ArgumentException($"'{naam}' is required.", naam);
        }

        return waarde.Trim();
    }

    private static int VereisDuur(int duurWeken) =>
        duurWeken is < MinDuurWeken or > MaxDuurWeken
            ? throw new ArgumentOutOfRangeException(nameof(duurWeken), duurWeken, $"Expected {MinDuurWeken} to {MaxDuurWeken} weeks.")
            : duurWeken;
}
