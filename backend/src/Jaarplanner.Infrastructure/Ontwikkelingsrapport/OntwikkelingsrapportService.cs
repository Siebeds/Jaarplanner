using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
// The type shares its name with its namespace (Art. IX.4 names it); this namespace of that name would shadow it here.
using Rapportentiteit = Jaarplanner.Domain.Ontwikkelingsrapport.Ontwikkelingsrapport;

namespace Jaarplanner.Infrastructure.Ontwikkelingsrapport;

/// <summary>
/// The ontwikkelingsrapport of one child at one moment (FB-003), over EF Core.
/// <para>
/// <b>Every rapportdoel of the set is on every report</b> (D2): the read starts from the set, as
/// <see cref="IRapportsetService"/> serves it with its D11 and D12 filter on the subdoelen, and fills in what the child's
/// report holds. A rapportdoel added later is therefore on the report with nothing filled in, for the moments before it
/// too.
/// </para>
/// <para>
/// <b>It logs nothing</b>, as <see cref="LeerlingBeheerService"/>: every outcome is a status code the request log records,
/// and the sentences it throws name no child and quote no text (ADR-0035 §3.8).
/// </para>
/// </summary>
public sealed class OntwikkelingsrapportService : IOntwikkelingsrapportService
{
    /// <summary>
    /// No rapportdoel has this id. Usually deleted after the screen loaded, but the lookup does not prove that one
    /// existed, so the sentence does not say so either (the E5-03 rule).
    /// </summary>
    internal const string RapportdoelNietGevonden = "Dit rapportdoel is niet gevonden. Vernieuw de pagina.";

    /// <summary>No star of the scale has this id; as above, the sentence claims no more than the lookup proves.</summary>
    internal const string OnbekendeGradatie = "Deze ster is niet gevonden in de sterrenschaal. Vernieuw de pagina en kies opnieuw.";

    private readonly AppDbContext _db;
    private readonly IRapportsetService _rapportset;

    public OntwikkelingsrapportService(AppDbContext db, IRapportsetService rapportset)
    {
        _db = db;
        _rapportset = rapportset;
    }

    public async Task<RapportWeergave> HaalRapportOpAsync(
        Guid leerlingId,
        int moment,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        var kind = await (
                from leerling in _db.Leerlingen.AsNoTracking()
                where leerling.Id == leerlingId
                join klas in _db.Klassen on leerling.KlasId equals klas.Id
                join schooljaar in _db.Schooljaren on klas.SchooljaarId equals schooljaar.Id
                select new { leerling.Id, leerling.KlasId, leerling.Voornaam, leerling.Achternaam, KlasNaam = klas.Naam, SchooljaarNaam = schooljaar.Naam })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(LeerlingBeheerService.KindBestaatNiet);

        var rapportdoelen = await _rapportset.HaalRapportdoelenOpAsync(cancellationToken);
        var rapport = await _db.Ontwikkelingsrapporten
            .AsNoTracking()
            .Include(r => r.Beoordelingen)
            .SingleOrDefaultAsync(r => r.LeerlingId == leerlingId && r.Moment == moment1tot3, cancellationToken);
        var perRapportdoel = (rapport?.Beoordelingen ?? []).ToDictionary(b => b.RapportdoelId);

        return new RapportWeergave(
            kind.Id,
            kind.KlasId,
            kind.Voornaam,
            kind.Achternaam,
            kind.KlasNaam,
            kind.SchooljaarNaam,
            moment1tot3,
            rapportdoelen
                .Select(rapportdoel =>
                {
                    var beoordeling = perRapportdoel.GetValueOrDefault(rapportdoel.Id);
                    return new RapportdoelBeoordelingWeergave(
                        rapportdoel.Id,
                        rapportdoel.Titel,
                        rapportdoel.Subdoelen,
                        beoordeling?.GradatieId,
                        beoordeling?.Tekst,
                        beoordeling?.TekstStatus);
                })
                .ToList(),
            rapport?.Besluit,
            rapport?.BesluitStatus);
    }

