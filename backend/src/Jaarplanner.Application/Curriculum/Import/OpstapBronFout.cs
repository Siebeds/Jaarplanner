namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// KOV's Op.stap source could not be read at all: the network failed, the request timed out, the API answered with an
/// error status, or it answered with something that is not the shape the mapping expects (ADR-0032). Raised before
/// anything is written, so the database is exactly as it was.
/// <para>
/// Two audiences, two languages (Art. II.3 as amended 2026-07-30). <see cref="Exception.Message"/> is the Dutch sentence
/// for the person who pressed the button, and it says only what holds for <b>every</b> cause: the data was not fetched
/// and nothing changed. It deliberately does not say "try again later", because a changed response shape or a partial
/// read will not fix itself (antagonist, E1-12 round 1). <see cref="TechnischeOorzaak"/> is English and meant for the
/// log, because those causes are something only an operator can fix.
/// </para>
/// </summary>
public sealed class OpstapBronFout : Exception
{
    /// <summary>The Dutch message for whoever ran the import. One source for the wording (Art. II.3 clause 3).</summary>
    public const string Melding =
        "De Op.stap-gegevens van Katholiek Onderwijs Vlaanderen konden niet opgehaald worden. Er is niets gewijzigd.";

    /// <summary>Constructs the fault.</summary>
    /// <param name="technischeOorzaak">What went wrong, in English, for the operator log.</param>
    /// <param name="innerException">The underlying exception, when there is one.</param>
    public OpstapBronFout(string technischeOorzaak, Exception? innerException = null)
        : base(Melding, innerException) =>
        TechnischeOorzaak = technischeOorzaak;

    /// <summary>What went wrong, in English, for the operator log.</summary>
    public string TechnischeOorzaak { get; }
}
