using System.Globalization;
using ClosedXML.Excel;
using Jaarplanner.Application.Dekking;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Infrastructure.Dekking;

/// <summary>
/// ClosedXML implementation of <see cref="IDekkingExport"/> (Art. VIII: ClosedXML/MIT, never EPPlus).
/// <para>
/// The document has two parts. A <b>kopblok</b> naming what this is a coverage figure <i>of</i>, and a table of one
/// row per in-scope leerplandoel. Both are needed for it to be evidence: the same class has two legitimate
/// denominators (<see cref="Dekkingsbereik"/>), so a bare list of goals proves nothing about which set it is a list
/// of, and a bare figure cannot be checked.
/// </para>
/// <para>
/// <b>All visible text is Dutch and composed here, which Art. II.3 permits since the 2026-07-30 amendment:</b> the
/// language of a message follows who it is for, and it may be generated server-side. The catalogue rule is scoped to
/// "copy the frontend authors itself", and a workbook is not that. There is precedent in this codebase
/// (<c>ClosedXmlSchoolcontentTemplateGenerator</c>, whose header row is Dutch for the same reason). <b>The obligation
/// that does travel with it</b> is that these sentences must not contradict the screen's, so each one below is
/// written from its counterpart in <c>nl.json</c>'s <c>dekking.*</c> block, including the singular/plural split that
/// block makes everywhere. There is no mechanism that keeps them in step: a copy change on the screen has to be
/// mirrored here by whoever makes it, and <c>DekkingExportTests</c> pins the facts rather than the wording.
/// </para>
/// <para>
/// <b>No em dashes anywhere</b> (Art. II.5, which names exported documents explicitly).
/// </para>
/// <para>
/// <b>It deliberately prints no percentage</b>, only the fraction the payload carries. The rounding rule for this
/// product's coverage percentage is documented and non-obvious (<c>dekkingFormat.ts</c> <c>bepaalPercentage</c>:
/// 0% and 100% are reserved for a genuinely empty and a genuinely complete numerator, everything between is clamped
/// into 1..99, so the figure can never contradict the fraction beside it). Reimplementing that here would make two
/// authorities for one number, which is the defect class E5-01 found when three places disagreed about which link
/// layers count. "2 van 14" cannot disagree with anything. If directie wants a percentage in the document, the fix is
/// to share one implementation, not to add a second.
/// </para>
/// </summary>
public sealed class ClosedXmlDekkingExport : IDekkingExport
{
    /// <summary>The media type for .xlsx (OOXML spreadsheet).</summary>
    public const string XlsxContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /// <summary>The worksheet name.</summary>
    private const string WerkbladNaam = "Dekking";

    /// <summary>
    /// The culture every date and number in the document is formatted with.
    /// <para>
    /// Explicit rather than <see cref="CultureInfo.CurrentCulture"/>, so the document does not depend on the host's
    /// locale. A proof document that says "8/6/2026" on one server and "6-8-2026" on another is ambiguous in the one
    /// place ambiguity costs the most, and the month name form used below removes even that question.
    /// </para>
    /// </summary>
    private static readonly CultureInfo Nl = CultureInfo.GetCultureInfo("nl-BE");

    /// <summary>
    /// The school's own time zone, for the "opgemaakt op" stamp.
    /// <para>
    /// A cloud host runs in UTC (Art. VI.3 puts this in an EU region, not in Belgium's zone), so an unlabelled
    /// timestamp would be up to two hours off the wall clock of the person reading it. The zone is therefore resolved
    /// explicitly and named in the document. <c>null</c> when the host has no such zone, in which case the stamp says
    /// UTC rather than silently meaning something else.
    /// </para>
    /// </summary>
    private static readonly TimeZoneInfo? SchoolZone = ZoekSchoolZone();

    private readonly TimeProvider _tijd;

    /// <param name="tijd">
    /// The clock for the "opgemaakt op" stamp. Injected rather than read from <c>DateTimeOffset.UtcNow</c> so a test
    /// can assert the stamp instead of asserting that a stamp exists.
    /// </param>
    public ClosedXmlDekkingExport(TimeProvider tijd) => _tijd = tijd;

    /// <inheritdoc />
    public DekkingExportbestand Genereer(DekkingWeergave dekking)
    {
        ArgumentNullException.ThrowIfNull(dekking);

        using var workbook = new XLWorkbook();
        var sheet = workbook.AddWorksheet(WerkbladNaam);

        var kopregel = SchrijfKopblok(sheet, dekking);
        SchrijfTabel(sheet, dekking, kopregel);

        var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        return new DekkingExportbestand(stream, Bestandsnaam(dekking), XlsxContentType);
    }

