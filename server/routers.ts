import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { generateRecommendations, calculateTotalEmissions, type CarbonInputs } from "@shared/carbon";
import { getSessionCookieOptions } from "./_core/cookies";
import { invokeLLM } from "./_core/llm";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createCarbonCalculation, getCarbonGoal, getRecentCalculations, saveCarbonGoal } from "./db";

const carbonInputs = z.object({
  commuteMode: z.enum(["car", "metro", "bus", "bike", "walk"]),
  commuteKmPerWeek: z.number().min(0).max(2000),
  flightHoursPerYear: z.number().min(0).max(500),
  electricityKwhPerMonth: z.number().min(0).max(5000),
  diet: z.enum(["meat-heavy", "mixed", "vegetarian", "vegan"]),
  shopping: z.enum(["low", "medium", "high"]),
  waste: z.enum(["low", "medium", "high"]),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  carbon: router({
    calculate: publicProcedure.input(carbonInputs).query(({ input }) => calculateTotalEmissions(input)),
    recommend: publicProcedure.input(carbonInputs).mutation(async ({ input }) => {
      const result = calculateTotalEmissions(input);
      const fallback = generateRecommendations(result, input);
      try {
        const response = await invokeLLM({
          model: "gpt-5-mini",
          messages: [
            { role: "system", content: "You are a practical climate coach for people living in India. Give specific, encouraging suggestions based on the user's footprint. Return JSON only." },
            { role: "user", content: JSON.stringify({ inputs: input, breakdown: result, fallback }) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "carbon_recommendations",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: { type: "string" },
                  recommendations: { type: "array", items: { type: "object", properties: { title: { type: "string" }, detail: { type: "string" }, reduction: { type: "number" } }, required: ["title", "detail", "reduction"], additionalProperties: false } },
                },
                required: ["summary", "recommendations"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices[0]?.message?.content;
        if (typeof content === "string") return JSON.parse(content);
      } catch (error) {
        console.warn("[Carbon] AI recommendation fallback:", error);
      }
      return {
        summary: "Your biggest wins are practical, not perfect. Start with one change in your highest-impact category this week.",
        recommendations: fallback,
      };
    }),
    save: protectedProcedure.input(z.object({ inputs: carbonInputs, result: z.object({ totalKg: z.number(), transport: z.number(), electricity: z.number(), diet: z.number(), lifestyle: z.number() }) })).mutation(async ({ ctx, input }) => {
      await createCarbonCalculation({ userId: ctx.user.id, totalKg: input.result.totalKg, transportKg: input.result.transport, electricityKg: input.result.electricity, dietKg: input.result.diet, lifestyleKg: input.result.lifestyle, inputsJson: JSON.stringify(input.inputs) });
      return { success: true } as const;
    }),
    history: protectedProcedure.query(({ ctx }) => getRecentCalculations(ctx.user.id)),
    goal: protectedProcedure.query(({ ctx }) => getCarbonGoal(ctx.user.id)),
    saveGoal: protectedProcedure.input(z.object({ baselineKg: z.number(), targetKg: z.number(), targetDate: z.string() })).mutation(async ({ ctx, input }) => {
      await saveCarbonGoal({ userId: ctx.user.id, ...input });
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
