using System.Globalization;
using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Planning.Generatie.Response;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The AI jaarplan-generation service (FR-5.1). It wires the plan-generation pipeline end-to-end behind three
/// injectable seams — the <c>IAiClient</c> (E2-01), the <see cref="IPlanningsblokIndeling"/> grid seam (E3-05) and
/// the <see cref="IJaarplanOpslag"/> persistence port — so the whole flow runs against fakes with <b>no network
/// and no database</b> in tests (Art. IV.6). For one class:
/// <list type="number">
/// <item>load the class and the <see cref="Schooljaar"/> that contains it (Art. IX.3);</item>
/// <item><b>ask the seam</b> for that year's planningsblokken — never derive or assume them here, and never a
/// month (Art. IX.3, ADR-0013/0020);</item>
/// <item>build the grounded prompt from the class, those blocks and the school's own thema's (Art. IV.4);</item>
/// <item>call the model through the injected client;</item>
/// <item>parse + validate the completion against the structured-JSON contract (Art. IV.5);</item>
/// <item>persist each validated placement as a <see cref="Themaplaatsing"/> with status
/// <see cref="KoppelingStatus.Voorgesteld"/> and the AI motivation — a <b>proposal</b>, never auto-applied
/// (Art. IV.1/IV.2/IV.3).</item>
/// </list>
/// <para>
/// <b>Invalid response ⇒ nothing persisted.</b> Not even the placements that parsed: a half-applied year plan
/// hides which half the model got wrong, and Art. IV.5 requires validation before use, not after.
/// </para>
/// <para>
/// <b>A returned block start date is resolved against the derived grid, never snapped.</b> If the model answers
/// with a date that is not the start of any current block, that placement is skipped and reported. Snapping it to
/// the nearest block would put a thema in a period nobody chose; inventing a block would contradict "blocks are
/// derived, never stored".
/// </para>
/// <para>
/// <b>Regeneration respects <c>vergrendeld</c> and every human decision</b> (Art. IX.3, Art. IV.1). A run clears
/// only the placements that are <see cref="Themaplaatsing.IsVervangbaar"/> — untouched, unlocked proposals — and
/// leaves accepted/rejected/manual and locked ones exactly where they are. E4 extends this to a single period; the
/// rule lives here because a generator that overwrote a locked thema would make the flag decorative.
/// </para>
/// <para>
/// <b>Regeneration also honours the class's kept pre-generation parameters</b> (E3-04, FR-5.4/FR-8, owner ruling
/// 2026-07-30). A run that is handed no parameters reads the stored ones, so a period the teacher marked as bezet stays
/// bezet on the next run instead of quietly getting a thema back. That behaviour lives here, on the single generation
/// path, precisely so E4-04/E4-05 inherit it rather than having to add it.
/// </para>
/// </summary>
public sealed class JaarplanGeneratieService
{
    /// <summary>
    /// The tier a generated thema is placed on. A thema runs 4–6 weeks (Art. IX.2/IX.3), which is exactly the
    /// themaperiode, so generation places on the coarse tier; the fine tier is for subthema's and is E3-02's and
    /// later stories' concern. <see cref="Themaplaatsing.BlokNiveau"/> is persisted per placement, so that
    /// extension needs no schema change.
    /// </summary>
    public const Planningsblokniveau GeneratieNiveau = Planningsblokniveau.Themaperiode;

    private readonly IAiClient _aiClient;
    private readonly IPlanningsblokIndeling _indeling;
    private readonly IJaarplanOpslag _opslag;

    /// <summary>Constructs the service around its three injected seams (DI / tests).</summary>
    public JaarplanGeneratieService(IAiClient aiClient, IPlanningsblokIndeling indeling, IJaarplanOpslag opslag)
    {
        ArgumentNullException.ThrowIfNull(aiClient);
        ArgumentNullException.ThrowIfNull(indeling);
        ArgumentNullException.ThrowIfNull(opslag);

        _aiClient = aiClient;
        _indeling = indeling;
        _opslag = opslag;
    }

