namespace Jaarplanner.Application.Planning.Weekplanning;

/// <summary>
/// Where the klas already planned each of its activiteiten, over the whole school year (FB-076).
/// <para>
/// <b>Not a range, unlike <see cref="Weekplanningweergave"/>, and that is the whole point.</b> The side panel of the
/// agenda asks a question the week view cannot answer: "is this activiteit already somewhere in this klas's agenda?"
/// A teacher plans it twice precisely because the week she is looking at does not show the day she used it on. So the
/// answer covers the plan, which is one klas in one school year, rather than the days on screen.
/// </para>
/// <para>
/// <b>Only the days, not the hours.</b> The panel names a day ("di 22/9"); the hour belongs to the block in the grid,
/// and carrying it here would invite a second place to render a time and a second answer to what time it is.
/// </para>
/// </summary>
/// <param name="Activiteiten">
/// One entry per activiteit that is planned at least once. An activiteit that is planned nowhere is <b>absent</b>
/// rather than present with an empty list, so a caller cannot read "not planned" off a row that is really "planned,
/// and the days did not load".
/// <para>
/// <b>That distinction lives on the wire and not yet on screen.</b> The panel renders a card it has no entry for
/// exactly as it renders one that is planned nowhere, so a failed read does read as "not planned" to a teacher
/// (antagonist FB-076). Keeping the shape honest here is what lets a later caller, or that panel, tell the two apart
/// without a second route.
/// </para>
/// </param>
public sealed record Activiteitplaatsingenweergave(IReadOnlyList<GeplandeActiviteit> Activiteiten);

/// <summary>One activiteit and the days of this klas's year it stands on.</summary>
/// <param name="ActiviteitId">The activiteit.</param>
/// <param name="Datums">
/// Its days, ascending and without duplicates: an activiteit planned twice on one day is one day to a teacher reading
/// "when did I use this?", and the panel would otherwise print the same date twice.
/// </param>
public sealed record GeplandeActiviteit(Guid ActiviteitId, IReadOnlyList<DateOnly> Datums);
