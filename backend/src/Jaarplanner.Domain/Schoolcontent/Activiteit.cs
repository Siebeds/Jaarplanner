namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// An activiteit (Art. IX.2) — <b>class/age-scoped</b> (it inherits the class/age scope from its
/// owning <see cref="Subthema"/>). It has an <see cref="ActiviteitType"/>, an optional
/// <see cref="Hoek"/> (learning corner) and optional <see cref="VerwachteUitkomsten"/>, and can
/// link to one or more leerdoelen through its <see cref="Doelkoppelingen"/> (each carrying status
/// + AI motivation). Mutable autonomous school content (Art. III).
/// </summary>
public sealed class Activiteit
{
    private readonly List<DoelKoppeling> _doelkoppelingen = [];

    // EF Core materialisation only.
    private Activiteit()
    {
        Naam = null!;
    }

    internal Activiteit(
        Guid subthemaId,
        string naam,
        ActiviteitType activiteitType,
        string? hoek = null,
        string? verwachteUitkomsten = null)
    {
        SubthemaId = subthemaId;
        Naam = Require(naam, nameof(naam));
        ActiviteitType = Validate(activiteitType);
        Hoek = Optional(hoek);
        VerwachteUitkomsten = Optional(verwachteUitkomsten);
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (class/age-scoped) subthema.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>The activiteit name.</summary>
    public string Naam { get; private set; }

    /// <summary>The form of activity (Art. IX.2).</summary>
    public ActiviteitType ActiviteitType { get; private set; }

    /// <summary>The optional learning corner (ontdektafel, techniekhoek, …).</summary>
    public string? Hoek { get; private set; }

    /// <summary>The optional expected outcomes.</summary>
    public string? VerwachteUitkomsten { get; private set; }

    /// <summary>The optional onderzoeksvraag this activiteit addresses. Null means no specific onderzoeksvraag is targeted.</summary>
    public Guid? OnderzoeksvraagId { get; private set; }

    /// <summary>
    /// The teacher's own colour label (<see cref="Activiteitkleur"/>). Null means none, which is the
    /// normal state and the only one the import can produce.
    /// </summary>
    public Activiteitkleur? Kleur { get; private set; }

    /// <summary>
    /// How many consecutive lesuren this activiteit takes. One by default.
    ///
    /// <para>
    /// <b>On the activiteit rather than on each placement, which is what makes it one number.</b> A
    /// hoek that runs two lesuren runs two lesuren every time it is scheduled; putting the length on
    /// the placement would ask the teacher the same question again on every day it appears, and let
    /// two placements of one activiteit disagree about how long it is.
    /// </para>
    /// <para>
    /// It is a count of lesuren and not minutes. Nothing in this model stores a clock time: a school
    /// day is a row of numbered lesmomenten (<see cref="Planning.Activiteitplaatsing.Volgorde"/> is
    /// the slot), so "two lesuren" is the only duration the plan can actually honour.
    /// </para>
    /// </summary>
    public int LengteInLesuren { get; private set; } = 1;

    /// <summary>The goal links for this activiteit (zero or more leerdoelen; Art. IX.2).</summary>
    public IReadOnlyList<DoelKoppeling> Doelkoppelingen => _doelkoppelingen;

    /// <summary>Links (or unlinks) this activiteit to an onderzoeksvraag. Null clears the link.</summary>
    public void KoppelAanOnderzoeksvraag(Guid? onderzoeksvraagId) => OnderzoeksvraagId = onderzoeksvraagId;

    /// <summary>
    /// Sets (or clears) the teacher's colour label.
    ///
    /// <para>
    /// Separate from <see cref="WerkGegevensBij"/> on purpose. That method is what the school-content
    /// import calls when it overwrites an existing activiteit, and the workbook carries no colour, so
    /// including kleur there would silently discard a teacher's choice on every re-import. The same
    /// reasoning that keeps the goal links out of that method keeps this out of it (Art. IV.2).
    /// </para>
    /// </summary>
    /// <summary>
    /// Sets how many consecutive lesuren this activiteit takes.
    ///
    /// <para>
    /// Separate from <see cref="WerkGegevensBij"/> for the same reason <see cref="KiesKleur"/> is: that
    /// method is the school-content import's overwrite path, and the workbook carries no length, so
    /// folding this into it would reset a teacher's choice on every re-import (Art. IV.2).
    /// </para>
    /// </summary>
    public void StelLengteIn(int lengteInLesuren)
    {
        if (lengteInLesuren < 1)
        {
            throw new ArgumentOutOfRangeException(
                nameof(lengteInLesuren), lengteInLesuren, "An activiteit takes at least one lesuur.");
        }

        LengteInLesuren = lengteInLesuren;
    }

    public void KiesKleur(Activiteitkleur? kleur)
    {
        if (kleur is { } gekozen && !Enum.IsDefined(gekozen))
        {
            throw new ArgumentOutOfRangeException(nameof(kleur), kleur, "Unknown activiteit colour.");
        }

        Kleur = kleur;
    }

    /// <summary>Links this activiteit to a leerdoel.</summary>
    public void VoegDoelkoppelingToe(DoelKoppeling koppeling)
    {
        ArgumentNullException.ThrowIfNull(koppeling);
        _doelkoppelingen.Add(koppeling);
    }

    /// <summary>
    /// Removes a goal link from this activiteit (CRUD, E1-10). Used when a teacher unlinks a leerdoel;
    /// it is a deliberate human decision, so the caller persists the removal (Art. IV.2).
    /// </summary>
    public void VerwijderDoelkoppeling(DoelKoppeling koppeling)
    {
        ArgumentNullException.ThrowIfNull(koppeling);
        _doelkoppelingen.Remove(koppeling);
    }

    /// <summary>Renames the activiteit (CRUD, E1-10); the import path leaves the naam (its match key) alone.</summary>
    public void WijzigNaam(string naam) => Naam = Require(naam, nameof(naam));

    /// <summary>
    /// Re-parents this activiteit to another subthema (E4-08, FR-7.2).
    /// <para>
    /// <b>Internal on purpose.</b> An activiteit has no class scope of its own, so it cannot check the one rule
    /// a move has to obey (Art. IX.2: the class scope comes from the subthema). <see cref="Subthema"/> is the
    /// only type that knows both scopes, so the guard lives there and this setter is reachable only through
    /// <c>Subthema.VerplaatsActiviteitNaar</c>. Nothing outside the domain can move an activiteit past it.
    /// </para>
    /// <para>
    /// The <see cref="Doelkoppelingen"/> are deliberately untouched: they are owned by this activiteit, so a
    /// move carries every one of them, including the <c>manueel</c> links a teacher made by hand. That is the
    /// whole reason this verb exists rather than delete-and-retype.
    /// </para>
    /// </summary>
    internal void VerhuisNaar(Guid subthemaId) => SubthemaId = subthemaId;

    /// <summary>
    /// Updates the activiteit's attributes (mutable autonomous content, Art. III). Used by the
    /// school-content import overwrite path (E1-08); the naam (the match key) and the goal links are
    /// not changed here — links are managed separately via AI matching / CRUD, so an overwrite never
    /// touches a teacher's link decision (Art. IV.2).
    /// </summary>
    public void WerkGegevensBij(ActiviteitType activiteitType, string? hoek, string? verwachteUitkomsten)
    {
        ActiviteitType = Validate(activiteitType);
        Hoek = Optional(hoek);
        VerwachteUitkomsten = Optional(verwachteUitkomsten);
    }

    private static ActiviteitType Validate(ActiviteitType type) =>
        Enum.IsDefined(type)
            ? type
            : throw new ArgumentOutOfRangeException(nameof(type), type, "Unknown activiteit type.");

    private static string Require(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"'{paramName}' is required.", paramName);
        }

        return value.Trim();
    }

    private static string? Optional(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
