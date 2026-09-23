namespace Jaarplanner.Application.Kat.Chat;

/// <summary>
/// The fixed lookups the cat's chat can run over the school's content (FB-031, ADR-0066). The model only picks one and
/// fills in the terms the gebruiker typed; the tool runs it over its own data, so the answer never comes from the
/// model's knowledge (Art. IV.4).
/// </summary>
public enum Katvraag
{
    /// <summary>"Zit doel x in thema y?": needs <see cref="Katopzoeking.Doel"/> and <see cref="Katopzoeking.Thema"/>.</summary>
    DoelInThema,

    /// <summary>"Waar wordt doel x gebruikt?": needs <see cref="Katopzoeking.Doel"/>.</summary>
    WaarGebruikt,

    /// <summary>"Welke doelen horen bij thema y?": needs <see cref="Katopzoeking.Thema"/>.</summary>
    DoelenVanThema,

    /// <summary>"Zit activiteit a in subthema z?": needs <see cref="Katopzoeking.Activiteit"/> and <see cref="Katopzoeking.Subthema"/>.</summary>
    ActiviteitInSubthema,

    /// <summary>"Bij welk subthema hoort activiteit a?": needs <see cref="Katopzoeking.Activiteit"/>.</summary>
    SubthemaVanActiviteit,
}

/// <summary>
/// One lookup: which <see cref="Vraag"/>, and the terms it is about, as the gebruiker named them (a code, a piece of a
/// name) or, after she picked one of several candidates, that candidate's code or id. A term the lookup does not need
/// is ignored.
/// </summary>
public sealed record Katopzoeking(
    Katvraag Vraag,
    string? Doel = null,
    string? Thema = null,
    string? Subthema = null,
    string? Activiteit = null)
{
    /// <summary>The longest term a lookup accepts; a name or a code is far shorter.</summary>
    public const int MaxTermLengte = 200;

    /// <summary>Whether every term <see cref="Vraag"/> needs is there and none is too long.</summary>
    public bool IsVolledig =>
        Vraag switch
        {
            Katvraag.DoelInThema => Ingevuld(Doel) && Ingevuld(Thema),
            Katvraag.WaarGebruikt => Ingevuld(Doel),
            Katvraag.DoelenVanThema => Ingevuld(Thema),
            Katvraag.ActiviteitInSubthema => Ingevuld(Activiteit) && Ingevuld(Subthema),
            Katvraag.SubthemaVanActiviteit => Ingevuld(Activiteit),
            _ => false,
        }
        && new[] { Doel, Thema, Subthema, Activiteit }.All(t => t is null || t.Length <= MaxTermLengte);

    /// <summary>Only the kind of lookup: its terms are what the gebruiker typed, and stay out of every log (ADR-0059 D6).</summary>
    public override string ToString() => $"{nameof(Katopzoeking)} {Vraag}";

    private static bool Ingevuld(string? term) => !string.IsNullOrWhiteSpace(term);
}
