using System.Globalization;
using Jaarplanner.Application.Toegang;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// Who asks the cat, and what she may read: her rights, and the klassen whose planning she may read in the schooljaar
/// she is looking at (ADR-0040). The Api computes the klassen through the same policy every planning screen uses.
/// </summary>
public sealed record Katlezer(Rechten Rechten, IReadOnlyList<Chatklas> Klassen);

/// <summary>
/// Runs one <see cref="Katopzoeking"/> over the tool's own data (FB-031, ADR-0066), and shows the gebruiker only what
/// the screens would (Art. VI.1):
/// <list type="bullet">
/// <item>thema's, subthema's, subdoelen and shared activiteiten are the school's, and everyone reads them;</item>
/// <item>an own activiteit only its owner, the leerkrachten and hoofdleerkrachten of its leeftijd, and an admin
/// (ADR-0049 D3); where it is planned in a klas she may read, the agenda shows it, because the agenda is the klas's;</item>
/// <item>an algemene fiche and the agenda only of a klas in <see cref="Katlezer.Klassen"/>.</item>
/// </list>
/// A decided link (<c>aanvaard</c>, <c>manueel</c>) is a place; a <c>voorgesteld</c> one is named apart; a rejected one is
/// never named. The ontwikkelingsrapport is not in the source at all.
/// </summary>
public sealed class Katopzoeker
{
    /// <summary>At most this many candidates are offered when a term fits several.</summary>
    public const int MaxKandidaten = 8;

    private readonly IKatopzoekbron _bron;

    public Katopzoeker(IKatopzoekbron bron) => _bron = bron;

    public async Task<Katantwoord> ZoekOpAsync(Katopzoeking opzoeking, Katlezer lezer, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(opzoeking);
        ArgumentNullException.ThrowIfNull(lezer);

        if (!opzoeking.IsVolledig)
        {
            return Katantwoord.Van(Katantwoordsoort.Mislukt);
        }

        var inhoud = new Zicht(await _bron.HaalBibliotheekAsync(cancellationToken), lezer);
        return opzoeking.Vraag switch
        {
            Katvraag.DoelInThema => await DoelInThemaAsync(opzoeking, inhoud, cancellationToken),
            Katvraag.WaarGebruikt => await WaarGebruiktAsync(opzoeking, inhoud, lezer, cancellationToken),
            Katvraag.DoelenVanThema => await DoelenVanThemaAsync(opzoeking, inhoud, cancellationToken),
            Katvraag.ActiviteitInSubthema => ActiviteitInSubthema(opzoeking, inhoud),
            Katvraag.SubthemaVanActiviteit => SubthemaVanActiviteit(opzoeking, inhoud),
            Katvraag.DoelenVanSubthema => await DoelenVanSubthemaAsync(opzoeking, inhoud, cancellationToken),
            _ => Katantwoord.Van(Katantwoordsoort.Mislukt),
        };
    }

    private async Task<Katantwoord> DoelInThemaAsync(Katopzoeking opzoeking, Zicht inhoud, CancellationToken cancellationToken)
    {
        var doel = await VindDoelAsync(opzoeking, cancellationToken);
        if (doel.Antwoord is { } doelAntwoord)
        {
            return doelAntwoord;
        }

        var thema = VindEen(opzoeking, Katonderwerp.Thema, opzoeking.Thema!, inhoud.Themas, t => t.Id, t => t.Naam, _ => null);
        if (thema.Antwoord is { } themaAntwoord)
        {
            return themaAntwoord;
        }

        var (plekken, voorstellen) = inhoud.PlekkenVan(doel.Waarde!, t => t.Id == thema.Waarde!.Id);
        return new Katantwoord
        {
            Soort = Katantwoordsoort.DoelInThema,
            Opzoeking = opzoeking,
            Doel = doel.Waarde,
            Thema = new Katnaam(thema.Waarde!.Id, thema.Waarde.Naam),
            Ja = plekken.Count > 0,
            Plekken = plekken,
            Voorstellen = voorstellen,
        };
    }

