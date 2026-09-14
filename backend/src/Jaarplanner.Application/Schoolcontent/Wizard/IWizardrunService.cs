using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Schoolcontent.Wizard;

/// <summary>
/// The thema-opbouw wizard's own write actions (E6-02, ADR-0030 R29, R32; defaults I18, I22–I25, I27). Themabeheer
/// creates subthema's, subdoelen and activiteiten only through these, and only for a thema a run built from scratch;
/// the ordinary routes give it no such right (I22).
/// <para>
/// <b>Who may call them is the Api's question</b> (the matrix rows <c>ThemaOpbouw</c> and <c>Wizardinhoud</c>:
/// directie and themabeheer). <b>What a run allows is this service's</b>, and it holds for everyone, directie included:
/// <list type="bullet">
/// <item>the run must be open (I24);</item>
/// <item>content goes only under the run's own thema, and an edit or delete reaches an activiteit only while it is still
/// there;</item>
/// <item>an edit or delete reaches only what the same run created (I25);</item>
/// <item>the wizard does not carry someone else's work to another leeftijd; a wizard delete that would take a goal link
/// along needs the goal-link right at that leeftijd, exactly as creating one does; and a leeftijd change that would carry
/// a goal link along needs it "at both the old and the new leeftijd" (I27, with the owner's Q4 and Q5 answers of
/// 2026-09-14; R19).</item>
/// </list>
/// Every refusal of that kind is a <see cref="WizardrunWeigering"/>. A missing run or item is a
/// <see cref="SchoolcontentNietGevondenFout"/>, checked before the refusal, so an id that names nothing says so.
/// </para>
/// <para>
/// <b>Every write goes through the ordinary beheer service</b> and so meets the same rules and the same Dutch sentences
/// (leeftijd, leerplandoel code, lengte), in one transaction with the run's own bookkeeping: an item is never created
/// without the run knowing it created it, nor recorded without existing.
/// </para>
/// </summary>
public interface IWizardrunService
{
    /// <summary>Starts a run: creates the new thema and the run that built it. The starter is recorded when they have a row.</summary>
    Task<WizardrunWeergave> StartAsync(ThemaCreatie creatie, Guid? starterId, CancellationToken cancellationToken = default);

    /// <summary>The run with what it created and whether it is still open.</summary>
    Task<WizardrunWeergave> HaalOpAsync(Guid runId, CancellationToken cancellationToken = default);

    /// <summary>Creates a subthema under the run's thema, at any leeftijd.</summary>
    Task<SubthemaWeergave> MaakSubthemaAsync(Guid runId, SubthemaCreatie creatie, CancellationToken cancellationToken = default);

    /// <summary>
    /// Edits a subthema this run created (I25). Its leeftijd may change only while everything under it is the run's own
    /// (I27): otherwise someone else's subdoelen or activiteiten would move to another leeftijd with it. And while an
    /// activiteit under it carries a goal link, only for a <paramref name="gebruikerId"/> who holds the goal-link right
    /// "at both the old and the new leeftijd", because the link moves with it (I27 as ratified on the owner's Q5 answer
    /// of 2026-09-14; R19).
    /// </summary>
    Task<SubthemaWeergave> WijzigSubthemaAsync(
        Guid runId, Guid subthemaId, SubthemaWijzigingInvoer wijziging, Guid? gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a subthema this run created (I25). Refused while it holds a subdoel or activiteit the run did not create,
    /// because the delete would take that along; and while an activiteit under it carries a goal link, unless
    /// <paramref name="gebruikerId"/> may link goals at that leeftijd (I27, R19).
    /// </summary>
    Task VerwijderSubthemaAsync(Guid runId, Guid subthemaId, Guid? gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Creates a subdoel (a manual goal link) on a subthema of the run's thema.</summary>
    Task<SubdoelWeergave> MaakSubdoelAsync(Guid runId, Guid subthemaId, string leerplandoelCode, CancellationToken cancellationToken = default);

    /// <summary>Deletes a subdoel this run created (I25).</summary>
    Task VerwijderSubdoelAsync(Guid runId, Guid subthemaId, Guid subdoelId, CancellationToken cancellationToken = default);

    /// <summary>Creates an activiteit on a subthema of the run's thema; <paramref name="makerId"/> is its maker (I18).</summary>
    Task<ActiviteitWeergave> MaakActiviteitAsync(Guid runId, Guid subthemaId, Guid? makerId, ActiviteitCreatie creatie, CancellationToken cancellationToken = default);

    /// <summary>Edits an activiteit this run created and that is still under the run's thema (I25).</summary>
    Task<ActiviteitWeergave> WijzigActiviteitAsync(Guid runId, Guid activiteitId, ActiviteitWijzigingInvoer wijziging, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes an activiteit this run created and that is still under the run's thema (I25). Refused while a goal is
    /// linked to it, unless <paramref name="gebruikerId"/> may link goals at that leeftijd (I27, R19).
    /// </summary>
    Task VerwijderActiviteitAsync(Guid runId, Guid activiteitId, Guid? gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Finishes the run. Its thema follows the ordinary rights from then on (I23).</summary>
    Task<WizardrunWeergave> RondAfAsync(Guid runId, CancellationToken cancellationToken = default);

    /// <summary>Closes the run without finishing it. Its thema follows the ordinary rights from then on (I23).</summary>
    Task<WizardrunWeergave> SluitAsync(Guid runId, CancellationToken cancellationToken = default);
}

/// <summary>A wizard run as the Api returns it.</summary>
/// <param name="Id">The run.</param>
/// <param name="ThemaId">The thema it built.</param>
/// <param name="GestartDoorId">Who started it, or <c>null</c>.</param>
/// <param name="GestartOp">When it started.</param>
/// <param name="LaatsteSchrijfactieOp">Its last write action.</param>
/// <param name="SluitUiterlijkOp">When it ends by itself if nothing is written first (I24).</param>
/// <param name="AfgerondOp">When it was finished, or <c>null</c>.</param>
/// <param name="GeslotenOp">When it was closed, or <c>null</c>.</param>
/// <param name="IsOpen">Whether it is open now.</param>
/// <param name="Aangemaakt">What it created and what still exists as far as it knows.</param>
public sealed record WizardrunWeergave(
    Guid Id,
    Guid ThemaId,
    Guid? GestartDoorId,
    DateTimeOffset GestartOp,
    DateTimeOffset LaatsteSchrijfactieOp,
    DateTimeOffset SluitUiterlijkOp,
    DateTimeOffset? AfgerondOp,
    DateTimeOffset? GeslotenOp,
    bool IsOpen,
    IReadOnlyList<WizardrunitemWeergave> Aangemaakt);

/// <summary>One item a run created.</summary>
public sealed record WizardrunitemWeergave(Wizarditemsoort Soort, Guid Id);

/// <summary>
/// A wizard action the run does not allow: it has ended, the content is not under its thema, the item is not one it
/// created, or it would carry off someone else's work, or remove a goal link or carry one to another leeftijd without the
/// caller's goal-link right there (I23–I25, I27). The Api answers 403, for directie as well: directie does the same on
/// the ordinary routes. The message is Dutch and a screen may show it (Art. II.3).
/// </summary>
public sealed class WizardrunWeigering : Exception
{
    public WizardrunWeigering(string message)
        : base(message)
    {
    }
}
