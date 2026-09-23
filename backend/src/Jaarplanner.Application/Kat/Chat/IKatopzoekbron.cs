using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// What the cat's lookups read (FB-031, ADR-0066): the school's content, the goal catalogues and the agenda. It
/// filters on nothing: which of it a gebruiker may see is <see cref="Katopzoeker"/>'s to decide, so the rule sits in
/// one place and is tested without a database.
/// </summary>
public interface IKatopzoekbron
{
    /// <summary>Every thema, subthema, activiteit and algemene fiche with their goal links. A school has a few hundred.</summary>
    Task<Katbibliotheek> HaalBibliotheekAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The goals a term names: the one whose code or ref is the term (ignoring case), and otherwise at most
    /// <paramref name="max"/> whose text holds every word of it. Goals no longer in Op.stap are left out.
    /// </summary>
    Task<IReadOnlyList<Katdoel>> ZoekDoelenAsync(string term, int max, CancellationToken cancellationToken = default);

    /// <summary>The goals with these codes or refs; an unknown one is left out.</summary>
    Task<IReadOnlyList<Katdoel>> HaalDoelenAsync(IReadOnlyCollection<string> codes, CancellationToken cancellationToken = default);

    /// <summary>The agenda of these klassen: what is placed in their jaarplannen.</summary>
    Task<Katagenda> HaalAgendaAsync(IReadOnlyCollection<Guid> klasIds, CancellationToken cancellationToken = default);
}

/// <summary>The school's content, flattened for the lookups.</summary>
public sealed record Katbibliotheek(
    IReadOnlyList<Chatthema> Themas,
    IReadOnlyList<Chatsubthema> Subthemas,
    IReadOnlyList<Chatactiviteit> Activiteiten,
    IReadOnlyList<Chatfiche> Fiches,
    IReadOnlyList<Katkoppeling> Koppelingen)
{
    public static readonly Katbibliotheek Leeg = new([], [], [], [], []);
}

public sealed record Chatthema(Guid Id, string Naam);

public sealed record Chatsubthema(Guid Id, Guid ThemaId, string Naam, string Leeftijd);

/// <summary>An activiteit; <see cref="EigenaarId"/> is set for an own one (ADR-0049).</summary>
public sealed record Chatactiviteit(Guid Id, Guid SubthemaId, string Naam, Guid? EigenaarId);

public sealed record Chatfiche(Guid Id, Guid KlasId, string Naam);

/// <summary>What holds a goal link.</summary>
public enum Kathouder
{
    /// <summary>A thema: a leerplandoel themadoel, a minimumdoel themadoel, or a minimumdoel suggested as one.</summary>
    Thema,

    /// <summary>A subthema: its subdoel.</summary>
    Subthema,

    Activiteit,

    AlgemeneFiche,
}

/// <summary>
/// One goal link. <see cref="Status"/> is the link's own; a minimumdoel themadoel is decided by being there
/// (<c>manueel</c>), and a minimumdoel suggestion only counts while it is <c>voorgesteld</c>.
/// </summary>
public sealed record Katkoppeling(Kathouder Houder, Guid HouderId, string Code, Katdoelsoort Doelsoort, KoppelingStatus Status)
{
    public bool IsBeslist => Status is KoppelingStatus.Aanvaard or KoppelingStatus.Manueel;

    public bool IsVoorstel => Status == KoppelingStatus.Voorgesteld;
}

/// <summary>What is placed in the agenda of some klassen.</summary>
public sealed record Katagenda(
    IReadOnlyList<Katthemaplaatsing> Themas,
    IReadOnlyList<Katsubthemaplaatsing> Subthemas,
    IReadOnlyList<Katactiviteitplaatsing> Activiteiten,
    IReadOnlyList<Katficheplaatsing> Fiches)
{
    public static readonly Katagenda Leeg = new([], [], [], []);
}

public sealed record Katthemaplaatsing(Guid KlasId, Guid ThemaId, DateOnly Van, DateOnly Tot, bool Voorstel);

public sealed record Katsubthemaplaatsing(Guid KlasId, Guid SubthemaId, DateOnly Van, DateOnly Tot);

public sealed record Katactiviteitplaatsing(Guid KlasId, Guid ActiviteitId, DateOnly Datum, bool Voorstel);

public sealed record Katficheplaatsing(Guid KlasId, Guid FicheId, DateOnly Van, DateOnly Tot);

/// <summary>A klas the gebruiker may read the planning of (ADR-0040).</summary>
public sealed record Chatklas(Guid Id, string Naam);