    private async Task<Katantwoord> WaarGebruiktAsync(
        Katopzoeking opzoeking,
        Zicht inhoud,
        Katlezer lezer,
        CancellationToken cancellationToken)
    {
        var doel = await VindDoelAsync(opzoeking, cancellationToken);
        if (doel.Antwoord is { } doelAntwoord)
        {
            return doelAntwoord;
        }

        var (plekken, voorstellen) = inhoud.PlekkenVan(doel.Waarde!, _ => true);
        plekken.AddRange(inhoud.FicheplekkenVan(doel.Waarde!));

        var agenda = lezer.Klassen.Count == 0
            ? Katagenda.Leeg
            : await _bron.HaalAgendaAsync(lezer.Klassen.Select(k => k.Id).ToList(), cancellationToken);
        var agendaplekken = inhoud.AgendaplekkenVan(doel.Waarde!, agenda);

        return new Katantwoord
        {
            Soort = Katantwoordsoort.WaarGebruikt,
            Opzoeking = opzoeking,
            Doel = doel.Waarde,
            Plekken = plekken,
            Voorstellen = voorstellen,
            Agenda = agendaplekken.Take(Katantwoord.MaxAgendaplekken).ToList(),
            AgendaTotaal = agendaplekken.Count,
        };
    }

    private async Task<Katantwoord> DoelenVanThemaAsync(Katopzoeking opzoeking, Zicht inhoud, CancellationToken cancellationToken)
    {
        var thema = VindEen(opzoeking, Katonderwerp.Thema, opzoeking.Thema!, inhoud.Themas, t => t.Id, t => t.Naam, _ => null);
        if (thema.Antwoord is { } themaAntwoord)
        {
            return themaAntwoord;
        }

        var (plekken, voorstellen) = await MetTekstAsync(inhoud.DoelplekkenVan(thema.Waarde!.Id, null), cancellationToken);
        return new Katantwoord
        {
            Soort = Katantwoordsoort.DoelenVanThema,
            Opzoeking = opzoeking,
            Thema = new Katnaam(thema.Waarde!.Id, thema.Waarde.Naam),
            Plekken = plekken,
            Voorstellen = voorstellen,
        };
    }

    /// <summary>
    /// The subdoelen of the subthema a term names. Several subthema's with that very name are one subthema at different
    /// leeftijden or in different thema's, and the answer names the goals of each, with its leeftijd; several names ask
    /// which one.
    /// </summary>
    private async Task<Katantwoord> DoelenVanSubthemaAsync(Katopzoeking opzoeking, Zicht inhoud, CancellationToken cancellationToken)
    {
        var subthemas = Naamzoeker.Vind(opzoeking.Subthema!, inhoud.Subthemas, s => s.Id, s => s.Naam);
        if (subthemas.Count == 0)
        {
            return NietGevonden(opzoeking, Katonderwerp.Subthema, opzoeking.Subthema!);
        }

        if (subthemas.Select(s => Naamzoeker.Normaal(s.Naam)).Distinct(StringComparer.Ordinal).Count() > 1)
        {
            return Kies(opzoeking, Katonderwerp.Subthema, opzoeking.Subthema!, subthemas
                .Select(s => new Katkandidaat(s.Naam, s.Naam, inhoud.ThemaVan(s)?.Naam))
                .DistinctBy(k => Naamzoeker.Normaal(k.Label)));
        }

        var ids = subthemas.Select(s => s.Id).ToHashSet();
        var (plekken, voorstellen) = await MetTekstAsync(inhoud.DoelplekkenVan(null, ids), cancellationToken);
        return new Katantwoord
        {
            Soort = Katantwoordsoort.DoelenVanSubthema,
            Opzoeking = opzoeking,
            Subthema = subthemas[0].Naam,
            Plekken = plekken,
            Voorstellen = voorstellen,
        };
    }

