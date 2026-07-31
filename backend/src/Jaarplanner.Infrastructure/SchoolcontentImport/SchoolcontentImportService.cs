using Jaarplanner.Application.Schoolcontent.Import;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Jaarplanner.Infrastructure.SchoolcontentImport;

/// <summary>
/// EF Core implementation of <see cref="ISchoolcontentImportService"/> over <see cref="AppDbContext"/>:
/// it persists a parsed school-content Excel into the level-scoped themalaag (Art. IX.2) and guarantees a
/// non-destructive re-import (FR-1.3/1.4, Art. IV.2). Mirrors the proven Op.stap re-import pattern
/// (preview/diff + commit, explicit modes).
/// <para>
/// <b>Match keys (stable identity within scope).</b> School content has no Op.stap-style code, so identity
/// is by name within scope: a <see cref="Thema"/> by <c>naam</c> (school-wide); a <see cref="Subthema"/> by
/// <c>(themaId, naam, klasId, leeftijd)</c>; an <see cref="Activiteit"/> by <c>(subthemaId, naam)</c>. Names
/// are compared case-insensitively after trimming. Level scoping is honoured: subthema's resolve their klas
/// by name and are inserted with the required <c>klasId</c> + <c>leeftijd</c> (Art. IX.2).
/// </para>
/// <para>
/// <b>Preview == commit.</b> Both <c>toepassen:false</c> and <c>toepassen:true</c> run the very same
/// <see cref="VerwerkAsync"/> over the same loaded state and the same plan; the only difference is whether
/// the EF changes are saved. So the committed result is guaranteed to match the preview for the same input
/// and options.
/// </para>
/// <para>
/// <b>Headline (Art. IV.2).</b> In <see cref="SchoolcontentImportModus.Bijwerken"/> mode, when content is
/// overwritten, teacher-set goal links (<c>aanvaard</c>/<c>geweigerd</c>/<c>manueel</c>) are <b>preserved</b>.
/// A teacher link the new file no longer carries is reported as a <see cref="BedreigdeBeslissing"/> and kept;
/// it is discarded only with the explicit <see cref="SchoolcontentImportOpties.MenselijkeBeslissingenVerwijderen"/>
/// opt-in. AI-only <c>voorgesteld</c> links carry no human decision and are reconciled freely.
/// </para>
/// </summary>
public sealed class SchoolcontentImportService : ISchoolcontentImportService
{
    private static readonly StringComparer KeyComparer = StringComparer.OrdinalIgnoreCase;

    private readonly AppDbContext _context;

    public SchoolcontentImportService(AppDbContext context) => _context = context;

