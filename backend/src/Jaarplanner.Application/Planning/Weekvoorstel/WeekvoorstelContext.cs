using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Weekvoorstel;

/// <summary>
/// One activiteit the model may pick for the week (FB-027, ADR-0067 W3), under the short key it answers with
/// (<c>A1</c>, <c>A2</c>, …), so no database id reaches the prompt.
/// </summary>
/// <param name="Sleutel">The key the model names it by.</param>
/// <param name="ActiviteitId">Which activiteit it is.</param>
/// <param name="Naam">Its name.</param>
/// <param name="Soort">Its soort, or <c>null</c>.</param>
/// <param name="VerwachteUitkomsten">What the children do and what is expected of them, or <c>null</c>.</param>
/// <param name="LengteInLesuren">How many lesuren it runs; the block is this times <see cref="Vrijmoment.MinutenPerLesuur"/>.</param>
/// <param name="SubthemaNaam">The subthema it belongs to.</param>
/// <param name="Dagen">
/// The days of the week it may go on: the schooldagen offered that fall inside its subthema's window. A day outside it
/// would put the block outside the subthema it belongs to.
/// </param>
public sealed record Weekkandidaat(
    string Sleutel,
    Guid ActiviteitId,
    string Naam,
    ActiviteitType? Soort,
    string? VerwachteUitkomsten,
    int LengteInLesuren,
    string SubthemaNaam,
    IReadOnlySet<DateOnly> Dagen)
{
    /// <summary>How long its block runs, in minutes.</summary>
    public int Minuten => Math.Max(1, LengteInLesuren) * Vrijmoment.MinutenPerLesuur;
}

/// <summary>
/// What the AI is told for one klas and one week (FB-027, ADR-0067 W2). Only the school's own data (Art. IV.4): the
/// activiteiten of the subthema's that run that week and the week's schooldagen with what is free on them. No goal, no
/// gebruiker, no klas name and no pupil data.
/// </summary>
/// <param name="Leeftijd">The jaar/fase the klas teaches, as the model should picture the children, or <c>null</c>.</param>
/// <param name="Kandidaten">What it may pick from; at least one, or there is nothing to ask.</param>
/// <param name="Dagen">
/// The schooldagen of the week from today on, with the school's hours and what is already planned on each. The tool
/// fits the blocks into these; the model only names the day.
/// </param>
public sealed record WeekvoorstelContext(
    string? Leeftijd,
    IReadOnlyList<Weekkandidaat> Kandidaten,
    IReadOnlyList<Schooldagvenster> Dagen);
