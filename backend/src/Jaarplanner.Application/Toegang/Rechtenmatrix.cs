namespace Jaarplanner.Application.Toegang;

/// <summary>
/// <b>The ADR-0030 §3 matrix, declared once</b> (Art. VI.1: "what each right allows is one matrix … changing a row
/// there is a code change"; ADR-0011 §2: named policies in one place). Each row is one named policy: the Api registers
/// every <see cref="Rijen"/> entry under its <see cref="Matrixrij.Beleid"/> name, and <see cref="StaatToe"/> is the
/// only code that decides whether a gebruiker's <see cref="Rechten"/> satisfy a row.
/// <para>
/// <b>How a row is applied.</b> A row whose columns need no resource (directie, the plain TB column, the K3 set's
/// <see cref="Kolom.Rapportsetleerkracht"/>) goes on a route as
/// <c>[Authorize(Policy = Rechtenmatrix.Beleid.X)]</c>. A row with any column that needs a resource is resource-based:
/// HL, "LK leeftijd", "LK eigen", the maker, and themabeheer on a thema that holds no one else's content (I26). The Api
/// builds the resource (<see cref="Leeftijdsinhoud"/>, <see cref="Klasplanning"/>, <see cref="Activiteitbron"/> or
/// <see cref="Themabron"/>, via <see cref="IRechtenbronnen"/>) and asks
/// <c>IAuthorizationService.AuthorizeAsync(User, bron, Rechtenmatrix.Beleid.X)</c>: through the <c>[RechtOp]</c> filter,
/// or in the action when the resource comes from the body. Put such a row in an attribute by mistake and it fails
/// closed: the resource is then the <c>HttpContext</c>, which matches no resource column, so only directie (and TB where
/// the row has the plain TB column) passes.
/// </para>
/// <para>
/// <b>Not expressed here, on purpose</b> (see the E6-02 worklog): personal content (R6) waits for E6-10's shape;
/// reading and exporting another klas (I9) is every signed-in gebruiker today, which the fallback policy already gives,
/// and narrowing it is E6-09's seam; and four of the six ontwikkelingsrapport rows of ADR-0030 §3 (footnote ⁶,
/// ADR-0035), added on 2026-09-14, which get their policies with FB-002, FB-003, FB-006 and FB-007, since no route serves
/// them before. <i>Since FB-001 (2026-09-15) two have one: <see cref="OntwikkelingsrapportLezen"/> and
/// <see cref="LeerlingenBeheren"/>. Until then this sentence said all six had none. Since FB-002 (2026-09-15) a third
/// has one: <see cref="RapportsetBewerken"/>, the one row directie does not pass (R31).</i>
/// </para>
/// <para>
/// <b>The wizard's own write actions (§3 row 7) are split in two.</b> Who may call them is the row
/// <see cref="Wizardinhoud"/> here: directie and themabeheer. What a run allows is <c>IWizardrunService</c>'s, and it
/// holds for directie too. Most of it is state: the run is open, the content is under its own thema, an edit or delete
/// reaches only what it created (I23–I25). One part is a relation (I27, with the owner's Q4 ruling of 2026-09-14): a
/// wizard action that would remove a goal link needs <see cref="DoelenKoppelen"/> at that leeftijd, and one that changes
/// the leeftijd of a subthema whose activiteiten carry a goal link needs it "at both the old and the new leeftijd" (I27
/// as ratified on the owner's Q5 answer of 2026-09-14). The service asks it through <see cref="StaatToe"/> like every
/// other row. <i>Until slice 3 this paragraph said the
/// row needed a state the model did not have; the <c>Wizardrun</c> entity is that state. Until fix round 2 it called
/// the whole of it state, which I27 made false.</i>
/// </para>
/// </summary>
public static class Rechtenmatrix
{
    /// <summary>The policy names, as constants so an attribute can name them.</summary>
    public static class Beleid
    {
        /// <summary>Op.stap-doelen inladen/vernieuwen. Kept at its E1-15 value: the Op.stap routes already name it.</summary>
        public const string Curriculumbeheer = "Curriculumbeheer";

