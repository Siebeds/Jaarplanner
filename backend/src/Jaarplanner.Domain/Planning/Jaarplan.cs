using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// The year plan of one <see cref="Klas"/> (Art. IX.3: "Klas … has one <c>Jaarplan</c>"; the jaarplan holds the
/// thema's placed from one day to another, with a <c>vergrendeld</c> flag per placement).
/// <para>
/// <b>It stores placements with their own dates.</b> Each <see cref="Themaplaatsing"/> says from which day to which
/// day its thema runs (ADR-0053); there is no grid of periods behind it. <b>No two placements share a day</b>, the
/// same thema twice included (owner ruling 2026-09-16): <see cref="VoegPlaatsingToe"/> refuses one that would.
/// </para>
/// <para>
/// <b>Per klas, deliberately without any leerjaar in its invariants.</b> How a graadklas / menggroep spanning
/// several leerjaren is modelled is an open decision (Art. XIV), so nothing here keys on, validates against or
/// derives from a class's leerjaar. A klas that later turns out to span two leerjaren needs no change to this
/// aggregate.
/// </para>
/// <para>
/// <b>A generated plan is a proposal.</b> AI-produced placements land as
/// <see cref="KoppelingStatus.Voorgesteld"/> with a motivation and are never auto-applied (Art. IV.1/IV.2/IV.3);
/// the teacher accepts, rejects, adjusts or locks them. Regeneration only ever discards placements that are
/// <see cref="Themaplaatsing.IsVervangbaar"/>.
/// </para>
/// </summary>
public sealed class Jaarplan
{
    private readonly List<Themaplaatsing> _plaatsingen = [];
    private readonly List<Activiteitplaatsing> _activiteitplaatsingen = [];
    private readonly List<Subthemaplaatsing> _subthemaplaatsingen = [];

    // EF Core materialisation only.
    private Jaarplan()
    {
    }

