using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Dekking;

/// <summary>
/// Computes one class's dekking (E5-01, FR-9.1, Art. V.1) — <b>the highest-risk logic in the system together with
/// the Excel parser</b> (Art. V.6), which is why every rule it applies is stated here and pinned by a test rather
/// than left to be inferred from the code.
/// <para>
/// <b>Computed, never stored.</b> There is no dekking table, no cached percentage and no invalidation step. The
/// figure is derived from the current placements and the current link state on every call, which is Art. V.1's
/// requirement and also the only shape under which accepting a suggestion cannot leave a stale number behind.
/// </para>
/// <para>
/// It reads the plan through <see cref="IJaarplanLezer"/> — the same projection the teacher's calendar shows —
/// so coverage and the stale-placement notice cannot disagree about which placements are broken.
/// </para>
/// </summary>
public sealed class DekkingService
{
    private readonly IJaarplanLezer _lezer;
    private readonly IDekkingOpslag _opslag;

    public DekkingService(IJaarplanLezer lezer, IDekkingOpslag opslag)
    {
        _lezer = lezer;
        _opslag = opslag;
    }

    /// <summary>
    /// Computes the coverage of one class's jaarplan.
    /// </summary>
    /// <param name="klasId">The class to compute coverage for.</param>
    /// <param name="bereik">
    /// Which leerplandoelen to measure against (owner ruling 2026-08-04). Defaults to the class's own jaar/fase, so
    /// a caller that asks for nothing gets the answer the ruling settled rather than E5-01's unscoped one.
    /// </param>
    /// <param name="cancellationToken">Cancellation.</param>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// The class does not exist. A class that exists but has never generated a plan is <b>not</b> an error: it
    /// yields 0 covered out of the goals in scope, which is the honest answer (Art. IX.3).
    /// </exception>
    public async Task<DekkingWeergave> BerekenAsync(
        Guid klasId,
        Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        CancellationToken cancellationToken = default)
    {
        var plan = await _lezer.HaalJaarplanAsync(klasId, cancellationToken);

        // The placements that actually make a thema taught in a period of this year. Two independent conditions,
        // and both have a ruling behind them:
        //
        //   * status aanvaard/manueel only. A `voorgesteld` placement would let the AI grant dekking, which
        //     Art. IV.1 forbids, and a `geweigerd` one plainly teaches nothing. (E5-01's binding reading of
        //     Art. V.1's "placed in the plan", recorded 2026-07-29 by the E3-01 antagonist: before placements had
        //     a status the phrase was unambiguous, and it now has four.)
        //   * not stale. A placement whose stored start date is no longer any period's start is in no period at
        //     all, so nothing is demonstrably taught on its account (directie 2026-07-28).
        var dekkende = plan.Plaatsingen
            .Where(p => !p.IsVervallen && TeltVoorDekking(p.Status))
            .ToList();

        var themaIds = dekkende
            .Select(p => p.ThemaId)
            .Distinct()
            .ToList();

        var koppelingen = themaIds.Count == 0
            ? []
            : await _opslag.HaalDekkendeKoppelingenAsync(klasId, themaIds, cancellationToken);

        // Grouped once into code -> the thema's that cover it, so the per-doel projection below is a dictionary
        // lookup rather than a scan per leerplandoel. The curriculum is thousands of rows; a nested scan here
        // would be the one place this computation could become quadratic.
        var themasPerCode = koppelingen
            .GroupBy(k => k.LeerplandoelCode, StringComparer.Ordinal)
            .ToDictionary(
                g => g.Key,
                g => (IReadOnlyList<string>)g
                    .Select(k => k.ThemaNaam)
                    .Distinct(StringComparer.Ordinal)
                    .OrderBy(naam => naam, StringComparer.Ordinal)
                    .ToList(),
                StringComparer.Ordinal);

        // THE DENOMINATOR. Since the owner ruling of 2026-08-04 a class is measured against its own jaar/fase by
        // default, derived from Klas.Leerjaar, with Dekkingsbereik.HeelCurriculum as the explicit switch. E5-01 built
        // the seam for exactly this and passed null from here; resolving the ruling is therefore this value.
        //
        // The fallback direction is the load-bearing part. Jaarfasen.VoorLeerjaar returns null rather than an empty
        // list when it cannot map the leerjaar (a graadklas ordinal, or a class deleted mid-computation), because an
        // empty jaar/fase set means "the whole curriculum" one layer down and "no goals at all" to a reader. The
        // second would report a class as having nothing left to cover. So a refusal widens the scope and is DECLARED
        // in the payload; it never narrows it.
        var gemetenFasen = bereik == Dekkingsbereik.EigenJaarFase
            ? await BepaalEigenJaarFasenAsync(klasId, cancellationToken)
            : null;

        var isTerugval = bereik == Dekkingsbereik.EigenJaarFase && gemetenFasen is null;

        var leerplandoelen = await _opslag.HaalLeerplandoelenAsync(gemetenFasen, cancellationToken);

        // How many loaded goals the scope leaves out, so the overview can say so instead of quietly reporting a
        // smaller denominator (a narrower scope makes coverage look better, the one direction this figure must not
        // move by itself). Only asked when a scope was actually applied: unscoped, the list IS the total.
        //
        // Clamped at zero because the count and the list are two reads: an import landing between them could
        // otherwise yield a negative "left out" figure, which is a nonsense number rather than a small one.
        var aantalBuitenBereik = gemetenFasen is null
            ? 0
            : Math.Max(0, await _opslag.TelAlleLeerplandoelenAsync(cancellationToken) - leerplandoelen.Count);

        var doelen = leerplandoelen
            .Select(l =>
            {
                var dekkendeThemas = themasPerCode.GetValueOrDefault(l.Code, []);

                return new LeerplandoelDekking(
                    l.Code,
                    l.Doelsoort,
                    l.JaarFase,
                    l.Domein,
                    l.Subdomein,
                    l.Tekst,
                    l.MinimumdoelRef,
                    l.NietMeerInOpstap,
                    // Covered exactly when at least one placed thema carries it. The two halves of the record can
                    // therefore never disagree, which matters because an export reads IsGedekt and a teacher reads
                    // the thema list.
                    IsGedekt: dekkendeThemas.Count > 0,
                    dekkendeThemas);
            })
            // Ordinal throughout, deliberately. CurrentCulture would make the server's output depend on the host's
            // culture, and it still would not reproduce the gap list's order, which Postgres produces under the
            // database collation. Stable and host-independent beats almost-matching.
            .OrderBy(d => d.Domein, StringComparer.Ordinal)
            .ThenBy(d => d.Subdomein, StringComparer.Ordinal)
            .ThenBy(d => d.Code, StringComparer.Ordinal)
            .ToList();

        // Which stale placements poison the figure. NOT simply "any stale placement": a placement the teacher has
        // REJECTED contributes nothing to dekking whether or not its period still exists, so its staleness can
        // never change the number. Counting it would leave the figure permanently "te herzien" over a placement
        // nobody will ever re-place, and it would put the plan in the state E4-06 found and fixed elsewhere in this
        // codebase: a rejected card being told to pick a period. The same distinction is already a tested domain
        // concept — Themaplaatsing.IsGepland, "anything except a placement the teacher has rejected" — and the
        // E3-02 code review made exactly this correction to the spreading report, which was calling a period
        // "overbelast" because of a thema the teacher had thrown out.
        //
        // A stale `voorgesteld` placement DOES count as unresolved: the teacher may still accept it, and accepting
        // it would raise the figure, so the figure cannot be trusted while it dangles.
        //
        // This narrowing is a judgement call, not an owner ruling. The directie ruling of 2026-07-28 says the
        // figure is onbetrouwbaar "while any placement is unresolved" and did not contemplate a rejected one.
        var onopgeloste = plan.Plaatsingen
            .Count(p => p.IsVervallen && !IsGeweigerd(p.Status));

        var isBetrouwbaar = onopgeloste == 0;

        return new DekkingWeergave(
            plan.KlasId,
            plan.KlasNaam,
            plan.SchooljaarId,
            plan.SchooljaarNaam,
            // What was APPLIED, not what was asked for. A fallback reports HeelCurriculum because that is what the
            // figures below are over; IsTerugvalNaarHeelCurriculum is what says the caller did not choose it.
            isTerugval ? Dekkingsbereik.HeelCurriculum : bereik,
            gemetenFasen ?? [],
            isTerugval,
            aantalBuitenBereik,
            isBetrouwbaar,
            onopgeloste,
            // Withheld rather than reported while any placement is unresolved (directie 2026-07-28). Null, not a
            // number beside a flag: see DekkingWeergave for why the type refuses to carry both.
            AantalGedekt: isBetrouwbaar ? doelen.Count(d => d.IsGedekt) : null,
            doelen.Count,
            doelen);
    }