        public const string Beheer = "Beheer";
        public const string ThemaBewerken = "ThemaBewerken";
        public const string ThemaVerwijderen = "ThemaVerwijderen";
        public const string SchoolcontentImporteren = "SchoolcontentImporteren";
        public const string MenselijkeBeslissingenVerwijderen = "MenselijkeBeslissingenVerwijderen";
        public const string ThemaOpbouw = "ThemaOpbouw";
        public const string Wizardinhoud = "Wizardinhoud";
        public const string DoelsuggestiesMaken = "DoelsuggestiesMaken";
        public const string DoelsuggestiesBeoordelen = "DoelsuggestiesBeoordelen";
        public const string SubthemaBeheren = "SubthemaBeheren";
        public const string StreefwoordenschatAanpassen = "StreefwoordenschatAanpassen";
        public const string GedeeldeActiviteitBewerken = "GedeeldeActiviteitBewerken";
        public const string ActiviteitVerwijderen = "ActiviteitVerwijderen";
        public const string SubdoelenBeheren = "SubdoelenBeheren";
        public const string DoelenKoppelen = "DoelenKoppelen";
        public const string ActiviteitVerplaatsen = "ActiviteitVerplaatsen";
        public const string KlasplanningBewerken = "KlasplanningBewerken";
        public const string OntwikkelingsrapportLezen = "OntwikkelingsrapportLezen";
        public const string LeerlingenBeheren = "LeerlingenBeheren";
        public const string RapportsetBewerken = "RapportsetBewerken";
    }

    // --- Resource-free rows: directie, and themabeheer where the row has it. ---

    /// <summary>§3 "Op.stap-doelen inladen/vernieuwen" (R3; ADR-0022). Directie only.</summary>
    public static readonly Matrixrij Curriculumbeheer = new(
        Beleid.Curriculumbeheer, "Op.stap-doelen inladen/vernieuwen (R3; ADR-0022)", Kolom.Geen);

    /// <summary>§3 "Gebruikers, klassen en schooljaren beheren …" (R2, R3, R16; FA FR-12.2). Directie only.</summary>
    public static readonly Matrixrij Beheer = new(
        Beleid.Beheer,
        "Gebruikers, klassen en schooljaren beheren, leerkrachten aan klassen koppelen, hoofdleerkrachten aanstellen, themabeheer en het directierecht toekennen (R2, R3, R16)",
        Kolom.Geen);

    /// <summary>§3 "Thema, themadoelen, kernwoordenschat aanpassen" (R4, R18).</summary>
    public static readonly Matrixrij ThemaBewerken = new(
        Beleid.ThemaBewerken, "Thema, themadoelen, kernwoordenschat aanpassen (R4, R18)", Kolom.Themabeheer);

    /// <summary>
    /// Deleting a thema with everything under it (R3; I26; §3 has no delete row of its own). The directie column rests
    /// on R3. <b>The themabeheer column is a default</b> (I26, chosen by the owner on 2026-09-14 and followed under R37,
    /// not ratified): themabeheer only while the thema holds no subthema, subdoel or activiteit other than what its own
    /// open wizard run created, because anything else was made by hand, and deleting it by hand is directie's and the
    /// hoofdleerkrachten's (R21, R24, R25). Under the owner's Q4 ruling a run's own activiteit that carries a goal link
    /// counts as someone else's too, unless the caller may also link goals at its leeftijd (R19). The service refuses a
    /// planned or scheduled thema for everyone. Resource: <see cref="Themabron"/>.
    /// <i>Until fix round 2 this cited R4, whose "aanpassen" round 1 held not to reach a delete.</i>
    /// </summary>
    public static readonly Matrixrij ThemaVerwijderen = new(
        Beleid.ThemaVerwijderen,
        "Een thema verwijderen: themabeheer alleen als het thema niets anders bevat dan wat de eigen open wizard van dat thema aanmaakte, en geen doelkoppeling die de themabeheerder niet mag ontkoppelen (R3; I26)",
        Kolom.ThemabeheerZonderAndermansInhoud);

