using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// EF Core implementation of <see cref="IOpstapImportService"/> over <see cref="AppDbContext"/> —
/// the one sanctioned writer of official Op.stap reference data (Art. III.1).
/// <para>
/// <b>Upsert.</b> Identity is <see cref="Leerplandoel.Code"/> (Art. III.5). For one discipline, the
/// service loads the persisted leerplandoelen, diffs them against the parsed file, then: inserts new
/// codes, refreshes the official content of changed codes via
/// <see cref="Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry.CurrentValues"/>
/// <c>.SetValues</c> (which writes through EF's property metadata, so the domain entity keeps its
/// private setters and stays immutable to ordinary app code), and leaves identical rows untouched.
/// Re-import is therefore idempotent: importing the same file twice changes nothing.
/// </para>
/// <para>
/// <b>Non-destructive guarantee (the headline AC, Art. III.4 / IV.2 / FR-2.5).</b> A code that is in
/// the database for this discipline but absent from the new file is only removed when <b>nothing</b>
/// references it. If a teacher <c>DoelKoppeling</c> still points at it (the FK is <c>Restrict</c>), it
/// is <b>flagged</b> (<see cref="Leerplandoel.NietMeerInOpstap"/> = true) and kept, so the link — and
/// any jaarplan built on it — survives. Teacher decisions (<c>aanvaard</c>/<c>geweigerd</c>/
/// <c>manueel</c>) are never touched by this path; the service only ever writes curriculum rows.
/// </para>
/// <para>
/// <b>Disappeared-goal policy (Art. XIV seam).</b> A goal that vanished from Op.stap is <b>never</b>
/// deleted by default — referenced <i>or</i> not. The safe, non-destructive default is <i>flag and
/// keep</i> (<c>NietMeerInOpstap = true</c>); a referenced goal is kept because of the <c>Restrict</c>
/// FK, and an unreferenced goal is kept because preserving data and requiring an explicit opt-in to
/// purge is the conservative reading of Art. III.4 / XIV. The purge is isolated to a single ctor
/// policy flag (<see cref="VerwijderVerweesdeNietGekoppeldeStandaard"/>, opt-in), so enabling it is a
/// one-line change that never touches the diff or the link model.
/// </para>
/// <para>
/// <b>Empty/implausible-file guard.</b> An import whose parse result has <b>no valid rows</b> for the
/// discipline (an empty, partial, or wrong file) is <b>skipped</b>: the existing rows are not treated
/// as a mass disappearance, nothing is flagged or deleted, and the diff carries a notice. Absence of
/// input is not a curriculum change (Art. III.4).
/// </para>
/// </summary>
public sealed class OpstapImportService : IOpstapImportService
{
    /// <summary>
    /// Policy seam (Art. XIV): when a goal disappears from Op.stap and is <b>not</b> referenced by any
    /// teacher content, should it be <b>removed</b> from the database? The conservative, non-destructive
    /// default is <c>false</c> — keep the stale row and flag it (<c>NietMeerInOpstap = true</c>) so the
    /// disappearance is visible without losing data. Referenced goals are always kept regardless. Set
    /// <c>true</c> only for an explicit directie "purge unused, disappeared goals" opt-in; nothing else
    /// changes. This is the registered default; an opt-in deployment can pass <c>true</c> to the ctor.
    /// </summary>
    public const bool VerwijderVerweesdeNietGekoppeldeStandaard = false;

    private readonly AppDbContext _context;
    private readonly bool _verwijderVerweesdeNietGekoppelde;

    public OpstapImportService(AppDbContext context)
        : this(context, VerwijderVerweesdeNietGekoppeldeStandaard)
    {
    }

    /// <summary>
    /// Constructs the import service with an explicit disappeared-unreferenced-goal purge policy. The
    /// DI default uses <see cref="VerwijderVerweesdeNietGekoppeldeStandaard"/> (false — flag-and-keep);
    /// the opt-in directie purge passes <c>true</c>.
    /// </summary>
    public OpstapImportService(AppDbContext context, bool verwijderVerweesdeNietGekoppelde)
    {
        _context = context;
        _verwijderVerweesdeNietGekoppelde = verwijderVerweesdeNietGekoppelde;
    }

