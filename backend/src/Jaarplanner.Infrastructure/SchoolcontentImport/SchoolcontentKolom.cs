namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// The single source of truth for the school-content (thema/subthema/activiteit) import Excel
/// column layout (Art. III.3 — the same single-source-mapping rigor as the Op.stap parser's
/// <c>OpstapKolom</c>). The column→field mapping lives here and <b>only</b> here; the parser
/// reads a cell exclusively via <c>(int)SchoolcontentKolom.X</c> and never hard-codes a literal
/// column index or letter elsewhere, so a column move is a one-line change in this enum.
/// <para>
/// <b>PROVISIONAL layout (Art. XIV open decision — "Thema/activiteit Excel structure", see backlog
/// E1-09).</b> Op.stap does not prescribe a thema/activiteit exchange format and the school's own
/// template is not yet settled, so this layout is a <i>reasonable, refinable</i> choice — not a
/// committed contract. It is deliberately isolated behind this enum precisely so the eventual
/// downloadable template (E1-09) can refine columns without touching the parser/validator logic.
/// </para>
/// <para>
/// <b>Shape: one flat row = one activiteit, denormalised with its parent subthema and grandparent
/// thema.</b> The model is hierarchical (Thema → Subthema → Activiteit, with Themadoelen anchoring
/// the thema and Subdoelen differentiating the subthema), but a flat, denormalised sheet is what a
/// non-technical teacher fills in most naturally. The parser groups repeated thema/subthema columns
/// back into the hierarchy; commit/preview is E1-08. Goal-link columns carry leerplandoel <i>codes</i>
/// as free text references — they are not resolved to entities here (concordance/persist is E1-08+).
/// </para>
/// <para>Values are the 1-based ClosedXML column indices (A = 1 … P = 16).</para>
/// </summary>
public enum SchoolcontentKolom
{
    // --- Thema level (school-wide; repeated across the rows of one thema). ---

    /// <summary>Column A — Thema naam. Required (a row must name its thema).</summary>
    ThemaNaam = 1,

    /// <summary>Column B — Thema duur in weken (themaperiode ≈ 4–6). Required, positive integer.</summary>
    ThemaDuurWeken = 2,

    /// <summary>Column C — Thema invalshoeken (optional).</summary>
    ThemaInvalshoeken = 3,

    /// <summary>Column D — Kernwoordenschat (basiswoorden), optional; ';'-separated list.</summary>
    ThemaKernwoordenschat = 4,

    /// <summary>Column E — Rijke (thema)woordenschat, optional; ';'-separated list.</summary>
    ThemaRijkeWoordenschat = 5,

    /// <summary>Column F — Themadoelen as leerplandoel-code references (optional; ';'-separated, 0–3).</summary>
    Themadoelen = 6,

    // --- Subthema level (class/age-scoped; repeated across the rows of one subthema). ---

    /// <summary>Column G — Subthema naam. Required (a row must name its subthema).</summary>
    SubthemaNaam = 7,

    /// <summary>Column H — Subthema duur in weken (subthemaperiode ≈ 2). Required, positive integer.</summary>
    SubthemaDuurWeken = 8,

    /// <summary>Column I — Subthema klas. <b>Required</b> — a subthema is class-scoped (Art. IX.2).</summary>
    SubthemaKlas = 9,

    /// <summary>Column J — Subthema leeftijd. <b>Required</b> — a subthema is age-scoped (Art. IX.2).</summary>
    SubthemaLeeftijd = 10,

    /// <summary>Column K — Subthema probleemstelling (optional, kennisrijk-thema driving question).</summary>
    SubthemaProbleemstelling = 11,

    /// <summary>Column L — Subthema onderzoeksvraag (optional, kennisrijk-thema driving question).</summary>
    SubthemaOnderzoeksvraag = 12,

    /// <summary>Column M — Subdoelen as leerplandoel-code references (optional; ';'-separated).</summary>
    Subdoelen = 13,

    // --- Activiteit level (class/age-scoped, inherits the subthema scope). ---

    /// <summary>Column N — Activiteit naam. Required (a row describes one activiteit).</summary>
    ActiviteitNaam = 14,

    /// <summary>Column O — Activiteit type. Required; must map to an <c>ActiviteitType</c>.</summary>
    ActiviteitType = 15,

    /// <summary>Column P — Activiteit hoek (optional learning corner).</summary>
    ActiviteitHoek = 16,

    /// <summary>Column Q — Activiteit verwachte uitkomsten (optional).</summary>
    ActiviteitVerwachteUitkomsten = 17,
}
