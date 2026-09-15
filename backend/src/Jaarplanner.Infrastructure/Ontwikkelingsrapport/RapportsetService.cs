using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.Ontwikkelingsrapport;

/// <summary>
/// The one K3 set of rapportdoelen and the one sterrenschaal (FB-002), over EF Core. Neither is pupil data, so nothing
/// here needs the care <c>LeerlingBeheerService</c> takes over names; it logs nothing because every outcome is a status
/// code the request log already records.
/// <para>
/// <b>Which subdoelen a rapportdoel may bundle (ADR-0035 D11, D12)</b>: those whose <b>subthema</b> is at
/// <see cref="Rapportdoel.SubdoelLeeftijd"/> and whose goal link is <c>Aanvaard</c> or <c>Manueel</c>. The subthema's
/// leeftijd and not <c>Subdoel.Leeftijd</c>, which a re-scope leaves stale. Checked on every write and applied again on
/// every read, so a subdoel that stops qualifying drops out of the set without anyone editing it.
/// </para>
/// <para>
/// <b>No path sets a subdoel to <c>Geweigerd</c> today</b>: the ordinary writes create <c>Manueel</c> links, and the
/// import and wizard create or delete. The read filter is what carries D11 for when one exists. That route must then also
/// delete the join rows, as the re-scope does (<c>SchoolcontentBeheerService.WijzigSubthemaAsync</c>), or a subdoel
/// accepted again later would come back into its rapportdoelen unasked.
/// </para>
/// </summary>
public sealed class RapportsetService : IRapportsetService
{
    internal const string GradatieNietGevonden = "Deze gradatie is niet gevonden.";
    internal const string RapportdoelNietGevonden = "Dit rapportdoel is niet gevonden.";
    internal const string GeenLabel = "Vul een label in.";
    internal const string OnbekendeKleur = "Kies een kleur uit de lijst.";
    internal const string GeenTitel = "Vul een titel in.";
    internal const string GeenSubdoel = "Kies minstens één subdoel.";
    internal const string GradatievolgordeOnvolledig = "De volgorde moet elke gradatie één keer bevatten.";
    internal const string RapportdoelvolgordeOnvolledig = "De volgorde moet elk rapportdoel één keer bevatten.";

    /// <summary>ADR-0035 D1: what a teacher can do instead, since the rename reaches every report (R7).</summary>
    internal const string GradatieInGebruik =
        "Deze gradatie staat al op een rapport en kan niet verwijderd worden. Je kan ze wel hernoemen of verschuiven.";

    /// <summary>ADR-0035 D1, for a rapportdoel.</summary>
    internal const string RapportdoelInGebruik =
        "Dit rapportdoel staat al op een rapport en kan niet verwijderd worden. Je kan het wel hernoemen of verschuiven.";

    /// <summary>
    /// A subdoel id that is not a candidate: unknown, deleted, undecided or not K3. One sentence for all of them, so the
    /// answer does not say which ids exist. The picker offers only candidates, so a teacher meets this only when the
    /// content changed after the picker loaded; the second sentence says what to do then.
    /// </summary>
    internal const string GeenKandidaat =
        "Kies alleen subdoelen van de derde kleuter waarvan het doel aanvaard of manueel is. Vernieuw de pagina om de keuzelijst opnieuw te laden.";

    /// <summary>Thema and subthema names ignoring case, and invariant so an accented first letter sorts beside its base letter.</summary>
    private static readonly StringComparer Namen = StringComparer.InvariantCultureIgnoreCase;

    private readonly AppDbContext _db;

    public RapportsetService(AppDbContext db) => _db = db;

    // --- De sterrenschaal (R5, R7). ---

    public async Task<IReadOnlyList<GradatieWeergave>> HaalGradatiesOpAsync(CancellationToken cancellationToken = default)
    {
        var gradaties = await _db.Gradaties.AsNoTracking().ToListAsync(cancellationToken);

        return gradaties
            .OrderBy(g => g.Volgorde)
            .ThenBy(g => g.Id)
            .Select(Weergave)
            .ToList();
    }

    public IReadOnlyList<Sterkleur> HaalKleurenOp() => Enum.GetValues<Sterkleur>();

    public async Task<GradatieWeergave> MaakGradatieAsync(GradatieInvoer invoer, CancellationToken cancellationToken = default)
    {
        var (label, kleur) = Keur(invoer);
        var laatste = await _db.Gradaties.MaxAsync(g => (int?)g.Volgorde, cancellationToken) ?? 0;
        var gradatie = new Gradatie(label, kleur, laatste + 1);

        _db.Gradaties.Add(gradatie);
        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(gradatie);
    }