    /// <summary>Creates the (initially empty) jaarplan of a class.</summary>
    /// <param name="klasId">The class this plan belongs to. One plan per class (Art. IX.3).</param>
    public Jaarplan(Guid klasId)
    {
        if (klasId == Guid.Empty)
        {
            throw new ArgumentException("'klasId' is required.", nameof(klasId));
        }

        KlasId = klasId;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The class whose plan this is (Art. IX.3).</summary>
    public Guid KlasId { get; private set; }

    /// <summary>
    /// The thema placements, ordered chronologically by their first day. Ordering by the stored dates rather than by
    /// insertion keeps the read view stable.
    /// </summary>
    public IReadOnlyList<Themaplaatsing> Plaatsingen =>
        _plaatsingen
            .OrderBy(p => p.Van)
            .ThenBy(p => p.Tot)
            .ThenBy(p => p.ThemaId)
            .ToList();

    /// <summary>
    /// The activiteiten placed on days of this plan (E9-03, FR-6.2/FR-7.2), ordered by day and then by the time
    /// they start.
    /// <para>
    /// <b>A second, independent placement axis, and deliberately not a finer tier of the first.</b>
    /// <see cref="Plaatsingen"/> answers "in which stretch of the year does this thema live?"; this answers "what am I
    /// doing on Tuesday?". Both key on calendar dates, and neither is derived from the other. See
    /// <see cref="Activiteitplaatsing"/> for why that separation is load-bearing rather than stylistic.
    /// </para>
    /// </summary>
    public IReadOnlyList<Activiteitplaatsing> Activiteitplaatsingen =>
        _activiteitplaatsingen
            .OrderBy(p => p.Datum)
            .ThenBy(p => p.Begin)
            .ThenBy(p => p.ActiviteitId)
            .ToList();

    /// <summary>
    /// The subthema windows a teacher marked off, ordered chronologically.
    /// <para>
    /// <b>A third axis, and the only one that can be empty for content that exists.</b> A subthema with no
    /// window here is not unplanned: its span is still derived from the activiteiten under it, which is how
    /// every plan made before this existed still reads. The window is additive, so the calendar draws the
    /// union of the two and neither can contradict the other. See <see cref="Subthemaplaatsing"/> for why
    /// this reverses the note in <see cref="Activiteitplaatsing"/>.
    /// </para>
    /// </summary>
    public IReadOnlyList<Subthemaplaatsing> Subthemaplaatsingen =>
        _subthemaplaatsingen
            .OrderBy(p => p.Van)
            .ThenBy(p => p.Tot)
            .ThenBy(p => p.SubthemaId)
            .ToList();

    /// <summary>
    /// Marks off a stretch of days for a subthema, or moves the stretch it already had.
    /// <para>
    /// <b>An overlapping window of the same subthema is MOVED, not added.</b> Re-planning a subthema the
    /// teacher had already marked off is them saying "these days instead", so the newest answer replaces the
    /// old one whole; merging the two would make a shortened period impossible to express. A window that
    /// shares no day with any existing one is a second period for the same subthema, which is legal: a
    /// subthema may come back later in the year.
    /// </para>
    /// <para>
    /// <b>THE CLASS GUARD THAT USED TO BE HERE IS GONE, and this is where a reader should learn it</b>
    /// (Art. IX.2 as amended 2026-08-30). A subthema used to carry a <c>KlasId</c>, so this plan could compare it
    /// against its own and refuse another class's content. A subthema now carries a <b>leeftijd</b>, and whether
    /// this plan's klas teaches that age is a question only <c>Jaarfasen</c> and the <c>Klas</c> row can answer —
    /// neither of which an aggregate may reach for.
    /// </para>
    /// <para>
    /// <b>The check therefore lives in <c>WeekplanningService</c> alone, and it is no longer backstopped here.</b>
    /// That is a real reduction in defence and it is deliberate: the alternative was to have the caller pass both
    /// sides of the comparison, which looks like a guard and cannot fail.
    /// </para>
    /// </summary>
    /// <param name="subthemaId">The subthema to mark off days for.</param>
    /// <param name="van">First day, inclusive.</param>
    /// <param name="tot">Last day, inclusive.</param>
    /// <exception cref="ArgumentException">The window ends before it starts. Dutch: it reaches a teacher (Art. II.3).</exception>
    public Subthemaplaatsing PlaatsSubthema(Guid subthemaId, DateOnly van, DateOnly tot)
    {
        var bestaand = _subthemaplaatsingen
            .FirstOrDefault(p => p.SubthemaId == subthemaId && p.Overlapt(van, tot));

        if (bestaand is not null)
        {
            bestaand.Herzet(van, tot);
            return bestaand;
        }

        var plaatsing = new Subthemaplaatsing(Id, subthemaId, van, tot);
        _subthemaplaatsingen.Add(plaatsing);

        return plaatsing;
    }

    /// <summary>
    /// Places an activiteit on one day (E9-03, FR-7.2).
    /// <para>
    /// <b>There is no class boundary left for this method to enforce, and the remarks below say where the check
    /// went.</b> This paragraph used to describe one: an <see cref="Activiteit"/> inherited its subthema's
    /// <c>KlasId</c> and this plan had a <see cref="KlasId"/> of its own, so the two were compared here. Since
    /// 2026-08-30 a subthema names an age instead (Art. IX.2), and deciding whether this plan's klas teaches
    /// that age needs the <c>Klas</c> row, which this aggregate may not reach for.
    /// </para>
    /// <para>
    /// <b>A day may hold several activiteiten</b> — that is the normal case, not an edge one — so only the exact
    /// duplicate is refused: the same activiteit starting twice at the same time on the same day. The same activiteit
    /// on two different days, or at two times of one day, is legitimate and common. Two different activiteiten that
    /// overlap in time are allowed too: an agenda draws them side by side.
    /// </para>
    /// <para>
    /// <b>Whether <paramref name="datum"/> is a teaching day is not checked here.</b> Closures live on the
    /// <see cref="Schooljaar"/> and this aggregate does not hold one; the service checks it and refuses with a Dutch
    /// sentence naming the closure. Splitting it that way keeps this type free of a calendar it would have to be handed
    /// on every call.
    /// </para>
    /// </summary>
    /// <param name="activiteitId">The activiteit to place.</param>
    /// <param name="datum">The day it happens.</param>
    /// <param name="status">The human-in-the-loop status (Art. IV.2); a teacher's own placement is Manueel.</param>
    /// <param name="begin">When it starts that day.</param>
    /// <param name="einde">When it ends. Must lie after <paramref name="begin"/>.</param>
    /// <exception cref="InvalidOperationException">
    /// The activiteit already starts at that time on that day. A caller that has not checked
    /// <see cref="IsAlGeplaatstOp"/> is a programmer error rather than teacher input, so this one is English
    /// (Art. II.2) and no handler maps it.
    /// </exception>
    /// <remarks>
    /// <b>No class guard, since 2026-08-30.</b> An activiteit inherits its subthema's leeftijd rather than a klas
    /// (Art. IX.2), so there is nothing here to compare against <see cref="KlasId"/>. <c>WeekplanningService</c>
    /// checks that this plan's klas teaches that age; see the note on <see cref="PlaatsSubthema"/>.
    /// </remarks>
    public Activiteitplaatsing PlaatsActiviteit(
        Guid activiteitId,
        DateOnly datum,
        KoppelingStatus status,
        TimeOnly begin,
        TimeOnly einde)
    {
        if (IsAlGeplaatstOp(activiteitId, datum, begin))
        {
            throw new InvalidOperationException(
                $"Activiteit {activiteitId} already starts at {begin:HH:mm} on {datum:yyyy-MM-dd}.");
        }

        var plaatsing = new Activiteitplaatsing(Id, activiteitId, datum, status, begin, einde);
        _activiteitplaatsingen.Add(plaatsing);

        return plaatsing;
    }

    /// <summary>
    /// The activiteit placements a human has committed to — the day-level counterpart of
    /// <see cref="MenselijkBeslotenPlaatsingen"/>, and expressed the same way, as the complement of
    /// <see cref="Activiteitplaatsing.IsVervangbaar"/> so the two can never drift apart.
    /// <para>
    /// Used by the <c>Klas</c> delete guard. Without it, deleting a class would cascade through the jaarplan and
    /// silently destroy a fully planned term — every activiteit a teacher had scheduled onto a day — while the guard
    /// beside it carefully protected the thema placements. <b>The two halves of one plan cannot have two different
    /// answers to "is this the human's to discard?"</b> (Art. IV.2).
    /// </para>
    /// </summary>
    public IReadOnlyList<Activiteitplaatsing> MenselijkBeslotenActiviteitplaatsingen =>
        _activiteitplaatsingen.Where(p => !p.IsVervangbaar).ToList();

    /// <summary>
    /// Whether this activiteit already starts at <paramref name="begin"/> on that day. Keeps a repeated call
    /// idempotent rather than stacking.
    /// <para>
    /// <b>The unit is the start time, not the day, and that widening is deliberate.</b> Two real cases need the
    /// same activiteit twice on one day: something a class does in the morning and again in the afternoon, and a
    /// block a teacher splits around the break. Keying the guard on the day alone refused both. Until 2026-09-11
    /// the unit was a numbered lesuur (<c>Volgorde</c>); the start time took its place with ADR-0027, and it keeps
    /// the one thing the guard was ever for: the same row written twice.
    /// </para>
    /// </summary>
    public bool IsAlGeplaatstOp(Guid activiteitId, DateOnly datum, TimeOnly begin) =>
        _activiteitplaatsingen.Any(p =>
            p.ActiviteitId == activiteitId && p.Datum == datum && p.Begin == begin);

    /// <summary>The activiteit placement with this id, or null.</summary>
    public Activiteitplaatsing? VindActiviteitplaatsing(Guid plaatsingId) =>
        _activiteitplaatsingen.FirstOrDefault(p => p.Id == plaatsingId);

    /// <summary>
    /// Takes an activiteit off its day (FR-7.2).
    /// <para>
    /// Like <see cref="VerwijderPlaatsing"/> it checks no status: this is only ever reached from an explicit teacher
    /// action, and Art. IV.2 reserves the disposal of a human decision to the human rather than making it permanent.
    /// </para>
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// The placement belongs to another jaarplan. Refused rather than silently ignored, for the reason spelled out on
    /// <see cref="VerwijderPlaatsing"/>: a no-op the API still answers 200 OK is worse than an error.
    /// </exception>
    public void VerwijderActiviteitplaatsing(Activiteitplaatsing plaatsing)
    {
        ArgumentNullException.ThrowIfNull(plaatsing);

        if (!_activiteitplaatsingen.Remove(plaatsing))
        {
            throw new InvalidOperationException("The placement does not belong to this jaarplan.");
        }
    }

    /// <summary>
    /// Places a thema from <paramref name="van"/> to <paramref name="tot"/>.
    /// <para>
    /// <b>No two placements share a day</b> (owner ruling 2026-09-16, ADR-0053 R4), so one that would is refused. The
    /// service checks <see cref="Overlappend"/> first and refuses in Dutch, naming the other thema; this guard is the
    /// backstop, and reaching it is a programmer error.
    /// </para>
    /// <para>
    /// <b>Splitting at a vacation is not done here.</b> Which days are vacation is the <see cref="Schooljaar"/>'s, which
    /// this aggregate does not hold; the service hands in one part at a time.
    /// </para>
    /// </summary>
    /// <exception cref="InvalidOperationException">The range shares a day with another placement.</exception>
    public Themaplaatsing VoegPlaatsingToe(
        Guid themaId,
        DateOnly van,
        DateOnly tot,
        KoppelingStatus status,
        string? aiMotivatie = null)
    {
        // English per Art. II.2: no handler maps this exception, so it must never reach a teacher.
        if (Overlappend(van, tot) is { } bestaand)
        {
            throw new InvalidOperationException(
                $"The range {van:yyyy-MM-dd}–{tot:yyyy-MM-dd} overlaps placement {bestaand.Id}.");
        }

        var plaatsing = new Themaplaatsing(Id, themaId, van, tot, status, aiMotivatie);
        _plaatsingen.Add(plaatsing);

        return plaatsing;
    }

    /// <summary>
    /// The first placement, chronologically, that shares a day with <paramref name="van"/>–<paramref name="tot"/>, or
    /// null. <paramref name="behalve"/> is left out, so a placement being given new dates does not collide with itself.
    /// </summary>
    public Themaplaatsing? Overlappend(DateOnly van, DateOnly tot, Guid? behalve = null) =>
        Plaatsingen.FirstOrDefault(p => p.Id != behalve && p.Overlapt(van, tot));

    /// <summary>
    /// Gives a placement new dates, checked against every other placement like a new one (ADR-0053 R4).
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// The placement is not this plan's, or the new range shares a day with another placement. Both are programmer
    /// errors: the service resolves the placement from this aggregate and checks <see cref="Overlappend"/> first.
    /// </exception>
    public void HerplanPlaatsing(Themaplaatsing plaatsing, DateOnly van, DateOnly tot)
    {
        ArgumentNullException.ThrowIfNull(plaatsing);

        if (!_plaatsingen.Contains(plaatsing))
        {
            throw new InvalidOperationException("The placement does not belong to this jaarplan.");
        }

        if (Overlappend(van, tot, plaatsing.Id) is { } bestaand)
        {
            throw new InvalidOperationException(
                $"The range {van:yyyy-MM-dd}–{tot:yyyy-MM-dd} overlaps placement {bestaand.Id}.");
        }

        plaatsing.Herplan(van, tot);
    }

    /// <summary>
    /// The placements a human has committed to: locked, or moved off <see cref="KoppelingStatus.Voorgesteld"/>.
    /// <para>
    /// Deliberately expressed as the <b>complement of <see cref="Themaplaatsing.IsVervangbaar"/></b> — the one
    /// predicate that also decides what a regeneration may discard — so the two can never drift apart.
    /// </para>
    /// <para>
    /// Used by the <c>Klas</c> delete guard: a persisted human decision is the human's to discard (Art. IV.2), not
    /// something a cascade may remove as a side effect of deleting the class.
    /// </para>
    /// </summary>
    public IReadOnlyList<Themaplaatsing> MenselijkBeslotenPlaatsingen =>
        _plaatsingen.Where(p => !p.IsVervangbaar).ToList();

    /// <summary>The placement with this id, or null. Used by the review path (status / vergrendeling).</summary>
    public Themaplaatsing? VindPlaatsing(Guid plaatsingId) =>
        _plaatsingen.FirstOrDefault(p => p.Id == plaatsingId);

    /// <summary>
    /// Removes one placement — taking a thema out of the plan — <b>regardless of its status or lock</b>.
    /// <para>
    /// <b>Why status is deliberately not checked here.</b> Art. IV.2 reserves the disposal of a human decision to the
    /// human; it does not make that decision permanent. This method is only ever reached from an explicit teacher
    /// action, which is exactly the actor allowed to discard it. It is also how a teacher rejects an open proposal
    /// (ADR-0053 R12).
    /// </para>
    /// <para>
    /// It exists because the <c>Klas</c> delete guard counts <see cref="MenselijkBeslotenPlaatsingen"/>, and a guard
    /// whose remediation does not exist is a trap rather than a safeguard. Removing a thema is also plain manual editing
    /// a teacher must be able to do (FR-7).
    /// </para>
    /// </summary>
    /// <param name="plaatsing">A placement belonging to <b>this</b> jaarplan.</param>
    /// <exception cref="InvalidOperationException">
    /// The placement does not belong to this jaarplan. Swallowing <see cref="List{T}.Remove"/>'s <c>false</c> would
    /// make a cross-aggregate delete a silent no-op that the API still answers <c>200 OK</c> with an unchanged plan —
    /// an aggregate should refuse work that is not its own rather than pretend to have done it. Unreachable through
    /// the API today (the service resolves the placement from this same aggregate first), so this is hardening.
    /// </exception>
    public void VerwijderPlaatsing(Themaplaatsing plaatsing)
    {
        ArgumentNullException.ThrowIfNull(plaatsing);

        if (!_plaatsingen.Remove(plaatsing))
        {
            throw new InvalidOperationException(
                "The placement does not belong to this jaarplan.");
        }
    }
}
