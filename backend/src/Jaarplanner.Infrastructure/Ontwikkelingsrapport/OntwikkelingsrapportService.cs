using Jaarplanner.Application.Ai;
using Jaarplanner.Application.Ontwikkelingsrapport;
using Jaarplanner.Application.Schoolcontent.Beheer;
using Jaarplanner.Domain.Ontwikkelingsrapport;
using Jaarplanner.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;
// The type shares its name with its namespace (Art. IX.4 names it); this namespace of that name would shadow it here.
using Rapportentiteit = Jaarplanner.Domain.Ontwikkelingsrapport.Ontwikkelingsrapport;

namespace Jaarplanner.Infrastructure.Ontwikkelingsrapport;

/// <summary>
/// The ontwikkelingsrapport of one child at one moment (FB-003), over EF Core.
/// <para>
/// <b>Every rapportdoel of the set is on every report</b> (D2): the read starts from the set, as
/// <see cref="IRapportsetService"/> serves it with its D11 and D12 filter on the subdoelen, and fills in what the child's
/// report holds. A rapportdoel added later is therefore on the report with nothing filled in, for the moments before it
/// too.
/// </para>
/// <para>
/// <b>It logs nothing</b>, as <see cref="LeerlingBeheerService"/>: every outcome is a status code the request log records,
/// and the sentences it throws name no child and quote no text (ADR-0035 §3.8).
/// </para>
/// </summary>
public sealed class OntwikkelingsrapportService : IOntwikkelingsrapportService
{
    /// <summary>
    /// No rapportdoel has this id. Usually deleted after the screen loaded, but the lookup does not prove that one
    /// existed, so the sentence does not say so either (the E5-03 rule).
    /// </summary>
    internal const string RapportdoelNietGevonden = "Dit rapportdoel is niet gevonden. Vernieuw de pagina.";

    /// <summary>No star of the scale has this id; as above, the sentence claims no more than the lookup proves.</summary>
    internal const string OnbekendeGradatie = "Deze ster is niet gevonden in de sterrenschaal. Vernieuw de pagina en kies opnieuw.";

    /// <summary>There is nothing to rewrite: the AI reworks a text the teacher wrote, it never writes one (FB-004).</summary>
    internal const string GeenTekstOmTeHerschrijven = "Typ eerst zelf een tekst. Daarna kan de AI ze herwerken.";

    /// <summary>
    /// The seal of a rejected proposal is not this server's, or not this field's, or too old (D13). The sentence says
    /// only what all three have in common, since the server cannot tell the teacher which one it was, and the way out is
    /// the same for each.
    /// </summary>
    internal const string ZegelKloptNiet = "Dit voorstel geldt niet meer. Vraag een nieuw voorstel.";

    private readonly AppDbContext _db;
    private readonly IRapportsetService _rapportset;
    private readonly IAiClient _ai;
    private readonly IHerschrijfZegel _zegel;

    public OntwikkelingsrapportService(
        AppDbContext db,
        IRapportsetService rapportset,
        IAiClient ai,
        IHerschrijfZegel zegel)
    {
        _db = db;
        _rapportset = rapportset;
        _ai = ai;
        _zegel = zegel;
    }

