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
/// <b>Never deletes (Art. III.4).</b> A ref the source no longer names stays in the table and is reported as
/// <see cref="MinimumdoelImportDiff.Verdwenen"/>. A ref the source still names but whose row the mapping refused is
/// reported apart, as <see cref="MinimumdoelImportDiff.NietIngelezen"/>, with its previous text untouched: calling it
/// "no longer in the source" would tell a reviewer the decree dropped an eindterm it still contains. The row carries no
/// "no longer in Op.stap" flag yet; that needs a migration and belongs with E1-21 (ADR-0032, consequences).
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
        // A refused row is named by its uniqueCode when it has one, so a ref already in the table that appears here is
        // still in the source; only its row could not be read.
        var genoemdMaarGeweigerd = bron.Problemen.Select(p => p.Sleutel).ToHashSet(StringComparer.Ordinal);

        var toegevoegd = new List<string>();
        var gewijzigd = new List<MinimumdoelWijziging>();
        var ongewijzigd = new List<string>();

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
                ongewijzigd.Add(nieuw.Ref);
                continue;
            }

            gewijzigd.Add(new MinimumdoelWijziging(nieuw.Ref, velden));
            if (toepassen)
            {
                _context.Entry(oud).CurrentValues.SetValues(nieuw);
            }
        }

        var afwezig = bestaand.Where(m => !inkomendeRefs.Contains(m.Ref)).Select(m => m.Ref).ToList();
        var nietIngelezen = afwezig.Where(genoemdMaarGeweigerd.Contains).Order(StringComparer.Ordinal).ToList();
        var verdwenen = afwezig.Where(r => !genoemdMaarGeweigerd.Contains(r)).Order(StringComparer.Ordinal).ToList();

        if (toepassen)
        {
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

        var diff = new MinimumdoelImportDiff(
            toegevoegd.Order(StringComparer.Ordinal).ToList(),
            gewijzigd.OrderBy(w => w.Ref, StringComparer.Ordinal).ToList(),
            ongewijzigd.Order(StringComparer.Ordinal).ToList(),
            verdwenen,
            nietIngelezen,
            opmerkingen: opmerkingen);

        return new MinimumdoelImportResultaat(diff, bron.Problemen, toepassen);
    }

    /// <summary>
    /// The notice for refs the source no longer names. Dutch, because directie reads it (Art. II.3), and inflected by
    /// count, because "1 minimumdoelen staan" is the plural bug this repo has shipped before. It says only what the code
    /// guarantees: the rows stay.
    /// </summary>
    public static string VerdwenenMelding(int aantal) =>
        aantal == 1
            ? "1 minimumdoel staat niet meer in de Op.stap-bron. Het blijft in de toepassing staan en wordt niet verwijderd."
            : $"{aantal} minimumdoelen staan niet meer in de Op.stap-bron. Ze blijven in de toepassing staan en worden niet verwijderd.";

    /// <summary>
    /// The notice for refs the source still names but could not be read this time. It asserts only what that branch
    /// guarantees: the source lists them, and the text already in the application was not touched. Why a row was refused
    /// is an operator matter and stays in the English <c>Problemen</c>.
    /// </summary>
    public static string NietIngelezenMelding(int aantal) =>
        aantal == 1
            ? "1 minimumdoel staat nog in de Op.stap-bron maar kon niet ingelezen worden. De vorige tekst blijft staan."
            : $"{aantal} minimumdoelen staan nog in de Op.stap-bron maar konden niet ingelezen worden. De vorige tekst blijft staan.";

    private static List<VeldWijziging> Verschillen(Minimumdoel oud, Minimumdoel nieuw)
    {
        var velden = new List<VeldWijziging>();
        Vergelijk(velden, nameof(Minimumdoel.Leeftijd), oud.Leeftijd, nieuw.Leeftijd);
        Vergelijk(velden, nameof(Minimumdoel.Nr), oud.Nr, nieuw.Nr);
        Vergelijk(velden, nameof(Minimumdoel.Omschrijving), oud.Omschrijving, nieuw.Omschrijving);
        return velden;
    }

    private static void Vergelijk(List<VeldWijziging> velden, string veld, string oud, string nieuw)
    {
        if (!string.Equals(oud, nieuw, StringComparison.Ordinal))
        {
            velden.Add(new VeldWijziging(veld, oud, nieuw));
        }
    }
}
