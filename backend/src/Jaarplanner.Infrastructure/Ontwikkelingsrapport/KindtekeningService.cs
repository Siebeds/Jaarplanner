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
/// The kindtekening of one report (FB-005), over EF Core, with the re-encode behind <see cref="ITekeningHerwerker"/>.
/// <para>
/// <b>Nothing is stored before the re-encode succeeded</b>, so the database never holds an upload as it came in.
/// </para>
/// <para>
/// <b>It logs nothing</b>, as <see cref="OntwikkelingsrapportService"/>: every outcome is a status code the request log
/// records, and no sentence it throws names a child, a file or its content (ADR-0035 §3.8).
/// </para>
/// </summary>
public sealed class KindtekeningService : IKindtekeningService
{
    internal const string GeenBestand = "Er is geen bestand meegestuurd. Kies een foto of scan van de tekening.";

    /// <summary>Names the limit from <see cref="Kindtekeningregels"/>, so the sentence and the check cannot drift apart.</summary>
    internal static readonly string TeGroot =
        $"Dit bestand is groter dan {Kindtekeningregels.MaxMegabytes} MB. Kies een kleinere foto of scan.";

    internal const string GeenJpegOfPng =
        "Dit bestand kon niet gelezen worden als JPEG of PNG. Kies een foto of scan als JPEG- of PNG-bestand.";

    internal static readonly string TeVeelPixels =
        $"Deze foto heeft meer dan {Kindtekeningregels.MaxMegapixels} miljoen pixels. Kies een foto met een lagere resolutie.";

    internal const string GeenTekening = "Er is geen tekening bij dit rapport.";

    private readonly AppDbContext _db;
    private readonly ITekeningHerwerker _herwerker;

    public KindtekeningService(AppDbContext db, ITekeningHerwerker herwerker)
    {
        _db = db;
        _herwerker = herwerker;
    }

    public async Task<TekeningWeergave> BewaarAsync(
        Guid leerlingId,
        int moment,
        Stream bestand,
        long lengte,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(bestand);
        var moment1tot3 = OntwikkelingsrapportService.KeurMoment(moment);
        await VereisKindAsync(leerlingId, cancellationToken);

        var bron = await LeesAsync(bestand, lengte, cancellationToken);
        HerwerkteTekening beeld;
        try
        {
            beeld = await _herwerker.HerwerkAsync(bron, cancellationToken);
        }
        catch (TekeningGeweigerdFout fout)
        {
            throw new SchoolcontentValidatieFout(fout.Reden == Tekeningweigering.TeVeelPixels ? TeVeelPixels : GeenJpegOfPng);
        }

        var tekening = await SchrijfAsync(leerlingId, moment1tot3, beeld, cancellationToken);
        return new TekeningWeergave(tekening.Versie, tekening.Breedte, tekening.Hoogte);
    }

    public async Task<TekeningBestand> HaalOpAsync(Guid leerlingId, int moment, CancellationToken cancellationToken = default)
    {
        var moment1tot3 = OntwikkelingsrapportService.KeurMoment(moment);
        var bestand = await (
                from rapport in _db.Ontwikkelingsrapporten.AsNoTracking()
                where rapport.LeerlingId == leerlingId && rapport.Moment == moment1tot3
                join tekening in _db.Kindtekeningen.AsNoTracking() on rapport.Id equals tekening.OntwikkelingsrapportId
                select new { tekening.Inhoud, tekening.Formaat })
            .SingleOrDefaultAsync(cancellationToken);

        if (bestand is null)
        {
            await VereisKindAsync(leerlingId, cancellationToken);
            throw new SchoolcontentNietGevondenFout(GeenTekening);
        }

        return new TekeningBestand(bestand.Inhoud, Kindtekening.MediaTypeVan(bestand.Formaat));
    }

