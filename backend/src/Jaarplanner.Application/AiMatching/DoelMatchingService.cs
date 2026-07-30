using Jaarplanner.Application.Ai;
using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Application.AiMatching.Response;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// The AI goal-matching service (FR-4). It wires the E2 pipeline end-to-end behind three injectable
/// seams — the <see cref="IAiClient"/> (E2-01), the <see cref="IDoelMatchOpslag"/> persistence port
/// (E2-04) and the read-only <see cref="ILeerdoelCatalogus"/> curriculum query (E2-07) — so the whole
/// flow runs against fakes with <b>no network and no database</b> in tests (Art. IV.6). The flow for a
/// thema is:
/// <list type="number">
/// <item>resolve the candidate Op.stap leerplandoelen for the caller's selection (E2-08);</item>
/// <item>build the grounded prompt from the school thema + those goals (E2-02, Art. IV.4);</item>
/// <item>call the model through the injected client (E2-01);</item>
/// <item>parse + validate the raw completion against the structured-JSON contract (E2-03, Art. IV.5);</item>
/// <item>persist each validated suggestion as a <c>DoelKoppeling</c> with status <c>voorgesteld</c>
/// and the AI motivation (Art. IV.2) — advisory only, never auto-applied (Art. IV.1).</item>
/// </list>
/// If the response is invalid, <b>nothing is persisted</b> and the failure is surfaced (Art. IV.5).
/// A returned code that is not in the loaded leerplandoel set is skipped, never fabricated
/// (Art. III.5/IV.4).
/// <para>
/// <b>E2-08 added step 1 and, with it, the reachable entry point.</b> Until then the only caller of
/// <see cref="MatchThemaAsync"/> in the whole repository was its own unit test: the parameterised
/// overload demands a candidate set, and nothing in a running application supplied one. That overload
/// stays (it is the pure core, and what the tests drive), but
/// <see cref="GenereerSuggestiesAsync"/> is the entry point a controller can actually call.
/// </para>
/// <para>
/// <b>Case policy — the split is deliberate, and it is a split.</b> A leerplandoel code is a decreed
/// identifier (Art. III.5), so who supplies it decides how strictly it is read:
/// <list type="bullet">
/// <item><b>Strict (ordinal) where the AI supplies the code</b> — <c>perCode</c> and the loop over
/// <c>parse.Suggesties</c> in <see cref="MatchThemaAsync"/>. A model that answers <c>nat-k3-01</c> for
/// <c>NAT-K3-01</c> has altered curriculum identity; case-folding that away would let the AI decide what
/// counts as the same goal. The answer is skipped and reported, never repaired.</item>
/// <item><b>Lenient (ordinal-ignore-case) where a human types the code</b> —
/// <see cref="VervangSuggestieDoelAsync"/> via <c>ZoekIngetypteLeerdoelAsync</c>, matching the
/// <see cref="ILeerdoelCatalogus"/> contract. A teacher typing <c>nat-k3-01</c> into a free-text field is
/// naming a goal, not redefining one, and refusing it would tell them a code they can see does not exist.
/// The <b>canonical</b> <c>doel.Code</c> is what gets stored either way.</item>
/// <item><b>Strict, and never refusing, where the code comes back off a stored link</b> —
/// <see cref="WijzigSuggestieStatusAsync"/> via <c>ZoekGekoppeldLeerdoelAsync</c>. Two methods rather than one
/// with a flag, so which lookup a caller picks is what decides whether an ambiguous code can be refused:
/// the status path has already persisted the teacher's decision by the time it needs the goal's text, so it
/// must not be able to fail there.</item>
/// </list>
/// Consequence worth naming: the same string can be skipped on the AI path and accepted one field below on
/// the substitution path. That is intended, and the run report's copy is worded so it does not claim the
/// code is absent from Op.stap — only that it was not resolvable.
/// <br/>
/// (A third site, <c>SchoolcontentBeheerService.VereisLeerplandoelAsync</c>, is exact-match as well; it
/// resolves codes arriving in an import/API payload rather than from this flow, and E2-08 left its policy
/// untouched rather than change a path it does not own.)
/// </para>
/// </summary>
public sealed class DoelMatchingService
{
    private readonly IAiClient _aiClient;
    private readonly IDoelMatchOpslag _opslag;
    private readonly ILeerdoelCatalogus _catalogus;

