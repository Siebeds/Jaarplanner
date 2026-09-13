namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// The single sanctioned writer of the decreed minimumdoelen (E1-12, Art. III.1, ADR-0032). It reads
/// <see cref="IMinimumdoelBron"/>, compares with what the database holds, and on request applies the difference.
/// <para>
/// Non-destructive by design (Art. III.4): a minimumdoel that is absent from the source is <b>kept and reported</b>, never
/// deleted, because leerplandoelen concord to it through a Restrict FK and a vanished eindterm is a curriculum change a
/// human reviews. Identity is <see cref="Jaarplanner.Domain.Curriculum.Minimumdoel.Ref"/>, so importing the same source
/// twice changes nothing.
/// </para>
/// </summary>
public interface IMinimumdoelImportService
{
    /// <summary>Reads the source, computes the review report and, when <paramref name="toepassen"/> is true, applies it.</summary>
    /// <param name="toepassen">
    /// False for the preview (FR-2.5): nothing is written. True to commit the additions and changes.
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <exception cref="OpstapBronFout">
    /// The read of the source was refused as a whole (see <c>OnderwijsdoelenApiBron</c> for the causes). Nothing has been
    /// written.
    /// </exception>
    Task<MinimumdoelImportResultaat> ImporteerAsync(bool toepassen, CancellationToken cancellationToken = default);
}

/// <summary>The answer to one minimumdoelen import or preview.</summary>
/// <param name="Diff">The review report.</param>
/// <param name="Problemen">The source rows that were not imported (operator diagnostics, English).</param>
/// <param name="Toegepast">False for a preview, or when the import was skipped; true when changes were committed.</param>
public sealed record MinimumdoelImportResultaat(
    MinimumdoelImportDiff Diff,
    IReadOnlyList<MinimumdoelBronProbleem> Problemen,
    bool Toegepast);

/// <summary>
/// The reviewable report of one minimumdoelen import (FR-2.5): what the source adds, changes, leaves as it is, names
/// without it being imported, and no longer publishes, compared with the database.
/// </summary>
public sealed class MinimumdoelImportDiff
{
    /// <summary>Constructs the report.</summary>
    public MinimumdoelImportDiff(
        IReadOnlyList<string> toegevoegd,
        IReadOnlyList<MinimumdoelWijziging> gewijzigd,
        IReadOnlyList<string> ongewijzigd,
        IReadOnlyList<string> verdwenen,
        IReadOnlyList<string> nietIngelezen,
        bool overgeslagen = false,
        IReadOnlyList<string>? opmerkingen = null)
    {
        Toegevoegd = toegevoegd;
        Gewijzigd = gewijzigd;
        Ongewijzigd = ongewijzigd;
        Verdwenen = verdwenen;
        NietIngelezen = nietIngelezen;
        Overgeslagen = overgeslagen;
        Opmerkingen = opmerkingen ?? [];
    }

    /// <summary>Refs the source publishes that the database does not hold yet: these are inserted.</summary>
    public IReadOnlyList<string> Toegevoegd { get; }

    /// <summary>Refs in both whose decreed content differs: these are updated, with field detail.</summary>
    public IReadOnlyList<MinimumdoelWijziging> Gewijzigd { get; }

    /// <summary>Refs in both and identical: left untouched.</summary>
    public IReadOnlyList<string> Ongewijzigd { get; }

    /// <summary>
    /// Refs in the database that the source <b>no longer names at all</b>, neither as a usable row nor as a refused one.
    /// <b>Kept, never deleted</b>: leerplandoelen may concord to them (Restrict FK), and an eindterm leaving the decree is
    /// for a human to review, not for an import to act on.
    /// </summary>
    public IReadOnlyList<string> Verdwenen { get; }

    /// <summary>
    /// Refs in the database that the source <b>still names</b>, but whose row was not imported this time (the reason
    /// is in the result's <c>Problemen</c>). Their previous text stays as it was. Kept apart from <see cref="Verdwenen"/>
    /// because telling a reviewer that the decree dropped an eindterm it still contains would be false (Art. III.4).
    /// </summary>
    public IReadOnlyList<string> NietIngelezen { get; }

    /// <summary>
    /// True when the import was deliberately skipped, for example because the source returned no usable rows. The
    /// add/change/remove buckets are then empty and <see cref="Opmerkingen"/> says why.
    /// </summary>
    public bool Overgeslagen { get; }

    /// <summary>Notices for the person running the import, in Dutch because that person acts on them (Art. II.3).</summary>
    public IReadOnlyList<string> Opmerkingen { get; }

    /// <summary>
    /// True when the import ran, changes nothing in the database and left no stored minimumdoel unimported. A skipped
    /// import is never empty, because every stored minimumdoel went unread; a refused row for a ref that is not stored yet
    /// shows only in the result's <c>Problemen</c>.
    /// </summary>
    public bool IsLeeg =>
        !Overgeslagen && Toegevoegd.Count == 0 && Gewijzigd.Count == 0 && Verdwenen.Count == 0 && NietIngelezen.Count == 0;

    /// <summary>True when a human should look: a skip, a change, a disappearance, or a stored minimumdoel whose row was not imported.</summary>
    public bool VereistReview =>
        Overgeslagen || Gewijzigd.Count > 0 || Verdwenen.Count > 0 || NietIngelezen.Count > 0;
}

/// <summary>A minimumdoel whose decreed content changed in the source.</summary>
/// <param name="Ref">The minimumdoel ref.</param>
/// <param name="Velden">The per-field changes.</param>
public sealed record MinimumdoelWijziging(string Ref, IReadOnlyList<VeldWijziging> Velden);
