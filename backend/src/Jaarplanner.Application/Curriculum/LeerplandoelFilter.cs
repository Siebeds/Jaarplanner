using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// The browse/search criteria for the Doelen register (E1-16, FR-2.4). Every dimension is optional; an
/// omitted dimension means "no filter on that dimension", so a default-constructed filter is
/// "the whole loaded curriculum, first page".
/// <para>
/// <b>Filtering, searching and paging are the database's job.</b> After a full Op.stap import this table
/// holds thousands of rows, and the register is a naslagwerk a teacher looks one thing up in; fetching
/// everything and narrowing it in the browser would send the whole curriculum over the wire on every
/// keystroke. The page size is therefore part of the contract rather than a client convention.
/// </para>
/// <para>
/// <b><see cref="Domein"/> and <see cref="Subdomein"/> are one composite dimension.</b> Subdomein names are
/// not globally unique (Art. VII.0 — Muzische vorming repeats <i>Bouwstenen</i> under Muziek/Beeld/Drama/…),
/// so a subdomein filter without its domein mixes unrelated goals and produces a total that means nothing.
/// <b>A <see cref="Subdomein"/> without a <see cref="Domein"/> is therefore refused at the edge</b>
/// (<c>LeerplandoelenController</c> answers 400), the same way a bad <see cref="Doelsoort"/> is: the
/// alternative is a number on a teacher's screen that silently sums two different things.
/// </para>
/// <para>
/// <i>Corrected 2026-07-31 (antagonist finding 2).</i> This paragraph previously claimed the query "treats a
/// subdomein as a narrowing of the domein next to it". It never did: the EF adapter applies
/// <see cref="Subdomein"/> as an independent predicate, and nothing rejected a bare one, so
/// <c>?subdomein=Bouwstenen</c> returned Muziek's and Beeld's rows under one total while only the frontend
/// dropped it. The guard the comment described now exists, at the layer that can enforce it for every caller
/// rather than for one client.
/// </para>
/// </summary>
/// <param name="Zoekterm">Free text matched case-insensitively against the code <b>and</b> the goal text.</param>
/// <param name="Discipline">A discipline <c>nummer</c> ("1", "9.2"); exact, case-insensitive.</param>
/// <param name="Domein">A domein name; exact, case-insensitive.</param>
/// <param name="Subdomein">A subdomein name; exact, case-insensitive, and only meaningful with <paramref name="Domein"/>.</param>
/// <param name="Doelsoort">One Op.stap goal type (MD/G/+/P/S/A).</param>
/// <param name="JaarFasen">
/// The jaar/fase codes to keep (JK, K2, K3, L1–L6, or a fase for P/S); exact, case-insensitive, matched as
/// "any of". <c>null</c> or empty means "no filter on this dimension".
/// <para>
/// <b>A list rather than one code, because a class does not always teach one</b> (E9-07). A kleutergroep has
/// <c>Leerjaar = 0</c>, which cannot say which kleuterjaar it is, so <c>Jaarfasen.VoorLeerjaar</c> answers JK,
/// K2 <i>and</i> K3, and the same holds for an unresolved graadklas. A single-valued filter forces a caller
/// scoping to a class to pick one of them, and picking one is exactly what the E5-02 ruling of 2026-08-04
/// forbids: let the teacher narrow on screen, never guess which year a kleutergroep is.
/// </para>
/// <para>
/// The query-string name stays <c>jaarFase</c> and is simply repeatable
/// (<c>?jaarFase=JK&amp;jaarFase=K2</c>), so the register's own single-select filter keeps working unchanged
/// and arrives here as a one-element list. One dimension, one representation.
/// </para>
/// </param>
/// <param name="Overslaan">How many rows to skip (paging offset); never negative.</param>
/// <param name="Aantal">How many rows to return; between 1 and <see cref="MaxPaginaGrootte"/>.</param>
public sealed record LeerplandoelFilter(
    string? Zoekterm = null,
    string? Discipline = null,
    string? Domein = null,
    string? Subdomein = null,
    Doelsoort? Doelsoort = null,
    IReadOnlyList<string>? JaarFasen = null,
    int Overslaan = 0,
    int Aantal = LeerplandoelFilter.StandaardPaginaGrootte)
{
    /// <summary>The default page size: enough to scan a subdomein, small enough to render instantly.</summary>
    public const int StandaardPaginaGrootte = 50;

    /// <summary>The hard ceiling on a page. A caller asking for more gets a 400, never the whole table.</summary>
    public const int MaxPaginaGrootte = 200;
}
