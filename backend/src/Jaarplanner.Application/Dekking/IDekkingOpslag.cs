using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Dekking;

/// <summary>
/// The persistence seam for the coverage computation (Art. VIII layering), sibling of <c>IJaarplanOpslag</c> and
/// <c>IDoelMatchOpslag</c>. <see cref="DekkingService"/> depends only on this abstraction, so the whole
/// computation — the highest-risk logic in the system together with the Excel parser (Art. V.6) — is unit-tested
/// against an in-memory fake with no database.
/// </summary>
public interface IDekkingOpslag
{
    /// <summary>
    /// The leerplandoelen the given thema's actually carry <b>for this class</b>, as (code, thema naam) pairs —
    /// one per covering thema, so a code carried by two placed thema's yields two rows and the caller can name
    /// the evidence.
    /// <para>
    /// <b>Which link layers count is the load-bearing part of this contract, and it was ruled on rather than
    /// inferred (owner, 2026-08-03).</b> A <c>DoelKoppeling</c> lives in four places (Art. IX.2), and they do not
    /// all belong to the school in the same way:
    /// </para>
    /// <list type="number">
    /// <item><c>Themadoel</c> — school-wide, on the thema. Counts for every class that places the thema.</item>
    /// <item><c>Thema.Doelsuggesties</c> — school-wide, on the thema. Same.</item>
    /// <item><c>Subdoel</c> — hangs off a <c>Subthema</c>, which is scoped <b>per klas and leeftijd</b>. Counts
    /// only when that subthema belongs to <paramref name="klasId"/>.</item>
    /// <item><c>Activiteit.Doelkoppelingen</c> — hangs off an activiteit inside a subthema. Same scoping.</item>
    /// </list>
    /// <para>
    /// The ruling is "all four, with the class-scoped two filtered to this class". The alternative readings were
    /// each rejected for a concrete reason. Counting only the two school-wide layers would leave a goal linked
    /// solely through an activiteit absent from <b>both</b> overviews — not covered here, and not in the gap list
    /// either, because <c>IOngekoppeldeDoelenQuery</c> reads all four and would call it linked. Counting all four
    /// school-wide would let class A claim coverage for content class B teaches.
    /// </para>
    /// <para>
    /// <b>Only <c>aanvaard</c>/<c>manueel</c> links count</b> (Art. V.1): a <c>voorgesteld</c> suggestion is not
    /// yet a goal of the thema and letting it grant dekking would hand the decision to the AI (Art. IV.1); a
    /// <c>geweigerd</c> one never was.
    /// </para>
    /// <para>
    /// <b>Why the status/layer rule is written inline in the implementation instead of behind one shared
    /// predicate.</b> These filters have to translate to SQL, and EF cannot translate a call to an arbitrary
    /// helper method, so the rule is necessarily repeated in every queryable that applies it. That is the real
    /// constraint behind E1-17 ("one shared definition of which layers hold a <c>DoelKoppeling</c>"): the
    /// duplication cannot be removed by extracting a method, only by generating the queries from one place or by
    /// pinning the call sites against each other with tests. This story does the latter for its own query and
    /// leaves the unification to E1-17, whose scope it would otherwise absorb.
    /// </para>
    /// </summary>
    /// <param name="klasId">The class whose coverage is being computed; scopes layers 3 and 4.</param>
    /// <param name="themaIds">
    /// The thema's placed in a real period with a status that counts. Empty yields an empty result without
    /// touching the link tables.
    /// </param>
    Task<IReadOnlyList<DekkendeKoppeling>> HaalDekkendeKoppelingenAsync(
        Guid klasId,
        IReadOnlyCollection<Guid> themaIds,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The in-scope leerplandoelen — the denominator of the coverage figure and the source of the gap list.
    /// <para>
    /// Returned as the domain entity rather than a fourth near-identical read DTO, following
    /// <c>IJaarplanOpslag.LaadThemasAsync</c>'s precedent. It is read-only reference data (Art. III.1) and the
    /// implementation reads it untracked, so there is nothing here to mutate by accident.
    /// </para>
    /// </summary>
    /// <param name="jaarFasen">
    /// The jaar/fase codes to measure against (JK, K2, K3, L1–L6, or a fase for P/S), or <c>null</c>/empty for the
    /// <b>whole loaded curriculum</b>.
    /// <para>
    /// <b>The ruling this seam was built for has landed (owner, 2026-08-04), so it now has real callers.</b> E5-01
    /// created this parameter while "which goals should a class be measured against?" was an open Art. XIV decision
    /// and every caller passed <c>null</c>; E5-02 asked, and the answer is that a class is measured against its own
    /// jaar/fase by default (<c>Dekkingsbereik.EigenJaarFase</c>) with the whole curriculum as an explicit switch.
    /// <c>DekkingService</c> therefore passes the codes from <c>Jaarfasen.VoorLeerjaar</c> for the default and
    /// <c>null</c> for <c>Dekkingsbereik.HeelCurriculum</c>. Building the seam ahead of the ruling paid off exactly
    /// as intended: resolving the decision changed a value at one call site rather than the computation.
    /// </para>
    /// <para>
    /// <b>What is still open</b> is the graadklas / menggroep half: <c>Klas.Leerjaar</c> is a single ordinal, so a
    /// class spanning several leerjaren cannot state its set, and <c>Jaarfasen.VoorLeerjaar</c> refuses rather than
    /// guesses. See <c>Dekkingsbereik</c>.
    /// </para>
    /// <para>
    /// The matching is <b>ordinal and case-sensitive</b>, and that is now correct rather than merely cautious: the
    /// owner ruled on 2026-08-03 that the canonical <c>jaarFase</c> form is <c>JK</c>/<c>K2</c>/<c>K3</c> +
    /// <c>L1</c>–<c>L6</c>, and that the <b>import normalises</b> the other ordering to it. Stored values are
    /// therefore already canonical, so a comparer that folds case or reorders characters would only mask an import
    /// that failed to normalise. What that ruling deliberately did <i>not</i> settle is what a real Op.stap column F
    /// actually contains, which is an observation rather than a decision and is filed against E1-12.
    /// </para>
    /// </param>
    Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
        IReadOnlyCollection<string>? jaarFasen = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// How many leerplandoelen are loaded in total, ignoring any jaar/fase scope (E5-02).
    /// <para>
    /// <b>It exists so a narrowed denominator cannot be silent.</b> Scoping a class to its own jaar/fase drops every
    /// other year's goals <i>and</i> the illustrative P/S doelsoorten, whose column F holds a fase code rather than
    /// one of the nine jaar/fase codes (Art. VII.1). A smaller denominator makes coverage look better, which is the
    /// one direction this figure must never move by itself, so the overview states how many goals it left out and
    /// offers the whole-curriculum switch beside it. That sentence needs this number.
    /// </para>
    /// <para>
    /// A <c>COUNT</c> rather than a second full read: the scoped list is already materialised and the only missing
    /// quantity is the total.
    /// </para>
    /// </summary>
    Task<int> TelAlleLeerplandoelenAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The class's <c>Leerjaar</c> ordinal, or <c>null</c> when no such class exists (E5-02).
    /// <para>
    /// <b>Why the coverage computation needs it, and why it is not read off the jaarplan projection.</b> Scoping the
    /// denominator to the class's own jaar/fase requires the class's leerjaar, and <c>JaarplanWeergave</c> does not
    /// carry it. Adding it there would change a contract the kalender, the spreading report and the generation flow
    /// all read, for one consumer's benefit; E5-01 explicitly declined a comparable change for the same reason. So
    /// the lookup lives on this port, where the only cost is one keyed read.
    /// </para>
    /// <para>
    /// <c>null</c> means the class is gone, which for this computation can only happen if it was deleted between the
    /// plan read and this one. It is treated exactly like a leerjaar that maps to no jaar/fase: fall back to the
    /// whole curriculum and say so, never to an empty denominator.
    /// </para>
    /// </summary>
    Task<int?> HaalLeerjaarAsync(Guid klasId, CancellationToken cancellationToken = default);
}

/// <summary>
/// One reason a leerplandoel is covered: the code, and the thema whose link carries it.
/// </summary>
/// <param name="LeerplandoelCode">The covered goal's code.</param>
/// <param name="ThemaNaam">The name of the placed thema that carries it — the evidence a proof of coverage needs.</param>
public sealed record DekkendeKoppeling(string LeerplandoelCode, string ThemaNaam);
