using Jaarplanner.Application.AiAuthoring;

namespace Jaarplanner.Application.AiMatching;

/// <summary>
/// What the teacher asks for when they trigger a match run for a thema (E2-08, FR-4.1): optionally,
/// <b>which</b> Op.stap leerplandoelen the AI may choose from.
/// <para>
/// <b>The selection is part of the request on purpose.</b> "Which disciplines does the school start
/// with?" is still an open Art. XIV decision, so neither the controller nor the service may quietly
/// answer it. Omitting <see cref="Selectie"/> means <see cref="LeerdoelSelectie.Alles"/> — the whole
/// loaded set — which is a <i>default the caller can see and change per run</i>, not a compiled-in
/// answer. The UI states the default in Dutch and offers both filter dimensions.
/// </para>
/// <para>
/// <b>Known volume risk, deliberately not solved here.</b> With <see cref="LeerdoelSelectie.Alles"/>
/// every loaded leerplandoel goes into the prompt. That is safe today — the database holds only the demo
/// seeder's <c>DEMO-*</c> goals and no Op.stap import can even be triggered yet (E1-15) — but it will not
/// be once a real per-discipline import lands: an unbounded candidate list would make the matching prompt
/// grow with the curriculum. No cap is invented here, because a cap is a pedagogical decision (which goals
/// get silently withheld from the model?) and not a coding one.
/// </para>
/// </summary>
public sealed record DoelsuggestieGeneratieVerzoek
{
    /// <summary>The bounding selection for the candidate leerplandoelen; null = the whole loaded set.</summary>
    public LeerdoelSelectie? Selectie { get; init; }
}
