using Jaarplanner.Domain.Planning;

namespace Jaarplanner.Application.Planning;

/// <summary>
/// The <b>planningsblok-indeling seam</b> (ADR-0013, Art. IX.3, Art. XIV): the single question the rest of
/// the system asks about the planning grid — "given this school year, what are its blocks?"
/// <para>
/// <b>Why a seam and not a constant.</b> Planningsblok granularity was an open directie decision, resolved
/// on 2026-07-14 to a two-tier default (themaperiode 4–6 wk + subthemaperiode ~2 wk). ADR-0013 requires
/// that the answer stay <b>configuration, not compiled-in code</b>, so the resolution can be adjusted — a
/// school with a 3-week cadence, or a later directie change of mind — without touching generation (E3-01),
/// the calendar (E3-06), drag-and-drop (E3-07) or the zoom levels (E3-08). Those all consume
/// <see cref="Planningsblok"/> and never a calendar unit.
/// </para>
/// <para>
/// This mirrors the <c>IDisciplineSelectie</c> seam (ADR-0019) deliberately: same shape, same guarantee —
/// the implementation contains no period length, it reads them from configuration, and the documented
/// default lives in configuration space rather than as a literal in planning logic.
/// </para>
/// </summary>
public interface IPlanningsblokIndeling
{
    /// <summary>
    /// Derives the blocks of the given tier for <paramref name="schooljaar"/>, in chronological order with
    /// 1-based ordinals. Blocks never span a vacation and never extend beyond the school year.
    /// </summary>
    IReadOnlyList<Planningsblok> Blokken(Schooljaar schooljaar, Planningsblokniveau niveau);

    /// <summary>
    /// A human-readable description of the configured grain, for surfacing in a preview/diff the way the
    /// discipline-selection seam surfaces its scope (e.g. "themaperiode 5 wk, subthemaperiode 2 wk").
    /// </summary>
    string Omschrijving { get; }
}
