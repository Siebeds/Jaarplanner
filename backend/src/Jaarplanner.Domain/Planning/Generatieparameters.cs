namespace Jaarplanner.Domain.Planning;

/// <summary>
/// The pre-generation settings a class keeps between runs (FR-5.4, Art. IX.3) — the persisted half of E3-04, added
/// after the owner ruled on 2026-07-30 that the generation settings must be <b>kept</b> rather than re-entered.
/// <para>
/// <b>Why this is persisted state and not a request payload.</b> FR-8 regeneration is the whole point of the ruling:
/// a period the teacher marked as bezet has to stay bezet on the next run, instead of quietly getting a thema back.
/// A parameter that lives only in one HTTP body cannot do that, because the next run is a different body.
/// </para>
/// <para>
/// <b>Scoped by (<see cref="KlasId"/>, <see cref="SchooljaarId"/>), and the school year half is load-bearing.</b>
/// The ruling says "per klas", and a <see cref="Klas"/> does belong to exactly one <see cref="Schooljaar"/> — its
/// <c>SchooljaarId</c> has no mutator, precisely because moving a class between years is a copy operation (E8-03).
/// But every value stored here is <b>a date</b>: a schoolfeest on 2026-09-15 and a block starting 2026-09-01 mean
/// nothing in 2027-2028, and loading them into next year's form would put a stale constraint in front of a teacher
/// as if they had set it. Keying on the pair means that leak cannot happen even if the neighbouring aggregate's
/// invariant is ever broken: a row is only ever read for the school year it was written for, and a mismatch yields
/// no settings rather than the wrong ones. The alternative — keying on <c>KlasId</c> alone and relying on a rule
/// stated in another class's doc comment — would be safe only for as long as that rule holds.
/// </para>
/// <para>
/// <b>A start thema keys on the block's start date, never on a position.</b> ADR-0020 §3 states that an ordinal is
/// not a stable key; a stored ordinal is strictly worse than a transmitted one, because it survives exactly the
/// vakantie edits that invalidate it. The consequence is accepted deliberately: a stored
/// <see cref="BewaardStartthema.BlokStart"/> can stop being a block start when a beheerder edits the vakantiedata,
/// and it is then <b>reported</b> — in the form when it loads and in <c>ParameterRapport</c> when a run uses it —
/// never silently dropped and never silently moved to a neighbouring period (directie 2026-07-28).
/// </para>
/// <para>
/// <b>The two kinds stay different in kind, and persistence does not change that.</b> A
/// <see cref="BewaardStartthema"/> is a preference the prompt carries; a <see cref="BewaardVastMoment"/> that blocks
/// is a constraint the service enforces. Whether a durable preference should now be <i>enforced</i> is a separate
/// decision about the tool placing a thema no model proposed, and it is deliberately not taken here.
/// </para>
/// </summary>
public sealed class Generatieparameters
{
    private readonly List<BewaardStartthema> _startthemas = [];
    private readonly List<BewaardVastMoment> _vasteMomenten = [];

    // EF Core materialisation only.
    private Generatieparameters()
    {
    }

    /// <summary>Creates the (initially empty) kept settings of one class in one school year.</summary>
    /// <param name="klasId">The class whose settings these are. Required.</param>
    /// <param name="schooljaarId">
    /// The school year the stored dates belong to. Required — see the type documentation for why it is part of the
    /// key rather than derivable context.
    /// </param>
    public Generatieparameters(Guid klasId, Guid schooljaarId)
    {
        if (klasId == Guid.Empty)
        {
            throw new ArgumentException("'klasId' is required.", nameof(klasId));
        }

        if (schooljaarId == Guid.Empty)
        {
            throw new ArgumentException("'schooljaarId' is required.", nameof(schooljaarId));
        }

        KlasId = klasId;
        SchooljaarId = schooljaarId;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The class these settings belong to.</summary>
    public Guid KlasId { get; private set; }

    /// <summary>The school year the stored dates are anchored in (see the type documentation).</summary>
    public Guid SchooljaarId { get; private set; }

    /// <summary>
    /// The thema the teacher wants each period to open with, ordered by the block start date they key on. Ordering
    /// by the stored key rather than by insertion keeps the form stable across a save.
    /// </summary>
    public IReadOnlyList<BewaardStartthema> Startthemas =>
        _startthemas.OrderBy(s => s.BlokStart).ToList();

    /// <summary>The dates the school has already committed inside a teaching period, chronologically.</summary>
    public IReadOnlyList<BewaardVastMoment> VasteMomenten =>
        _vasteMomenten
            .OrderBy(m => m.Datum)
            .ThenBy(m => m.Naam, StringComparer.Ordinal)
            .ToList();

    /// <summary>True when nothing is kept, so a caller can treat these settings as absent.</summary>
    public bool IsLeeg => _startthemas.Count == 0 && _vasteMomenten.Count == 0;

    /// <summary>
    /// Replaces the kept settings wholesale with what the teacher last submitted.
    /// <para>
    /// <b>Wholesale, because there is no separate "Bewaren" button.</b> The settings persist as part of the
    /// generation call, so the form always submits its complete current state: a merge would make a cleared row
    /// indistinguishable from an unmentioned one, and a teacher who removed a vast moment would find it still
    /// blocking the next run. Submitting an empty set is therefore the way to clear them, which is why this method
    /// accepts one rather than treating empty as "no change".
    /// </para>
    /// </summary>
    /// <param name="startthemas">The full set of start-thema preferences, at most one per block start date.</param>
    /// <param name="vasteMomenten">The full set of vaste momenten.</param>
    /// <exception cref="ArgumentException">Two start thema's target the same block start date.</exception>
    public void Vervang(
        IEnumerable<BewaardStartthema> startthemas,
        IEnumerable<BewaardVastMoment> vasteMomenten)
    {
        ArgumentNullException.ThrowIfNull(startthemas);
        ArgumentNullException.ThrowIfNull(vasteMomenten);

        var nieuweStartthemas = startthemas.ToList();

        // One period opens with one thema, so two preferences for the same block are contradictory rather than
        // additive. A caller that has not normalised first is a programmer error, not teacher input — the
        // application layer de-duplicates before it gets here — so this message stays English (Art. II.2).
        if (nieuweStartthemas.Select(s => s.BlokStart).Distinct().Count() != nieuweStartthemas.Count)
        {
            throw new ArgumentException(
                "Two start thema's target the same block start date.", nameof(startthemas));
        }

        _startthemas.Clear();
        _startthemas.AddRange(nieuweStartthemas);

        _vasteMomenten.Clear();
        _vasteMomenten.AddRange(vasteMomenten);
    }
}

/// <summary>
/// One kept start-thema preference: the thema the teacher wants a given planningsblok to open with.
/// <para>
/// The thema is held <b>by name</b> rather than by id, matching the generation contract, which resolves an
/// AI-returned thema by name and reports a name the school does not own instead of inventing one (Art. IV.4). A
/// stored id would silently become unresolvable when a thema is deleted, where a stored name still tells the
/// teacher what they had asked for.
/// </para>
/// <para>
/// <b>A class with its own <c>Guid Id</c>, not a record, and the reason is EF rather than taste.</b> Every owned
/// collection in this schema (<see cref="Schoolsluiting"/>, <see cref="Themaplaatsing"/>) carries a client-generated
/// <c>Guid</c> key. The first version of this type was a keyless record, so EF generated an <c>int</c> identity key per
/// row — and <see cref="Generatieparameters.Vervang"/> replaces the whole collection, which then became a delete plus an
/// insert whose generated keys could collide within one <c>SaveChanges</c>. It surfaced as a
/// <c>DbUpdateConcurrencyException</c> on the <i>next</i> request, two saves away from its cause. A client-generated key
/// makes the replacement unambiguous.
/// </para>
/// </summary>
public sealed class BewaardStartthema
{
    // EF Core materialisation only.
    private BewaardStartthema()
    {
        ThemaNaam = null!;
    }

