using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// The persistence seam for the jaarplan-generation flow (Art. VIII layering), the planning sibling of
/// <c>IDoelMatchOpslag</c>. <see cref="JaarplanGeneratieService"/> depends only on this abstraction — not on
/// EF Core — so the whole flow (derive blocks → build prompt → call AI → validate → persist) runs against an
/// in-memory fake with <b>no database and no network</b> in unit tests (Art. IV.6).
/// </summary>
public interface IJaarplanOpslag
{
    /// <summary>
    /// Loads a class together with the <see cref="Schooljaar"/> that contains it (Art. IX.3) — both are needed,
    /// since the class says <i>what</i> is planned and the school year's vakantiestructuur is the input the block
    /// grid is derived from. Returns <c>null</c> when there is no such class.
    /// </summary>
    Task<(Klas Klas, Schooljaar Schooljaar)?> LaadKlasMetSchooljaarAsync(
        Guid klasId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Loads the class's <see cref="Jaarplan"/>, tracked so mutations persist on <see cref="BewaarAsync"/>.
    /// Returns <c>null</c> when the class has no plan yet; the caller creates one via
    /// <see cref="VoegJaarplanToe"/>.
    /// </summary>
    Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>Registers a freshly created plan for persistence (the lazy "one Jaarplan per Klas" creation).</summary>
    void VoegJaarplanToe(Jaarplan jaarplan);

    /// <summary>
    /// Loads the class's kept pre-generation settings (E3-04, FR-5.4), tracked so a replacement persists on
    /// <see cref="BewaarAsync"/>. Returns <c>null</c> when the class has none yet; the caller creates one via
    /// <see cref="VoegGeneratieparametersToe"/>.
    /// <para>
    /// <b>Both ids are required, and that is the scoping decision rather than an implementation detail.</b> Every value
    /// in these settings is a date, so a row must never be read for a school year other than the one it was written
    /// for — see <see cref="Generatieparameters"/> for why the pair is the key.
    /// </para>
    /// </summary>
    Task<Generatieparameters?> LaadGeneratieparametersAsync(
        Guid klasId,
        Guid schooljaarId,
        CancellationToken cancellationToken = default);

    /// <summary>Registers freshly created settings for persistence (the lazy "one row per klas+schooljaar").</summary>
    void VoegGeneratieparametersToe(Generatieparameters parameters);

    /// <summary>
    /// The school's thema's (school-scoped, Art. IX.2) with the goal links needed to describe them — the only
    /// content generation may place, and the set an AI-returned thema name is resolved against.
    /// </summary>
    Task<IReadOnlyList<Thema>> LaadThemasAsync(CancellationToken cancellationToken = default);

    /// <summary>Persists the pending changes as a single unit of work.</summary>
    Task BewaarAsync(CancellationToken cancellationToken = default);
}
