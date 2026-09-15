export type CommuteMode = "car" | "metro" | "bus" | "bike" | "walk";
export type DietType = "meat-heavy" | "mixed" | "vegetarian" | "vegan";
export type Level = "low" | "medium" | "high";

export type CarbonInputs = {
  commuteMode: CommuteMode;
  commuteKmPerWeek: number;
  flightHoursPerYear: number;
  electricityKwhPerMonth: number;
  diet: DietType;
  shopping: Level;
  waste: Level;
};

export type CarbonBreakdown = {
  transport: number;
  electricity: number;
  diet: number;
  lifestyle: number;
};

export type CarbonResult = CarbonBreakdown & {
  totalKg: number;
  totalTonnes: number;
  benchmarkKg: number;
  percentage: Record<keyof CarbonBreakdown, number>;
  highestImpact: keyof CarbonBreakdown;
};

const commuteFactors: Record<CommuteMode, number> = {
  car: 0.18,
  metro: 0.035,
  bus: 0.06,
  bike: 0.01,
  walk: 0,
};

const dietFactors: Record<DietType, number> = {
  "meat-heavy": 1900,
  mixed: 1300,
  vegetarian: 850,
  vegan: 650,
};

const levelFactors: Record<Level, number> = { low: 180, medium: 360, high: 620 };
const wasteFactors: Record<Level, number> = { low: 55, medium: 130, high: 250 };

export function calculateTransportEmissions(inputs: Pick<CarbonInputs, "commuteMode" | "commuteKmPerWeek" | "flightHoursPerYear">) {
  return Math.round(inputs.commuteKmPerWeek * 52 * commuteFactors[inputs.commuteMode] + inputs.flightHoursPerYear * 85);
}

export function calculateElectricityEmissions(inputs: Pick<CarbonInputs, "electricityKwhPerMonth">) {
  return Math.round(inputs.electricityKwhPerMonth * 12 * 0.71);
}

export function calculateDietEmissions(inputs: Pick<CarbonInputs, "diet">) {
  return dietFactors[inputs.diet];
}

export function calculateLifestyleEmissions(inputs: Pick<CarbonInputs, "shopping" | "waste">) {
  return levelFactors[inputs.shopping] + wasteFactors[inputs.waste];
}

export function calculateTotalEmissions(inputs: CarbonInputs): CarbonResult {
  const breakdown: CarbonBreakdown = {
    transport: calculateTransportEmissions(inputs),
    electricity: calculateElectricityEmissions(inputs),
    diet: calculateDietEmissions(inputs),
    lifestyle: calculateLifestyleEmissions(inputs),
  };
  const totalKg = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  const entries = Object.entries(breakdown) as [keyof CarbonBreakdown, number][];
  const highestImpact = entries.sort((a, b) => b[1] - a[1])[0][0];
  const percentage = Object.fromEntries(entries.map(([key, value]) => [key, Math.round((value / totalKg) * 100)])) as Record<keyof CarbonBreakdown, number>;

  return {
    ...breakdown,
    totalKg,
    totalTonnes: Number((totalKg / 1000).toFixed(1)),
    benchmarkKg: 2900,
    percentage,
    highestImpact,
  };
}

export function calculatePotentialReduction(inputs: CarbonInputs, changes: Partial<CarbonInputs>) {
  const before = calculateTotalEmissions(inputs).totalKg;
  const after = calculateTotalEmissions({ ...inputs, ...changes }).totalKg;
  return Math.max(0, before - after);
}

export function generateRecommendations(result: CarbonResult, inputs: CarbonInputs) {
  const recommendations = [];
  if (result.transport >= result.electricity && result.transport >= result.diet) {
    recommendations.push({ title: "Make one commute switch", detail: "Replace one weekly car trip with metro or bus. At your current distance, that is the fastest way to unlock a meaningful reduction.", reduction: calculatePotentialReduction(inputs, { commuteMode: "metro" }) });
  }
  if (result.electricity >= result.transport && result.electricity >= result.diet) {
    recommendations.push({ title: "Cool smarter", detail: "Set AC temperature to 24°C, clean filters monthly, and use a timer. These small habits can trim household electricity without changing comfort.", reduction: Math.round(result.electricity * 0.12) });
  }
  if (inputs.diet === "meat-heavy" || inputs.diet === "mixed") {
    recommendations.push({ title: "Try two plant-forward days", detail: "Swap two meat-heavy meals each week for dal, rajma, paneer or seasonal vegetables. It keeps the change practical and affordable.", reduction: inputs.diet === "meat-heavy" ? 220 : 140 });
  }
  if (inputs.shopping === "high" || inputs.waste === "high") {
    recommendations.push({ title: "Buy less, keep longer", detail: "Use a 48-hour pause for non-essential purchases and separate wet waste for composting. Prevention beats perfect recycling.", reduction: 120 });
  }
  return recommendations.slice(0, 3);
}

export const defaultCarbonInputs: CarbonInputs = {
  commuteMode: "car",
  commuteKmPerWeek: 78,
  flightHoursPerYear: 4,
  electricityKwhPerMonth: 145,
  diet: "mixed",
  shopping: "medium",
  waste: "medium",
};
