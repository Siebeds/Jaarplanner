using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Toegang;

/// <summary>
/// The relations one gebruiker holds <b>today</b>, as the columns of ADR-0030 §3 need them (Art. VI.1). Computed on
/// every request by <see cref="IRechtenService"/> from the gebruiker row, their klastoewijzingen and their
/// hoofdleerkrachtaanstellingen; never stored and never put in the session cookie, so a change admin makes
/// applies on the next request.
/// <para>
/// <b>These are the raw relations, not the answers.</b> An admin holds every right whatever these lists say (R3),
/// except editing the one K3 set of rapportdoelen and the scale, which only these lists can grant (ADR-0035 R31), and
/// <see cref="Rechtenmatrix.StaatToe"/> is the one place that turns relations into "may do this". A gebruiker
/// holds the union of every relation that applies (§3's union rule), which is why they are separate fields rather
/// than one "role".
/// </para>
/// </summary>
public sealed class Rechten
{
    /// <param name="rapportklasIds">
    /// "LK eigen" for the ontwikkelingsrapport rows, reading (FB-001). Optional so the many callers that describe a
    /// gebruiker without a K3 klas stay short; left out, it is empty, which grants nothing.
    /// </param>
    /// <param name="lopendeRapportklasIds">
    /// The same, filling in. Kept to a subset of <paramref name="rapportklasIds"/>: an id that is not also there is dropped,
    /// so no caller can give the right to fill in a report without the right to read it.
    /// </param>
    /// <param name="heeftLeerlingzorg">Leerlingzorg (FB-008). Optional for the same reason; left out, it is not held.</param>
    public Rechten(
        Guid gebruikerId,
        bool isAdmin,
        bool heeftThemabeheer,
        IEnumerable<string> hoofdleerkrachtLeeftijden,
        IEnumerable<string> leerkrachtLeeftijden,
        IEnumerable<Guid> eigenKlasIds,
        IEnumerable<Guid>? rapportklasIds = null,
        IEnumerable<Guid>? lopendeRapportklasIds = null,
        bool heeftLeerlingzorg = false)
    {
        ArgumentNullException.ThrowIfNull(hoofdleerkrachtLeeftijden);
        ArgumentNullException.ThrowIfNull(leerkrachtLeeftijden);
        ArgumentNullException.ThrowIfNull(eigenKlasIds);

        GebruikerId = gebruikerId;
        IsAdmin = isAdmin;
        HeeftThemabeheer = heeftThemabeheer;
        HeeftLeerlingzorg = heeftLeerlingzorg;
        HoofdleerkrachtLeeftijden = Geordend(hoofdleerkrachtLeeftijden);
        LeerkrachtLeeftijden = Geordend(leerkrachtLeeftijden);
        EigenKlasIds = eigenKlasIds.Distinct().Order().ToList();
        RapportklasIds = (rapportklasIds ?? []).Distinct().Order().ToList();
        LopendeRapportklasIds = (lopendeRapportklasIds ?? []).Distinct().Where(RapportklasIds.Contains).Order().ToList();
    }

    /// <summary>Whose rights these are. The maker column compares against it.</summary>
    public Guid GebruikerId { get; }

    /// <summary>
    /// "Admin" (R3, R16): passes every row of the matrix but <see cref="Rechtenmatrix.RapportsetBewerken"/> (ADR-0035
    /// R31).
    /// </summary>
    public bool IsAdmin { get; }

    /// <summary>"TB": holds themabeheer (R4).</summary>
    public bool HeeftThemabeheer { get; }

    /// <summary>
    /// "Leerlingzorg" (ADR-0035 R18, FB-008): reads every ontwikkelingsrapport, of every schooljaar, and does nothing
    /// else. Needs no schooljaar and no klas: admin gave it, and it holds until admin takes it away.
    /// </summary>
    public bool HeeftLeerlingzorg { get; }

