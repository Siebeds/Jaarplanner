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

        if (transactie is not null)
        {
            _context.Opstapversies.Add(new Opstapversie(bron.Versie, bron.Hash, _tijd.GetUtcNow()));
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
            Toegepast: toepassen);
    }

    /// <summary>
    /// The notice for a discipline KOV publishes that the seeded taxonomy (Art. VII.0) does not hold. Dutch, because
    /// directie reads it; it says only what holds: the source has it, the application does not, nothing was read.
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
