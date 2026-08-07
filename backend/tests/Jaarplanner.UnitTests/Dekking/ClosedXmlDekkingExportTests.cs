using ClosedXML.Excel;
using Jaarplanner.Application.Dekking;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Infrastructure.Dekking;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// Pins the coverage export (E5-06, FR-9.5, FR-11.2, Art. V.4).
/// <para>
/// <b>The headline test is that a withheld figure is never printed as a number.</b> Everything else in this document
/// is a rendering job; that one is the directie ruling of 2026-07-28 landing in the artefact a school actually hands
/// to somebody, and the state is reachable (a stale placement is one calendar edit away). The test is written so it
/// fails on a number appearing <i>anywhere</i> in the kopblok rather than on one cell, because the defect would not
/// know which cell it was supposed to appear in.
/// </para>
/// <para>
/// These tests assert <b>facts</b> rather than wording wherever they can: which columns exist, that a covered doel
/// names its thema's, that no figure leaks. The two exceptions are the two statements the document makes about what it
/// is not (minimumdoelniveau, and screen filters not applying), which are asserted on substance because they exist
/// only as sentences and their absence is the whole risk.
/// </para>
/// </summary>
public class ClosedXmlDekkingExportTests
{
    /// <summary>A fixed clock, so the "opgemaakt op" stamp is assertable rather than merely present.</summary>
    private sealed class VasteTijd : TimeProvider
    {
        private readonly DateTimeOffset _nu;

        public VasteTijd(DateTimeOffset nu) => _nu = nu;

        public override DateTimeOffset GetUtcNow() => _nu;
    }

    /// <summary>
    /// A clock that jumps a whole day on every read.
    /// <para>
    /// <b>It exists because <see cref="VasteTijd"/> is blind to the defect it replaces</b> (antagonist round 2, MAJOR).
    /// The generator's comment claimed the kopblok stamp and the filename date could not name different days, while
    /// <c>Genereer</c> read the clock twice: once for the stamp and once for the name. A constant clock cannot
    /// distinguish one read from two, so the guarantee was untestable exactly where it was asserted. This one makes the
    /// number of reads observable: two reads produce two different days and the assertion fails.
    /// </para>
    /// </summary>
    private sealed class StappendeTijd : TimeProvider
    {
        private DateTimeOffset _nu;

        public StappendeTijd(DateTimeOffset start) => _nu = start;

        public int AantalAanroepen { get; private set; }

        public override DateTimeOffset GetUtcNow()
        {
            AantalAanroepen++;
            var huidig = _nu;
            _nu = _nu.AddDays(1);

            return huidig;
        }
    }

    /// <summary>2026-08-06 at 16:12 UTC, which is 18:12 in the school's own zone (CEST).</summary>
    private static readonly DateTimeOffset Middag =
        new(2026, 8, 6, 16, 12, 0, TimeSpan.Zero);

    private static IDekkingExport Export(DateTimeOffset? nu = null) =>
        new ClosedXmlDekkingExport(new VasteTijd(nu ?? Middag));

    private static LeerplandoelDekking Doel(
        string code,
        bool gedekt = false,
        Doelsoort doelsoort = Doelsoort.Gemeenschappelijk,
        string jaarFase = "K3",
        string? minimumdoelRef = null,
        bool nietMeerInOpstap = false,
        IReadOnlyList<string>? themas = null) =>
        new(
            code,
            doelsoort,
            jaarFase,
            "Levende natuur",
            "Dieren",
            $"De leerling kan {code} aantonen.",
            minimumdoelRef,
            nietMeerInOpstap,
            gedekt,
            themas ?? Array.Empty<string>());

