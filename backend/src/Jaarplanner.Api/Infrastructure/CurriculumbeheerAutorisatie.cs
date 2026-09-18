using Jaarplanner.Application.Toegang;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// The <b>single authorisation seam</b> for administering official curriculum reference data (E1-15, Art. VI.1,
/// ADR-0011 §2, ADR-0022). Every Op.stap import endpoint names <see cref="Beleid"/> in one
/// <c>[Authorize(Policy = …)]</c> attribute, so the question "who may (re-)import the curriculum?" has one answer.
/// <para>
/// <b>Since E6-02 the answer is admin, and only admin</b> (ADR-0030 §3, Op.stap row, R3; the <c>Beheerder</c>
/// ADR-0022 expected is the admin right since R16). The policy is no longer registered here: it is the
/// <see cref="Rechtenmatrix.Curriculumbeheer"/> row of the matrix, declared with every other row in
/// <see cref="Rechtenmatrix"/> and registered by <c>Autorisatie.Rechtenbeleid</c>, which also makes it require a
/// signed-in person. This constant stays because it is the name the endpoints and their tests already use.
/// </para>
/// <para>
/// Do <b>not</b> add a second policy or an inline role check next to an import endpoint: changing who may import is
/// changing that one matrix row.
/// </para>
/// </summary>
public static class CurriculumbeheerAutorisatie
{
    /// <summary>
    /// The policy name every curriculum reference-data administration endpoint authorises against (the Op.stap goal
    /// import from Excel, E1-15, and the imports from KOV's API, E1-12 and E1-21).
    /// </summary>
    public const string Beleid = Rechtenmatrix.Beleid.Curriculumbeheer;
}