    /// <summary>§3 "Thema's en activiteiten importeren, FR-1 …" (R9, R27, R34).</summary>
    public static readonly Matrixrij SchoolcontentImporteren = new(
        Beleid.SchoolcontentImporteren,
        "Thema's en activiteiten importeren (FR-1), met de doelkoppelingen op themadoelen en subdoelen (R9, R27, R34)",
        Kolom.Themabeheer);

    /// <summary>§3 "Bij die import 'menselijke beslissingen verwijderen' aanvinken" (R35). Directie only.</summary>
    public static readonly Matrixrij MenselijkeBeslissingenVerwijderen = new(
        Beleid.MenselijkeBeslissingenVerwijderen,
        "Bij de FR-1-import 'menselijke beslissingen verwijderen' aanvinken, voor themadoelen en subdoelen samen (R35)",
        Kolom.Geen);

    /// <summary>§3 "Thema-opbouwwizard doorlopen: thema, themadoelen en de AI-hulp" (R29).</summary>
    public static readonly Matrixrij ThemaOpbouw = new(
        Beleid.ThemaOpbouw, "Thema-opbouwwizard doorlopen: thema, themadoelen en de AI-hulp (R29)", Kolom.Themabeheer);

    /// <summary>
    /// §3 "In de wizard subthema's, subdoelen en activiteiten aanmaken, voor een thema dat de wizard van nul opbouwt"
    /// (R29, R32; I18, I22–I25, I27; I26 is the thema delete, not wizard content). Who may call the wizard's own write
    /// actions: directie and themabeheer. What the run allows is <c>IWizardrunService</c>'s, for everyone: state (open,
    /// its own thema, its own items: I23–I25), narrowed by I27, under which an action that would remove a goal link also
    /// needs <see cref="DoelenKoppelen"/> at that leeftijd, and a leeftijd change of a subthema whose activiteiten carry a
    /// goal link needs it "at both the old and the new leeftijd" (the owner's Q5 answer of 2026-09-14).
    /// </summary>
    public static readonly Matrixrij Wizardinhoud = new(
        Beleid.Wizardinhoud,
        "In de wizard subthema's, subdoelen en activiteiten aanmaken, voor een thema dat de wizard van nul opbouwt (R29, R32; I18, I22-I25, I27)",
        Kolom.Themabeheer);

    /// <summary>§3 "Doelsuggesties laten maken" (R14).</summary>
    public static readonly Matrixrij DoelsuggestiesMaken = new(
        Beleid.DoelsuggestiesMaken, "Doelsuggesties laten maken (R14)", Kolom.Themabeheer);

    /// <summary>§3 "Doelsuggesties aanvaarden, weigeren of aanpassen" (R14).</summary>
    public static readonly Matrixrij DoelsuggestiesBeoordelen = new(
        Beleid.DoelsuggestiesBeoordelen, "Doelsuggesties aanvaarden, weigeren of aanpassen (R14)", Kolom.Themabeheer);

    // --- Resource-based rows: shared content of one leeftijd. ---

    /// <summary>
    /// §3 "Subthema's van een jaar aanmaken, aanpassen en verwijderen" (R5, R21; (c), I13, I16). Resource:
    /// <see cref="Leeftijdsinhoud"/>. A re-scope asks it at both the old and the new leeftijd (I13).
    /// </summary>
    public static readonly Matrixrij SubthemaBeheren = new(
        Beleid.SubthemaBeheren, "Subthema's van een jaar aanmaken, aanpassen en verwijderen (R5, R21)", Kolom.Hoofdleerkracht);

    /// <summary>§3 "Streefwoordenschat van een subthema aanpassen" (R28). Resource: <see cref="Leeftijdsinhoud"/>.</summary>
    public static readonly Matrixrij StreefwoordenschatAanpassen = new(
        Beleid.StreefwoordenschatAanpassen,
        "Streefwoordenschat van een subthema aanpassen (R28)",
        Kolom.Hoofdleerkracht | Kolom.LeerkrachtLeeftijd);

