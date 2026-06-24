import { z } from "zod";

export const questionnaireSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  businessName: z.string().min(1, "Business name is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  whatYouDo: z.string().min(1, "This field is required").max(500),
  industry: z.string().min(1, "Industry is required").max(100),
  brandType: z.string().min(1, "Brand type is required").max(50),
  personalStory: z.string().max(5000).optional().default(""),
  industryAnswers: z.record(z.string(), z.string().max(2000)).optional().default({}),
  onCameraPersonality: z.array(z.string().max(100)).optional().default([]),
  contentEnjoyed: z.array(z.string().max(100)).optional().default([]),
  daysToPost: z.number().int().min(1).max(7),
  primaryGoal: z.string().max(200).optional().default(""),
  antiBrandWords: z.string().max(2000).optional().default(""),
  contentSample: z.string().max(5000).optional().default(""),
  signaturePhrases: z.string().max(1000).optional().default(""),
  brandWords: z.string().max(1000).optional().default(""),
  currentOffer: z.string().max(1000).optional().default(""),
  preferredCTA: z.string().max(200).optional().default(""),
  speakingStyle: z.string().max(500).optional().default(""),
  humorStyle: z.string().max(500).optional().default(""),
  sentenceLength: z.string().max(100).optional().default(""),
  audienceLabel: z.string().max(200).optional().default(""),
  clientWords: z.string().max(1000).optional().default(""),
  contentBoundaries: z.string().max(2000).optional().default(""),
  familyContext: z.string().max(2000).optional().default(""),
  morningRoutine: z.string().max(2000).optional().default(""),
  hotTakes: z.string().max(2000).optional().default(""),
  emojiUsage: z.string().max(100).optional().default(""),
  formattingStyle: z.string().max(200).optional().default(""),
  storytellingStyle: z.string().max(200).optional().default(""),
});

export type ValidatedQuestionnaireData = z.infer<typeof questionnaireSchema>;

export function validateQuestionnaire(data: unknown): {
  success: boolean;
  data?: ValidatedQuestionnaireData;
  error?: string;
} {
  const result = questionnaireSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  return {
    success: false,
    error: firstError?.message ?? "Invalid questionnaire data",
  };
}
