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

    // --- Gedeelde thema-bibliotheek + per-klas afleiding (E1-11, FR-3.3 resolved per-level, Art. IX.2). ---

    /// <summary>
    /// Lists the <b>shared thema-bibliotheek</b>: every school-wide thema with its themadoelen +
    /// kernwoordenschat/rijke woordenschat, <b>without any class's subthema's</b> (no cross-class bleed,
    /// Art. IX.2 / Gap A.5). This is the directie/team view of the shared library; the school-wide content
    /// is edited only via the thema-level operations above, never as a side effect of class-level work.
    /// </summary>
    Task<IReadOnlyList<ThemaBibliotheekItem>> HaalThemaBibliotheekOpAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets a thema <b>as derived for a given klas</b>: the shared thema (its school-wide naam/duur/themadoelen/
    /// woordenschat) plus <b>only that klas's</b> subthema's/subdoelen/activiteiten — class A's derivations never
    /// appear under class B even though both derive from the same shared thema (Art. IX.2). Coherent with
    /// <see cref="HaalThemaBibliotheekOpAsync"/>: same school-wide layer, class-filtered derivations.
    /// </summary>
    Task<ThemaWeergave> HaalThemaVoorKlasAsync(Guid themaId, Guid klasId, CancellationToken cancellationToken = default);

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
    /// Moves an activiteit to another subthema (E4-08, FR-7.2), keeping its attributes and every goal link.
    /// The destination may belong to another thema and to another leeftijd, but <b>not to another klas</b>
    /// (owner ruling, 2026-08-05); the domain enforces that boundary and a crossing is refused as a
    /// <see cref="SchoolcontentValidatieFout"/>.
    /// </summary>
    Task<ActiviteitWeergave> VerplaatsActiviteitAsync(Guid activiteitId, Guid doelSubthemaId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists the subthema's of <b>one klas</b>, across every thema, as candidate destinations for a move
    /// (E4-08). Class-scoped by construction: it filters on <paramref name="klasId"/>, so no other class's
    /// derivations are in the answer to begin with (Art. IX.2), which is the same property
    /// <see cref="HaalThemaVoorKlasAsync"/> relies on.
    /// </summary>
    Task<IReadOnlyList<SubthemaBestemming>> HaalSubthemaBestemmingenAsync(Guid klasId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Links an activiteit to <paramref name="leerplandoelCode"/> (status <c>manueel</c>, Art. IV.2);
    /// an activiteit may carry one or more links. Rejects an unknown code and a duplicate link.
    /// </summary>
    Task<DoelKoppelingWeergave> KoppelActiviteitAanDoelAsync(Guid activiteitId, string leerplandoelCode, CancellationToken cancellationToken = default);

    Task OntkoppelActiviteitDoelAsync(Guid activiteitId, Guid koppelingId, CancellationToken cancellationToken = default);

    // --- Onderzoeksvraag (per subthema). ---

    /// <summary>Adds one onderzoeksvraag to a subthema; returns the new entry.</summary>
    Task<OnderzoeksvraagWeergave> VoegOnderzoeksvraagToeAsync(Guid subthemaId, OnderzoeksvraagCreatie creatie, CancellationToken cancellationToken = default);

    /// <summary>Updates the vraag text and probleemstelling of one onderzoeksvraag.</summary>
    Task<OnderzoeksvraagWeergave> WijzigOnderzoeksvraagAsync(Guid subthemaId, Guid ovId, OnderzoeksvraagCreatie invoer, CancellationToken cancellationToken = default);

    /// <summary>Deletes one onderzoeksvraag. Activiteiten that referenced it have their OnderzoeksvraagId cleared.</summary>
    Task VerwijderOnderzoeksvraagAsync(Guid subthemaId, Guid ovId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Links or unlinks an activiteit to an onderzoeksvraag. Pass null to clear the link.
    /// Validates that the onderzoeksvraag (when non-null) belongs to the same subthema as the activiteit.
    /// </summary>
    Task<ActiviteitWeergave> KoppelActiviteitAanOnderzoeksvraagAsync(Guid activiteitId, Guid? onderzoeksvraagId, CancellationToken cancellationToken = default);
}