    /// <summary>
    /// §3 "Gedeelde activiteiten aanmaken en hun inhoud aanpassen" (R17, R23; I15). Resource: <see cref="Leeftijdsinhoud"/>
    /// of the subthema for a new one, or the <see cref="Activiteitbron"/> for an existing one.
    /// </summary>
    public static readonly Matrixrij GedeeldeActiviteitBewerken = new(
        Beleid.GedeeldeActiviteitBewerken,
        "Gedeelde activiteiten aanmaken en hun inhoud aanpassen (R17, R23)",
        Kolom.Hoofdleerkracht | Kolom.LeerkrachtLeeftijd);

    /// <summary>
    /// §3's two delete rows as one policy, because they are one action on one route and the resource tells them apart:
    /// "Een zelf aangemaakte activiteit zonder doelkoppelingen verwijderen" (R25, R26, R33; I17: maker²) and "Een
    /// activiteit met doelkoppelingen, of zonder maker, verwijderen" (R25; (c): HL). Resource: <see cref="Activiteitbron"/>.
    /// </summary>
    public static readonly Matrixrij ActiviteitVerwijderen = new(
        Beleid.ActiviteitVerwijderen,
        "Een activiteit verwijderen: de maker zolang er geen doel aan gekoppeld is, de hoofdleerkracht altijd (R25, R26, R33)",
        Kolom.Hoofdleerkracht | Kolom.MakerZonderKoppelingen);

    /// <summary>§3 "Subdoelen aanmaken, wijzigen en verwijderen" (R24; (c)). Resource: <see cref="Leeftijdsinhoud"/>.</summary>
    public static readonly Matrixrij SubdoelenBeheren = new(
        Beleid.SubdoelenBeheren, "Subdoelen aanmaken, wijzigen en verwijderen (R24)", Kolom.Hoofdleerkracht);

    /// <summary>
    /// §3 "Doelen met de hand koppelen aan of ontkoppelen van gedeelde activiteiten" (R19; (c)). Resource:
    /// <see cref="Activiteitbron"/> or <see cref="Leeftijdsinhoud"/>.
    /// </summary>
    public static readonly Matrixrij DoelenKoppelen = new(
        Beleid.DoelenKoppelen,
        "Doelen met de hand koppelen aan of ontkoppelen van gedeelde activiteiten (R19)",
        Kolom.Hoofdleerkracht);

    /// <summary>
    /// §3 "Een activiteit naar een ander thema verplaatsen" (R19, R23; I19: "LK leeftijd" only without goal links³).
    /// Resource: <see cref="Activiteitbron"/>. A move never crosses a leeftijd (Art. IX.2), so one leeftijd suffices.
    /// </summary>
    public static readonly Matrixrij ActiviteitVerplaatsen = new(
        Beleid.ActiviteitVerplaatsen,
        "Een activiteit naar een ander thema verplaatsen (R19, R23; I19)",
        Kolom.Hoofdleerkracht | Kolom.LeerkrachtLeeftijdZonderKoppelingen);

    // --- Resource-based row: the planning of one klas. ---

    /// <summary>
    /// §3 "Jaarplan bewerken, (her)genereren, agenda, hoeken, algemene fiches" (R7, R15; I21). Resource:
    /// <see cref="Klasplanning"/>.
    /// </summary>
    public static readonly Matrixrij KlasplanningBewerken = new(
        Beleid.KlasplanningBewerken,
        "Jaarplan bewerken, (her)genereren, agenda, hoeken, algemene fiches (R7, R15; I21)",
        Kolom.LeerkrachtEigen);

    // --- Resource-based rows: the ontwikkelingsrapport of one K3 klas (footnote ⁶, ADR-0035 §3.3; FB-001). ---

