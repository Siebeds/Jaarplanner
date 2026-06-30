using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Schoolcontent.Beheer;

// Application-layer DTOs for the school-content CRUD use cases (E1-10, FR-3.1/3.2). They are plain
// transport records so the (thin) Api never leaks domain entities and the service signatures stay
// explicit about the level scoping (Art. IX.2): thema/themadoel inputs carry no klas/leeftijd, while
// subthema inputs require both. Dutch domain language for the concepts; English for plumbing (Art. II).

/// <summary>Create payload for a school-wide <see cref="Thema"/> (Art. IX.2 — no klas/leeftijd; scope is school-wide).</summary>
public sealed record ThemaCreatie(
    string Naam,
    int DuurWeken,
    string? Invalshoeken = null,
    IReadOnlyList<string>? Kernwoordenschat = null,
    IReadOnlyList<string>? RijkeWoordenschat = null);

/// <summary>Update payload for a school-wide <see cref="Thema"/>.</summary>
public sealed record ThemaWijziging(
    string Naam,
    int DuurWeken,
    string? Invalshoeken = null,
    IReadOnlyList<string>? Kernwoordenschat = null,
    IReadOnlyList<string>? RijkeWoordenschat = null);

/// <summary>
/// Create payload for a class/age-scoped <see cref="Subthema"/> (Art. IX.2). <see cref="KlasId"/> and
/// <see cref="Leeftijd"/> are <b>required</b> — a subthema cannot exist school-wide; the service rejects
/// a blank/empty scope.
/// </summary>
public sealed record SubthemaCreatie(
    string Naam,
    int DuurWeken,
    Guid KlasId,
    string Leeftijd,
    string? Probleemstelling = null,
    string? Onderzoeksvraag = null);

/// <summary>Update payload for a <see cref="Subthema"/> — the class/age scope may be re-pointed but never cleared.</summary>
public sealed record SubthemaWijzigingInvoer(
    string Naam,
    int DuurWeken,
    Guid KlasId,
    string Leeftijd,
    string? Probleemstelling = null,
    string? Onderzoeksvraag = null);

/// <summary>Create payload for a class/age-scoped <see cref="Activiteit"/> (inherits its subthema's scope, Art. IX.2).</summary>
public sealed record ActiviteitCreatie(
    string Naam,
    ActiviteitType ActiviteitType,
    string? Hoek = null,
    string? VerwachteUitkomsten = null);

/// <summary>Update payload for an <see cref="Activiteit"/>.</summary>
public sealed record ActiviteitWijzigingInvoer(
    string Naam,
    ActiviteitType ActiviteitType,
    string? Hoek = null,
    string? VerwachteUitkomsten = null);

// --- Read models (returned by the queries; flattened views with the goal-link status surfaced). ---

/// <summary>Read view of a goal link (Art. IV.2 — status + AI motivation surfaced).</summary>
public sealed record DoelKoppelingWeergave(Guid Id, string LeerplandoelCode, KoppelingStatus Status, string? AiMotivatie);

/// <summary>Read view of a themadoel (school-scoped; owns one goal link).</summary>
public sealed record ThemadoelWeergave(Guid Id, DoelKoppelingWeergave Koppeling);

/// <summary>Read view of a subdoel (class/age-scoped; owns one goal link).</summary>
public sealed record SubdoelWeergave(Guid Id, string Leeftijd, DoelKoppelingWeergave Koppeling);

/// <summary>Read view of an activiteit with its (zero or more) goal links.</summary>
public sealed record ActiviteitWeergave(
    Guid Id,
    string Naam,
    ActiviteitType ActiviteitType,
    string? Hoek,
    string? VerwachteUitkomsten,
    IReadOnlyList<DoelKoppelingWeergave> Doelkoppelingen);

/// <summary>Read view of a subthema with its subdoelen + activiteiten.</summary>
public sealed record SubthemaWeergave(
    Guid Id,
    Guid ThemaId,
    string Naam,
    int DuurWeken,
    Guid KlasId,
    string Leeftijd,
    string? Probleemstelling,
    string? Onderzoeksvraag,
    IReadOnlyList<SubdoelWeergave> Subdoelen,
    IReadOnlyList<ActiviteitWeergave> Activiteiten);

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
    IReadOnlyList<SubthemaWeergave> Subthemas);
