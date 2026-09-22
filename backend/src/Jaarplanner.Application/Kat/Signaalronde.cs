using Jaarplanner.Domain.Kat;

namespace Jaarplanner.Application.Kat;

/// <summary>
/// What one tick of the cat does (TB-057, ADR-0059 D1 to D3): for every klas it watches, it runs the detectors, which
/// use no AI, compares what they found with what is stored, writes what is new, removes what lost its reason, and
/// lets a <see cref="IKattaak"/> act on what was noticed for the first time.
/// <para>
/// <b>It is idempotent.</b> A round over an unchanged state finds the same sleutels, so it writes nothing and starts
/// no task. That is what makes a second tick, or a retry, harmless.
/// </para>
/// <para>
/// <b>It acts for no one</b> (D3). It never asks "may the caller see this": it decides per klas who is addressed, from
/// the klas's own leerkrachten, and a detector may only narrow that list. Nothing here runs on behalf of a signed-in
/// gebruiker, so nothing here may widen what someone sees.
/// </para>
/// <para>
/// <b>It does not log.</b> This layer takes no dependency outside the domain, so what went wrong comes back in
/// <see cref="Rondeverslag"/> and the background job writes it to the log.
/// </para>
/// </summary>
public sealed class Signaalronde
{
    private readonly IKatklassenlezer _klassen;
    private readonly ISignaalopslag _opslag;
    private readonly IReadOnlyList<ISignaaldetector> _detectoren;
    private readonly IReadOnlyList<IKattaak> _taken;
    private readonly Katdekkingbron _dekking;
    private readonly TimeProvider _tijd;

    public Signaalronde(
        IKatklassenlezer klassen,
        ISignaalopslag opslag,
        IEnumerable<ISignaaldetector> detectoren,
        IEnumerable<IKattaak> taken,
        Katdekkingbron dekking,
        TimeProvider tijd)
    {
        ArgumentNullException.ThrowIfNull(detectoren);
        ArgumentNullException.ThrowIfNull(taken);

        _klassen = klassen;
        _opslag = opslag;
        _detectoren = detectoren.ToList();
        _taken = taken.ToList();
        _dekking = dekking;
        _tijd = tijd;
    }

    /// <summary>Runs one round over every watched klas and reports what it changed and what went wrong.</summary>
    public async Task<Rondeverslag> VoerUitAsync(DateOnly vandaag, CancellationToken ct)
    {
        var klassen = await _klassen.HaalKlassenAsync(ct);
        var verslag = new Rondeverslag { Klassen = klassen.Count };

        foreach (var klas in klassen)
        {
            ct.ThrowIfCancellationRequested();
            try
            {
                await VerwerkKlasAsync(klas, vandaag, verslag, ct);
            }
            catch (Exception fout) when (fout is not OperationCanceledException)
            {
                // One klas whose data trips a detector must not cost every other klas its round.
                verslag.Mislukkingen.Add(new Rondemislukking(klas.KlasId, fout));
            }
        }

        return verslag;
    }

    /// <summary>
    /// What the detectors notice about one klas right now. The deurmat uses it too, so a stored signal is shown only
    /// while its reason still holds (D2).
    /// </summary>
    public async Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katklas klas, DateOnly vandaag, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(klas);

        var context = new Katcontext(klas.KlasId, klas.Leeftijden, klas.LeerkrachtIds, vandaag, c => _dekking(klas.KlasId, c));
        var vondsten = new List<Signaalvondst>();

        foreach (var detector in _detectoren)
        {
            ct.ThrowIfCancellationRequested();
            foreach (var vondst in await detector.DetecteerAsync(context, ct))
            {
                // A detector narrows the recipients; it never widens them (D5). An id the klas does not address is
                // dropped here rather than stored, because a stored row is what the deurmat trusts.
                var ontvangers = vondst.OntvangerIds.Where(klas.LeerkrachtIds.Contains).Distinct().ToList();
                if (ontvangers.Count > 0)
                {
                    vondsten.Add(vondst with { KlasId = klas.KlasId, OntvangerIds = ontvangers });
                }
            }
        }

        return vondsten;
    }

    private async Task VerwerkKlasAsync(Katklas klas, DateOnly vandaag, Rondeverslag verslag, CancellationToken ct)
    {
        var vondsten = await DetecteerAsync(klas, vandaag, ct);
        var opgeslagen = await _opslag.HaalVoorKlasAsync(klas.KlasId, ct);

        var gevonden = vondsten
            .SelectMany(v => v.OntvangerIds.Select(o => (v.Soort, v.Sleutel, Ontvanger: o)))
            .ToHashSet();
        var bestaandeKenmerken = opgeslagen.Select(s => (s.Soort, s.Sleutel)).ToHashSet();
        var bestaandeRijen = opgeslagen.Select(s => (s.Soort, s.Sleutel, s.OntvangerId)).ToHashSet();

        var nieuw = gevonden
            .Where(g => !bestaandeRijen.Contains((g.Soort, g.Sleutel, g.Ontvanger)))
            .Select(g => new Signaal(g.Soort, klas.KlasId, g.Ontvanger, g.Sleutel, _tijd.GetUtcNow()))
            .ToList();
        var verdwenen = opgeslagen
            .Where(s => !gevonden.Contains((s.Soort, s.Sleutel, s.OntvangerId)))
            .ToList();

        if (nieuw.Count > 0 || verdwenen.Count > 0)
        {
            await _opslag.BewaarAsync(nieuw, verdwenen, ct);
            verslag.Nieuw += nieuw.Count;
            verslag.Verdwenen += verdwenen.Count;
        }

        // A task runs for a finding nobody had a signal for yet, so the AI is called once per thing noticed and not
        // again when a second leerkracht joins the klas.
        foreach (var vondst in vondsten.Where(v => !bestaandeKenmerken.Contains((v.Soort, v.Sleutel))))
        {
            await StartTakenAsync(vondst, verslag, ct);
        }
    }

    private async Task StartTakenAsync(Signaalvondst vondst, Rondeverslag verslag, CancellationToken ct)
    {
        foreach (var taak in _taken.Where(t => t.Soort == vondst.Soort))
        {
            try
            {
                await taak.VoerUitAsync(vondst, ct);
                verslag.Taken++;
            }
            catch (Exception fout) when (fout is not OperationCanceledException)
            {
                // The signal stands whatever the task did: the teacher is told what the tool noticed even when the
                // content the cat wanted to bring with it could not be made.
                verslag.Taakfouten.Add(new Rondemislukking(vondst.KlasId, fout));
            }
        }
    }
}

/// <summary>A klas, or a task on one, whose round threw. The job logs it; the round carries it.</summary>
public sealed record Rondemislukking(Guid KlasId, Exception Fout);

/// <summary>What one round did, for the log and for the tests.</summary>
public sealed class Rondeverslag
{
    /// <summary>Klassen the round covered.</summary>
    public int Klassen { get; init; }

    /// <summary>Signals written.</summary>
    public int Nieuw { get; set; }

    /// <summary>Signals removed because their reason was gone.</summary>
    public int Verdwenen { get; set; }

    /// <summary>Tasks that ran on a finding noticed for the first time.</summary>
    public int Taken { get; set; }

    /// <summary>Klassen whose round threw and was skipped.</summary>
    public IList<Rondemislukking> Mislukkingen { get; } = [];

    /// <summary>Tasks that threw. Their signal stands.</summary>
    public IList<Rondemislukking> Taakfouten { get; } = [];
}
