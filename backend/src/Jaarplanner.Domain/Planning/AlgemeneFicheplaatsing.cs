namespace Jaarplanner.Domain.Planning;

/// <summary>
/// An algemene fiche planned in one class over a stretch of days, on chosen weekdays at one time of day: "turnen,
/// every Monday from 10:30 to 11:20, september to june" (owner, 2026-09-11).
/// <para>
/// <b>NOT PART OF THE <see cref="Jaarplan"/> AGGREGATE, for the first reason <see cref="Hoekplaatsing"/> gives.</b>
/// Art. IX.3 lets a (re)generation discard a placement that is <c>Voorgesteld</c> and not <c>vergrendeld</c>; nothing
/// proposes a turnles, so none of those words apply, and keeping the row outside the aggregate makes "a regeneration
/// never touches a fiche" a fact about the object graph rather than a rule to remember.
/// </para>
/// <para>
/// <b>Unlike a hoekplaatsing, it does move dekking</b> (owner ruling, 2026-09-11): a fiche that has at least one
/// placement in its class's agenda makes the fiche's goal links count (Art. V.1 as amended). Nothing on this type
/// computes that; it is the dekking computation's rule, and this row is only the evidence that the fiche is planned.
/// </para>
/// <para>
/// <b>The weekdays are not stored.</b> They decide which <see cref="AlgemeneFichemoment"/>en are written when the
/// teacher plans the fiche, and after that the moments are the truth: one Monday moved to Tuesday is still part of the
/// run. Keeping the rule beside them would be a second answer to "when is turnen?" that the first move falsifies.
/// </para>
/// </summary>
public sealed class AlgemeneFicheplaatsing
{
    private readonly List<AlgemeneFichemoment> _momenten = [];

    // EF Core materialisation only.
    private AlgemeneFicheplaatsing()
    {
    }

    /// <summary>Plans a fiche in a class for <paramref name="van"/>-<paramref name="tot"/>.</summary>
    /// <param name="klasId">The class.</param>
    /// <param name="algemeneFicheId">
    /// The fiche. That it belongs to the same klas is the service's check, which can read both rows.
    /// </param>
    /// <param name="van">First day, inclusive.</param>
    /// <param name="tot">Last day, inclusive. May equal <paramref name="van"/>.</param>
    /// <exception cref="ArgumentException">The window ends before it starts. Dutch: two date fields on her screen.</exception>
    public AlgemeneFicheplaatsing(Guid klasId, Guid algemeneFicheId, DateOnly van, DateOnly tot)
    {
        if (tot < van)
        {
            throw new ArgumentException("De laatste dag kan niet voor de eerste dag liggen.");
        }

        KlasId = RequireId(klasId, nameof(klasId));
        AlgemeneFicheId = RequireId(algemeneFicheId, nameof(algemeneFicheId));
        Van = van;
        Tot = tot;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The class this placement is in.</summary>
    public Guid KlasId { get; private set; }

    /// <summary>The planned fiche.</summary>
    public Guid AlgemeneFicheId { get; private set; }

    /// <summary>First day, inclusive.</summary>
    public DateOnly Van { get; private set; }

    /// <summary>Last day, inclusive.</summary>
    public DateOnly Tot { get; private set; }

    /// <summary>Where the fiche appears in the timetable: one row per day it happens on.</summary>
    public IReadOnlyList<AlgemeneFichemoment> Momenten => _momenten;

    /// <summary>Whether this placement covers <paramref name="datum"/>.</summary>
    public bool Omvat(DateOnly datum) => datum >= Van && datum <= Tot;

    /// <summary>
    /// The days a recurring fiche lands on: every open weekday of <paramref name="schooljaar"/> between
    /// <paramref name="van"/> and <paramref name="tot"/> that falls on one of <paramref name="weekdagen"/>.
    /// <para>
    /// <b>This is the one rule the feature adds, so it is here and tested on its own.</b> "Every Monday" means every
    /// Monday the class is in front of the teacher: a Monday inside the herfstvakantie or on a pedagogische studiedag
    /// is a lesson that does not happen, so <see cref="Schooljaar.OpenWeekdagen"/> decides first and the weekday
    /// filter second.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">
    /// No weekday given, a Saturday or Sunday among them, or no teaching day at all in the result. Dutch, because each
    /// is a choice the teacher made in the sheet and can change.
    /// </exception>
    public static IReadOnlyList<DateOnly> Herhalingsdagen(
        Schooljaar schooljaar,
        DateOnly van,
        DateOnly tot,
        IReadOnlyCollection<DayOfWeek> weekdagen)
    {
        ArgumentNullException.ThrowIfNull(schooljaar);
        ArgumentNullException.ThrowIfNull(weekdagen);

        if (weekdagen.Count == 0)
        {
            throw new ArgumentException("Kies minstens één weekdag.");
        }

        if (weekdagen.Any(d => d is DayOfWeek.Saturday or DayOfWeek.Sunday))
        {
            throw new ArgumentException("Een algemene fiche kan alleen op een schooldag van maandag tot vrijdag vallen.");
        }

        var dagen = schooljaar.OpenWeekdagen(van, tot).Where(d => weekdagen.Contains(d.DayOfWeek)).ToList();

        if (dagen.Count == 0)
        {
            throw new ArgumentException("Op de gekozen weekdagen valt in die periode geen enkele schooldag.");
        }

        return dagen;
    }

    /// <summary>Puts the fiche in the timetable on one day, from <paramref name="begin"/> to <paramref name="einde"/>.</summary>
    /// <exception cref="ArgumentException">
    /// The day lies outside the placement, the end is not after the start, or this placement already starts at that
    /// time on that day.
    /// </exception>
    public AlgemeneFichemoment PlanIn(DateOnly datum, TimeOnly begin, TimeOnly einde)
    {
        BewaakDag(datum, begin, null);

        var moment = new AlgemeneFichemoment(Id, datum, begin, einde);
        _momenten.Add(moment);
        return moment;
    }

    /// <summary>
    /// Moves or resizes one occurrence: this week the turnles is on Tuesday, and it runs a little longer.
    /// <para>
    /// <b>The day must be a school day, for the reason <see cref="Herhalingsdagen"/> gives.</b> Planning never writes
    /// a row on a weekend or in a vakantie, so a move must not either: otherwise one occurrence can end up on a
    /// Saturday or in a vakantie and be counted among the "schooldagen" of the run. The time grid does not refuse a
    /// weekend: it draws Saturday and Sunday as open columns, because the server's <c>IsLesdag</c> counts a weekend as
    /// open (see <c>Weekplanningweergave</c>). So a block dragged onto a weekend inside the window reaches this refusal,
    /// and so does a vakantie inside the window picked in the detail sheet's date field; the sheet refuses a weekend
    /// itself, with the same sentence. Outside the window, <see cref="BewaakDag"/> answers first (antagonist, E10-03
    /// round 1; the grid half corrected in TB-011).
    /// </para>
    /// </summary>
    /// <param name="schooljaar">The class's school year, whose open weekdays decide which days are allowed.</param>
    /// <returns><c>false</c> when this placement holds no occurrence with that id.</returns>
    /// <exception cref="ArgumentException">
    /// The day lies outside the placement, is a weekend day or a closure, the end is not after the start, or this
    /// placement already starts at that time on that day.
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
            // Twin of the frontend's `fichedetail.geenSchooldag`, shown before sending for a weekend, and of the same
            // refusal in Hoekplaatsing.VerplaatsMoment (TB-011); every side's tests pin the literal, so rewrite them
            // together.
            throw new ArgumentException("Op die dag is er geen school. Kies een schooldag.");
        }

