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

    /// <summary>Every code this vocabulary knows: the three kleuter jaren and the six leerjaren.</summary>
    public static IReadOnlyList<string> Alle { get; } = [.. Kleuter, .. Lager];

    /// <summary>Whether <paramref name="code"/> is one of the nine known jaar/fase codes.</summary>
    /// <remarks>
    /// P/S goals carry a fase that is none of the nine (Art. VII.1 column F), so this is deliberately NOT a
    /// validator for <c>Leerplandoel.JaarFase</c>. It validates what a <b>class</b> may claim to teach, and a class
    /// teaches a jaar, never a fase.
    /// </remarks>
    public static bool IsBekend(string? code) => code is not null && Alle.Contains(code, StringComparer.Ordinal);

    /// <summary>
    /// The jaar/fase codes a class should be measured against: its OWN recorded jaar/fase when it has one, and
    /// otherwise whatever its <c>Leerjaar</c> ordinal can say (owner ruling, 2026-08-25).
    /// <para>
    /// <b>This is the narrowing the ordinal could not do.</b> <see cref="VoorLeerjaar"/> answers all three kleuter
    /// codes for <c>Leerjaar = 0</c>, because the ordinal cannot say which kleuterjaar a group is, and a coverage
    /// figure measured against all three is more than twice the size of the real one: a third kleuterklas was being
    /// held to 1288 goals where 554 are its own. The 2026-08-04 ruling forbade GUESSING which year a kleutergroep is,
    /// and this does not guess: the year is recorded on the class, by the school, or it is absent and the old
    /// behaviour stands unchanged.
    /// </para>
    /// <para>
    /// <b>Still one code at most, and still no graadklas answer.</b> A class spanning several leerjaren needs a SET
    /// here, which is the Art. XIV decision this does not settle. Until then such a class records no jaar/fase and
    /// falls through to the ordinal, which refuses with <c>null</c> and makes <c>DekkingService</c> widen and say so.
    /// </para>
    /// </summary>
    /// <param name="leerjaar">The class's <c>Leerjaar</c> ordinal.</param>
    /// <param name="jaarfase">Its recorded jaar/fase, or null when the school has not stated one.</param>
    public static IReadOnlyList<string>? VoorKlas(int leerjaar, string? jaarfase) =>
        IsBekend(jaarfase) ? [jaarfase!] : VoorLeerjaar(leerjaar);

    /// <summary>
    /// What is wrong with a class claiming <paramref name="jaarfase"/>, in Dutch, or null when nothing is.
    /// <para>
    /// <b>Blank is now an error, and the contradiction check is gone</b> (owner ruling, 2026-08-30). Both changes
    /// follow from the same thing: the jaar/fase is the only level a class states, and <c>Leerjaar</c> is derived
    /// from it. There is nothing left for it to contradict, and "the school has not said" stopped being a state a
    /// new or edited class may be in.
    /// </para>
    /// <para>
    /// <b>The rule lives here so both layers can apply it without restating it.</b> The idiom this codebase already
    /// uses (see <c>WeekplanningService</c>) is that the aggregate refuses programmer error and the service refuses
    /// teacher input, which means the check happens twice; what must not happen twice is the RULE. So the domain
    /// throws on this sentence and the beheerservice raises a mapped 400 with it, and a change here reaches both.
    /// </para>
    /// <para>
    /// Blank is not an error: it means the school has not said, which is the normal state of every class that existed
    /// before this field did.
    /// </para>
    /// </summary>
    /// <summary>
    /// The <c>Leerjaar</c> ordinal a jaar/fase code implies: <c>0</c> for the three kleuter jaren, 1 to 6 for L1
    /// to L6.
    /// <para>
    /// <b>The direction of derivation reversed on 2026-08-30, and that is the point of this method.</b> A klas used
    /// to be told its leerjaar and the code was worked out from it, which could not say WHICH kleuterjaar a
    /// kleutergroep was and is why <c>Klas.Jaarfase</c> had to exist alongside it. The school now states the age and
    /// the ordinal follows, so the two can no longer disagree: for L1 to L6 they were the same fact twice, and for
    /// kleuter the ordinal was strictly the weaker half.
    /// </para>
    /// <para>
    /// The ordinal is kept because things other than scoping still use it: the klassenlijst sorts on it and the
    /// generation prompt names it. Nothing asks a human for it any more.
    /// </para>
    /// </summary>
    /// <exception cref="ArgumentException">The code is not one of the nine. Callers validate first.</exception>
    public static int LeerjaarVoor(string jaarfase)
    {
        var code = jaarfase?.Trim() ?? string.Empty;
        if (Kleuter.Contains(code, StringComparer.Ordinal))
        {
            return 0;
        }

        var index = Lager.ToList().IndexOf(code);
        return index >= 0
            ? index + 1
            : throw new ArgumentException($"'{jaarfase}' is geen bekende jaar/fase.", nameof(jaarfase));
    }

    public static string? WatIsErMisMet(string? jaarfase)
    {
        if (string.IsNullOrWhiteSpace(jaarfase))
        {
            return "Kies een leeftijd: JK, K2, K3 of L1 tot L6.";
        }

        return IsBekend(jaarfase.Trim())
            ? null
            : $"'{jaarfase.Trim()}' is geen bekende leeftijd. Kies JK, K2, K3 of L1 tot L6.";
    }
}
