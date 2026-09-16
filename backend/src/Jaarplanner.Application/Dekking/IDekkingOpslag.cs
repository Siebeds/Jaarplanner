using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Dekking;

/// <summary>
/// The persistence seam for the coverage computation (Art. VIII layering), sibling of <c>IJaarplanOpslag</c> and
/// <c>IDoelMatchOpslag</c>. <see cref="DekkingService"/> depends only on this abstraction, so the whole
/// computation — the highest-risk logic in the system together with the Op.stap import (Art. V.6) — is unit-tested
/// against an in-memory fake with no database.
/// <para>
/// <b>Which links count, and in which step, is Art. V.1 (ADR-0047).</b> A <c>DoelKoppeling</c> lives in several places
/// (Art. IX.2), and each reaches the dekking of a klas by its own route:
/// </para>
/// <list type="bullet">
/// <item><c>Subdoel</c> and the <c>Doelkoppelingen</c> of a shared <c>Activiteit</c>, per leeftijd: in the prognose when
/// the subthema is at the klas's leeftijd; gedekt when that subthema is placed in the klas's agenda. Read by
/// <see cref="HaalSubthemakoppelingenAsync"/>, and by the candidate read for the lacune reasons.</item>
/// <item>The <c>Doelkoppelingen</c> of an own <c>Activiteit</c> (ADR-0049 D7), never through its subthema: in the
/// prognose of a klas at its leeftijd that its owner teaches, or whose agenda holds it; gedekt when it is planned in the
/// klas's agenda. Read by <see cref="HaalEigenActiviteitkoppelingenAsync"/>.</item>
/// <item><c>AlgemeneFiche.Doelkoppelingen</c>, per klas: gedekt when the fiche is planned. Read by
/// <see cref="HaalFichekoppelingenAsync"/>.</item>
/// <item><c>ThemaMinimumdoel</c>, school-wide: a minimumdoel in the prognose; gedekt when the thema is placed. Read by
/// <see cref="HaalThemaMinimumdoelenAsync"/>.</item>
/// </list>
/// <para>
/// A <c>Themadoel</c> that links a leerplandoel counts nowhere (ADR-0047 D5): only the FR-1 import still writes one. A
/// thema's doelsuggestie proposes a minimumdoel and counts only as the <c>ThemaMinimumdoel</c> its acceptance makes
/// (ADR-0052).
/// </para>
/// <para>
/// <b>Only <c>aanvaard</c>/<c>manueel</c> links count</b> (Art. V.1): a <c>voorgesteld</c> suggestion is not yet a goal
/// and letting it count would hand the decision to the AI (Art. IV.1); a <c>geweigerd</c> one never was. These
/// filters have to translate to SQL, so the rule is written inline in every queryable that applies it rather than
/// behind one helper; the reads are pinned against each other by Postgres tests.
/// </para>
/// </summary>
public interface IDekkingOpslag
{
    /// <summary>
    /// The decided links on subdoelen and on activiteiten of every subthema at the leeftijden <paramref name="klasId"/>
    /// teaches, each with its subthema and thema, and whether that subthema is placed in the klas's agenda (a
    /// <c>Subthemaplaatsing</c> in its jaarplan). The prognose is every row; the dekking is the placed rows (ADR-0047 D3,
    /// S1).
    /// <para>
    /// A klas whose leeftijd cannot be derived reads every subthema, as the leerplandoel scope widens for it.
    /// </para>
    /// </summary>
    Task<IReadOnlyList<Subthemakoppeling>> HaalSubthemakoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Every thema that carries a link to a leerplandoel <b>for this class</b>, whether or not the thema is in the plan,
    /// as (code, thema id, thema naam, is the link decided) rows: the input the lacune reasons are classified from
    /// (E5-05).
    /// <para>
    /// Subdoelen and activiteit links of subthema's at the klas's leeftijden. <b><c>geweigerd</c>
    /// links are excluded entirely</b>: a rejected link is a decision the teacher already took, so a goal linked only by
    /// rejected links classifies as <see cref="Lacuneoorzaak.GeenThema"/>, and that cause may never say none is
    /// <b>linked</b> to it.
    /// </para>
    /// </summary>
    Task<IReadOnlyList<KandidaatKoppeling>> HaalKandidaatKoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The leerplandoelen carried by this class's <b>planned</b> algemene fiches, as (code, fiche naam) pairs (Art. V.1,
    /// ADR-0029).
    /// <para>
    /// <b>The rules:</b> the fiche belongs to <paramref name="klasId"/>; it has at least one
    /// <c>AlgemeneFicheplaatsing</c> in that class's agenda; and the link is <c>aanvaard</c> or <c>manueel</c>. A fiche
    /// has no prognose step: it is the klas's own, so it is either planned or not in the picture.
    /// </para>
    /// </summary>
    Task<IReadOnlyList<DekkendeFichekoppeling>> HaalFichekoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The decided links of the own activiteiten that concern this class (Art. V.1, ADR-0049 D7), as (code, activiteit
    /// naam, is it planned here) rows.
    /// <para>
    /// <b>The rules:</b> the activiteit has an owner; it has at least one <c>Activiteitplaatsing</c> in this class's
    /// agenda, or its owner has a klastoewijzing on this class and its subthema is at one of the class's leeftijden (a
    /// class whose leeftijd cannot be derived counts every leeftijd, as elsewhere); and the link is <c>aanvaard</c> or
    /// <c>manueel</c>. The prognose is every row; the dekking is the planned rows.
    /// </para>
    /// </summary>
    Task<IReadOnlyList<EigenActiviteitkoppeling>> HaalEigenActiviteitkoppelingenAsync(
        Guid klasId,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Every link between a thema and a minimumdoel (FB-043), as (ref, thema id, thema naam): the prognose of the
    /// minimumdoelen, and with the placed thema ids their dekking (ADR-0047 D2).
    /// </summary>
    Task<IReadOnlyList<Themaminimumdoelkoppeling>> HaalThemaMinimumdoelenAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The minimumdoelen of the given mijlpalen (<c>K-</c>, <c>4-</c>, <c>6-</c>), or every minimumdoel for
    /// <c>null</c>: the denominator of the minimumdoel figure. Read-only reference data, read untracked.
    /// </summary>
    Task<IReadOnlyList<Minimumdoel>> HaalMinimumdoelenAsync(
        IReadOnlyCollection<string>? mijlpalen = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// The in-scope leerplandoelen: the denominator of the coverage figure and the source of the gap list.
    /// </summary>
    /// <param name="jaarFasen">
    /// The jaar/fase codes to measure against, or <c>null</c>/empty for the <b>whole loaded curriculum</b>. A class is
    /// measured against its own jaar/fase by default (<c>Dekkingsbereik.EigenJaarFase</c>, owner 2026-08-04) with the
    /// whole curriculum as an explicit switch. The matching is ordinal: the import normalises the codes.
    /// </param>
    Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
        IReadOnlyCollection<string>? jaarFasen = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// How many leerplandoelen are loaded in total, ignoring any jaar/fase scope (E5-02), so a narrowed denominator
    /// cannot be silent.
    /// </summary>
    Task<int> TelAlleLeerplandoelenAsync(CancellationToken cancellationToken = default);

    /// <summary>The name of every discipline, keyed by its number (TB-022).</summary>
    Task<IReadOnlyDictionary<string, string>> HaalDisciplinenamenAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The class's <c>Leerjaar</c> ordinal and jaar/fase, or <c>null</c> when no such class exists (E5-02). <c>null</c>
    /// is treated like a leerjaar that maps to no jaar/fase: fall back to the whole curriculum and say so.
    /// </summary>
    Task<Klasscope?> HaalKlasscopeAsync(Guid klasId, CancellationToken cancellationToken = default);
}

/// <summary>A decided link on a subdoel or an activiteit of a subthema at the klas's leeftijd (ADR-0047 D3, S1).</summary>
/// <param name="LeerplandoelCode">The goal the link points at.</param>
/// <param name="ThemaNaam">The subthema's thema.</param>
/// <param name="SubthemaNaam">The subthema: the evidence a teacher recognises.</param>
/// <param name="IsIngepland">Whether the subthema is placed in the klas's agenda.</param>
public sealed record Subthemakoppeling(string LeerplandoelCode, string ThemaNaam, string SubthemaNaam, bool IsIngepland);

/// <summary>
/// One thema that could account for a leerplandoel, and how far the link to it has been decided (E5-05).
/// </summary>
/// <param name="LeerplandoelCode">The goal the link points at.</param>
/// <param name="ThemaId">
/// The thema's id, needed because the classification asks whether <b>this</b> thema stands in the plan and the
/// jaarplan projection identifies placements by thema id. Two thema's may share a name.
/// </param>
/// <param name="ThemaNaam">The thema's name: what a teacher is shown and acts on.</param>
/// <param name="IsBeslist"><c>true</c> for an <c>aanvaard</c>/<c>manueel</c> link, <c>false</c> for a <c>voorgesteld</c> one.</param>
public sealed record KandidaatKoppeling(
    string LeerplandoelCode,
    Guid ThemaId,
    string ThemaNaam,
    bool IsBeslist);

/// <summary>
/// One reason a leerplandoel is covered through a planned algemene fiche: the code, and the fiche's name (Art. V.1).
/// </summary>
public sealed record DekkendeFichekoppeling(string LeerplandoelCode, string FicheNaam);

/// <summary>A decided link on an own activiteit that concerns the klas (ADR-0049 D7).</summary>
/// <param name="LeerplandoelCode">The goal the link points at.</param>
/// <param name="ActiviteitNaam">The activiteit: the evidence, named as an own activiteit.</param>
/// <param name="IsIngepland">Whether the activiteit is planned in the klas's agenda.</param>
public sealed record EigenActiviteitkoppeling(string LeerplandoelCode, string ActiviteitNaam, bool IsIngepland);

/// <summary>A minimumdoel linked to a thema as a themadoel (FB-043).</summary>
public sealed record Themaminimumdoelkoppeling(string MinimumdoelRef, Guid ThemaId, string ThemaNaam);

/// <summary>
/// What a class says about which jaar/fase it teaches: its ordinal and its own recorded code.
/// </summary>
/// <param name="Leerjaar">The <c>Leerjaar</c> ordinal. <c>0</c> is a kleutergroep and a valid value, not "unset".</param>
/// <param name="Jaarfase">
/// The class's own jaar/fase (JK, K2, K3, L1–L6), or null when the school has not recorded one. When present it is
/// the answer; <c>Jaarfasen.VoorKlas</c> combines the two so no caller has to decide which wins.
/// </param>
public readonly record struct Klasscope(int Leerjaar, string? Jaarfase);