    private static DekkingWeergave Weergave(
        IReadOnlyList<LeerplandoelDekking>? doelen = null,
        string klasNaam = "K3 derde kleuterklas",
        string schooljaarNaam = "2026-2027",
        Dekkingsbereik bereik = Dekkingsbereik.EigenJaarFase,
        IReadOnlyList<string>? gemetenJaarFasen = null,
        bool isTerugval = false,
        int aantalBuitenBereik = 0,
        bool isBetrouwbaar = true,
        int aantalOnopgeloste = 0,
        int? aantalGedekt = null)
    {
        var lijst = doelen ?? new[] { Doel("NC-1.1", gedekt: true, themas: new[] { "Herfst" }), Doel("NC-1.2") };

        return new DekkingWeergave(
            Guid.NewGuid(),
            klasNaam,
            Guid.NewGuid(),
            schooljaarNaam,
            bereik,
            gemetenJaarFasen ?? new[] { "K3" },
            new[] { "JK", "K2", "K3" },
            isTerugval,
            aantalBuitenBereik,
            isBetrouwbaar,
            aantalOnopgeloste,
            // Defaults to the honest count over the rows, which is what the server computes (DekkingService), so a
            // test that does not care about the figure cannot accidentally assert against a contradictory one.
            aantalGedekt ?? (isBetrouwbaar ? lijst.Count(d => d.IsGedekt) : null),
            lijst.Count,
            lijst);
    }

    /// <summary>Every non-empty cell in the sheet, as strings, so a test can assert over the whole document.</summary>
    private static List<string> AlleCellen(DekkingExportbestand bestand)
    {
        using var workbook = new XLWorkbook(bestand.Inhoud);

        return workbook.Worksheets.First()
            .CellsUsed()
            .Select(cel => cel.GetString())
            .Where(tekst => !string.IsNullOrWhiteSpace(tekst))
            .ToList();
    }

    private static IXLWorksheet Blad(DekkingExportbestand bestand, out XLWorkbook workbook)
    {
        workbook = new XLWorkbook(bestand.Inhoud);

        return workbook.Worksheets.First();
    }

    [Fact]
    public void Het_kopblok_noemt_de_klas_het_schooljaar_en_waartegen_gemeten_is()
    {
        var bestand = Export().Genereer(Weergave());

        var cellen = AlleCellen(bestand);

        Assert.Contains("K3 derde kleuterklas", cellen);
        Assert.Contains("2026-2027", cellen);
        // The scope is what makes the figures mean anything: the same class has two legitimate denominators.
        Assert.Contains(cellen, tekst => tekst.Contains("de doelen van K3", StringComparison.Ordinal));
    }

    [Fact]
    public void Een_ingehouden_cijfer_wordt_nooit_als_getal_afgedrukt()
    {
        // The reachable shape of the withheld state: the rows still carry isGedekt, so the number IS derivable from
        // this payload. That is exactly why the document may not print it (directie 2026-07-28).
        var doelen = new[]
        {
            Doel("NC-1.1", gedekt: true, themas: new[] { "Herfst" }),
            Doel("NC-1.2", gedekt: true, themas: new[] { "Winter" }),
            Doel("NC-1.3"),
        };

        var bestand = Export().Genereer(
            Weergave(doelen, isBetrouwbaar: false, aantalOnopgeloste: 2, aantalGedekt: null));

        var cellen = AlleCellen(bestand);
        var kopblok = cellen.Where(tekst => !tekst.StartsWith("NC-", StringComparison.Ordinal)).ToList();

        Assert.Contains(kopblok, tekst => tekst.Contains("Nog geen betrouwbaar cijfer", StringComparison.Ordinal));
        Assert.Contains(kopblok, tekst => tekst.Contains("2 plaatsingen", StringComparison.Ordinal));

        // The figure that must not appear, in either of the two forms the document would have used for it.
        Assert.DoesNotContain(kopblok, tekst => tekst.Contains("2 van 3", StringComparison.Ordinal));
        Assert.DoesNotContain(kopblok, tekst => tekst.Contains("doelen gedekt", StringComparison.Ordinal));
    }

    [Fact]
    public void Een_enkele_openstaande_plaatsing_krijgt_enkelvoud()
    {
        // The plural defect this repo has already shipped once ("1 weken", E3-09): a count interpolated into a plural
        // sentence. Every counted sentence in the document has a singular twin and each one needs its own guard.
        var bestand = Export().Genereer(
            Weergave(isBetrouwbaar: false, aantalOnopgeloste: 1, aantalGedekt: null));

        var cellen = AlleCellen(bestand);

        Assert.Contains(cellen, tekst => tekst.Contains("1 plaatsing in dit jaarplan wacht", StringComparison.Ordinal));
        Assert.DoesNotContain(cellen, tekst => tekst.Contains("1 plaatsingen", StringComparison.Ordinal));
    }

