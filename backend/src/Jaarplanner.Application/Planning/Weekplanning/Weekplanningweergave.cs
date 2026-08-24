using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Weekplanning;

/// <summary>
/// One stretch of days with the activiteiten scheduled on them (E9-03, read side of FR-6.2/FR-7.2) — what the week
/// view inside a themaperiode renders from.
/// <para>
/// <b>It reports days, not weeks, and that is deliberate.</b> A week is a grouping the client draws; the server has no
/// opinion on where a week starts, because that is a display convention (Monday, here) rather than school data. Sending
/// weeks would put a calendar unit in the contract — the same thing <c>Planningsblokniveau</c> is guarded against
/// gaining — and it would force the server to decide what a partial week at a period boundary means.
/// </para>
/// <para>
/// <b>Every day in the range is returned, including the closed ones.</b> A week view that silently omitted
/// Herfstvakantie would show a four-day week with no explanation and no way for a teacher to tell it from a rendering
/// bug. The closure is named on the day instead (<see cref="Dagweergave.Sluitingsnaam"/>), which is also what makes the
/// refusal in <see cref="OngeldigeDagplanningFout.DagIsGesloten"/> predictable rather than surprising.
/// </para>
/// </summary>
/// <param name="KlasId">The class whose plan this is.</param>
/// <param name="KlasNaam">Its name, so a screen never has to hold the pair itself.</param>
/// <param name="SchooljaarId">The school year the range was resolved against.</param>
/// <param name="SchooljaarNaam">Its name, for the same reason.</param>
/// <param name="Van">First day of the requested range, inclusive.</param>
/// <param name="Tot">Last day of the requested range, inclusive.</param>
/// <param name="Dagen">Every day in the range in chronological order, open and closed alike.</param>
public sealed record Weekplanningweergave(
    Guid KlasId,
    string KlasNaam,
    Guid SchooljaarId,
    string SchooljaarNaam,
    DateOnly Van,
    DateOnly Tot,
    IReadOnlyList<Dagweergave> Dagen);

/// <summary>One day of the range.</summary>
/// <param name="Datum">The day.</param>
/// <param name="IsLesdag">
/// Whether the school is open. <b>This is <c>Schooljaar.IsLesdag</c>, which counts a weekend as open</b> because
/// nothing in the model represents a weekend — so a Saturday inside the school year arrives here as
/// <c>true</c>. The client decides whether to draw Saturday and Sunday at all; the server does not pretend to know
/// that a school teaches Monday to Friday, because that is exactly the assumption E9-02 has to get a ruling on.
/// </param>
/// <param name="Sluitingsnaam">
/// The school's own name for the closure covering this day ("Herfstvakantie", "Pedagogische studiedag"), or null when
/// the day is open. Present so a screen can say <i>why</i> a day takes nothing, which is the E3-06 rule: a withheld
/// control states its reason in visible text.
/// </param>
/// <param name="Activiteiten">
/// What is scheduled on this day, in the teacher's own order. Empty is the normal state for most days and means
/// nothing is planned — never "this day cannot hold anything", which is what <paramref name="IsLesdag"/> says.
/// </param>
public sealed record Dagweergave(
    DateOnly Datum,
    bool IsLesdag,
    string? Sluitingsnaam,
    IReadOnlyList<GeplandeActiviteitWeergave> Activiteiten);

/// <summary>
/// One scheduled activiteit, with just enough of its content tree to be recognisable on a day card.
/// </summary>
/// <param name="PlaatsingId">The placement's own id — what a move or a delete addresses.</param>
/// <param name="ActiviteitId">The activiteit.</param>
/// <param name="ActiviteitNaam">Its name.</param>
/// <param name="ActiviteitType">The activiteit type, as the API serialises the enum (by name).</param>
/// <param name="SubthemaId">The subthema it realises.</param>
/// <param name="SubthemaNaam">
/// Its name. Carried because the week view's whole purpose is planning the subthema's of a period, so a day card that
/// named only the activiteit would leave a teacher unable to see whether a fortnight's worth of one subthema had been
/// scheduled.
/// </param>
/// <param name="ThemaId">The thema the subthema belongs to.</param>
/// <param name="ThemaNaam">Its name.</param>
/// <param name="Volgorde">Position within the day.</param>
/// <param name="Status">The human-in-the-loop status, as the API serialises the enum (Art. IV.2).</param>
/// <param name="Doelcodes">
/// The leerplandoel codes this activiteit carries, through its own <b>accepted or manual</b> <c>DoelKoppeling</c>s.
/// <para>
/// <b>A <c>Voorgesteld</c> or <c>Geweigerd</c> link is not in here</b>, and that is Art. IV.1/IV.2 rather than tidying:
/// one is a suggestion nobody has answered, the other is a doel the teacher said no to, and neither is a doel this
/// activiteit works toward. The 2026-08-20 audit found this shipping unfiltered — <b>latently</b>: no route reaches
/// those statuses on an activiteit link today and no component reads this field, so the fix lands before E8's
/// activiteit-level matching makes them reachable rather than after anyone saw a wrong card.
/// </para>
/// <para>
/// <b>Present for display, and it must not be read as coverage.</b> Art. V.1 makes a doel gedekt through the
/// <i>thema's</i> placement in the plan; scheduling the activiteit onto a Tuesday changes nothing in that computation.
/// A screen may show these codes; a screen may not count them into a dekkingscijfer (see the note on
/// <c>Activiteitplaatsing</c>).
/// </para>
/// </param>
/// <param name="ValtBuitenThemaperiode">
/// True when this day lies outside the period its thema is placed in.
/// <para>
/// <b>Reported, never refused</b> (E9-03's stated invariant). A teacher who front-loads one activiteit is not making a
/// mistake, and refusing it would be the tool inventing a rule the school never stated. Null-free by construction: a
/// thema that is not placed at all yields <c>false</c> rather than "unknown", because there is then no period for the
/// day to fall outside of, and a screen must not report a mismatch against nothing.
/// </param>
public sealed record GeplandeActiviteitWeergave(
    Guid PlaatsingId,
    Guid ActiviteitId,
    string ActiviteitNaam,
    string ActiviteitType,
    Guid SubthemaId,
    string SubthemaNaam,
    Guid ThemaId,
    string ThemaNaam,
    int Volgorde,
    string Status,
    IReadOnlyList<string> Doelcodes,
    bool ValtBuitenThemaperiode,
    /// <summary>The teacher's colour label on the activiteit, or null. Rendered as a wash plus its name.</summary>
    Activiteitkleur? Kleur = null,
    /// <summary>
    /// How many consecutive lesuren this occupies, starting at <c>Volgorde</c>. The day grid draws it
    /// over that many rows; nothing here is stored per placement, so every placement of one activiteit
    /// is the same length.
    /// </summary>
    int LengteInLesuren = 1);