    /// <summary>
    /// The jaar/fase codes this class should be measured against, or <c>null</c> when they cannot be derived and the
    /// caller must widen the scope instead (E5-02).
    /// <para>
    /// Two distinct reasons yield <c>null</c> and both mean the same thing here: the class no longer exists (it was
    /// deleted between the plan read and this one), or its <c>Leerjaar</c> maps to no jaar/fase set, which is the
    /// unresolved graadklas / menggroep case (Art. XIV). They are not distinguished because the honest response is
    /// identical, and inventing a second fallback state would put a distinction on screen that changes nothing a
    /// teacher can act on.
    /// </para>
    /// </summary>
    private async Task<IReadOnlyList<string>?> BepaalEigenJaarFasenAsync(
        Guid klasId,
        CancellationToken cancellationToken)
    {
        var leerjaar = await _opslag.HaalLeerjaarAsync(klasId, cancellationToken);

        return leerjaar is null ? null : Jaarfasen.VoorLeerjaar(leerjaar.Value);
    }

    /// <summary>
    /// Whether a placement's status means its thema is taught: <c>aanvaard</c> or <c>manueel</c> (Art. V.1).
    /// <para>
    /// The status arrives as a string because <see cref="ThemaplaatsingWeergave"/> is a presentation record that
    /// serialises the enum by name. An unrecognised value <b>does not count</b>: a coverage claim this code cannot
    /// justify is worse than a missing one, so the failure direction is deliberately towards under-reporting.
    /// </para>
    /// </summary>
    private static bool TeltVoorDekking(string status) =>
        Enum.TryParse<KoppelingStatus>(status, out var geparsed)
        && geparsed is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel;

    /// <summary>
    /// Whether the teacher rejected this placement. An unrecognised status is treated as <b>not</b> rejected, so it
    /// still counts as unresolved — the same fail-closed direction as <see cref="TeltVoorDekking"/>: a status this
    /// code cannot read must not be able to silently restore confidence in the figure.
    /// <para>
    /// <b>This RE-EXPRESSES <c>Themaplaatsing.IsGepland</c> rather than reusing it, and that is worth naming because
    /// the whole theme of this story is that duplicated status rules drift.</b> <c>IsGepland</c> is
    /// <c>Status != Geweigerd</c> on the domain entity; this is the same rule read off the projection's serialised
    /// string, because <see cref="ThemaplaatsingWeergave"/> carries a <c>string</c> and the entity is not in reach
    /// here. The honest options were to say so or to expose the predicate on the projection; the second is a change
    /// to a contract three other features read, so it is not this story's to make. If a fourth caller ever needs
    /// this, that is the signal to put the predicate on <c>ThemaplaatsingWeergave</c> instead.
    /// </para>
    /// </summary>
    private static bool IsGeweigerd(string status) =>
        Enum.TryParse<KoppelingStatus>(status, out var geparsed)
        && geparsed == KoppelingStatus.Geweigerd;
}
