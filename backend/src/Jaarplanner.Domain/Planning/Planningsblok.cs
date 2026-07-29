namespace Jaarplanner.Domain.Planning;

/// <summary>
/// One slot in the school year's planning grid (Art. IX.3, ADR-0013, ADR-0020).
/// <para>
/// <b>Unit-agnostic by construction.</b> A block knows only its tier, its position, and the dates it spans.
/// It exposes no month, week number or period name, so generation (E3-01), the calendar (E3-06),
/// drag-and-drop (E3-07), the zoom levels (E3-08) and coverage can all be written against this type without
/// betting on the granularity decision. Changing the grain is a configuration change, not a refactor.
/// </para>
/// <para>
/// <b>Identity is <see cref="Niveau"/> + <see cref="Start"/> — not <see cref="Ordinaal"/>.</b> An earlier
/// version of this type claimed the ordinal was a stable key that survived a school shifting its vacation
/// dates. That was <b>false</b>: the ordinal is a running position over the derived grid, so moving one
/// vacation by a single day can change how many blocks a teaching stretch yields and thereby re-point every
/// later ordinal — a thema attached to "period 5" would silently relocate. The start date is a real calendar
/// anchor and is therefore what a persisted placement should key on. See
/// <c>Ordinaal</c> for what it is actually for.
/// </para>
/// <para>
/// <b>Re-anchoring is still an open problem, not a solved one.</b> Even keyed on <see cref="Start"/>, editing
/// a schooljaar's vacations reshapes the grid and can leave a stored placement pointing at a date that is no
/// longer a block boundary. Art. III.4's stance for curriculum re-import applies by analogy — flag what must
/// be reviewed rather than silently moving a teacher's plan — and E3-07 must handle it explicitly. Tracked as
/// an open decision in <c>backlog/README.md</c>.
/// </para>
/// <para>
/// Blocks are <b>derived</b> from the <see cref="Schooljaar"/> rather than stored, precisely so no persisted
/// row hard-codes the granularity question.
/// </para>
/// </summary>
public sealed class Planningsblok : IEquatable<Planningsblok>
{
    /// <summary>Constructs a block. <paramref name="eind"/> is inclusive and must not precede <paramref name="start"/>.</summary>
    /// <param name="niveau">Which tier the block belongs to.</param>
    /// <param name="ordinaal">1-based display position within the tier.</param>
    /// <param name="start">First school day covered.</param>
    /// <param name="eind">Last school day covered (inclusive).</param>
    /// <param name="ouderOrdinaal">
    /// For a <see cref="Planningsblokniveau.Subthemaperiode"/>, the <see cref="Ordinaal"/> of the
    /// themaperiode it nests inside; null for a themaperiode itself.
    /// </param>
    public Planningsblok(
        Planningsblokniveau niveau,
        int ordinaal,
        DateOnly start,
        DateOnly eind,
        int? ouderOrdinaal = null)
    {
        // All three guards below catch programmer error, never user input: a Planningsblok is constructed only by the
        // derivation seam (IPlanningsblokIndeling), never from a request body, and no handler maps these exceptions.
        // English per Art. II.2 — the same rule Themaplaatsing's guards follow. Contrast Schooljaar/Schoolsluiting,
        // whose Dutch guard messages ARE deliberately Dutch because SchooljaarBeheerService re-throws them as
        // user-facing 400s.
        if (ordinaal < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(ordinaal), ordinaal, "A planningsblok's ordinaal starts at 1.");
        }

        if (eind < start)
        {
            throw new ArgumentException("A planningsblok's end must not precede its start.", nameof(eind));
        }

        if (niveau == Planningsblokniveau.Themaperiode && ouderOrdinaal is not null)
        {
            throw new ArgumentException("A themaperiode has no parent block.", nameof(ouderOrdinaal));
        }

        Niveau = niveau;
        Ordinaal = ordinaal;
        Start = start;
        Eind = eind;
        OuderOrdinaal = ouderOrdinaal;
    }

    /// <summary>Which tier this block belongs to (themaperiode or subthemaperiode).</summary>
    public Planningsblokniveau Niveau { get; }

    /// <summary>
    /// 1-based position within the school year, per tier — for display and ordering ("periode 3"), and for
    /// referring to a block within one derivation. <b>Not an identity across derivations</b>: it shifts when
    /// the schooljaar's vacations change. Key a persisted placement on <see cref="Start"/>.
    /// </summary>
    public int Ordinaal { get; }

    /// <summary>
    /// The <see cref="Ordinaal"/> of the themaperiode this subthemaperiode nests inside; null for a
    /// themaperiode. The fine tier is always derived <b>within</b> a coarse block, so a subthemaperiode never
    /// straddles a themaperiode boundary — which is what makes the E3-08 "zoom into this period" view coherent.
    /// </summary>
    public int? OuderOrdinaal { get; }

    /// <summary>First school day covered by this block.</summary>
    public DateOnly Start { get; }

    /// <summary>Last school day covered by this block (inclusive).</summary>
    public DateOnly Eind { get; }

    /// <summary>
    /// Calendar days spanned, inclusive — <b>not</b> a count of teaching days.
    /// <para>
    /// A block never spans a <see cref="Sluitingssoort.Vakantie"/>, because blocks are derived per teaching
    /// stretch and stretches are cut at vacations. It <b>may</b> contain a <see cref="Sluitingssoort.VrijeDag"/>
    /// (Hemelvaart, Pinkstermaandag, a pedagogische studiedag): those deliberately do not break a period, so a
    /// week containing one stays part of its surrounding block rather than becoming an unplannable sliver.
    /// Use <see cref="Schooljaar.IsLesdag"/> when you need actual teaching days.
    /// </para>
    /// </summary>
    public int AantalDagen => Eind.DayNumber - Start.DayNumber + 1;

    /// <summary>True when the block covers <paramref name="datum"/>.</summary>
    public bool Bevat(DateOnly datum) => datum >= Start && datum <= Eind;

    /// <summary>True when <paramref name="ander"/> lies entirely inside this block.</summary>
    public bool Omvat(Planningsblok ander)
    {
        ArgumentNullException.ThrowIfNull(ander);

        return ander.Start >= Start && ander.Eind <= Eind;
    }

    /// <inheritdoc />
    /// <remarks>Equality follows the documented identity: tier + start date.</remarks>
    public bool Equals(Planningsblok? other) =>
        other is not null && Niveau == other.Niveau && Start == other.Start;

    /// <inheritdoc />
    public override bool Equals(object? obj) => Equals(obj as Planningsblok);

    /// <inheritdoc />
    public override int GetHashCode() => HashCode.Combine(Niveau, Start);

    /// <inheritdoc />
    public override string ToString() => $"{Niveau} {Ordinaal} ({Start:yyyy-MM-dd}…{Eind:yyyy-MM-dd})";
}
