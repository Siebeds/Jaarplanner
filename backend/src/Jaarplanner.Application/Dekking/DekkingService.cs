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
    /// <param name="jaarFase">
    /// Narrow <see cref="Dekkingsbereik.EigenJaarFase"/> to this one code, when the class has more than one available
    /// (owner ruling 2026-08-04). Ignored when null, when the scope is the whole curriculum, or when the code is not
    /// one this class could be measured against.
    /// <para>
    /// <b>An out-of-set code is ignored rather than refused, and the payload is what keeps that honest.</b> A 400 would
    /// take a teacher who followed a stale link off a working screen; ignoring keeps them on it, and because
    /// <c>GemetenJaarFasen</c> reports what was <i>applied</i> rather than what was asked, the screen cannot claim a
    /// narrowing that did not happen. Same shape as the frontend's own handling of an unknown <c>bereik</c>.
    /// </para>
    /// </param>
    /// <param name="cancellationToken">Cancellation.</param>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// The class does not exist. A class that exists but has never generated a plan is <b>not</b> an error: it
    /// yields 0 covered out of the goals in scope, which is the honest answer (Art. IX.3).
    /// </exception>
    public async Task<DekkingWeergave> BerekenAsync(
        Guid klasId,
        Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        string? jaarFase = null,
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

        // THE DENOMINATOR, resolved by the one method both this figure and E3-03's vooruitzicht read it from, so the
        // two can never be over different sets of goals. See BepaalBereikAsync for the ruling it implements.
        var scope = await BepaalBereikAsync(klasId, bereik, jaarFase, cancellationToken);

        // THE GAP-ANALYSE'S INPUT (E5-05). Every thema linked to a goal for this class, placed or not, decided or
        // proposed — see IDekkingOpslag for how it differs from the covering read above and why the two are separate.
        var kandidatenPerCode = (await _opslag.HaalKandidaatKoppelingenAsync(klasId, cancellationToken))
            .GroupBy(k => k.LeerplandoelCode, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<KandidaatKoppeling>)g.ToList(), StringComparer.Ordinal);

        // The thema's standing in the plan that a teacher could still say yes to, INCLUDING the ones they already
        // accepted. Exactly the set BerekenVooruitzichtAsync counts its ceiling over, read through the same helper so
        // the two cannot drift: WachtOpBeslissing below is the per-doel form of that ceiling's headroom.
        var voorstelbareThemaIds = Themaplaatsingen(plan, IsVoorstelbaar).ToHashSet();

        // The thema's whose placement in a real period of this plan the teacher REJECTED. Read through the same helper,
        // so this set inherits its `!IsVervallen` filter — which is the whole boundary between PlaatsingGeweigerd and
        // NietIngepland: a rejected card is drawn in its period column and a stale one is not, so only the first makes
        // "sits in no period" a false sentence to put on screen. See Lacuneoorzaak.PlaatsingGeweigerd.
        var geweigerdeThemaIds = Themaplaatsingen(plan, IsGeweigerd).ToHashSet();

        var doelen = scope.Leerplandoelen
            .Select(l =>
            {
                var dekkendeThemas = themasPerCode.GetValueOrDefault(l.Code, []);
                var isGedekt = dekkendeThemas.Count > 0;

                // Classified only for a gap. A covered goal has no cause, and the type says so with a null rather
                // than with an extra enum member: "not applicable" and "we could not work out why" would otherwise be
                // the same value, and only one of those is ever true here.
                var lacune = isGedekt
                    ? (Oorzaak: (Lacuneoorzaak?)null, Themas: (IReadOnlyList<string>)[])
                    : BepaalOorzaak(
                        kandidatenPerCode.GetValueOrDefault(l.Code, []),
                        voorstelbareThemaIds,
                        geweigerdeThemaIds);

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
                    IsGedekt: isGedekt,
                    dekkendeThemas,
                    lacune.Oorzaak,
                    lacune.Themas);
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
        var onopgeloste = TelOnopgelosteVervallen(plan);

        var isBetrouwbaar = onopgeloste == 0;

        return new DekkingWeergave(
            plan.KlasId,
            plan.KlasNaam,
            plan.SchooljaarId,
            plan.SchooljaarNaam,
            scope.ToegepastBereik,
            scope.GemetenFasen ?? [],
            // What this class COULD be measured against, so a narrowed screen still knows its alternatives.
            scope.BeschikbareFasen ?? [],
            scope.IsTerugval,
            scope.AantalBuitenBereik,
            isBetrouwbaar,
            onopgeloste,
            // Withheld rather than reported while any placement is unresolved (directie 2026-07-28). Null, not a
            // number beside a flag: see DekkingWeergave for why the type refuses to carry both.
            AantalGedekt: isBetrouwbaar ? doelen.Count(d => d.IsGedekt) : null,
            doelen.Count,
            doelen);
    }

    /// <summary>
    /// What this class's plan <b>would</b> cover if the teacher accepted every proposal standing in it, beside what it
    /// covers today (E3-03, FR-5.3). See <see cref="Dekkingsvooruitzicht"/> for why a potential figure exists at all
    /// and why it is never presented as dekking.
    /// <para>
    /// <b>It lives here rather than in the generation service, and that is the point.</b> Every rule that decides
    /// coverage — which link layers count, which placement statuses count, what a stale placement does to the figure,
    /// which goals are in scope — is applied by exactly the code that computes the real dekking, one method above.
    /// A leaner copy next to the generator is how the two would come to disagree, and this codebase has already paid
    /// for that class of divergence more than once (the te-vol threshold, the four link layers).
    /// </para>
    /// <para>
    /// <b>The one deliberate difference from <see cref="BerekenAsync"/>:</b> it counts a second, wider set of
    /// placements — the ones a teacher could still say yes to. Nothing about the <i>decided</i> figure changes, and
    /// both are returned so a caller cannot show one without the other.
    /// </para>
    /// <para>
    /// <b>It accepts the same <c>jaarFase</c> narrowing as <see cref="BerekenAsync"/>, and that is a correction rather
    /// than a feature</b> (antagonist round 1, 2026-08-05). The first version refused one, on the stated grounds that
    /// the kleuterjaar chooser "lives on the dekkingsoverzicht". It does not: E3-09 put a <c>Jaarfasekiezer</c> on the
    /// <i>kalender</i>, driving the live dekking line on the same screen as this panel. So a kleutergroep narrowed to
    /// K3 would have read one figure measured against K3 and, a few pixels away, one measured against JK+K2+K3, with
    /// nothing a teacher could use to reconcile them.
    /// </para>
    /// </summary>
    /// <param name="klasId">The class whose plan is being looked ahead over.</param>
    /// <param name="bereik">Which leerplandoelen to measure against; the same ruling and the same default as dekking.</param>
    /// <param name="jaarFase">
    /// The teacher's narrowing within the class's own set, exactly as <see cref="BerekenAsync"/> takes it: ignored when
    /// null, when the scope is the whole curriculum, or when the code is not one this class could be measured against.
    /// </param>
    /// <param name="cancellationToken">Cancellation.</param>
    /// <exception cref="Jaarplanner.Application.Schoolcontent.Beheer.SchoolcontentNietGevondenFout">
    /// The class does not exist.
    /// </exception>
    public async Task<Dekkingsvooruitzicht> BerekenVooruitzichtAsync(
        Guid klasId,
        Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        string? jaarFase = null,
        CancellationToken cancellationToken = default)
    {
        var plan = await _lezer.HaalJaarplanAsync(klasId, cancellationToken);
        var scope = await BepaalBereikAsync(klasId, bereik, jaarFase, cancellationToken);

        // The placements that make a thema taught today: exactly BerekenAsync's rule, so the decided half of this
        // report and the dekkingsoverzicht answer the same number for the same plan.
        var beslist = Themaplaatsingen(plan, TeltVoorDekking);

        // The placements a teacher could still say yes to, PLUS the decided ones — a ceiling, so it must be a
        // superset. Rejected placements are excluded because the teacher has already answered, and stale ones because
        // they sit in no period at all; an unrecognised status counts as neither (see IsVoorstelbaar).
        var voorstelbaar = Themaplaatsingen(plan, IsVoorstelbaar);

        var nuGedekt = await TelGedekteDoelenAsync(klasId, beslist, scope.Leerplandoelen, cancellationToken);
        var mogelijkGedekt = beslist.Count == voorstelbaar.Count
            // Same thema set, so the same answer: no proposal is standing and the second read would be identical.
            // Skipped rather than repeated because this is the state a plan is in whenever nothing was just generated.
            ? nuGedekt
            : await TelGedekteDoelenAsync(klasId, voorstelbaar, scope.Leerplandoelen, cancellationToken);

        var onopgeloste = TelOnopgelosteVervallen(plan);
        var isBetrouwbaar = onopgeloste == 0;

        return new Dekkingsvooruitzicht(
            scope.ToegepastBereik,
            scope.GemetenFasen ?? [],
            scope.IsTerugval,
            scope.AantalBuitenBereik,
            isBetrouwbaar,
            onopgeloste,
            // Both withheld together (directie 2026-07-28). Withholding only the decided one would let a screen print
            // a ceiling with nothing to compare it against, which reads as the figure rather than as a prospect.
            AantalGedekt: isBetrouwbaar ? nuGedekt : null,
            AantalMogelijkGedekt: isBetrouwbaar ? mogelijkGedekt : null,
            scope.Leerplandoelen.Count);
    }

    /// <summary>
    /// Why an uncovered goal is uncovered, and which thema's a teacher would act on (E5-05). See
    /// <see cref="Lacuneoorzaak"/> for what each cause means and why the order is the one it is.
    /// <para>
    /// <b>First match wins, and the order is cheapest-route-first rather than arbitrary.</b> A goal can genuinely sit
    /// in several of these states at once — thema A carries it and stands in the plan as a proposal, thema B carries
    /// it and is nowhere — and reporting every route at once would leave a teacher to work out which name goes with
    /// which action. So each cause names only the thema's that belong to <i>it</i>.
    /// </para>
    /// <para>
    /// <b>The first branch is sound only because this method is never called for a covered goal.</b> A decided link on
    /// a thema in <paramref name="voorstelbareThemaIds"/> could in principle be one whose placement is
    /// <c>aanvaard</c>/<c>manueel</c> rather than <c>voorgesteld</c> — but that combination is exactly what makes a
    /// goal covered, so inside a gap it can only be an open proposal. That inference rests on the two storage reads
    /// applying the same layer and status rules, which is stated as a contract on <c>IDekkingOpslag</c> and pinned by
    /// a Postgres test rather than left to hold by inspection.
    /// </para>
    /// </summary>
    private static (Lacuneoorzaak Oorzaak, IReadOnlyList<string> Themas) BepaalOorzaak(
        IReadOnlyList<KandidaatKoppeling> kandidaten,
        IReadOnlySet<Guid> voorstelbareThemaIds,
        IReadOnlySet<Guid> geweigerdeThemaIds)
    {
        var wachtend = Themanamen(kandidaten.Where(k => k.IsBeslist && voorstelbareThemaIds.Contains(k.ThemaId)));

        if (wachtend.Count > 0)
        {
            return (Lacuneoorzaak.WachtOpBeslissing, wachtend);
        }

        var geweigerd = Themanamen(kandidaten.Where(k => k.IsBeslist && geweigerdeThemaIds.Contains(k.ThemaId)));

        if (geweigerd.Count > 0)
        {
            return (Lacuneoorzaak.PlaatsingGeweigerd, geweigerd);
        }

        var ongepland = Themanamen(kandidaten.Where(k => k.IsBeslist));

        if (ongepland.Count > 0)
        {
            return (Lacuneoorzaak.NietIngepland, ongepland);
        }

        // Everything left is an undecided link, because the read excludes rejected ones and the three branches above
        // took every decided one. Written as "all that remain" rather than as `!k.IsBeslist` so the four branches
        // provably partition the input: a fourth link state added to the read later would surface here as a
        // misclassification rather than silently vanish between two negated filters.
        var onbeslist = Themanamen(kandidaten);

        return onbeslist.Count > 0
            ? (Lacuneoorzaak.KoppelingNietBeslist, onbeslist)
            : (Lacuneoorzaak.GeenThema, []);
    }

    /// <summary>
    /// The distinct thema names of the given links, ordinally ordered — the same ordering rule the covering evidence
    /// list uses, so the two lines a teacher reads on this screen sort their names the same way.
    /// </summary>
    private static IReadOnlyList<string> Themanamen(IEnumerable<KandidaatKoppeling> kandidaten) =>
        kandidaten
            .Select(k => k.ThemaNaam)
            .Distinct(StringComparer.Ordinal)
            .OrderBy(naam => naam, StringComparer.Ordinal)
            .ToList();

    /// <summary>
    /// The distinct thema's placed in a real period of this plan whose placement status satisfies
    /// <paramref name="teltMee"/>. Stale placements are excluded here rather than per caller, because "sits in no
    /// period" disqualifies a placement under every predicate this service applies.
    /// </summary>
    private static IReadOnlyList<Guid> Themaplaatsingen(JaarplanWeergave plan, Func<string, bool> teltMee) =>
        plan.Plaatsingen
            .Where(p => !p.IsVervallen && teltMee(p.Status))
            .Select(p => p.ThemaId)
            .Distinct()
            .ToList();

    /// <summary>
    /// How many of <paramref name="leerplandoelen"/> at least one of <paramref name="themaIds"/> carries a counting
    /// link to. Counted over the in-scope goals rather than over the links, so a link pointing at a goal outside the
    /// scope cannot inflate the figure past its own denominator.
    /// </summary>
    private async Task<int> TelGedekteDoelenAsync(
        Guid klasId,
        IReadOnlyList<Guid> themaIds,
        IReadOnlyList<Leerplandoel> leerplandoelen,
        CancellationToken cancellationToken)
    {
        if (themaIds.Count == 0)
        {
            return 0;
        }

        var koppelingen = await _opslag.HaalDekkendeKoppelingenAsync(klasId, themaIds, cancellationToken);

        var gedekteCodes = koppelingen
            .Select(k => k.LeerplandoelCode)
            .ToHashSet(StringComparer.Ordinal);

        return leerplandoelen.Count(l => gedekteCodes.Contains(l.Code));
    }

    /// <summary>
    /// How many stale placements are still <b>unresolved</b> — stale and not rejected. One implementation, read by the
    /// dekking figure and by the vooruitzicht, because the two must withhold their numbers in exactly the same states.
    /// </summary>
    private static int TelOnopgelosteVervallen(JaarplanWeergave plan) =>
        plan.Plaatsingen.Count(p => p.IsVervallen && !IsGeweigerd(p.Status));

    /// <summary>
    /// Resolves which leerplandoelen this class is measured against (owner ruling 2026-08-04) and reads them.
    /// <para>
    /// The fallback direction is the load-bearing part. <c>Jaarfasen.VoorLeerjaar</c> returns <c>null</c> rather than
    /// an empty list when it cannot map the leerjaar (a graadklas ordinal, or a class deleted mid-computation),
    /// because an empty jaar/fase set means "the whole curriculum" one layer down and "no goals at all" to a reader.
    /// The second would report a class as having nothing left to cover. So a refusal <b>widens</b> the scope and is
    /// declared in the payload; it never narrows it.
    /// </para>
    /// </summary>
    private async Task<Bereikuitkomst> BepaalBereikAsync(
        Guid klasId,
        Dekkingsbereik bereik,
        string? jaarFase,
        CancellationToken cancellationToken)
    {
        var beschikbareFasen = bereik == Dekkingsbereik.EigenJaarFase
            ? await BepaalEigenJaarFasenAsync(klasId, cancellationToken)
            : null;

        var isTerugval = bereik == Dekkingsbereik.EigenJaarFase && beschikbareFasen is null;

        // The teacher's narrowing, and it is a filter over what this class HAS rather than free choice: a kleutergroep
        // may narrow JK+K2+K3 to K3, and nobody may narrow an L3 class to L6. `Contains` is ordinal, matching the rest
        // of the jaar/fase comparisons: stored codes are canonical (owner ruling 2026-08-03, the import normalises), so
        // folding case here would only mask an import that did not.
        var gemetenFasen = beschikbareFasen is { Count: > 1 } && jaarFase is not null
            && beschikbareFasen.Contains(jaarFase, StringComparer.Ordinal)
                ? (IReadOnlyList<string>)[jaarFase]
                : beschikbareFasen;

        var leerplandoelen = await _opslag.HaalLeerplandoelenAsync(gemetenFasen, cancellationToken);

        // How many loaded goals the scope leaves out, so a caller can say so instead of quietly reporting a smaller
        // denominator (a narrower scope makes coverage look better, the one direction this figure must not move by
        // itself). Only asked when a scope was actually applied: unscoped, the list IS the total.
        //
        // Clamped at zero because the count and the list are two reads: an import landing between them could
        // otherwise yield a negative "left out" figure, which is a nonsense number rather than a small one.
        var aantalBuitenBereik = gemetenFasen is null
            ? 0
            : Math.Max(0, await _opslag.TelAlleLeerplandoelenAsync(cancellationToken) - leerplandoelen.Count);

        return new Bereikuitkomst(
            // What was APPLIED, not what was asked for. A fallback reports HeelCurriculum because that is what the
            // figures are over; IsTerugval is what says the caller did not choose it.
            isTerugval ? Dekkingsbereik.HeelCurriculum : bereik,
            gemetenFasen,
            beschikbareFasen,
            isTerugval,
            aantalBuitenBereik,
            leerplandoelen);
    }

    /// <summary>The resolved denominator and everything a payload has to state about how it was arrived at.</summary>
    private sealed record Bereikuitkomst(
        Dekkingsbereik ToegepastBereik,
        IReadOnlyList<string>? GemetenFasen,
        IReadOnlyList<string>? BeschikbareFasen,
        bool IsTerugval,
        int AantalBuitenBereik,
        IReadOnlyList<Leerplandoel> Leerplandoelen);

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
    /// Whether a placement could still <b>become</b> covering: the decided ones, plus the proposals the teacher has
    /// not answered yet (E3-03). Used only by <see cref="BerekenVooruitzichtAsync"/>; the dekking figure itself never
    /// counts a <c>voorgesteld</c> placement, which is Art. IV.1.
    /// <para>
    /// Written as "counts already, or is an open proposal" rather than as "not rejected", deliberately. The two are
    /// equivalent for the four known statuses and they differ on an <b>unrecognised</b> one: "not rejected" would let
    /// a status this code cannot read raise the ceiling, while this direction leaves it out, matching
    /// <see cref="TeltVoorDekking"/>'s fail-closed rule. A number we cannot justify is worse than a lower one.
    /// </para>
    /// </summary>
    private static bool IsVoorstelbaar(string status) =>
        TeltVoorDekking(status)
        || (Enum.TryParse<KoppelingStatus>(status, out var geparsed) && geparsed == KoppelingStatus.Voorgesteld);

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
