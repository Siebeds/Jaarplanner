using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.Json.Serialization;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// What the teacher supplies <b>before</b> generation runs (FR-5.4) — the run's parameter set, either posted with the
/// request or loaded from the class's kept settings (<see cref="Generatieparameters"/>).
/// <para>
/// <b>FR-5.4's three examples are examples.</b> It reads *"De leerkracht kan parameters meegeven vóór generatie
/// (**bv.** vakanties, vaste momenten, gewenste startthema's)"* — `bv.` is *bijvoorbeeld*, so the list is
/// illustrative and not an enumerated set to be implemented item by item. This matters because the backlog's
/// paraphrase drops the `bv.` and reads as a definite list; the functional analysis outranks the backlog, so the
/// wording here follows the FA.
/// </para>
/// <para>
/// <b>Vakanties are not a parameter, and the FA says so itself.</b> FR-12.1 assigns them elsewhere and to another
/// role: *"De beheerder kan schooljaren aanmaken en de vakantie-/periodestructuur instellen."* They are persisted
/// school data on the <see cref="Schooljaar"/> (<c>Schoolsluiting</c>, E3-05), and planningsblokken are derived from
/// it, so accepting them again here would create a second source of truth for the school calendar.
/// </para>
/// <para>
/// <b>The structural argument for that exclusion holds only for period-breaking closures, and the narrow version is
/// the true one.</b> <c>Schooljaar.Lesperiodes()</c> cuts only on <c>BreektPeriode</c>, so a <c>Vakantie</c> genuinely
/// cannot be spanned by a block — no such slot is ever offered to the model. A <c>VrijeDag</c> (Hemelvaart,
/// Pinkstermaandag, a pedagogische studiedag) sits <i>inside</i> a block by design (ADR-0020 §5) and is currently not
/// expressed to the model at all, and the prompt prints <c>Planningsblok.AantalDagen</c>, a raw calendar span, while
/// <see cref="Spreidingsrapport"/> measures the same block in open days. That disagreement is pre-existing
/// E3-01/E3-02 drift rather than this story's, but it is logged on E3-04 because this type's doc used to overstate the
/// claim: the honest statement is *"a block never spans a vakantie"*, not *"the grid already expresses every closure"*.
/// </para>
/// <para>
/// <b>The two parameters that do live here are different in kind, and the difference is the design.</b> A
/// <see cref="GewensteStartthemas"/> entry is a <i>preference</i>: it reaches the prompt and
/// <see cref="ParameterRapport"/> reports whether the model complied. A <see cref="VastMoment"/> that blocks is a
/// <i>constraint</i>: the service refuses placements landing in its period. Persistence (2026-07-30) weakens the
/// original argument for leaving the preference advisory — it was that <c>manueel</c> survives regeneration and would
/// strand a parameter the teacher had since changed — but acting on that is a separate decision about whether the
/// tool places a thema no model proposed, and it is deliberately <b>not</b> taken in the same change.
/// </para>
/// <para>
/// <b>Nothing here is a quality judgement.</b> E3-02 deliberately refused to let the tool veto a bad spread, because
/// what counts as a good spread is the school's question. This type does not reopen that: it carries only instructions
/// the teacher stated outright, and honouring a human's explicit instruction is the opposite of the tool deciding
/// (Art. IV.1). Every resulting placement is still <c>voorgesteld</c> and still reviewable.
/// </para>
/// <para>
/// <b>Persisted per (klas, schooljaar) since 2026-07-30.</b> A run that posts a body <b>replaces</b> the class's kept
/// settings before the model is called; a run that posts none <b>reads</b> them, which is how an FR-8/E4 regeneration
/// inherits a blocked period rather than having to bolt it on. See <see cref="Generatieparameters"/> for the scoping
/// and keying reasoning.
/// </para>
/// <para>
/// <b>Both lists are <c>[JsonRequired]</c>, and persistence is what made that necessary.</b> A body replaces the kept
/// settings wholesale, so an <i>omitted</i> array is indistinguishable from an empty one and would permanently delete
/// durable teacher input with nothing in the report to say so. That is the identical argument that made
/// <see cref="VastMoment.BlokkeertPlaatsing"/> required one level down: when two readings of a request differ in what
/// they destroy, the caller says which it means. Posting <b>no body at all</b> is still a first-class case and still
/// means "use what is stored" — the requirement is on the shape of a body that <i>is</i> sent.
/// </para>
/// </summary>
public sealed record JaarplanGeneratieParameters : IValidatableObject
{
    /// <summary>The no-parameters case — what <c>GenereerAsync</c> uses when nothing is supplied or kept.</summary>
    public static readonly JaarplanGeneratieParameters Geen = new();

