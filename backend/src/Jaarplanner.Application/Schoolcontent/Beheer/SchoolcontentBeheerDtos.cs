using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Schoolcontent.Beheer;

// Application-layer DTOs for the school-content CRUD use cases (E1-10, FR-3.1/3.2). They are plain
// transport records so the (thin) Api never leaks domain entities and the service signatures stay
// explicit about the level scoping (Art. IX.2): thema/themadoel inputs carry no klas/leeftijd, while
// subthema inputs require both. Dutch domain language for the concepts; English for plumbing (Art. II).

/// <summary>Create/update payload for one <see cref="Onderzoeksvraag"/> on a subthema.</summary>
public sealed record OnderzoeksvraagCreatie(
    string Vraag,
    string? Probleemstelling = null);

/// <summary>Read view of one <see cref="Onderzoeksvraag"/>.</summary>
public sealed record OnderzoeksvraagWeergave(
    Guid Id,
    string Vraag,
    string? Probleemstelling);

/// <summary>
/// Create payload for a school-wide <see cref="Thema"/> (Art. IX.2 — no klas; shared school-wide). <see cref="Leeftijden"/>
/// limits it to certain leeftijden (ADR-0069); <c>null</c> means all nine.
/// </summary>
public sealed record ThemaCreatie(
    string Naam,
    int DuurWeken,
    string? Invalshoeken = null,
    IReadOnlyList<string>? Kernwoordenschat = null,
    IReadOnlyList<string>? RijkeWoordenschat = null,
    string? Icoon = null,
    IReadOnlyList<string>? Leeftijden = null);

/// <summary>
/// Update payload for a school-wide <see cref="Thema"/>. A <c>null</c> list leaves that list unchanged, the
/// <see cref="Leeftijden"/> included (ADR-0069).
/// </summary>
public sealed record ThemaWijziging(
    string Naam,
    int DuurWeken,
    string? Invalshoeken = null,
    IReadOnlyList<string>? Kernwoordenschat = null,
    IReadOnlyList<string>? RijkeWoordenschat = null,
    string? Icoon = null,
    IReadOnlyList<string>? Leeftijden = null);

/// <summary>
/// Create payload for an age-scoped <see cref="Subthema"/> (Art. IX.2, amended 2026-08-30).
/// <see cref="Leeftijd"/> is <b>required</b> and must be one of the nine Op.stap jaar/fase codes; the service
/// rejects anything else.
/// <para>
/// <b>There is no KlasId, and its absence is the change.</b> A subthema belongs to an age and holds for every
/// class that teaches it, so a caller that knew which class it was creating for no longer has anything to say
/// about it.
/// </para>
/// <para>
/// <see cref="Leeftijd"/> is <b>nullable at binding on purpose</b> (E6-02 slice 3, fix round 1). Required in meaning,
/// but a non-nullable property makes ASP.NET Core refuse a missing one with its own English 400 before the controller
/// runs, so the Dutch refusal the write and the rights check share never gets to answer. Null is refused like blank.
/// </para>
/// </summary>
public sealed record SubthemaCreatie(
    string Naam,
    int DuurWeken,
    string? Leeftijd,
    IReadOnlyList<OnderzoeksvraagCreatie>? Onderzoeksvragen = null);

/// <summary>
/// Update payload for a <see cref="Subthema"/> — the age scope may be re-pointed but never cleared.
/// Re-pointing it moves the subthema between classes, because a class reaches it through the age it teaches.
/// </summary>
/// <remarks><c>Leeftijd</c> is nullable at binding for the reason <see cref="SubthemaCreatie"/> gives.</remarks>
public sealed record SubthemaWijzigingInvoer(
    string Naam,
    int DuurWeken,
    string? Leeftijd,
    IReadOnlyList<OnderzoeksvraagCreatie>? Onderzoeksvragen = null);