        moment.Verplaats(datum, begin, einde);
        return true;
    }

    /// <summary>
    /// Sets or clears what the class does in ONE occurrence (FB-022). Only that day's row changes: the other days of the
    /// run stay empty until they are filled in themselves.
    /// </summary>
    /// <returns><c>false</c> when this placement holds no occurrence with that id.</returns>
    /// <exception cref="ArgumentException">The text is longer than <see cref="AlgemeneFichemoment.MaxTekstLengte"/>.</exception>
    public bool ZetTekst(Guid momentId, string? tekst)
    {
        var moment = _momenten.Find(m => m.Id == momentId);
        if (moment is null)
        {
            return false;
        }

        moment.ZetTekst(tekst);
        return true;
    }

    /// <summary>
    /// Takes ONE occurrence out of the agenda, with its day text, leaving the placement and its other days alone
    /// (TB-030). Whether a placement left without occurrences should go too is the service's call: it is the layer that
    /// knows the row still counts for dekking.
    /// </summary>
    /// <returns><c>false</c> when this placement holds no occurrence with that id.</returns>
    public bool VerwijderMoment(Guid momentId) => _momenten.RemoveAll(m => m.Id == momentId) > 0;

    private void BewaakDag(DateOnly datum, TimeOnly begin, Guid? negeer)
    {
        if (!Omvat(datum))
        {
            throw new ArgumentException("Die dag valt buiten de periode van deze fiche.");
        }

        // Starting twice at the same time on one day within ONE placement is the same row written twice, which is the
        // rule Hoekplaatsing applies to its own moments. Two placements of the same fiche on one day are not checked:
        // that is how a teacher plans a second onthaal after lunch.
        if (_momenten.Any(m => m.Id != negeer && m.Datum == datum && m.Begin == begin))
        {
            throw new ArgumentException("Deze fiche begint op die dag al op dat uur.");
        }
    }

    private static Guid RequireId(Guid value, string paramName) =>
        value == Guid.Empty ? throw new ArgumentException($"'{paramName}' is required.", paramName) : value;
}
