using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Schoolcontent.Wizard;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.SchoolcontentBeheer;

/// <summary>
/// EF Core implementation of <see cref="IWizardrunService"/> (E6-02, ADR-0030 R32, I22–I25).
/// <para>
/// <b>Order of the questions, the same in every action.</b> The run exists (404), the run is open (403), the addressed
/// subthema, subdoel or activiteit exists (404), and it is the run's to touch (403). An id that names nothing therefore
/// always says so, and a refusal is only ever about something real.
/// </para>
/// <para>
/// <b>One transaction per action.</b> The write goes through <see cref="ISchoolcontentBeheerService"/>, which saves on
/// its own, and the run's bookkeeping is saved after it. Both share this request's <see cref="AppDbContext"/>, so the
/// transaction opened here spans the two, and a failure in either leaves neither.
/// </para>
/// <para>
/// <b>The clock is read once per action</b>, from the injected <see cref="TimeProvider"/>, so "is it open" and "when did
/// it last write" are the same instant. The fourteen days are a span between two instants, so the school's zone does not
/// enter it.
/// </para>
/// </summary>
public sealed class WizardrunService : IWizardrunService
{
    private const string RunNietGevonden = "Deze wizard bestaat niet meer.";
    private const string RunAfgelopen = "Deze wizard is afgelopen.";
    private const string NietVanDitThema = "Dit subthema hoort niet bij het thema van deze wizard.";
    private const string NietInDezeWizard = "Dit is niet in deze wizard aangemaakt.";

    private readonly AppDbContext _context;
    private readonly ISchoolcontentBeheerService _beheer;
    private readonly TimeProvider _tijd;

    public WizardrunService(AppDbContext context, ISchoolcontentBeheerService beheer, TimeProvider tijd)
    {
        _context = context;
        _beheer = beheer;
        _tijd = tijd;
    }

    public async Task<WizardrunWeergave> StartAsync(ThemaCreatie creatie, Guid? starterId, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var thema = await _beheer.MaakThemaAsync(creatie, cancellationToken);

        // Stored as none when the starter has no row, as an activiteit's maker is: the session has passed, and none is
        // what their removal would leave anyway.
        var starter = starterId is { } id && await _context.Gebruikers.AnyAsync(g => g.Id == id, cancellationToken)
            ? starterId
            : null;

        var run = new Wizardrun(thema.Id, starter, nu);
        _context.Wizardruns.Add(run);
        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);

