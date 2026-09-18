using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// EF Core implementation of <see cref="ILeerplandoelImportService"/> (E1-21, ADR-0032): reads one numbered snapshot
/// through <see cref="ILeerplandoelBron"/> and hands each discipline to <see cref="IOpstapImportService"/>, the same writer
/// the Excel route uses. Nothing about <i>how</i> a goal is inserted, refreshed, flagged or refused is decided here;
/// this class decides only what one import of the whole curriculum means.
/// <list type="bullet">
/// <item><b>One transaction per apply.</b> The shared writer saves per discipline. Wrapped in one transaction together
/// with the <see cref="Opstapversie"/> row, a refusal in any discipline (a concordance to a minimumdoel that is not
/// loaded, a code stored under another discipline) rolls back every discipline before it, so "er is niets gewijzigd" in
/// that refusal is true of the whole import. The preview writes nothing and needs none.</item>
/// <item><b>A discipline this application does not know is skipped, not refused.</b> The shared writer would answer 400
/// with advice for someone uploading a file. KOV adding a discipline is not that mistake, and the others can still be
/// imported, so the discipline is reported as skipped with a Dutch notice.</item>
/// <item><b>The apply pins the version.</b> It must name the version the preview showed; the record of it is written
/// only when the apply commits.</item>
/// </list>
/// </summary>
public sealed class LeerplandoelImportService : ILeerplandoelImportService
{
    private readonly AppDbContext _context;
    private readonly ILeerplandoelBron _bron;
    private readonly IOpstapImportService _importService;
    private readonly TimeProvider _tijd;