    [Fact]
    public void Een_betrouwbaar_cijfer_staat_er_als_breuk_zonder_percentage()
    {
        var doelen = new[]
        {
            Doel("NC-1.1", gedekt: true, themas: new[] { "Herfst" }),
            Doel("NC-1.2"),
            Doel("NC-1.3"),
        };

        var bestand = Export().Genereer(Weergave(doelen));

        var cellen = AlleCellen(bestand);

        Assert.Contains(cellen, tekst => tekst.Contains("1 van 3 doelen gedekt", StringComparison.Ordinal));

        // Deliberately no percentage: the rounding rule lives in the browser (bepaalPercentage, which reserves 0%
        // and 100% and clamps the rest into 1..99), and a second implementation of it here would be a second
        // authority for one number. "1 van 3" cannot contradict anything.
        Assert.DoesNotContain(cellen, tekst => tekst.Contains('%', StringComparison.Ordinal));
    }

    [Fact]
    public void Een_scope_van_een_enkel_doel_krijgt_enkelvoud()
    {
        var bestand = Export().Genereer(Weergave(new[] { Doel("NC-1.1", gedekt: true, themas: new[] { "Herfst" }) }));

        var cellen = AlleCellen(bestand);

        Assert.Contains(cellen, tekst => tekst.Contains("1 van 1 doel gedekt", StringComparison.Ordinal));
        Assert.DoesNotContain(cellen, tekst => tekst.Contains("van 1 doelen", StringComparison.Ordinal));
    }

    [Fact]
    public void De_volledige_set_in_bereik_krijgt_elk_een_rij()
    {
        // The owner ruling of 2026-08-06: the export is always the full set in scope. Gedekt and niet gedekt alike,
        // and every doelsoort, whatever the screen was filtered to when the link was followed.
        var doelen = new[]
        {
            Doel("NC-1.1", gedekt: true, doelsoort: Doelsoort.Minimumdoel, themas: new[] { "Herfst" }),
            Doel("NC-1.2", doelsoort: Doelsoort.Verdieping),
            Doel("NC-1.3", gedekt: true, doelsoort: Doelsoort.Gemeenschappelijk, themas: new[] { "Winter" }, jaarFase: "K3"),
        };

        var bestand = Export().Genereer(Weergave(doelen));
        var blad = Blad(bestand, out var workbook);
        using var _ = workbook;

        var codes = blad.Column((int)DekkingKolom.Code)
            .CellsUsed()
            .Select(cel => cel.GetString())
            .Where(tekst => tekst.StartsWith("NC-", StringComparison.Ordinal))
            .ToList();

        Assert.Equal(new[] { "NC-1.1", "NC-1.2", "NC-1.3" }, codes);
    }

    [Fact]
    public void De_kolomkoppen_zijn_exact_de_labels_uit_de_ene_bron_in_kolomorde()
    {
        var bestand = Export().Genereer(Weergave());
        var blad = Blad(bestand, out var workbook);
        using var _ = workbook;

        var kopregel = Kopregel(blad);

        foreach (var kolom in DekkingKolommen.Alle)
        {
            Assert.Equal(DekkingKolommen.Label(kolom), blad.Cell(kopregel, (int)kolom).GetString());
        }
    }

    [Fact]
    public void Een_gedekt_doel_noemt_zijn_themas_en_een_ongedekt_doel_noemt_niets()
    {
        var doelen = new[]
        {
            Doel("NC-1.1", gedekt: true, themas: new[] { "Herfst", "Winter" }),
            Doel("NC-1.2"),
        };

        var bestand = Export().Genereer(Weergave(doelen));
        var blad = Blad(bestand, out var workbook);
        using var _ = workbook;

        var eerste = Kopregel(blad) + 1;

        Assert.Equal("Ja", blad.Cell(eerste, (int)DekkingKolom.Gedekt).GetString());
        // The evidence half of Art. V: a document claiming coverage must say through what.
        Assert.Equal("Herfst; Winter", blad.Cell(eerste, (int)DekkingKolom.DekkendeThemas).GetString());

        Assert.Equal("Nee", blad.Cell(eerste + 1, (int)DekkingKolom.Gedekt).GetString());
        Assert.Equal(string.Empty, blad.Cell(eerste + 1, (int)DekkingKolom.DekkendeThemas).GetString());
    }

