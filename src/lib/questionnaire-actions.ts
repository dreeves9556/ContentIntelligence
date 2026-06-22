export interface QuestionnaireFormData {
  name: string;
  businessName: string;
  city: string;
  whatYouDo: string;
  industry: string;
  brandType: string;
  personalStory: string;
  industryAnswers: Record<string, string>;
  onCameraPersonality: string[];
  contentEnjoyed: string[];
  daysToPost: number;
  primaryGoal: string;
  antiBrandWords: string;
}
