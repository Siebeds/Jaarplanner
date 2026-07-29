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
        if (IsAlGeplaatst(themaId, blokNiveau, blokStart))
        {
            throw new InvalidOperationException(
                $"Thema {themaId} staat al in het planningsblok van {blokStart:yyyy-MM-dd} ({blokNiveau}).");
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
        _plaatsingen.Any(p => p.ThemaId == themaId && p.BlokNiveau == blokNiveau && p.BlokStart == blokStart);

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
}