    /// <summary>Constructs the service around the injected AI client, persistence port and curriculum query (DI / tests).</summary>
    public DoelMatchingService(IAiClient aiClient, IDoelMatchOpslag opslag, ILeerdoelCatalogus catalogus)
    {
        ArgumentNullException.ThrowIfNull(aiClient);
        ArgumentNullException.ThrowIfNull(opslag);
        ArgumentNullException.ThrowIfNull(catalogus);
        _aiClient = aiClient;
        _opslag = opslag;
        _catalogus = catalogus;
    }

    /// <summary>
    /// Runs a match for a thema over the leerplandoelen the given <paramref name="selectie"/> resolves to
    /// (E2-08, FR-4.1) — the callable trigger behind <c>POST …/doelsuggesties/genereer</c>.
    /// <para>
    /// <paramref name="selectie"/> is <b>optional and comes from the caller</b>; <c>null</c> resolves to
    /// <see cref="LeerdoelSelectie.Alles"/>. That default lives here, in one documented place, rather than
    /// as a literal buried in a controller, because "which disciplines first" is an open Art. XIV decision:
    /// the run's scope must stay the teacher's visible, per-run choice. The resulting candidate count is
    /// reported back in <see cref="DoelMatchResultaat.AantalKandidaten"/> so the scope is observable.
    /// </para>
    /// <para>
    /// Minimumdoelen are <b>not</b> passed as extra grounding: no <c>Minimumdoel</c> row can exist yet
    /// (the decreed-minimumdoelen import is E1-12, blocked on the source file), so requesting them would be
    /// dead code pretending to be a feature. The concordance still reaches minimumdoel level through each
    /// leerplandoel's own <c>minimumdoelRef</c>, which the prompt already carries.
    /// </para>
    /// </summary>
    /// <exception cref="ThemaNietGevondenFout">The thema does not exist.</exception>
    public async Task<DoelMatchResultaat> GenereerSuggestiesAsync(
        Guid themaId,
        LeerdoelSelectie? selectie = null,
        CancellationToken cancellationToken = default)
    {
        var leerdoelen = await _catalogus.HaalLeerdoelenAsync(selectie ?? LeerdoelSelectie.Alles, cancellationToken);
        return await MatchThemaAsync(themaId, leerdoelen, minimumdoelen: null, cancellationToken);
    }

