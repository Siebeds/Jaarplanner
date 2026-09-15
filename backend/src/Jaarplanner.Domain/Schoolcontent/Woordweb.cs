namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// One gebruiker's woordweb on one subthema: the brainstorm of the goal-first method's step 3 (Art. IV.8, Art. IX.2,
/// ADR-0041). Loose words around the subthema's name, without branches (W1).
/// <para>
/// <b>Personal content, not the leeftijd's shared content.</b> It belongs to <see cref="EigenaarId"/> and follows her
/// across schooljaren (W4): one web per gebruiker and subthema, and nothing about it depends on a klas or a schooljaar.
/// Everyone reads it; only its owner and directie change it (W2, D3), which the rights matrix decides, not this class.
/// </para>
/// <para>
/// <b>Every word carries an Art. IV.2 status.</b> A word the teacher typed is <see cref="KoppelingStatus.Manueel"/>; a
/// word the AI proposed is <see cref="KoppelingStatus.Voorgesteld"/> with its motivation until she accepts it
/// (<see cref="KoppelingStatus.Aanvaard"/>) or rejects it (<see cref="KoppelingStatus.Geweigerd"/>). Only the first two
/// stand in the web (<see cref="WoordwebWoord.StaatInWeb"/>). A rejected word is kept so it is never proposed again (D1);
/// a word she takes out is gone (D6).
/// </para>
/// <para>
/// Words are one set per web, compared without regard to case: "Wind" and "wind" are one word to a teacher, and the
/// spelling entered first is kept. A word she types that the AI had proposed, or that she had rejected, becomes hers.
/// </para>
/// </summary>
public sealed class Woordweb
{
    /// <summary>The longest word a web holds, in characters; the column's length.</summary>
    public const int MaxWoordlengte = 64;

    private readonly List<WoordwebWoord> _woorden = [];

    // EF Core materialisation only.
    private Woordweb()
    {
    }

