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
    /// Where the hoek appears in the timetable: one row per teaching day of the window, each at a clock time.
    /// <para>
    /// <b>Every placement has them since 2026-09-11</b> (owner: <i>"elke hoek moet een tijdstip krijgen"</i>,
    /// ADR-0027). The sheet used to offer "not in the uurrooster", which left a corner running over its days with no
    /// hour, drawn only as a band. The agenda is a time grid now and a corner belongs on the day at its time, so the
    /// service writes a row for every teaching day. Rows written before that ruling may still be missing; nothing
    /// here depends on them being present.
    /// </para>
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
    /// Puts the hoek in the timetable on one day, from <paramref name="begin"/> to <paramref name="einde"/>.
    /// <para>
    /// The service calls this once per teaching day of the window, which is where the fifteen rows of a
    /// three-week placement come from. It is a separate verb rather than a constructor argument precisely
    /// because the fifteen are then individually movable: see <see cref="Hoekmoment"/>.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">
    /// The day lies outside the placement, the end is not after the start, or the hoek already starts at that
    /// time on that day. Dutch, because a teacher dragging an appearance onto that time is the one who can act on
    /// it.
    /// </exception>
    public Hoekmoment PlanIn(DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        BewaakDag(datum, begin, null);

        var moment = new Hoekmoment(Id, datum, begin, einde);
        _momenten.Add(moment);
        return moment;
    }

    /// <summary>
    /// Moves or resizes one appearance. This is the flexibility the owner asked for: the hoek runs all fortnight,
    /// and on this one Thursday it happens after the break, or runs half an hour longer.
    /// </summary>
    /// <returns><c>false</c> when this placement holds no appearance with that id.</returns>
    public bool VerplaatsMoment(Guid momentId, DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        var moment = _momenten.Find(m => m.Id == momentId);
        if (moment is null)
        {
            return false;
        }

        BewaakDag(datum, begin, momentId);
        moment.Verplaats(datum, begin, einde);
        return true;
    }

    /// <summary>Removes one appearance from the timetable, leaving the placement and the rest of them alone.</summary>
    public bool VerwijderMoment(Guid momentId) => _momenten.RemoveAll(m => m.Id == momentId) > 0;

    /// <summary>
    /// Gives every appearance of this run the same hours, each on the day it is already on (owner, 2026-09-11: <i>"ik
    /// wil op het detailscherm van de hoeken de mogelijkheid om de uren aan te passen"</i>).
    /// <para>
    /// <b>Every appearance, the ones moved by hand included.</b> The owner ruled it that way the same day: new hours
    /// typed for the run mean "the hoek runs then", and a Thursday she once shortened is part of the run. The detail
    /// sheet warns before saving when a day currently differs, so the overwrite is one she was told about.
    /// </para>
    /// <para>
    /// <b>A day holding the hoek twice refuses the whole change, and the refusal names the day.</b> That only happens
    /// after a day was dragged onto another one, and at the same hours the two would be one row written twice, which
    /// <see cref="PlanIn"/> refuses. The first version folded them into one; the owner ruled against that the same
    /// day, because it quietly removes an appearance she placed. She drags one of the two elsewhere first.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">
    /// The end is not after the start, or a day holds this hoek twice. Either way nothing changed. Dutch, because she
    /// can act on both, and the day is written as the detail sheet writes it (<c>maandag 14 september</c>) so the two
    /// sentences name the same day the same way.
    /// </exception>
    public void ZetUren(TimeOnly begin, TimeOnly einde)
    {
        // Both checks come before anything is touched, so a refusal leaves the run exactly as it was.
        Hoekmoment.RequireTijden(begin, einde);

        var dubbel = _momenten
            .GroupBy(m => m.Datum)
            .Where(dag => dag.Count() > 1)
            .OrderBy(dag => dag.Key)
            .Select(dag => dag.Key.ToString("dddd d MMMM", Nederlands))
            .ToList();
        if (dubbel.Count > 0)
        {
            var dagen = dubbel.Count == 1 ? dubbel[0] : $"{string.Join(", ", dubbel[..^1])} en {dubbel[^1]}";
            throw new ArgumentException(
                $"Op {dagen} staat deze hoek twee keer. Sleep eerst een van de twee naar een andere dag, dan kan je de uren aanpassen.");
        }

        foreach (var moment in _momenten)
        {
            moment.Verplaats(moment.Datum, begin, einde);
        }
    }

    // Days in a refusal the teacher reads, in calendar order and written as the detail sheet writes them.
    private static readonly System.Globalization.CultureInfo Nederlands = new("nl-BE");

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
    private void BewaakDag(DateOnly datum, TimeOnly begin, Guid? negeer)
    {
        if (!Omvat(datum))
        {
            throw new ArgumentException("Die dag valt buiten de periode van de hoek.");
        }

        // Twice from the same start on the same day is the one combination that means nothing: it is the same row
        // written twice. Overlapping appearances that start at different times are allowed, like two blocks side
        // by side in any agenda, and two placements of the same hoek landing on one day are checked nowhere,
        // because that is how a teacher expresses two enrichments at once.
        if (_momenten.Any(m => m.Id != negeer && m.Datum == datum && m.Begin == begin))
        {
            throw new ArgumentException("Deze hoek begint al op dat uur op die dag. Kies een ander uur.");
        }
    }

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;
}