    /// <summary>
    /// §3 "Een ontwikkelingsrapport lezen" (ADR-0035 R16, R17, R18, R26), which FB-001 also applies to reading the klas's
    /// leerlingen: the list of children is the first thing a report shows. Resource: <see cref="Rapportklas"/>.
    /// <b>Reads are gated here, unlike every other read in the app</b>: I9 does not reach these rows, so a leerkracht of
    /// another klas, a hoofdleerkracht and themabeheer read none of it (R17). Leerlingzorg (R18) joins this row with
    /// FB-008, as a relation of its own.
    /// </summary>
    public static readonly Matrixrij OntwikkelingsrapportLezen = new(
        Beleid.OntwikkelingsrapportLezen,
        "Een ontwikkelingsrapport lezen, en de leerlingen van de klas (ADR-0035 R16, R17, R18, R26)",
        Kolom.LeerkrachtRapportLezen);

    /// <summary>
    /// §3 "Leerlingen van een K3-klas toevoegen, wijzigen, verwijderen" (ADR-0035 R14, R15, R26; D8, D9). Resource:
    /// <see cref="Rapportklas"/>. The klas's leerkrachten only during its schooljaar (R26); directie always (R3). That the
    /// klas grants K3 at all (D9) is also the service's check, because directie passes this row for any klas.
    /// </summary>
    public static readonly Matrixrij LeerlingenBeheren = new(
        Beleid.LeerlingenBeheren,
        "Leerlingen van een K3-klas toevoegen, wijzigen, verwijderen (ADR-0035 R14, R15, R26; D8, D9)",
        Kolom.LeerkrachtRapportInvullen);

    // --- Resource-free row without directie: the one K3 set (footnote ⁶, ADR-0035 §3.3; FB-002). ---

    /// <summary>
    /// §3 "De K3-rapportdoelen en de sterrenschaal aanpassen" (ADR-0035 R4, R5, R6, R31; D4). Column
    /// <see cref="Kolom.Rapportsetleerkracht"/>: every K3 leerkracht, on the one set and scale of all of K3, so no resource.
    /// <b>The one row directie does not pass</b> (<see cref="Matrixrij.ZonderDirectie"/>): the owner ruled that only the K3
    /// leerkrachten edit the set, and directie views it (R31). Reading the set is every signed-in gebruiker's, like every
    /// read that is not pupil data.
    /// </summary>
    public static readonly Matrixrij RapportsetBewerken = new(
        Beleid.RapportsetBewerken,
        "De K3-rapportdoelen en de sterrenschaal aanpassen (ADR-0035 R4, R5, R6, R31; D4)",
        Kolom.Rapportsetleerkracht,
        ZonderDirectie: true);

    /// <summary>Every row, each registered as a named policy under its <see cref="Matrixrij.Beleid"/>.</summary>
    public static IReadOnlyList<Matrixrij> Rijen { get; } =
    [
        Curriculumbeheer,
        Beheer,
        ThemaBewerken,
        ThemaVerwijderen,
        SchoolcontentImporteren,
        MenselijkeBeslissingenVerwijderen,
        ThemaOpbouw,
        Wizardinhoud,
        DoelsuggestiesMaken,
        DoelsuggestiesBeoordelen,
        SubthemaBeheren,
        StreefwoordenschatAanpassen,
        GedeeldeActiviteitBewerken,
        ActiviteitVerwijderen,
        SubdoelenBeheren,
        DoelenKoppelen,
        ActiviteitVerplaatsen,
        KlasplanningBewerken,
        OntwikkelingsrapportLezen,
        LeerlingenBeheren,
        RapportsetBewerken,
    ];

