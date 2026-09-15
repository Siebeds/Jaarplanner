using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// A <see cref="Hoek"/> running in one class over one stretch of days, with the <see cref="Hoekmoment"/>en that put it
/// in the timetable (owner, 2026-08-30).
/// <para>
/// <b>What is IN the corner is not here.</b> That is a <see cref="Hoekverrijking"/>, which since FB-020 belongs to the
/// hoek and the subthemaperiode it runs in rather than to a placement (ADR-0040). A placement says when the corner is
/// in the timetable; the verrijking says what the corner holds while a subthema runs, whether or not it is on the
/// timetable that day.
/// </para>
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
/// <b>TWO PLACEMENTS OF THE SAME HOEK MAY OVERLAP, INCLUDING ON ONE DAY.</b> Nothing here forbids it, and that is what
/// the owner asked for: the same boekenhoek dragged onto one Tuesday twice, once in the morning and once after lunch.
/// Each drag of a fiche is its own placement with its own appearances.
/// </para>
/// </summary>
public sealed class Hoekplaatsing
{
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
    /// <para>
    /// <b>The day must be a school day.</b> The service plans a row only on the open weekdays of the window, so a move
    /// must not write one on a Saturday, in a vakantie or on a vrije dag either: such a row would be counted among the
    /// hoek's "schooldagen". The time grid does not refuse a weekend: it draws Saturday and Sunday as open columns,
    /// because the server's <c>IsLesdag</c> counts a weekend as open (see <c>Weekplanningweergave</c>), so a block
    /// dragged onto a weekend inside the window reaches this refusal and the agenda shows its sentence. Outside the
    /// window, <see cref="BewaakDag"/> answers first. It is the rule
    /// <see cref="AlgemeneFicheplaatsing.VerplaatsMoment"/> applies (TB-011).
    /// </para>
    /// </summary>
    /// <param name="schooljaar">The class's school year, whose open weekdays decide which days are allowed.</param>
    /// <returns><c>false</c> when this placement holds no appearance with that id.</returns>
    /// <exception cref="ArgumentException">
    /// The day lies outside the placement, is a weekend day or a closure, the end is not after the start, or the hoek
    /// already starts at that time on that day.
    /// </exception>
    public bool VerplaatsMoment(Guid momentId, DateOnly datum, TimeOnly begin, TimeOnly einde, Schooljaar schooljaar)
    {
        ArgumentNullException.ThrowIfNull(schooljaar);

        var moment = _momenten.Find(m => m.Id == momentId);
        if (moment is null)
        {
            return false;
        }

        BewaakDag(datum, begin, momentId);

        if (schooljaar.OpenWeekdagen(datum, datum).Count == 0)
        {
            // Word for word the refusal of AlgemeneFicheplaatsing.VerplaatsMoment, so one rule reads one way; the
            // tests of both types pin the literal, so rewrite them together.
            throw new ArgumentException("Op die dag is er geen school. Kies een schooldag.");
        }

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
    /// <b>A day holding the hoek more than once refuses the whole change, and the refusal names the day.</b> That only
    /// happens after days were dragged onto another one (twice, three times: <see cref="BewaakDag"/> only refuses the
    /// same start), and at the same hours they would be one row written several times, which <see cref="PlanIn"/>
    /// refuses. The first version folded them into one; the owner ruled against that the same day, because it quietly
    /// removes appearances she placed. She drags the extra ones elsewhere first.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">
    /// The end is not after the start, or a day holds this hoek more than once. Either way nothing changed. Dutch,
    /// because she can act on both. The sentence is word for word <c>hoekdetail.dubbeleDag</c> in nl.json, with the
    /// days written as the detail sheet writes them (<c>maandag 14 september</c>), and both tests pin the literal.
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
                $"Op {dagen} staat deze hoek meer dan één keer. Sleep er eerst één naar een andere dag, tot geen dag de hoek meer dan één keer heeft. Dan kan je de uren aanpassen.");
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
    /// <b>Appearances outside the new range are removed, and counted.</b> A <see cref="Hoekmoment"/> is generated, one
    /// per teaching day, so dropping one costs the teacher no text; the count is returned so the caller can say so
    /// rather than let it happen quietly. Nothing a teacher wrote hangs on a placement any more (FB-020), so nothing
    /// blocks the move.
    /// </para>
    /// </summary>
    /// <returns>How many appearances were removed.</returns>
    /// <exception cref="ArgumentException">The window ends before it starts.</exception>
    public int Herzet(DateOnly van, DateOnly tot)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag van een hoekperiode kan niet voor de eerste dag liggen.");
        }

        var verwijderd = _momenten.RemoveAll(m => m.Datum < van || m.Datum > tot);

        Van = van;
        Tot = tot;
        return verwijderd;
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
        // by side in any agenda, and two placements of the same hoek landing on one day are checked nowhere.
        if (_momenten.Any(m => m.Id != negeer && m.Datum == datum && m.Begin == begin))
        {
            throw new ArgumentException("Deze hoek begint al op dat uur op die dag. Kies een ander uur.");
        }
    }

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;
}