    /// <summary>Constructs the service.</summary>
    public LeerplandoelImportService(
        AppDbContext context,
        ILeerplandoelBron bron,
        IOpstapImportService importService,
        TimeProvider tijd)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _bron = bron ?? throw new ArgumentNullException(nameof(bron));
        _importService = importService ?? throw new ArgumentNullException(nameof(importService));
        _tijd = tijd ?? throw new ArgumentNullException(nameof(tijd));
    }

    /// <inheritdoc />
    public async Task<LeerplandoelImportResultaat> ImporteerAsync(
        string? versie,
        bool toepassen,
        CancellationToken cancellationToken = default)
    {
        if (toepassen && string.IsNullOrWhiteSpace(versie))
        {
            throw new ArgumentException(
                "An apply must name the version the preview showed, so it writes exactly what was reviewed.",
                nameof(versie));
        }

        var bron = await _bron.HaalOpAsync(versie, cancellationToken);

        var vorige = await _context.Opstapversies
            .AsNoTracking()
            .OrderByDescending(v => v.ToegepastOp)
            .ThenByDescending(v => v.Id)
            .Select(v => new OpstapversieWeergave(v.Versie, v.Hash, v.ToegepastOp))
            .FirstOrDefaultAsync(cancellationToken);
        var bekendeDisciplines = (await _context.Disciplines
                .AsNoTracking()
                .Select(d => d.Nummer)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        // The concordance as stored before this import, for the reason per minimumdoel below (E1-22 fix round 2).
        var verwijzingNaImport = await _context.Leerplandoelen
            .AsNoTracking()
            .Where(l => l.MinimumdoelRef != null)
            .Select(l => new { l.Code, l.MinimumdoelRef })
            .ToDictionaryAsync(l => l.Code, l => l.MinimumdoelRef!, StringComparer.Ordinal, cancellationToken);

        // Disposed without a commit on any exception, which rolls every discipline back.
        await using var transactie = toepassen
            ? await _context.Database.BeginTransactionAsync(cancellationToken)
            : null;

        var disciplines = new List<LeerplandoelDisciplineResultaat>();
        foreach (var discipline in bron.Disciplines)
        {
            var diff = bekendeDisciplines.Contains(discipline.DisciplineNummer)
                ? (await _importService.ImporteerAsync(
                    new OpstapParseResult(
                        discipline.DisciplineNummer,
                        discipline.Leerplandoelen,
                        [],
                        OpstapHerkomst.OpstapApi,
                        discipline.NietIngelezenCodes,
                        discipline.BuitenBereikCodes),
                    toepassen,
                    cancellationToken)).Diff
                : OnbekendeDiscipline(discipline);

            disciplines.Add(new LeerplandoelDisciplineResultaat(
                discipline.DisciplineNummer,
                discipline.DisciplineNaam,
                diff,
                discipline.OvergeslagenDoelsets,
                discipline.Problemen));
        }

        // What points at each minimumdoel once this import is written, the same for the preview as for the apply: the
        // stored concordance, with every goal of a discipline the shared writer took over replaced by its snapshot
        // version. A goal the snapshot dropped stays stored (flagged) and still points where it pointed, so its
        // minimumdoel keeps its place in the register and gets no reason (antagonist round 2, MINOR 1). Under the opt-in
        // purge an unlinked dropped goal would be removed and point nowhere; that policy is not registered.
        for (var i = 0; i < bron.Disciplines.Count; i++)
        {
            if (disciplines[i].Diff.Overgeslagen)
            {
                continue;
            }

            foreach (var doel in bron.Disciplines[i].Leerplandoelen)
            {
                if (doel.MinimumdoelRef is { } minimumdoelRef)
                {
                    verwijzingNaImport[doel.Code] = minimumdoelRef;
                }
                else
                {
                    verwijzingNaImport.Remove(doel.Code);
                }
            }
        }

        // Why a stored minimumdoel has no loaded leerplandoel (E1-22, owner ruling 2026-09-13 "Reden tonen"), derived from
        // this snapshot for every stored minimumdoel and written with the apply, so it always describes the loaded version.
        // No reason for one a stored goal points at, nor for one that is itself no longer in Op.stap: a goal may still
        // point at a withdrawn minimumdoel's old address, so "no goal refers to it" would be unproven. "No longer in
        // Op.stap" is read from this import's own read of KOV (a stored ref absent from the minimumdoelen index the source
        // resolved against) as well as from the flag the minimumdoelen import sets, which may not have run yet
        // (antagonist round 3, MINOR 1).
        var minimumdoelen = await _context.Minimumdoelen.ToListAsync(cancellationToken);
        var zonderReden = verwijzingNaImport.Values
            .Concat(minimumdoelen
                .Where(m => m.NietMeerInOpstap || bron.GepubliceerdeMinimumdoelen?.Contains(m.Ref) == false)
                .Select(m => m.Ref))
            .ToHashSet(StringComparer.Ordinal);
        var redenen = ZonderLeerplandoelBepaling.Bepaal(minimumdoelen.Select(m => m.Ref), bron, zonderReden);
        var redenGewijzigd = minimumdoelen
            .Where(m =>
                m.ZonderLeerplandoelReden != redenen[m.Ref].Reden ||
                !string.Equals(m.ZonderLeerplandoelDoelsets, redenen[m.Ref].Doelsets, StringComparison.Ordinal))
            .ToList();

        // What an apply writes (E1-22, antagonist round 1 MAJOR). A version equal to the last applied one does not make
        // this false by itself: a widened discipline selection makes the same snapshot add goals, which the diffs show.
        // A first apply counts as another version (antagonist round 2, MINOR 2): it records the first version, which is
        // what closes the Excel route (Art. VII.2) and what the reasons' "de doorgevoerde versie" refers to.
        var disciplinesSchrijven = disciplines.Any(d => d.Diff.SchrijftIets);
        var andereVersie = vorige is null ||
            !string.Equals(vorige.Versie, bron.Versie, StringComparison.Ordinal) ||
            !string.Equals(vorige.Hash, bron.Hash, StringComparison.Ordinal);
        var schrijftIets = disciplinesSchrijven || redenGewijzigd.Count > 0 || andereVersie;

        if (transactie is not null)
        {
            foreach (var minimumdoel in redenGewijzigd)
            {
                // Through EF's metadata, like the review flag: the entity has no mutator (Art. III.1).
                var entry = _context.Entry(minimumdoel);
                entry.Property(m => m.ZonderLeerplandoelReden).CurrentValue = redenen[minimumdoel.Ref].Reden;
                entry.Property(m => m.ZonderLeerplandoelDoelsets).CurrentValue = redenen[minimumdoel.Ref].Doelsets;
            }

            // The version is recorded when the curriculum rows changed or KOV's version did (a first apply included). An apply that only updates
            // reasons, or writes nothing, adds no row: a duplicate would move "doorgevoerd op" to today for a snapshot
            // that was already applied (antagonist round 1 MAJOR).
            if (disciplinesSchrijven || andereVersie)
            {
                _context.Opstapversies.Add(new Opstapversie(bron.Versie, bron.Hash, _tijd.GetUtcNow()));
            }

            await _context.SaveChangesAsync(cancellationToken);
            await transactie.CommitAsync(cancellationToken);
        }

        return new LeerplandoelImportResultaat(
            bron.Versie,
            bron.Hash,
            bron.SnapshotTijdstip,
            vorige,
            bron.Wijzigingslog,
            disciplines,
            bron.OvergeslagenDoelsets,
            bron.Problemen,
            Toegepast: toepassen,
            SchrijftIets: schrijftIets,
            AantalRedenenGewijzigd: redenGewijzigd.Count);
    }

    /// <summary>
    /// The notice for a discipline KOV publishes that the seeded taxonomy (Art. VII.0) does not hold. Dutch, because
    /// admin reads it; it says only what holds: the source has it, the application does not, nothing was read.
    /// </summary>
    public static string OnbekendeDisciplineMelding(string naam, string nummer) =>
        $"Discipline {nummer} ({naam}) staat in de Op.stap-bron maar niet in de toepassing. " +
        "Er is niets van ingelezen of gewijzigd.";

    private static OpstapHerimportDiff OnbekendeDiscipline(LeerplandoelBronDiscipline discipline) =>
        new(
            discipline.DisciplineNummer,
            toegevoegd: [],
            gewijzigd: [],
            ongewijzigd: [],
            verdwenen: [],
            verdwenenMaarGekoppeld: [],
            overgeslagen: true,
            opmerkingen: [OnbekendeDisciplineMelding(discipline.DisciplineNaam, discipline.DisciplineNummer)]);
}