    /// <summary>
    /// Whether <paramref name="rechten"/> may do what <paramref name="rij"/> describes, on <paramref name="bron"/>.
    /// <list type="number">
    /// <item><b>Directie passes every row but one</b>, with or without a resource (R3). The exception is a row marked
    /// <see cref="Matrixrij.ZonderDirectie"/>, <see cref="RapportsetBewerken"/> only (ADR-0035 R31): there directie is
    /// judged by its columns like anyone else, so a directie who also teaches a K3 klas passes it as that leerkracht.</item>
    /// <item>Otherwise the gebruiker holds the union of every column that applies (§3): any one column that matches is
    /// enough, and a column that does not match never takes away what another grants.</item>
    /// <item>A column that needs a resource matches only a resource of the right type. A missing or foreign resource
    /// matches nothing, so a mistake fails closed.</item>
    /// </list>
    /// </summary>
    public static bool StaatToe(Rechten rechten, Matrixrij rij, object? bron)
    {
        ArgumentNullException.ThrowIfNull(rechten);
        ArgumentNullException.ThrowIfNull(rij);

        if (rechten.IsDirectie && !rij.ZonderDirectie)
        {
            return true;
        }

        var kolommen = rij.Kolommen;

        if (kolommen.HasFlag(Kolom.Themabeheer) && rechten.HeeftThemabeheer)
        {
            return true;
        }

        // Footnote ⁶, ADR-0035 D4: "K3-leerkracht" is a klastoewijzing on a klas that can hold leerlingen (the D9 function,
        // Leerling.KlasKanLeerlingenHebben) in a schooljaar that has not ended, which is exactly the running rapportklassen.
        // Deliberately not IsLeerkrachtVanLeeftijd("K3"): through the one klas→leeftijden mapping, directie's graadklas
        // decision (Art. XIV) moves this together with the leerlingen and the reports.
        if (kolommen.HasFlag(Kolom.Rapportsetleerkracht) && rechten.LopendeRapportklasIds.Count > 0)
        {
            return true;
        }

        // I26: themabeheer deletes a thema only while nothing in it is anyone else's. Needs the Themabron, so an attribute
        // (resource = HttpContext) fails closed here too. Q4 (a): a goal link on one of the open run's own activiteiten
        // protects it as well, unless the gebruiker may link goals at that leeftijd, which the DoelenKoppelen row answers.
        if (kolommen.HasFlag(Kolom.ThemabeheerZonderAndermansInhoud)
            && rechten.HeeftThemabeheer
            && bron is Themabron { HeeftAndermansInhoud: false } thema
            && thema.GekoppeldeLeeftijden.All(leeftijd => StaatToe(rechten, DoelenKoppelen, new Leeftijdsinhoud(leeftijd))))
        {
            return true;
        }

        var leeftijd = bron switch
        {
            Leeftijdsinhoud inhoud => inhoud.Leeftijd,
            Activiteitbron activiteit => activiteit.Leeftijd,
            _ => null,
        };

        if (leeftijd is not null)
        {
            if (kolommen.HasFlag(Kolom.Hoofdleerkracht) && rechten.IsHoofdleerkrachtVan(leeftijd))
            {
                return true;
            }

            if (kolommen.HasFlag(Kolom.LeerkrachtLeeftijd) && rechten.IsLeerkrachtVanLeeftijd(leeftijd))
            {
                return true;
            }
        }

        if (bron is Activiteitbron { HeeftDoelkoppelingen: false } zonderKoppelingen)
        {
            // Footnote ³ (I19): moving one without links is content, so every leerkracht of that leeftijd may.
            if (kolommen.HasFlag(Kolom.LeerkrachtLeeftijdZonderKoppelingen)
                && rechten.IsLeerkrachtVanLeeftijd(zonderKoppelingen.Leeftijd))
            {
                return true;
            }

            // Footnote ² (R25, R33): the maker, whoever they are now, with or without a klas at that leeftijd, and after
            // the schooljaar. An activiteit without a maker matches no one here.
            if (kolommen.HasFlag(Kolom.MakerZonderKoppelingen) && zonderKoppelingen.MakerId == rechten.GebruikerId)
            {
                return true;
            }
        }

        // Footnote ⁶: "LK eigen" on the ontwikkelingsrapport rows is the klas's K3 leerkracht, reading with no end date
        // and filling in only during the schooljaar (R26). Only a Rapportklas matches, so a planning resource never opens
        // a report and a report resource never opens the planning.
        if (bron is Rapportklas rapport)
        {
            if (kolommen.HasFlag(Kolom.LeerkrachtRapportLezen) && rechten.IsRapportleerkrachtVan(rapport.KlasId))
            {
                return true;
            }

            if (kolommen.HasFlag(Kolom.LeerkrachtRapportInvullen) && rechten.VultRapportIn(rapport.KlasId))
            {
                return true;
            }
        }

        return kolommen.HasFlag(Kolom.LeerkrachtEigen)
            && bron is Klasplanning planning
            && rechten.IsLeerkrachtVanKlas(planning.KlasId);
    }
}

