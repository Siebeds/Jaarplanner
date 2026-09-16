namespace Jaarplanner.Application.Planning.Generatie;

/// <summary>
/// Thrown when anyone asks for a jaarplan generation while it is switched off (ADR-0053 decision 9). The owner ruled on
/// 2026-09-16 that the AI generation is reworked in its own ticket for plans with dates, and is off until then. The
/// (thin) Api maps it to a 409: the request is well-formed, the feature is what is unavailable.
/// </summary>
public sealed class GeneratieUitgeschakeldFout : Exception
{
    /// <summary>The one sentence a teacher reads; the plan screen shows the same reason beside the disabled button.</summary>
    public GeneratieUitgeschakeldFout()
        : base("Het jaarplan genereren wordt aangepast aan de planning met datums en staat tijdelijk uit. " +
            "Plan de thema's intussen zelf in.")
    {
    }
}
