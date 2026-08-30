using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Domain.Planning;

/// <summary>
/// The year plan of one <see cref="Klas"/> (Art. IX.3: "Klas … has one <c>Jaarplan</c>"; "Jaarplan — klasId; per
/// planningsblok a list of thema's, with a <c>vergrendeld</c> flag per thema").
/// <para>
/// <b>It stores placements, not the grid.</b> There is no planningsblok table and this aggregate holds no block
/// list: the grid is derived from the <see cref="Schooljaar"/> by the <c>IPlanningsblokIndeling</c> seam, so no
/// row commits the school to a granularity (ADR-0013). What is persisted is a set of
/// <see cref="Themaplaatsing"/> — each a thema pinned to a block <b>start date</b> plus its tier, never to an
/// ordinal (ADR-0020 §3; see <see cref="Themaplaatsing"/> for why that distinction is load-bearing).
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
    /// The thema placements, ordered chronologically by the block start date they key on. Ordering by the stored
    /// key rather than by insertion keeps the read view stable across a regeneration.
    /// </summary>
    public IReadOnlyList<Themaplaatsing> Plaatsingen =>
        _plaatsingen
            .OrderBy(p => p.BlokStart)
            .ThenBy(p => p.BlokNiveau)
            .ThenBy(p => p.ThemaId)
            .ToList();

    /// <summary>
    /// The activiteiten placed on days of this plan (E9-03, FR-6.2/FR-7.2), ordered by day and then by their
    /// position within it.
    /// <para>
    /// <b>A second, independent placement axis, and deliberately not a finer tier of the first.</b>
    /// <see cref="Plaatsingen"/> answers "in which stretch of the year does this thema live?" and keys on a derived
    /// block boundary; this answers "what am I doing on Tuesday?" and keys on a calendar date. See
    /// <see cref="Activiteitplaatsing"/> for why that separation is load-bearing rather than stylistic.
    /// </para>
    /// </summary>
    public IReadOnlyList<Activiteitplaatsing> Activiteitplaatsingen =>
        _activiteitplaatsingen
            .OrderBy(p => p.Datum)
            .ThenBy(p => p.Volgorde)
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
    /// <b>The class boundary is this method's invariant, and it is enforced here because this is the only place both
    /// classes are known.</b> An <see cref="Activiteit"/> inherits its subthema's <c>KlasId</c> (Art. IX.2, where class
    /// scoping is structural), and this plan has a <see cref="KlasId"/> of its own; nothing below this can compare
    /// them. Without the check, one class's plan could schedule another class's content — the same boundary
    /// <c>Subthema.VerplaatsActiviteitNaar</c> guards, and it is guarded here rather than assumed because <b>E1-19
    /// exists precisely because that boundary was left open by a second route</b>.
    /// </para>
    /// <para>
    /// <b>A day may hold several activiteiten</b> — that is the normal case, not an edge one — so only the exact
    /// duplicate is refused: the same activiteit twice on the same day. The same activiteit on two different days is
    /// legitimate and common (a reading moment that recurs on Monday and Thursday).
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
    /// <param name="volgorde">Position within the day.</param>
    /// <exception cref="InvalidOperationException">
    /// The activiteit is already on that day. A caller that has not checked <see cref="IsAlGeplaatstOp"/> is a
    /// programmer error rather than teacher input, so this one is English (Art. II.2) and no handler maps it.
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
        int volgorde = 0)
    {
        if (IsAlGeplaatstOp(activiteitId, datum, volgorde))
        {
            throw new InvalidOperationException(
                $"Activiteit {activiteitId} is already placed on {datum:yyyy-MM-dd} in slot {volgorde}.");
        }

        var plaatsing = new Activiteitplaatsing(Id, activiteitId, datum, status, volgorde);
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
    /// Whether this activiteit already sits in that <b>slot</b> of that day. Keeps a repeated call idempotent
    /// rather than stacking.
    /// <para>
    /// <b>The unit is the lesuur, not the day, and that widening is deliberate.</b> A school day is a row of
    /// numbered lesmomenten (<see cref="Activiteitplaatsing.Volgorde"/> is the slot), and two real cases need the
    /// same activiteit twice on one day: a hoek that runs two consecutive hours, and something a class does in the
    /// morning and again in the afternoon. Keying the guard on the day alone refused both, and the refusal was not
    /// protecting anything: the plan has always been able to hold several activiteiten on one day.
    /// </para>
    /// </summary>
    public bool IsAlGeplaatstOp(Guid activiteitId, DateOnly datum, int volgorde) =>
        _activiteitplaatsingen.Any(p =>
            p.ActiviteitId == activiteitId && p.Datum == datum && p.Volgorde == volgorde);

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
    /// Places a thema in the block starting on <paramref name="blokStart"/>.
    /// <para>
    /// A block may hold several thema's (Art. IX.3 says "a list of thema's" per block), so only the exact
    /// duplicate — the same thema twice in the same block of the same tier — is refused.
    /// </para>
    /// </summary>
    /// <exception cref="InvalidOperationException">The thema is already placed in that same block.</exception>
    public Themaplaatsing VoegPlaatsingToe(
        Guid themaId,
        Planningsblokniveau blokNiveau,
        DateOnly blokStart,
        KoppelingStatus status,
        string? aiMotivatie = null)
    {
        // A caller that has not checked IsAlGeplaatst first is a programmer error, not teacher input — no handler
        // maps this exception, so it must never reach a teacher. English per Art. II.2.
        if (IsAlGeplaatst(themaId, blokNiveau, blokStart))
        {
            throw new InvalidOperationException(
                $"Thema {themaId} is already placed in the {blokNiveau} starting {blokStart:yyyy-MM-dd}.");
        }

        var plaatsing = new Themaplaatsing(Id, themaId, blokNiveau, blokStart, status, aiMotivatie);
        _plaatsingen.Add(plaatsing);

        return plaatsing;
    }

    /// <summary>
    /// Whether this thema is already placed in that exact block (tier + start date). Used by the generation flow
    /// to stay idempotent instead of stacking the same proposal twice.
    /// </summary>
    public bool IsAlGeplaatst(Guid themaId, Planningsblokniveau blokNiveau, DateOnly blokStart) =>
        VindPlaatsingOp(themaId, blokNiveau, blokStart) is not null;

    /// <summary>
    /// The existing placement of this thema in that exact block, or <c>null</c>. Callers need the placement itself
    /// and not just its existence, because <b>why</b> a slot is occupied matters: a still-standing proposal is AI
    /// repetition, while a <see cref="KoppelingStatus.Geweigerd"/> one is the teacher's own rejection holding.
    /// <see cref="IsAlGeplaatst"/> is defined in terms of this method so the two cannot answer differently.
    /// </summary>
    public Themaplaatsing? VindPlaatsingOp(Guid themaId, Planningsblokniveau blokNiveau, DateOnly blokStart) =>
        _plaatsingen.FirstOrDefault(p =>
            p.ThemaId == themaId && p.BlokNiveau == blokNiveau && p.BlokStart == blokStart);

    /// <summary>
    /// The placements a human has committed to: locked, or moved off <see cref="KoppelingStatus.Voorgesteld"/>.
    /// <para>
    /// Deliberately expressed as the <b>complement of <see cref="Themaplaatsing.IsVervangbaar"/></b> — the one
    /// predicate that also decides what a regeneration may discard — so the two can never drift apart. A second,
    /// independently written "is this a human decision?" test is exactly how a plan ends up protected against
    /// regeneration but not against deletion.
    /// </para>
    /// <para>
    /// Used by the <c>Klas</c> delete guard: a persisted human decision is the human's to discard (Art. IV.2), not
    /// something a cascade may remove as a side effect of deleting the class.
    /// </para>
    /// </summary>
    public IReadOnlyList<Themaplaatsing> MenselijkBeslotenPlaatsingen =>
        _plaatsingen.Where(p => !p.IsVervangbaar).ToList();

    /// <summary>
    /// Drops the placements a (re)generation run is allowed to replace — untouched, unlocked AI proposals — and
    /// returns them. Everything the teacher decided on or locked survives (Art. IV.1, Art. IX.3); that is what
    /// makes <c>vergrendeld</c> mean something.
    /// <para>
    /// This is the <b>whole-plan</b> variant (FR-8.1). The per-period one is
    /// <see cref="VerwijderVervangbarePlaatsingenIn"/>, and both delegate to the same private filter so the two
    /// regeneration paths cannot come to disagree about what a run may take.
    /// </para>
    /// </summary>
    public IReadOnlyList<Themaplaatsing> VerwijderVervangbarePlaatsingen() =>
        VerwijderVervangbare(_ => true);

    /// <summary>
    /// Drops the replaceable placements <b>in one planningsblok only</b> and returns them — FR-8.2's half of the
    /// discard. A block is identified by tier + start date, exactly as everywhere else in this aggregate.
    /// <para>
    /// <b>The predicate is identical to the whole-plan variant's, narrowed by position.</b> A per-period run is not
    /// permitted to take anything a whole-plan run may not take: same <see cref="Themaplaatsing.IsVervangbaar"/>, so
    /// an accepted, rejected, hand-placed, moved or locked placement in the regenerated period survives. That is what
    /// keeps E4-06's reasoning intact — the lock control stays hidden on decided placements because it changes nothing
    /// for either path — and it is why E4-07's preserve/overwrite ruling is still open rather than pre-empted here.
    /// </para>
    /// </summary>
    public IReadOnlyList<Themaplaatsing> VerwijderVervangbarePlaatsingenIn(
        Planningsblokniveau blokNiveau,
        DateOnly blokStart) =>
        VerwijderVervangbare(p => p.BlokNiveau == blokNiveau && p.BlokStart == blokStart);

    /// <summary>
    /// The one place a regeneration removes placements. Callers narrow <i>which</i> blocks are in scope; none of them
    /// may widen <i>what</i> is replaceable, because that predicate is <see cref="Themaplaatsing.IsVervangbaar"/> and
    /// it lives on the placement.
    /// </summary>
    private IReadOnlyList<Themaplaatsing> VerwijderVervangbare(Func<Themaplaatsing, bool> inScope)
    {
        var vervangbaar = _plaatsingen.Where(p => p.IsVervangbaar && inScope(p)).ToList();
        foreach (var plaatsing in vervangbaar)
        {
            _plaatsingen.Remove(plaatsing);
        }

        return vervangbaar;
    }

    /// <summary>The placement with this id, or null. Used by the review path (status / vergrendeling).</summary>
    public Themaplaatsing? VindPlaatsing(Guid plaatsingId) =>
        _plaatsingen.FirstOrDefault(p => p.Id == plaatsingId);

    /// <summary>
    /// Removes one placement — taking a thema out of a period — <b>regardless of its status or lock</b>.
    /// <para>
    /// <b>Why status is deliberately not checked here.</b> Art. IV.2 reserves the disposal of a human decision to the
    /// human; it does not make that decision permanent. This method is only ever reached from an explicit teacher
    /// action, which is exactly the actor allowed to discard it. Contrast
    /// <see cref="VerwijderVervangbarePlaatsingen"/>, which is reached from <i>generation</i> and therefore must skip
    /// anything a human touched.
    /// </para>
    /// <para>
    /// It exists because the <c>Klas</c> delete guard counts <see cref="MenselijkBeslotenPlaatsingen"/>, and a guard
    /// whose remediation does not exist is a trap rather than a safeguard: without this, one accepted or rejected
    /// placement made the class permanently undeletable and its own message instructed an impossible action.
    /// Removing a thema from a period is also plain manual editing a teacher must be able to do (FR-7).
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