    public async Task<RapportWeergave> HaalRapportOpAsync(
        Guid leerlingId,
        int moment,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        var kind = await (
                from leerling in _db.Leerlingen.AsNoTracking()
                where leerling.Id == leerlingId
                join klas in _db.Klassen on leerling.KlasId equals klas.Id
                join schooljaar in _db.Schooljaren on klas.SchooljaarId equals schooljaar.Id
                select new { leerling.Id, leerling.KlasId, leerling.Voornaam, leerling.Achternaam, KlasNaam = klas.Naam, SchooljaarNaam = schooljaar.Naam })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(LeerlingBeheerService.KindBestaatNiet);

        var rapportdoelen = await _rapportset.HaalRapportdoelenOpAsync(cancellationToken);
        var rapport = await _db.Ontwikkelingsrapporten
            .AsNoTracking()
            .Include(r => r.Beoordelingen)
            .SingleOrDefaultAsync(r => r.LeerlingId == leerlingId && r.Moment == moment1tot3, cancellationToken);
        var perRapportdoel = (rapport?.Beoordelingen ?? []).ToDictionary(b => b.RapportdoelId);

        // Only the drawing's version and size: its bytes stay in their own table until the screen asks for them (D15).
        var tekening = rapport is null
            ? null
            : await _db.Kindtekeningen
                .AsNoTracking()
                .Where(t => t.OntwikkelingsrapportId == rapport.Id)
                .Select(t => new TekeningWeergave(t.Versie, t.Breedte, t.Hoogte))
                .SingleOrDefaultAsync(cancellationToken);

        return new RapportWeergave(
            kind.Id,
            kind.KlasId,
            kind.Voornaam,
            kind.Achternaam,
            kind.KlasNaam,
            kind.SchooljaarNaam,
            moment1tot3,
            rapportdoelen
                .Select(rapportdoel =>
                {
                    var beoordeling = perRapportdoel.GetValueOrDefault(rapportdoel.Id);
                    return new RapportdoelBeoordelingWeergave(
                        rapportdoel.Id,
                        rapportdoel.Titel,
                        rapportdoel.Subdoelen,
                        beoordeling?.GradatieId,
                        beoordeling?.Tekst,
                        beoordeling?.TekstStatus);
                })
                .ToList(),
            rapport?.Besluit,
            rapport?.BesluitStatus,
            tekening);
    }

