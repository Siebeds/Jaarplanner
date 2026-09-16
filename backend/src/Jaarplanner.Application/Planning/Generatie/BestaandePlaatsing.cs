namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// One thema that is already in the plan when a <b>per-period</b> generation run is prepared (FR-8.2) — the context
/// <see cref="JaarplanGeneratiePromptBuilder.BouwVoorPeriode"/> needs and the whole-plan path does not.
/// <para>
/// <b>Why the whole-plan path does not need it:</b> a full run rewrites every replaceable placement at once, so what
/// it keeps it keeps for reasons the model cannot influence. A per-period run touches one period out of eight, so
/// without this the model would be asked to fill period 3 while blind to the seven periods around it: it could not
/// avoid repeating a thema the teacher already accepted in period 5, nor prefer the thema whose leerplandoelen the
/// rest of the year is missing, which is precisely what the prompt's Dekking section asks of it.
/// </para>
/// <para>
/// <b>Only placements that will still be there after the discard are ever passed.</b> The prompt is built before
/// <c>Jaarplan.VerwijderVervangbarePlaatsingenIn</c> runs, so the plan in memory still holds the proposals
/// this very run is about to drop. Telling the model those are "already planned" would make it work around content
/// that is about to vanish, and would be a false statement about the teacher's plan besides.
/// </para>
/// </summary>
/// <param name="ThemaNaam">The thema's name, as the model must spell it if it refers to it.</param>
/// <param name="BlokStart">The start date of the block it sits in — never an ordinal (ADR-0020 §3).</param>
public sealed record BestaandePlaatsing(string ThemaNaam, DateOnly BlokStart);
