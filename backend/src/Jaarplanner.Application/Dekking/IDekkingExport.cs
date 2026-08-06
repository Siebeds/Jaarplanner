namespace Jaarplanner.Application.Dekking;

/// <summary>
/// Renders a computed <see cref="DekkingWeergave"/> as a downloadable document: the coverage overview as
/// <b>proof of coverage</b> (E5-06, FR-9.5, FR-11.2, Art. V.4).
/// <para>
/// <b>The port lives in Application and the ClosedXML implementation in Infrastructure</b>, which is a deliberate
/// departure from <c>ISchoolcontentTemplateGenerator</c>'s placement rather than an inconsistency. That interface
/// sits in Infrastructure beside its own implementation, and <b>E7-13</b> exists because the same mistake was made
/// with <c>ISchoolcontentParser</c>: an Application-facing port in Infrastructure inverts Art. VIII's dependency
/// direction. Repeating it here would have added a third instance to a story already filed to fix two.
/// </para>
/// <para>
/// <b>The format is Excel (.xlsx), by owner ruling of 2026-08-06, and the reason is worth keeping.</b> ClosedXML is
/// already in the stack for both import paths (MIT, no EPPlus per Art. VIII), so no dependency is added; and more
/// importantly a spreadsheet has <i>no page layout</i>, which is exactly what Art. XIV reserves for directie
/// (*"Export formats: PDF, Excel, or both; which layout (inspectie / klassenmap)"*). <b>E5-07 is <c>[!]</c> on that
/// very decision.</b> Choosing Excel therefore satisfies FR-9.5 today without pre-empting a ruling this story is not
/// entitled to take. A PDF rides on E5-07's ruling.
/// </para>
/// <para>
/// <b>What this document may never do</b>, because the whole point of it is that a directie can hand it over:
/// print a figure the screen withholds. <see cref="DekkingWeergave.AantalGedekt"/> is <c>null</c> while a stale
/// placement is unresolved (directie 2026-07-28), and the implementation writes a sentence in that slot rather than a
/// number. The nullable type is what makes that enforceable rather than merely intended.
/// </para>
/// </summary>
public interface IDekkingExport
{
    /// <summary>
    /// Builds the workbook for one already-computed coverage answer.
    /// <para>
    /// <b>It takes the computed answer rather than a klas id, so the export cannot compute anything of its own.</b>
    /// The endpoint calls <see cref="DekkingService"/> and hands the result here, which means the document is a
    /// rendering of the same record the JSON endpoint returns for the same scope. There is no second query and no
    /// second definition of <i>gedekt</i> to drift from Art. V.1 (the class of defect E5-01 found when the codebase
    /// held three answers to which link layers count).
    /// </para>
    /// </summary>
    /// <param name="dekking">The coverage to render, exactly as computed for the requested scope.</param>
    /// <returns>
    /// The workbook, its filename and its content type together, so a caller cannot pair .xlsx bytes with a
    /// disagreeing extension or media type.
    /// </returns>
    DekkingExportbestand Genereer(DekkingWeergave dekking);
}

/// <summary>
/// A generated export: the bytes plus how to serve them.
/// </summary>
/// <param name="Inhoud">
/// The document, as a seekable stream positioned at 0. The caller owns it (let the framework stream and dispose it).
/// </param>
/// <param name="Bestandsnaam">
/// The download filename, including its extension. Names the klas and the schooljaar, because a school ends up with
/// one of these per class per year and "dekking.xlsx" in a downloads folder is not evidence of anything.
/// </param>
/// <param name="ContentType">The media type matching <paramref name="Inhoud"/>.</param>
public sealed record DekkingExportbestand(MemoryStream Inhoud, string Bestandsnaam, string ContentType);