    public async Task<BeoordelingWeergave> BewaarBeoordelingAsync(
        Guid leerlingId,
        int moment,
        Guid rapportdoelId,
        BeoordelingInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        await VereisKindAsync(leerlingId, cancellationToken);

        if (!await _db.Rapportdoelen.AnyAsync(r => r.Id == rapportdoelId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout(RapportdoelNietGevonden);
        }

        var gradatieId = invoer?.GradatieId;
        if (gradatieId is { } gekozen && !await _db.Gradaties.AnyAsync(g => g.Id == gekozen, cancellationToken))
        {
            throw new SchoolcontentValidatieFout(OnbekendeGradatie);
        }

        var tekst = KeurTekst(invoer?.Tekst, Rapportentiteit.MaxTekstLengte, "Een tekst");

        var rij = await SchrijfAsync(
            leerlingId,
            moment1tot3,
            rapport => rapport.ZetBeoordeling(rapportdoelId, gradatieId, tekst),
            cancellationToken);

        return new BeoordelingWeergave(rapportdoelId, rij?.GradatieId, rij?.Tekst, rij?.TekstStatus);
    }

    public async Task<BesluitWeergave> BewaarBesluitAsync(
        Guid leerlingId,
        int moment,
        BesluitInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        await VereisKindAsync(leerlingId, cancellationToken);
        var tekst = KeurTekst(invoer?.Tekst, Rapportentiteit.MaxBesluitLengte, "Een algemeen besluit");

        var rapport = await SchrijfAsync(
            leerlingId,
            moment1tot3,
            rapport =>
            {
                rapport.ZetBesluit(tekst);
                return rapport;
            },
            cancellationToken);

        return new BesluitWeergave(rapport.Besluit, rapport.BesluitStatus);
    }

    /// <summary>
    /// Applies <paramref name="wijziging"/> to the child's report at the moment, making the report on the first write.
    /// <para>
    /// <b>Two first writes at once</b> (two co-teachers, or one teacher's star and text a moment apart) both find no
    /// report and both make one; the unique index on (leerling, moment) refuses the second. Two first writes of the same
    /// rapportdoel on an existing report collide the same way on the pair key of <c>rapportbeoordelingen</c>. The refused
    /// one is then applied again, once, to what the first wrote, so no teacher sees an error and the later write wins.
    /// </para>
    /// </summary>
    private async Task<T> SchrijfAsync<T>(
        Guid leerlingId,
        int moment,
        Func<Rapportentiteit, T> wijziging,
        CancellationToken cancellationToken)
    {
        try
        {
            return await SchrijfEenmaalAsync(leerlingId, moment, wijziging, cancellationToken);
        }
        catch (DbUpdateException fout) when (fout.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            TableName: "ontwikkelingsrapporten" or "rapportbeoordelingen",
        })
        {
            _db.ChangeTracker.Clear();
            return await SchrijfEenmaalAsync(leerlingId, moment, wijziging, cancellationToken);
        }
    }

    private async Task<T> SchrijfEenmaalAsync<T>(
        Guid leerlingId,
        int moment,
        Func<Rapportentiteit, T> wijziging,
        CancellationToken cancellationToken)
    {
        var rapport = await _db.Ontwikkelingsrapporten
            .Include(r => r.Beoordelingen)
            .SingleOrDefaultAsync(r => r.LeerlingId == leerlingId && r.Moment == moment, cancellationToken);

        if (rapport is null)
        {
            rapport = new Rapportentiteit(leerlingId, moment);
            _db.Ontwikkelingsrapporten.Add(rapport);
        }

        var resultaat = wijziging(rapport);
        await _db.SaveChangesAsync(cancellationToken);
        return resultaat;
    }

    /// <summary>
    /// The route holds the moment to 1..3 already; this is for a caller that is not the route, in the same words as the
    /// 404 a route answers for any other number.
    /// </summary>
    private static int KeurMoment(int moment) =>
        Evaluatiemoment.IsGeldig(moment)
            ? moment
            : throw new SchoolcontentNietGevondenFout("Dit rapport bestaat niet. Kies Rapport 1, 2 of 3.");

    /// <summary>The trimmed text, null for blank, or the teacher's sentence when it is too long. The limit is the domain's.</summary>
    private static string? KeurTekst(string? tekst, int max, string wat)
    {
        if (string.IsNullOrWhiteSpace(tekst))
        {
            return null;
        }

        var getrimd = tekst.Trim();
        return getrimd.Length <= max
            ? getrimd
            : throw new SchoolcontentValidatieFout($"{wat} is hoogstens {max} tekens lang.");
    }

    /// <summary>
    /// The child must still exist. The route's rights lookup already answered 404 for one that did not; this closes the
    /// gap to a delete in between, which the report's foreign key would otherwise turn into a 500.
    /// </summary>
    private async Task VereisKindAsync(Guid leerlingId, CancellationToken cancellationToken)
    {
        if (!await _db.Leerlingen.AnyAsync(l => l.Id == leerlingId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout(LeerlingBeheerService.KindBestaatNiet);
        }
    }
}