    /// <summary>
    /// "HL": the jaarfasen this gebruiker is appointed hoofdleerkracht of, in a schooljaar that has not ended (R5, R20).
    /// No klastoewijzing needed (I20). In jaar/fase order, each once.
    /// </summary>
    public IReadOnlyList<string> HoofdleerkrachtLeeftijden { get; }

    /// <summary>
    /// "LK leeftijd": the stated jaarfasen of the klassen this gebruiker holds a klastoewijzing on, in a schooljaar that
    /// has not ended (R17, R20, R22, I12). In jaar/fase order, each once.
    /// </summary>
    public IReadOnlyList<string> LeerkrachtLeeftijden { get; }

    /// <summary>"LK eigen": every klas this gebruiker holds a klastoewijzing on, with no end date (R7, R15, I21).</summary>
    public IReadOnlyList<Guid> EigenKlasIds { get; }

    /// <summary>
    /// "LK eigen" as the ontwikkelingsrapport rows read it, for reading (ADR-0030 footnote ⁶, ADR-0035 R16, R26): every klas
    /// this gebruiker holds a klastoewijzing on <b>that grants K3</b> (<c>Leerling.KlasKanLeerlingenHebben</c>, D9), with no
    /// end date. A subset of <see cref="EigenKlasIds"/>.
    /// </summary>
    public IReadOnlyList<Guid> RapportklasIds { get; }

    /// <summary>
    /// The <see cref="RapportklasIds"/> whose schooljaar has not ended: "LK eigen" for filling in and for the klas's
    /// leerlingen (footnote ⁶, R26, which overrides I21 for these rows). After the schooljaar the leerkracht still reads.
    /// Any id here also makes them a K3 leerkracht who edits the one K3 set and scale (FB-002, ADR-0035 D4).
    /// </summary>
    public IReadOnlyList<Guid> LopendeRapportklasIds { get; }

    /// <summary>Whether this gebruiker is a hoofdleerkracht of <paramref name="leeftijd"/> today. Not admin-aware.</summary>
    public bool IsHoofdleerkrachtVan(string leeftijd) => HoofdleerkrachtLeeftijden.Contains(leeftijd, StringComparer.Ordinal);

    /// <summary>Whether this gebruiker is a leerkracht with a klas of <paramref name="leeftijd"/> today. Not admin-aware.</summary>
    public bool IsLeerkrachtVanLeeftijd(string leeftijd) => LeerkrachtLeeftijden.Contains(leeftijd, StringComparer.Ordinal);

    /// <summary>Whether this gebruiker holds a klastoewijzing on <paramref name="klasId"/>. Not admin-aware.</summary>
    public bool IsLeerkrachtVanKlas(Guid klasId) => EigenKlasIds.Contains(klasId);

    /// <summary>Whether this gebruiker reads the reports and leerlingen of K3 klas <paramref name="klasId"/>. Not admin-aware.</summary>
    public bool IsRapportleerkrachtVan(Guid klasId) => RapportklasIds.Contains(klasId);

    /// <summary>
    /// Whether this gebruiker fills in the reports and keeps the leerlingen of K3 klas <paramref name="klasId"/> today:
    /// its schooljaar has not ended. Not admin-aware.
    /// </summary>
    public bool VultRapportIn(Guid klasId) => LopendeRapportklasIds.Contains(klasId);

    /// <summary>No right at all: a gebruiker who does not exist, or one admin has given nothing.</summary>
    public static Rechten Geen(Guid gebruikerId) => new(gebruikerId, false, false, [], [], [], [], []);

    /// <summary>
    /// The nine codes in their own order, each once. Anything else is dropped rather than carried: a right on a code
    /// no subthema can hold would be a right on nothing, and failing closed is the direction a right must fail in.
    /// </summary>
    private static IReadOnlyList<string> Geordend(IEnumerable<string> codes)
    {
        var aanwezig = codes.ToHashSet(StringComparer.Ordinal);
        return Jaarfasen.Alle.Where(aanwezig.Contains).ToList();
    }
}