    public async Task VerwijderAsync(Guid leerlingId, int moment, CancellationToken cancellationToken = default)
    {
        var moment1tot3 = OntwikkelingsrapportService.KeurMoment(moment);
        await VereisKindAsync(leerlingId, cancellationToken);

        await _db.Kindtekeningen
            .Where(tekening => _db.Ontwikkelingsrapporten.Any(rapport =>
                rapport.Id == tekening.OntwikkelingsrapportId && rapport.LeerlingId == leerlingId && rapport.Moment == moment1tot3))
            .ExecuteDeleteAsync(cancellationToken);
    }

    /// <summary>
    /// The upload's bytes, or the teacher's sentence when there are none or too many. The declared length is checked first,
    /// so a file over the limit is not read; what is read is checked again, since a declared length is only a claim.
    /// </summary>
    private static async Task<byte[]> LeesAsync(Stream bestand, long lengte, CancellationToken cancellationToken)
    {
        if (lengte <= 0)
        {
            throw new SchoolcontentValidatieFout(GeenBestand);
        }

        if (lengte > Kindtekeningregels.MaxBytes)
        {
            throw new SchoolcontentValidatieFout(TeGroot);
        }

        using var geheugen = new MemoryStream((int)lengte);
        var buffer = new byte[81920];
        int gelezen;
        while ((gelezen = await bestand.ReadAsync(buffer, cancellationToken)) > 0)
        {
            if (geheugen.Length + gelezen > Kindtekeningregels.MaxBytes)
            {
                throw new SchoolcontentValidatieFout(TeGroot);
            }

            geheugen.Write(buffer, 0, gelezen);
        }

        return geheugen.Length == 0
            ? throw new SchoolcontentValidatieFout(GeenBestand)
            : geheugen.ToArray();
    }

    /// <summary>
    /// Stores the drawing on the child's report at the moment, making the report on its first write and replacing the
    /// drawing that was there.
    /// <para>
    /// <b>Two first writes at once</b> (two co-teachers, or a drawing and a text a moment apart) both find no report, or no
    /// drawing, and both make one; the unique index on (leerling, moment) or the drawing's key refuses the second, which is
    /// then applied once more to what the first wrote, as <see cref="OntwikkelingsrapportService"/> does. The later
    /// drawing wins.
    /// </para>
    /// </summary>
    private async Task<Kindtekening> SchrijfAsync(
        Guid leerlingId,
        int moment,
        HerwerkteTekening beeld,
        CancellationToken cancellationToken)
    {
        try
        {
            return await SchrijfEenmaalAsync(leerlingId, moment, beeld, cancellationToken);
        }
        catch (DbUpdateException fout) when (fout.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            TableName: "ontwikkelingsrapporten" or "kindtekeningen",
        })
        {
            _db.ChangeTracker.Clear();
            return await SchrijfEenmaalAsync(leerlingId, moment, beeld, cancellationToken);
        }
    }

    private async Task<Kindtekening> SchrijfEenmaalAsync(
        Guid leerlingId,
        int moment,
        HerwerkteTekening beeld,
        CancellationToken cancellationToken)
    {
        var rapport = await _db.Ontwikkelingsrapporten
            .SingleOrDefaultAsync(r => r.LeerlingId == leerlingId && r.Moment == moment, cancellationToken);

        if (rapport is null)
        {
            rapport = new Rapportentiteit(leerlingId, moment);
            _db.Ontwikkelingsrapporten.Add(rapport);
        }

        var tekening = await _db.Kindtekeningen
            .SingleOrDefaultAsync(t => t.OntwikkelingsrapportId == rapport.Id, cancellationToken);

        if (tekening is null)
        {
            tekening = new Kindtekening(rapport.Id, beeld.Formaat, beeld.Breedte, beeld.Hoogte, beeld.Inhoud);
            _db.Kindtekeningen.Add(tekening);
        }
        else
        {
            tekening.Vervang(beeld.Formaat, beeld.Breedte, beeld.Hoogte, beeld.Inhoud);
        }

        await _db.SaveChangesAsync(cancellationToken);
        return tekening;
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