    /// <summary>
    /// Writes the kopblok and returns the row the table header goes on.
    /// </summary>
    private int SchrijfKopblok(IXLWorksheet sheet, DekkingWeergave dekking)
    {
        var rij = 1;

        var titel = sheet.Cell(rij, 1);
        titel.Value = "Dekkingsoverzicht";
        titel.Style.Font.Bold = true;
        titel.Style.Font.FontSize = 14;
        rij += 2;

        rij = SchrijfVeld(sheet, rij, "Klas", dekking.KlasNaam);
        rij = SchrijfVeld(sheet, rij, "Schooljaar", dekking.SchooljaarNaam);
        rij = SchrijfVeld(sheet, rij, "Gemeten tegen", BereikZin(dekking));

        // Only when something was actually left out. "0 ingeladen doelen horen bij een ander jaar" is noise, and the
        // whole-curriculum scope leaves nothing out by definition.
        if (dekking.AantalBuitenBereik > 0)
        {
            rij = SchrijfVeld(sheet, rij, "Buiten dit overzicht", BuitenBereikZin(dekking.AantalBuitenBereik));
        }

        rij = SchrijfVeld(sheet, rij, "Dekking", DekkingZin(dekking));
        rij = SchrijfVeld(sheet, rij, "Opgemaakt op", OpgemaaktOp());
        rij++;

        // Two document-level statements, both unconditional, both about what this file is NOT.
        //
        // The first is the honesty an inspectie-facing document owes about the level it does not report: dekking at
        // minimumdoelniveau is what the onderwijsinspectie tests (Art. V.2) and it does not exist yet (E5-04, blocked
        // on E1-12, because no `Minimumdoel` row can be created until directie supplies the decreed source). A file
        // titled "Dekkingsoverzicht" without this line invites precisely the conclusion the data cannot support. Same
        // substance as the screen's `dekking.alleenLeerplandoelen`.
        //
        // The second exists because of the owner ruling of 2026-08-06 that this export is always the full set in
        // scope. A teacher who exports while filtering on minimumdoelen, or with "alleen ontbrekende" pressed, gets a
        // file that is deliberately wider than their screen, and a reader who assumed otherwise would misread every
        // number in the kopblok. Said in the document rather than only beside the download link, because the file
        // outlives the screen it came from.
        rij = SchrijfNoot(
            sheet,
            rij,
            "Dit overzicht gaat over leerplandoelen. Dekking op het niveau van de minimumdoelen, wat de " +
            "onderwijsinspectie toetst, zit er nog niet in: die doelen moeten eerst ingeladen worden en dat " +
            "overzicht moet nog gebouwd worden.");
        rij = SchrijfNoot(
            sheet,
            rij,
            "Dit bestand bevat alle doelen die in dit overzicht meetellen. Wat je op het scherm filtert of " +
            "verbergt, verandert dit bestand niet.");

        return rij + 1;
    }

    /// <summary>Writes one label/value pair of the kopblok and returns the next row.</summary>
    private static int SchrijfVeld(IXLWorksheet sheet, int rij, string label, string waarde)
    {
        var labelCel = sheet.Cell(rij, 1);
        labelCel.Value = label;
        labelCel.Style.Font.Bold = true;

        // SetValue<string> rather than Value, so a klas named "+K3" or a sentence starting with '=' is stored as text
        // instead of being parsed as a formula. ClosedXML infers types from `Value`, and a school's own names are the
        // one place in this document where arbitrary user input lands.
        sheet.Cell(rij, 2).SetValue(waarde);

        return rij + 1;
    }

    /// <summary>Writes one full-width note line and returns the next row.</summary>
    private static int SchrijfNoot(IXLWorksheet sheet, int rij, string tekst)
    {
        sheet.Cell(rij, 1).SetValue(tekst);

        return rij + 1;
    }

    /// <summary>
    /// The sentence naming which leerplandoelen the figures are over.
    /// <para>
    /// The fallback case is checked first and stated as a fallback, because it is the one where the document differs
    /// from what the reader asked for: a graadklas has no single <c>Leerjaar</c> to derive a jaar/fase from, so the
    /// computation widens to the whole curriculum (never narrows, since a narrower scope would flatter the figure).
    /// Printing "het hele ingeladen curriculum" there without saying why would hide the open half of the Art. XIV
    /// decision inside a document meant to prove something.
    /// </para>
    /// </summary>
    private static string BereikZin(DekkingWeergave dekking)
    {
        if (dekking.IsTerugvalNaarHeelCurriculum)
        {
            return "het hele ingeladen curriculum, omdat van deze klas geen jaar of fase bekend is.";
        }

        if (dekking.Bereik == Dekkingsbereik.HeelCurriculum || dekking.GemetenJaarFasen.Count == 0)
        {
            return "alles wat de school heeft ingeladen, dus ook de doelen van andere jaren en fases.";
        }

        var fasen = Opsomming(dekking.GemetenJaarFasen);

        return dekking.GemetenJaarFasen.Count == 1
            ? $"de doelen van {fasen}."
            : $"de doelen van {fasen} samen. Van deze klas is niet één leerjaar bekend, dus staan er ook doelen " +
              "van de andere genoemde jaren in dit overzicht, en die tellen mee als niet gedekt.";
    }