    // The goals' texts from the catalogue. A link whose goal left the catalogue keeps its code, with the text the
    // catalogue no longer has.
    private async Task<(List<Katplek> Plekken, List<Katplek> Voorstellen)> MetTekstAsync(
        (List<Katplek> Plekken, List<Katplek> Voorstellen) gevonden,
        CancellationToken cancellationToken)
    {
        var codes = gevonden.Plekken.Concat(gevonden.Voorstellen).Select(p => p.Doel!.Code).Distinct(StringComparer.Ordinal).ToList();
        var doelen = (await _bron.HaalDoelenAsync(codes, cancellationToken))
            .ToDictionary(d => d.Code, StringComparer.Ordinal);

        Katplek MetTekst(Katplek plek) =>
            doelen.TryGetValue(plek.Doel!.Code, out var doel) ? plek with { Doel = doel } : plek;

        return (gevonden.Plekken.Select(MetTekst).ToList(), gevonden.Voorstellen.Select(MetTekst).ToList());
    }

    private static Katantwoord ActiviteitInSubthema(Katopzoeking opzoeking, Zicht inhoud)
    {
        var activiteit = VindActiviteit(opzoeking, inhoud);
        if (activiteit.Antwoord is { } activiteitAntwoord)
        {
            return activiteitAntwoord;
        }

        var subthemas = Naamzoeker.Vind(opzoeking.Subthema!, inhoud.Subthemas, s => s.Id, s => s.Naam);
        if (subthemas.Count == 0)
        {
            return NietGevonden(opzoeking, Katonderwerp.Subthema, opzoeking.Subthema!);
        }

        // Several subthema's with the name she typed are that one subthema at different leeftijden or in different
        // thema's: a teacher names a subthema by its name, so any of them answers yes.
        var namen = subthemas.Select(s => Naamzoeker.Normaal(s.Naam)).Distinct(StringComparer.Ordinal).ToList();
        if (namen.Count > 1)
        {
            return Kies(opzoeking, Katonderwerp.Subthema, opzoeking.Subthema!, subthemas
                .Select(s => new Katkandidaat(s.Naam, s.Naam, inhoud.ThemaVan(s)?.Naam))
                .DistinctBy(k => Naamzoeker.Normaal(k.Label)));
        }

        var ids = subthemas.Select(s => s.Id).ToHashSet();
        var activiteiten = activiteit.Waarde!;
        return new Katantwoord
        {
            Soort = Katantwoordsoort.ActiviteitInSubthema,
            Opzoeking = opzoeking,
            Activiteit = new Katnaam(activiteiten[0].Id, activiteiten[0].Naam),
            Subthema = subthemas[0].Naam,
            Ja = activiteiten.Any(a => ids.Contains(a.SubthemaId)),
            Plekken = activiteiten.Select(inhoud.PlekVanActiviteit).OfType<Katplek>().ToList(),
        };
    }

    private static Katantwoord SubthemaVanActiviteit(Katopzoeking opzoeking, Zicht inhoud)
    {
        var activiteit = VindActiviteit(opzoeking, inhoud);
        if (activiteit.Antwoord is { } activiteitAntwoord)
        {
            return activiteitAntwoord;
        }

        var activiteiten = activiteit.Waarde!;
        return new Katantwoord
        {
            Soort = Katantwoordsoort.SubthemaVanActiviteit,
            Opzoeking = opzoeking,
            Activiteit = new Katnaam(activiteiten[0].Id, activiteiten[0].Naam),
            Plekken = activiteiten.Select(inhoud.PlekVanActiviteit).OfType<Katplek>().ToList(),
        };
    }

