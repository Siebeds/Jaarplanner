namespace Jaarplanner.Domain.Schoolcontent;

/// <summary>
/// One run of the thema-opbouw wizard: the thema it built from scratch, who started it and when, when it last wrote,
/// and whether it was finished or closed (E6-02, Art. VI.1, ADR-0030 R29, R32; defaults I22–I25).
/// <para>
/// <b>Why it exists.</b> Themabeheer creates subthema's, subdoelen and activiteiten only through the wizard's own write
/// actions, and only for a thema the wizard builds from scratch (R32). "From scratch" needs a state the server can see,
/// and this is it: a thema is new while the run that created it is open (I23).
/// </para>
/// <para>
/// <b>When a run is open (I24).</b> Until themabeheer or admin finishes or closes it, and at most
/// <see cref="MaximaleStilte"/> after its last write action. No background job ends it: the time is compared on every
/// request, so a run that nobody touched for fourteen days is closed the moment someone asks.
/// </para>
/// <para>
/// <b>What it created (I25).</b> Within an open run the wizard may also edit and delete what that same run created, and
/// nothing else. <see cref="Aangemaakt"/> records those items by id. It is a record kept beside them and changes
/// nothing about what a subthema, subdoel or activiteit is: after the run, they are ordinary shared content (I23).
/// </para>
/// </summary>
public sealed class Wizardrun
{
    /// <summary>How long a run stays open after its last write action (I24, chosen by the owner on 2026-09-14).</summary>
    public static readonly TimeSpan MaximaleStilte = TimeSpan.FromDays(14);

    private readonly List<Wizardrunitem> _aangemaakt = [];

    // EF Core materialisation only.
    private Wizardrun()
    {
    }

    /// <summary>Starts a run for the thema it has just created.</summary>
    /// <param name="themaId">The thema this run built. Required.</param>
    /// <param name="gestartDoorId">Who started it, or <c>null</c> when that gebruiker has no row (any more).</param>
    /// <param name="nu">The moment of the start, which is also its first write action.</param>
    public Wizardrun(Guid themaId, Guid? gestartDoorId, DateTimeOffset nu)
    {
        ThemaId = themaId == Guid.Empty ? throw new ArgumentException("'themaId' is required.", nameof(themaId)) : themaId;
        GestartDoorId = gestartDoorId == Guid.Empty ? null : gestartDoorId;
        GestartOp = nu;
        LaatsteSchrijfactieOp = nu;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>The thema this run created. One run per thema.</summary>
    public Guid ThemaId { get; private set; }

    /// <summary>The gebruiker who started the run, or <c>null</c> (no row, or removed since).</summary>
    public Guid? GestartDoorId { get; private set; }

    /// <summary>When the run started.</summary>
    public DateTimeOffset GestartOp { get; private set; }

    /// <summary>When the run last wrote something: the start, or its latest create, edit or delete.</summary>
    public DateTimeOffset LaatsteSchrijfactieOp { get; private set; }

    /// <summary>When themabeheer or admin finished the run, or <c>null</c>.</summary>
    public DateTimeOffset? AfgerondOp { get; private set; }

    /// <summary>When themabeheer or admin closed the run without finishing it, or <c>null</c>.</summary>
    public DateTimeOffset? GeslotenOp { get; private set; }

    /// <summary>The subthema's, subdoelen and activiteiten this run created and that still exist as far as it knows.</summary>
    public IReadOnlyList<Wizardrunitem> Aangemaakt => _aangemaakt;

    /// <summary>The moment the run ends by itself if nothing is written before it (I24).</summary>
    public DateTimeOffset SluitUiterlijkOp => LaatsteSchrijfactieOp + MaximaleStilte;

    /// <summary>Whether the run is open at <paramref name="nu"/>: not finished, not closed, and not silent for too long.</summary>
    public bool IsOpen(DateTimeOffset nu) => AfgerondOp is null && GeslotenOp is null && nu < SluitUiterlijkOp;

    /// <summary>Whether this run created the item <paramref name="itemId"/> of kind <paramref name="soort"/>.</summary>
    public bool HeeftAangemaakt(Wizarditemsoort soort, Guid itemId) =>
        _aangemaakt.Any(i => i.Soort == soort && i.ItemId == itemId);

    /// <summary>Records an item this run created, which is also a write action.</summary>
    public void RegistreerAanmaak(Wizarditemsoort soort, Guid itemId, DateTimeOffset nu)
    {
        VereisOpen(nu);
        if (itemId == Guid.Empty)
        {
            throw new ArgumentException("'itemId' is required.", nameof(itemId));
        }

        _aangemaakt.Add(new Wizardrunitem(soort, itemId));
        LaatsteSchrijfactieOp = nu;
    }

    /// <summary>Records an edit of something this run created.</summary>
    public void RegistreerWijziging(DateTimeOffset nu)
    {
        VereisOpen(nu);
        LaatsteSchrijfactieOp = nu;
    }

    /// <summary>
    /// Records that items this run created are gone: one it deleted, and whatever went with it (a subthema takes its
    /// subdoelen and activiteiten).
    /// </summary>
    public void RegistreerVerwijdering(IEnumerable<Guid> itemIds, DateTimeOffset nu)
    {
        ArgumentNullException.ThrowIfNull(itemIds);
        VereisOpen(nu);
        var weg = itemIds.ToHashSet();
        _aangemaakt.RemoveAll(i => weg.Contains(i.ItemId));
        LaatsteSchrijfactieOp = nu;
    }

    /// <summary>Finishes the run. From then on its thema follows the ordinary rights (I23).</summary>
    public void RondAf(DateTimeOffset nu)
    {
        VereisOpen(nu);
        AfgerondOp = nu;
    }

    /// <summary>Closes the run without finishing it. From then on its thema follows the ordinary rights (I23).</summary>
    public void Sluit(DateTimeOffset nu)
    {
        VereisOpen(nu);
        GeslotenOp = nu;
    }

    // A caller that writes to an ended run has skipped the service's own check: a programming error, so English and a
    // 500 rather than a teacher's sentence (Art. II.3). The service refuses it first, with a 403 a screen can show.
    private void VereisOpen(DateTimeOffset nu)
    {
        if (!IsOpen(nu))
        {
            throw new InvalidOperationException("This wizard run has ended; nothing may be written through it.");
        }
    }
}

/// <summary>One item a <see cref="Wizardrun"/> created: its kind and its id.</summary>
public sealed class Wizardrunitem
{
    // EF Core materialisation only.
    private Wizardrunitem()
    {
    }

    internal Wizardrunitem(Wizarditemsoort soort, Guid itemId)
    {
        Soort = soort;
        ItemId = itemId;
    }

    /// <summary>Surrogate identity.</summary>
    public Guid Id { get; private set; } = Guid.NewGuid();

    /// <summary>What kind of item it is.</summary>
    public Wizarditemsoort Soort { get; private set; }

    /// <summary>The id of the subthema, subdoel or activiteit.</summary>
    public Guid ItemId { get; private set; }
}

/// <summary>The kinds of item a wizard run creates (R32).</summary>
public enum Wizarditemsoort
{
    Subthema,
    Subdoel,
    Activiteit,
}