    public async Task<GradatieWeergave> WijzigGradatieAsync(
        Guid gradatieId,
        GradatieInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var gradatie = await VindGradatieAsync(gradatieId, cancellationToken);
        var (label, kleur) = Keur(invoer);

        gradatie.Wijzig(label, kleur);
        await _db.SaveChangesAsync(cancellationToken);

        return Weergave(gradatie);
    }

    public async Task VerwijderGradatieAsync(Guid gradatieId, CancellationToken cancellationToken = default)
    {
        var gradatie = await VindGradatieAsync(gradatieId, cancellationToken);

        // D1: a star a report shows cannot be deleted, since the report may already be with the parents. The foreign key
        // (Restrict) holds it too; this is the teacher's sentence first.
        if (await _db.Rapportbeoordelingen.AnyAsync(b => b.GradatieId == gradatieId, cancellationToken))
        {
            throw new SchoolcontentValidatieFout(GradatieInGebruik);
        }

        _db.Gradaties.Remove(gradatie);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task OrdenGradatiesAsync(VolgordeInvoer invoer, CancellationToken cancellationToken = default)
    {
        var gradaties = await _db.Gradaties.ToListAsync(cancellationToken);
        Orden(gradaties, invoer?.Ids, g => g.Id, (g, plaats) => g.ZetVolgorde(plaats), GradatievolgordeOnvolledig);

        await _db.SaveChangesAsync(cancellationToken);
    }

    // --- De rapportdoelen (R3, R4, R7; D3, D11, D12). ---

    public async Task<IReadOnlyList<RapportdoelWeergave>> HaalRapportdoelenOpAsync(CancellationToken cancellationToken = default)
    {
        var rapportdoelen = await _db.Rapportdoelen
            .AsNoTracking()
            .Include(r => r.Subdoelen)
            .ToListAsync(cancellationToken);

        var ids = rapportdoelen.SelectMany(r => r.Subdoelen).Select(rs => rs.SubdoelId).Distinct().ToList();
        var kandidaten = (await KandidatenAsync(ids, cancellationToken)).ToDictionary(k => k.Id);

        return rapportdoelen
            .OrderBy(r => r.Volgorde)
            .ThenBy(r => r.Id)
            .Select(r => Weergave(r, kandidaten))
            .ToList();
    }

    public async Task<IReadOnlyList<RapportdoelSubdoelWeergave>> HaalKandidatenOpAsync(CancellationToken cancellationToken = default) =>
        Gesorteerd(await KandidatenAsync(alleen: null, cancellationToken));

    public async Task<RapportdoelWeergave> MaakRapportdoelAsync(RapportdoelInvoer invoer, CancellationToken cancellationToken = default)
    {
        var titel = KeurTitel(invoer);
        var subdoelIds = await KeurSubdoelenAsync(invoer?.SubdoelIds, cancellationToken);
        var laatste = await _db.Rapportdoelen.MaxAsync(r => (int?)r.Volgorde, cancellationToken) ?? 0;
        var rapportdoel = new Rapportdoel(titel, laatste + 1, subdoelIds);

        _db.Rapportdoelen.Add(rapportdoel);
        await _db.SaveChangesAsync(cancellationToken);

        return await WeergaveAsync(rapportdoel, cancellationToken);
    }

    public async Task<RapportdoelWeergave> WijzigRapportdoelAsync(
        Guid rapportdoelId,
        RapportdoelInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var rapportdoel = await _db.Rapportdoelen
            .Include(r => r.Subdoelen)
            .FirstOrDefaultAsync(r => r.Id == rapportdoelId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(RapportdoelNietGevonden);

        var titel = KeurTitel(invoer);
        var subdoelIds = await KeurSubdoelenAsync(invoer?.SubdoelIds, cancellationToken);

        rapportdoel.Wijzig(titel, subdoelIds);
        await _db.SaveChangesAsync(cancellationToken);

        return await WeergaveAsync(rapportdoel, cancellationToken);
    }

    public async Task VerwijderRapportdoelAsync(Guid rapportdoelId, CancellationToken cancellationToken = default)
    {
        var rapportdoel = await _db.Rapportdoelen.FirstOrDefaultAsync(r => r.Id == rapportdoelId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(RapportdoelNietGevonden);

        // D1, as for a gradatie. The join rows to its subdoelen go with it (Cascade).
        if (await _db.Rapportbeoordelingen.AnyAsync(b => b.RapportdoelId == rapportdoelId, cancellationToken))
        {
            throw new SchoolcontentValidatieFout(RapportdoelInGebruik);
        }

        _db.Rapportdoelen.Remove(rapportdoel);
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task OrdenRapportdoelenAsync(VolgordeInvoer invoer, CancellationToken cancellationToken = default)
    {
        var rapportdoelen = await _db.Rapportdoelen.ToListAsync(cancellationToken);
        Orden(rapportdoelen, invoer?.Ids, r => r.Id, (r, plaats) => r.ZetVolgorde(plaats), RapportdoelvolgordeOnvolledig);

        await _db.SaveChangesAsync(cancellationToken);
    }

    // --- Membership (D11, D12). ---

    /// <summary>
    /// The subdoelen a rapportdoel may bundle: under a subthema at <see cref="Rapportdoel.SubdoelLeeftijd"/>, with a
    /// decided link. The status filter is the shape <c>EfDekkingOpslag</c> already runs on PostgreSQL.
    /// </summary>
    private IQueryable<Subdoel> Kandidaten() =>
        _db.Subdoelen.Where(sd =>
            _db.Subthemas.Any(st => st.Id == sd.SubthemaId && st.Leeftijd == Rapportdoel.SubdoelLeeftijd)
            && (sd.Koppeling.Status == KoppelingStatus.Aanvaard || sd.Koppeling.Status == KoppelingStatus.Manueel));

    /// <summary>The candidates with what the screen shows of them, all of them or only <paramref name="alleen"/>. Unsorted.</summary>
    private async Task<List<RapportdoelSubdoelWeergave>> KandidatenAsync(List<Guid>? alleen, CancellationToken cancellationToken)
    {
        var kandidaten = Kandidaten().AsNoTracking();
        if (alleen is not null)
        {
            kandidaten = kandidaten.Where(sd => alleen.Contains(sd.Id));
        }

        var rijen = await (
                from sd in kandidaten
                join st in _db.Subthemas on sd.SubthemaId equals st.Id
                join t in _db.Themas on st.ThemaId equals t.Id
                join l in _db.Leerplandoelen on sd.Koppeling.LeerplandoelCode equals l.Code
                select new { sd.Id, l.Code, l.Tekst, l.Doelsoort, ThemaNaam = t.Naam, SubthemaNaam = st.Naam })
            .ToListAsync(cancellationToken);

        return rijen
            .Select(r => new RapportdoelSubdoelWeergave(r.Id, r.Code, r.Tekst, r.Doelsoort, r.ThemaNaam, r.SubthemaNaam))
            .ToList();
    }

    /// <summary>
    /// The submitted ids, each once, when every one is a candidate; otherwise the one refusal. Unknown ids get the same
    /// sentence as undecided or non-K3 ones, so the answer reveals nothing about which ids exist.
    /// <para>
    /// <b>At least one, on create and on update</b> (owner, 2026-09-15, "Altijd minstens één", after antagonist round 1):
    /// a rapportdoel that is only a titel is the "Vrije titel, geen koppeling" R3 rejected, and FB-002 puts it out of
    /// scope. So the last subdoel cannot be taken out; the rapportdoel is deleted instead. A delete elsewhere (D3) or a
    /// refusal (D11) can still empty one, which the list then shows. <i>The first version allowed an empty list as a
    /// default; the owner ruled it out.</i>
    /// </para>
    /// </summary>
    private async Task<List<Guid>> KeurSubdoelenAsync(IReadOnlyList<Guid>? subdoelIds, CancellationToken cancellationToken)
    {
        var ids = (subdoelIds ?? []).Distinct().ToList();
        if (ids.Count == 0)
        {
            throw new SchoolcontentValidatieFout(GeenSubdoel);
        }

        var gevonden = await Kandidaten().CountAsync(sd => ids.Contains(sd.Id), cancellationToken);
        if (gevonden != ids.Count)
        {
            throw new SchoolcontentValidatieFout(GeenKandidaat);
        }

        return ids;
    }

    // --- Validation: the teacher's sentence, before the domain's English refusal. The limits are the domain's. ---

    private static (string Label, Sterkleur Kleur) Keur(GradatieInvoer? invoer)
    {
        var label = invoer?.Label?.Trim();
        if (string.IsNullOrEmpty(label))
        {
            throw new SchoolcontentValidatieFout(GeenLabel);
        }

        if (label.Length > Gradatie.MaxLabelLengte)
        {
            throw new SchoolcontentValidatieFout($"Een label is hoogstens {Gradatie.MaxLabelLengte} tekens lang.");
        }

        return (label, LeesKleur(invoer?.Kleur) ?? throw new SchoolcontentValidatieFout(OnbekendeKleur));
    }

    /// <summary>
    /// A colour by its name only, ignoring case as the JSON enum converter does. Not <c>Enum.TryParse</c>, which would also
    /// accept "3" or "7" and so a colour nobody chose, or none at all.
    /// </summary>
    private static Sterkleur? LeesKleur(string? kleur)
    {
        var naam = kleur?.Trim();
        foreach (var bekend in Enum.GetValues<Sterkleur>())
        {
            if (string.Equals(bekend.ToString(), naam, StringComparison.OrdinalIgnoreCase))
            {
                return bekend;
            }
        }

        return null;
    }

    private static string KeurTitel(RapportdoelInvoer? invoer)
    {
        var titel = invoer?.Titel?.Trim();
        if (string.IsNullOrEmpty(titel))
        {
            throw new SchoolcontentValidatieFout(GeenTitel);
        }

        if (titel.Length > Rapportdoel.MaxTitelLengte)
        {
            throw new SchoolcontentValidatieFout($"Een titel is hoogstens {Rapportdoel.MaxTitelLengte} tekens lang.");
        }

        return titel;
    }

    /// <summary>
    /// Gives each item its place, 1 to n, in the order <paramref name="ids"/> names them, or refuses when the list does
    /// not name every item exactly once. Nothing changes on a refusal. A stale screen, one that missed an item another
    /// teacher added, is refused rather than half applied.
    /// </summary>
    private static void Orden<T>(
        IReadOnlyList<T> alle,
        IReadOnlyList<Guid>? ids,
        Func<T, Guid> sleutel,
        Action<T, int> zet,
        string weigering)
    {
        var gevraagd = ids ?? [];
        var perId = alle.ToDictionary(sleutel);
        if (gevraagd.Count != perId.Count
            || gevraagd.Distinct().Count() != gevraagd.Count
            || !gevraagd.All(perId.ContainsKey))
        {
            throw new SchoolcontentValidatieFout(weigering);
        }

        for (var i = 0; i < gevraagd.Count; i++)
        {
            zet(perId[gevraagd[i]], i + 1);
        }
    }

    private async Task<Gradatie> VindGradatieAsync(Guid gradatieId, CancellationToken cancellationToken) =>
        await _db.Gradaties.FirstOrDefaultAsync(g => g.Id == gradatieId, cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout(GradatieNietGevonden);

    // --- Mapping. ---

    private static GradatieWeergave Weergave(Gradatie gradatie) =>
        new(gradatie.Id, gradatie.Label, gradatie.Kleur, gradatie.Volgorde);

    private async Task<RapportdoelWeergave> WeergaveAsync(Rapportdoel rapportdoel, CancellationToken cancellationToken)
    {
        var ids = rapportdoel.Subdoelen.Select(rs => rs.SubdoelId).ToList();
        var kandidaten = (await KandidatenAsync(ids, cancellationToken)).ToDictionary(k => k.Id);
        return Weergave(rapportdoel, kandidaten);
    }

    /// <summary>The rapportdoel with only the subdoelen that still qualify (D11, D12): the others stay stored and unshown.</summary>
    private static RapportdoelWeergave Weergave(
        Rapportdoel rapportdoel,
        IReadOnlyDictionary<Guid, RapportdoelSubdoelWeergave> kandidaten) =>
        new(
            rapportdoel.Id,
            rapportdoel.Titel,
            rapportdoel.Volgorde,
            Gesorteerd(rapportdoel.Subdoelen
                .Select(rs => kandidaten.GetValueOrDefault(rs.SubdoelId))
                .OfType<RapportdoelSubdoelWeergave>()));

    /// <summary>
    /// By thema, then subthema, then code, as the thema screens group them. Sorted here rather than in SQL: a K3 set holds
    /// a few hundred subdoelen at most, and the database's collation would be a second opinion on the order. The id last,
    /// so two subdoelen with the same code in namesake subthema's keep one order between reloads.
    /// </summary>
    private static List<RapportdoelSubdoelWeergave> Gesorteerd(IEnumerable<RapportdoelSubdoelWeergave> subdoelen) =>
        subdoelen
            .OrderBy(s => s.ThemaNaam, Namen)
            .ThenBy(s => s.SubthemaNaam, Namen)
            .ThenBy(s => s.LeerplandoelCode, StringComparer.Ordinal)
            .ThenBy(s => s.Id)
            .ToList();
}
