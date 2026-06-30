namespace Jaarplanner.Application.Schoolcontent.Beheer;

/// <summary>
/// CRUD use cases for the autonomous school-content hierarchy (E1-10, FR-3.1/3.2): add/edit/delete a
/// <c>Thema</c> / <c>Subthema</c> / <c>Activiteit</c>, manage the 2–3 <c>Themadoel</c>en per thema, and
/// link a subthema/activiteit to one or more leerdoelen — each link persisted with its
/// <c>KoppelingStatus</c> (manual links land as <c>manueel</c>, Art. IV.2).
/// <para>
/// <b>Level scoping is enforced here (Art. IX.2).</b> Thema + Themadoel + kernwoordenschat are
/// school-wide (no klas/leeftijd in their inputs); Subthema/Subdoel/Activiteit are per class &amp; age
/// (a subthema input must carry a real klas + leeftijd, else <see cref="SchoolcontentValidatieFout"/>).
/// Goal links reference a read-only <c>Leerplandoel</c> by code; an unknown code is rejected and the
/// curriculum is never mutated (Art. III).
/// </para>
/// </summary>
public interface ISchoolcontentBeheerService
{
    // --- Thema (school-scoped). ---

    Task<ThemaWeergave> MaakThemaAsync(ThemaCreatie creatie, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ThemaWeergave>> HaalThemasOpAsync(CancellationToken cancellationToken = default);

    Task<ThemaWeergave> HaalThemaOpAsync(Guid themaId, CancellationToken cancellationToken = default);

    Task<ThemaWeergave> WijzigThemaAsync(Guid themaId, ThemaWijziging wijziging, CancellationToken cancellationToken = default);

    Task VerwijderThemaAsync(Guid themaId, CancellationToken cancellationToken = default);

    // --- Themadoel (school-scoped; 2–3 per thema, Art. IX.2). ---

    /// <summary>
    /// Adds a manually created themadoel linking the thema to <paramref name="leerplandoelCode"/>
    /// (status <c>manueel</c>, Art. IV.2). Rejects a 4th themadoel (Art. IX.2) and an unknown code.
    /// </summary>
    Task<ThemadoelWeergave> VoegThemadoelToeAsync(Guid themaId, string leerplandoelCode, CancellationToken cancellationToken = default);

    Task VerwijderThemadoelAsync(Guid themaId, Guid themadoelId, CancellationToken cancellationToken = default);

    // --- Subthema (class/age-scoped). ---

    Task<SubthemaWeergave> MaakSubthemaAsync(Guid themaId, SubthemaCreatie creatie, CancellationToken cancellationToken = default);

    Task<SubthemaWeergave> WijzigSubthemaAsync(Guid subthemaId, SubthemaWijzigingInvoer wijziging, CancellationToken cancellationToken = default);

    Task VerwijderSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Links a subthema to <paramref name="leerplandoelCode"/> by creating a manual subdoel
    /// (status <c>manueel</c>) at the subthema's own leeftijd (the per-(subthema × leeftijd) carrier of
    /// the link in the model, Art. IX.2). Rejects an unknown code.
    /// </summary>
    Task<SubdoelWeergave> KoppelSubthemaAanDoelAsync(Guid subthemaId, string leerplandoelCode, CancellationToken cancellationToken = default);

    Task OntkoppelSubdoelAsync(Guid subthemaId, Guid subdoelId, CancellationToken cancellationToken = default);

    // --- Activiteit (class/age-scoped). ---

    Task<ActiviteitWeergave> MaakActiviteitAsync(Guid subthemaId, ActiviteitCreatie creatie, CancellationToken cancellationToken = default);

    Task<ActiviteitWeergave> WijzigActiviteitAsync(Guid activiteitId, ActiviteitWijzigingInvoer wijziging, CancellationToken cancellationToken = default);

    Task VerwijderActiviteitAsync(Guid activiteitId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Links an activiteit to <paramref name="leerplandoelCode"/> (status <c>manueel</c>, Art. IV.2);
    /// an activiteit may carry one or more links. Rejects an unknown code and a duplicate link.
    /// </summary>
    Task<DoelKoppelingWeergave> KoppelActiviteitAanDoelAsync(Guid activiteitId, string leerplandoelCode, CancellationToken cancellationToken = default);

    Task OntkoppelActiviteitDoelAsync(Guid activiteitId, Guid koppelingId, CancellationToken cancellationToken = default);
}
