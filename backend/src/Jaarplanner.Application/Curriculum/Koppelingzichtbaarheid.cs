namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// Which school-content link layers a leerplandoel detail may surface (E1-16 clause 3).
/// <para>
/// <b>This enum is a seam for an open Art. XIV decision, not an answer to it.</b> Art. IX.2 scopes
/// <c>Subthema</c>, <c>Subdoel</c> and <c>Activiteit</c> <b>per klas and leeftijd</b>, while <c>Thema</c>,
/// <c>Themadoel</c> and the thema-level <c>doelsuggesties</c> are school-wide. FR-10.2 ("teacher visibility:
/// school-wide / per graad / narrower") is still <b>unresolved</b> and sits in the Art. XIV open list, so
/// returning every class's links is a *choice* about who may see another class's planning, and shipping it as
/// the only behaviour would settle that question by default.
/// </para>
/// <para>
/// It is deliberately shaped like the discipline-selection seam (<c>IDisciplineSelectie</c> / ADR-0019): the
/// decision is isolated at one call site, so resolving FR-10.2 changes a value rather than a query. It is a
/// compiled constant rather than configuration only because there is nothing to configure it *per* yet: with
/// no authenticated user (E6-01, gated by E7-11) there is no klas to scope to. Promoting it to an options
/// section is a one-line change on the day a role matrix exists.
/// </para>
/// </summary>
public enum Koppelingzichtbaarheid
{
    /// <summary>
    /// Every link layer, school-wide and class/age-scoped alike.
    /// <para>
    /// <b>This is the present no-authentication reality, not a ruling on FR-10.2.</b> The API has no
    /// authenticated user, so it cannot know which leeftijd the reader teaches; narrowing to "your age only"
    /// would mean narrowing to *no* age, which would report a doel used by a subthema's activiteit as used
    /// nowhere. A false "gebruikt in geen enkel thema" is worse than a wide answer, because a teacher would
    /// act on it. Every age-scoped row therefore <b>names its leeftijd</b>, so nothing here can be read as a
    /// school-wide fact (see <c>DoelKoppelingWeergave.Leeftijd</c>).
    /// </para>
    /// </summary>
    Alles = 0,

    /// <summary>
    /// School-scoped layers only: <c>themadoelen</c> and thema-level <c>doelsuggesties</c> (Art. IX.2).
    /// Class/age-scoped subdoelen and activiteit links are withheld.
    /// <para>
    /// Not used by any caller today, and that is the point: it exists so the narrowing FR-10.2 may require is
    /// a value at one call site rather than a change to the query. Read it as the shape of the answer, not as
    /// the answer.
    /// </para>
    /// </summary>
    AlleenSchoolbreed = 1,
}
