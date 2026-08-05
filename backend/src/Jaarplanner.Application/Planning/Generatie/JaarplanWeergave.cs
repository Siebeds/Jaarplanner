namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The reviewable read view of a class's jaarplan (FR-5.1, Art. IV.2) — what the API returns and what a teacher
/// (E3-06's calendar) reviews.
/// <para>
/// <b>The block grid is projected, not stored.</b> Each placement's period bounds and label are resolved at read
/// time against the blocks the <see cref="IPlanningsblokIndeling"/> seam derives right now, so this view honestly
/// reflects the current calendar rather than a snapshot taken at generation time (ADR-0013/0020).
/// </para>
/// </summary>
/// <param name="KlasId">The class this plan belongs to.</param>
/// <param name="KlasNaam">The class name, so a caller need not fetch it separately.</param>
/// <param name="SchooljaarId">The school year the class sits in (Art. IX.3 containment).</param>
/// <param name="SchooljaarNaam">The school year label (e.g. "2026-2027").</param>
/// <param name="Blokindeling">
/// A human-readable description of the configured planning grain (the seam's <c>Omschrijving</c>), so the caller
/// can show <i>why</i> the periods look the way they do instead of inferring a unit.
/// </param>
/// <param name="Plaatsingen">The thema placements, chronological by the block start date they key on.</param>
/// <param name="Blokken">
/// Every block of the <b>generation</b> tier with how full it is: the weeks its thema's need against the weeks it
/// offers, and the resulting <c>IsOverbelast</c> verdict (E3-09, FR-6.4).
/// <para>
/// <b>Why it rides on the plan read and not on the rooster.</b> "Te vol" is a fact about a <i>class's plan</i>, not
/// about the year: the same period is over-full for L3 and empty for L1. <c>PlanningsroosterWeergave</c> is keyed on
/// the schooljaar alone and knows no placements, so it can supply only the available half.
/// </para>
/// <para>
/// <b>Why it is computed here at all rather than in TypeScript.</b> Before E3-09 these figures existed only on the
/// <i>generation</i> response, while the board renders from this read plus the rooster — so the kalender had a
/// provisional threshold of its own that counted thema's and contradicted the server for months. The rule is
/// arithmetic on data the school supplied (Art. IX.3) and it now has exactly one implementation,
/// <see cref="BlokspreidingWeergave.IsOverbelast"/>, reached by both responses.
/// </para>
/// <para>
/// <b>Rejected placements are excluded and stale ones cannot appear</b>, matching the generation path exactly:
/// nothing is taught in a period on account of a thema the teacher threw out (<c>Themaplaatsing.IsGepland</c>), and a
/// stale <c>BlokStart</c> matches no block's start so it lands in no entry. A stale placement is therefore absent
/// from this list <i>and</i> flagged by <see cref="ThemaplaatsingWeergave.IsVervallen"/>, which is the honest pair:
/// its weeks are not attributed to a period that does not hold it, and it is not silently forgotten.
/// </para>
/// <para>
/// <b>Always the generation tier, whatever the board is zoomed to</b> (owner ruling, 2026-07-31). Applied naively at
/// the subthemaperiode tier the arithmetic flags every filled sub-column, since a fortnight offers ~2 weeks against a
/// thema's whole 4 to 6 — a board that signals nothing. The property belongs to the tier a placement keys on
/// (ADR-0020 §3), and the fine view summarises it in one line above the board instead of inheriting a mark per column.
/// </para>
/// </param>
public sealed record JaarplanWeergave(
    Guid KlasId,
    string KlasNaam,
    Guid SchooljaarId,
    string SchooljaarNaam,
    string Blokindeling,
    IReadOnlyList<ThemaplaatsingWeergave> Plaatsingen,
    IReadOnlyList<BlokspreidingWeergave> Blokken);

/// <summary>
/// One thema placement as returned by the API: the persisted facts plus the block bounds projected from the
/// currently derived grid.
/// </summary>
/// <param name="Id">The placement's identity — what the review/lock endpoints address.</param>
/// <param name="ThemaId">The placed thema.</param>
/// <param name="ThemaNaam">The thema's name.</param>
/// <param name="BlokNiveau">The tier of the block (themaperiode / subthemaperiode).</param>
/// <param name="BlokStart">
/// The <b>persisted key</b>: the start date of the block the thema is placed in. Never an ordinal (ADR-0020 §3).
/// </param>
/// <param name="BlokEind">
/// The end date of the matching derived block, or <c>null</c> when no current block starts on
/// <paramref name="BlokStart"/> — see <paramref name="IsVervallen"/>.
/// </param>
/// <param name="BlokOrdinaal">
/// The matching block's display position ("periode 3"), or <c>null</c> when the placement is stale. Present for
/// display only; it is not the key and shifts when the school edits its vakanties.
/// </param>
/// <param name="IsVervallen">
/// <c>true</c> when <paramref name="BlokStart"/> is no longer the start of any derived block — i.e. the school
/// edited its vakanties and this placement now points at a date that is not a period boundary. The application
/// deliberately does <b>not</b> guess a new period (directie 2026-07-28, ADR-0020 follow-ups); it reports the
/// fact. Surfacing it as a non-dismissible signal and refusing a dekking figure while it holds are E3-07/E3-09/E5
/// obligations — this flag is the honest input they need, not a claim that they are implemented.
/// </param>
/// <param name="Status">The persisted human-in-the-loop status (Art. IV.2): voorgesteld/aanvaard/geweigerd/manueel.</param>
/// <param name="AiMotivatie">The AI's short "waarom hier?" motivation (Art. IV.3); null for a manual placement.</param>
/// <param name="Vergrendeld">Whether the teacher locked this placement against (re)generation (Art. IX.3, E4).</param>
/// <param name="Doelcodes">
/// The leerplandoel codes this thema actually carries (themadoelen + accepted/manual links). <b>Derived, never
/// stored on the plan</b> — a goal is covered because its thema is placed (Art. V.1), and duplicating the codes
/// onto the placement would be storing dekking, which Art. V.1 forbids.
/// </param>
/// <param name="DuurWeken">
/// The thema's nominal duration in weeks, straight off the <c>Thema</c> (E3-09).
/// <para>
/// Carried so the board can answer "would this period become te vol?" <b>during</b> the drag, before the drop, which
/// is the one question a teacher rearranging a year is actually asking. A hover cannot round-trip to the server, so
/// the client adds this to the target block's <c>BenodigdeWeken</c> and applies the same comparison. That is the only
/// sanctioned mirror of <see cref="BlokspreidingWeergave.IsOverbelast"/>, and a frontend test pins the mirror against
/// the server's own answer for the state already on screen so the two cannot drift.
/// </para>
/// <para>
/// 0 when the thema could not be resolved, the same degrade <paramref name="ThemaNaam"/> takes. <c>DuurWeken</c> is
/// <c>RequirePositive</c> in the domain, so 0 means "unknown thema", never "a thema of no length".
/// </para>
/// </param>
public sealed record ThemaplaatsingWeergave(
    Guid Id,
    Guid ThemaId,
    string ThemaNaam,
    string BlokNiveau,
    DateOnly BlokStart,
    DateOnly? BlokEind,
    int? BlokOrdinaal,
    bool IsVervallen,
    string Status,
    string? AiMotivatie,
    bool Vergrendeld,
    IReadOnlyList<string> Doelcodes,
    int DuurWeken);
