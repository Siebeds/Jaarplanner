namespace Jaarplanner.Application.Curriculum.Import;

/// <summary>
/// What the Op.stap import screen needs to know before anyone presses a button (E1-22): whether the decreed
/// minimumdoelen are loaded, and which leerplandoelen snapshot from KOV's API was applied last.
/// <para>
/// <b>Why a read of its own rather than the preview's <c>vorigeVersie</c>.</b> Both answers decide what the screen
/// offers. The leerplandoelen import refuses with 409 until the minimumdoelen are loaded (the concordance is a Restrict
/// FK), so a first-time flow must start with the minimumdoelen; and the Excel route refuses every file once a snapshot
/// was applied (Art. VII.2, ADR-0032 decision 8), so the screen must not offer that upload then (the E3-06 rule). The
/// preview does carry <c>vorigeVersie</c>, but it costs a 13 MB read of KOV to get it, and it answers 409 in exactly the
/// first-time case this has to detect. Two counts from our own database do not.
/// </para>
/// </summary>
public interface IOpstapImportStandQuery
{
    /// <summary>Reads the state from the database; never calls KOV.</summary>
    Task<OpstapImportStand> HaalOpAsync(CancellationToken cancellationToken = default);
}

/// <summary>The state of the Op.stap import, as the import screen shows it.</summary>
/// <param name="AantalMinimumdoelen">How many minimumdoelen are stored, whatever their source.</param>
/// <param name="LaatsteVersie">
/// The leerplandoelen snapshot the last applied API import read, or null when none was ever applied. Non-null is exactly
/// the condition under which the Excel route refuses (an <c>opstapversies</c> row exists).
/// </param>
public sealed record OpstapImportStand(int AantalMinimumdoelen, OpstapversieWeergave? LaatsteVersie);