    /// <summary>
    /// The thema the teacher wants each period to open with, each naming <b>the block it targets by start date</b>.
    /// <para>
    /// <b>Keyed on <c>blokStart</c>, not on array position, and that is a deliberate change of contract
    /// (2026-07-30).</b> The first version was positional: the i-th name targeted the i-th block. ADR-0020 §3 says in
    /// terms that an ordinal is not a stable key, which is why <see cref="ParameterRapport"/> already keyed a block by
    /// its start date and why the form had to re-key its own state on <c>blokStart</c> after a shrinking school year
    /// desynced it. Persisting an ordinal would have been strictly worse than sending one, since it survives exactly
    /// the schooljaar edits that invalidate it — and keeping storage on dates while the request stayed positional
    /// would have meant a position↔date mapping at the boundary, which is where the bug would live. Everything
    /// awkward about the old form existed only to survive the positional contract: the growing list, the
    /// clear-cascade, and the rule that a gap had to be inexpressible. A gap is now simply "no preference for that
    /// period".
    /// </para>
    /// <b>Advisory</b>: carried into the prompt, and the report says whether each landed where it was asked for. A name
    /// the school does not own is reported, never invented (Art. IV.4).
    /// <para>
    /// <b>Required in the JSON</b> — see the type documentation: an omitted array would silently wipe the kept list.
    /// </para>
    /// </summary>
    [JsonRequired]
    public IReadOnlyList<Startthemakeuze> GewensteStartthemas { get; init; } = [];

    /// <summary>
    /// Dates the school has already committed <b>inside</b> a teaching period (FR-5.4 "vaste momenten") — a
    /// schoolfeest, a sportdag, an oudercontact.
    /// <para>
    /// <b>A closure is not a vast moment.</b> Anything that closes the school — a vakantie, or a free day such as
    /// Hemelvaart, Pinkstermaandag or a pedagogische studiedag — is a <c>Schoolsluiting</c> on the
    /// <see cref="Schooljaar"/>, entered by the beheerder under FR-12.1 and classified by <c>Sluitingssoort</c>
    /// (ADR-0020 §5). Putting one here instead would be the very second-source-of-truth this type's own reasoning
    /// rejects for vakanties. That a <b>schoolfeest</b> belongs here was ratified by the owner on 2026-07-30.
    /// </para>
    /// <para>
    /// <b>Required in the JSON</b>, on the same reasoning as <see cref="GewensteStartthemas"/>: omitting it would clear
    /// every kept vast moment, including a blocking one, with no report entry.
    /// </para>
    /// </summary>
    [JsonRequired]
    public IReadOnlyList<VastMoment> VasteMomenten { get; init; } = [];

    /// <summary>True when the teacher supplied nothing, so the prompt can omit the section entirely.</summary>
    public bool IsLeeg => GenormaliseerdeStartthemas().Count == 0 && GenormaliseerdeVasteMomenten().Count == 0;

