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
/// <para>
/// <b>Integrity preflight (E1-15).</b> Before any diffing, the service checks the three preconditions
/// that the database would otherwise refuse at <c>SaveChanges</c>: the discipline must be one of the
/// seeded official ones, no incoming <c>code</c> may already belong to another discipline, and every
/// concordance key must resolve to a loaded <c>Minimumdoel</c>. Each failure raises an
/// <see cref="OpstapImportFout"/>. Two reasons it lives here rather than at the caller: the checks need
/// the database, and running them <b>before</b> the write means the <i>preview</i> refuses exactly what
/// the commit refuses (FR-2.5). It changes nothing about <i>which</i> rows an importable file imports.
/// </para>
/// <para>
/// <b>Discipline-selection seam (E1-06, Art. XIV "Disciplines first").</b> Before touching any data
/// the service asks the injected <see cref="IDisciplineSelectie"/> whether the parse result's
/// discipline is in scope for import. The answer is <b>data-driven</b> (configuration/data), never a
/// discipline list compiled into this logic: "all" and "a starter selection" are two configured
/// outcomes of the same code. An out-of-scope discipline is <b>skipped</b> (no rows accepted,
/// nothing flagged or deleted) with a review notice — exactly as the empty-file guard behaves. The
/// directie's actual choice is left to runtime config (Art. XIV); this path only consults it.
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
    private readonly IDisciplineSelectie _disciplineSelectie;

    /// <summary>
    /// The DI constructor (E1-06): the discipline-selection seam is injected so the in-scope set is
    /// resolved from runtime configuration/data (Art. XIV), never compiled in. The disappeared-goal
    /// purge policy keeps its conservative default.
    /// </summary>
    public OpstapImportService(AppDbContext context, IDisciplineSelectie disciplineSelectie)
        : this(context, disciplineSelectie, VerwijderVerweesdeNietGekoppeldeStandaard)
    {
    }

    /// <summary>
    /// Constructs the import service with an explicit disappeared-unreferenced-goal purge policy. The
    /// DI default uses <see cref="VerwijderVerweesdeNietGekoppeldeStandaard"/> (false — flag-and-keep);
    /// the opt-in directie purge passes <c>true</c>. The discipline-selection seam is injected
    /// (Art. XIV); use this overload to combine an explicit selection with an explicit purge policy.
    /// </summary>
    public OpstapImportService(
        AppDbContext context,
        IDisciplineSelectie disciplineSelectie,
        bool verwijderVerweesdeNietGekoppelde)
    {
        _context = context;
        _disciplineSelectie = disciplineSelectie
            ?? throw new ArgumentNullException(nameof(disciplineSelectie));
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

        // Discipline-selection seam (E1-06, Art. XIV). The in-scope set is resolved from runtime
        // configuration/data — no discipline list is compiled in here. An out-of-scope discipline is
        // skipped before any data is touched: nothing is inserted, flagged, or deleted, and the diff
        // carries a review notice. This mirrors the empty-file guard: a discipline the directie has
        // not (yet) opted to import is not a curriculum change.
        if (!_disciplineSelectie.IsInScope(disciplineNummer))
        {
            // The notice is Dutch because the person running the import acts on it (Art. II.3). It names
            // no configuration key on purpose: widening the selection is an operator action, and the key
            // to change is `Opstap:DisciplineSelectie` (documented here, for the operator, in English).
            var buitenScope = new OpstapHerimportDiff(
                disciplineNummer,
                toegevoegd: [],
                gewijzigd: [],
                ongewijzigd: [],
                verdwenen: [],
                verdwenenMaarGekoppeld: [],
                overgeslagen: true,
                opmerkingen:
                [
                    $"Discipline {disciplineNummer} valt buiten de ingestelde importselectie " +
                    $"({_disciplineSelectie.Omschrijving}). Er is niets ingelezen of gewijzigd. " +
                    "Neem deze discipline op in de importselectie als ze toch mee moet.",
                ]);

            return new OpstapImportResultaat(buitenScope, toegepast: false);
        }

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

        // Empty/implausible-file guard (Art. III.4): if the file yielded no valid rows, treating every existing
        // goal as "disappeared" would be a destructive over-reaction to a bad/partial/wrong upload. Skip
        // instead — flag or delete nothing — and surface a notice.
        //
        // The condition is `inkomend.Count == 0`, deliberately WITHOUT "&& bestaand.Count > 0". It used to carry
        // that second clause, on the reasoning that a first, empty import is simply a no-op — true of the data,
        // and false of the screen: with `overgeslagen: false` and no opmerkingen, E1-13's import screen showed
        // two green verdicts, offered "Doelen inlezen", and afterwards said "De doelen zijn ingelezen" for zero
        // doelen. That is exactly the control-that-does-nothing the E3-06 rule forbids, and the frontend guard
        // (`nietsInTeLezen`) keys on `overgeslagen`, so absence of input has to be a skip whether or not rows
        // already exist (E1-13 round-2 audit, MINOR 4).
        if (inkomend.Count == 0)
        {
            // Dutch inflects, so the count picks the sentence: "De 1 bestaande doelen blijven" is the plural
            // bug this repo has shipped five times, and E1-13 renders this notice on a screen (Art. II.3).
            // Three forms, not two: the zero case is the first import the widened condition now catches, and
            // "Het bestaande doel blijft ongewijzigd" would be a claim about a row that does not exist.
            var behouden = bestaand.Count switch
            {
                0 => "Er staan nog geen doelen voor deze discipline, dus er verandert ook niets.",
                1 => "Het bestaande doel blijft ongewijzigd.",
                _ => $"De {bestaand.Count} bestaande doelen blijven ongewijzigd.",
            };

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
                    $"Er zijn geen geldige leerplandoelen ingelezen voor discipline {disciplineNummer}, " +
                    $"dus is er niets toegepast. {behouden} " +
                    "Mogelijk is het bestand leeg, onvolledig of hoort het bij een andere discipline.",
                ]);

            return new OpstapImportResultaat(notice, toegepast: false);
        }

        // Integrity preflight (E1-15): refuse what the database would refuse, and refuse it identically on
        // the preview path, so an FR-2.5 review never green-lights an import that cannot land.
        await ControleerVoorwaardenAsync(disciplineNummer, inkomend, cancellationToken);

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
            try
            {
                await _context.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (VertaalIntegriteitsfout(ex, disciplineNummer) is { } fout)
            {
                // Belt and braces behind the preflight above (E1-15). The preflight answers the same three
                // questions before anything is written, so reaching here means the state changed under us
                // (a concurrent import, or a row inserted between the check and the commit). Translated to
                // the same typed fault so the Api never sees an Npgsql or EF type (Art. VIII); anything
                // this does not recognise keeps bubbling up, because a failed curriculum write must stay
                // loud rather than be disguised as a known case.
                //
                // The DbUpdateException travels along as the inner exception (set by VertaalIntegriteitsfout),
                // so the SQLSTATE, constraint name and table survive into the log. Discarding it here would
                // throw away the only useful artefact in the one situation that produces this path.
                throw fout;
            }
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
    /// The integrity preflight (E1-15): the three preconditions the database enforces, checked <b>before</b>
    /// anything is written so a preview refuses exactly what a commit refuses (FR-2.5). Each failure raises
    /// an <see cref="OpstapImportFout"/> with a Dutch explanation for whoever runs the import; none of them
    /// changes which rows an importable file imports.
    /// <para>
    /// Order matters: the discipline is checked first, because a mistyped discipline number can also trip
    /// the "code already loaded elsewhere" check and the advice for that case would then be useless
    /// (found by the E1-15 test-runner: on a loaded database the primary-key violation reached
    /// <c>SaveChanges</c> before the discipline foreign key, so the wrong message won).
    /// </para>
    /// </summary>
    private async Task ControleerVoorwaardenAsync(
        string disciplineNummer,
        IReadOnlyDictionary<string, Leerplandoel> inkomend,
        CancellationToken cancellationToken)
    {
        if (inkomend.Count == 0)
        {
            return;
        }

        // 1. The discipline must be one of the official, seeded Op.stap disciplines (Art. VII.0). Answered
        //    by the taxonomy table, so no discipline list is compiled in here either.
        var disciplineBestaat = await _context.Disciplines
            .AnyAsync(d => d.Nummer == disciplineNummer, cancellationToken);
        if (!disciplineBestaat)
        {
            throw OpstapImportFout.OnbekendeDiscipline(disciplineNummer);
        }

        // 2. No incoming code may already belong to another discipline. Refuse and inform the uploader:
        //    ratified policy (owner, 2026-07-31; see the RESOLVED entry in backlog/README.md). The code is
        //    the stable identity (Art. III.5), so moving one between disciplines is a curriculum change a
        //    human confirms, not something an upload decides.
        var codes = inkomend.Keys.ToList();
        var elders = await _context.Leerplandoelen
            .Where(l => codes.Contains(l.Code) && l.DisciplineNummer != disciplineNummer)
            .OrderBy(l => l.Code)
            // One more than the notice will name, which is all it takes to know the list was truncated.
            .Take(OpstapImportFout.MaxGenoemdeVoorbeelden + 1)
            .Select(l => new DoelInAndereDiscipline(l.Code, l.DisciplineNummer))
            .ToListAsync(cancellationToken);
        if (elders.Count > 0)
        {
            throw OpstapImportFout.CodeInAndereDiscipline(disciplineNummer, elders);
        }

        // 3. Every concordance key must resolve to a loaded Minimumdoel: MinimumdoelRef is a Restrict FK, and
        //    nothing can insert a Minimumdoel until the decreed source lands (E1-12), so an MD-concorded row
        //    cannot be persisted. Because the import commits in one transaction, one such row blocks the
        //    whole file — which is exactly why the reviewer must hear it on the preview.
        var refs = inkomend.Values
            .Select(l => l.MinimumdoelRef)
            .Where(r => r is not null)
            .Select(r => r!)
            .Distinct(StringComparer.Ordinal)
            .ToList();
        if (refs.Count > 0)
        {
            var gekend = await _context.Minimumdoelen
                .Where(m => refs.Contains(m.Ref))
                .Select(m => m.Ref)
                .ToListAsync(cancellationToken);
            var ontbrekend = refs.Except(gekend, StringComparer.Ordinal).OrderBy(r => r, StringComparer.Ordinal).ToList();
            if (ontbrekend.Count > 0)
            {
                throw OpstapImportFout.OntbrekendeMinimumdoelen(ontbrekend);
            }
        }
    }

    /// <summary>
    /// Translates a PostgreSQL integrity violation into the typed <see cref="OpstapImportFout"/>, or returns
    /// <c>null</c> when it is not one of the known cases (which must then keep bubbling up). This is the one
    /// place that reads a SQLSTATE for the import path, and it lives in Infrastructure with the DbContext,
    /// not in the Api (Art. VIII).
    /// <para>
    /// It knows the constraint that broke but not <i>which</i> refs or codes offended, so it calls the same
    /// <see cref="OpstapImportFout"/> factories as the preflight with an empty detail list: the wording has
    /// exactly one source per case, and the only difference between the two paths is that this one names no
    /// examples (Art. II.3 clause 3). The <see cref="DbUpdateException"/> travels as the inner exception,
    /// because this path is only reachable through a concurrency anomaly and the SQLSTATE is then the only
    /// artefact worth logging.
    /// </para>
    /// </summary>
    private static OpstapImportFout? VertaalIntegriteitsfout(DbUpdateException ex, string disciplineNummer)
    {
        if (ex.InnerException is not Npgsql.PostgresException fout)
        {
            return null;
        }

        var constraint = fout.ConstraintName ?? string.Empty;

        return (fout.SqlState, constraint) switch
        {
            ("23503", var c) when c.Contains("minimumdoel", StringComparison.OrdinalIgnoreCase) =>
                OpstapImportFout.OntbrekendeMinimumdoelen([], ex),
            ("23503", var c) when c.Contains("discipline", StringComparison.OrdinalIgnoreCase) =>
                OpstapImportFout.OnbekendeDiscipline(disciplineNummer, ex),
            ("23505", var c) when c.Contains("leerplandoelen", StringComparison.OrdinalIgnoreCase) =>
                OpstapImportFout.CodeInAndereDiscipline(disciplineNummer, [], ex),
            _ => null,
        };
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