    /// <summary>
    /// The activiteiten a term names, of those she may read. Several with the very same name are one activiteit in
    /// several subthema's, and the answer names each place; several names ask which one.
    /// </summary>
    private static Vondst<List<Chatactiviteit>> VindActiviteit(Katopzoeking opzoeking, Zicht inhoud)
    {
        var term = opzoeking.Activiteit!;
        var gevonden = Naamzoeker.Vind(term, inhoud.Activiteiten, a => a.Id, a => a.Naam);
        if (gevonden.Count == 0)
        {
            return new(null, NietGevonden(opzoeking, Katonderwerp.Activiteit, term));
        }

        var namen = gevonden.Select(a => Naamzoeker.Normaal(a.Naam)).Distinct(StringComparer.Ordinal).ToList();
        if (namen.Count > 1)
        {
            return new(null, Kies(opzoeking, Katonderwerp.Activiteit, term, gevonden
                .DistinctBy(a => Naamzoeker.Normaal(a.Naam))
                .Select(a => new Katkandidaat(a.Naam, a.Naam, inhoud.SubthemaVan(a)?.Naam))));
        }

        return new(gevonden, null);
    }

    private static Vondst<T> VindEen<T>(
        Katopzoeking opzoeking,
        Katonderwerp wat,
        string term,
        IEnumerable<T> alle,
        Func<T, Guid> id,
        Func<T, string> naam,
        Func<T, string?> detail)
        where T : class
    {
        var gevonden = Naamzoeker.Vind(term, alle, id, naam);
        return gevonden.Count switch
        {
            0 => new(null, NietGevonden(opzoeking, wat, term)),
            1 => new(gevonden[0], null),
            _ => new(null, Kies(opzoeking, wat, term, gevonden.Select(g =>
                new Katkandidaat(id(g).ToString(), naam(g), detail(g))))),
        };
    }

    private async Task<Vondst<Katdoel>> VindDoelAsync(Katopzoeking opzoeking, CancellationToken cancellationToken)
    {
        var term = opzoeking.Doel!.Trim();
        var doelen = await _bron.ZoekDoelenAsync(term, MaxKandidaten + 1, cancellationToken);
        return doelen.Count switch
        {
            0 => new(null, NietGevonden(opzoeking, Katonderwerp.Doel, term)),
            1 => new(doelen[0], null),
            _ => new(null, Kies(opzoeking, Katonderwerp.Doel, term, doelen
                .Select(d => new Katkandidaat(d.Code, d.Code, Kort(d.Tekst))))),
        };
    }

    /// <summary>The longest text a candidate carries: enough to tell goals apart, short enough to read out.</summary>
    public const int MaxDetailLengte = 160;