    /// <summary>
    /// Generates a plan proposal for one class and persists it as <c>voorgesteld</c> placements (FR-5.1,
    /// Art. IV.1/IV.2/IV.5). Never auto-applies, and persists nothing when the response is invalid.
    /// </summary>
    /// <param name="klasId">The class to generate for.</param>
    /// <param name="parameters">
    /// What the teacher asked for before the run (FR-5.4) — gewenste startthema's and vaste momenten.
    /// <para>
    /// <b>Supplying a value <i>replaces</i> the class's kept settings; supplying <c>null</c> <i>reads</i> them.</b>
    /// That is what makes an FR-8/E4 regeneration honour a period the teacher marked as bezet instead of quietly
    /// giving it a thema back (owner ruling, 2026-07-30): the generation path is the only path, so E4 inherits the
    /// behaviour rather than having to bolt it on. An explicitly <b>empty</b> value therefore clears the settings,
    /// which is the only way to clear them given there is deliberately no separate "Bewaren" control.
    /// </para>
    /// <para>
    /// Vakanties are deliberately not accepted here; see <see cref="JaarplanGeneratieParameters"/> for why the
    /// schooljaar remains their single source of truth.
    /// </para>
    /// </param>
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <returns>A success result carrying the reviewable plan, or an explicit failure with nothing persisted.</returns>
    /// <exception cref="SchoolcontentNietGevondenFout">The class does not exist.</exception>
    public async Task<JaarplanGeneratieResultaat> GenereerAsync(
        Guid klasId,
        JaarplanGeneratieParameters? parameters = null,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);

        // Validate, then PERSIST, then call the model — in that order, and the order is the requirement.
        // Model binding has already rejected a malformed body — a vast moment without `blokkeertPlaatsing`, a missing
        // `gewensteStartthemas`/`vasteMomenten` array, or two preferences for one period are each a 400 — so nothing
        // invalid and nothing ambiguous is stored; and because the settings are committed before the AI call, a failed
        // generation cannot cost the teacher the input they just typed. This environment has no AzureAI:ApiKey, so that
        // failure is the common case rather than a hypothetical one.
        parameters = parameters is null
            ? await LaadBewaardeParametersAsync(klasId, schooljaar.Id, cancellationToken)
            : await BewaarParametersAsync(klasId, schooljaar.Id, parameters, cancellationToken);

