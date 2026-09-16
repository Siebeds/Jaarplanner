namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The read view of a class's jaarplan (FR-5.1, FR-6.1, Art. IV.2): every placement with its dates, the school year's
/// lesweken and the balance the plan screen shows above its timeline (ADR-0053 decision 6).
/// <para>
/// <b>Everything calendar-shaped is computed here, not in the browser.</b> Which week is a lesweek, which parts form one
/// thema, whether an end differs from the thema's duration and whether a placement no longer fits the year are all
/// questions <c>Themakalender</c> answers from the schooljaar's closures. Answering them twice, once in TypeScript,
/// is how a screen comes to contradict the server.
/// </para>
/// </summary>
/// <param name="KlasId">The class this plan belongs to.</param>
/// <param name="KlasNaam">The class name, so a caller need not fetch it separately.</param>
/// <param name="SchooljaarId">The school year the class sits in (Art. IX.3 containment).</param>
/// <param name="SchooljaarNaam">The school year label (e.g. "2026-2027").</param>
/// <param name="EersteSchooldag">The first schooldag of the year: the earliest day a thema can start.</param>
/// <param name="LaatsteSchooldag">The last schooldag of the year: the latest day a thema can end.</param>
/// <param name="Plaatsingen">The thema placements, chronological.</param>
/// <param name="Lesweken">Every lesweek of the year, chronological, with whether a thema runs in it.</param>
/// <param name="Balans">The year balance: lesweken, with and without a thema.</param>
public sealed record JaarplanWeergave(
    Guid KlasId,
    string KlasNaam,
    Guid SchooljaarId,
    string SchooljaarNaam,
    DateOnly EersteSchooldag,
    DateOnly LaatsteSchooldag,
    IReadOnlyList<ThemaplaatsingWeergave> Plaatsingen,
    IReadOnlyList<LesweekWeergave> Lesweken,
    JaarbalansWeergave Balans);

/// <summary>
/// One lesweek: a Monday-to-Friday week holding at least one schooldag.
/// </summary>
/// <param name="Maandag">The Monday of the week, which identifies it.</param>
/// <param name="HeeftThema">
/// Whether a planned placement covers a day of this week. A lesweek without one is what the timeline marks
/// (ADR-0053 R7).
/// </param>
public sealed record LesweekWeergave(DateOnly Maandag, bool HeeftThema);

/// <summary>The year balance above the timeline (ADR-0053 R7).</summary>
/// <param name="Lesweken">The lesweken of the school year.</param>
/// <param name="MetThema">The lesweken in which a planned thema runs.</param>
/// <param name="ZonderThema">The lesweken in which none does.</param>
public sealed record JaarbalansWeergave(int Lesweken, int MetThema, int ZonderThema);

/// <summary>
/// One thema placement as returned by the API.
/// </summary>
/// <param name="Id">The placement's identity — what the review, date and delete endpoints address.</param>
/// <param name="ThemaId">The placed thema.</param>
/// <param name="ThemaNaam">The thema's name.</param>
/// <param name="Van">The first day the thema runs, inclusive.</param>
/// <param name="Tot">The last day the thema runs, inclusive.</param>
/// <param name="IsVervallen">
/// <c>true</c> when the school edited its vacations and a vacation now lies inside this placement, or it reaches
/// outside the year. The application does <b>not</b> move it (directie 2026-07-28); it reports the fact, the screen
/// shows a lasting notice, and dekking withholds its figures until the teacher saves the placement again.
/// </param>
/// <param name="Status">The persisted human-in-the-loop status (Art. IV.2): voorgesteld/aanvaard/manueel.</param>
/// <param name="AiMotivatie">The AI's short "waarom hier?" motivation (Art. IV.3); null for a manual placement.</param>
/// <param name="Vergrendeld">Whether the teacher locked this placement against (re)generation (Art. IX.3).</param>
/// <param name="Doelcodes">
/// The leerplandoel codes this thema actually carries (themadoelen + accepted/manual links). <b>Derived, never
/// stored on the plan</b> — duplicating them onto the placement would be storing dekking, which Art. V.1 forbids.
/// </param>
/// <param name="DuurWeken">The thema's duration in weeks, straight off the <c>Thema</c>; 0 for an unknown thema.</param>
/// <param name="Reeks">
/// Where this placement sits in its thema's run: which part it is, and whether the run's end differs from the thema's
/// duration. Null for a rejected placement, which belongs to no run.
/// </param>
public sealed record ThemaplaatsingWeergave(
    Guid Id,
    Guid ThemaId,
    string ThemaNaam,
    DateOnly Van,
    DateOnly Tot,
    bool IsVervallen,
    string Status,
    string? AiMotivatie,
    bool Vergrendeld,
    IReadOnlyList<string> Doelcodes,
    int DuurWeken,
    ReeksWeergave? Reeks);

/// <summary>
/// A placement's place in its thema's run: the parts stored around a vacation (ADR-0053 decision 4).
/// </summary>
/// <param name="Deel">This part's position in the run, 1-based.</param>
/// <param name="AantalDelen">How many parts the run has.</param>
/// <param name="ReeksVan">The first day of the run.</param>
/// <param name="ReeksTot">The last day of the run.</param>
/// <param name="Weken">The whole lesweken the run spans.</param>
/// <param name="EindeAangepast">
/// Whether the run ends on another day than the thema's duration proposes from its first day: the teacher changed the
/// end, the next thema cut it, or the year did.
/// </param>
/// <param name="StoptBijEindeSchooljaar">
/// Whether the run was cut because the school year ends before the thema's duration is over (ADR-0053 R5).
/// </param>
public sealed record ReeksWeergave(
    int Deel,
    int AantalDelen,
    DateOnly ReeksVan,
    DateOnly ReeksTot,
    int Weken,
    bool EindeAangepast,
    bool StoptBijEindeSchooljaar);

/// <summary>
/// The end the tool proposes for a thema starting on a chosen day, and the parts that would be stored
/// (<c>GET …/jaarplan/voorstel</c>, ADR-0053 R2 and R3).
/// </summary>
/// <param name="Van">The chosen first day.</param>
/// <param name="Tot">The proposed last day.</param>
/// <param name="Delen">The parts the tool would store, split at every vacation.</param>
/// <param name="BeperktDoor">
/// Why the proposal is shorter than the thema: <c>VolgendThema</c> when the next placement starts earlier, whose name is
/// in <paramref name="VolgendThemaNaam"/>; <c>Schooljaar</c> when the year ends first; null otherwise.
/// </param>
/// <param name="VolgendThemaNaam">The name of the thema that cut the proposal short, when it was one.</param>
public sealed record EindvoorstelWeergave(
    DateOnly Van,
    DateOnly Tot,
    IReadOnlyList<DeelWeergave> Delen,
    string? BeperktDoor,
    string? VolgendThemaNaam);

/// <summary>One part of a proposed placement.</summary>
public sealed record DeelWeergave(DateOnly Van, DateOnly Tot);
