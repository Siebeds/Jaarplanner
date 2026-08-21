using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Planning.Weekplanning;

/// <summary>
/// Day-level planning inside a jaarplan (E9-03, FR-6.2/FR-7.2). See <see cref="IWeekplanningService"/> for why this is
/// a service of its own rather than four more methods on the generation service.
/// <para>
/// <b>Every mutation returns the surrounding week rather than the placement it changed.</b> Same choice the thema
/// endpoints make, and for the same reason: a client that has to re-fetch after every drag renders a stale board for
/// one round trip. The window returned is the ISO week containing the affected day, which is the unit the screen draws.
/// </para>
/// </summary>
public sealed class WeekplanningService : IWeekplanningService
{
    private readonly IWeekplanningOpslag _opslag;
    private readonly IPlanningsblokIndeling _indeling;

    public WeekplanningService(IWeekplanningOpslag opslag, IPlanningsblokIndeling indeling)
    {
        _opslag = opslag ?? throw new ArgumentNullException(nameof(opslag));
        _indeling = indeling ?? throw new ArgumentNullException(nameof(indeling));
    }

    public async Task<Weekplanningweergave> HaalWeekplanningAsync(
        Guid klasId,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);

        return await ProjecteerAsync(klas, schooljaar, jaarplan, van, tot, cancellationToken);
    }

    public async Task<Weekplanningweergave> PlanActiviteitAsync(
        Guid klasId,
        Guid activiteitId,
        DateOnly datum,
        int volgorde,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);

        var inhoud = await _opslag.LaadActiviteitinhoudAsync(activiteitId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Activiteit {activiteitId} is niet gevonden.");

        // Checked before the day, deliberately. A teacher aiming another class's activiteit at a closed day is told
        // the thing they can act on: the activiteit is the wrong one whatever day they pick, while the day is only
        // wrong for this one attempt. Same ordering logic as the four guards in `VoegPlaatsingToeAsync`.
        //
        // The comparison itself is the aggregate's invariant too (`Jaarplan.PlaatsActiviteit` refuses it), and it is
        // checked here as well rather than relying on that: the aggregate throws a bare ArgumentException, and letting
        // it through would hand the teacher whichever sentence the domain happened to carry instead of this feature's
        // own. The domain guard stays as the backstop for a caller that skips this service.
        if (inhoud.KlasId != klas.Id)
        {
            throw OngeldigeDagplanningFout.ActiviteitHoortBijAndereKlas();
        }

        VereisLesdag(schooljaar, datum);

        var jaarplan = await LaadOfMaakJaarplanAsync(klasId, cancellationToken);

        // Checked here rather than letting the aggregate's own guard fire, which throws an English
        // InvalidOperationException that no handler maps — it would reach a teacher as a 500. Same division of labour
        // as the thema path: the aggregate refuses programmer error, the service refuses teacher input.
        if (jaarplan.IsAlGeplaatstOp(activiteitId, datum))
        {
            throw OngeldigeDagplanningFout.ActiviteitStaatErAl(datum);
        }

        jaarplan.PlaatsActiviteit(activiteitId, inhoud.KlasId, datum, KoppelingStatus.Manueel, volgorde);
        await _opslag.BewaarAsync(cancellationToken);

        return await ProjecteerWeekAsync(klas, schooljaar, jaarplan, datum, cancellationToken);
    }

    public async Task<Weekplanningweergave> VerplaatsActiviteitAsync(
        Guid klasId,
        Guid plaatsingId,
        DateOnly datum,
        int volgorde,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var (jaarplan, plaatsing) = await LaadPlaatsingAsync(klasId, plaatsingId, cancellationToken);

        // Only the target is validated. The placement's current day is deliberately not, which is what makes this the
        // route off a day the school has since closed (see IWeekplanningService).
        VereisLesdag(schooljaar, datum);

        // A no-op move is allowed through: the placement is already there, so `IsAlGeplaatstOp` would be true and
        // refusing would make dropping a card back where it came from an error. Only a *different* placement on the
        // target day is a genuine duplicate.
        if (plaatsing.Datum != datum && jaarplan.IsAlGeplaatstOp(plaatsing.ActiviteitId, datum))
        {
            throw OngeldigeDagplanningFout.ActiviteitStaatErAl(datum);
        }

        plaatsing.VerplaatsNaar(datum, volgorde);
        await _opslag.BewaarAsync(cancellationToken);

        return await ProjecteerWeekAsync(klas, schooljaar, jaarplan, datum, cancellationToken);
    }

    public async Task<Weekplanningweergave> VerwijderActiviteitplaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken = default)
    {
        var (klas, schooljaar) = await LaadKlasAsync(klasId, cancellationToken);
        var (jaarplan, plaatsing) = await LaadPlaatsingAsync(klasId, plaatsingId, cancellationToken);

        // Captured before the removal: the response is the week the placement *was* in, and after `Verwijder` the
        // placement no longer has a day to ask for.
        var dag = plaatsing.Datum;

        jaarplan.VerwijderActiviteitplaatsing(plaatsing);
        await _opslag.BewaarAsync(cancellationToken);

        return await ProjecteerWeekAsync(klas, schooljaar, jaarplan, dag, cancellationToken);
    }

    /// <summary>
    /// Refuses a day the school is not open on, telling the two cases apart because the teacher acts differently on
    /// each: a closure has a name and a remedy ("pick another day"), while a date outside the year means they are
    /// looking at the wrong school year.
    /// </summary>
    private static void VereisLesdag(Schooljaar schooljaar, DateOnly datum)
    {
        if (datum < schooljaar.Start || datum > schooljaar.Eind)
        {
            throw OngeldigeDagplanningFout.DagValtBuitenSchooljaar(datum, schooljaar.Naam);
        }

        var sluiting = schooljaar.Sluitingen.FirstOrDefault(s => s.Bevat(datum));
        if (sluiting is not null)
        {
            throw OngeldigeDagplanningFout.DagIsGesloten(datum, sluiting.Naam);
        }
    }

    /// <summary>
    /// The ISO week (Monday–Sunday) containing <paramref name="dag"/>, clamped to the school year.
    /// <para>
    /// <b>Monday is the week start, and this is the one place that decides it</b> — a Flemish school week starts on
    /// Monday, and the client's grid does too (E9-05). Hard-coded here rather than configured, because unlike the
    /// planningsblok grain nobody has asked for it to vary; if that ever changes it changes in one method.
    /// </para>
    /// </summary>
    private static (DateOnly Van, DateOnly Tot) Week(Schooljaar schooljaar, DateOnly dag)
    {
        // DayOfWeek is Sunday=0, so Monday=1; ((int)dow + 6) % 7 maps Monday→0 … Sunday→6.
        var naMaandag = ((int)dag.DayOfWeek + 6) % 7;
        var maandag = dag.AddDays(-naMaandag);

        return (Klem(schooljaar, maandag), Klem(schooljaar, maandag.AddDays(6)));
    }

    private static DateOnly Klem(Schooljaar schooljaar, DateOnly datum) =>
        datum < schooljaar.Start ? schooljaar.Start : datum > schooljaar.Eind ? schooljaar.Eind : datum;

    private Task<Weekplanningweergave> ProjecteerWeekAsync(
        Klas klas,
        Schooljaar schooljaar,
        Jaarplan jaarplan,
        DateOnly dag,
        CancellationToken cancellationToken)
    {
        var (van, tot) = Week(schooljaar, dag);

        return ProjecteerAsync(klas, schooljaar, jaarplan, van, tot, cancellationToken);
    }

    /// <summary>
    /// Builds the read model for one day range.
    /// <para>
    /// <b>Every day in the range is emitted, closed ones included</b> — a week view that silently dropped
    /// Herfstvakantie would show a short week with no explanation and no way to tell it from a bug.
    /// </para>
    /// </summary>
    private async Task<Weekplanningweergave> ProjecteerAsync(
        Klas klas,
        Schooljaar schooljaar,
        Jaarplan? jaarplan,
        DateOnly van,
        DateOnly tot,
        CancellationToken cancellationToken)
    {
        // Clamped rather than refused: the week containing 1 September legitimately reaches back past the year's
        // start, and refusing it would make the first and last week of every year unrenderable.
        van = Klem(schooljaar, van);
        tot = Klem(schooljaar, tot);
        if (tot < van)
        {
            (van, tot) = (tot, van);
        }

        var plaatsingen = jaarplan is null
            ? []
            : jaarplan.Activiteitplaatsingen.Where(p => p.Datum >= van && p.Datum <= tot).ToList();

        // One query for the whole range rather than one per placement.
        var inhoudPerActiviteit = (await _opslag.LaadActiviteitinhoudAsync(
                plaatsingen.Select(p => p.ActiviteitId).Distinct().ToList(),
                cancellationToken))
            .ToDictionary(i => i.ActiviteitId);

        // The themaperiodes, so a scheduled activiteit can be reported as sitting outside its thema's period. Derived
        // at the tier a thema placement keys on — the same constant the generation service uses — because a thema is
        // placed on the themaperiode tier and nothing here may assume a second one.
        var themaperiodePerThema = ThemaperiodePerThema(schooljaar, jaarplan);

        var dagen = new List<Dagweergave>();
        for (var datum = van; datum <= tot; datum = datum.AddDays(1))
        {
            var sluiting = schooljaar.Sluitingen.FirstOrDefault(s => s.Bevat(datum));

            var opDezeDag = plaatsingen
                .Where(p => p.Datum == datum)
                .OrderBy(p => p.Volgorde)
                .ThenBy(p => p.ActiviteitId)
                .Select(p => Projecteer(p, inhoudPerActiviteit, themaperiodePerThema))
                // A placement whose activiteit could not be resolved is dropped rather than rendered blank. It is
                // unreachable while the FK is Restrict (the activiteit cannot be deleted out from under it), so this
                // is hardening; a nameless card on a day would be worse than an absent one.
                .Where(a => a is not null)
                .Select(a => a!)
                .ToList();

            dagen.Add(new Dagweergave(
                Datum: datum,
                IsLesdag: schooljaar.IsLesdag(datum),
                Sluitingsnaam: sluiting?.Naam,
                Activiteiten: opDezeDag));
        }

        return new Weekplanningweergave(
            KlasId: klas.Id,
            KlasNaam: klas.Naam,
            SchooljaarId: schooljaar.Id,
            SchooljaarNaam: schooljaar.Naam,
            Van: van,
            Tot: tot,
            Dagen: dagen);
    }

    /// <summary>
    /// Where each placed thema sits, as a (start, eind) pair per thema — the basis for
    /// <see cref="GeplandeActiviteitWeergave.ValtBuitenThemaperiode"/>.
    /// <para>
    /// <b>Rejected and stale placements are excluded, and the two exclusions have different reasons.</b> A
    /// <c>Geweigerd</c> placement teaches nothing in its period (<c>Themaplaatsing.IsGepland</c>), so measuring an
    /// activiteit against it would report a mismatch with a period the thema is not in — and the groepschat record of
    /// 2026-08-19 is explicit that folding a rejected placement in with the others is a copy defect that reached a
    /// teacher once already (E5-05 MAJOR-1). A <b>stale</b> one points at a date that is no longer any period's start,
    /// so there is no period to compare against at all.
    /// </para>
    /// <para>
    /// A thema placed in several periods keeps the <b>widest</b> span, so an activiteit inside any of them is not
    /// reported as outside. Reporting it against only the first would flag correct scheduling as a mismatch.
    /// </para>
    /// </summary>
    private Dictionary<Guid, (DateOnly Start, DateOnly Eind)> ThemaperiodePerThema(
        Schooljaar schooljaar,
        Jaarplan? jaarplan)
    {
        var perThema = new Dictionary<Guid, (DateOnly Start, DateOnly Eind)>();
        if (jaarplan is null)
        {
            return perThema;
        }

        var blokken = _indeling.Blokken(schooljaar, GeneratieNiveau)
            .ToDictionary(b => b.Start);

        foreach (var plaatsing in jaarplan.Plaatsingen.Where(p => p.IsGepland))
        {
            // Not a block boundary any more: the placement is stale and has no period to measure against.
            if (!blokken.TryGetValue(plaatsing.BlokStart, out var blok))
            {
                continue;
            }

            perThema[plaatsing.ThemaId] = perThema.TryGetValue(plaatsing.ThemaId, out var bestaand)
                ? (bestaand.Start < blok.Start ? bestaand.Start : blok.Start,
                    bestaand.Eind > blok.Eind ? bestaand.Eind : blok.Eind)
                : (blok.Start, blok.Eind);
        }

        return perThema;
    }

    private static GeplandeActiviteitWeergave? Projecteer(
        Activiteitplaatsing plaatsing,
        IReadOnlyDictionary<Guid, Activiteitinhoud> inhoudPerActiviteit,
        IReadOnlyDictionary<Guid, (DateOnly Start, DateOnly Eind)> themaperiodePerThema)
    {
        if (!inhoudPerActiviteit.TryGetValue(plaatsing.ActiviteitId, out var inhoud))
        {
            return null;
        }

        // False rather than "unknown" when the thema is not placed: there is then no period for the day to fall
        // outside of, and a screen must not report a mismatch against nothing.
        var buiten = themaperiodePerThema.TryGetValue(inhoud.ThemaId, out var periode)
            && (plaatsing.Datum < periode.Start || plaatsing.Datum > periode.Eind);

        return new GeplandeActiviteitWeergave(
            PlaatsingId: plaatsing.Id,
            ActiviteitId: inhoud.ActiviteitId,
            ActiviteitNaam: inhoud.Naam,
            ActiviteitType: inhoud.ActiviteitType,
            SubthemaId: inhoud.SubthemaId,
            SubthemaNaam: inhoud.SubthemaNaam,
            ThemaId: inhoud.ThemaId,
            ThemaNaam: inhoud.ThemaNaam,
            Volgorde: plaatsing.Volgorde,
            Status: plaatsing.Status.ToString(),
            Doelcodes: inhoud.Doelcodes,
            ValtBuitenThemaperiode: buiten);
    }

    private async Task<(Klas Klas, Schooljaar Schooljaar)> LaadKlasAsync(
        Guid klasId,
        CancellationToken cancellationToken) =>
        await _opslag.LaadKlasMetSchooljaarAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} is niet gevonden.");

    private async Task<Jaarplan> LaadOfMaakJaarplanAsync(Guid klasId, CancellationToken cancellationToken)
    {
        var bestaand = await _opslag.LaadJaarplanAsync(klasId, cancellationToken);
        if (bestaand is not null)
        {
            return bestaand;
        }

        // A teacher may plan a day before any thema has been placed — nothing requires a generated plan to exist
        // first, and refusing would make the week view unusable on a fresh class.
        var nieuw = new Jaarplan(klasId);
        _opslag.VoegJaarplanToe(nieuw);

        return nieuw;
    }

    private async Task<(Jaarplan Jaarplan, Activiteitplaatsing Plaatsing)> LaadPlaatsingAsync(
        Guid klasId,
        Guid plaatsingId,
        CancellationToken cancellationToken)
    {
        var jaarplan = await _opslag.LaadJaarplanAsync(klasId, cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout($"Klas {klasId} heeft nog geen jaarplan.");

        var plaatsing = jaarplan.VindActiviteitplaatsing(plaatsingId)
            ?? throw new SchoolcontentNietGevondenFout(
                $"Activiteitplaatsing {plaatsingId} bestaat niet in het jaarplan van klas {klasId}.");

        return (jaarplan, plaatsing);
    }

    /// <summary>
    /// The tier a thema placement keys on, and therefore the tier
    /// <see cref="GeplandeActiviteitWeergave.ValtBuitenThemaperiode"/> is measured against.
    /// <para>
    /// Deliberately the same constant the generation service uses (<c>GENERATIEBLOKNIVEAU</c> on the client,
    /// <c>JaarplanGeneratieService.GeneratieNiveau</c> on the server) rather than a second opinion about which tier a
    /// thema lives on. If the two ever disagreed, an activiteit would be reported as outside a period the board draws
    /// it inside.
    /// </para>
    /// </summary>
    private const Planningsblokniveau GeneratieNiveau = Planningsblokniveau.Themaperiode;
}