        // The grid comes from the seam. Nothing here knows how long a period is, or that periods exist at all
        // beyond "the seam returned these" (Art. IX.3 — never assume months).
        var blokken = _indeling.Blokken(schooljaar, GeneratieNiveau);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        var request = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, blokken, themas, parameters);
        var completion = await _aiClient.CompleteAsync(request, cancellationToken);
        var parse = JaarplanGeneratieResponseParser.Parse(completion);

        // On any invalid/malformed output: persist NOTHING and surface the failure (Art. IV.5). Note this happens
        // before the plan is touched, so a failed run cannot even have cleared the previous proposal.
        if (!parse.IsGeldig)
        {
            return JaarplanGeneratieResultaat.Mislukt(parse.Fout!);
        }

        var jaarplan = await LaadOfMaakJaarplanAsync(klasId, cancellationToken);

        // Clear the superseded proposal; keep everything locked or decided on by a human (Art. IX.3 / IV.1).
        // Count what the run DISCARDS, not just what it keeps. The superseded proposal is deleted here and
        // persisted below, so a run that then places nothing has still changed the plan — and telling a teacher
        // "er is niets gewijzigd" in that case would be false about their own data.
        var vervangen = jaarplan.VerwijderVervangbarePlaatsingen().Count;
        var behouden = jaarplan.Plaatsingen.Count;

        // Resolvable sets. A name/date outside them is skipped, never fabricated (Art. IV.4).
        var themaPerNaam = themas
            .GroupBy(t => t.Naam, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var blokStarts = blokken.Select(b => b.Start).ToHashSet();

        // Resolve every vast moment to the block that CONTAINS its date (FR-5.4). A date is resolved against the grid
        // rather than supplied as a block key, so a teacher never has to know where a boundary falls; and a date in a
        // vakantie or outside the year belongs to no block at all, which is reported rather than ignored — a teacher
        // who blocked a period and saw nothing refused would otherwise assume it had been honoured.
        //
        // EVERY moment is reported, resolved or not, blocking or not. An earlier revision kept only the first name per
        // period, so a second moment in the same period vanished from the report with no evidence it had been parsed —
        // the same defect OnplaatsbareVasteMomenten exists to prevent, one case over.
        var geblokkeerdeBlokken = new Dictionary<DateOnly, string>();
        var toegepasteMomenten = new List<VastMomentUitkomst>();
        var onplaatsbareMomenten = new List<VastMomentUitkomst>();
        foreach (var moment in parameters.GenormaliseerdeVasteMomenten())
        {
            var blok = blokken.FirstOrDefault(b => moment.Datum >= b.Start && moment.Datum <= b.Eind);
            if (blok is null)
            {
                onplaatsbareMomenten.Add(
                    new VastMomentUitkomst(moment.Naam, moment.Datum, moment.BlokkeertPlaatsing, BlokStart: null));
                continue;
            }

            toegepasteMomenten.Add(
                new VastMomentUitkomst(moment.Naam, moment.Datum, moment.BlokkeertPlaatsing, blok.Start));

            if (moment.BlokkeertPlaatsing)
            {
                // The refusal sentence names one moment, because one reason explains a refusal; the full list above is
                // what proves both were applied.
                geblokkeerdeBlokken.TryAdd(blok.Start, moment.Naam);
            }
        }

        var onbekendeThemas = new List<string>();
        var onbekendeBlokken = new List<string>();
        var duplicaten = new List<string>();
        var afgewezen = new List<string>();
        var geweigerdDoorVastMoment = new List<GeweigerdePlaatsing>();
        var nieuw = 0;

        foreach (var suggestie in parse.Plaatsingen)
        {
            if (!themaPerNaam.TryGetValue(suggestie.ThemaNaam, out var thema))
            {
                onbekendeThemas.Add(suggestie.ThemaNaam);
                continue;
            }

            if (!blokStarts.Contains(suggestie.BlokStart))
            {
                onbekendeBlokken.Add(Datum(suggestie.BlokStart));
                continue;
            }

            // The enforced half of FR-5.4. The prompt already asked the model to leave this period alone; this is what
            // makes the parameter more than a request. It is NOT placed, and NOT relocated — moving it to a period the
            // teacher never chose is what ADR-0020 forbids for stale placements.
            //
            // But unlike an unknown thema name or an unknown date, this proposal is fully RESOLVABLE: the thema
            // exists, the block exists, and the model gave a motivatie. So the refusal keeps all of it, including the
            // motivation, rather than reusing the drop-and-forget path. Throwing it away would leave a thema planned
            // nowhere, lower the dekking Art. V exists to prove, and give the teacher nothing to act on.
            if (geblokkeerdeBlokken.TryGetValue(suggestie.BlokStart, out var blokkerendMoment))
            {
                geweigerdDoorVastMoment.Add(
                    new GeweigerdePlaatsing(
                        thema.Naam, suggestie.BlokStart, blokkerendMoment, suggestie.Motivatie));
                continue;
            }

            // Idempotent: a placement kept because it was locked/decided is not proposed a second time. A slot the
            // teacher REJECTED is reported separately from a genuine repetition — calling their own rejection a
            // "duplicaat" would blame the AI for a decision the teacher made (see JaarplanGeneratieResultaat).
            var bestaande = jaarplan.VindPlaatsingOp(thema.Id, GeneratieNiveau, suggestie.BlokStart);
            if (bestaande is not null)
            {
                var beschrijving = $"{thema.Naam} @ {Datum(suggestie.BlokStart)}";
                if (bestaande.Status == KoppelingStatus.Geweigerd)
                {
                    afgewezen.Add(beschrijving);
                }
                else
                {
                    duplicaten.Add(beschrijving);
                }

                continue;
            }

            // Persist as `voorgesteld` + motivatie — advisory, never auto-applied (Art. IV.1/IV.2/IV.3).
            jaarplan.VoegPlaatsingToe(
                thema.Id,
                GeneratieNiveau,
                suggestie.BlokStart,
                KoppelingStatus.Voorgesteld,
                suggestie.Motivatie);
            nieuw++;
        }

        await _opslag.BewaarAsync(cancellationToken);

        // Measure what the model actually produced (E3-02, FR-5.2). Deliberately AFTER persisting and with no
        // power to veto: the prompt asks for a good spread, this reports the one that arrived, and the teacher
        // decides (Art. IV.1). Measured over the whole plan — not just this run's additions — because the year a
        // teacher looks at includes the placements they had already accepted or locked.
        // `IsGepland` excludes rejected placements: a geweigerd thema survives regeneration but nothing is
        // taught in that period because of it, so counting it would report a period as used — and possibly as
        // overbelast — on the strength of something the teacher threw out.
        var spreiding = Spreidingsrapport.Meet(
            jaarplan.Plaatsingen.Where(p => p.BlokNiveau == GeneratieNiveau && p.IsGepland),
            blokken,
            themas.ToDictionary(t => t.Id),
            schooljaar);

        // What became of the teacher's parameters (FR-5.4). Measured over the whole plan on the same reasoning as the
        // spreading report, and — like it — carrying no verdict and triggering no retry (Art. IV.1). The enforced
        // half is handed in because only this method knows what it refused; the advisory half is measured against the
        // plan that came back.
        var parameterRapport = parameters.IsLeeg
            ? ParameterRapport.Geen
            : ParameterRapport.Meet(
                parameters,
                jaarplan.Plaatsingen.Where(p => p.BlokNiveau == GeneratieNiveau),
                themas.ToDictionary(t => t.Id),
                blokStarts,
                themas.Select(t => t.Naam).ToHashSet(StringComparer.OrdinalIgnoreCase),
                geblokkeerdeBlokken.Keys.ToHashSet()) with
            {
                GeweigerdDoorVastMoment = geweigerdDoorVastMoment,
                ToegepasteVasteMomenten = toegepasteMomenten,
                OnplaatsbareVasteMomenten = onplaatsbareMomenten,
            };

        return JaarplanGeneratieResultaat.Geslaagd(
            Projecteer(klas, schooljaar, blokken, themas, jaarplan),
            nieuw,
            behouden,
            vervangen,
            onbekendeThemas,
            onbekendeBlokken,
            duplicaten,
            afgewezen,
            spreiding,
            parameterRapport);
    }

    /// <summary>
    /// The class's kept pre-generation settings (E3-04, FR-5.4) — what the form loads so a teacher sees the settings
    /// they last used instead of an empty form every time (owner ruling, 2026-07-30).
    /// <para>
    /// A class with nothing kept yields <see cref="JaarplanGeneratieParameters.Geen"/> rather than a not-found: "no
    /// settings" is a real and common answer, and a 404 would make the form treat a normal state as a failure.
    /// </para>
    /// <para>
    /// <b>Not filtered against the current grid.</b> A kept start thema whose block start no longer exists is returned
    /// as it was stored, so the caller can say so; filtering here would be the silent drop the stale-placement ruling
    /// of 2026-07-28 forbids one layer up.
    /// </para>
    /// </summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class does not exist.</exception>
    public async Task<JaarplanGeneratieParameters> HaalParametersAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        var (_, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);

        return await LaadBewaardeParametersAsync(klasId, schooljaar.Id, cancellationToken);
    }

    /// <summary>
    /// The kept settings of this class in this school year, or <see cref="JaarplanGeneratieParameters.Geen"/>.
    /// </summary>
    private async Task<JaarplanGeneratieParameters> LaadBewaardeParametersAsync(
        Guid klasId,
        Guid schooljaarId,
        CancellationToken cancellationToken)
    {
        var bewaard = await _opslag.LaadGeneratieparametersAsync(klasId, schooljaarId, cancellationToken);

        return bewaard is null ? JaarplanGeneratieParameters.Geen : JaarplanGeneratieParameters.Van(bewaard);
    }

    /// <summary>
    /// Stores what the teacher just submitted as the class's kept settings and returns the normalised set the run will
    /// use, so the prompt, the enforcement and the report all read exactly what was persisted.
    /// <para>
    /// Committed on its own, <b>before</b> the AI call and before the plan is touched: a generation that then fails
    /// leaves the settings saved (the teacher does not retype them) and the plan untouched (Art. IV.5).
    /// </para>
    /// <para>
    /// <b>An empty submission for a class with no row writes no row.</b> The form posts a body on every run once its
    /// query resolves, and for a class with nothing set that body is <c>{[], []}</c> — so without this every class would
    /// get an empty settings row on its first generation, which an earlier version of this comment claimed did not
    /// happen. Nothing is lost by skipping it: no row and an empty row read back identically as
    /// <see cref="JaarplanGeneratieParameters.Geen"/>.
    /// </para>
    /// </summary>
    private async Task<JaarplanGeneratieParameters> BewaarParametersAsync(
        Guid klasId,
        Guid schooljaarId,
        JaarplanGeneratieParameters parameters,
        CancellationToken cancellationToken)
    {
        var (startthemas, vasteMomenten) = parameters.NaarBewaard();

        var bewaard = await _opslag.LaadGeneratieparametersAsync(klasId, schooljaarId, cancellationToken);
        if (bewaard is null)
        {
            // Nothing kept and nothing submitted: no row, and no write at all.
            if (startthemas.Count == 0 && vasteMomenten.Count == 0)
            {
                return JaarplanGeneratieParameters.Geen;
            }

            // Created lazily on the first run that actually sets something.
            var nieuw = new Generatieparameters(klasId, schooljaarId);
            nieuw.Vervang(startthemas, vasteMomenten);

            if (await _opslag.ProbeerGeneratieparametersToeTeVoegenAsync(nieuw, cancellationToken))
            {
                return JaarplanGeneratieParameters.Van(nieuw);
            }

            // A concurrent run created the row between the load above and that insert, and the unique index refused
            // this one. Resolved by taking the winner's row rather than by refusing the request: unlike the duplicate
            // school-year name that SchooljaarBeheerService turns into a 400, this loser's intent is fully satisfiable
            // — it asked for these settings to be kept, and the row it needs now exists. So it writes its own settings
            // into that row: last write wins, exactly as two runs a second apart already behave. Refusing instead would
            // tell a teacher their parameters were invalid because of somebody else's timing.
            bewaard = await _opslag.LaadGeneratieparametersAsync(klasId, schooljaarId, cancellationToken)
                ?? throw new InvalidOperationException(
                    $"Insert of the kept settings for klas {klasId} in schooljaar {schooljaarId} was refused as a " +
                    "duplicate, but no existing row could be loaded.");
        }

        bewaard.Vervang(startthemas, vasteMomenten);
        await _opslag.BewaarAsync(cancellationToken);

        return JaarplanGeneratieParameters.Van(bewaard);
    }

    /// <summary>
    /// The reviewable read path (FR-5.1, Art. IV.2): the class's current plan proposal, with each placement's
    /// period resolved against the <b>currently</b> derived grid. A class with no plan yet yields an empty plan
    /// rather than a not-found, because Art. IX.3 says a klas <i>has</i> a jaarplan — an empty one is the honest
    /// answer before generation has run.
    /// </summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class does not exist.</exception>
    public async Task<JaarplanWeergave> HaalJaarplanAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);
        var blokken = _indeling.Blokken(schooljaar, GeneratieNiveau);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        return Projecteer(klas, schooljaar, blokken, themas, jaarplan);
    }

    /// <summary>
    /// Records the teacher's decision on one generated placement (Art. IV.1/IV.2, FR-5.1): accept, reject or
    /// adjust (manueel). The teacher is the only actor that moves a placement off <c>voorgesteld</c>, and the new
    /// status is persisted so it survives a reload and a regeneration.
    /// </summary>
    /// <exception cref="OngeldigePlaatsingsstatusFout"><paramref name="status"/> is not a teacher decision.</exception>
    /// <exception cref="SchoolcontentNietGevondenFout">The class or the placement does not exist.</exception>
    public async Task<JaarplanWeergave> WijzigPlaatsingStatusAsync(
        Guid klasId,
        Guid plaatsingId,
        KoppelingStatus status,
        CancellationToken cancellationToken = default)
    {
        // The teacher may only accept / reject / adjust — `voorgesteld` is AI-only (Art. IV.1/IV.2).
        // The message reaches a non-technical teacher in a 400 body, so it carries no constitution citation; the
        // citation belongs in this method's doc comment, where a developer reads it.
        if (status is not (KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd or KoppelingStatus.Manueel))
        {
            throw new OngeldigePlaatsingsstatusFout(
                $"Status '{status}' is geen leerkrachtbeslissing; kies aanvaard, geweigerd of manueel.");
        }

        return await MuteerPlaatsingAsync(
            klasId, plaatsingId, plaatsing => plaatsing.WijzigStatus(status), cancellationToken);
    }

    /// <summary>
    /// Locks or unlocks a placement against (re)generation (Art. IX.3 <c>vergrendeld</c>). Consumed by E4's
    /// regeneration, and already honoured by <see cref="GenereerAsync"/>.
    /// </summary>
    /// <exception cref="SchoolcontentNietGevondenFout">The class or the placement does not exist.</exception>
    public Task<JaarplanWeergave> WijzigVergrendelingAsync(
        Guid klasId,
        Guid plaatsingId,
        bool vergrendeld,
        CancellationToken cancellationToken = default) =>
        MuteerPlaatsingAsync(
            klasId, plaatsingId, plaatsing => plaatsing.StelVergrendelingIn(vergrendeld), cancellationToken);

    /// <summary>
    /// Moves one placement to the planningsblok starting on <paramref name="doelBlokStart"/> — the teacher dragging a
    /// thema to another period (E3-07, FR-6.2), persisted immediately (FR-6.5).
    /// <para>
    /// <b>The target is resolved against the derived grid and never snapped.</b> A date that is not the start of any
    /// current block is refused with <see cref="OngeldigeVerplaatsingFout"/>, on the same reasoning that makes
    /// <see cref="GenereerAsync"/> skip such a date: moving a thema to the nearest period would put it somewhere
    /// nobody chose, which is the silent relocation ADR-0020 and the directie ruling of 2026-07-28 forbid.
    /// </para>
    /// <para>
    /// <b>A stale placement moves through here too, and that is the re-placement route the ruling requires.</b> The
    /// placement's <i>current</i> position is never validated — only the target — so a thema whose stored date stopped
    /// being a period boundary can be given a real period without the application ever having guessed one for it.
    /// </para>
    /// <para>
    /// <b>Works on a locked placement, and does not clear the lock.</b> Art. IX.3 scopes <c>vergrendeld</c> to
    /// "excluded from <i>regeneration</i>" — it is not a teacher-proof latch, and a teacher who locks a thema and
    /// then decides it belongs a period later is doing something the flag never spoke to.
    /// </para>
    /// <para>
    /// <b>A move is not reversible, and this method no longer claims it is.</b> An earlier revision justified leaving
    /// a move unconfirmed on the grounds that the teacher could drag it back; that restores only the date, while the
    /// AI motivation and any <c>Aanvaard</c> decision are gone for good (see <see cref="Themaplaatsing.VerplaatsNaar"/>).
    /// The compensating control is disclosure in the picker rather than a confirmation dialog: a move is a small
    /// unrecoverable edit, where a delete is a total one.
    /// </para>
    /// <para>
    /// <b>A <c>geweigerd</c> placement is refused.</b> Moving it would silently turn a teacher's rejection into
    /// <c>manueel</c>, and that is the one transition here with a <b>dekking</b> consequence: under the binding
    /// reading recorded in <c>backlog/E5-dekking-export.md</c>, only <c>aanvaard</c>/<c>manueel</c> placements count
    /// as placed (Art. V.1), so a sideways nudge would flip a thema from "not taught" to "taught" in the figure an
    /// onderwijsinspectie is shown. The teacher reverses a rejection through the control that explains it.
    /// </para>
    /// </summary>
    /// <returns>The updated plan, so a caller need not re-fetch it.</returns>
    /// <exception cref="OngeldigeVerplaatsingFout">
    /// The target date is not a block boundary, or the thema is already placed in the target period.
    /// </exception>
    /// <exception cref="SchoolcontentNietGevondenFout">The class, its plan, or the placement does not exist.</exception>
    public async Task<JaarplanWeergave> VerplaatsPlaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        DateOnly doelBlokStart,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);

        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} heeft nog geen jaarplan.");

        var plaatsing = jaarplan.VindPlaatsing(plaatsingId)
            ?? throw new SchoolcontentNietGevondenFout(
                $"Themaplaatsing {plaatsingId} bestaat niet in het jaarplan van klas {klasId}.");

        var blokken = _indeling.Blokken(schooljaar, GeneratieNiveau);

        // Resolved against the grid the teacher is actually looking at, on the placement's own tier. Refused, never
        // snapped to a neighbour.
        if (!blokken.Any(b => b.Start == doelBlokStart && b.Niveau == plaatsing.BlokNiveau))
        {
            throw new OngeldigeVerplaatsingFout(
                $"{Datum(doelBlokStart)} is geen begin van een periode in dit schooljaar. Kies een periode uit het jaarplan.");
        }

        // Refused rather than silently converted to `manueel` — the one transition here that would change dekking.
        // Checked before the no-op test below, so that even dropping a rejected card back where it started is
        // answered with the instruction rather than a 200 that teaches the gesture is available.
        if (plaatsing.Status == KoppelingStatus.Geweigerd)
        {
            throw new OngeldigeVerplaatsingFout(
                "Dit thema is geweigerd. Draai de weigering eerst terug als je het toch wil plannen.");
        }

        // A move to the period it already occupies changes nothing, so nothing is written and the unchanged plan is
        // returned. Deliberately NOT an error: dropping a card back where it started is a normal gesture, and it must
        // not cost a standing AI proposal its status and motivation. Checked before the duplicate guard below, which
        // would otherwise report the placement as colliding with itself.
        if (plaatsing.BlokStart != doelBlokStart)
        {
            // A block holds several thema's (Art. IX.3), so only the same thema twice in the same block is refused —
            // exactly the invariant `VoegPlaatsingToe` enforces, checked here because the aggregate's own guard
            // throws an English programmer-error exception no handler maps to a teacher.
            if (jaarplan.IsAlGeplaatst(plaatsing.ThemaId, plaatsing.BlokNiveau, doelBlokStart))
            {
                throw new OngeldigeVerplaatsingFout(
                    "Dit thema staat al in die periode. Kies een andere periode.");
            }

            plaatsing.VerplaatsNaar(doelBlokStart);
            await _opslag.BewaarAsync(cancellationToken);
        }

        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        return Projecteer(klas, schooljaar, blokken, themas, jaarplan);
    }

    /// <summary>
    /// Removes one placement from the plan — taking a thema out of a period (FR-7, and the escape hatch the
    /// <c>Klas</c> delete guard depends on). Works whatever the placement's status or lock: an explicit teacher
    /// action is the one actor Art. IV.2 allows to discard a human decision.
    /// <para>
    /// This is also the <b>only</b> way a <c>geweigerd</c> placement can ever leave a plan. Without it, rejecting a
    /// thema in a period was irreversible and permanently suppressed the AI from re-proposing it there.
    /// </para>
    /// </summary>
    /// <returns>The updated plan, so a caller need not re-fetch it.</returns>
    /// <exception cref="SchoolcontentNietGevondenFout">The class, its plan, or the placement does not exist.</exception>
    public async Task<JaarplanWeergave> VerwijderPlaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);

        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} heeft nog geen jaarplan.");

        var plaatsing = jaarplan.VindPlaatsing(plaatsingId)
            ?? throw new SchoolcontentNietGevondenFout(
                $"Themaplaatsing {plaatsingId} bestaat niet in het jaarplan van klas {klasId}.");

        jaarplan.VerwijderPlaatsing(plaatsing);
        await _opslag.BewaarAsync(cancellationToken);

        var blokken = _indeling.Blokken(schooljaar, GeneratieNiveau);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        return Projecteer(klas, schooljaar, blokken, themas, jaarplan);
    }

    private async Task<JaarplanWeergave> MuteerPlaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        Action<Themaplaatsing> mutatie,
        CancellationToken cancellationToken)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);

        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} heeft nog geen jaarplan.");

        var plaatsing = jaarplan.VindPlaatsing(plaatsingId)
            ?? throw new SchoolcontentNietGevondenFout(
                $"Themaplaatsing {plaatsingId} bestaat niet in het jaarplan van klas {klasId}.");

        mutatie(plaatsing);
        await _opslag.BewaarAsync(cancellationToken);

        var blokken = _indeling.Blokken(schooljaar, GeneratieNiveau);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        return Projecteer(klas, schooljaar, blokken, themas, jaarplan);
    }

    private async Task<(Klas Klas, Schooljaar Schooljaar)> LaadKlasAsync(
        Guid klasId,
        CancellationToken cancellationToken)
    {
        var geladen = await _opslag.LaadKlasMetSchooljaarAsync(klasId, cancellationToken);

        return geladen ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");
    }

    private async Task<Jaarplan> LaadOfMaakJaarplanAsync(Guid klasId, CancellationToken cancellationToken)
    {
        var bestaand = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);
        if (bestaand is not null)
        {
            return bestaand;
        }

        // One jaarplan per klas (Art. IX.3), created lazily on the first generation so a fresh class does not
        // carry an empty row nobody asked for.
        var jaarplan = new Jaarplan(klasId);
        _opslag.VoegJaarplanToe(jaarplan);

        return jaarplan;
    }

    /// <summary>
    /// Projects the persisted plan onto the currently derived grid. A stored <c>BlokStart</c> that is no longer any
    /// block's start date yields <c>IsVervallen = true</c> with no period bounds — the placement is reported, never
    /// moved (directie 2026-07-28, ADR-0020 follow-ups).
    /// </summary>
    private JaarplanWeergave Projecteer(
        Klas klas,
        Schooljaar schooljaar,
        IReadOnlyList<Planningsblok> blokken,
        IReadOnlyList<Thema> themas,
        Jaarplan? jaarplan)
    {
        var blokPerStart = blokken.ToDictionary(b => b.Start);
        var themaPerId = themas.ToDictionary(t => t.Id);

        var plaatsingen = (jaarplan?.Plaatsingen ?? [])
            .Select(p =>
            {
                var blok = blokPerStart.GetValueOrDefault(p.BlokStart);
                var thema = themaPerId.GetValueOrDefault(p.ThemaId);

                return new ThemaplaatsingWeergave(
                    p.Id,
                    p.ThemaId,
                    thema?.Naam ?? string.Empty,
                    p.BlokNiveau.ToString(),
                    p.BlokStart,
                    blok?.Eind,
                    blok?.Ordinaal,
                    IsVervallen: blok is null,
                    p.Status.ToString(),
                    p.AiMotivatie,
                    p.Vergrendeld,
                    thema is null ? [] : JaarplanGeneratiePromptBuilder.ThemaDoelcodes(thema));
            })
            .ToList();

        return new JaarplanWeergave(
            klas.Id,
            klas.Naam,
            schooljaar.Id,
            schooljaar.Naam,
            _indeling.Omschrijving,
            plaatsingen);
    }

    private static string Datum(DateOnly datum) =>
        datum.ToString(JaarplanGeneratieResponseParser.DatumFormaat, CultureInfo.InvariantCulture);
}
