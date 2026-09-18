using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Ontwikkelingsrapport;

/// <summary>
/// CRUD for the children of a K3 klas (FB-001), over EF Core. Shaped like <c>AlgemeneFicheBeheerService</c>: the klas in
/// the route for the list and the create, the leerling alone after that.
/// <para>
/// <b>It logs nothing</b>, not even ids, because it has nothing an operator needs: every outcome is a status code the
/// request log already records. The sentences it throws name no child (ADR-0035 §3.8).
/// </para>
/// </summary>
public sealed class LeerlingBeheerService : ILeerlingBeheerService
{
    /// <summary>D9's refusal, for admin: a leerkracht of a klas that grants no K3 is refused by the matrix first.</summary>
    internal const string GeenK3Klas = "Alleen een klas van de derde kleuter kan kinderen hebben.";

    /// <summary>
    /// No child has this id. The same sentence as the route's own lookup (<c>RechtOpAttribute</c>), and no more than
    /// the lookup proves: not that the child existed, nor who removed it.
    /// </summary>
    internal const string KindBestaatNiet = "Dit kind is niet gevonden.";

    /// <summary>
    /// Voornaam first, then achternaam, as a teacher calls the roll. Ignoring case, and invariant rather than ordinal so
    /// that a name starting with an accented letter (Émile, Özlem) sorts beside its base letter and not after Z. The id
    /// last, so two children with the same name keep one order between reloads.
    /// </summary>
    private static readonly StringComparer Volgorde = StringComparer.InvariantCultureIgnoreCase;

    private readonly AppDbContext _db;

    public LeerlingBeheerService(AppDbContext db) => _db = db;

    public async Task<IReadOnlyList<LeerlingWeergave>> HaalLeerlingenOpAsync(
        Guid klasId,
        CancellationToken cancellationToken = default)
    {
        await VindKlasAsync(klasId, cancellationToken);

        // Sorted here rather than in SQL: a klas holds a few dozen children, and the database's collation would be a
        // second opinion on the order.
        var leerlingen = await _db.Leerlingen
            .AsNoTracking()
            .Where(l => l.KlasId == klasId)
            .ToListAsync(cancellationToken);

        return leerlingen
            .OrderBy(l => l.Voornaam, Volgorde)
            .ThenBy(l => l.Achternaam, Volgorde)
            .ThenBy(l => l.Id)
            .Select(Weergave)
            .ToList();
    }

    public async Task<LeerlingWeergave> MaakLeerlingAsync(
        Guid klasId,
        LeerlingInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var klas = await VindKlasAsync(klasId, cancellationToken);

        // D9, for everyone: admin passes the matrix row for any klas, so this is where a K2 klas is refused. Asked of the
        // one klas→leeftijden mapping, so the graadklas decision (Art. XIV) moves this with it.
        if (!Leerling.KlasKanLeerlingenHebben(klas.Jaarfase))
        {
            throw new SchoolcontentValidatieFout(GeenK3Klas);
        }

        var (voornaam, achternaam) = Keur(invoer);
        var leerling = new Leerling(klasId, voornaam, achternaam);

        _db.Leerlingen.Add(leerling);
        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(leerling);
    }

    public async Task<LeerlingWeergave> WijzigLeerlingAsync(
        Guid leerlingId,
        LeerlingInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var leerling = await VindLeerlingAsync(leerlingId, cancellationToken);
        var (voornaam, achternaam) = Keur(invoer);

        leerling.Wijzig(voornaam, achternaam);
        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(leerling);
    }

    public async Task VerwijderLeerlingAsync(Guid leerlingId, CancellationToken cancellationToken = default)
    {
        var leerling = await VindLeerlingAsync(leerlingId, cancellationToken);

        _db.Leerlingen.Remove(leerling);
        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// The two names, trimmed, or the teacher's sentence for what is wrong. Checked here rather than left to the domain,
    /// whose refusal is an English <see cref="ArgumentException"/> no handler maps. The limit is the domain's.
    /// </summary>
    private static (string Voornaam, string Achternaam) Keur(LeerlingInvoer? invoer)
    {
        var voornaam = invoer?.Voornaam?.Trim();
        if (string.IsNullOrEmpty(voornaam))
        {
            throw new SchoolcontentValidatieFout("Vul een voornaam in.");
        }

        if (voornaam.Length > Leerling.MaxNaamLengte)
        {
            throw new SchoolcontentValidatieFout($"Een voornaam is hoogstens {Leerling.MaxNaamLengte} tekens lang.");
        }

        var achternaam = invoer?.Achternaam?.Trim();
        if (string.IsNullOrEmpty(achternaam))
        {
            throw new SchoolcontentValidatieFout("Vul een achternaam in.");
        }

        if (achternaam.Length > Leerling.MaxNaamLengte)
        {
            throw new SchoolcontentValidatieFout($"Een achternaam is hoogstens {Leerling.MaxNaamLengte} tekens lang.");
        }

        return (voornaam, achternaam);
    }

    private async Task<Klas> VindKlasAsync(Guid klasId, CancellationToken cancellationToken) =>
        await _db.Klassen.AsNoTracking().FirstOrDefaultAsync(k => k.Id == klasId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");

    private async Task<Leerling> VindLeerlingAsync(Guid leerlingId, CancellationToken cancellationToken) =>
        await _db.Leerlingen.FirstOrDefaultAsync(l => l.Id == leerlingId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout(KindBestaatNiet);

    private static LeerlingWeergave Weergave(Leerling leerling) =>
        new(leerling.Id, leerling.KlasId, leerling.Voornaam, leerling.Achternaam);
}