    // A minimumdoel can run to a page of bullets; a candidate needs its first sentence or so, on one line.
    private static string Kort(string tekst)
    {
        var regel = string.Join(' ', tekst.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (regel.Length <= MaxDetailLengte)
        {
            return regel;
        }

        var knip = regel.LastIndexOf(' ', MaxDetailLengte - 1);
        return regel[..(knip > 0 ? knip : MaxDetailLengte - 1)].TrimEnd(',', ':', ';') + "…";
    }

    private static Katantwoord NietGevonden(Katopzoeking opzoeking, Katonderwerp wat, string term) =>
        new() { Soort = Katantwoordsoort.NietGevonden, Opzoeking = opzoeking, NietGevonden = new Katniets(wat, term.Trim()) };

    private static Katantwoord Kies(Katopzoeking opzoeking, Katonderwerp wat, string term, IEnumerable<Katkandidaat> kandidaten) =>
        new()
        {
            Soort = Katantwoordsoort.Kies,
            Opzoeking = opzoeking,
            Keuze = new Katkeuze(wat, term.Trim(), kandidaten.Take(MaxKandidaten).ToList()),
        };

    private sealed record Vondst<T>(T? Waarde, Katantwoord? Antwoord)
        where T : class;

    /// <summary>The content as this lezer sees it, with the lookups over it.</summary>
    private sealed class Zicht
    {
        private readonly Katlezer _lezer;
        private readonly Dictionary<Guid, Chatthema> _themas;
        private readonly Dictionary<Guid, Chatsubthema> _subthemas;
        private readonly Dictionary<Guid, Chatactiviteit> _activiteiten;
        private readonly Dictionary<Guid, Chatfiche> _fiches;
        private readonly Dictionary<Guid, string> _klassen;
        private readonly IReadOnlyList<Katkoppeling> _koppelingen;

        public Zicht(Katbibliotheek bibliotheek, Katlezer lezer)
        {
            _lezer = lezer;
            _klassen = lezer.Klassen.ToDictionary(k => k.Id, k => k.Naam);
            _themas = bibliotheek.Themas.ToDictionary(t => t.Id);
            _subthemas = bibliotheek.Subthemas.Where(s => _themas.ContainsKey(s.ThemaId)).ToDictionary(s => s.Id);
            _activiteiten = bibliotheek.Activiteiten
                .Where(a => _subthemas.TryGetValue(a.SubthemaId, out var s) && MagLezen(a, s))
                .ToDictionary(a => a.Id);
            _fiches = bibliotheek.Fiches.Where(f => _klassen.ContainsKey(f.KlasId)).ToDictionary(f => f.Id);
            AlleActiviteiten = bibliotheek.Activiteiten.ToDictionary(a => a.Id);
            _koppelingen = bibliotheek.Koppelingen;
        }

        public IEnumerable<Chatthema> Themas => _themas.Values;

        public IEnumerable<Chatsubthema> Subthemas => _subthemas.Values;

        public IEnumerable<Chatactiviteit> Activiteiten => _activiteiten.Values;

        /// <summary>Every activiteit, own ones of others included: the agenda of a klas she reads shows what it planned.</summary>
        private Dictionary<Guid, Chatactiviteit> AlleActiviteiten { get; }

        public Chatthema? ThemaVan(Chatsubthema subthema) => _themas.GetValueOrDefault(subthema.ThemaId);

        public Chatsubthema? SubthemaVan(Chatactiviteit activiteit) => _subthemas.GetValueOrDefault(activiteit.SubthemaId);

        /// <summary>
        /// Where <paramref name="doel"/> sits in the thema's <paramref name="binnen"/> accepts: as themadoel, as subdoel,
        /// in an activiteit she may read. Decided and proposed apart.
        /// </summary>
        public (List<Katplek> Plekken, List<Katplek> Voorstellen) PlekkenVan(Katdoel doel, Func<Chatthema, bool> binnen)
        {
            var plekken = new List<Katplek>();
            var voorstellen = new List<Katplek>();
            foreach (var koppeling in _koppelingen.Where(k => string.Equals(k.Code, doel.Code, StringComparison.OrdinalIgnoreCase)))
            {
                if (!koppeling.IsBeslist && !koppeling.IsVoorstel)
                {
                    continue;
                }

                var plek = PlekVan(koppeling);
                if (plek is null || !binnen(_themas[plek.ThemaId]))
                {
                    continue;
                }

                (koppeling.IsBeslist ? plekken : voorstellen).Add(plek);
            }

            return (Geordend(plekken), Geordend(voorstellen));
        }

        /// <summary>
        /// The goals of a thema (its themadoelen and the subdoelen of its subthema's) or, given
        /// <paramref name="subthemaIds"/>, the subdoelen of those subthema's; each with its code.
        /// </summary>
        public (List<Katplek> Plekken, List<Katplek> Voorstellen) DoelplekkenVan(Guid? themaId, IReadOnlySet<Guid>? subthemaIds)
        {
            var plekken = new List<Katplek>();
            var voorstellen = new List<Katplek>();
            foreach (var koppeling in _koppelingen.Where(k => k.Houder is Kathouder.Thema or Kathouder.Subthema))
            {
                if (!koppeling.IsBeslist && !koppeling.IsVoorstel)
                {
                    continue;
                }

                var hoort = subthemaIds is null
                    || (koppeling.Houder == Kathouder.Subthema && subthemaIds.Contains(koppeling.HouderId));
                var plek = hoort ? PlekVan(koppeling) : null;
                if (plek is null || (themaId is { } id && plek.ThemaId != id))
                {
                    continue;
                }

                // The text comes from the catalogue afterwards.
                plek = plek with { Doel = new Katdoel(koppeling.Code, koppeling.Doelsoort, string.Empty) };
                (koppeling.IsBeslist ? plekken : voorstellen).Add(plek);
            }

            return (Geordend(plekken), Geordend(voorstellen));
        }

        /// <summary>The algemene fiches of the klassen she reads that carry the goal. A fiche's link is never a proposal.</summary>
        public IEnumerable<Katplek> FicheplekkenVan(Katdoel doel) =>
            _koppelingen
                .Where(k => k.Houder == Kathouder.AlgemeneFiche && k.IsBeslist
                    && string.Equals(k.Code, doel.Code, StringComparison.OrdinalIgnoreCase)
                    && _fiches.ContainsKey(k.HouderId))
                .Select(k => _fiches[k.HouderId])
                .DistinctBy(f => f.Id)
                .OrderBy(f => _klassen[f.KlasId], StringComparer.CurrentCulture)
                .ThenBy(f => f.Naam, StringComparer.CurrentCulture)
                .Select(f => new Katplek(
                    Katpleksoort.AlgemeneFiche,
                    Guid.Empty,
                    string.Empty,
                    Fiche: f.Naam,
                    Klas: _klassen[f.KlasId],
                    Verwijzing: "/instellingen/algemene-fiches"));

        /// <summary>
        /// The placements in the agenda that carry the goal through a decided link: the thema whose themadoel it is, the
        /// subthema whose subdoel it is, the activiteit or the algemene fiche that works on it. Ordered by klas and date.
        /// </summary>
        public List<Katagendaplek> AgendaplekkenVan(Katdoel doel, Katagenda agenda)
        {
            var beslist = _koppelingen
                .Where(k => k.IsBeslist && string.Equals(k.Code, doel.Code, StringComparison.OrdinalIgnoreCase))
                .ToList();
            var themas = beslist.Where(k => k.Houder == Kathouder.Thema).Select(k => k.HouderId).ToHashSet();
            var subthemas = beslist.Where(k => k.Houder == Kathouder.Subthema).Select(k => k.HouderId).ToHashSet();
            var activiteiten = beslist.Where(k => k.Houder == Kathouder.Activiteit).Select(k => k.HouderId).ToHashSet();
            var fiches = beslist.Where(k => k.Houder == Kathouder.AlgemeneFiche).Select(k => k.HouderId).ToHashSet();

            var plekken = new List<Katagendaplek>();
            foreach (var p in agenda.Themas.Where(p => themas.Contains(p.ThemaId) && _klassen.ContainsKey(p.KlasId) && _themas.ContainsKey(p.ThemaId)))
            {
                plekken.Add(Agendaplek(p.KlasId, Katagendasoort.Thema, _themas[p.ThemaId].Naam, p.Van, p.Tot, p.Voorstel));
            }

            foreach (var p in agenda.Subthemas.Where(p => subthemas.Contains(p.SubthemaId) && _klassen.ContainsKey(p.KlasId) && _subthemas.ContainsKey(p.SubthemaId)))
            {
                plekken.Add(Agendaplek(p.KlasId, Katagendasoort.Subthema, _subthemas[p.SubthemaId].Naam, p.Van, p.Tot, false));
            }

            foreach (var p in agenda.Activiteiten.Where(p => activiteiten.Contains(p.ActiviteitId) && _klassen.ContainsKey(p.KlasId) && AlleActiviteiten.ContainsKey(p.ActiviteitId)))
            {
                plekken.Add(Agendaplek(p.KlasId, Katagendasoort.Activiteit, AlleActiviteiten[p.ActiviteitId].Naam, p.Datum, p.Datum, p.Voorstel));
            }

            foreach (var p in agenda.Fiches.Where(p => fiches.Contains(p.FicheId) && _klassen.ContainsKey(p.KlasId) && _fiches.ContainsKey(p.FicheId)))
            {
                plekken.Add(Agendaplek(p.KlasId, Katagendasoort.AlgemeneFiche, _fiches[p.FicheId].Naam, p.Van, p.Tot, false));
            }

            return plekken
                .OrderBy(p => p.Klas, StringComparer.CurrentCulture)
                .ThenBy(p => p.KlasId)
                .ThenBy(p => p.Van)
                .ThenBy(p => p.Soort)
                .ThenBy(p => p.Naam, StringComparer.CurrentCulture)
                .ToList();
        }

        /// <summary>Where an activiteit hangs: its subthema, leeftijd and thema.</summary>
        public Katplek? PlekVanActiviteit(Chatactiviteit activiteit)
        {
            if (SubthemaVan(activiteit) is not { } subthema || ThemaVan(subthema) is not { } thema)
            {
                return null;
            }

            return new Katplek(
                Katpleksoort.Activiteit,
                thema.Id,
                thema.Naam,
                subthema.Id,
                subthema.Naam,
                subthema.Leeftijd,
                Activiteit: activiteit.Naam,
                Verwijzing: SubthemaVerwijzing(subthema));
        }

        private Katagendaplek Agendaplek(Guid klasId, Katagendasoort soort, string naam, DateOnly van, DateOnly tot, bool voorstel) =>
            new(klasId, _klassen[klasId], soort, naam, van, tot, voorstel,
                "/agenda/dag/" + van.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));

        // The place a link sits, or null when she may not read its holder (an own activiteit of someone else's, a fiche
        // of a klas she does not read) or the holder is gone.
        private Katplek? PlekVan(Katkoppeling koppeling)
        {
            switch (koppeling.Houder)
            {
                case Kathouder.Thema when _themas.TryGetValue(koppeling.HouderId, out var thema):
                    return new Katplek(Katpleksoort.Themadoel, thema.Id, thema.Naam, Verwijzing: $"/themas/{thema.Id}");
                case Kathouder.Subthema when _subthemas.TryGetValue(koppeling.HouderId, out var subthema):
                    var vanSubthema = _themas[subthema.ThemaId];
                    return new Katplek(
                        Katpleksoort.Subdoel,
                        vanSubthema.Id,
                        vanSubthema.Naam,
                        subthema.Id,
                        subthema.Naam,
                        subthema.Leeftijd,
                        Verwijzing: SubthemaVerwijzing(subthema));
                case Kathouder.Activiteit when _activiteiten.TryGetValue(koppeling.HouderId, out var activiteit):
                    return PlekVanActiviteit(activiteit);
                default:
                    return null;
            }
        }

        private static string SubthemaVerwijzing(Chatsubthema subthema) => $"/themas/{subthema.ThemaId}?subthema={subthema.Id}";

        private static List<Katplek> Geordend(List<Katplek> plekken) =>
            plekken
                .Distinct()
                .OrderBy(p => p.Thema, StringComparer.CurrentCulture)
                .ThenBy(p => p.Soort)
                .ThenBy(p => p.Leeftijd, StringComparer.Ordinal)
                .ThenBy(p => p.Subthema, StringComparer.CurrentCulture)
                .ThenBy(p => p.Activiteit, StringComparer.CurrentCulture)
                .ThenBy(p => p.Doel?.Code, StringComparer.Ordinal)
                .ToList();

        // ADR-0049 D3, asked of the matrix every screen asks: an own activiteit is read by its owner, the leerkrachten and
        // hoofdleerkrachten of its leeftijd, and an admin. Maker and goal links do not decide a read.
        private bool MagLezen(Chatactiviteit activiteit, Chatsubthema subthema) =>
            activiteit.EigenaarId is not { } eigenaarId
            || Rechtenmatrix.StaatToe(
                _lezer.Rechten,
                Rechtenmatrix.EigenActiviteitLezen,
                new Activiteitbron(activiteit.Id, subthema.Leeftijd, null, false, eigenaarId));
    }
}