    /// <summary>
    /// Runs the end-to-end match for a thema and persists the validated suggestions as
    /// <c>voorgesteld</c> <c>DoelKoppeling</c> rows (E2-04). Never auto-accepts (Art. IV.1/IV.2).
    /// <para>
    /// An <b>empty</b> <paramref name="leerdoelen"/> short-circuits: the model is not called and the run
    /// reports success with <c>AantalKandidaten = 0</c>. Nothing could be proposed from an empty set, so a
    /// call would only spend a request to have every answer discarded as an unknown code.
    /// </para>
    /// </summary>
    /// <param name="themaId">The thema to match (loaded via the persistence port).</param>
    /// <param name="leerdoelen">The relevant, already-loaded Op.stap leerplandoelen to choose from — the grounding + the resolvable set.</param>
    /// <param name="minimumdoelen">Optional concorded minimumdoelen for extra grounding context.</param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <returns>A success result (with what was persisted/skipped) or an explicit failure — nothing persisted on failure.</returns>
    /// <exception cref="ThemaNietGevondenFout">The thema does not exist.</exception>
    public async Task<DoelMatchResultaat> MatchThemaAsync(
        Guid themaId,
        IReadOnlyCollection<Leerplandoel> leerdoelen,
        IReadOnlyCollection<Minimumdoel>? minimumdoelen = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(leerdoelen);

        var thema = await _opslag.LaadThemaAsync(themaId, cancellationToken)
            ?? throw new ThemaNietGevondenFout($"Thema {themaId} bestaat niet.");

        // Only codes that actually exist in the loaded set are resolvable — never fabricate (Art. III.5/IV.4).
        // Indexed rather than a bare HashSet so a persisted suggestion can be enriched with the goal's own
        // text/doelsoort for the review row (FR-4.2) without a second query.
        //
        // `Ordinal` here is deliberate and is NOT the same policy as `ZoekIngetypteLeerdoelAsync` below — see
        // "Case policy" on this class. A model that returns `nat-k3-01` for `NAT-K3-01` has altered a decreed
        // identifier, and accepting the alteration would let the AI reshape curriculum identity (Art. III.5).
        // The answer is skipped and named in the run report, not silently repaired.
        var perCode = leerdoelen
            .GroupBy(d => d.Code, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.Ordinal);

        // No candidates ⇒ no suggestion is even possible, so the model is NOT called: an empty prompt list
        // can only produce answers that all get skipped as unknown, at the cost of a real AI call. Reported
        // as a successful run with 0 kandidaten, which the UI distinguishes from "the AI found nothing" —
        // today the realistic cause is that no Op.stap import has run yet (E1-15), not a bad model.
        if (perCode.Count == 0)
        {
            return DoelMatchResultaat.Geslaagd([], [], [], aantalKandidaten: 0);
        }

        // 1–3: build the grounded prompt, call the model, validate the raw completion (E2-02/01/03).
        var request = MatchingPromptBuilder.Bouw(thema, leerdoelen, minimumdoelen);
        var completion = await _aiClient.CompleteAsync(request, cancellationToken);
        var parse = DoelMatchResponseParser.Parse(completion);

        // On any invalid/malformed output: persist NOTHING and surface the failure (Art. IV.5). No retry and
        // no second attempt on "poor" content either — judging quality is the teacher's job (Art. IV.1/IV.7).
        if (!parse.IsGeldig)
        {
            return DoelMatchResultaat.Mislukt(parse.Fout!, perCode.Count);
        }

        var bewaard = new List<DoelMatchSuggestieWeergave>();
        var onbekend = new List<string>();
        var duplicaat = new List<string>();

        foreach (var suggestie in parse.Suggesties)
        {
            // Exact match only (see "Case policy"). `onbekend` therefore means "not resolvable in this run's
            // candidate set" — which is not the same claim as "this code does not exist in Op.stap", and the
            // UI copy for it must not overstate it (`matching.onbekendeCodes`).
            if (!perCode.TryGetValue(suggestie.Code, out var doel))
            {
                onbekend.Add(suggestie.Code);
                continue;
            }

            // Idempotent: skip a code already linked (existing suggestion or curated themadoel).
            if (thema.IsAlGekoppeldAan(suggestie.Code))
            {
                duplicaat.Add(suggestie.Code);
                continue;
            }

            // 4: persist as `voorgesteld` + aiMotivatie — advisory, never auto-applied (Art. IV.1/IV.2).
            var koppeling = thema.VoegDoelsuggestieToe(
                new DoelKoppeling(suggestie.Code, KoppelingStatus.Voorgesteld, suggestie.Motivatie));
            bewaard.Add(MapSuggestie(koppeling, doel));
        }

        // Persist only when there is something to persist (a valid all-duplicate/all-unknown run
        // changes nothing, so it needs no unit of work).
        if (bewaard.Count > 0)
        {
            await _opslag.BewaarAsync(cancellationToken);
        }

        return DoelMatchResultaat.Geslaagd(bewaard, onbekend, duplicaat, perCode.Count);
    }