    public async Task<BeoordelingWeergave> BewaarBeoordelingAsync(
        Guid leerlingId,
        int moment,
        Guid rapportdoelId,
        BeoordelingInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        await VereisKindAsync(leerlingId, cancellationToken);

        if (!await _db.Rapportdoelen.AnyAsync(r => r.Id == rapportdoelId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout(RapportdoelNietGevonden);
        }

        var gradatieId = invoer?.GradatieId;
        if (gradatieId is { } gekozen && !await _db.Gradaties.AnyAsync(g => g.Id == gekozen, cancellationToken))
        {
            throw new SchoolcontentValidatieFout(OnbekendeGradatie);
        }

        var tekst = KeurTekst(invoer?.Tekst, Rapportentiteit.MaxTekstLengte, "Een tekst");
        var herkomst = Herkomst(new Herschrijfdoel(leerlingId, moment1tot3, rapportdoelId), tekst, invoer?.Herschrijving);

        var rij = await SchrijfAsync(
            leerlingId,
            moment1tot3,
            rapport => rapport.ZetBeoordeling(rapportdoelId, gradatieId, tekst, herkomst),
            cancellationToken);

        return new BeoordelingWeergave(rapportdoelId, rij?.GradatieId, rij?.Tekst, rij?.TekstStatus);
    }

    public async Task<BesluitWeergave> BewaarBesluitAsync(
        Guid leerlingId,
        int moment,
        BesluitInvoer invoer,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        await VereisKindAsync(leerlingId, cancellationToken);
        var tekst = KeurTekst(invoer?.Tekst, Rapportentiteit.MaxBesluitLengte, "Een algemeen besluit");
        var herkomst = Herkomst(new Herschrijfdoel(leerlingId, moment1tot3, null), tekst, invoer?.Herschrijving);

        var rapport = await SchrijfAsync(
            leerlingId,
            moment1tot3,
            rapport =>
            {
                rapport.ZetBesluit(tekst, herkomst);
                return rapport;
            },
            cancellationToken);

        return new BesluitWeergave(rapport.Besluit, rapport.BesluitStatus);
    }

    public async Task<HerschrijfResultaat> StelHerschrijvingVoorAsync(
        Guid leerlingId,
        int moment,
        Guid? rapportdoelId,
        string? tekst,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        var klasId = await _db.Leerlingen
            .AsNoTracking()
            .Where(leerling => leerling.Id == leerlingId)
            .Select(leerling => (Guid?)leerling.KlasId)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new SchoolcontentNietGevondenFout(LeerlingBeheerService.KindBestaatNiet);

        if (rapportdoelId is { } doelId && !await _db.Rapportdoelen.AnyAsync(r => r.Id == doelId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout(RapportdoelNietGevonden);
        }

        // The besluit and a rapportdoel's text have their own limits, and the answer is held to the same one: a rewrite
        // the field cannot take is no proposal.
        var max = rapportdoelId is null ? Rapportentiteit.MaxBesluitLengte : Rapportentiteit.MaxTekstLengte;
        var bron = KeurTekst(tekst, max, rapportdoelId is null ? "Een algemeen besluit" : "Een tekst")
            ?? throw new SchoolcontentValidatieFout(GeenTekstOmTeHerschrijven);

        // Every child of the klas, not only this one (R21): a text about one child often names another.
        var namen = await _db.Leerlingen
            .AsNoTracking()
            .Where(leerling => leerling.KlasId == klasId)
            .Select(leerling => new { leerling.Voornaam, leerling.Achternaam })
            .ToListAsync(cancellationToken);
        var masker = Naamvervanging.Maskeer(bron, namen.SelectMany(kind => new[] { kind.Voornaam, kind.Achternaam }));

        AiCompletion antwoord;
        try
        {
            antwoord = await _ai.CompleteAsync(HerschrijfPromptBuilder.Bouw(masker.Tekst), cancellationToken);
        }
        catch (OperationCanceledException)
        {
            // The teacher navigated away or the request was cut off: not a failure to report to her.
            throw;
        }
        catch (Exception fout)
        {
            // Caught as a whole, and the diagnostic names the type and nothing else. A message from an AI call can carry
            // a piece of the request or the answer, and both are pupil data that may never reach a log or a response
            // body (ADR-0035 §3.8). Not configured, unreachable, refusing and malformed all land here, and all mean the
            // same to the teacher: no proposal, her own text untouched.
            return HerschrijfResultaat.Mislukt(
                Herschrijfmislukking.AiOnbereikbaar,
                $"The AI client failed with {fout.GetType().Name}.");
        }

        var parse = HerschrijfResponseParser.Parse(antwoord, max);
        if (!parse.IsGeldig)
        {
            return HerschrijfResultaat.Mislukt(Herschrijfmislukking.OnbruikbaarAntwoord, parse.Fout!);
        }

        if (!Naamvervanging.HeeftPreciesDeze(parse.Tekst!, masker.Plaatshouders))
        {
            // A dropped placeholder loses a child's name from the text; an invented one would put a name where the
            // teacher wrote none. Either refuses the answer as a whole (Art. IV.5).
            return HerschrijfResultaat.Mislukt(
                Herschrijfmislukking.OnbruikbaarAntwoord,
                "The rewritten text does not carry exactly the name placeholders it was sent.");
        }

        // Putting the names back can make the text longer than the placeholders were, so the limit is checked again on
        // what the teacher would actually be offered to save.
        var voorstel = Naamvervanging.Herstel(parse.Tekst!, masker.Plaatshouders);
        if (voorstel.Length > max)
        {
            return HerschrijfResultaat.Mislukt(
                Herschrijfmislukking.OnbruikbaarAntwoord,
                $"With the names put back, the rewritten text is longer than the {max} characters the field takes.");
        }

        var doel = new Herschrijfdoel(leerlingId, moment1tot3, rapportdoelId);
        return HerschrijfResultaat.Geslaagd(voorstel, _zegel.Onderteken(doel, bron, voorstel));
    }

    public async Task WeigerHerschrijvingAsync(
        Guid leerlingId,
        int moment,
        Guid? rapportdoelId,
        string? zegel,
        CancellationToken cancellationToken = default)
    {
        var moment1tot3 = KeurMoment(moment);
        await VereisKindAsync(leerlingId, cancellationToken);
        var doel = new Herschrijfdoel(leerlingId, moment1tot3, rapportdoelId);

        // Loaded rather than made: a rejection is never a first write. An empty report may not be created for a mark's
        // sake, and the stored text is also what the seal is held against.
        var rapport = await _db.Ontwikkelingsrapporten
            .Include(r => r.Beoordelingen)
            .SingleOrDefaultAsync(r => r.LeerlingId == leerlingId && r.Moment == moment1tot3, cancellationToken);

        var huidigeTekst = rapportdoelId is { } doelId
            ? rapport?.Beoordelingen.FirstOrDefault(b => b.RapportdoelId == doelId)?.Tekst
            : rapport?.Besluit;

        // One question, two things it settles. The seal must be this server's word for this field and still valid, and
        // it must have been made for the text that stands there now. A text that moved on under her, because she kept
        // typing or a co-teacher wrote over it, takes the mark's meaning with it: marking what stands there now would
        // say a proposal was rejected for a text nobody ever proposed one for. She is told, rather than left with a
        // decision that quietly went nowhere.
        if (!_zegel.DektBrontekst(doel, huidigeTekst, zegel))
        {
            throw new SchoolcontentValidatieFout(ZegelKloptNiet);
        }

        if (rapportdoelId is { } id)
        {
            rapport!.WeigerHerschrijving(id);
        }
        else
        {
            rapport!.WeigerBesluitHerschrijving();
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Who wrote the text that is about to be stored (D13). <see cref="Tekststatus.Aanvaard"/> only when the server
    /// recognises its own seal over exactly this text, so an edited proposal, a stale seal and a made-up one are all
    /// <see cref="Tekststatus.Manueel"/>, which is what a text the teacher shaped is.
    /// </summary>
    private Tekststatus Herkomst(Herschrijfdoel doel, string? tekst, string? zegel) =>
        _zegel.DektVoorstel(doel, tekst, zegel) ? Tekststatus.Aanvaard : Tekststatus.Manueel;

    /// <summary>
    /// Applies <paramref name="wijziging"/> to the child's report at the moment, making the report on the first write.
    /// <para>
    /// <b>Two first writes at once</b> (two co-teachers, or one teacher's star and text a moment apart) both find no
    /// report and both make one; the unique index on (leerling, moment) refuses the second. Two first writes of the same
    /// rapportdoel on an existing report collide the same way on the pair key of <c>rapportbeoordelingen</c>. The refused
    /// one is then applied again, once, to what the first wrote, so no teacher sees an error and the later write wins.
    /// </para>
    /// </summary>
    private async Task<T> SchrijfAsync<T>(
        Guid leerlingId,
        int moment,
        Func<Rapportentiteit, T> wijziging,
        CancellationToken cancellationToken)
    {
        try
        {
            return await SchrijfEenmaalAsync(leerlingId, moment, wijziging, cancellationToken);
        }
        catch (DbUpdateException fout) when (fout.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            TableName: "ontwikkelingsrapporten" or "rapportbeoordelingen",
        })
        {
            _db.ChangeTracker.Clear();
            return await SchrijfEenmaalAsync(leerlingId, moment, wijziging, cancellationToken);
        }
    }

    private async Task<T> SchrijfEenmaalAsync<T>(
        Guid leerlingId,
        int moment,
        Func<Rapportentiteit, T> wijziging,
        CancellationToken cancellationToken)
    {
        var rapport = await _db.Ontwikkelingsrapporten
            .Include(r => r.Beoordelingen)
            .SingleOrDefaultAsync(r => r.LeerlingId == leerlingId && r.Moment == moment, cancellationToken);

        if (rapport is null)
        {
            rapport = new Rapportentiteit(leerlingId, moment);
            _db.Ontwikkelingsrapporten.Add(rapport);
        }

        var resultaat = wijziging(rapport);
        await _db.SaveChangesAsync(cancellationToken);
        return resultaat;
    }

    /// <summary>
    /// The route holds the moment to 1..3 already; this is for a caller that is not the route, in the same words as the
    /// 404 a route answers for any other number. <see cref="KindtekeningService"/> uses it too.
    /// </summary>
    internal static int KeurMoment(int moment) =>
        Evaluatiemoment.IsGeldig(moment)
            ? moment
            : throw new SchoolcontentNietGevondenFout("Dit rapport bestaat niet. Kies Rapport 1, 2 of 3.");

    /// <summary>The trimmed text, null for blank, or the teacher's sentence when it is too long. The limit is the domain's.</summary>
    private static string? KeurTekst(string? tekst, int max, string wat)
    {
        if (string.IsNullOrWhiteSpace(tekst))
        {
            return null;
        }

        var getrimd = tekst.Trim();
        return getrimd.Length <= max
            ? getrimd
            : throw new SchoolcontentValidatieFout($"{wat} is hoogstens {max} tekens lang.");
    }

    /// <summary>
    /// The child must still exist. The route's rights lookup already answered 404 for one that did not; this closes the
    /// gap to a delete in between, which the report's foreign key would otherwise turn into a 500.
    /// </summary>
    private async Task VereisKindAsync(Guid leerlingId, CancellationToken cancellationToken)
    {
        if (!await _db.Leerlingen.AnyAsync(l => l.Id == leerlingId, cancellationToken))
        {
            throw new SchoolcontentNietGevondenFout(LeerlingBeheerService.KindBestaatNiet);
        }
    }
}
