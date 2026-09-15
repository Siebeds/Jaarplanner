namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Which school-content link layers a leerplandoel detail may surface (E1-16 clause 3).
/// <para>
/// <b>It gates the shared layers only.</b> <c>Thema</c>, <c>Themadoel</c> and the thema-level <c>doelsuggesties</c> are
/// school-wide, and <c>Subthema</c>, <c>Subdoel</c> and <c>Activiteit</c> are shared per leeftijd (Art. IX.2): none of
/// them is one klas's planning. The one klas-scoped layer, a klas's algemene fiches, is not decided here but by the row
/// that decides every read of a klas's planning, <c>Rechtenmatrix.KlasplanningBekijken</c> (FB-013, ADR-0040), which the
/// caller hands to the query per klas.
/// </para>
/// <para>
/// It is deliberately shaped like the discipline-selection seam (<c>IDisciplineSelectie</c> / ADR-0019): the choice is
/// taken at one call site, so changing it changes a value rather than a query.
/// </para>
/// </summary>
public enum Koppelingzichtbaarheid
{
    /// <summary>
    /// Every shared layer, school-wide and per leeftijd alike. Every per-leeftijd row <b>names its leeftijd</b>, so
    /// nothing here can be read as a school-wide fact (see <c>DoelKoppelingWeergave.Leeftijd</c>). The klassen's
    /// algemene fiches follow the reader's right on each klas.
    /// </summary>
    Alles = 0,

    /// <summary>
    /// School-scoped layers only: <c>themadoelen</c> and thema-level <c>doelsuggesties</c> (Art. IX.2). The
    /// per-leeftijd subdoelen and activiteit links, and every algemene fiche, are withheld.
    /// <para>
    /// Not used by any caller today: it keeps a narrower answer a value at one call site rather than a change to the
    /// query.
    /// </para>
    /// </summary>
    AlleenSchoolbreed = 1,
}
