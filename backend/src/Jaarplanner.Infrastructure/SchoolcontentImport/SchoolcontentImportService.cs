using Jaarplanner.Application.Schoolcontent.Import;
using Jaarplanner.Domain.Curriculum;
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
                var (codes, capOpmerking) = PasThemadoelCapToe(
                    themaNaam, bezetDoorBestand: 0, bezetDoorBeslissing: 0, alleCodes);
                if (capOpmerking is not null)
                {
                    opmerkingen.Add(capOpmerking);
                }

                foreach (var code in codes)
                {
                    if (toepassen)
                    {
                        doelThema.VoegThemadoelToe(new DoelKoppeling(code, IngelezenKoppelingStatus));
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
            // Grouped on (naam, leeftijd). The klas left this key on 2026-08-30 (Art. IX.2): two rows naming the
            // same subthema at the same age for two classes are now ONE subthema, which is the merge the amendment
            // intends rather than a collision to disambiguate.
            .GroupBy(r => new SubthemaSleutel(r.SubthemaNaam.Trim(), LeeftijdVoor(r, klasPerNaam) ?? r.SubthemaLeeftijd.Trim()))
            .ToList();

        // Track subthema's created during this import so multiple activiteit-rows reuse the same instance.
        var nieuweSubthemas = new Dictionary<SubthemaSleutel, Subthema>();

        foreach (var subthemaGroep in perSubthema)
        {
            var sleutel = subthemaGroep.Key;
            var eersteRij = subthemaGroep.First();

            // A subthema is age-scoped (Art. IX.2), so a row whose leeftijd cannot be resolved to one of the nine
            // jaar/fase codes cannot be placed at all. The Dutch says what happened and what to do; the article
            // reference lives here in the comment, because a teacher cannot act on "Art. IX.2" (Art. II.3) — the
            // same audience mixing E1-15 fixed in the Op.stap importer's out-of-scope notice. No em dash either
            // (Art. II.5): E1-13 renders this string.
            //
            // The KLAS column is still read, but only as a fallback source for the age, and no longer as a scope.
            // A file naming a class that does not exist is therefore no longer fatal on its own: it is fatal only
            // when the leeftijd column could not answer either.
            if (!Jaarfasen.IsBekend(sleutel.Leeftijd))
            {
                opmerkingen.Add(
                    $"Subthema '{sleutel.Naam}' heeft leeftijd '{eersteRij.SubthemaLeeftijd.Trim()}', en dat is geen " +
                    $"geldige leeftijd. Het subthema is daarom overgeslagen. Zet er een van deze in: " +
                    $"{string.Join(", ", Jaarfasen.Alle)}. De klas '{eersteRij.SubthemaKlas.Trim()}' kon de leeftijd " +
                    "ook niet aanvullen, want die klas bestaat niet of geeft meer dan een leeftijd.");
                continue;
            }

            var bestaandSubthema = bestaandeThema?.Subthemas.FirstOrDefault(s =>
                KeyComparer.Equals(s.Naam, sleutel.Naam) &&
                KeyComparer.Equals(s.Leeftijd, sleutel.Leeftijd));

            Subthema doelSubthema;
            if (bestaandSubthema is null)
            {
                subthemaWijzigingen.Add(new SubthemaWijziging(
                    themaNaam, sleutel.Naam, sleutel.Leeftijd, WijzigingSoort.Toegevoegd));
                doelSubthema = MaakSubthema(doelThema, eersteRij, sleutel.Leeftijd, toepassen, out var nieuw);
                if (nieuw is not null)
                {
                    nieuweSubthemas[sleutel] = nieuw;
                }

                // New subthema: subdoelen straight from the file.
                if (toepassen)
                {
                    foreach (var code in VerzamelSubdoelCodes(subthemaGroep, codeControle))
                    {
                        doelSubthema.VoegSubdoelToe(sleutel.Leeftijd, new DoelKoppeling(code, IngelezenKoppelingStatus));
                    }
                }
            }
            else if (opties.Modus == SchoolcontentImportModus.Toevoegen)
            {
                subthemaWijzigingen.Add(new SubthemaWijziging(
                    themaNaam, sleutel.Naam, sleutel.Leeftijd, WijzigingSoort.Ongewijzigd));
                doelSubthema = bestaandSubthema;
            }
            else
            {
                doelSubthema = bestaandSubthema;
                var gewijzigd = WerkSubthemaBij(doelSubthema, eersteRij, toepassen);
                subthemaWijzigingen.Add(new SubthemaWijziging(
                    themaNaam, sleutel.Naam, sleutel.Leeftijd,
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

        // Which themadoelen this thema will still hold after the removals above — computed from the
        // *predicate*, never from thema.Themadoelen.Count, which the removal loop only mutates when
        // `toepassen` is true. Counting the mutated collection made preview and commit walk different
        // arithmetic: preview kept the stale links and added nothing, while commit removed them first,
        // took three codes and dropped the rest in silence.
        var behoudenKoppelingen = thema.Themadoelen
            .Select(td => td.Koppeling)
            .Where(k =>
                inkomendeSet.Contains(k.LeerplandoelCode) ||
                (IsMenselijkeBeslissing(k.Status) && !opties.MenselijkeBeslissingenVerwijderen))
            .ToList();

        // Split by *who can free the slot*, because that is what the cap notice's advice hangs on
        // (E1-13 round-3 audit, MAJOR 1). A retained human decision that this run is preserving cannot be
        // dislodged by editing the file: removing its code from the cell only moves it into the
        // "kept and warned" branch above, where it still occupies a slot. Every other retained link is one
        // the file carries and the run would drop if the file stopped carrying it, so shortening the
        // `Themadoelen` cell really does free that slot. Note the predicate is deliberately the same
        // `IsMenselijkeBeslissing(...) && !MenselijkeBeslissingenVerwijderen` used by the removal loop, so the
        // two can never disagree about which links survive.
        var bezetDoorBeslissing = behoudenKoppelingen.Count(k =>
            IsMenselijkeBeslissing(k.Status) && !opties.MenselijkeBeslissingenVerwijderen);
        var bezetDoorBestand = behoudenKoppelingen.Count - bezetDoorBeslissing;

        var nieuweCodes = inkomendeCodes.Where(c => !bestaandeCodes.Contains(c)).ToList();
        var (toeTeVoegen, capOpmerking) = PasThemadoelCapToe(
            thema.Naam, bezetDoorBestand, bezetDoorBeslissing, nieuweCodes);
        if (capOpmerking is not null)
        {
            opmerkingen.Add(capOpmerking);
        }

        foreach (var code in toeTeVoegen)
        {
            if (toepassen)
            {
                var themadoel = thema.VoegThemadoelToe(new DoelKoppeling(code, IngelezenKoppelingStatus));
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
    /// <para>
    /// <b>The notice is written for a teacher (Art. II.3), and the article reference lives here in the
    /// comment rather than in it.</b> The cap is Art. IX.2's; a reader who can act on this sentence cannot act
    /// on that string. E1-13's audit found this notice still carrying "(Art. IX.2)" after its three siblings had
    /// been rewritten, which is the selective-fix pattern this repo keeps recording.
    /// </para>
    /// <para>
    /// <b>Three notices, because advice is only worth giving to a reader who can act on it, and that depends on
    /// <i>who holds the occupied slots</i>, not on which call site we came from.</b>
    /// </para>
    /// <list type="bullet">
    /// <item><b>Nothing retained</b> (both counts 0 — always the create path, and the reconcile path too when
    /// every existing link was dropped): the file spends the whole cap and the codes that fit are the
    /// <i>first</i> ones in its <c>Themadoelen</c> cell (<c>Take(ruimte)</c> below), so "put the anchoring ones
    /// first" is a fix the reader can carry out in the file.</item>
    /// <item><b>Only <paramref name="bezetDoorBestand"/></b>: every retained link is one this file carries and
    /// the run would drop if the file stopped carrying it, so the whole thema is the file's own doing and
    /// shortening the cell is the fix. Column <i>order</i> is not the fix here: a code already in the database
    /// keeps its slot wherever it sits in the cell, so only removing codes frees anything.</item>
    /// <item><b><paramref name="bezetDoorBeslissing"/> above 0</b>: a slot is held by a link somebody already
    /// decided on, which this run preserves (Art. IV.2) and the file cannot dislodge. Only here is the discard
    /// opt-in mentioned, and it is named with its blast radius, because it is global over the whole run.</item>
    /// </list>
    /// <para>
    /// <b>Round 2 wrote that third sentence unconditionally, and it was false in the second case — which is the
    /// most reachable one.</b> The import creates themadoelen as <c>voorgesteld</c>, so a <i>second import of the
    /// same file</i> meets links that <b>are</b> in it; the audit reproduced both halves, removing one code from
    /// the file and watching the slot it claimed could not be freed be freed. Both remedies that sentence offered
    /// were wrong there, and one was dangerous: <c>MenselijkeBeslissingenVerwijderen</c> deletes
    /// <c>aanvaard</c>/<c>manueel</c> links across every thema and subthema in the run, and it cannot raise the
    /// cap at all when no retained link is absent from the file. It also told the reader to remove a themadoel
    /// "bij het thema zelf", which no screen offers until E1-14 exists (E1-13 round-3 audit, MAJOR 1; the
    /// round-2 audit's MINOR 2 is the earlier half of the same defect).
    /// </para>
    /// </summary>
    private static (IReadOnlyList<string> ToeTeVoegen, string? Opmerking) PasThemadoelCapToe(
        string themaNaam,
        int bezetDoorBestand,
        int bezetDoorBeslissing,
        IReadOnlyList<string> nieuweCodes)
    {
        var reedsAanwezig = bezetDoorBestand + bezetDoorBeslissing;
        var ruimte = Math.Max(0, Thema.MaxThemadoelen - reedsAanwezig);
        if (nieuweCodes.Count <= ruimte)
        {
            return (nieuweCodes, null);
        }

        var toeTeVoegen = nieuweCodes.Take(ruimte).ToList();
        var genegeerd = nieuweCodes.Skip(ruimte).ToList();

        // Dutch inflects the noun and the verb, so the count picks the sentence. No "(s)" dodge: the frontend
        // cannot rescue it either, because only this layer knows the codes.
        var overgeslagen = genegeerd.Count == 1
            ? $"1 themadoel is daarom overgeslagen: {genegeerd[0]}."
            : $"{genegeerd.Count} themadoelen zijn daarom overgeslagen: {string.Join(", ", genegeerd)}.";

        if (reedsAanwezig == 0)
        {
            return (
                toeTeVoegen,
                $"Thema '{themaNaam}' zou {nieuweCodes.Count} themadoelen krijgen, en een thema kan er " +
                $"hoogstens {Thema.MaxThemadoelen} hebben. {overgeslagen} " +
                "Zet in het bestand de themadoelen die dit thema het best samenvatten vooraan in de kolom " +
                "Themadoelen.");
        }

        if (bezetDoorBeslissing == 0)
        {
            // Everything this thema will hold comes from this file, so the count in the first sentence is the
            // number of codes in its `Themadoelen` cell, and shortening that cell is the whole fix.
            return (
                toeTeVoegen,
                $"Thema '{themaNaam}' zou {reedsAanwezig + nieuweCodes.Count} themadoelen krijgen, en een thema " +
                $"kan er hoogstens {Thema.MaxThemadoelen} hebben. {overgeslagen} " +
                "Alles wat dit thema aan themadoelen heeft, komt uit dit bestand: haal in de kolom Themadoelen " +
                $"codes weg tot er {Thema.MaxThemadoelen} overblijven.");
        }

        var behouden = reedsAanwezig == 1
            ? "1 themadoel dat er al staat"
            : $"{reedsAanwezig} themadoelen die er al staan";
        var inkomend = nieuweCodes.Count == 1
            ? "1 nieuwe code"
            : $"{nieuweCodes.Count} nieuwe codes";

        // "waar iemand zelf al over beslist heeft" rather than "aanvaard": IsMenselijkeBeslissing also covers
        // geweigerd, and a geweigerd link occupies a slot just as much.
        var bezet = bezetDoorBeslissing == 1
            ? "1 plaats is bezet door een koppeling waar iemand zelf al over beslist heeft, en die kan dit " +
              "bestand niet vrijmaken"
            : $"{bezetDoorBeslissing} plaatsen zijn bezet door koppelingen waar iemand zelf al over beslist " +
              "heeft, en die kan dit bestand niet vrijmaken";

        // Named only when it exists, and after the preserved decisions, because it is the cheap lever: no
        // opt-in, no other thema touched.
        var viaBestand = bezetDoorBestand == 0
            ? string.Empty
            : " Wat er nog bezet is, komt uit dit bestand zelf: daar volstaat het een code uit de kolom " +
              "Themadoelen weg te halen.";

        return (
            toeTeVoegen,
            $"Thema '{themaNaam}' houdt {behouden}, en dit bestand brengt {inkomend} aan. Samen is dat meer " +
            $"dan de {Thema.MaxThemadoelen} themadoelen die een thema kan hebben. {overgeslagen} {bezet}. " +
            "Wil je die toch vrijgeven, duid dan bij het doorvoeren aan dat koppelingen die niet meer in het " +
            "bestand staan mogen verdwijnen, en zorg dat die codes niet in de kolom Themadoelen staan. Die " +
            $"keuze geldt voor het hele bestand, ook bij andere thema's en subthema's.{viaBestand}");
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
                var subdoel = subthema.VoegSubdoelToe(subthema.Leeftijd, new DoelKoppeling(code, IngelezenKoppelingStatus));
                _context.Subdoelen.Add(subdoel);
            }
        }
    }

    /// <summary>
    /// The status a goal link gets when it arrives through the school's <b>own</b> Excel (E1-18, owner ruling
    /// 2026-08-04: <i>"de school kan besliste koppelingen importeren"</i>).
    /// </summary>
    /// <remarks>
    /// <para>
    /// It used to be <see cref="KoppelingStatus.Voorgesteld"/>, and that was the defect E1-18 was filed for:
    /// dekking counts only <c>Aanvaard</c>/<c>Manueel</c> (Art. V.1), and <b>no operation anywhere in the
    /// product could move a themadoel out of <c>Voorgesteld</c></b>, so every thema a school imported
    /// contributed nothing to its coverage, permanently and with nothing on screen explaining why.
    /// </para>
    /// <para>
    /// <b><see cref="KoppelingStatus.Manueel"/> rather than <c>Aanvaard</c>, deliberately.</b> <c>Aanvaard</c>
    /// means a teacher accepted an <i>AI suggestion</i> (Art. IV.2); nothing was suggested here. The file is
    /// the school's own content, so the link is the school's own, which is exactly what <c>Manueel</c> records.
    /// Both count identically for dekking, so this is about the story the status tells, not about the number.
    /// </para>
    /// <para>
    /// <b>The consequence to know about, because it changes re-import behaviour.</b> <c>Manueel</c> is a human
    /// decision by <see cref="IsMenselijkeBeslissing"/>, so an imported link that later disappears from the
    /// file is now <i>preserved</i> and reported as bedreigd rather than dropped, and removing it takes the
    /// explicit opt-in E1-13 built. That follows from the ruling rather than sitting beside it: if the school
    /// decided a link, the tool does not un-decide it because a later spreadsheet forgot it.
    /// </para>
    /// <para>
    /// <b>No data migration ships with this.</b> There is no deployed environment (E7-11 is the deployment
    /// gate), so the only rows that carry the old value are demo and test data. A school that has already
    /// imported into a real database would need its existing <c>Voorgesteld</c> themadoelen and subdoelen
    /// moved over; that is a one-statement update, and it is deliberately not written blind here.
    /// </para>
    /// </remarks>
    private const KoppelingStatus IngelezenKoppelingStatus = KoppelingStatus.Manueel;

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

    /// <param name="leeftijd">
    /// The RESOLVED age, not <c>rij.SubthemaLeeftijd</c>. The row's own value may have come from the klas column
    /// instead (see <c>LeeftijdVoor</c>), and passing the raw one here would store the unresolved text.
    /// </param>
    private Subthema MaakSubthema(Thema thema, SchoolcontentRij rij, string leeftijd, bool toepassen, out Subthema? nieuw)
    {
        if (!toepassen)
        {
            // Preview: build a detached instance purely so the activiteit walk has a parent to read from.
            var voorbeeld = new Thema(thema.Naam, thema.DuurWeken).VoegSubthemaToe(
                rij.SubthemaNaam, rij.SubthemaDuurWeken, leeftijd);
            VoegOnderzoeksvraagToeVanuitRij(voorbeeld, rij);
            nieuw = null;
            return voorbeeld;
        }

        var subthema = thema.VoegSubthemaToe(rij.SubthemaNaam, rij.SubthemaDuurWeken, leeftijd);
        VoegOnderzoeksvraagToeVanuitRij(subthema, rij);
        nieuw = subthema;
        return subthema;
    }

    /// <summary>
    /// Adds an onderzoeksvraag from an import row if the row carries a non-blank vraag text and the
    /// subthema does not already have an onderzoeksvraag with the same vraag text (idempotent
    /// reconciliation, matching the subdoel/activiteit pattern).
    /// </summary>
    private static void VoegOnderzoeksvraagToeVanuitRij(Subthema subthema, SchoolcontentRij rij)
    {
        var vraag = Genormaliseerd(rij.SubthemaOnderzoeksvraag);
        if (vraag is null)
        {
            return;
        }

        // Idempotent: only add if no onderzoeksvraag with this exact vraag text already exists.
        if (!subthema.Onderzoeksvragen.Any(v => string.Equals(v.Vraag, vraag, StringComparison.Ordinal)))
        {
            subthema.VoegOnderzoeksvraagToe(vraag, Genormaliseerd(rij.SubthemaProbleemstelling));
        }
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
        var vraag = Genormaliseerd(rij.SubthemaOnderzoeksvraag);
        var probleemstelling = Genormaliseerd(rij.SubthemaProbleemstelling);

        // Changed if duration changed OR if the row carries an onderzoeksvraag the subthema does not have yet.
        var nieuwOv = vraag is not null &&
            !subthema.Onderzoeksvragen.Any(v => string.Equals(v.Vraag, vraag, StringComparison.Ordinal));

        var gewijzigd = subthema.DuurWeken != rij.SubthemaDuurWeken || nieuwOv;

        if (gewijzigd && toepassen)
        {
            subthema.WerkBasisGegevensBij(rij.SubthemaDuurWeken);
            if (nieuwOv)
            {
                subthema.VoegOnderzoeksvraagToe(vraag!, probleemstelling);
            }
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
    /// <summary>
    /// The age a row is scoped to: its own leeftijd column when that already holds a jaar/fase code, and otherwise
    /// the one its named klas teaches. <c>null</c> when neither can answer.
    /// <para>
    /// <b>The fallback exists because the leeftijd column was free text until 2026-08-30</b> and real files hold
    /// values like "5-6" and "8-9". Those cannot scope anything now, but the klas beside them can: a class records
    /// one jaar/fase, and a row saying "K3 groen" says K3 as clearly as the age column was meant to. The fallback
    /// refuses when the class teaches more than one age, because picking one of several would be a guess, and
    /// guessing which age a school's content is for is exactly the mistake this column exists to prevent.
    /// </para>
    /// </summary>
    private static string? LeeftijdVoor(SchoolcontentRij rij, IReadOnlyDictionary<string, Klas> klasPerNaam)
    {
        var eigen = rij.SubthemaLeeftijd.Trim();
        if (Jaarfasen.IsBekend(eigen))
        {
            return eigen;
        }

        if (!klasPerNaam.TryGetValue(rij.SubthemaKlas.Trim(), out var klas))
        {
            return null;
        }

        var codes = Jaarfasen.VoorKlas(klas.Leerjaar, klas.Jaarfase);
        return codes is { Count: 1 } ? codes[0] : null;
    }

    private readonly record struct SubthemaSleutel(string Naam, string Leeftijd);
}
