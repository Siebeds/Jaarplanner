using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Curriculum;

/// <summary>
/// A read view of one Op.stap leerplandoel that is <b>(nog) niet gekoppeld</b> — i.e. it carries no
/// real <c>DoelKoppeling</c> to any thema (E2-06, FR-4.4). "Real" follows the coverage semantics of
/// Art. V: only a link with status <c>aanvaard</c> or <c>manueel</c> counts; a merely
/// <c>voorgesteld</c> AI suggestion (or a <c>geweigerd</c> one) does not, so a doel that only has an
/// open suggestion is still ongekoppeld here.
/// <para>
/// It exposes just what the "ongekoppelde doelen" list needs — the stable <see cref="Code"/>, the
/// <see cref="Doelsoort"/> (for the badge/design token) and the browse context
/// (<see cref="JaarFase"/>, <see cref="Domein"/>/<see cref="Subdomein"/>, <see cref="Tekst"/>). It is
/// derived read-only reference data; the query never mutates official content (Art. III.1).
/// </para>
/// </summary>
/// <param name="Code">The leerplandoel's unique, stable code (Art. III.5).</param>
/// <param name="Doelsoort">The goal type (serialised by name — MD/G/+/P/S/A via the enum).</param>
/// <param name="JaarFase">The jaar/fase code (JK, K2, K3, L1–L6, or a fase for P/S).</param>
/// <param name="Domein">The domein — part of the composite browse key.</param>
/// <param name="Subdomein">The subdomein — unique only together with the domein (Art. VII.0).</param>
/// <param name="Tekst">The goal text (Excel J).</param>
public sealed record OngekoppeldDoelWeergave(
    string Code,
    Doelsoort Doelsoort,
    string JaarFase,
    string Domein,
    string Subdomein,
    string Tekst);