    /// <summary>How many loaded doelen were left out, singular and plural like the screen's counterpart.</summary>
    private static string BuitenBereikZin(int aantal) =>
        aantal == 1
            ? "1 ingeladen doel hoort bij een ander jaar of een andere fase en blijft hier buiten."
            : $"{aantal.ToString(Nl)} ingeladen doelen horen bij een ander jaar of een andere fase en blijven " +
              "hier buiten.";

    /// <summary>
    /// The figure, or the reason there is none.
    /// <para>
    /// <b>The withheld branch is the one that matters</b> (directie 2026-07-28). While a stale placement is
    /// unresolved the plan cannot report trustworthy coverage, and <see cref="DekkingWeergave.AantalGedekt"/> is
    /// <c>null</c> so that no caller can print the number anyway. This document is the caller with the strongest
    /// temptation to, since it is the one that gets handed to somebody.
    /// </para>
    /// <para>
    /// Both conditions are checked, not just the flag, for the reason <c>bepaalCijfer</c> gives on the browser side:
    /// the flag and the value must never disagree, and disagreement resolves towards withholding.
    /// </para>
    /// </summary>
    private static string DekkingZin(DekkingWeergave dekking)
    {
        if (dekking.AantalLeerplandoelen == 0)
        {
            return "Nog niets om tegen te meten. Voor deze klas staan er nog geen leerplandoelen in de tool.";
        }

        if (!dekking.IsBetrouwbaar || dekking.AantalGedekt is not int gedekt)
        {
            return "Nog geen betrouwbaar cijfer. " + OnopgelostZin(dekking.AantalOnopgelosteVervallenPlaatsingen);
        }

        var totaal = dekking.AantalLeerplandoelen;

        return totaal == 1
            ? $"{gedekt.ToString(Nl)} van 1 doel gedekt."
            : $"{gedekt.ToString(Nl)} van {totaal.ToString(Nl)} doelen gedekt.";
    }

    /// <summary>Why no figure is given, singular and plural like the screen's counterpart.</summary>
    private static string OnopgelostZin(int aantal) =>
        aantal == 1
            ? "1 plaatsing in dit jaarplan wacht nog op een beslissing: haar periode bestaat niet meer. Zolang " +
              "dat zo is, geeft dit overzicht geen cijfer."
            : $"{aantal.ToString(Nl)} plaatsingen in dit jaarplan wachten nog op een beslissing: hun periode " +
              "bestaat niet meer. Zolang dat zo is, geeft dit overzicht geen cijfer.";

    /// <summary>
    /// The moment the document was made, in the school's own time zone and naming it.
    /// <para>
    /// Dekking is computed on every read and changes the moment a teacher accepts or moves anything (Art. V.1), so
    /// two exports of the same class can legitimately disagree. Without a stamp there is no way to tell which of two
    /// printouts is the current one, and "proof of coverage" that cannot be located in time is not proof of much.
    /// </para>
    /// </summary>
    private string OpgemaaktOp()
    {
        var nu = _tijd.GetUtcNow();

        if (SchoolZone is null)
        {
            return $"{nu.UtcDateTime.ToString("d MMMM yyyy 'om' HH:mm", Nl)} (UTC)";
        }

        var lokaal = TimeZoneInfo.ConvertTime(nu, SchoolZone);

        return lokaal.ToString("d MMMM yyyy 'om' HH:mm", Nl);
    }

