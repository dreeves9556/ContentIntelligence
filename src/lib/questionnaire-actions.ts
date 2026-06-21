export interface QuestionnaireFormData {
  name: string;
  businessName: string;
  city: string;
  whatYouDo: string;
  industry: string;
  brandType: string;
  personalStory: string;
  hobbies: string;
  idealClient: string;
  bestClientCommonalities: string;
  industryAnswers: Record<string, string>;
  localSpots: string;
  communityUniqueness: string;
  onCameraPersonality: string[];
  contentEnjoyed: string[];
  daysToPost: number;
}
