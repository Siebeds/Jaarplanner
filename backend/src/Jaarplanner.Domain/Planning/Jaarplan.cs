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
    /// makes <c>vergrendeld</c> mean something, and it is the hook E4's per-period regeneration extends.
    /// </summary>
    public IReadOnlyList<Themaplaatsing> VerwijderVervangbarePlaatsingen()
    {
        var vervangbaar = _plaatsingen.Where(p => p.IsVervangbaar).ToList();
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
