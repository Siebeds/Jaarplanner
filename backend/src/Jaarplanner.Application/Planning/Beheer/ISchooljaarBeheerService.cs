using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Planning.Beheer;

/// <summary>
/// The <b>minimum</b> creation/read path for a <see cref="Schooljaar"/> (Art. IX.3).
/// <para>
/// <b>Why it is here and not left to E6-03.</b> E3-01 owns the "Schooljaar contains multiple klassen"
/// containment, and a <see cref="Klas"/> now requires a school year. Adding a required container with no way to
/// create it would have made <i>class</i> creation unreachable and jaarplan generation unreachable with it — the
/// exact failure this project has already hit three times (a feature with no endpoint, then no UI, then no
/// trigger). So the container gets a creation path in the same change that makes it required.
/// </para>
/// <para>
/// <b>Deliberately minimal.</b> Create, list, read. There is no update and no delete: editing a school year's
/// vakanties reshapes the derived grid and can strand jaarplan placements, which the directie ruling of
/// 2026-07-28 says must raise a persistent review signal rather than move anything — that is E3-07/E3-09 work, and
/// full schooljaarbeheer (incl. per-year block lengths) remains <b>E6-03</b>. Shipping an edit path here would
/// ship the stranding without the signal.
/// </para>
/// <para>
/// Faults use the shared CRUD fault vocabulary
/// (<see cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout"/> → 404,
/// <see cref="Schoolcontent.Beheer.SchoolcontentValidatieFout"/> → 400), as <c>IKlasBeheerService</c> already
/// does, so the existing exception handler maps them with no new plumbing in the (thin) Api (Art. VIII).
/// </para>
/// </summary>
public interface ISchooljaarBeheerService
{
    Task<IReadOnlyList<SchooljaarWeergave>> HaalSchooljarenOpAsync(CancellationToken cancellationToken = default);

    Task<SchooljaarWeergave> HaalSchooljaarOpAsync(Guid schooljaarId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a school year with its vakantie-/periodestructuur. The label must be unique (one "2026-2027"), and
    /// each closure must fall inside the year and not overlap another — the domain enforces both.
    /// </summary>
    Task<SchooljaarWeergave> MaakSchooljaarAsync(SchooljaarCreatie creatie, CancellationToken cancellationToken = default);
}

/// <summary>Input for creating a school year.</summary>
/// <param name="Naam">The label, e.g. "2026-2027". Required, unique.</param>
/// <param name="Start">First school day (typically early September).</param>
/// <param name="Eind">Last school day, inclusive (typically end of June).</param>
/// <param name="Sluitingen">
/// The closures. A <see cref="Sluitingssoort.Vakantie"/> cuts the year into teaching stretches; a
/// <see cref="Sluitingssoort.VrijeDag"/> is a day off inside a stretch and does not break a period (directie
/// 2026-07-28, ADR-0020 §5). The classification is data the school owns, never a threshold in code.
/// </param>
public sealed record SchooljaarCreatie(
    string Naam,
    DateOnly Start,
    DateOnly Eind,
    IReadOnlyList<SchoolsluitingCreatie>? Sluitingen = null);

/// <summary>Input for one closure within a school year.</summary>
/// <param name="Naam">The Dutch name (e.g. "Herfstvakantie", "Hemelvaart", "Pedagogische studiedag").</param>
/// <param name="Start">First day of the closure.</param>
/// <param name="Eind">Last day of the closure (inclusive).</param>
/// <param name="Soort">Whether it breaks a planning period; defaults to <see cref="Sluitingssoort.Vakantie"/>.</param>
public sealed record SchoolsluitingCreatie(
    string Naam,
    DateOnly Start,
    DateOnly Eind,
    Sluitingssoort Soort = Sluitingssoort.Vakantie);

/// <summary>A school year as returned by the API.</summary>
/// <param name="Id">Surrogate identity.</param>
/// <param name="Naam">The label (e.g. "2026-2027").</param>
/// <param name="Start">First school day.</param>
/// <param name="Eind">Last school day (inclusive).</param>
/// <param name="Sluitingen">All closures, ordered by start date.</param>
/// <param name="Klassen">
/// The classes this year contains (Art. IX.3), as (id, naam) pairs — the containment made visible. Each has one
/// jaarplan, reachable at <c>/api/klassen/{klasId}/jaarplan</c>.
/// </param>
public sealed record SchooljaarWeergave(
    Guid Id,
    string Naam,
    DateOnly Start,
    DateOnly Eind,
    IReadOnlyList<SchoolsluitingWeergave> Sluitingen,
    IReadOnlyList<KlasVerwijzing> Klassen);

/// <summary>One closure as returned by the API.</summary>
public sealed record SchoolsluitingWeergave(Guid Id, string Naam, DateOnly Start, DateOnly Eind, string Soort);

/// <summary>A minimal reference to a class contained by a school year.</summary>
public sealed record KlasVerwijzing(Guid Id, string Naam, int Leerjaar);