    /// <inheritdoc />
    public async Task<SchoolcontentImportResultaat> ImporteerAsync(
        SchoolcontentParseResult parseResultaat,
        SchoolcontentImportOpties opties,
        bool toepassen,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(parseResultaat);

        // Empty/implausible-file guard (Art. III.4 stance, mirrors E1-05): no valid rows means nothing
        // to import — never read absence of input as a change. Skip with a notice.
        if (parseResultaat.Rijen.Count == 0)
        {
            var notice = new SchoolcontentImportDiff(
                opties.Modus,
                themas: [],
                subthemas: [],
                activiteiten: [],
                bedreigdeBeslissingen: [],
                overgeslagen: true,
                // Rewritten without an em dash (Art. II.5) now that E1-13 puts this notice on a screen. The
                // sentence was split rather than having the character deleted, which the rule requires.
                opmerkingen: [
                    "Er zijn geen bruikbare rijen ingelezen, dus er is niets geïmporteerd. " +
                    "Het bestand is misschien leeg of onvolledig, of het is niet het juiste bestand."
                ]);
            return new SchoolcontentImportResultaat(notice, toegepast: false);
        }

        // Resolve the klassen the subthema's reference (by naam — class scoping is structural, Art. IX.2).
        var klassen = await _context.Klassen.ToListAsync(cancellationToken);
        var klasPerNaam = klassen
            .GroupBy(k => k.Naam, KeyComparer)
            .ToDictionary(g => g.Key, g => g.First(), KeyComparer);

        // Load the existing themalaag for the thema's named in the file (graph-loaded so we can diff and,
        // crucially, inspect/preserve teacher koppeling statuses). Scoped to the incoming names to stay cheap.
        var inkomendeThemaNamen = parseResultaat.Rijen
            .Select(r => r.ThemaNaam.Trim())
            .ToHashSet(KeyComparer);

        var bestaandeThemas = await _context.Themas
            .Include(t => t.Themadoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Subdoelen)
            .Include(t => t.Subthemas).ThenInclude(s => s.Activiteiten)
            .Where(t => inkomendeThemaNamen.Contains(t.Naam))
            .ToListAsync(cancellationToken);
        var bestaandeThemaPerNaam = bestaandeThemas
            .GroupBy(t => t.Naam, KeyComparer)
            .ToDictionary(g => g.Key, g => g.First(), KeyComparer);

        // Validate every referenced leerplandoel code BEFORE any DoelKoppeling is constructed.
        // DoelKoppeling.LeerplandoelCode is a required Restrict FK (Art. III.5), so a single typo in the
        // sheet's Themadoelen/Subdoelen column would otherwise abort the ENTIRE import with a
        // DbUpdateException surfacing as a 500 — instead of a per-row problem report (ADR-0006 §4).
        // The CRUD sibling has always validated codes via VereisLeerplandoelAsync; the import did not.
        var verwezenCodes = parseResultaat.Rijen
            .SelectMany(r => r.Themadoelen.Concat(r.Subdoelen))
            .Select(c => c.Trim())
            .Where(c => c.Length > 0)
            .ToHashSet(StringComparer.Ordinal);

        var geldigeCodes = verwezenCodes.Count == 0
            ? []
            : (await _context.Leerplandoelen
                .Where(l => verwezenCodes.Contains(l.Code))
                .Select(l => l.Code)
                .ToListAsync(cancellationToken))
                .ToHashSet(StringComparer.Ordinal);

        var codeControle = new DoelCodeControle(geldigeCodes);

        var diff = await VerwerkAsync(parseResultaat, opties, klasPerNaam, bestaandeThemaPerNaam, codeControle, toepassen, cancellationToken);

        if (toepassen)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }

