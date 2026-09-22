using System.Diagnostics.CodeAnalysis;

namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// An activiteit the AI proposes under one <see cref="Subthema"/>, in one of two ways (<see cref="Voorstelbron"/>).
/// <para>
/// <b>Asked for</b> (FB-025, ADR-0056): the gebruiker who asked owns it, only she and admin see and decide it (D2, A3),
/// and accepting it creates an ordinary own <see cref="Activiteit"/> of hers (A2), whose id this proposal then keeps.
/// </para>
/// <para>
/// <b>Brought by the cat on an aanbod-gat</b> (FB-070, ADR-0060): it belongs to a klas rather than to one person, so
/// <see cref="GebruikerId"/> is null and <see cref="KlasId"/> is set. Every leerkracht of that klas sees it, whoever
/// accepts becomes the owner of the activiteit it makes, and the decision settles it for all of them (D2). It carries
/// the <see cref="ThemaplaatsingId"/> it was brought for, so the cat brings none a second time for the same placement
/// (G3), and a suggested moment, because an own activiteit that is not planned counts for nothing (G5, Art. V.1).
/// </para>
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

    /// <summary>A new open proposal a gebruiker asked for (ADR-0056).</summary>
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

        Bron = Voorstelbron.Gevraagd;
        SubthemaId = subthemaId;
        GebruikerId = gebruikerId;
        Vul(naam, activiteitType, verwachteUitkomsten, lengteInLesuren, onderzoeksvraagId, leerplandoelCodes, aiMotivatie);
    }

    /// <summary>
    /// A new open proposal the cat brings on an aanbod-gat (FB-070, ADR-0060 D1). It is addressed to the klas rather
    /// than to one gebruiker (D2), it remembers the thema placement it was brought for (G3), and it carries the
    /// moment the tool fitted it into (G5, D3).
    /// </summary>
    /// <param name="subthemaId">The subthema of the thema, at the klas's leeftijd, the model put it under.</param>
    /// <param name="klasId">The klas whose aanbod-gat it answers; its leerkrachten decide it.</param>
    /// <param name="themaplaatsingId">The placement whose start it was brought for.</param>
    /// <param name="datum">The suggested day: a schooldag inside the thema's period.</param>
    /// <param name="begin">When it would start on that day, inside the schooluren.</param>
    /// <param name="einde">When it would end. Must lie after <paramref name="begin"/>.</param>
    /// <exception cref="ArgumentException">
    /// A required id is empty, a required text is blank or too long, a code is blank, or the end is not after the start.
    /// </exception>
    /// <exception cref="ArgumentOutOfRangeException">The length or the soort is out of range.</exception>
    public static Activiteitvoorstel OpAanbodgat(
        Guid subthemaId,
        Guid klasId,
        Guid themaplaatsingId,
        string naam,
        ActiviteitType? activiteitType,
        string verwachteUitkomsten,
        int lengteInLesuren,
        Guid? onderzoeksvraagId,
        IEnumerable<string> leerplandoelCodes,
        string aiMotivatie,
        DateOnly datum,
        TimeOnly begin,
        TimeOnly einde)
    {
        ArgumentNullException.ThrowIfNull(leerplandoelCodes);
        if (klasId == Guid.Empty)
        {
            throw new ArgumentException("'klasId' is required.", nameof(klasId));
        }

        if (themaplaatsingId == Guid.Empty)
        {
            throw new ArgumentException("'themaplaatsingId' is required.", nameof(themaplaatsingId));
        }

        if (einde <= begin)
        {
            throw new ArgumentException("'einde' must lie after 'begin'.", nameof(einde));
        }

        var voorstel = new Activiteitvoorstel
        {
            Bron = Voorstelbron.KatAanbodgat,
            SubthemaId = subthemaId,
            KlasId = klasId,
            ThemaplaatsingId = themaplaatsingId,
            Datum = datum,
            Begin = begin,
            Einde = einde,
        };
        voorstel.Vul(naam, activiteitType, verwachteUitkomsten, lengteInLesuren, onderzoeksvraagId, leerplandoelCodes, aiMotivatie);
        return voorstel;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>Where it came from: asked for, or brought by the cat (ADR-0060 D1).</summary>
    public Voorstelbron Bron { get; private set; }

    /// <summary>The subthema it is proposed under.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>
    /// Who asked: she, and admin, see and decide it (ADR-0056 D2, A3); an accepted one becomes her own activiteit.
    /// <c>null</c> for <see cref="Voorstelbron.KatAanbodgat"/>, which nobody asked for: there
    /// <see cref="KlasId"/> says who is addressed, and whoever accepts becomes the owner (ADR-0060 D2).
    /// </summary>
    public Guid? GebruikerId { get; private set; }

    /// <summary>
    /// The klas whose aanbod-gat this answers, for <see cref="Voorstelbron.KatAanbodgat"/>; <c>null</c> for a proposal
    /// that was asked for, which belongs to a person and not to a klas.
    /// </summary>
    public Guid? KlasId { get; private set; }

    /// <summary>
    /// The thema placement this was brought for, so the cat brings none a second time for the same one (ADR-0060 G3).
    /// <c>null</c> for a proposal that was asked for.
    /// <para>
    /// <b>A plain id, with no foreign key.</b> A <c>Themaplaatsing</c> is an owned collection of <c>Jaarplan</c>
    /// (ADR-0053), so it has no table of its own to reference. What this stores is a memory of which start the cat
    /// answered, not a navigation: a placement that is gone leaves the memory behind, and a placement made anew is a
    /// new start the cat may answer again.
    /// </para>
    /// </summary>
    public Guid? ThemaplaatsingId { get; private set; }

    /// <summary>The suggested day, for a cat proposal; <c>null</c> otherwise. Accepting plans it here (ADR-0060 D4).</summary>
    public DateOnly? Datum { get; private set; }

    /// <summary>When it would start on <see cref="Datum"/>; <c>null</c> without one.</summary>
    public TimeOnly? Begin { get; private set; }

    /// <summary>When it would end; <c>null</c> without one. Always after <see cref="Begin"/>.</summary>
    public TimeOnly? Einde { get; private set; }

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
    /// <param name="moment">
    /// The day and hours the activiteit was actually planned on, for a cat proposal she may move before accepting
    /// (ADR-0060 D4); <c>null</c> leaves the suggested moment as it was. A moment that differs makes the decision
    /// <see cref="KoppelingStatus.Manueel"/>, exactly as an edited name does: she changed the proposal.
    /// </param>
    /// <exception cref="InvalidOperationException">It was already decided.</exception>
    /// <exception cref="ArgumentException">The moment's end does not lie after its start.</exception>
    public void Aanvaard(
        Guid activiteitId,
        string naam,
        ActiviteitType? activiteitType,
        string verwachteUitkomsten,
        int lengteInLesuren,
        IReadOnlyCollection<string> leerplandoelCodes,
        (DateOnly Datum, TimeOnly Begin, TimeOnly Einde)? moment = null)
    {
        ArgumentNullException.ThrowIfNull(leerplandoelCodes);
        VereisOpen();

        if (moment is { } gekozen && gekozen.Einde <= gekozen.Begin)
        {
            throw new ArgumentException("'einde' must lie after 'begin'.", nameof(moment));
        }

        var nieuweNaam = Tekst(naam, MaxNaamlengte, nameof(naam));
        var nieuweUitkomsten = Tekst(verwachteUitkomsten, MaxUitkomstlengte, nameof(verwachteUitkomsten));
        var nieuweLengte = Lengte(lengteInLesuren);
        var nieuweSoort = Soort(activiteitType);
        var gewijzigd = nieuweNaam != Naam
            || nieuweSoort != ActiviteitType
            || nieuweUitkomsten != VerwachteUitkomsten
            || nieuweLengte != LengteInLesuren
            || !leerplandoelCodes.ToHashSet(StringComparer.Ordinal).SetEquals(_leerplandoelCodes)
            || (moment is { } m && (m.Datum != Datum || m.Begin != Begin || m.Einde != Einde));

        Naam = nieuweNaam;
        ActiviteitType = nieuweSoort;
        VerwachteUitkomsten = nieuweUitkomsten;
        LengteInLesuren = nieuweLengte;
        _leerplandoelCodes = leerplandoelCodes.Distinct(StringComparer.Ordinal).ToList();
        if (moment is { } gepland)
        {
            (Datum, Begin, Einde) = gepland;
        }

        ActiviteitId = activiteitId;
        Status = gewijzigd ? KoppelingStatus.Manueel : KoppelingStatus.Aanvaard;
    }

    /// <summary>What both sources share: the content the AI proposed, and the status it starts in.</summary>
    [MemberNotNull(nameof(Naam), nameof(VerwachteUitkomsten), nameof(AiMotivatie))]
    private void Vul(
        string naam,
        ActiviteitType? activiteitType,
        string verwachteUitkomsten,
        int lengteInLesuren,
        Guid? onderzoeksvraagId,
        IEnumerable<string> leerplandoelCodes,
        string aiMotivatie)
    {
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
