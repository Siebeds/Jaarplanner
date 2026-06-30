namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// One concordance link: a leerplandoel (<see cref="LeerplandoelCode"/>) concorded to a
/// minimumdoel (<see cref="MinimumdoelRef"/>) via the shared key (Excel D = B+C, Art. VII.1).
/// <para>
/// Op.stap carries at most one <c>minimumdoelRef</c> per leerplandoel row (one column D),
/// so a leerplandoel concords to 0..1 minimumdoel; a minimumdoel can be concorded by many
/// leerplandoelen (one-to-many). This is the building block coverage rolls up over at
/// minimumdoel level (Art. V.1 — a minimumdoel is gedekt when ≥1 concorded leerplandoel is).
/// </para>
/// </summary>
/// <param name="LeerplandoelCode">The leerplandoel identity (Excel E).</param>
/// <param name="MinimumdoelRef">The minimumdoel concordance key (Excel D).</param>
public readonly record struct Concordantie(string LeerplandoelCode, string MinimumdoelRef);