    /// <summary>
    /// Writes the table: header row from the single-source column list, then one row per in-scope leerplandoel.
    /// </summary>
    private static void SchrijfTabel(IXLWorksheet sheet, DekkingWeergave dekking, int kopregel)
    {
        foreach (var kolom in DekkingKolommen.Alle)
        {
            var cel = sheet.Cell(kopregel, (int)kolom);
            cel.Value = DekkingKolommen.Label(kolom);
            cel.Style.Font.Bold = true;

            sheet.Column((int)kolom).Width = DekkingKolommen.Breedte(kolom);
        }

        var rij = kopregel + 1;

        // In the order the server sent them: (domein, subdomein, code), ordinally. Deliberately not re-sorted here.
        // The server documents that ordering as host-independent precisely so the screen, the register and this
        // document agree, and a culture-aware sort here would quietly disagree with all three.
        foreach (var doel in dekking.Doelen)
        {
            sheet.Cell(rij, (int)DekkingKolom.Code).SetValue(doel.Code);
            sheet.Cell(rij, (int)DekkingKolom.Doelsoort).SetValue(doel.Doelsoort.ToCode());
            sheet.Cell(rij, (int)DekkingKolom.JaarFase).SetValue(doel.JaarFase);
            sheet.Cell(rij, (int)DekkingKolom.Domein).SetValue(doel.Domein);
            sheet.Cell(rij, (int)DekkingKolom.Subdomein).SetValue(doel.Subdomein);
            sheet.Cell(rij, (int)DekkingKolom.Leerplandoel).SetValue(doel.Tekst);
            sheet.Cell(rij, (int)DekkingKolom.Minimumdoel).SetValue(doel.MinimumdoelRef ?? string.Empty);
            sheet.Cell(rij, (int)DekkingKolom.Gedekt).SetValue(doel.IsGedekt ? "Ja" : "Nee");

            // ';'-separated, the same list convention the import template uses, so a name containing a comma stays
            // one name. Empty exactly when the doel is not covered, which is the payload's own guarantee.
            sheet.Cell(rij, (int)DekkingKolom.DekkendeThemas).SetValue(string.Join("; ", doel.DekkendeThemas));

            // Only marked when true. A "Nee" in every row of a column that is almost always empty reads as data.
            sheet.Cell(rij, (int)DekkingKolom.NietMeerInOpstap)
                .SetValue(doel.NietMeerInOpstap ? "Niet meer in Op.stap" : string.Empty);

            sheet.Cell(rij, (int)DekkingKolom.Leerplandoel).Style.Alignment.WrapText = true;

            rij++;
        }

        // Freeze everything above the first data row, so the kopblok and the column names stay put while a directie
        // scrolls a few hundred goals, and give the table a filter. Both are ordinary spreadsheet affordances; they
        // are the reason a spreadsheet is a reasonable answer to "prove this" in the first place.
        sheet.SheetView.FreezeRows(kopregel);

        if (dekking.Doelen.Count > 0)
        {
            sheet.Range(kopregel, 1, rij - 1, (int)DekkingKolommen.Laatste).SetAutoFilter();
        }
    }

    /// <summary>
    /// The download filename: it names the klas and the schooljaar.
    /// <para>
    /// A school accumulates one of these per class per year, so "dekking.xlsx" in a downloads folder identifies
    /// nothing. Non-filename characters are replaced rather than stripped, so two classes cannot collapse onto one
    /// name; accented letters are kept, because ASP.NET Core encodes a non-ASCII <c>Content-Disposition</c> filename
    /// per RFC 6266/5987 and every target browser reads it.
    /// </para>
    /// </summary>
    private static string Bestandsnaam(DekkingWeergave dekking) =>
        $"dekking-{Veilig(dekking.KlasNaam)}-{Veilig(dekking.SchooljaarNaam)}.xlsx";

    /// <summary>
    /// One name, reduced to something a filesystem accepts on every platform: letters and digits kept, everything
    /// else becomes a single hyphen.
    /// </summary>
    private static string Veilig(string naam)
    {
        var gebouwd = new System.Text.StringBuilder(naam.Length);

        foreach (var teken in naam)
        {
            if (char.IsLetterOrDigit(teken))
            {
                gebouwd.Append(char.ToLowerInvariant(teken));
            }
            else if (gebouwd.Length > 0 && gebouwd[^1] != '-')
            {
                // One hyphen per run of punctuation or whitespace, and never a leading one.
                gebouwd.Append('-');
            }
        }

        return gebouwd.ToString().TrimEnd('-') is { Length: > 0 } schoon ? schoon : "onbekend";
    }

    /// <summary>A Dutch enumeration: "K3", "JK en K2", "JK, K2 en K3".</summary>
    private static string Opsomming(IReadOnlyList<string> delen) =>
        delen.Count switch
        {
            0 => string.Empty,
            1 => delen[0],
            _ => $"{string.Join(", ", delen.Take(delen.Count - 1))} en {delen[^1]}",
        };

    /// <summary>
    /// Resolves the school's time zone once. IANA id, which .NET maps on Windows too since it uses ICU; the Windows
    /// id is tried as a fallback for a host built with the legacy NLS mapping.
    /// </summary>
    private static TimeZoneInfo? ZoekSchoolZone()
    {
        foreach (var id in new[] { "Europe/Brussels", "W. Europe Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(id);
            }
            catch (TimeZoneNotFoundException)
            {
                // Try the next spelling; a host with neither gets a UTC stamp that says UTC.
            }
            catch (InvalidTimeZoneException)
            {
                // Corrupt zone data on this host. Same fallback.
            }
        }

        return null;
    }
}
