using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A <see cref="Hoek"/> running in one class over one stretch of days, with the <see cref="Hoekverrijking"/>en
/// that say what is in it and the <see cref="Hoekmoment"/>en that put it in the timetable (owner, 2026-08-30).
/// <para>
/// <b>IT IS NOT PART OF THE <see cref="Jaarplan"/> AGGREGATE, AND THAT IS A DECISION RATHER THAN AN
/// OVERSIGHT.</b> Every other placed thing hangs off the plan: <see cref="Themaplaatsing"/>,
/// <see cref="Subthemaplaatsing"/>, <see cref="Activiteitplaatsing"/>. This one keys on the
/// <see cref="KlasId"/> directly, for three reasons that point the same way.
/// </para>
/// <para>
/// <b>1. A (re)generation must never touch a hoek, and here it structurally cannot.</b> Art. IX.3 fixes what a
/// run may discard: a placement that is <c>Voorgesteld</c> and not <c>vergrendeld</c>. Every one of those words
/// is about the plan's own contents. A boekenhoek is not a proposal, nothing suggested it and nothing may
/// replace it. Keeping it out of the aggregate turns "regeneration leaves hoeken alone" from a rule somebody has
/// to remember into a fact about the object graph.
/// </para>
/// <para>
/// <b>2. It grants no dekking, and it holds nothing that could.</b> Art. V.1 makes a leerplandoel gedekt through
/// a link hanging off a placed thema. A hoek carries no doelkoppelingen at all (owner ruling), so unlike a
/// subthema window there is not even a near-miss to guard against.
/// </para>
/// <para>
/// <b>3. The plan's invariants have nothing to say about it.</b> <c>Jaarplan.PlaatsActiviteit</c> exists to check
/// that an activiteit's klas matches the plan's, because an activiteit reaches its klas through two hops of
/// school content. A hoek states its klas itself, so the check the aggregate would perform is the one the FK
/// already makes.
/// </para>
/// <para>
/// <b>TWO PLACEMENTS OF THE SAME HOEK MAY OVERLAP, INCLUDING ON ONE DAY.</b> Nothing here forbids it, and that
/// is what the owner asked for: the same boekenhoek dragged onto one Tuesday twice, each time with a different
/// enrichment. Each drag of a fiche is its own placement, so each carries its own
/// <see cref="Hoekverrijking"/>en, and the two answers live in two objects instead of contradicting each other
/// inside one. Within a single placement the enrichments still may not overlap, for the same reason read from
/// the other side: there, one day would have two answers and no way to choose.
/// </para>
/// </summary>
public sealed class Hoekplaatsing
{
    private readonly List<Hoekverrijking> _verrijkingen = [];
    private readonly List<Hoekmoment> _momenten = [];

    // EF Core materialisation only.
    private Hoekplaatsing()
    {
    }

