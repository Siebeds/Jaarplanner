using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Application.Schoolcontent.Wizard;
using Jaarplanner.Application.Toegang;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.SchoolcontentBeheer;

/// <summary>
/// EF Core implementation of <see cref="IWizardrunService"/> (E6-02, ADR-0030 R32, I22–I25, I27).
/// <para>
/// <b>Order of the questions, the same in every action.</b> The run exists (404), the run is open (403), the addressed
/// subthema, subdoel or activiteit exists (404), it is the run's to touch (403), it is still under the run's thema
/// (403), and the action would not carry off someone else's work, nor remove a goal link or carry one to another
/// leeftijd without the caller's goal-link right there (403, I27). An id that names nothing therefore always
/// says so, and a refusal is only ever about something real.
/// </para>
/// <para>
/// <b>The one rights question inside a run</b> is I27's, with the owner's Q4 ruling: may this caller remove a goal link
/// at this leeftijd, or carry one to another? It is asked through <see cref="Rechtenmatrix.StaatToe"/> on the caller's
/// rights, the matrix's one evaluator, inside the transaction and just before the write. That reads the rows as they are
/// committed at that moment. It does not lock them (READ COMMITTED), so a link another request adds between the check
/// and the write is not seen: the same narrow window the filter-side checks accept, the thema delete's (I26) included.
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
    // The wizard's own sentences (Art. II.3: a teacher can act on them, so Dutch, composed here). WizardrunEndpointsTests
    // asserts each one in full, with no em dash. Each says only what its own refusal guarantees (the E5-03 rule).
    private const string RunNietGevonden = "Deze wizard is niet gevonden.";
    private const string RunAfgelopen = "Deze wizard is afgelopen.";
    private const string NietVanDitThema = "Dit subthema hoort niet bij het thema van deze wizard.";
    private const string ActiviteitNietMeerVanDitThema = "Deze activiteit staat niet meer onder het thema van deze wizard.";
    private const string NietInDezeWizard = "Dit is niet in deze wizard aangemaakt.";

    private const string AndermansInhoudVerdwijnt =
        "Onder dit subthema staan subdoelen of activiteiten die niet in deze wizard aangemaakt zijn. "
        + "Die zouden mee verdwijnen, dus de wizard verwijdert het niet.";

    private const string AndermansInhoudVerhuist =
        "Onder dit subthema staan subdoelen of activiteiten die niet in deze wizard aangemaakt zijn. "
        + "Die zouden mee van leeftijd veranderen, dus de wizard verandert de leeftijd niet.";

    private const string GekoppeldVerhuist =
        "Aan activiteiten onder dit subthema zijn doelen gekoppeld. Die mag je niet naar een andere leeftijd meenemen, "
        + "dus de wizard verandert de leeftijd niet.";

    private const string ActiviteitMetDoelen =
        "Aan deze activiteit zijn doelen gekoppeld. Je mag op deze leeftijd geen doelen ontkoppelen, "
        + "dus de wizard verwijdert deze activiteit niet.";

    private const string SubthemaMetDoelen =
        "Aan activiteiten onder dit subthema zijn doelen gekoppeld. Je mag op deze leeftijd geen doelen ontkoppelen, "
        + "dus de wizard verwijdert het niet.";

    // The ordinary routes' sentences for the same facts, so a screen reads one wording whichever route it used.
    private const string SubthemaNietGevonden = "Dit subthema bestaat niet meer. Iemand anders heeft het verwijderd.";
    private const string ActiviteitNietGevonden = "Deze activiteit bestaat niet meer. Iemand anders heeft ze verwijderd.";
    private const string SubdoelNietGevonden = "Dit subdoel is er niet meer. Vernieuw de pagina om te zien wat er nu staat.";

    private readonly AppDbContext _context;
    private readonly ISchoolcontentBeheerService _beheer;
    private readonly IRechtenService _rechten;
    private readonly TimeProvider _tijd;

    public WizardrunService(AppDbContext context, ISchoolcontentBeheerService beheer, IRechtenService rechten, TimeProvider tijd)
    {
        _context = context;
        _beheer = beheer;
        _rechten = rechten;
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
        Guid runId, Guid subthemaId, SubthemaWijzigingInvoer wijziging, Guid? gebruikerId, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(wijziging);
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        var huidig = await LaadSubthemaAsync(subthemaId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Subthema, subthemaId);

        // I27: a new leeftijd moves everything under the subthema with it (Subthema.WijzigScope). An invalid leeftijd is
        // not a change: the write refuses it with its own 400 (and the controller already did).
        if (Jaarfasen.LeesLeeftijd(wijziging.Leeftijd) is { } nieuw
            && !string.Equals(nieuw, huidig.Leeftijd, StringComparison.Ordinal))
        {
            // Someone else's subdoelen or activiteiten under it: never through the wizard.
            if (HeeftAndermansInhoud(run, await OnderliggendAsync(subthemaId, cancellationToken)))
            {
                throw new WizardrunWeigering(AndermansInhoudVerhuist);
            }

            // Q4 (a), owner 2026-09-14: a goal link protects an activiteit the run created, too. The re-scope carries the
            // link out of this leeftijd's dekking and into the new one's, so the goal-link right is needed "at both the old
            // and the new leeftijd" (I27 as ratified on the owner's Q5 answer; R19), as I13 asks the subthema right at both.
            if (await _context.Activiteiten.AnyAsync(a => a.SubthemaId == subthemaId && a.Doelkoppelingen.Any(), cancellationToken)
                && !(await MagDoelenKoppelenAsync(gebruikerId, huidig.Leeftijd, cancellationToken)
                     && await MagDoelenKoppelenAsync(gebruikerId, nieuw, cancellationToken)))
            {
                throw new WizardrunWeigering(GekoppeldVerhuist);
            }
        }

        var subthema = await _beheer.WijzigSubthemaAsync(subthemaId, wijziging, cancellationToken);
        run.RegistreerWijziging(nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
        return subthema;
    }

    public async Task VerwijderSubthemaAsync(Guid runId, Guid subthemaId, Guid? gebruikerId, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Subthema, subthemaId);

        // The delete takes the subthema's subdoelen and activiteiten along (SubthemaConfiguration). I25 lets the wizard
        // delete what its run created "and nothing else", so one that someone else put under it, on the ordinary routes,
        // stops the delete. Directie or a hoofdleerkracht of that leeftijd can still delete it there.
        var onder = await OnderliggendAsync(subthemaId, cancellationToken);
        if (HeeftAndermansInhoud(run, onder))
        {
            throw new WizardrunWeigering(AndermansInhoudVerdwijnt);
        }

        // I27: an activiteit the run created may carry a goal link someone linked since (R19). Deleting it removes that
        // link, which takes the goal-link right at that leeftijd, exactly as creating one does.
        if (await _context.Activiteiten.AnyAsync(a => a.SubthemaId == subthemaId && a.Doelkoppelingen.Any(), cancellationToken)
            && !await MagDoelenKoppelenAsync(gebruikerId, subthema.Leeftijd, cancellationToken))
        {
            throw new WizardrunWeigering(SubthemaMetDoelen);
        }

        await _beheer.VerwijderSubthemaAsync(subthemaId, cancellationToken);
        run.RegistreerVerwijdering([subthemaId, .. onder.SubdoelIds, .. onder.ActiviteitIds], nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
    }

    public async Task<SubdoelWeergave> MaakSubdoelAsync(
        Guid runId, Guid subthemaId, string leerplandoelCode, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        VereisThemaVanRun(run, subthema.ThemaId, NietVanDitThema);

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
            throw new SchoolcontentNietGevondenFout(SubdoelNietGevonden);
        }

        // A subdoel cannot leave its subthema, nor a subthema its thema, so "still under the run's thema" holds for a
        // subdoel the run created.
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
        var subthema = await LaadSubthemaAsync(subthemaId, cancellationToken);
        VereisThemaVanRun(run, subthema.ThemaId, NietVanDitThema);

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
        var plek = await LaadActiviteitplekAsync(activiteitId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Activiteit, activiteitId);
        VereisThemaVanRun(run, plek.ThemaId, ActiviteitNietMeerVanDitThema);

        var activiteit = await _beheer.WijzigActiviteitAsync(activiteitId, wijziging, cancellationToken);
        run.RegistreerWijziging(nu);

        await _context.SaveChangesAsync(cancellationToken);
        await transactie.CommitAsync(cancellationToken);
        return activiteit;
    }

    public async Task VerwijderActiviteitAsync(Guid runId, Guid activiteitId, Guid? gebruikerId, CancellationToken cancellationToken = default)
    {
        var nu = _tijd.GetUtcNow();

        await using var transactie = await _context.Database.BeginTransactionAsync(cancellationToken);
        var run = await LaadOpenRunAsync(runId, nu, cancellationToken);
        var plek = await LaadActiviteitplekAsync(activiteitId, cancellationToken);
        VereisEigen(run, Wizarditemsoort.Activiteit, activiteitId);
        VereisThemaVanRun(run, plek.ThemaId, ActiviteitNietMeerVanDitThema);

        // I27: a goal someone linked since goes with the delete, which takes the goal-link right at that leeftijd (R19).
        if (plek.HeeftDoelkoppelingen && !await MagDoelenKoppelenAsync(gebruikerId, plek.Leeftijd, cancellationToken))
        {
            throw new WizardrunWeigering(ActiviteitMetDoelen);
        }

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

    private async Task<Subthemaplek> LaadSubthemaAsync(Guid subthemaId, CancellationToken cancellationToken) =>
        await _context.Subthemas
            .Where(s => s.Id == subthemaId)
            .Select(s => new Subthemaplek(s.ThemaId, s.Leeftijd))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout(SubthemaNietGevonden);

    /// <summary>Where an activiteit is now: its subthema's thema and leeftijd, and whether a goal is linked to it.</summary>
    private async Task<Activiteitplek> LaadActiviteitplekAsync(Guid activiteitId, CancellationToken cancellationToken) =>
        await (
                from activiteit in _context.Activiteiten
                where activiteit.Id == activiteitId
                join subthema in _context.Subthemas on activiteit.SubthemaId equals subthema.Id
                select new Activiteitplek(subthema.ThemaId, subthema.Leeftijd, activiteit.Doelkoppelingen.Any()))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new SchoolcontentNietGevondenFout(ActiviteitNietGevonden);

    private async Task<Onderliggend> OnderliggendAsync(Guid subthemaId, CancellationToken cancellationToken) =>
        new(
            await _context.Subdoelen.Where(sd => sd.SubthemaId == subthemaId).Select(sd => sd.Id).ToListAsync(cancellationToken),
            await _context.Activiteiten.Where(a => a.SubthemaId == subthemaId).Select(a => a.Id).ToListAsync(cancellationToken));

    private static bool HeeftAndermansInhoud(Wizardrun run, Onderliggend onder) =>
        onder.SubdoelIds.Any(id => !run.HeeftAangemaakt(Wizarditemsoort.Subdoel, id))
        || onder.ActiviteitIds.Any(id => !run.HeeftAangemaakt(Wizarditemsoort.Activiteit, id));

    private static void VereisThemaVanRun(Wizardrun run, Guid themaId, string weigering)
    {
        if (themaId != run.ThemaId)
        {
            throw new WizardrunWeigering(weigering);
        }
    }

    private static void VereisEigen(Wizardrun run, Wizarditemsoort soort, Guid itemId)
    {
        if (!run.HeeftAangemaakt(soort, itemId))
        {
            throw new WizardrunWeigering(NietInDezeWizard);
        }
    }

    /// <summary>Whether the caller holds R19's goal-link right at <paramref name="leeftijd"/>: directie or its hoofdleerkracht.</summary>
    private async Task<bool> MagDoelenKoppelenAsync(Guid? gebruikerId, string leeftijd, CancellationToken cancellationToken)
    {
        var rechten = gebruikerId is { } id
            ? await _rechten.HaalRechtenOpAsync(id, cancellationToken)
            : Rechten.Geen(Guid.Empty);

        return Rechtenmatrix.StaatToe(rechten, Rechtenmatrix.DoelenKoppelen, new Leeftijdsinhoud(leeftijd));
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

    private sealed record Subthemaplek(Guid ThemaId, string Leeftijd);

    private sealed record Activiteitplek(Guid ThemaId, string Leeftijd, bool HeeftDoelkoppelingen);

    private sealed record Onderliggend(List<Guid> SubdoelIds, List<Guid> ActiviteitIds);
}