        return new SchoolcontentImportResultaat(diff, toepassen);
    }

    /// <summary>
    /// The single, shared add/overwrite logic used for both preview and commit. It mutates the EF graph
    /// only when <paramref name="toepassen"/> is true; otherwise it walks the same branches purely to
    /// classify, so the diff is identical in both modes.
    /// </summary>
    private async Task<SchoolcontentImportDiff> VerwerkAsync(
        SchoolcontentParseResult parseResultaat,
        SchoolcontentImportOpties opties,
        IReadOnlyDictionary<string, Klas> klasPerNaam,
        IReadOnlyDictionary<string, Thema> bestaandeThemaPerNaam,
        DoelCodeControle codeControle,
        bool toepassen,
        CancellationToken cancellationToken)
    {
        var themaWijzigingen = new List<ThemaWijziging>();
        var subthemaWijzigingen = new List<SubthemaWijziging>();
        var activiteitWijzigingen = new List<ActiviteitWijziging>();
        var bedreigd = new List<BedreigdeBeslissing>();
        var opmerkingen = new List<string>();

        // Group the flat rows into the thema → subthema → activiteit hierarchy.
        var perThema = GroepeerRijen(parseResultaat.Rijen);

        // New thema's are created once and reused across rows within this import.
        var nieuweThemaPerNaam = new Dictionary<string, Thema>(KeyComparer);

        foreach (var (themaNaam, themaGroep) in perThema)
        {
            var bestaat = bestaandeThemaPerNaam.TryGetValue(themaNaam, out var bestaandeThema);
            var eersteRij = themaGroep.First();

            Thema doelThema;
            if (!bestaat)
            {
                themaWijzigingen.Add(new ThemaWijziging(themaNaam, WijzigingSoort.Toegevoegd));
                doelThema = MaakThema(eersteRij);
                nieuweThemaPerNaam[themaNaam] = doelThema;
                if (toepassen)
                {
                    _context.Themas.Add(doelThema);
                }
            }
            else if (opties.Modus == SchoolcontentImportModus.Toevoegen)
            {
                // Add-mode: existing thema is left completely untouched (attributes + koppelingen).
                themaWijzigingen.Add(new ThemaWijziging(themaNaam, WijzigingSoort.Ongewijzigd));
                doelThema = bestaandeThema!;
            }
            else
            {
                // Update/overwrite-mode: refresh thema attributes if they differ.
                doelThema = bestaandeThema!;
                var gewijzigd = WerkThemaBij(doelThema, eersteRij, toepassen);
                themaWijzigingen.Add(new ThemaWijziging(
                    themaNaam,
                    gewijzigd ? WijzigingSoort.Bijgewerkt : WijzigingSoort.Ongewijzigd));

                ReconcileThemadoelen(doelThema, themaGroep, opties, codeControle, toepassen, bedreigd, opmerkingen);
            }

            // On a brand-new thema, themadoelen come straight from the file (no existing decisions to protect).
            if (!bestaat)
            {
                // The cap is applied through the shared PasThemadoelCapToe helper rather than left to
                // Thema.VoegThemadoelToe, which throws on the 4th and would abort the whole import as a
                // 500 instead of reporting (in the spirit of ADR-0006 §4). Running it in both passes —
                // not only under `toepassen` — keeps the documented "preview == commit" guarantee true.
                var alleCodes = VerzamelThemadoelCodes(themaGroep, codeControle);
                var (codes, capOpmerking) = PasThemadoelCapToe(themaNaam, reedsAanwezig: 0, alleCodes);
                if (capOpmerking is not null)
                {
                    opmerkingen.Add(capOpmerking);
                }

                foreach (var code in codes)
                {
                    if (toepassen)
                    {
                        doelThema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Voorgesteld));
                    }
                }
            }

            VerwerkSubthemas(
                doelThema,
                bestaat ? bestaandeThema : null,
                themaGroep,
                opties,
                klasPerNaam,
                codeControle,
                toepassen,
                subthemaWijzigingen,
                activiteitWijzigingen,
                bedreigd,
                opmerkingen);
        }

        await Task.CompletedTask;

        // Report every unknown goal code once, at the end, instead of failing the import. The rest of
        // the file is imported; the curriculum is never touched (Art. III).
        if (codeControle.Onbekend.Count > 0)
        {
            // No em dash (Art. II.5) and no "(s)" plural dodge, both of which E1-13 would have put on a
            // teacher's screen. Dutch inflects the noun and the verb, so the count picks the sentence; the
            // frontend cannot do it here because only this layer knows the codes.
            var aantal = codeControle.Onbekend.Count;
            var opsomming = string.Join(", ", codeControle.Onbekend);
            opmerkingen.Add(
                (aantal == 1
                    ? "1 leerplandoelcode uit dit bestand is overgeslagen. Deze code staat niet in de "
                    : $"{aantal} leerplandoelcodes uit dit bestand zijn overgeslagen. Deze codes staan niet in de ") +
                $"ingelezen Op.stap-doelen: {opsomming}. " +
                "Controleer de codes, of laad eerst de discipline in waar ze bij horen.");
        }

        return new SchoolcontentImportDiff(
            opties.Modus,
            themaWijzigingen,
            subthemaWijzigingen,
            activiteitWijzigingen,
            bedreigd,
            overgeslagen: false,
            opmerkingen: opmerkingen);
    }

    private void VerwerkSubthemas(
        Thema doelThema,
        Thema? bestaandeThema,
        IReadOnlyList<SchoolcontentRij> themaGroep,
        SchoolcontentImportOpties opties,
        IReadOnlyDictionary<string, Klas> klasPerNaam,
        DoelCodeControle codeControle,
        bool toepassen,
        List<SubthemaWijziging> subthemaWijzigingen,
        List<ActiviteitWijziging> activiteitWijzigingen,
        List<BedreigdeBeslissing> bedreigd,
        List<string> opmerkingen)
    {
        var themaNaam = doelThema.Naam;
        var perSubthema = themaGroep
            .GroupBy(r => new SubthemaSleutel(r.SubthemaNaam.Trim(), r.SubthemaKlas.Trim(), r.SubthemaLeeftijd.Trim()))
            .ToList();

        // Track subthema's created during this import so multiple activiteit-rows reuse the same instance.
        var nieuweSubthemas = new Dictionary<SubthemaSleutel, Subthema>();

        foreach (var subthemaGroep in perSubthema)
        {
            var sleutel = subthemaGroep.Key;
            var eersteRij = subthemaGroep.First();

            if (!klasPerNaam.TryGetValue(sleutel.Klas, out var klas))
            {
                // A subthema is class-scoped (Art. IX.2), so an unresolvable klas means the row cannot be
                // placed at all. The Dutch says what happened and what to do; the article reference lives
                // here in the comment, because a teacher cannot act on "Art. IX.2" (Art. II.3) — the same
                // audience mixing E1-15 fixed in the Op.stap importer's out-of-scope notice. No em dash
                // either (Art. II.5): E1-13 renders this string.
                opmerkingen.Add(
                    $"Subthema '{sleutel.Naam}' verwijst naar de klas '{sleutel.Klas}', die niet bestaat. " +
                    "Het subthema is daarom overgeslagen. Maak die klas eerst aan, of pas de naam in het " +
                    "bestand aan.");
                continue;
            }

            var bestaandSubthema = bestaandeThema?.Subthemas.FirstOrDefault(s =>
                KeyComparer.Equals(s.Naam, sleutel.Naam) &&
                s.KlasId == klas.Id &&
                KeyComparer.Equals(s.Leeftijd, sleutel.Leeftijd));

            Subthema doelSubthema;
            if (bestaandSubthema is null)
            {
                subthemaWijzigingen.Add(new SubthemaWijziging(
                    themaNaam, sleutel.Naam, sleutel.Klas, sleutel.Leeftijd, WijzigingSoort.Toegevoegd));
                doelSubthema = MaakSubthema(doelThema, eersteRij, klas.Id, toepassen, out var nieuw);
                if (nieuw is not null)
                {
                    nieuweSubthemas[sleutel] = nieuw;
                }

                // New subthema: subdoelen straight from the file.
                if (toepassen)
                {
                    foreach (var code in VerzamelSubdoelCodes(subthemaGroep, codeControle))
                    {
                        doelSubthema.VoegSubdoelToe(sleutel.Leeftijd, new DoelKoppeling(code, KoppelingStatus.Voorgesteld));
                    }
                }
            }
            else if (opties.Modus == SchoolcontentImportModus.Toevoegen)
            {
                subthemaWijzigingen.Add(new SubthemaWijziging(
                    themaNaam, sleutel.Naam, sleutel.Klas, sleutel.Leeftijd, WijzigingSoort.Ongewijzigd));
                doelSubthema = bestaandSubthema;
            }
            else
            {
                doelSubthema = bestaandSubthema;
                var gewijzigd = WerkSubthemaBij(doelSubthema, eersteRij, toepassen);
                subthemaWijzigingen.Add(new SubthemaWijziging(
                    themaNaam, sleutel.Naam, sleutel.Klas, sleutel.Leeftijd,
                    gewijzigd ? WijzigingSoort.Bijgewerkt : WijzigingSoort.Ongewijzigd));

                ReconcileSubdoelen(doelSubthema, subthemaGroep, opties, codeControle, toepassen, bedreigd);
            }

            VerwerkActiviteiten(
                doelThema,
                bestaandSubthema,
                doelSubthema,
                themaNaam,
                sleutel,
                subthemaGroep,
                opties,
                toepassen,
                activiteitWijzigingen);
        }
    }

    private void VerwerkActiviteiten(
        Thema doelThema,
        Subthema? bestaandSubthema,
        Subthema doelSubthema,
        string themaNaam,
        SubthemaSleutel sleutel,
        IEnumerable<SchoolcontentRij> subthemaGroep,
        SchoolcontentImportOpties opties,
        bool toepassen,
        List<ActiviteitWijziging> activiteitWijzigingen)
    {
        foreach (var rij in subthemaGroep)
        {
            var activiteitNaam = rij.ActiviteitNaam.Trim();
            var bestaandeActiviteit = bestaandSubthema?.Activiteiten
                .FirstOrDefault(a => KeyComparer.Equals(a.Naam, activiteitNaam));

            if (bestaandeActiviteit is null)
            {
                activiteitWijzigingen.Add(new ActiviteitWijziging(
                    themaNaam, sleutel.Naam, activiteitNaam, WijzigingSoort.Toegevoegd));
                if (toepassen)
                {
                    doelSubthema.VoegActiviteitToe(
                        activiteitNaam, rij.ActiviteitType, rij.ActiviteitHoek, rij.ActiviteitVerwachteUitkomsten);
                }
            }
            else if (opties.Modus == SchoolcontentImportModus.Toevoegen)
            {
                activiteitWijzigingen.Add(new ActiviteitWijziging(
                    themaNaam, sleutel.Naam, activiteitNaam, WijzigingSoort.Ongewijzigd));
            }
            else
            {
                var gewijzigd = WerkActiviteitBij(bestaandeActiviteit, rij, toepassen);
                activiteitWijzigingen.Add(new ActiviteitWijziging(
                    themaNaam, sleutel.Naam, activiteitNaam,
                    gewijzigd ? WijzigingSoort.Bijgewerkt : WijzigingSoort.Ongewijzigd));

                // Activiteit goal links (Doelkoppelingen) are not carried by this import (they are made
                // later via AI matching / CRUD). An overwrite therefore never touches them — every teacher
                // decision on an activiteit link is preserved unconditionally.
            }
        }
    }

    // --- Koppeling reconciliation (the Art. IV.2 heart). ---

    /// <summary>
    /// Reconciles a thema's themadoel links against the file's incoming codes on overwrite. Existing
    /// teacher decisions are preserved; an AI-only <c>voorgesteld</c> link absent from the file is dropped;
    /// a teacher link absent from the file is <b>kept and warned</b> unless explicit discard is opted in.
    /// New codes are added as <c>voorgesteld</c>.
    /// </summary>
    private void ReconcileThemadoelen(
        Thema thema,
        IReadOnlyList<SchoolcontentRij> themaGroep,
        SchoolcontentImportOpties opties,
        DoelCodeControle codeControle,
        bool toepassen,
        List<BedreigdeBeslissing> bedreigd,
        List<string> opmerkingen)
    {
        var inkomendeCodes = VerzamelThemadoelCodes(themaGroep, codeControle);
        var inkomendeSet = inkomendeCodes.ToHashSet(StringComparer.Ordinal);
        var bestaandeCodes = thema.Themadoelen
            .Select(td => td.Koppeling.LeerplandoelCode)
            .ToHashSet(StringComparer.Ordinal);

        // Threatened / dropped existing links.
        foreach (var td in thema.Themadoelen.ToList())
        {
            var koppeling = td.Koppeling;
            if (inkomendeSet.Contains(koppeling.LeerplandoelCode))
            {
                continue; // still in the file — kept (status untouched).
            }

            if (IsMenselijkeBeslissing(koppeling.Status))
            {
                if (opties.MenselijkeBeslissingenVerwijderen)
                {
                    if (toepassen)
                    {
                        VerwijderThemadoel(thema, td);
                    }
                }
                else
                {
                    // Preserve and warn — the headline guarantee (Art. IV.2).
                    bedreigd.Add(new BedreigdeBeslissing(
                        KoppelingNiveau.Themadoel, thema.Naam, koppeling.LeerplandoelCode, koppeling.Status));
                }
            }
            else if (toepassen)
            {
                // AI-only voorgesteld, no longer suggested — safe to drop.
                VerwijderThemadoel(thema, td);
            }
        }

        // How many themadoelen this thema will hold after the removals above — computed from the
        // *predicate*, never from thema.Themadoelen.Count, which the removal loop only mutates when
        // `toepassen` is true. Counting the mutated collection made preview and commit walk different
        // arithmetic: preview kept the stale links and added nothing, while commit removed them first,
        // took three codes and dropped the rest in silence.
        var behouden = thema.Themadoelen.Count(td =>
            inkomendeSet.Contains(td.Koppeling.LeerplandoelCode) ||
            (IsMenselijkeBeslissing(td.Koppeling.Status) && !opties.MenselijkeBeslissingenVerwijderen));

        var nieuweCodes = inkomendeCodes.Where(c => !bestaandeCodes.Contains(c)).ToList();
        var (toeTeVoegen, capOpmerking) = PasThemadoelCapToe(thema.Naam, behouden, nieuweCodes);
        if (capOpmerking is not null)
        {
            opmerkingen.Add(capOpmerking);
        }

        foreach (var code in toeTeVoegen)
        {
            if (toepassen)
            {
                var themadoel = thema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Voorgesteld));
                _context.Themadoelen.Add(themadoel);
            }
        }
    }

    /// <summary>
    /// Applies Art. IX.2's upper bound on themadoelen in <b>one</b> place, shared by the create and the
    /// overwrite path, and returns both the codes that fit and the notice for those that do not.
    /// <para>
    /// Centralised deliberately: enforcing it via <c>Thema.VoegThemadoelToe</c>'s guard would throw and
    /// abort the whole import as a 500, and enforcing it separately per branch is how the overwrite path
    /// came to drop codes with no notice at all. The result depends only on the incoming codes and the
    /// retained count, so preview and commit always agree.
    /// </para>
    /// <para>
    /// Note this bounds only the <i>maximum</i> (3). Art. IX.2 describes themadoelen as "2–3"; the
    /// minimum of 2 is enforced nowhere in the codebase, so an under-anchored thema imports silently.
    /// Whether 2 is an invariant or a pedagogical guideline is an open question for directie.
    /// </para>
    /// </summary>
    private static (IReadOnlyList<string> ToeTeVoegen, string? Opmerking) PasThemadoelCapToe(
        string themaNaam,
        int reedsAanwezig,
        IReadOnlyList<string> nieuweCodes)
    {
        var ruimte = Math.Max(0, Thema.MaxThemadoelen - reedsAanwezig);
        if (nieuweCodes.Count <= ruimte)
        {
            return (nieuweCodes, null);
        }

        var genegeerd = nieuweCodes.Skip(ruimte).ToList();
        var opmerking =
            $"Thema '{themaNaam}' zou {reedsAanwezig + nieuweCodes.Count} themadoelen krijgen; " +
            $"een thema wordt door ten hoogste {Thema.MaxThemadoelen} themadoelen geankerd (Art. IX.2). " +
            $"{genegeerd.Count} genegeerd: {string.Join(", ", genegeerd)}.";

        return (nieuweCodes.Take(ruimte).ToList(), opmerking);
    }

    /// <summary>Subdoel-link analogue of <see cref="ReconcileThemadoelen"/>.</summary>
    private void ReconcileSubdoelen(
        Subthema subthema,
        IEnumerable<SchoolcontentRij> subthemaGroep,
        SchoolcontentImportOpties opties,
        DoelCodeControle codeControle,
        bool toepassen,
        List<BedreigdeBeslissing> bedreigd)
    {
        var inkomendeCodes = VerzamelSubdoelCodes(subthemaGroep, codeControle);
        var inkomendeSet = inkomendeCodes.ToHashSet(StringComparer.Ordinal);
        var bestaandeCodes = subthema.Subdoelen
            .Select(sd => sd.Koppeling.LeerplandoelCode)
            .ToHashSet(StringComparer.Ordinal);

        foreach (var sd in subthema.Subdoelen.ToList())
        {
            var koppeling = sd.Koppeling;
            if (inkomendeSet.Contains(koppeling.LeerplandoelCode))
            {
                continue;
            }

            if (IsMenselijkeBeslissing(koppeling.Status))
            {
                if (opties.MenselijkeBeslissingenVerwijderen)
                {
                    if (toepassen)
                    {
                        VerwijderSubdoel(subthema, sd);
                    }
                }
                else
                {
                    bedreigd.Add(new BedreigdeBeslissing(
                        KoppelingNiveau.Subdoel, subthema.Naam, koppeling.LeerplandoelCode, koppeling.Status));
                }
            }
            else if (toepassen)
            {
                VerwijderSubdoel(subthema, sd);
            }
        }

        foreach (var code in inkomendeCodes)
        {
            if (bestaandeCodes.Contains(code))
            {
                continue;
            }

            if (toepassen)
            {
                var subdoel = subthema.VoegSubdoelToe(subthema.Leeftijd, new DoelKoppeling(code, KoppelingStatus.Voorgesteld));
                _context.Subdoelen.Add(subdoel);
            }
        }
    }

    private static bool IsMenselijkeBeslissing(KoppelingStatus status) =>
        status is KoppelingStatus.Aanvaard or KoppelingStatus.Geweigerd or KoppelingStatus.Manueel;

    /// <summary>
    /// Removes a themadoel from both the domain navigation and the tracked set so EF deletes the row
    /// (and its owned <see cref="DoelKoppeling"/>) cleanly rather than leaving an orphaned cascade.
    /// </summary>
    private void VerwijderThemadoel(Thema thema, Themadoel themadoel)
    {
        thema.VerwijderThemadoel(themadoel);
        _context.Themadoelen.Remove(themadoel);
    }

    /// <summary>Subdoel analogue of <see cref="VerwijderThemadoel"/>.</summary>
    private void VerwijderSubdoel(Subthema subthema, Subdoel subdoel)
    {
        subthema.VerwijderSubdoel(subdoel);
        _context.Subdoelen.Remove(subdoel);
    }

    // --- Hierarchy building from flat rows. ---

    private static IReadOnlyList<KeyValuePair<string, IReadOnlyList<SchoolcontentRij>>> GroepeerRijen(
        IReadOnlyList<SchoolcontentRij> rijen) =>
        rijen
            .GroupBy(r => r.ThemaNaam.Trim(), KeyComparer)
            .Select(g => new KeyValuePair<string, IReadOnlyList<SchoolcontentRij>>(g.Key, g.ToList()))
            .ToList();

    private static IReadOnlyList<string> VerzamelThemadoelCodes(
        IEnumerable<SchoolcontentRij> rijen,
        DoelCodeControle controle) =>
        controle.FilterGeldig(rijen.SelectMany(r => r.Themadoelen));

    private static IReadOnlyList<string> VerzamelSubdoelCodes(
        IEnumerable<SchoolcontentRij> rijen,
        DoelCodeControle controle) =>
        controle.FilterGeldig(rijen.SelectMany(r => r.Subdoelen));

    /// <summary>
    /// Keeps goal-code references honest: normalises the codes from a sheet, drops those that do not
    /// exist as a <c>Leerplandoel</c>, and remembers the rejects so the import can report them.
    /// <para>
    /// Filtering rather than throwing is the point. <c>DoelKoppeling.LeerplandoelCode</c> is a required
    /// <c>Restrict</c> FK, so passing an unknown code through would fail the whole
    /// <c>SaveChanges</c> — one typo in one cell discarding an otherwise valid import of hundreds of
    /// rows, as an opaque 500. Reporting the unknown codes and importing the rest matches ADR-0006 §4
    /// ("report, never silently drop") and the curriculum stays untouched (Art. III).
    /// </para>
    /// </summary>
    private sealed class DoelCodeControle
    {
        private readonly HashSet<string> _geldig;
        private readonly SortedSet<string> _onbekend = new(StringComparer.Ordinal);

        public DoelCodeControle(HashSet<string> geldigeCodes) => _geldig = geldigeCodes;

        /// <summary>The unknown codes encountered, for the import's opmerkingen.</summary>
        public IReadOnlyCollection<string> Onbekend => _onbekend;

        /// <summary>Trims, de-duplicates and keeps only codes that exist as a leerplandoel.</summary>
        public IReadOnlyList<string> FilterGeldig(IEnumerable<string> codes)
        {
            var resultaat = new List<string>();
            var gezien = new HashSet<string>(StringComparer.Ordinal);

            foreach (var ruw in codes)
            {
                var code = ruw.Trim();
                if (code.Length == 0 || !gezien.Add(code))
                {
                    continue;
                }

                if (_geldig.Contains(code))
                {
                    resultaat.Add(code);
                }
                else
                {
                    _onbekend.Add(code);
                }
            }

            return resultaat;
        }
    }

    private static Thema MaakThema(SchoolcontentRij rij)
    {
        var thema = new Thema(rij.ThemaNaam, rij.ThemaDuurWeken, rij.ThemaInvalshoeken);
        thema.StelKernwoordenschatIn(rij.Kernwoordenschat);
        thema.StelRijkeWoordenschatIn(rij.RijkeWoordenschat);
        return thema;
    }

    private Subthema MaakSubthema(Thema thema, SchoolcontentRij rij, Guid klasId, bool toepassen, out Subthema? nieuw)
    {
        if (!toepassen)
        {
            // Preview: build a detached instance purely so the activiteit walk has a parent to read from.
            var voorbeeld = new Thema(thema.Naam, thema.DuurWeken).VoegSubthemaToe(
                rij.SubthemaNaam, rij.SubthemaDuurWeken, klasId, rij.SubthemaLeeftijd);
            voorbeeld.StelVraagstellingIn(rij.SubthemaProbleemstelling, rij.SubthemaOnderzoeksvraag);
            nieuw = null;
            return voorbeeld;
        }

        var subthema = thema.VoegSubthemaToe(rij.SubthemaNaam, rij.SubthemaDuurWeken, klasId, rij.SubthemaLeeftijd);
        subthema.StelVraagstellingIn(rij.SubthemaProbleemstelling, rij.SubthemaOnderzoeksvraag);
        nieuw = subthema;
        return subthema;
    }

    // --- Attribute overwrite helpers (return whether anything changed). ---

    private static bool WerkThemaBij(Thema thema, SchoolcontentRij rij, bool toepassen)
    {
        var gewijzigd =
            thema.DuurWeken != rij.ThemaDuurWeken ||
            !string.Equals(thema.Invalshoeken, Genormaliseerd(rij.ThemaInvalshoeken), StringComparison.Ordinal) ||
            !LijstGelijk(thema.Kernwoordenschat, rij.Kernwoordenschat) ||
            !LijstGelijk(thema.RijkeWoordenschat, rij.RijkeWoordenschat);

        if (gewijzigd && toepassen)
        {
            thema.WerkBasisGegevensBij(rij.ThemaDuurWeken, rij.ThemaInvalshoeken);
            thema.StelKernwoordenschatIn(rij.Kernwoordenschat);
            thema.StelRijkeWoordenschatIn(rij.RijkeWoordenschat);
        }

        return gewijzigd;
    }

    private static bool WerkSubthemaBij(Subthema subthema, SchoolcontentRij rij, bool toepassen)
    {
        var gewijzigd =
            subthema.DuurWeken != rij.SubthemaDuurWeken ||
            !string.Equals(subthema.Probleemstelling, Genormaliseerd(rij.SubthemaProbleemstelling), StringComparison.Ordinal) ||
            !string.Equals(subthema.Onderzoeksvraag, Genormaliseerd(rij.SubthemaOnderzoeksvraag), StringComparison.Ordinal);

        if (gewijzigd && toepassen)
        {
            subthema.WerkBasisGegevensBij(rij.SubthemaDuurWeken);
            subthema.StelVraagstellingIn(rij.SubthemaProbleemstelling, rij.SubthemaOnderzoeksvraag);
        }

        return gewijzigd;
    }

    private static bool WerkActiviteitBij(Activiteit activiteit, SchoolcontentRij rij, bool toepassen)
    {
        var gewijzigd =
            activiteit.ActiviteitType != rij.ActiviteitType ||
            !string.Equals(activiteit.Hoek, Genormaliseerd(rij.ActiviteitHoek), StringComparison.Ordinal) ||
            !string.Equals(activiteit.VerwachteUitkomsten, Genormaliseerd(rij.ActiviteitVerwachteUitkomsten), StringComparison.Ordinal);

        if (gewijzigd && toepassen)
        {
            activiteit.WerkGegevensBij(rij.ActiviteitType, rij.ActiviteitHoek, rij.ActiviteitVerwachteUitkomsten);
        }

        return gewijzigd;
    }

    private static string? Genormaliseerd(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static bool LijstGelijk(IReadOnlyList<string> bestaand, IReadOnlyList<string> inkomend)
    {
        var genormaliseerd = inkomend
            .Where(w => !string.IsNullOrWhiteSpace(w))
            .Select(w => w.Trim())
            .ToList();
        return bestaand.SequenceEqual(genormaliseerd, StringComparer.Ordinal);
    }

    /// <summary>Match key for a subthema within its thema (class/age scoping is part of identity, Art. IX.2).</summary>
    private readonly record struct SubthemaSleutel(string Naam, string Klas, string Leeftijd);
}