/// <summary>Create payload for an <see cref="Activiteit"/> (inherits its subthema's age scope, Art. IX.2).</summary>
/// <param name="ActiviteitType">
/// The soort, or null for none. Nullable so that a payload without it stores none: as a plain enum an absent field
/// silently became <c>Experiment</c>, the enum's zero value (FB-050). The same holds for the update payload.
/// </param>
/// <param name="LeerplandoelCodes">
/// Goals to link in the same request, each landing as a <see cref="KoppelingStatus.Manueel"/>
/// <see cref="DoelKoppeling"/> because a code in a create payload is a teacher deciding, never the model
/// proposing (Art. IV.2).
/// <para>
/// It is on the create payload rather than left to the per-link endpoint because that endpoint keys on the
/// activiteit's id, which does not exist until this request returns. The form therefore could not offer the
/// goal picker while creating at all, and a teacher making an activiteit from the agenda had to save it,
/// find it again and open it before the section appeared.
/// </para>
/// <para>
/// Null and empty mean the same thing and are both allowed: most activiteiten are created without goals and
/// linked later, which is why the per-link endpoints stay.
/// </para>
/// </param>
public sealed record ActiviteitCreatie(
    string Naam,
    ActiviteitType? ActiviteitType,
    string? Hoek = null,
    string? VerwachteUitkomsten = null,
    Guid? OnderzoeksvraagId = null,
    Activiteitkleur? Kleur = null,
    int LengteInLesuren = 1,
    IReadOnlyList<string>? LeerplandoelCodes = null,
    bool Gedeeld = false);

/// <summary>Update payload for an <see cref="Activiteit"/>.</summary>
public sealed record ActiviteitWijzigingInvoer(
    string Naam,
    ActiviteitType? ActiviteitType,
    string? Hoek = null,
    string? VerwachteUitkomsten = null,
    Activiteitkleur? Kleur = null,
    Guid? OnderzoeksvraagId = null,
    int LengteInLesuren = 1);

/// <summary>
/// Move payload for an <see cref="Activiteit"/> (E4-08, FR-7.2): the subthema it should end up in. Only the
/// destination is named, because the source is derived from the activiteit itself and a caller that could
/// state both could state a pair that does not match.
/// </summary>
public sealed record ActiviteitVerplaatsingInvoer(Guid DoelSubthemaId);

// --- Read models (returned by the queries; flattened views with the goal-link status surfaced). ---

/// <summary>
/// Read view of a goal link (Art. IV.2 — status + AI motivation surfaced).
/// <para>
/// <see cref="Tekst"/>, <see cref="Doelsoort"/> and <see cref="NietMeerInOpstap"/> are the linked leerplandoel's own
/// fields, carried so a row can say what the doel is without reading the doel's heavy detail (TB-017). The thema
/// reads fill them with one query per request for every code in the tree. A write's answer and every other view
/// leave them null, as does a code without a leerplandoel row; a client then reads the doel itself.
/// </para>
/// </summary>
public sealed record DoelKoppelingWeergave(
    Guid Id,
    string LeerplandoelCode,
    KoppelingStatus Status,
    string? AiMotivatie,
    string? Tekst = null,
    Doelsoort? Doelsoort = null,
    bool? NietMeerInOpstap = null);

/// <summary>Read view of a themadoel (school-scoped; owns one goal link).</summary>
public sealed record ThemadoelWeergave(Guid Id, DoelKoppelingWeergave Koppeling);

/// <summary>
/// Read view of a minimumdoel a thema aims at (FB-043). Only the ref: its text and the leerplandoelen it brings along
/// are the minimumdoel's own detail (<c>GET /api/minimumdoelen/{ref}</c>), which a client already reads.
/// </summary>
public sealed record ThemaMinimumdoelWeergave(Guid Id, string MinimumdoelRef);

/// <summary>Read view of a subdoel (class/age-scoped; owns one goal link).</summary>
public sealed record SubdoelWeergave(Guid Id, string Leeftijd, DoelKoppelingWeergave Koppeling);

