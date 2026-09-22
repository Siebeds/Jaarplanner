namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// Where an <see cref="Activiteitvoorstel"/> came from (ADR-0060 D1). The same entity serves both, because what a
/// proposal <i>is</i> — a name, a soort, expected outcomes, a length, goal codes and a motivation, decided by a person
/// — is the same either way. Only the candidate goals differ, and who the proposal is addressed to.
/// </summary>
public enum Voorstelbron
{
    /// <summary>
    /// A leerkracht asked for it under a subthema (FB-025, ADR-0056). Its candidate goals are that subthema's decided
    /// subdoelen, and it belongs to the gebruiker who asked.
    /// </summary>
    Gevraagd,

    /// <summary>
    /// The cat brought it unasked, five schooldagen before a thema starts in a klas (FB-070, ADR-0060). Its candidate
    /// goals are the leerplandoelen of one discipline in that klas's aanbod-gat, which are deliberately <b>no</b>
    /// subdoel of the subthema it goes under (G1, D1), and it is addressed to the klas's leerkrachten rather than to
    /// one person (D2). It carries a suggested moment, because an own activiteit that is not planned counts for
    /// nothing (G5, Art. V.1).
    /// </summary>
    KatAanbodgat,
}