    /// <summary>Places a hoek in a class for <paramref name="van"/>-<paramref name="tot"/>.</summary>
    /// <param name="klasId">The class the corner runs in.</param>
    /// <param name="hoekId">
    /// The corner. That it belongs to the same klas is enforced by the service, which is the layer that can read
    /// both rows; this type stores an honest key.
    /// </param>
    /// <param name="van">First day, inclusive.</param>
    /// <param name="tot">Last day, inclusive. May equal <paramref name="van"/>.</param>
    /// <exception cref="ArgumentException">The window ends before it starts.</exception>
    public Hoekplaatsing(Guid klasId, Guid hoekId, DateOnly van, DateOnly tot)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een hoekperiode kan niet voor de eerste dag liggen.");
        }

        KlasId = RequireId(klasId, nameof(klasId));
        HoekId = RequireId(hoekId, nameof(hoekId));
        Van = van;
        Tot = tot;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The class this placement is in.</summary>
    public Guid KlasId { get; private set; }

    /// <summary>The placed corner.</summary>
    public Guid HoekId { get; private set; }

    /// <summary>First day, inclusive.</summary>
    public DateOnly Van { get; private set; }

    /// <summary>Last day, inclusive.</summary>
    public DateOnly Tot { get; private set; }

    /// <summary>What is in the corner, over the sub-windows the teacher gave (never overlapping, gaps allowed).</summary>
    public IReadOnlyList<Hoekverrijking> Verrijkingen => _verrijkingen;

    /// <summary>
    /// Where the hoek appears in the timetable: one row per day it takes a lesuur on. Empty when the teacher
    /// answered "no" to putting it in the uurrooster, which is a normal state: the placement still draws a band
    /// over its days, it just claims no hour.
    /// </summary>
    public IReadOnlyList<Hoekmoment> Momenten => _momenten;

    /// <summary>Whether this placement covers <paramref name="datum"/>.</summary>
    public bool Omvat(DateOnly datum) => datum >= Van && datum <= Tot;

    /// <summary>Whether this placement shares a day with <paramref name="van"/>-<paramref name="tot"/>.</summary>
    public bool Overlapt(DateOnly van, DateOnly tot) => van <= Tot && tot >= Van;

    /// <summary>
    /// What is in the corner on one day, or <c>null</c> where the teacher left a gap. A gap is an ordinary state
    /// and not a missing value: the boekenhoek is open in december with nothing special in it.
    /// </summary>
    public Hoekverrijking? VerrijkingOp(DateOnly datum) => _verrijkingen.Find(v => v.Omvat(datum));

    /// <summary>
    /// Adds an enrichment over <paramref name="van"/>-<paramref name="tot"/>.
    /// <para>
    /// <b>Two rules, both enforced here because only the placement can see them.</b> The window must lie inside
    /// this placement's own, since an enrichment on a day the hoek does not run describes nothing. And it may not
    /// overlap an enrichment already on this placement: within one placement two answers to "what is in the
    /// boekenhoek today" is not a richer answer, it is an unanswerable question. A teacher who genuinely wants
    /// two at once drags the fiche twice, which makes two placements, each with its own answer.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">
    /// The window ends before it starts, falls outside the placement, or overlaps an existing enrichment. Dutch:
    /// every one of these is a sentence the teacher who typed the dates can act on (Art. II.3).
    /// </exception>
    public Hoekverrijking VoegVerrijkingToe(DateOnly van, DateOnly tot, string tekst)
    {
        BewaakVenster(van, tot, null);

        var verrijking = new Hoekverrijking(Id, van, tot, tekst);
        _verrijkingen.Add(verrijking);
        return verrijking;
    }

    /// <summary>
    /// Rewrites one enrichment, moving its window if asked. The same two rules apply, with the enrichment being
    /// changed excluded from the overlap check so that leaving its dates alone is not an overlap with itself.
    /// </summary>
    /// <returns><c>false</c> when this placement holds no enrichment with that id.</returns>
    public bool WijzigVerrijking(Guid verrijkingId, DateOnly van, DateOnly tot, string tekst)
    {
        var verrijking = _verrijkingen.Find(v => v.Id == verrijkingId);
        if (verrijking is null)
        {
            return false;
        }

        BewaakVenster(van, tot, verrijkingId);
        verrijking.Wijzig(van, tot, tekst);
        return true;
    }

    /// <summary>Removes one enrichment. <c>false</c> when this placement holds none with that id.</summary>
    public bool VerwijderVerrijking(Guid verrijkingId) => _verrijkingen.RemoveAll(v => v.Id == verrijkingId) > 0;

    /// <summary>
    /// Puts the hoek in the timetable on one day at one lesuur.
    /// <para>
    /// The service calls this once per teaching day of the window when the teacher answers "yes" to the
    /// uurrooster question, which is where the fifteen rows of a three-week placement come from. It is a
    /// separate verb rather than a constructor argument precisely because the fifteen are then individually
    /// movable: see <see cref="Hoekmoment"/>.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">
    /// The day lies outside the placement, or the hoek already takes that lesuur on that day. Dutch, because a
    /// teacher dragging an appearance onto an occupied slot is the one who can act on it.
    /// </exception>
    public Hoekmoment PlanIn(DateOnly datum, int volgorde)
    {
        BewaakDag(datum, volgorde, null);

        var moment = new Hoekmoment(Id, datum, volgorde);
        _momenten.Add(moment);
        return moment;
    }

    /// <summary>
    /// Moves one appearance to another day and/or lesuur. This is the flexibility the owner asked for: the hoek
    /// runs all fortnight, and on this one Thursday it happens at a different hour.
    /// </summary>
    /// <returns><c>false</c> when this placement holds no appearance with that id.</returns>
    public bool VerplaatsMoment(Guid momentId, DateOnly datum, int volgorde)
    {
        var moment = _momenten.Find(m => m.Id == momentId);
        if (moment is null)
        {
            return false;
        }

        BewaakDag(datum, volgorde, momentId);
        moment.Verplaats(datum, volgorde);
        return true;
    }

    /// <summary>Removes one appearance from the timetable, leaving the placement and the rest of them alone.</summary>
    public bool VerwijderMoment(Guid momentId) => _momenten.RemoveAll(m => m.Id == momentId) > 0;

    /// <summary>
    /// Moves the placement to a new range.
    /// <para>
    /// <b>Enrichments block the move; appearances travel with it.</b> The asymmetry is deliberate and it tracks
    /// who wrote the thing. A <see cref="Hoekverrijking"/> is a sentence the teacher typed about her own
    /// classroom, so one that would fall outside the new range makes this refuse: dropping it would throw her
    /// text away and clamping it would silently change which days she said it about. A <see cref="Hoekmoment"/>
    /// is generated, one per teaching day, so those outside the new range are simply removed.
    /// </para>
    /// </summary>
    /// <returns>How many appearances were removed, so the caller can say so rather than let it happen quietly.</returns>
    /// <exception cref="ArgumentException">
    /// The window ends before it starts, or an enrichment would fall outside it. Dutch, and it names the count,
    /// because "one of your verrijkingen is in the way" without saying how many is a sentence a teacher cannot
    /// act on.
    /// </exception>
    public int Herzet(DateOnly van, DateOnly tot)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een hoekperiode kan niet voor de eerste dag liggen.");
        }

        var buiten = _verrijkingen.Count(v => v.Van < van || v.Tot > tot);
        if (buiten > 0)
        {
            throw new ArgumentException(
                buiten == 1
                    ? "Er valt 1 verrijking buiten de nieuwe periode. Pas die verrijking eerst aan of verwijder ze."
                    : $"Er vallen {buiten} verrijkingen buiten de nieuwe periode. Pas die eerst aan of verwijder ze.");
        }

        var verwijderd = _momenten.RemoveAll(m => m.Datum < van || m.Datum > tot);

        Van = van;
        Tot = tot;
        return verwijderd;
    }

    /// <summary>The window rules shared by adding and changing an enrichment.</summary>
    private void BewaakVenster(DateOnly van, DateOnly tot, Guid? negeer)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een verrijking kan niet voor de eerste dag liggen.");
        }

        if (van < Van || tot > Tot)
        {
            throw new ArgumentException("Een verrijking moet binnen de periode van de hoek vallen.");
        }

        if (_verrijkingen.Any(v => v.Id != negeer && v.Overlapt(van, tot)))
        {
            throw new ArgumentException("Er loopt al een verrijking op die dagen. Pas die eerst aan.");
        }
    }

    /// <summary>The rules shared by scheduling and moving one appearance.</summary>
    private void BewaakDag(DateOnly datum, int volgorde, Guid? negeer)
    {
        if (!Omvat(datum))
        {
            throw new ArgumentException("Die dag valt buiten de periode van de hoek.");
        }

        // Twice at the same hour on the same day is the one combination that means nothing: it is the same row
        // written twice. Two placements of the same hoek landing on one day is fine and is checked nowhere,
        // because that is how a teacher expresses two enrichments at once.
        if (_momenten.Any(m => m.Id != negeer && m.Datum == datum && m.Volgorde == volgorde))
        {
            throw new ArgumentException("Deze hoek staat al op dat lesuur op die dag.");
        }
    }

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;
}
