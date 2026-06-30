namespace Jaarplanner.Infrastructure.OpstapImport;

/// <summary>
/// A single per-row parse problem. The parser <b>reports</b> malformed rows rather than
/// silently dropping them (ADR-0006 §4: clear per-row diagnostics), so the caller (E1-04
/// import orchestration) can surface them to the user before committing any reference data.
/// </summary>
/// <param name="RijNummer">The 1-based Excel row number the problem occurred on.</param>
/// <param name="Reden">A short, English, machine-/log-friendly reason for the problem.</param>
/// <param name="Code">The leerplandoel code on the row, if it could be read (helps locate the row).</param>
public sealed record OpstapRijProbleem(int RijNummer, string Reden, string? Code = null);