    [Fact]
    public void De_doelsoort_staat_er_als_officiele_Opstap_code()
    {
        var bestand = Export().Genereer(
            Weergave(new[] { Doel("NC-1.1", doelsoort: Doelsoort.Verdieping) }));

        var blad = Blad(bestand, out var workbook);
        using var _ = workbook;

        // From DoelsoortCodes, the single source (Art. III.3/VII.1), rather than the enum member name.
        Assert.Equal("+", blad.Cell(Kopregel(blad) + 1, (int)DekkingKolom.Doelsoort).GetString());
    }

    [Fact]
    public void Het_bestand_zegt_dat_het_minimumdoelniveau_er_niet_in_zit()
    {
        // Art. V.2's level is the one the onderwijsinspectie tests and E5-04 is blocked on E1-12, so a file titled
        // "Dekkingsoverzicht" that stays silent about it invites a conclusion the data cannot support.
        var cellen = AlleCellen(Export().Genereer(Weergave()));

        Assert.Contains(cellen, tekst =>
            tekst.Contains("minimumdoelen", StringComparison.Ordinal) &&
            tekst.Contains("onderwijsinspectie", StringComparison.Ordinal));
    }

    [Fact]
    public void Het_bestand_zegt_dat_schermfilters_er_niets_aan_veranderen()
    {
        // The other half of the owner ruling: this file is deliberately wider than the screen it came from, and it
        // outlives that screen, so it has to say so itself.
        var cellen = AlleCellen(Export().Genereer(Weergave()));

        Assert.Contains(cellen, tekst =>
            tekst.Contains("alle doelen die in dit overzicht meetellen", StringComparison.Ordinal));
    }

    [Fact]
    public void Nergens_in_het_bestand_staat_een_kastlijntje()
    {
        // Art. II.5 names exported documents explicitly.
        var doelen = new[] { Doel("NC-1.1", gedekt: true, nietMeerInOpstap: true, themas: new[] { "Herfst" }) };

        var cellen = AlleCellen(Export().Genereer(
            Weergave(doelen, isTerugval: true, aantalBuitenBereik: 7, isBetrouwbaar: false, aantalOnopgeloste: 3,
                aantalGedekt: null)));

        Assert.DoesNotContain(cellen, tekst => tekst.Contains('—', StringComparison.Ordinal));
    }

    [Fact]
    public void De_terugval_naar_het_hele_curriculum_wordt_als_terugval_benoemd()
    {
        // The graadklas case: Klas.Leerjaar is one ordinal and cannot say which years, so the computation widens
        // rather than narrows. Printing "het hele ingeladen curriculum" without the reason would hide the open half
        // of the Art. XIV decision inside a document meant to prove something.
        var bestand = Export().Genereer(
            Weergave(bereik: Dekkingsbereik.EigenJaarFase, gemetenJaarFasen: Array.Empty<string>(), isTerugval: true));

        var cellen = AlleCellen(bestand);

        Assert.Contains(cellen, tekst =>
            tekst.Contains("hele ingeladen curriculum", StringComparison.Ordinal) &&
            tekst.Contains("geen jaar of fase bekend", StringComparison.Ordinal));
    }

    [Fact]
    public void Buiten_het_bereik_gelaten_doelen_worden_geteld_en_bij_nul_niet_vermeld()
    {
        var met = AlleCellen(Export().Genereer(Weergave(aantalBuitenBereik: 132)));
        var zonder = AlleCellen(Export().Genereer(Weergave(aantalBuitenBereik: 0)));

        Assert.Contains(met, tekst => tekst.Contains("132 ingeladen doelen horen bij een ander jaar", StringComparison.Ordinal));
        Assert.DoesNotContain(zonder, tekst => tekst.Contains("ingeladen doel", StringComparison.Ordinal));
    }

    [Fact]
    public void Opgemaakt_op_komt_van_de_klok_en_staat_in_de_tijdzone_van_de_school()
    {
        // Dekking is recomputed on every read, so two exports of one class can legitimately disagree; without a stamp
        // there is no telling which printout is current. 16:12 UTC is 18:12 in Brussels in August.
        var cellen = AlleCellen(Export(Middag).Genereer(Weergave()));

        Assert.Contains(cellen, tekst =>
            tekst.Contains("6 augustus 2026", StringComparison.Ordinal) &&
            tekst.Contains("18:12", StringComparison.Ordinal));
    }

