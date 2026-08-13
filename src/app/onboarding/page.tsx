import { redirect } from "next/navigation";
import { auth } from "@/auth";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fonboarding");
  }

  return <OnboardingForm />;
}
