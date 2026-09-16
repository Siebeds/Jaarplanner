import { describe, expect, it } from "vitest";
import { opCode, opMinimumdoelRef } from "./opCode";

describe("volgorde van codes (TB-051)", () => {
  it("leest getallen in een code als getallen", () => {
    expect(["1.10", "1.2", "1.1"].sort(opCode)).toEqual(["1.1", "1.2", "1.10"]);
  });

  it("zet minimumdoelen van de kleuter voor die van de leerjaren, en dan per leerjaar", () => {
    expect(["4-4.2.14", "K-1.1.10", "2-3.1.1", "K-1.1.3", "6-1.1.1"].sort(opMinimumdoelRef)).toEqual([
      "K-1.1.3",
      "K-1.1.10",
      "2-3.1.1",
      "4-4.2.14",
      "6-1.1.1",
    ]);
  });
});
