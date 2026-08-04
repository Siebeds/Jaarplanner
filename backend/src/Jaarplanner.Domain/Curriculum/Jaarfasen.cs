namespace Jaarplanner.Domain.Curriculum;

/// <summary>
/// The Op.stap jaar/fase vocabulary, and the one place that maps a class's <c>Leerjaar</c> onto it (E5-02).
/// <para>
/// <b>The canonical form is ruled, not chosen here (owner, 2026-08-03):</b> <c>JK</c>/<c>K2</c>/<c>K3</c> for
/// kleuter and <c>L1</c>–<c>L6</c> for lager, with the Op.stap import normalising the other ordering to it. So
/// these constants restate a ruling rather than introduce a convention, and a comparer that folded case or
/// reordered characters would only mask an import that failed to normalise.
/// </para>
/// <para>
/// <b>This list is deliberately not exhaustive over what <c>Leerplandoel.JaarFase</c> can hold.</b> Art. VII.1
/// column F is "JK, K2, K3, L1–L6, <i>or a fase for P/S</i>": the illustrative precurriculum and specifieke
/// doelsoorten carry a fase code that is none of the nine below. Scoping a class to its own jaar/fase therefore
/// excludes those goals from the denominator, which is a real consequence of the owner's ruling of 2026-08-04
/// rather than a bug — but it must be <b>visible</b> rather than silent, which is why
/// <c>DekkingWeergave.AantalBuitenBereik</c> exists and why the overview offers the whole-curriculum switch.
/// </para>
/// </summary>
public static class Jaarfasen
{
    /// <summary>The three kleuter jaren, coarse to fine (jongste kleuter, tweede, derde).</summary>
    public static readonly IReadOnlyList<string> Kleuter = ["JK", "K2", "K3"];

    /// <summary>The six leerjaren of het lager onderwijs.</summary>
    public static readonly IReadOnlyList<string> Lager = ["L1", "L2", "L3", "L4", "L5", "L6"];

    /// <summary>
    /// The jaar/fase codes a class with this <c>Leerjaar</c> should be measured against, or <c>null</c> when that
    /// cannot be derived.
    /// <para>
    /// <b><c>0</c> means "een kleutergroep" and yields all three kleuter codes, not one.</b> <c>Klas.Leerjaar</c> is
    /// a single ordinal and kleutergroepen are not numbered in it (its own documentation says 0 is allowed "for
    /// kleuter groepen modelled elsewhere"), so which kleuterjaar a group is cannot be read from it. Measuring a
    /// kleutergroep against all three kleuter jaren is wider than ideal and it is the widest honest answer
    /// available; narrowing it needs the graadklas/menggroep decision (Art. XIV) that would also give a klas a real
    /// jaar/fase set.
    /// </para>
    /// <para>
    /// <b><c>null</c> is a refusal, and the caller must not read it as an empty scope.</b> An empty jaar/fase set
    /// means "the whole curriculum" to <c>IDekkingOpslag.HaalLeerplandoelenAsync</c>, so returning an empty list
    /// here would be indistinguishable from a deliberate whole-curriculum measurement — while returning "no goals
    /// at all" would report a class as having nothing left to cover, which is the one direction a coverage figure
    /// must never move by itself. <c>null</c> forces the caller to decide, and <c>DekkingService</c> decides by
    /// falling back to the whole curriculum and saying so in the payload.
    /// </para>
    /// </summary>
    /// <param name="leerjaar">The class's <c>Leerjaar</c> ordinal: 0 for a kleutergroep, 1–6 for L1–L6.</param>
    public static IReadOnlyList<string>? VoorLeerjaar(int leerjaar) => leerjaar switch
    {
        0 => Kleuter,
        >= 1 and <= 6 => [Lager[leerjaar - 1]],
        _ => null,
    };
}