    [Fact]
    public void De_bestandsnaam_noemt_de_klas_en_het_schooljaar()
    {
        var bestand = Export().Genereer(Weergave());

        // Scope and date included, because dekking is recomputed on every read: the same class exports differently
        // tomorrow and differently again under another scope, and all three used to land under one name.
        Assert.Equal("dekking-k3-derde-kleuterklas-2026-2027-k3-2026-08-06.xlsx", bestand.Bestandsnaam);
        Assert.Equal(ClosedXmlDekkingExport.XlsxContentType, bestand.ContentType);
    }

    [Fact]
    public void Een_klasnaam_zonder_bruikbare_tekens_geeft_nog_altijd_een_bestandsnaam()
    {
        // A name is a school's own free text (Klas.Naam), so the filename builder has to survive anything in it
        // rather than produce "dekking--.xlsx" or an empty segment.
        var bestand = Export().Genereer(Weergave(klasNaam: "!!! ???"));

        Assert.Equal("dekking-onbekend-2026-2027-k3-2026-08-06.xlsx", bestand.Bestandsnaam);
    }

    [Fact]
    public void Een_klasnaam_die_op_een_formule_lijkt_blijft_tekst()
    {
        // The one place arbitrary user input lands in this document. Written with SetValue rather than Value so
        // Excel shows "=1+1" instead of evaluating it, which also keeps the kopblok readable as evidence.
        var bestand = Export().Genereer(Weergave(klasNaam: "=1+1"));
        var blad = Blad(bestand, out var workbook);
        using var _ = workbook;

        var cel = blad.CellsUsed().First(c => c.GetString() == "=1+1");

        Assert.False(cel.HasFormula);
        Assert.Equal(XLDataType.Text, cel.DataType);
    }

    [Fact]
    public void Een_lege_scope_zegt_dat_er_niets_te_meten_valt_en_geeft_geen_breuk()
    {
        // 0 of 0 is "we cannot measure this class yet", never "everything is covered" (DekkingWeergave's own note).
        var bestand = Export().Genereer(
            Weergave(Array.Empty<LeerplandoelDekking>(), aantalBuitenBereik: 40, aantalGedekt: 0));

        var cellen = AlleCellen(bestand);

        Assert.Contains(cellen, tekst => tekst.Contains("Nog niets om tegen te meten", StringComparison.Ordinal));
        Assert.DoesNotContain(cellen, tekst => tekst.Contains("gedekt.", StringComparison.Ordinal));
    }

    [Fact]
    public void De_klok_wordt_een_keer_per_document_gelezen()
    {
        // The kopblok's stamp and the filename's date must name the same day, and the only way to break that is to read
        // the clock twice. So the clock is made to JUMP A DAY per read: with one read the stamp and the name agree, and
        // with two they cannot. Asserting the agreement rather than the call count is deliberate, because the property
        // that matters is what the document says, not how many times a method ran; the count is asserted too, because
        // it names the cause when the first assertion fails.
        var tijd = new StappendeTijd(Middag);

        var bestand = new ClosedXmlDekkingExport(tijd).Genereer(Weergave());
        var cellen = AlleCellen(bestand);

        Assert.Equal(1, tijd.AantalAanroepen);
        Assert.Contains("2026-08-06", bestand.Bestandsnaam, StringComparison.Ordinal);
        Assert.Contains(cellen, tekst => tekst.Contains("6 augustus 2026", StringComparison.Ordinal));
    }