    /// <summary>The run parameters held in a class's kept settings, mapped onto this type.</summary>
    public static JaarplanGeneratieParameters Van(Generatieparameters bewaard)
    {
        ArgumentNullException.ThrowIfNull(bewaard);

        return new JaarplanGeneratieParameters
        {
            GewensteStartthemas = bewaard.Startthemas
                .Select(s => new Startthemakeuze(s.BlokStart, s.ThemaNaam))
                .ToList(),
            VasteMomenten = bewaard.VasteMomenten
                .Select(m => new VastMoment(m.Naam, m.Datum, m.BlokkeertPlaatsing))
                .ToList(),
        };
    }

    /// <summary>
    /// The start-thema preferences with blanks dropped and names trimmed, ordered by the block they target.
    /// <para>
    /// <b>Nothing is de-duplicated here any more, deliberately (2026-07-31).</b> An earlier revision kept
    /// <c>groep.First()</c> per <c>BlokStart</c>, which silently threw away a fully resolvable instruction: the domain
    /// throws on two preferences for one period and the unique index refuses them, so the drop existed only to stop the
    /// aggregate throwing — an unreported contradiction, and the same defect this story's own audit found twice
    /// (<c>ToegepasteVasteMomenten</c>, <c>GeweigerdDoorVastMoment</c>). It is now refused at the boundary instead: see
    /// <see cref="Validate"/>. The same thema asked for in two <i>different</i> periods is still left alone, because it
    /// is not contradictory — a thema running 4–6 weeks in two separate periods is a plan a teacher may genuinely want.
    /// </para>
    /// <para>
    /// Normalising here rather than in the prompt builder keeps the builder pure and keeps the report measuring the same
    /// list the model saw.
    /// </para>
    /// </summary>
    public IReadOnlyList<Startthemakeuze> GenormaliseerdeStartthemas() =>
        GewensteStartthemas
            .Where(keuze => keuze is not null && !string.IsNullOrWhiteSpace(keuze.ThemaNaam))
            .Select(keuze => new Startthemakeuze(keuze.BlokStart, keuze.ThemaNaam.Trim()))
            .OrderBy(keuze => keuze.BlokStart)
            .ToList();

    /// <summary>
    /// Request-shape validation, run by <c>[ApiController]</c> on the bound body so a contradictory request is a
    /// <b>400</b> rather than a silently-thinned parameter set.
    /// <para>
    /// One rule: <b>two preferences may not target the same period.</b> One period opens with one thema
    /// (<see cref="Generatieparameters.Vervang"/>, plus a unique index), so a body naming two is not additive and not
    /// resolvable — and since a body <i>replaces</i> the kept settings, quietly keeping the first would delete the
    /// second for good. Refusing costs a real user nothing: the form keys its own state on the period, so it cannot
    /// produce this shape at all.
    /// </para>
    /// <para>
    /// <b>The message is English on purpose</b>, like the 422 parser diagnostic beside it and like the framework's own
    /// <c>[JsonRequired]</c> failures it joins in <c>ModelState</c>. It describes a malformed request no teacher can
    /// produce or act on (Art. II.2); the teacher-facing sentence for a failed run lives in <c>nl.json</c>, keyed on the
    /// status.
    /// </para>
    /// </summary>
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        var dubbel = GenormaliseerdeStartthemas()
            .GroupBy(keuze => keuze.BlokStart)
            .Where(groep => groep.Count() > 1)
            .Select(groep => groep.Key.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture))
            .ToList();

        if (dubbel.Count > 0)
        {
            yield return new ValidationResult(
                "Two or more 'gewensteStartthemas' entries target the same block start date " +
                $"({string.Join(", ", dubbel)}). One period opens with one thema, so send at most one entry per date.",
                [nameof(GewensteStartthemas)]);
        }
    }

    /// <summary>
    /// The vaste momenten with blank names dropped and names trimmed, in the order the service and the report read
    /// them. A form that posts a half-filled row must not make the prompt ask about "".
    /// </summary>
    public IReadOnlyList<VastMoment> GenormaliseerdeVasteMomenten() =>
        VasteMomenten
            .Where(moment => moment is not null && !string.IsNullOrWhiteSpace(moment.Naam))
            .Select(moment => new VastMoment(moment.Naam.Trim(), moment.Datum, moment.BlokkeertPlaatsing))
            .OrderBy(moment => moment.Datum)
            .ThenBy(moment => moment.Naam, StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// The normalised parameters as the domain entities a class keeps between runs.
    /// <para>
    /// Two preferences for one period reach <see cref="Generatieparameters.Vervang"/> and throw there, loudly, as the
    /// programmer error they are: every HTTP caller is already refused by <see cref="Validate"/>, so a set that gets
    /// this far was built in code that skipped the boundary. Loud is the point — the previous behaviour was to drop one
    /// silently.
    /// </para>
    /// </summary>
    public (IReadOnlyList<BewaardStartthema> Startthemas, IReadOnlyList<BewaardVastMoment> VasteMomenten) NaarBewaard() =>
        (GenormaliseerdeStartthemas()
                .Select(keuze => new BewaardStartthema(keuze.BlokStart, keuze.ThemaNaam))
                .ToList(),
            GenormaliseerdeVasteMomenten()
                .Select(moment => new BewaardVastMoment(moment.Naam, moment.Datum, moment.BlokkeertPlaatsing))
                .ToList());
}