    /// <summary>Creates the woordweb of <paramref name="eigenaarId"/> on <paramref name="subthemaId"/>, empty.</summary>
    public Woordweb(Guid subthemaId, Guid eigenaarId)
    {
        if (subthemaId == Guid.Empty)
        {
            throw new ArgumentException("A woordweb needs a subthema.", nameof(subthemaId));
        }

        if (eigenaarId == Guid.Empty)
        {
            throw new ArgumentException("A woordweb needs an owner.", nameof(eigenaarId));
        }

        SubthemaId = subthemaId;
        EigenaarId = eigenaarId;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The subthema the web is about (W3).</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>The gebruiker whose web this is (W2, W4).</summary>
    public Guid EigenaarId { get; private set; }

    /// <summary>Every word, in every status, in the order it was first added.</summary>
    public IReadOnlyList<WoordwebWoord> Woorden => _woorden;

    /// <summary>
    /// Whether the web holds a word the teacher decided on: typed, or accepted. Only then may the AI propose more (W5,
    /// Art. IV.8: the AI does not run ahead of the teacher).
    /// </summary>
    public bool HeeftWoordInWeb => _woorden.Any(w => w.StaatInWeb);

    /// <summary>
    /// Adds typed words (<see cref="KoppelingStatus.Manueel"/>). Blank entries are skipped, a word already in the web is
    /// left alone, and a proposed or rejected word the teacher now types becomes hers.
    /// </summary>
    /// <returns>The words that now stand in the web because of this call.</returns>
    /// <exception cref="ArgumentException">A word is longer than <see cref="MaxWoordlengte"/>.</exception>
    public IReadOnlyList<WoordwebWoord> VoegWoordenToe(IEnumerable<string> woorden)
    {
        ArgumentNullException.ThrowIfNull(woorden);

        var toegevoegd = new List<WoordwebWoord>();
        foreach (var ruw in woorden)
        {
            var woord = Normaliseer(ruw);
            if (woord is null)
            {
                continue;
            }

            if (woord.Length > MaxWoordlengte)
            {
                throw new ArgumentException($"A woordweb word is at most {MaxWoordlengte} characters.", nameof(woorden));
            }

            var bestaand = Zoek(woord);
            if (bestaand is null)
            {
                var nieuw = new WoordwebWoord(Id, woord, KoppelingStatus.Manueel, aiMotivatie: null, VolgendVolgnummer());
                _woorden.Add(nieuw);
                toegevoegd.Add(nieuw);
            }
            else if (!bestaand.StaatInWeb)
            {
                bestaand.MaakEigen();
                toegevoegd.Add(bestaand);
            }
        }

        return toegevoegd;
    }

    /// <summary>
    /// Records a word the AI proposed, as <see cref="KoppelingStatus.Voorgesteld"/> with its motivation (Art. IV.1 to
    /// IV.3). Returns <c>null</c>, and records nothing, for a word the web already holds in any status (so a rejected
    /// word never returns, D1), a blank one, one without a motivation, or one longer than <see cref="MaxWoordlengte"/>:
    /// the AI's answer is skipped, never repaired.
    /// </summary>
    /// <exception cref="InvalidOperationException">The web holds no word the teacher decided on yet (W5).</exception>
    public WoordwebWoord? VoegVoorstelToe(string woord, string motivatie)
    {
        VereisWoordInWeb();

        var genormaliseerd = Normaliseer(woord);
        var uitleg = Normaliseer(motivatie);
        if (genormaliseerd is null || uitleg is null || genormaliseerd.Length > MaxWoordlengte || Zoek(genormaliseerd) is not null)
        {
            return null;
        }

        var voorstel = new WoordwebWoord(Id, genormaliseerd, KoppelingStatus.Voorgesteld, uitleg, VolgendVolgnummer());
        _woorden.Add(voorstel);
        return voorstel;
    }

    /// <summary>
    /// The teacher's decision on a proposed word: <see cref="KoppelingStatus.Aanvaard"/> puts it in the web,
    /// <see cref="KoppelingStatus.Geweigerd"/> keeps it out for good (D1).
    /// </summary>
    /// <exception cref="ArgumentException">The status is not aanvaard or geweigerd.</exception>
    /// <exception cref="InvalidOperationException">The web has no such word, or it is not a proposal awaiting a decision.</exception>
    public WoordwebWoord Beslis(Guid woordId, KoppelingStatus status)
    {
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd))
        {
            throw new ArgumentException("A proposed word is accepted or rejected.", nameof(status));
        }

        var woord = ZoekOpId(woordId);
        if (woord.Status != KoppelingStatus.Voorgesteld)
        {
            throw new InvalidOperationException("Only a proposed word awaits a decision.");
        }

        woord.Beslis(status);
        return woord;
    }

    /// <summary>
    /// Takes a word out of the web (D6). Only a word that stands in it: a proposal is decided, not removed, and a
    /// rejected word stays so it is not proposed again.
    /// </summary>
    /// <exception cref="InvalidOperationException">The web has no such word, or it does not stand in the web.</exception>
    public void VerwijderWoord(Guid woordId)
    {
        var woord = ZoekOpId(woordId);
        if (!woord.StaatInWeb)
        {
            throw new InvalidOperationException("Only a word that stands in the web can be taken out.");
        }

        _woorden.Remove(woord);
    }

    /// <summary>Refuses an AI request on a web that holds no word the teacher decided on (W5).</summary>
    /// <exception cref="InvalidOperationException">The web holds no typed or accepted word.</exception>
    public void VereisWoordInWeb()
    {
        if (!HeeftWoordInWeb)
        {
            throw new InvalidOperationException("The AI proposes words only once the web holds a word of the teacher's own.");
        }
    }

    private WoordwebWoord? Zoek(string woord) =>
        _woorden.FirstOrDefault(w => string.Equals(w.Woord, woord, StringComparison.OrdinalIgnoreCase));

    private WoordwebWoord ZoekOpId(Guid woordId) =>
        _woorden.FirstOrDefault(w => w.Id == woordId)
        ?? throw new InvalidOperationException("This woordweb has no such word.");

    private int VolgendVolgnummer() => _woorden.Count == 0 ? 1 : _woorden.Max(w => w.Volgnummer) + 1;

    private static string? Normaliseer(string? tekst) => string.IsNullOrWhiteSpace(tekst) ? null : tekst.Trim();
}
