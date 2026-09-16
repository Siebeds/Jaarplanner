namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// An activiteit (Art. IX.2) — <b>age-scoped</b> (it inherits the leeftijd from its
/// owning <see cref="Subthema"/>). It has an optional <see cref="ActiviteitType"/>, an optional
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
        ActiviteitType? activiteitType,
        string? hoek = null,
        string? verwachteUitkomsten = null,
        Guid? makerId = null,
        Guid? eigenaarId = null)
    {
        SubthemaId = subthemaId;
        Naam = Require(naam, nameof(naam));
        ActiviteitType = Validate(activiteitType);
        Hoek = Optional(hoek);
        VerwachteUitkomsten = Optional(verwachteUitkomsten);
        MakerId = makerId == Guid.Empty ? null : makerId;
        EigenaarId = eigenaarId == Guid.Empty ? null : eigenaarId;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The owning (age-scoped) subthema.</summary>
    public Guid SubthemaId { get; private set; }

    /// <summary>
    /// The gebruiker who created this activiteit by hand, or <c>null</c> (Art. IX.2, Art. VI.1, ADR-0030 R25, R26).
    /// <para>
    /// <b>It only decides who may delete it:</b> the maker may, while no decided goal is linked to it
    /// (<see cref="HeeftBeslisteDoelkoppeling"/>, ADR-0053 D5), with or without a klas
    /// at this leeftijd and after the schooljaar (R33). The activiteit stays shared; this is not E6-10's personal
    /// content. <c>null</c> for an activiteit that predates the rule, for one the FR-1 import created, and for one
    /// whose maker was removed as a gebruiker (the database sets it to null, I17), all of which are purely shared.
    /// </para>
    /// <para>Set once, at creation, and never by the import's overwrite path.</para>
    /// </summary>
    public Guid? MakerId { get; private set; }

    /// <summary>
    /// The gebruiker whose <b>own activiteit</b> this is (ADR-0049 E1), or <c>null</c> for a shared one.
    /// <para>
    /// Set once, at creation, and by nothing else. The database sets it to <c>null</c> when that gebruiker is removed,
    /// which makes the activiteit shared (D8). An own activiteit is read by its leeftijd's leerkrachten and
    /// hoofdleerkrachten, edited only by its owner and directie, and counts for dekking only where it is planned
    /// (Art. V.1, VI.1). Who may do what is the rights matrix's; this type holds no rights logic.
    /// </para>
    /// </summary>
    public Guid? EigenaarId { get; private set; }

    /// <summary>Whether this is an own activiteit rather than a shared one (ADR-0049).</summary>
    public bool IsEigen => EigenaarId is not null;

    /// <summary>The activiteit name.</summary>
    public string Naam { get; private set; }

    /// <summary>
    /// The form of activity (Art. IX.2), or <c>null</c> when the teacher chose none. Never defaulted: an absent soort
    /// stays absent rather than becoming <c>Experiment</c>, the enum's zero value (FB-050).
    /// </summary>
    public ActiviteitType? ActiviteitType { get; private set; }

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
    /// Whether a decided goal is linked (<c>aanvaard</c> or <c>manueel</c>). A proposal or a rejected goal is not a link
    /// for any rule that asks whether one exists (ADR-0053 D5).
    /// </summary>
    public bool HeeftBeslisteDoelkoppeling => _doelkoppelingen.Any(k => k.IsBeslist);

    /// <summary>Adds the AI's proposal of a goal, as <see cref="KoppelingStatus.Voorgesteld"/> with its motivation (FB-026).</summary>
    public DoelKoppeling StelDoelVoor(string leerplandoelCode, string aiMotivatie)
    {
        if (string.IsNullOrWhiteSpace(aiMotivatie))
        {
            throw new ArgumentException("A proposal carries a motivation (Art. IV.3).", nameof(aiMotivatie));
        }

        if (_doelkoppelingen.Any(k => string.Equals(k.LeerplandoelCode, leerplandoelCode?.Trim(), StringComparison.Ordinal)))
        {
            throw new InvalidOperationException($"Goal '{leerplandoelCode}' is already on this activiteit.");
        }

        var koppeling = new DoelKoppeling(leerplandoelCode!, KoppelingStatus.Voorgesteld, aiMotivatie);
        _doelkoppelingen.Add(koppeling);
        return koppeling;
    }

    /// <summary>Removes the proposals nobody has decided yet, ahead of a new run (ADR-0053 D3). Decided links stay.</summary>
    public void VerwijderOpenDoelvoorstellen() =>
        _doelkoppelingen.RemoveAll(k => k.Status == KoppelingStatus.Voorgesteld);

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
    /// <b>Internal on purpose.</b> An activiteit has no scope of its own, so it cannot check the one rule a move
    /// has to obey (Art. IX.2: the leeftijd comes from the subthema, and since the owner's ruling of 2026-08-30 a
    /// move may not change it). <see cref="Subthema"/> is the only type that knows both ages, so the guard lives
    /// there and this setter is reachable only through <c>Subthema.VerplaatsActiviteitNaar</c>. Nothing outside
    /// the domain can move an activiteit past it.
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
    public void WerkGegevensBij(ActiviteitType? activiteitType, string? hoek, string? verwachteUitkomsten)
    {
        ActiviteitType = Validate(activiteitType);
        Hoek = Optional(hoek);
        VerwachteUitkomsten = Optional(verwachteUitkomsten);
    }

    private static ActiviteitType? Validate(ActiviteitType? type) =>
        type is null || Enum.IsDefined(type.Value)
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
