import { describe, expect, it } from "vitest";
import { calculatePotentialReduction, calculateTotalEmissions, defaultCarbonInputs } from "../shared/carbon";

describe("carbon calculation engine", () => {
  it("returns a complete category breakdown and total", () => {
    const result = calculateTotalEmissions(defaultCarbonInputs);

    expect(result.totalKg).toBe(result.transport + result.electricity + result.diet + result.lifestyle);
    expect(result.totalTonnes).toBe(4.1);
    expect(result.highestImpact).toBe("diet");
    expect(result.percentage.diet).toBe(32);
  });

  it("uses low-carbon commute and diet inputs to reduce the estimate", () => {
    const baseline = calculateTotalEmissions(defaultCarbonInputs).totalKg;
    const lowerImpact = calculateTotalEmissions({
      ...defaultCarbonInputs,
      commuteMode: "metro",
      diet: "vegetarian",
      shopping: "low",
      waste: "low",
    }).totalKg;

    expect(lowerImpact).toBeLessThan(baseline);
    expect(calculatePotentialReduction(defaultCarbonInputs, { commuteMode: "metro" })).toBeGreaterThan(0);
  });

  it("never reports a negative potential reduction", () => {
    expect(calculatePotentialReduction(defaultCarbonInputs, { commuteMode: "car", diet: "meat-heavy" })).toBe(0);
  });
});
