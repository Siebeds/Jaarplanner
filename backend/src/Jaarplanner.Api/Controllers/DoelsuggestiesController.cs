using Jaarplanner.Application.AiMatching;
using Jaarplanner.Domain.Schoolcontent;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Jaarplanner.Api.Controllers;

/// <summary>
/// Thin REST controller (Art. VIII) for a thema's AI goal-match suggestions (E2-04/05/08, FR-4.1/4.2/4.3).
/// It <b>triggers</b> a match run, exposes the read query "suggesties per thema", and lets the teacher
/// record a decision — accept / reject / adjust — on a single suggestion. All logic lives in
/// <see cref="DoelMatchingService"/>; the controller only binds, delegates and returns.
/// <para>
/// <b>The POST is the point of E2-08.</b> Before it, <c>MatchThemaAsync</c> was called from exactly one
/// place in the repository — its own unit test — so this controller could list and decide on suggestions
/// that nothing in a running application could ever create, and a deployed app always rendered "er zijn
/// nog geen AI-doelsuggesties". FR-4.1 says the tool <i>stelt voor</i>; a service with no caller does not.
/// </para>
/// <para>
/// The AI never auto-applies: generation persists suggestions as <c>voorgesteld</c> with a motivation, and
/// only an explicit teacher call moves one to aanvaard/geweigerd/manueel (Art. IV.1/IV.2). Not-found /
/// invalid-status / invalid-substitution surface via <c>AiMatchingExceptionHandler</c> (Program.cs).
/// </para>
/// </summary>
[ApiController]
[Route("api/themas/{themaId:guid}/doelsuggesties")]
public sealed class DoelsuggestiesController : ControllerBase
{
    private readonly DoelMatchingService _service;

    public DoelsuggestiesController(DoelMatchingService service) => _service = service;

    /// <summary>Body for a teacher decision: the new status (aanvaard / geweigerd / manueel).</summary>
    public sealed record StatusWijziging(KoppelingStatus Status);

    /// <summary>Body for FR-4.3's "aanpassen": the leerplandoel to couple in place of the suggested one.</summary>
    public sealed record DoelVervanging(string LeerplandoelCode);

    /// <summary>Lists the AI doelsuggesties persisted for a thema, each with its code, status and motivation (FR-4.3).</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DoelMatchSuggestieWeergave>>> Lijst(Guid themaId, CancellationToken cancellationToken) =>
        Ok(await _service.HaalSuggestiesVoorThemaAsync(themaId, cancellationToken));

    /// <summary>
    /// Triggers an AI match run for the thema (E2-08, FR-4.1) and returns what it proposed. Every suggestion
    /// lands as <c>voorgesteld</c> with its motivation — advisory, never applied (Art. IV.1/IV.2) — and a code
    /// already linked to the thema is skipped, so re-running is safe.
    /// <para>
    /// The body is <b>optional</b>. Its <c>selectie</c> bounds which Op.stap leerplandoelen the model may choose
    /// from (disciplines / jaar-fasen / codes); omitting it means the whole loaded set. That default is not
    /// decided here — it is documented in <see cref="DoelsuggestieGeneratieVerzoek"/> and stated in the UI,
    /// because "which disciplines first" is still an open Art. XIV question and the run's scope must stay the
    /// teacher's visible, per-run choice. <c>aantalKandidaten</c> in the response reports what it resolved to.
    /// </para>
    /// <para>
    /// An invalid AI response yields <b>422 Unprocessable Entity</b> with the diagnostic and <b>no</b> change to
    /// the thema (Art. IV.5) — 422 rather than 500 because nothing is broken; the model answered badly and the
    /// caller can retry. The body is an English operator diagnostic and is never teacher copy: the Dutch message
    /// for this case lives in <c>frontend/src/i18n/nl.json</c>, keyed on the status. This mirrors
    /// <see cref="JaarplanController"/>'s generation 422 deliberately, so the two AI triggers behave alike.
    /// </para>
    /// <para>
    /// <b>Known and deliberately not fixed here:</b> with no <c>AzureAI:ApiKey</c> configured the client throws and
    /// this returns <b>500</b>, where a 503 would describe an unconfigured dependency better. Changing that touches
    /// E2-01's client and the shared handler, which E3-02 deferred for the same reason; the frontend tells the two
    /// apart by status and shows configuration-fault copy rather than blaming the model.
    /// </para>
    /// </summary>
    [HttpPost("genereer")]
    public async Task<ActionResult<DoelMatchResultaat>> Genereer(
        Guid themaId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] DoelsuggestieGeneratieVerzoek? verzoek,
        CancellationToken cancellationToken)
    {
        var resultaat = await _service.GenereerSuggestiesAsync(themaId, verzoek?.Selectie, cancellationToken);

        return resultaat.IsGeslaagd
            ? Ok(resultaat)
            : UnprocessableEntity(new ProblemDetails
            {
                Status = StatusCodes.Status422UnprocessableEntity,
                Title = "Invalid AI response",
                Detail = resultaat.Fout,
            });
    }

    /// <summary>
    /// Records the teacher's decision on one suggestion (E2-05, FR-4.3): accept, reject or adjust
    /// (manueel). The change persists and drives coverage (E5). No auto-apply (Art. IV.1/IV.2).
    /// </summary>
    [HttpPut("{suggestieId:guid}/status")]
    public async Task<ActionResult<DoelMatchSuggestieWeergave>> WijzigStatus(
        Guid themaId,
        Guid suggestieId,
        [FromBody] StatusWijziging wijziging,
        CancellationToken cancellationToken) =>
        Ok(await _service.WijzigSuggestieStatusAsync(themaId, suggestieId, wijziging.Status, cancellationToken));

    /// <summary>
    /// FR-4.3's third action, <b>"aanpassen"</b> (E2-08): couple a <i>different</i> leerplandoel in place of the
    /// suggested one. The suggestion becomes <c>manueel</c> — the teacher's own choice — and the AI motivation
    /// goes with the code it described. A replacement that Op.stap does not carry, or that this thema already
    /// links, is rejected with a 400 (Art. III.5, Art. V).
    /// <para>
    /// This is a separate member from the status PUT rather than an extra field on it, because the two are
    /// different acts: one records a verdict on the AI's proposal, the other changes what is proposed. Both stay
    /// available — whether "aanpassen" means substituting a doel or merely overriding the verdict is a reading
    /// directie has not ruled on (E2-05 note, 2026-07-28), and offering both makes the ruling free.
    /// </para>
    /// </summary>
    [HttpPut("{suggestieId:guid}/leerplandoel")]
    public async Task<ActionResult<DoelMatchSuggestieWeergave>> VervangLeerplandoel(
        Guid themaId,
        Guid suggestieId,
        [FromBody] DoelVervanging vervanging,
        CancellationToken cancellationToken) =>
        Ok(await _service.VervangSuggestieDoelAsync(themaId, suggestieId, vervanging.LeerplandoelCode, cancellationToken));
}