        return Map(run, nu);
    }

    public async Task<WizardrunWeergave> HaalOpAsync(Guid runId, CancellationToken cancellationToken = default)
    {
        var run = await _context.Wizardruns.AsNoTracking().FirstOrDefaultAsync(r => r.Id == runId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(RunNietGevonden);

        return Map(run, _tijd.GetUtcNow());
    }

    public async Task<SubthemaWeergave> MaakSubthemaAsync(Guid runId, SubthemaCreatie creatie, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);

        var subthema = await _beheer.MaakSubthemaAsync(run.ThemaId, creatie, cancellationToken);
        run.RegistreerAanmaak(Wizarditemsoort.Subthema, subthema.Id, nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
        return subthema;
    }

    public async Task<SubthemaWeergave> WijzigSubthemaAsync(
        Guid runId, Guid subthemaId, SubthemaWijzigingInvoer wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        await VereisSubthemaAsync(subthemaId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Subthema, subthemaId);

        var subthema = await _beheer.WijzigSubthemaAsync(subthemaId, wijziging, cancellationToken);
        run.RegistreerWijziging(nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
        return subthema;
    }

    public async Task VerwijderSubthemaAsync(Guid runId, Guid subthemaId, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        await VereisSubthemaAsync(subthemaId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Subthema, subthemaId);

        // The delete takes the subthema's subdoelen and activiteiten along (SubthemaConfiguration). I25 lets the wizard
        // delete what its run created "and nothing else", so one that someone else put under it, on the ordinary routes,
        // stops the delete. Directie or a hoofdleerkracht of that leeftijd can still delete it there.
        var subdoelIds = await _context.Subdoelen
            .Where(sd => sd.SubthemaId == subthemaId).Select(sd => sd.Id).ToListAsync(cancellationToken);
        var activiteitIds = await _context.Activiteiten
            .Where(a => a.SubthemaId == subthemaId).Select(a => a.Id).ToListAsync(cancellationToken);
        if (subdoelIds.Any(id => !run.HeeftAangemaakt(Wizarditemsoort.Subdoel, id))
            || activiteitIds.Any(id => !run.HeeftAangemaakt(Wizarditemsoort.Activiteit, id)))
        {
            throw new WizardrunWeigering(
                "Onder dit subthema staan subdoelen of activiteiten die niet in deze wizard aangemaakt zijn. "
                + "Die zouden mee verdwijnen, dus de wizard verwijdert het niet.");
        }

        await _beheer.VerwijderSubthemaAsync(subthemaId, cancellationToken);
        run.RegistreerVerwijdering([subthemaId, .. subdoelIds, .. activiteitIds], nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
    }

    public async Task<SubdoelWeergave> MaakSubdoelAsync(
        Guid runId, Guid subthemaId, string leerplandoelCode, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        await VereisSubthemaVanRunAsync(run, subthemaId, cancellationToken);

        var subdoel = await _beheer.KoppelSubthemaAanDoelAsync(subthemaId, leerplandoelCode, cancellationToken);
        run.RegistreerAanmaak(Wizarditemsoort.Subdoel, subdoel.Id, nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
        return subdoel;
    }

    public async Task VerwijderSubdoelAsync(Guid runId, Guid subthemaId, Guid subdoelId, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        if (!await _context.Subdoelen.AnyAsync(sd => sd.Id == subdoelId && sd.SubthemaId == subthemaId, cancellationToken))
        {
            // The same sentence the ordinary route answers for the same fact.
            throw new SchoolcontentNietGevondenFout("Dit subdoel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.");
        }

        VereisEigen(run, Wizarditemsoort.Subdoel, subdoelId);

        await _beheer.OntkoppelSubdoelAsync(subthemaId, subdoelId, cancellationToken);
        run.RegistreerVerwijdering([subdoelId], nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
    }

    public async Task<ActiviteitWeergave> MaakActiviteitAsync(
        Guid runId, Guid subthemaId, Guid? makerId, ActiviteitCreatie creatie, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(creatie);
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        await VereisSubthemaVanRunAsync(run, subthemaId, cancellationToken);

        // The caller is the maker (I18), through the same path as a hand create, so the same rules apply to it.
        var activiteit = await _beheer.MaakActiviteitAsync(subthemaId, makerId, creatie, cancellationToken);
        run.RegistreerAanmaak(Wizarditemsoort.Activiteit, activiteit.Id, nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
        return activiteit;
    }

    public async Task<ActiviteitWeergave> WijzigActiviteitAsync(
        Guid runId, Guid activiteitId, ActiviteitWijzigingInvoer wijziging, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        await VereisActiviteitAsync(activiteitId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Activiteit, activiteitId);

        var activiteit = await _beheer.WijzigActiviteitAsync(activiteitId, wijziging, cancellationToken);
        run.RegistreerWijziging(nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
        return activiteit;
    }

    public async Task VerwijderActiviteitAsync(Guid runId, Guid activiteitId, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        await VereisActiviteitAsync(activiteitId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Activiteit, activiteitId);

        await _beheer.VerwijderActiviteitAsync(activiteitId, cancellationToken);
        run.RegistreerVerwijdering([activiteitId], nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
    }

    public async Task<WizardrunWeergave> RondAfAsync(Guid runId, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);

        run.RondAf(nu);
        await _context.SaveChangesAsync(cancellationToken);
        return Map(run, nu);
    }

    public async Task<WizardrunWeergave> SluitAsync(Guid runId, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);

        run.Sluit(nu);
        await _context.SaveChangesAsync(cancellationToken);
        return Map(run, nu);
    }

    // --- The questions every action asks, in the order the class summary gives. ---

    private async Task<Wizardrun> LaadOpenRunAsync(Guid runId, DateTimeOffset nu, CancellationToken cancellationToken)
    {
        var run = await _context.Wizardruns.FirstOrDefaultAsync(r => r.Id == runId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(RunNietGevonden);

        // "Afgelopen" and nothing more: finished, closed and fourteen silent days all land here, and the sentence may
        // only say what all three share (the E5-03 rule).
        return run.IsOpen(nu) ? run : throw new WizardrunWeigering(RunAfgelopen);
    }

    private async Task VereisSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken)
    {
        if (!await _context.Subthemas.AnyAsync(s => s.Id == subthemaId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");
        }
    }

    private async Task VereisSubthemaVanRunAsync(Wizardrun run, Guid subthemaId, CancellationToken cancellationToken)
    {
        var themaId = await _context.Subthemas
            .Where(s => s.Id == subthemaId)
            .Select(s => (Guid?)s.ThemaId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout("Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.");

        if (themaId != run.ThemaId)
        {
            throw new WizardrunWeigering(NietVanDitThema);
        }
    }

    private async Task VereisActiviteitAsync(Guid activiteitId, CancellationToken cancellationToken)
    {
        if (!await _context.Activiteiten.AnyAsync(a => a.Id == activiteitId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout("Deze activiteit bestaat niet meer. Iemand anders heeft ze verwijderd.");
        }
    }

    private static void VereisEigen(Wizardrun run, Wizarditemsoort soort, Guid itemId)
    {
        if (!run.HeeftAangemaakt(soort, itemId))
        {
            throw new WizardrunWeigering(NietInDezeWizard);
        }
    }

    private static WizardrunWeergave Map(Wizardrun run, DateTimeOffset nu) => new(
        run.Id,
        run.ThemaId,
        run.GestartDoorId,
        run.GestartOp,
        run.LaatsteSchrijfactieOp,
        run.SluitUiterlijkOp,
        run.AfgerondOp,
        run.GeslotenOp,
        run.IsOpen(nu),
        run.Aangemaakt.Select(i => new WizardrunitemWeergave(i.Soort, i.ItemId)).ToList());
}
