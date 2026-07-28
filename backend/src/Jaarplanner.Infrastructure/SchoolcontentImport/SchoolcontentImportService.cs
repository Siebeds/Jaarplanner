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
                opmerkingen: ["Geen geldige rijen ingelezen — niets geïmporteerd (bestand mogelijk leeg, onvolledig of verkeerd)."]);
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

        var diff = await VerwerkAsync(parseResultaat, opties, klasPerNaam, bestaandeThemaPerNaam, toepassen, cancellationToken);

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

                ReconcileThemadoelen(doelThema, themaGroep, opties, toepassen, bedreigd);
            }

            // On a brand-new thema, themadoelen come straight from the file (no existing decisions to protect).
            if (!bestaat)
            {
                foreach (var code in VerzamelThemadoelCodes(themaGroep))
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
                toepassen,
                subthemaWijzigingen,
                activiteitWijzigingen,
                bedreigd,
                opmerkingen);
        }

        await Task.CompletedTask;

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
                opmerkingen.Add(
                    $"Subthema '{sleutel.Naam}' verwijst naar onbekende klas '{sleutel.Klas}' — overgeslagen " +
                    "(een subthema is klas-gebonden, Art. IX.2).");
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
                    foreach (var code in VerzamelSubdoelCodes(subthemaGroep))
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

                ReconcileSubdoelen(doelSubthema, subthemaGroep, opties, toepassen, bedreigd);
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
        bool toepassen,
        List<BedreigdeBeslissing> bedreigd)
    {
        var inkomendeCodes = VerzamelThemadoelCodes(themaGroep);
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

        // Newly suggested codes (respecting the 2–3 upper bound enforced by the domain).
        foreach (var code in inkomendeCodes)
        {
            if (bestaandeCodes.Contains(code) || thema.Themadoelen.Count >= Thema.MaxThemadoelen)
            {
                continue;
            }

            if (toepassen)
            {
                var themadoel = thema.VoegThemadoelToe(new DoelKoppeling(code, KoppelingStatus.Voorgesteld));
                _context.Themadoelen.Add(themadoel);
            }
        }
    }

    /// <summary>Subdoel-link analogue of <see cref="ReconcileThemadoelen"/>.</summary>
    private void ReconcileSubdoelen(
        Subthema subthema,
        IEnumerable<SchoolcontentRij> subthemaGroep,
        SchoolcontentImportOpties opties,
        bool toepassen,
        List<BedreigdeBeslissing> bedreigd)
    {
        var inkomendeCodes = VerzamelSubdoelCodes(subthemaGroep);
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

    private static IReadOnlyList<string> VerzamelThemadoelCodes(IEnumerable<SchoolcontentRij> rijen) =>
        rijen
            .SelectMany(r => r.Themadoelen)
            .Select(c => c.Trim())
            .Where(c => c.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

    private static IReadOnlyList<string> VerzamelSubdoelCodes(IEnumerable<SchoolcontentRij> rijen) =>
        rijen
            .SelectMany(r => r.Subdoelen)
            .Select(c => c.Trim())
            .Where(c => c.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToList();

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
