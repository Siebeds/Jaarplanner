using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// The <b>single authorisation seam</b> for administering official curriculum reference data
/// (E1-15, Art. VI.1, FR-10, ADR-0011 §2). One named policy, declared here and applied with one
/// <c>[Authorize(Policy = …)]</c> attribute, so the question "who may (re-)import the curriculum?"
/// has exactly one place to be answered.
/// <para>
/// <b>Since E6-01 it requires a signed-in person, and nothing more yet.</b> Until E6-01 it authorised everyone,
/// deliberately: no scheme was registered, so there was no user to test a role against (ADR-0022). E6-01 added the
/// session (ADR-0031, which amends ADR-0022 §1), and this policy now requires it. The role half (directie, ADR-0030 R3)
/// is still E6-02's, so until then every signed-in person may run an import, and E7-11 stays a deployment gate.
/// </para>
/// <para>
/// <b>What E6-02 changes, and all it changes.</b> Replace the assertion below with the matrix-driven
/// requirement (expected: the <c>Beheerder</c> / directie role, Art. VI.1) once an authenticated
/// principal exists. Every curriculum-administration endpoint inherits that change, because they all
/// name this one policy. Do <b>not</b> add a second policy or an inline role check next to an
/// endpoint: this constant is the seam, and scattering checks is exactly what ADR-0011 §2 rejects.
/// </para>
/// <para>
/// <b>Why it must say <c>RequireAuthenticatedUser</c> itself.</b> ASP.NET Core applies the fallback policy only to
/// endpoints that carry no authorization metadata of their own. The import names this policy, so the fallback never
/// reaches it: whatever this policy requires is all the import requires.
/// </para>
/// </summary>
public static class CurriculumbeheerAutorisatie
{
    /// <summary>
    /// The policy name every curriculum reference-data administration endpoint authorises against
    /// (the Op.stap goal import from Excel, E1-15, and the decreed-minimumdoelen import from KOV's API, E1-12).
    /// </summary>
    public const string Beleid = "Curriculumbeheer";

    /// <summary>
    /// Registers the <see cref="Beleid"/> policy. Called once from Program.cs; the matching
    /// <c>UseAuthorization()</c> call is what actually enforces it on the endpoints that name it.
    /// </summary>
    public static IServiceCollection AddCurriculumbeheerAutorisatie(this IServiceCollection services)
    {
        services.AddAuthorization(opties =>
            opties.AddPolicy(
                Beleid,
                // A signed-in person, and nothing more yet (ADR-0031 amends ADR-0022 §1): a policy of its own replaces
                // the fallback rather than adding to it, so without this line the import would stay anonymous. E6-02
                // adds the role half here, binding it to directie (ADR-0030 R3).
                beleid => beleid.RequireAuthenticatedUser()));

        return services;
    }
}
