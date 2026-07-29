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
    /// <param name="cancellationToken">Cancels an in-flight call.</param>
    /// <returns>A success result carrying the reviewable plan, or an explicit failure with nothing persisted.</returns>
    /// <exception cref="SchoolcontentNietGevondenFout">The class does not exist.</exception>
    public async Task<JaarplanGeneratieResultaat> GenereerAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);

        // The grid comes from the seam. Nothing here knows how long a period is, or that periods exist at all
        // beyond "the seam returned these" (Art. IX.3 — never assume months).
        var blokken = _indeling.Blokken(schooljaar, GeneratieNiveau);
        var themas = await _opslag.LaadThemasAsync(cancellationToken);

        var request = JaarplanGeneratiePromptBuilder.Bouw(klas, schooljaar, blokken, themas);
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
        jaarplan.VerwijderVervangbarePlaatsingen();
        var behouden = jaarplan.Plaatsingen.Count;

        // Resolvable sets. A name/date outside them is skipped, never fabricated (Art. IV.4).
        var themaPerNaam = themas
            .GroupBy(t => t.Naam, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var blokStarts = blokken.Select(b => b.Start).ToHashSet();

        var onbekendeThemas = new List<string>();
        var onbekendeBlokken = new List<string>();
        var duplicaten = new List<string>();
        var afgewezen = new List<string>();
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
        var spreiding = Spreidingsrapport.Meet(
            jaarplan.Plaatsingen.Where(p => p.BlokNiveau == GeneratieNiveau),
            blokken,
            themas.ToDictionary(t => t.Id));

        return JaarplanGeneratieResultaat.Geslaagd(
            Projecteer(klas, schooljaar, blokken, themas, jaarplan),
            nieuw,
            behouden,
            onbekendeThemas,
            onbekendeBlokken,
            duplicaten,
            afgewezen,
            spreiding);
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