    /// <summary>
    /// The query path (FR-4.1/4.2): the AI match suggestions persisted for a thema. Read-only.
    /// </summary>
    public Task<IReadOnlyList<DoelMatchSuggestieWeergave>> HaalSuggestiesVoorThemaAsync(
        Guid themaId,
        CancellationToken cancellationToken = default) =>
        _opslag.HaalSuggestiesVoorThemaAsync(themaId, cancellationToken);

    /// <summary>
    /// Records a teacher decision on one persisted doelsuggestie (E2-05, FR-4.3): accept
    /// (<see cref="KoppelingStatus.Aanvaard"/>), reject (<see cref="KoppelingStatus.Geweigerd"/>) or
    /// adjust/curate (<see cref="KoppelingStatus.Manueel"/>). The teacher is the only actor that moves a
    /// suggestion off <c>voorgesteld</c>; the AI never auto-applies (Art. IV.1/IV.2). The new status is
    /// persisted through the store so it survives a reload and is the exact value E5 coverage reads
    /// (<c>aanvaard</c>/<c>manueel</c> count toward dekking; <c>voorgesteld</c>/<c>geweigerd</c> do not).
    /// </summary>
    /// <param name="themaId">The thema the suggestion belongs to.</param>
    /// <param name="suggestieId">The doelsuggestie (<c>DoelKoppeling</c>) to decide on.</param>
    /// <param name="status">The teacher decision — must be <c>aanvaard</c>, <c>geweigerd</c> or <c>manueel</c>.</param>
    /// <param name="cancellationToken">Cancels the operation.</param>
    /// <returns>The updated read view of the suggestion.</returns>
    /// <exception cref="OngeldigeSuggestieStatusFout"><paramref name="status"/> is not a teacher decision (e.g. <c>voorgesteld</c>).</exception>
    /// <exception cref="ThemaNietGevondenFout">The thema does not exist.</exception>
    /// <exception cref="DoelsuggestieNietGevondenFout">The thema has no suggestion with that id.</exception>
    public async Task<DoelMatchSuggestieWeergave> WijzigSuggestieStatusAsync(
        Guid themaId,
        Guid suggestieId,
        KoppelingStatus status,
        CancellationToken cancellationToken = default)
    {
        // The teacher may only accept / reject / adjust — `voorgesteld` is AI-only (Art. IV.1/IV.2).
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd or KoppelingStatus.Manueel))
        {
            throw new OngeldigeSuggestieStatusFout(
                $"Status '{status}' is geen leerkrachtbeslissing; kies aanvaard, geweigerd of manueel (Art. IV.1/IV.2).");
        }

        var thema = await _opslag.LaadThemaAsync(themaId, cancellationToken)
            ?? throw new ThemaNietGevondenFout($"Thema {themaId} bestaat niet.");

        var koppeling = thema.Doelsuggesties.FirstOrDefault(k => k.Id == suggestieId)
            ?? throw new DoelsuggestieNietGevondenFout($"Doelsuggestie {suggestieId} bestaat niet op thema {themaId}.");

        // Human-in-the-loop decision recorded on the domain entity, then persisted (Art. IV.2 — survives reload).
        koppeling.WijzigStatus(status);
        await _opslag.BewaarAsync(cancellationToken);

        // `ZoekGekoppeld…` and not `ZoekIngetypte…`: the decision is already committed one line up, so this
        // lookup is not allowed to fail the request. It resolves to null at worst — see the note on that method.
        return MapSuggestie(koppeling, await ZoekGekoppeldLeerdoelAsync(koppeling.LeerplandoelCode, cancellationToken));
    }

    /// <summary>
    /// FR-4.3's third action, <b>"aanpassen"</b> (E2-08): the teacher substitutes a <i>different</i>
    /// leerplandoel on the suggestion — "the AI proposed this doel; I think it should be that one". The link
    /// keeps its identity, points at the new code and lands as <see cref="KoppelingStatus.Manueel"/>, which is
    /// what that status means (a link the human chose). The AI motivation is dropped with the old code, since it
    /// motivated that goal and not this one (Art. IV.3).
    /// <para>
    /// The replacement must be a code the <b>read-only</b> Op.stap set actually carries — resolved through
    /// <see cref="ILeerdoelCatalogus"/>, never invented (Art. III.1/III.5) — and must not already be linked to
    /// this thema, which would give one doel two links and double-count it in dekking (Art. V). Nothing about
    /// the curriculum row is written; only the school's own link changes (Art. III.1).
    /// </para>
    /// <para>
    /// <b>The reading of "aanpassen" this implements is recorded as reversible</b> (E2-05 note, 2026-07-28): if
    /// directie reads "aanpassen" as merely overriding the AI's verdict, the pre-existing status-to-<c>manueel</c>
    /// action already satisfied FR-4.3 and this is an extra. Both are offered, so the ruling costs no rework.
    /// </para>
    /// </summary>
    /// <exception cref="OngeldigeDoelsubstitutieFout">The replacement code is blank, unknown, unchanged, already linked, or matches more than one goal case-insensitively.</exception>
    /// <exception cref="ThemaNietGevondenFout">The thema does not exist.</exception>
    /// <exception cref="DoelsuggestieNietGevondenFout">The thema has no suggestion with that id.</exception>
    public async Task<DoelMatchSuggestieWeergave> VervangSuggestieDoelAsync(
        Guid themaId,
        Guid suggestieId,
        string nieuweLeerplandoelCode,
        CancellationToken cancellationToken = default)
    {
        var code = nieuweLeerplandoelCode?.Trim() ?? string.Empty;
        if (code.Length == 0)
        {
            throw new OngeldigeDoelsubstitutieFout("Geef de code van het leerplandoel dat je in de plaats wil koppelen.");
        }

        var thema = await _opslag.LaadThemaAsync(themaId, cancellationToken)
            ?? throw new ThemaNietGevondenFout($"Thema {themaId} bestaat niet.");

        var koppeling = thema.Doelsuggesties.FirstOrDefault(k => k.Id == suggestieId)
            ?? throw new DoelsuggestieNietGevondenFout($"Doelsuggestie {suggestieId} bestaat niet op thema {themaId}.");

        // Read-only curriculum lookup: a link may only ever point at a real Op.stap code (Art. III.5).
        var doel = await ZoekIngetypteLeerdoelAsync(code, cancellationToken)
            ?? throw new OngeldigeDoelsubstitutieFout(
                $"Leerplandoel '{code}' zit niet in de geladen Op.stap-leerplandoelen.");

        if (string.Equals(koppeling.LeerplandoelCode, doel.Code, StringComparison.Ordinal))
        {
            throw new OngeldigeDoelsubstitutieFout(
                $"Leerplandoel '{doel.Code}' is al het doel van deze suggestie; kies een ander leerplandoel.");
        }

        if (thema.IsAlGekoppeldAan(doel.Code))
        {
            throw new OngeldigeDoelsubstitutieFout(
                $"Leerplandoel '{doel.Code}' is al aan dit thema gekoppeld.");
        }

        koppeling.VervangLeerplandoel(doel.Code);
        await _opslag.BewaarAsync(cancellationToken);

        return MapSuggestie(koppeling, doel);
    }

    // ── Two code lookups, and deliberately two *methods* rather than one with a flag: which method a caller
    // reaches for is what decides whether an ambiguous code may be refused, so the rule lives in the signature
    // instead of in a comment a later edit can drift away from. Only the "ingetypte" lookup can throw.

    // The code a TEACHER typed (VervangSuggestieDoelAsync) — the lenient half of the "Case policy" on this
    // class. An Ordinal-only check here would throw away a row the catalogus just returned and tell the teacher
    // the code "zit niet in de geladen Op.stap-leerplandoelen" when it does. What gets stored is always the
    // curriculum's own `doel.Code`, so the link still carries the canonical Op.stap code (Art. III.5).
    //
    // `Leerplandoel.Code` is a case-SENSITIVE primary key, so `NAT-K3-01` and `nat-k3-01` could legally coexist
    // as two distinct goals. There is no evidence Op.stap does that, but if it ever did, silently binding the
    // link to whichever row sorted first would be the tool guessing at goal identity — the one thing Art. III.5
    // forbids. So: an exact (ordinal) hit wins outright; otherwise the case-insensitive match must be unique,
    // and an ambiguous one is refused with a message rather than resolved by luck. Refusing is safe *here*
    // because this method runs before anything is written.
    private async Task<Leerplandoel?> ZoekIngetypteLeerdoelAsync(string code, CancellationToken cancellationToken)
    {
        var doelen = await HaalOpCodeAsync(code, cancellationToken);

        var exact = doelen.FirstOrDefault(d => string.Equals(d.Code, code, StringComparison.Ordinal));
        if (exact is not null)
        {
            return exact;
        }

        var kandidaten = doelen
            .Where(d => string.Equals(d.Code, code, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (kandidaten.Count > 1)
        {
            throw new OngeldigeDoelsubstitutieFout(
                $"Meerdere leerplandoelen komen overeen met '{code}' als je geen onderscheid maakt tussen " +
                $"hoofd- en kleine letters ({string.Join(", ", kandidaten.Select(d => d.Code))}); " +
                "geef de code exact zoals ze in Op.stap staat.");
        }

        return kandidaten.Count == 1 ? kandidaten[0] : null;
    }

    // The code a LINK already carries (WijzigSuggestieStatusAsync). Exact hit or nothing — and this method
    // cannot throw, which is the whole reason it exists as a separate one. The status path commits the teacher's
    // decision (`BewaarAsync`) *before* it resolves the code to enrich the read view, so a refusal raised here
    // would answer a succeeded operation with a 400 carrying substitution copy: the teacher would read
    // "wijzigen mislukt" about a status change that is already persisted. Unresolvable therefore resolves to
    // `null`, which `MapSuggestie` renders by design (code shown, official text omitted).
    //
    // Exact-only is also the honest match for this input: a persisted code is canonical by construction —
    // `MatchThemaAsync` stores only exact hits from the candidate set, and `VervangLeerplandoel` stores the
    // catalogus' own `doel.Code`. But that is a property of today's writers, not of this method, so the method
    // no longer depends on it: if the canonical row is ever deleted or re-cased, this returns null instead of
    // guessing at identity (Art. III.5) or refusing too late to matter.
    private async Task<Leerplandoel?> ZoekGekoppeldLeerdoelAsync(string code, CancellationToken cancellationToken) =>
        (await HaalOpCodeAsync(code, cancellationToken))
            .FirstOrDefault(d => string.Equals(d.Code, code, StringComparison.Ordinal));

    // Uses the code dimension of LeerdoelSelectie so both lookups are a targeted read rather than loading the
    // whole curriculum to answer "does this code exist?". The seam itself filters case-insensitively
    // (ILeerdoelCatalogus contract), so the case decision belongs to the callers above, not here.
    private Task<IReadOnlyList<Leerplandoel>> HaalOpCodeAsync(string code, CancellationToken cancellationToken) =>
        _catalogus.HaalLeerdoelenAsync(new LeerdoelSelectie { Codes = [code] }, cancellationToken);

    // The read view. `doel` carries the official text + doelsoort so the teacher judges the goal itself and not
    // an opaque code (FR-4.2); it is null only when the code cannot be resolved, which is shown, never hidden.
    private static DoelMatchSuggestieWeergave MapSuggestie(DoelKoppeling koppeling, Leerplandoel? doel) =>
        new(koppeling.Id,
            koppeling.LeerplandoelCode,
            koppeling.Status.ToString(),
            koppeling.AiMotivatie,
            doel?.Tekst,
            doel?.Doelsoort);
}
