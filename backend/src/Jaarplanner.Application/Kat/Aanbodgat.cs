using Jaarplanner.Application.Dekking;

namespace Jaarplanner.Application.Kat;

/// <summary>
/// One discipline's aanbod-gat for one klas (FB-070, ADR-0060 G2): the leerplandoelen of the klas's jaarfase in that
/// discipline that are in <b>no</b> dekkingsprognose of the klas at all.
/// </summary>
/// <param name="DisciplineNummer">The discipline, by the number that is its identity.</param>
/// <param name="DisciplineNaam">Its name, for the message; <c>null</c> when the discipline row is gone.</param>
/// <param name="Codes">The goals in the gap, ordinally by code: what the AI may work on, and nothing else.</param>
/// <param name="AantalInBereik">How many leerplandoelen the discipline has in the klas's scope: the denominator.</param>
public sealed record Aanbodgat(
    string DisciplineNummer,
    string? DisciplineNaam,
    IReadOnlyList<string> Codes,
    int AantalInBereik)
{
    /// <summary>The share of the discipline that is in the gap, between 0 and 1. What makes a discipline "low".</summary>
    public double Aandeel => AantalInBereik == 0 ? 0 : (double)Codes.Count / AantalInBereik;
}

/// <summary>
/// Which discipline a klas hardly touches (ADR-0060 G2). A pure function of a computed dekking, so every rule is a
/// unit test and the choice of discipline is tested without an AI client (FB-070's last acceptance criterion).
/// <para>
/// <b>It reads the dekking rather than recomputing anything.</b> <see cref="Dekkingsstap.Geen"/> is already "no
/// subthema at the klas's leeftijd aims at it, no algemene fiche of the klas carries it, no own activiteit of its
/// leerkrachten links it" (Art. V.1, ADR-0047), which is precisely the aanbod-gat. A second definition here would be a
/// second answer to the highest-risk question in the system (Art. V.6).
/// </para>
/// <para>
/// <b>Minimumdoelen are not in it</b> (G6): <see cref="DekkingWeergave.Doelen"/> holds leerplandoelen, and a
/// minimumdoel counts only through a thema it is a themadoel of, which is <see cref="DekkingWeergave.Minimumdoelen"/>
/// and a different list.
/// </para>
/// </summary>
public static class Aanbodgatbepaling
{
    /// <summary>
    /// The discipline with the largest share of its in-scope leerplandoelen in the gap, or <c>null</c> when no
    /// discipline has one.
    /// <para>
    /// Ties are broken by the number of goals in the gap and then by discipline number, ordinally, so a tick and the
    /// read that follows it choose the same discipline: a detector that picked differently on two runs would bring a
    /// second set of proposals for the same thema.
    /// </para>
    /// </summary>
    /// <param name="dekking">The klas's computed dekking. Its <see cref="DekkingWeergave.Doelen"/> is the scope.</param>
    public static Aanbodgat? Grootste(DekkingWeergave dekking)
    {
        ArgumentNullException.ThrowIfNull(dekking);

        return dekking.Doelen
            .GroupBy(d => d.DisciplineNummer, StringComparer.Ordinal)
            .Select(groep => new Aanbodgat(
                groep.Key,
                groep.Select(d => d.DisciplineNaam).FirstOrDefault(naam => naam is not null),
                groep.Where(d => d.Stap == Dekkingsstap.Geen)
                    .Select(d => d.Code)
                    .Order(StringComparer.Ordinal)
                    .ToList(),
                groep.Count()))
            .Where(gat => gat.Codes.Count > 0)
            .OrderByDescending(gat => gat.Aandeel)
            .ThenByDescending(gat => gat.Codes.Count)
            .ThenBy(gat => gat.DisciplineNummer, StringComparer.Ordinal)
            .FirstOrDefault();
    }
}