    [Fact]
    public void Elk_kopbloklabel_past_in_de_breedte_van_de_eerste_kolom()
    {
        // TURNS AN INVISIBLE RENDERING PROPERTY INTO A CHECKABLE ONE, which is why this test exists at all. Excel clips
        // a cell whose neighbour is populated, and every kopblok label sits in column 1 with a populated column 2, so a
        // label longer than that column renders truncated. The antagonist found "Buiten dit overzicht" clipped at width
        // 14 by READING the code; no assertion here could see it, because they all read cell values and clipping does
        // not change a value. Asserting that every label fits is the closest a test can get to looking at the sheet.
        //
        // The labels are read out of a generated workbook rather than from a list in this test, so a new kopblok field
        // is covered the day it is added **provided it renders in this arranged state** (antagonist round 2 narrowed
        // this claim: a field conditional on something this state does not set would be invisible here, and the comment
        // used to read as if the test were state-independent). The state below is therefore the widest one: a narrowed
        // scope, a withheld figure and a buiten-bereik count all at once.
        //
        // `Length > Breedte` is a PROXY and not the property. Excel's width unit is the default font's digit width and
        // these labels are bold, so a 22-character label of wide glyphs could fit the test and still clip.
        //
        // The margin, in numbers rather than in reassurance (antagonist round 3 struck "room to spare" from here,
        // which was a fresh unmeasured claim inside the sentence written to remove one): the longest label is
        // "Buiten dit overzicht" at 20 characters against a width of 22, and the others are 4, 7, 10, 12 and 13.
        // Two characters of slack BEFORE bold inflation is thin, and this test cannot tell you whether bold Calibri
        // eats it. Only a rendered sheet can, and nobody has opened one.
        var bestand = Export().Genereer(
            Weergave(aantalBuitenBereik: 132, isBetrouwbaar: false, aantalOnopgeloste: 3, aantalGedekt: null));

        var blad = Blad(bestand, out var workbook);
        using var _ = workbook;

        var breedte = DekkingKolommen.Breedte(DekkingKolom.Code);
        var kopregel = Kopregel(blad);

        var telang = blad.Column((int)DekkingKolom.Code)
            .CellsUsed()
            .Where(cel => cel.Address.RowNumber < kopregel)
            // Only the label cells: a note spans the sheet on its own row with nothing beside it, so it may overflow.
            .Where(cel => !blad.Cell(cel.Address.RowNumber, 2).IsEmpty())
            .Select(cel => cel.GetString())
            .Where(tekst => tekst.Length > breedte)
            .ToList();

        Assert.Empty(telang);
    }

    [Fact]
    public void De_bestandsnaam_noemt_het_bereik_waartegen_gemeten_is()
    {
        // Two exports of one class under two scopes are two different documents, and the kopblok was the only thing
        // that said so. `dekking-...-heel-curriculum-...` versus `dekking-...-k3-...` says it in the downloads folder.
        var eigen = Export().Genereer(Weergave());
        var alles = Export().Genereer(
            Weergave(bereik: Dekkingsbereik.HeelCurriculum, gemetenJaarFasen: Array.Empty<string>()));

        Assert.Contains("-k3-", eigen.Bestandsnaam, StringComparison.Ordinal);
        Assert.Contains("-heel-curriculum-", alles.Bestandsnaam, StringComparison.Ordinal);
        Assert.NotEqual(eigen.Bestandsnaam, alles.Bestandsnaam);
    }

    [Fact]
    public void Er_staat_geen_minimumdoelkolom_in_het_document()
    {
        // The antagonist's MAJOR-2, pinned so it cannot come back by accident. A concordance ref beside a Ja/Nee, under
        // a header naming the level the kopblok declares absent, invites an inference that is wrong in BOTH directions:
        // Art. V.1 needs only one concorded leerplandoel, so a "Nee" beside a ref does not mean that minimumdoel is
        // uncovered, and a minimumdoel whose concorded doelen all fall outside the scope appears in no row at all.
        // E5-04 owns that column. The payload still carries the ref, which is why an absence needs a test.
        var doelen = new[] { Doel("NC-1.1", minimumdoelRef: "6-14", gedekt: true, themas: new[] { "Herfst" }) };

        var bestand = Export().Genereer(Weergave(doelen));

        Assert.DoesNotContain("6-14", AlleCellen(bestand));
        Assert.DoesNotContain("Minimumdoel", DekkingKolommen.Alle.Select(DekkingKolommen.Label));
    }

    /// <summary>
    /// The row the table header sits on, found rather than hard-coded: the kopblok's height varies with the state it
    /// describes (the buiten-bereik line only appears when something was left out), so a fixed row number would make
    /// these tests assert the kopblok's layout while claiming to assert the table's.
    /// </summary>
    private static int Kopregel(IXLWorksheet blad)
    {
        var eerste = DekkingKolommen.Label(DekkingKolom.Code);

        return blad.Column((int)DekkingKolom.Code)
            .CellsUsed()
            .First(cel => cel.GetString() == eerste)
            .Address.RowNumber;
    }
}