    /// <inheritdoc />
    public async Task<OpstapImportResultaat> ImporteerAsync(
        OpstapParseResult parseResultaat,
        bool toepassen,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(parseResultaat);

        var disciplineNummer = parseResultaat.DisciplineNummer;

        // The parsed (incoming) goals, keyed by their stable identity. Last-wins on a duplicate code
        // within a file (the parser already reports row problems; here identity must stay unique).
        var inkomend = parseResultaat.Leerplandoelen
            .GroupBy(l => l.Code, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Last(), StringComparer.Ordinal);

        // The persisted goals for this discipline (tracked — we mutate official content here only).
        var bestaand = await _context.Leerplandoelen
            .Where(l => l.DisciplineNummer == disciplineNummer)
            .ToListAsync(cancellationToken);
        var bestaandPerCode = bestaand.ToDictionary(l => l.Code, StringComparer.Ordinal);

        // Empty/implausible-file guard (Art. III.4): if the file yielded no valid rows but the
        // discipline already has persisted goals, treating every existing goal as "disappeared"
        // would be a destructive over-reaction to a bad/partial/wrong upload. Skip instead — flag or
        // delete nothing — and surface a notice. (A genuinely first, empty import is simply a no-op.)
        if (inkomend.Count == 0 && bestaand.Count > 0)
        {
            var notice = new OpstapHerimportDiff(
                disciplineNummer,
                toegevoegd: [],
                gewijzigd: [],
                ongewijzigd: [],
                verdwenen: [],
                verdwenenMaarGekoppeld: [],
                overgeslagen: true,
                opmerkingen:
                [
                    $"Geen geldige leerplandoelen ingelezen voor discipline {disciplineNummer} — " +
                    $"niets toegepast. De {bestaand.Count} bestaande doelen blijven ongewijzigd " +
                    "(bestand mogelijk leeg, onvolledig of verkeerd).",
                ]);

            return new OpstapImportResultaat(notice, toegepast: false);
        }

        var toegevoegd = new List<string>();
        var gewijzigd = new List<LeerplandoelWijziging>();
        var ongewijzigd = new List<string>();
        var verdwenen = new List<string>();
        var verdwenenMaarGekoppeld = new List<VerdwenenGekoppeldDoel>();

        // --- Added & changed: walk the incoming file. ---
        foreach (var (code, nieuw) in inkomend)
        {
            if (!bestaandPerCode.TryGetValue(code, out var oud))
            {
                toegevoegd.Add(code);
                if (toepassen)
                {
                    _context.Leerplandoelen.Add(nieuw);
                }

                continue;
            }

            var velden = VeldVerschillen(oud, nieuw);
            // A goal that reappears in Op.stap is no longer "gone" — clear the review flag.
            var moetVlagWissen = oud.NietMeerInOpstap;

            if (velden.Count == 0 && !moetVlagWissen)
            {
                ongewijzigd.Add(code);
                continue;
            }

            if (velden.Count > 0)
            {
                gewijzigd.Add(new LeerplandoelWijziging(code, velden));
            }
            else
            {
                // No content change, but the row was flagged and is now present again.
                ongewijzigd.Add(code);
            }

            if (toepassen)
            {
                var entry = _context.Entry(oud);
                // Refresh official content through EF metadata (keeps the entity's private setters).
                entry.CurrentValues.SetValues(nieuw);
                // SetValues copies the incoming entity's NietMeerInOpstap (false) too, which correctly
                // clears any prior flag; set it explicitly to be unmistakable and robust to refactors.
                ZetReviewVlag(entry, false);
            }
        }

        // --- Disappeared: walk the persisted goals absent from the new file. ---
        var verdwenenCodes = bestaand
            .Where(l => !inkomend.ContainsKey(l.Code))
            .Select(l => l.Code)
            .ToList();

        if (verdwenenCodes.Count > 0)
        {
            var gekoppeldeAantallen = await KoppelingAantallenAsync(verdwenenCodes, cancellationToken);

            foreach (var code in verdwenenCodes)
            {
                var oud = bestaandPerCode[code];

                if (gekoppeldeAantallen.TryGetValue(code, out var aantal) && aantal > 0)
                {
                    // Still referenced by teacher content — never delete (FK Restrict, Art. IV.2).
                    // Flag for review instead; the link and any plan built on it survive intact.
                    verdwenenMaarGekoppeld.Add(new VerdwenenGekoppeldDoel(code, aantal));
                    if (toepassen)
                    {
                        ZetReviewVlag(_context.Entry(oud), true);
                    }
                }
                else
                {
                    verdwenen.Add(code);
                    if (toepassen && _verwijderVerweesdeNietGekoppelde)
                    {
                        // Opt-in directie purge only: remove the truly unused, disappeared row.
                        _context.Leerplandoelen.Remove(oud);
                    }
                    else if (toepassen)
                    {
                        // Conservative default: keep the stale row and flag it, so the disappearance
                        // is visible for review without destroying data (Art. III.4).
                        ZetReviewVlag(_context.Entry(oud), true);
                    }
                }
            }
        }

        if (toepassen)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }

        var diff = new OpstapHerimportDiff(
            disciplineNummer,
            toegevoegd,
            gewijzigd,
            ongewijzigd,
            verdwenen,
            verdwenenMaarGekoppeld);

        return new OpstapImportResultaat(diff, toepassen);
    }

    /// <summary>
    /// Sets the import-managed review flag through EF's property metadata, so the domain entity needs
    /// no public/internal mutator and stays immutable to ordinary app code (Art. III.1).
    /// </summary>
    private static void ZetReviewVlag(
        Microsoft.EntityFrameworkCore.ChangeTracking.EntityEntry<Leerplandoel> entry,
        bool value) =>
        entry.Property(l => l.NietMeerInOpstap).CurrentValue = value;

    /// <summary>
    /// Counts how many teacher links (across themadoelen, subdoelen and activity koppelingen)
    /// still reference each of the given leerplandoel codes. A non-zero count means the goal is
    /// in use and must not be deleted (Art. IV.2).
    /// </summary>
    private async Task<Dictionary<string, int>> KoppelingAantallenAsync(
        IReadOnlyCollection<string> codes,
        CancellationToken cancellationToken)
    {
        var codeSet = codes.ToHashSet(StringComparer.Ordinal);

        // The DoelKoppeling lands in three owned tables (themadoelen, subdoelen,
        // activiteiten_Doelkoppelingen). Union the referencing codes from each.
        var themadoelCodes = _context.Themadoelen
            .Where(td => codeSet.Contains(td.Koppeling.LeerplandoelCode))
            .Select(td => td.Koppeling.LeerplandoelCode);

        var subdoelCodes = _context.Subdoelen
            .Where(sd => codeSet.Contains(sd.Koppeling.LeerplandoelCode))
            .Select(sd => sd.Koppeling.LeerplandoelCode);

        var activiteitCodes = _context.Activiteiten
            .SelectMany(a => a.Doelkoppelingen)
            .Where(k => codeSet.Contains(k.LeerplandoelCode))
            .Select(k => k.LeerplandoelCode);

        var alle = await themadoelCodes
            .Concat(subdoelCodes)
            .Concat(activiteitCodes)
            .ToListAsync(cancellationToken);

        return alle
            .GroupBy(c => c, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);
    }

    /// <summary>
    /// Computes the field-level differences between a persisted leerplandoel and the re-imported one,
    /// over the official-content fields only (identity <c>code</c> is unchanged by definition).
    /// </summary>
    private static IReadOnlyList<VeldWijziging> VeldVerschillen(Leerplandoel oud, Leerplandoel nieuw)
    {
        var wijzigingen = new List<VeldWijziging>();

        Vergelijk(wijzigingen, nameof(Leerplandoel.Doelsoort), oud.Doelsoort.ToCode(), nieuw.Doelsoort.ToCode());
        Vergelijk(wijzigingen, nameof(Leerplandoel.JaarFase), oud.JaarFase, nieuw.JaarFase);
        Vergelijk(wijzigingen, nameof(Leerplandoel.Domein), oud.Domein, nieuw.Domein);
        Vergelijk(wijzigingen, nameof(Leerplandoel.Subdomein), oud.Subdomein, nieuw.Subdomein);
        Vergelijk(wijzigingen, nameof(Leerplandoel.Cluster), oud.Cluster, nieuw.Cluster);
        Vergelijk(wijzigingen, nameof(Leerplandoel.Tekst), oud.Tekst, nieuw.Tekst);
        Vergelijk(wijzigingen, nameof(Leerplandoel.Voorbeelden), oud.Voorbeelden, nieuw.Voorbeelden);
        Vergelijk(wijzigingen, nameof(Leerplandoel.Toelichting), oud.Toelichting, nieuw.Toelichting);
        Vergelijk(wijzigingen, nameof(Leerplandoel.Woordenschat), oud.Woordenschat, nieuw.Woordenschat);
        Vergelijk(wijzigingen, nameof(Leerplandoel.MinimumdoelRef), oud.MinimumdoelRef, nieuw.MinimumdoelRef);

        return wijzigingen;
    }

    private static void Vergelijk(ICollection<VeldWijziging> wijzigingen, string veld, string? oud, string? nieuw)
    {
        if (!string.Equals(oud, nieuw, StringComparison.Ordinal))
        {
            wijzigingen.Add(new VeldWijziging(veld, oud, nieuw));
        }
    }
}
