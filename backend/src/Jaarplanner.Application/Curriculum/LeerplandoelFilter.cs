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
/// so a subdomein filter without its domein would silently mix unrelated goals. The query treats a
/// subdomein as a narrowing of the domein next to it; the UI offers them grouped for the same reason.
/// </para>
/// </summary>
/// <param name="Zoekterm">Free text matched case-insensitively against the code <b>and</b> the goal text.</param>
/// <param name="Discipline">A discipline <c>nummer</c> ("1", "9.2"); exact, case-insensitive.</param>
/// <param name="Domein">A domein name; exact, case-insensitive.</param>
/// <param name="Subdomein">A subdomein name; exact, case-insensitive, and only meaningful with <paramref name="Domein"/>.</param>
/// <param name="Doelsoort">One Op.stap goal type (MD/G/+/P/S/A).</param>
/// <param name="JaarFase">A jaar/fase code (JK, K2, K3, L1–L6, or a fase for P/S); exact, case-insensitive.</param>
/// <param name="Overslaan">How many rows to skip (paging offset); never negative.</param>
/// <param name="Aantal">How many rows to return; between 1 and <see cref="MaxPaginaGrootte"/>.</param>
public sealed record LeerplandoelFilter(
    string? Zoekterm = null,
    string? Discipline = null,
    string? Domein = null,
    string? Subdomein = null,
    Doelsoort? Doelsoort = null,
    string? JaarFase = null,
    int Overslaan = 0,
    int Aantal = LeerplandoelFilter.StandaardPaginaGrootte)
{
    /// <summary>The default page size: enough to scan a subdomein, small enough to render instantly.</summary>
    public const int StandaardPaginaGrootte = 50;

    /// <summary>The hard ceiling on a page. A caller asking for more gets a 400, never the whole table.</summary>
    public const int MaxPaginaGrootte = 200;
}
