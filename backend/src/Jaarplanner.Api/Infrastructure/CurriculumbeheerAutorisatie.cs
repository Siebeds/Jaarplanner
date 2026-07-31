using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace Jaarplanner.Api.Infrastructure;

/// <summary>
/// The <b>single authorisation seam</b> for administering official curriculum reference data
/// (E1-15, Art. VI.1, FR-10, ADR-0011 §2). One named policy, declared here and applied with one
/// <c>[Authorize(Policy = …)]</c> attribute, so the question "who may (re-)import the curriculum?"
/// has exactly one place to be answered.
/// <para>
/// <b>It currently authorises everyone, and that is deliberate.</b> The API has no authentication at
/// all yet: no scheme is registered (E6-01 Entra ID) and no role matrix exists (E6-02), so there is no
/// authenticated user to test a role against, and E7-11 tracks "the API is unauthenticated" as a
/// deployment gate. The Art. XIV question this story hit is <i>who</i> may run an import; inventing a
/// role system to answer it here would be hard-assuming the answer, and a client-side check would be
/// security theatre (ADR-0011 rejects frontend-only gating). So the policy is a real, enforced
/// ASP.NET Core policy whose only requirement today evaluates to "allow", i.e. a seam with a
/// documented no-op body.
/// </para>
/// <para>
/// <b>What E6-02 changes, and all it changes.</b> Replace the assertion below with the matrix-driven
/// requirement (expected: the <c>Beheerder</c> / directie role, Art. VI.1) once an authenticated
/// principal exists. Every curriculum-administration endpoint inherits that change, because they all
/// name this one policy. Do <b>not</b> add a second policy or an inline role check next to an
/// endpoint: this constant is the seam, and scattering checks is exactly what ADR-0011 §2 rejects.
/// </para>
/// <para>
/// <b>Why an assertion rather than <c>RequireAuthenticatedUser</c>.</b> With no authentication scheme
/// registered, a policy that demands an authenticated user would fail every request and the import
/// would be unreachable, which is the very defect E1-15 exists to remove. An always-true assertion
/// keeps the endpoint usable today while making the enforcement point exist, be named, and be tested.
/// </para>
/// </summary>
public static class CurriculumbeheerAutorisatie
{
    /// <summary>
    /// The policy name every curriculum reference-data administration endpoint authorises against
    /// (today: the Op.stap goal import; expected next: E1-12's decreed-minimumdoelen import).
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
                // The no-op body described above. Swapped for the E6-02 role requirement, not removed.
                beleid => beleid.RequireAssertion(_ => true)));

        return services;
    }
}
