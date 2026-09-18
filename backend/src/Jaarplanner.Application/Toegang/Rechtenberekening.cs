using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Toegang;

namespace Jaarplanner.Application.Toegang;

/// <summary>
/// Turns a gebruiker's stored facts into the <see cref="Rechten"/> they hold on a given day (Art. VI.1, ADR-0030 §3).
/// Pure: no database and no clock, so every rule below is unit-tested on its own, and the Infrastructure service only
/// loads the facts and supplies "today" in the school's time zone.
/// <list type="bullet">
/// <item><b>HL:</b> a hoofdleerkrachtaanstelling counts while its schooljaar has not ended, <c>vandaag ≤ Eind</c>,
/// including a schooljaar that has not started (R20). No klastoewijzing is needed (I20).</item>
/// <item><b>LK leeftijd:</b> a klastoewijzing gives the leeftijden <see cref="Leeftijdsrechten.VoorKlas"/> maps the
/// klas to (its stated jaarfase, or none; R22, I12), while the klas's schooljaar has not ended (R20).</item>
/// <item><b>LK eigen:</b> every klastoewijzing gives its klas, with no end date (I21): the klas already belongs to one
/// schooljaar.</item>
/// <item><b>LK eigen, for the ontwikkelingsrapport</b> (FB-001, ADR-0030 footnote ⁶): a klastoewijzing on a klas that
/// grants K3 (<see cref="Leerling.KlasKanLeerlingenHebben"/>, D9) gives that klas to read with no end date, and to fill
/// in only while its schooljaar has not ended (R26, overriding I21 for these rows).</item>
/// </list>
/// <c>Schooljaar.Eind</c> is the last school day, inclusive, so on that day the right still holds and on the next it
/// lapses.
/// </summary>
public static class Rechtenberekening
{
    public static Rechten Bereken(
        Guid gebruikerId,
        bool isAdmin,
        bool heeftThemabeheer,
        IEnumerable<KlastoewijzingFeit> klastoewijzingen,
        IEnumerable<AanstellingFeit> aanstellingen,
        DateOnly vandaag,
        bool heeftLeerlingzorg = false)
    {
        ArgumentNullException.ThrowIfNull(klastoewijzingen);
        ArgumentNullException.ThrowIfNull(aanstellingen);

        var toewijzingen = klastoewijzingen.ToList();

        var hoofdleerkracht = aanstellingen
            .Where(a => TeltNog(a.SchooljaarEind, vandaag))
            .Select(a => a.Jaarfase);

        var leerkrachtLeeftijden = toewijzingen
            .Where(t => TeltNog(t.SchooljaarEind, vandaag))
            .SelectMany(t => Leeftijdsrechten.VoorKlas(t.GesteldeJaarfase));

        var eigenKlassen = toewijzingen.Select(t => t.KlasId);

        var rapportklassen = toewijzingen.Where(t => Leerling.KlasKanLeerlingenHebben(t.GesteldeJaarfase)).ToList();
        var lopendeRapportklassen = rapportklassen.Where(t => TeltNog(t.SchooljaarEind, vandaag));

        return new Rechten(
            gebruikerId,
            isAdmin,
            heeftThemabeheer,
            hoofdleerkracht,
            leerkrachtLeeftijden,
            eigenKlassen,
            rapportklassen.Select(t => t.KlasId),
            lopendeRapportklassen.Select(t => t.KlasId),
            heeftLeerlingzorg);
    }

    /// <summary>
    /// R20: a schooljaar counts for the shared content until its last school day has passed. The ontwikkelingsrapport
    /// uses the same day for R26: a leerkracht fills in until then, and reads afterwards.
    /// </summary>
    public static bool TeltNog(DateOnly schooljaarEind, DateOnly vandaag) => vandaag <= schooljaarEind;
}

/// <summary>One klastoewijzing, with what the rights need from its klas and that klas's schooljaar.</summary>
/// <param name="KlasId">The klas.</param>
/// <param name="GesteldeJaarfase">The klas's stated <c>Jaarfase</c>, exactly as stored; may be null on a legacy row.</param>
/// <param name="SchooljaarEind">The last school day of the klas's schooljaar.</param>
public sealed record KlastoewijzingFeit(Guid KlasId, string? GesteldeJaarfase, DateOnly SchooljaarEind);

/// <summary>One hoofdleerkrachtaanstelling, with the last school day of its schooljaar.</summary>
public sealed record AanstellingFeit(string Jaarfase, DateOnly SchooljaarEind);
