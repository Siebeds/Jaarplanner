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
public sealed record JaarplanWeergave(
    Guid KlasId,
    string KlasNaam,
    Guid SchooljaarId,
    string SchooljaarNaam,
    string Blokindeling,
    IReadOnlyList<ThemaplaatsingWeergave> Plaatsingen);

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
    IReadOnlyList<string> Doelcodes);