/// <summary>
/// One row of the ADR-0030 §3 matrix: its policy name, the action as §3 words it, and the columns (besides directie,
/// which every row but one grants) that allow it.
/// </summary>
/// <param name="ZonderDirectie">
/// True for the one row whose "Directie" cell is "–" (ADR-0030 §3 footnote ⁶, ADR-0035 R31): directie then passes only
/// through the row's own columns. False everywhere else, where directie passes whatever the columns say (R3).
/// </param>
public sealed record Matrixrij(string Beleid, string Actie, Kolom Kolommen, bool ZonderDirectie = false);

/// <summary>
/// The columns of ADR-0030 §3 other than "Directie", which every row but <see cref="Rechtenmatrix.RapportsetBewerken"/>
/// grants (R3, R31), and "Ander", which grants no row that is enforced today.
/// </summary>
[Flags]
public enum Kolom
{
    /// <summary>Directie only.</summary>
    Geen = 0,

    /// <summary>"TB": holds themabeheer. Needs no resource.</summary>
    Themabeheer = 1,

    /// <summary>"HL": hoofdleerkracht of the resource's leeftijd, in a schooljaar that has not ended.</summary>
    Hoofdleerkracht = 2,

    /// <summary>"LK leeftijd": a klas whose stated jaarfase is the resource's leeftijd, in a schooljaar that has not ended.</summary>
    LeerkrachtLeeftijd = 4,

    /// <summary>"LK leeftijd", only on an <see cref="Activiteitbron"/> with no goal links (§3 footnote ³, I19).</summary>
    LeerkrachtLeeftijdZonderKoppelingen = 8,

    /// <summary>"LK eigen": a klastoewijzing on the <see cref="Klasplanning"/>'s klas, with no end date.</summary>
    LeerkrachtEigen = 16,

    /// <summary>The maker of an <see cref="Activiteitbron"/> with no goal links, whatever else they hold (§3 footnote ²).</summary>
    MakerZonderKoppelingen = 32,

    /// <summary>
    /// "TB", only on a <see cref="Themabron"/> that holds nothing beyond its own open wizard run's items (default I26),
    /// and none of those carrying a goal link at a leeftijd where the gebruiker may not link goals (the owner's Q4 ruling).
    /// </summary>
    ThemabeheerZonderAndermansInhoud = 64,

    /// <summary>
    /// "LK eigen" on an ontwikkelingsrapport row, reading (footnote ⁶, ADR-0035 R16, R26): a klastoewijzing on the
    /// <see cref="Rapportklas"/>'s klas when that klas grants K3, with no end date.
    /// </summary>
    LeerkrachtRapportLezen = 128,

    /// <summary>
    /// "LK eigen" on an ontwikkelingsrapport row, filling in and keeping the leerlingen: the same, only while the klas's
    /// schooljaar has not ended (footnote ⁶, R26, which overrides I21 for these rows).
    /// </summary>
    LeerkrachtRapportInvullen = 256,

    /// <summary>
    /// "LK leeftijd" on the rapportdoelen row (footnote ⁶, ADR-0035 D4): a klastoewijzing on a klas that grants K3, in a
    /// schooljaar that has not ended, i.e. any <see cref="Rechten.LopendeRapportklasIds"/>. Needs no resource: the set and
    /// the scale are one for all of K3 (R4, R5), so a K3 leerkracht of any klas edits them.
    /// </summary>
    Rapportsetleerkracht = 512,
}
