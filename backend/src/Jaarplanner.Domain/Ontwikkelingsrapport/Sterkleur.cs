namespace Jaarplanner.Domain.Ontwikkelingsrapport;

/// <summary>
/// The fixed palette a <see cref="Gradatie"/> takes its star colour from (FB-002, FR-13.2, ADR-0035 §3.1: "a colour
/// chosen from a fixed palette"). Six colours, in this order, by the owner's ruling of 2026-09-15.
/// <para>
/// <b>Stored and serialised by name</b>, so reordering these members never turns a stored star into another colour. The
/// member order is the order the colour choice shows (<c>GET /api/gradaties/kleuren</c>), which keeps the server the one
/// source of the palette. <c>GradatieTests</c> pins the six names and their order.
/// </para>
/// <para>
/// <b>A name, not a hue.</b> Which colour each one draws, and how it stays clear of the doelsoort, suggestiestatus and
/// dekking hues (Art. XII), is decided by the frontend's design tokens. A star always shows its label beside it, never
/// colour alone (Art. XII).
/// </para>
/// </summary>
public enum Sterkleur
{
    Groen = 0,
    Lichtgroen = 1,
    Geel = 2,
    Oranje = 3,
    Rood = 4,
    Blauw = 5,
}
