using Jaarplanner.Application.Curriculum.Import;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// EF Core implementation of <see cref="IMinimumdoelImportService"/>: the one writer of the decreed minimumdoelen
/// (E1-12, Art. III.1, ADR-0032).
/// <para>
/// <b>Upsert on <see cref="Minimumdoel.Ref"/>.</b> A new ref is inserted; a ref whose decreed content changed is
/// refreshed through <c>CurrentValues.SetValues</c>, which writes through EF's metadata so the entity keeps its private
/// setters; an identical ref is left alone. Importing the same source twice changes nothing.
/// </para>
/// <para>
/// <b>Never deletes (Art. III.4).</b> A ref the source no longer names stays in the table, is reported as
/// <see cref="MinimumdoelImportDiff.Verdwenen"/> and, on apply, is flagged <see cref="Minimumdoel.NietMeerInOpstap"/>
/// (E1-21, the flag ADR-0032's consequences asked for); once flagged, a later import reports it as
/// <see cref="MinimumdoelImportDiff.EerderVerdwenen"/>, which writes nothing, and an import that finds it again reports it
/// as <see cref="MinimumdoelImportDiff.Teruggekeerd"/> and clears the flag (E1-22). A ref the
/// source still names but whose row the mapping refused is reported apart, as
/// <see cref="MinimumdoelImportDiff.NietIngelezen"/>, with its previous text and flag untouched: calling it "no longer
/// in the source" would tell a reviewer the decree dropped an eindterm it still contains.
/// </para>
/// <para>
/// <b>An empty source is a skip, not a disappearance.</b> If the source yields no usable row, nothing is written and the
/// report says so, for the same reason <see cref="OpstapImportService"/> skips an empty file: absence of input is not a
/// curriculum change. A <i>partial</i> read never reaches this class: the source refuses it (see
/// <see cref="OnderwijsdoelenApiBron"/>).
/// </para>
/// </summary>
public sealed class MinimumdoelImportService : IMinimumdoelImportService
{
    private readonly AppDbContext _context;
    private readonly IMinimumdoelBron _bron;