/// <summary>
/// One start-thema preference on the wire: the thema the teacher wants the block starting on
/// <paramref name="BlokStart"/> to open with.
/// </summary>
/// <param name="BlokStart">
/// The target block's <b>start date</b> — the same stable key every other block reference in the system uses
/// (ADR-0020 §3, <c>PUT …/plaatsingen/{id}/blok</c>, <see cref="GeweigerdePlaatsing"/>). A date that starts no
/// current block is <b>reported</b>, not snapped to a neighbour and not dropped.
/// </param>
/// <param name="ThemaNaam">The thema name, resolved against the school's own thema's (Art. IV.4).</param>
public sealed record Startthemakeuze(DateOnly BlokStart, string ThemaNaam);

/// <summary>
/// One date the school has already committed inside a teaching period, supplied by the teacher before generation
/// (FR-5.4). For anything that <i>closes</i> the school, see <see cref="JaarplanGeneratieParameters.VasteMomenten"/> —
/// that is schooljaar data, not a generation parameter.
/// </summary>
/// <param name="Naam">
/// What it is, in the teacher's own words ("Schoolfeest", "Sportdag"). Rendered into the prompt so the model can
/// reason about it, and returned in the report so the UI can name it in a sentence of its own.
/// </param>
/// <param name="Datum">
/// When it falls. A <b>date</b>, not a block: the service resolves which planningsblok contains it at generation
/// time. Keying on the block's start date instead would ask the teacher to know the grid, and would go stale the
/// moment a vakantie edit reshaped it — the same reasoning ADR-0020 §3 applies to placements.
/// </param>
/// <param name="BlokkeertPlaatsing">
/// <c>true</c> refuses any new thema in the period containing this date; <c>false</c> treats the moment as context
/// only, telling the model the period has less time while allowing a thema in it.
/// <para>
/// <b>Deliberately has no default, and is required in the JSON.</b> An earlier revision defaulted to <c>false</c> on
/// the reasoning that the weaker reading is safer to assume — which inverts which failure is recoverable. Under
/// <c>true</c> a refusal is reported and the teacher can act. Under <c>false</c> the persisted plan is byte-identical
/// to a run with no parameters at all, and the report is empty, so the outcome is indistinguishable from *"your
/// instruction was honoured"*. A form that forgot one checkbox would have shipped a control with no effect, which is
/// the one thing CLAUDE.md's E3-06 rule forbids outright. Forcing the caller to say removes the trap rather than
/// choosing which way to be silently wrong.
/// </para>
/// </param>
public sealed record VastMoment(
    string Naam,
    DateOnly Datum,
    [property: JsonRequired] bool BlokkeertPlaatsing);
