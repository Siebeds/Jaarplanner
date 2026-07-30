using System.Text.Json.Serialization;
using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// What the teacher supplies <b>before</b> generation runs (FR-5.4).
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
/// <i>constraint</i>: the service refuses placements landing in its period. Enforcing the preference would mean the
/// tool placing a thema no model proposed, leaving its provenance unstatable — <c>voorgesteld</c> would be false and
/// <c>manueel</c> survives regeneration, stranding a parameter the teacher had since changed.
/// </para>
/// <para>
/// <b>Nothing here is a quality judgement.</b> E3-02 deliberately refused to let the tool veto a bad spread, because
/// what counts as a good spread is the school's question. This type does not reopen that: it carries only instructions
/// the teacher stated outright, and honouring a human's explicit instruction is the opposite of the tool deciding
/// (Art. IV.1). Every resulting placement is still <c>voorgesteld</c> and still reviewable.
/// </para>
/// <para>
/// <b>Not persisted, deliberately visible as a gap.</b> Nothing stores these parameters, so a blocking vast moment is
/// a one-shot: an E4/FR-8 regeneration will re-place a thema in the blocked period unless the teacher fills the form
/// again. Whether parameters should be remembered per klas is a real decision that nobody has taken, and it is
/// recorded as an open question on the E3-04 story rather than answered by default here.
/// </para>
/// </summary>
public sealed record JaarplanGeneratieParameters
{
    /// <summary>The no-parameters case — what <c>GenereerAsync</c> uses when a caller supplies nothing.</summary>
    public static readonly JaarplanGeneratieParameters Geen = new();

    /// <summary>
    /// Thema names the teacher wants the year to open with, <b>one per planningsblok from the start of the year</b>:
    /// the first name targets the first block, the second the second, and so on.
    /// <para>
    /// <b>The order is load-bearing, not decorative.</b> An earlier revision joined the whole list into one sentence
    /// naming a single block, which instructed the model to put several thema's in one period — contradicting the
    /// system prompt's own "use as many different blocks as possible" and the fit rule, since a thema runs 4–6 weeks
    /// and that <i>is</i> a themaperiode. It also made the report guarantee a "not honoured" entry for any teacher who
    /// named two thema's. Positional mapping is what makes a plural list mean something.
    /// </para>
    /// <b>Advisory</b>: carried into the prompt, and the report says whether each landed where it was asked for. A name
    /// the school does not own is reported, never invented (Art. IV.4).
    /// </summary>
    public IReadOnlyList<string> GewensteStartthemas { get; init; } = [];

    /// <summary>
    /// Dates the school has already committed <b>inside</b> a teaching period (FR-5.4 "vaste momenten") — a
    /// schoolfeest, a sportdag, an oudercontact.
    /// <para>
    /// <b>A closure is not a vast moment.</b> Anything that closes the school — a vakantie, or a free day such as
    /// Hemelvaart, Pinkstermaandag or a pedagogische studiedag — is a <c>Schoolsluiting</c> on the
    /// <see cref="Schooljaar"/>, entered by the beheerder under FR-12.1 and classified by <c>Sluitingssoort</c>
    /// (ADR-0020 §5). Putting one here instead would be the very second-source-of-truth this type's own reasoning
    /// rejects for vakanties. An earlier revision listed "pedagogische studiedag" as an example here, which
    /// contradicted ADR-0020 §5 outright; the boundary is now stated as a rule so a UI cannot offer two forms for one
    /// fact.
    /// </para>
    /// </summary>
    public IReadOnlyList<VastMoment> VasteMomenten { get; init; } = [];

    /// <summary>True when the teacher supplied nothing, so the prompt can omit the section entirely.</summary>
    public bool IsLeeg => GenormaliseerdeStartthemas().Count == 0 && VasteMomenten.Count == 0;

    /// <summary>
    /// The startthema names with blanks dropped and duplicates removed, <b>order preserved</b> because the position is
    /// the block it targets. Normalising here rather than in the prompt builder keeps the builder pure and keeps the
    /// report measuring the same list the model saw.
    /// </summary>
    public IReadOnlyList<string> GenormaliseerdeStartthemas() =>
        GewensteStartthemas
            .Where(naam => !string.IsNullOrWhiteSpace(naam))
            .Select(naam => naam.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}

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