    /// <summary>Constructs the service.</summary>
    public MinimumdoelImportService(AppDbContext context, IMinimumdoelBron bron)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _bron = bron ?? throw new ArgumentNullException(nameof(bron));
    }

    /// <inheritdoc />
    public async Task<MinimumdoelImportResultaat> ImporteerAsync(
        bool toepassen,
        CancellationToken cancellationToken = default)
    {
        var bron = await _bron.HaalOpAsync(cancellationToken);

        if (bron.Minimumdoelen.Count == 0)
        {
            var overgeslagen = new MinimumdoelImportDiff(
                toegevoegd: [],
                gewijzigd: [],
                ongewijzigd: [],
                verdwenen: [],
                nietIngelezen: [],
                overgeslagen: true,
                opmerkingen:
                [
                    "De Op.stap-bron gaf geen bruikbare minimumdoelen terug. Er is niets ingelezen of gewijzigd.",
                ]);

            return new MinimumdoelImportResultaat(overgeslagen, bron.Problemen, Toegepast: false);
        }

        var bestaand = await _context.Minimumdoelen.ToListAsync(cancellationToken);
        var bestaandPerRef = bestaand.ToDictionary(m => m.Ref, StringComparer.Ordinal);
        var inkomendeRefs = bron.Minimumdoelen.Select(m => m.Ref).ToHashSet(StringComparer.Ordinal);
        // Every refused row is keyed by a well-formed uniqueCode (the source refuses a read with an unidentifiable row),
        // so a ref already in the table that appears here is still in the source; only its row was not imported.
        var genoemdMaarGeweigerd = bron.Problemen.Select(p => p.Sleutel).ToHashSet(StringComparer.Ordinal);

        var toegevoegd = new List<string>();
        var gewijzigd = new List<MinimumdoelWijziging>();
        var ongewijzigd = new List<string>();
        var teruggekeerd = new List<string>();

        foreach (var nieuw in bron.Minimumdoelen)
        {
            if (!bestaandPerRef.TryGetValue(nieuw.Ref, out var oud))
            {
                toegevoegd.Add(nieuw.Ref);
                if (toepassen)
                {
                    _context.Minimumdoelen.Add(nieuw);
                }

                continue;
            }

            var velden = Verschillen(oud, nieuw);
            if (velden.Count == 0)
            {
                if (oud.NietMeerInOpstap)
                {
                    // Present again after an import that flagged it: the content is the same, only the flag goes. A
                    // write, so it is reported as one rather than hidden among the unchanged (E1-22).
                    teruggekeerd.Add(nieuw.Ref);
                    if (toepassen)
                    {
                        ZetReviewVlag(oud, false);
                    }
                }
                else
                {
                    ongewijzigd.Add(nieuw.Ref);
                }

                continue;
            }

            gewijzigd.Add(new MinimumdoelWijziging(nieuw.Ref, velden));
            if (toepassen)
            {
                // SetValues copies every property, the leerplandoelen import's reason too, and the incoming row carries
                // none. A changed text or ordering says nothing about which goals refer to the minimumdoel, so the reason
                // stays until that import recomputes it (TB-010: the first import after it changes every row it touches).
                var reden = oud.ZonderLeerplandoelReden;
                var doelsets = oud.ZonderLeerplandoelDoelsets;
                var entry = _context.Entry(oud);
                entry.CurrentValues.SetValues(nieuw);
                entry.Property(m => m.ZonderLeerplandoelReden).CurrentValue = reden;
                entry.Property(m => m.ZonderLeerplandoelDoelsets).CurrentValue = doelsets;
                ZetReviewVlag(oud, false);
            }
        }

        var afwezig = bestaand.Where(m => !inkomendeRefs.Contains(m.Ref)).ToList();
        var nietIngelezen = afwezig
            .Select(m => m.Ref)
            .Where(genoemdMaarGeweigerd.Contains)
            .Order(StringComparer.Ordinal)
            .ToList();
        // Gone from the source: newly (the apply flags it, a write and a review item) or since an earlier import that
        // already flagged it (nothing to write, not a review item). Without the split a repeat fetch of an unchanged
        // source re-reported every flagged ref as gone and offered an apply that set a flag that was already set
        // (E1-22, antagonist round 1 MAJOR).
        var nietGenoemd = afwezig.Where(m => !genoemdMaarGeweigerd.Contains(m.Ref)).ToList();
        var verdwenen = nietGenoemd.Where(m => !m.NietMeerInOpstap).Select(m => m.Ref).Order(StringComparer.Ordinal).ToList();
        var eerderVerdwenen = nietGenoemd.Where(m => m.NietMeerInOpstap).Select(m => m.Ref).Order(StringComparer.Ordinal).ToList();

        if (toepassen)
        {
            foreach (var weg in verdwenen)
            {
                ZetReviewVlag(bestaandPerRef[weg], true);
                // A minimumdoel no longer in Op.stap keeps no reason for having no leerplandoel (E1-22 fix round 3):
                // "no goal refers to it" is unproven once its address is gone, and Minimumdoel says a flagged row has none.
                var entry = _context.Entry(bestaandPerRef[weg]);
                entry.Property(m => m.ZonderLeerplandoelReden).CurrentValue = null;
                entry.Property(m => m.ZonderLeerplandoelDoelsets).CurrentValue = null;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        var opmerkingen = new List<string>();
        if (verdwenen.Count > 0)
        {
            opmerkingen.Add(VerdwenenMelding(verdwenen.Count));
        }

        if (nietIngelezen.Count > 0)
        {
            opmerkingen.Add(NietIngelezenMelding(nietIngelezen.Count));
        }

        if (teruggekeerd.Count > 0)
        {
            opmerkingen.Add(TeruggekeerdMelding(teruggekeerd.Count));
        }

        var diff = new MinimumdoelImportDiff(
            toegevoegd.Order(StringComparer.Ordinal).ToList(),
            gewijzigd.OrderBy(w => w.Ref, StringComparer.Ordinal).ToList(),
            ongewijzigd.Order(StringComparer.Ordinal).ToList(),
            verdwenen,
            nietIngelezen,
            opmerkingen: opmerkingen,
            eerderVerdwenen: eerderVerdwenen,
            teruggekeerd: teruggekeerd.Order(StringComparer.Ordinal).ToList());

        return new MinimumdoelImportResultaat(diff, bron.Problemen, toepassen);
    }

    /// <summary>
    /// The notice for refs the source no longer names. Dutch, because admin reads it (Art. II.3), and inflected by
    /// count, because "1 minimumdoelen staan" is the plural bug this repo has shipped before. It says only what the code
    /// guarantees: the rows stay.
    /// </summary>
    public static string VerdwenenMelding(int aantal) =>
        aantal == 1
            ? "1 minimumdoel staat niet meer in de Op.stap-bron. Het blijft in de toepassing staan en wordt niet verwijderd."
            : $"{aantal} minimumdoelen staan niet meer in de Op.stap-bron. Ze blijven in de toepassing staan en worden niet verwijderd.";

    /// <summary>
    /// The notice for flagged refs the source names again with the same content (E1-22). It says what holds: the source
    /// has them again. It said, until fix round 2, that they were no longer marked "vervallen", a mark no screen shows on
    /// a minimumdoel (antagonist round 2, MINOR 3).
    /// </summary>
    public static string TeruggekeerdMelding(int aantal) =>
        aantal == 1
            ? "1 minimumdoel staat weer in de Op.stap-bron."
            : $"{aantal} minimumdoelen staan weer in de Op.stap-bron.";

    /// <summary>
    /// The notice for refs the source still names but whose row was not imported this time. It asserts only what holds
    /// for every cause, markup it cannot keep as well as an expired validity: the source lists them, they were not read
    /// in, and the text already in the application was not touched. The cause is an operator matter and stays in the
    /// English <c>Problemen</c> ("kon niet", the first wording, was false for an expiry the import chose to skip).
    /// </summary>
    public static string NietIngelezenMelding(int aantal) =>
        aantal == 1
            ? "1 minimumdoel staat nog in de Op.stap-bron maar werd niet ingelezen. De vorige tekst blijft staan."
            : $"{aantal} minimumdoelen staan nog in de Op.stap-bron maar werden niet ingelezen. De vorige teksten blijven staan.";

    /// <summary>
    /// Sets the import-managed flag through EF's metadata, so the entity needs no mutator and stays read-only to ordinary
    /// app code (Art. III.1), as <see cref="OpstapImportService"/> does for leerplandoelen.
    /// </summary>
    private void ZetReviewVlag(Minimumdoel minimumdoel, bool waarde) =>
        _context.Entry(minimumdoel).Property(m => m.NietMeerInOpstap).CurrentValue = waarde;

    private static List<VeldWijziging> Verschillen(Minimumdoel oud, Minimumdoel nieuw)
    {
        var velden = new List<VeldWijziging>();
        Vergelijk(velden, nameof(Minimumdoel.Leeftijd), oud.Leeftijd, nieuw.Leeftijd);
        Vergelijk(velden, nameof(Minimumdoel.Nr), oud.Nr, nieuw.Nr);
        Vergelijk(velden, nameof(Minimumdoel.Omschrijving), oud.Omschrijving, nieuw.Omschrijving);
        // The decree's ordering and kind (TB-010). A row imported before them reports them as changed on the next import,
        // which is how that import fills them in and how the reviewer sees that it does.
        Vergelijk(velden, nameof(Minimumdoel.Leergebied), oud.Leergebied, nieuw.Leergebied);
        Vergelijk(velden, nameof(Minimumdoel.Rubriek), oud.Rubriek, nieuw.Rubriek);
        Vergelijk(velden, nameof(Minimumdoel.Subrubriek), oud.Subrubriek, nieuw.Subrubriek);
        Vergelijk(velden, nameof(Minimumdoel.Soort), oud.Soort?.ToString(), nieuw.Soort?.ToString());
        return velden;
    }

    private static void Vergelijk(List<VeldWijziging> velden, string veld, string? oud, string? nieuw)
    {
        if (!string.Equals(oud, nieuw, StringComparison.Ordinal))
        {
            velden.Add(new VeldWijziging(veld, oud, nieuw));
        }
    }
}