/// <summary>
/// Read view of an activiteit with its (zero or more) goal links. <paramref name="MakerId"/> is who created it, or
/// null (ADR-0030 R26): the frontend compares it with <c>GET /api/ik</c>'s id to offer the maker's delete (R33).
/// <paramref name="EigenaarId"/> and <paramref name="EigenaarNaam"/> name the owner of an own activiteit (ADR-0049), and
/// are null for a shared one; the name is null too when the owner cannot be found.
/// </summary>
public sealed record ActiviteitWeergave(
    Guid Id,
    string Naam,
    ActiviteitType? ActiviteitType,
    string? Hoek,
    string? VerwachteUitkomsten,
    Guid? OnderzoeksvraagId,
    Activiteitkleur? Kleur,
    int LengteInLesuren,
    IReadOnlyList<DoelKoppelingWeergave> Doelkoppelingen,
    Guid? MakerId = null,
    Guid? EigenaarId = null,
    string? EigenaarNaam = null);

/// <summary>Read view of a subthema with its subdoelen + activiteiten.</summary>
public sealed record SubthemaWeergave(
    Guid Id,
    Guid ThemaId,
    string Naam,
    int DuurWeken,
    string Leeftijd,
    IReadOnlyList<OnderzoeksvraagWeergave> Onderzoeksvragen,
    IReadOnlyList<SubdoelWeergave> Subdoelen,
    IReadOnlyList<ActiviteitWeergave> Activiteiten);

/// <summary>
/// One candidate destination for moving an activiteit (E4-08, FR-7.2): a subthema at an age this klas teaches, named
/// together with the thema it hangs under so a teacher can tell two same-named subthema's apart.
/// <para>
/// It is a deliberately thin projection rather than a <see cref="SubthemaWeergave"/>: a picker needs a label,
/// not a subtree of subdoelen and activiteiten. The <see cref="Leeftijd"/> is included because a move may cross
/// it — a class that teaches more than one age sees a destination at each — and a teacher choosing one should
/// see which age they are moving the activiteit to rather than discover it afterwards.
/// </para>
/// </summary>
public sealed record SubthemaBestemming(
    Guid Id,
    string Naam,
    string Leeftijd,
    Guid ThemaId,
    string ThemaNaam);

/// <summary>Read view of a thema and its whole subtree (themadoelen + subthema's).</summary>
public sealed record ThemaWeergave(
    Guid Id,
    string Naam,
    int DuurWeken,
    string? Invalshoeken,
    IReadOnlyList<string> Kernwoordenschat,
    IReadOnlyList<string> RijkeWoordenschat,
    bool HeeftVoldoendeThemadoelen,
    IReadOnlyList<ThemadoelWeergave> Themadoelen,
    IReadOnlyList<ThemaMinimumdoelWeergave> Minimumdoelen,
    IReadOnlyList<SubthemaWeergave> Subthemas,
    IReadOnlyList<string> Leeftijden,
    string? Icoon = null);

/// <summary>
/// Read view of a single entry in the <b>shared thema-bibliotheek</b> (E1-11, FR-3.3 resolved per-level,
/// Art. IX.2, Gap A.5). It exposes <b>only</b> the school-wide layer of a thema — naam, duur, invalshoeken,
/// the two-tier woordenschat and the 2–3 themadoelen — and <b>deliberately omits all subthema's</b>: those
/// are age-scoped derivations whose content must never leak into the school-wide library view (Gap A.5).
/// <see cref="AantalAfgeleideLeeftijden"/> is a derived count (how many distinct ages have a subthema under this
/// thema) so the admin can see uptake without exposing any of that content.
/// <para>
/// It counted distinct KLASSEN until the 2026-08-30 amendment to Art. IX.2. A subthema no longer names a klas,
/// so that number has nothing to count; ages are what this thema can honestly report, and they answer the more
/// useful question anyway — whether a thema is built out for the age a reader teaches.
/// </para>
/// </summary>
public sealed record ThemaBibliotheekItem(
    Guid Id,
    string Naam,
    int DuurWeken,
    string? Invalshoeken,
    IReadOnlyList<string> Kernwoordenschat,
    IReadOnlyList<string> RijkeWoordenschat,
    bool HeeftVoldoendeThemadoelen,
    IReadOnlyList<ThemadoelWeergave> Themadoelen,
    IReadOnlyList<ThemaMinimumdoelWeergave> Minimumdoelen,
    int AantalAfgeleideLeeftijden,
    int AantalSubthemas,
    int AantalActiviteiten,
    int AantalDoelkoppelingen,
    IReadOnlyList<string> Leeftijden,
    string? Icoon = null);