    /// <summary>Creates one kept start-thema preference.</summary>
    /// <param name="blokStart">
    /// The start date of the planningsblok this preference targets — the stable key (ADR-0020 §3), never an ordinal.
    /// </param>
    /// <param name="themaNaam">The thema the teacher picked.</param>
    public BewaardStartthema(DateOnly blokStart, string themaNaam)
    {
        if (string.IsNullOrWhiteSpace(themaNaam))
        {
            throw new ArgumentException("'themaNaam' is required.", nameof(themaNaam));
        }

        BlokStart = blokStart;
        ThemaNaam = themaNaam.Trim();
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The start date of the planningsblok this preference targets.</summary>
    public DateOnly BlokStart { get; private set; }

    /// <summary>The thema the teacher picked.</summary>
    public string ThemaNaam { get; private set; }
}

/// <summary>
/// One kept vast moment: a date the school has already committed <b>inside</b> a teaching period.
/// <para>
/// Anything that <i>closes</i> the school (a vakantie, Hemelvaart, Pinkstermaandag, a pedagogische studiedag) is a
/// <see cref="Schoolsluiting"/> on the <see cref="Schooljaar"/> entered by the beheerder under FR-12.1, not one of
/// these. A schoolfeest is a vast moment (ratified by the owner, 2026-07-30).
/// </para>
/// <para>
/// A class with a client-generated <c>Guid</c> key for the same reason as <see cref="BewaardStartthema"/>: the whole
/// collection is replaced on every save, and a database-generated key turns that into a delete plus an insert whose
/// keys can collide inside one <c>SaveChanges</c>.
/// </para>
/// </summary>
public sealed class BewaardVastMoment
{
    // EF Core materialisation only.
    private BewaardVastMoment()
    {
        Naam = null!;
    }

    /// <summary>Creates one kept vast moment.</summary>
    /// <param name="naam">What it is, in the teacher's own words ("Schoolfeest", "Sportdag").</param>
    /// <param name="datum">
    /// When it falls. A <b>date</b>, not a block key: the block containing it is resolved at generation time, so a
    /// teacher never has to know where a period boundary falls, and a vakantie edit cannot make the date meaningless,
    /// only unplaceable, which is reported.
    /// </param>
    /// <param name="blokkeertPlaatsing">
    /// <c>true</c> refuses any new thema in the period containing this date; <c>false</c> is context only. Stored as a
    /// real value with no "unknown" state, because a moment whose answer is missing is not an instruction and is never
    /// accepted in the first place.
    /// </param>
    public BewaardVastMoment(string naam, DateOnly datum, bool blokkeertPlaatsing)
    {
        if (string.IsNullOrWhiteSpace(naam))
        {
            throw new ArgumentException("'naam' is required.", nameof(naam));
        }

        Naam = naam.Trim();
        Datum = datum;
        BlokkeertPlaatsing = blokkeertPlaatsing;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>What it is, in the teacher's own words.</summary>
    public string Naam { get; private set; }

    /// <summary>When it falls.</summary>
    public DateOnly Datum { get; private set; }

    /// <summary>Whether the period containing <see cref="Datum"/> refuses any new thema.</summary>
    public bool BlokkeertPlaatsing { get; private set; }
}
