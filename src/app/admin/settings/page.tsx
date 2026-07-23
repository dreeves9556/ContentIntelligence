import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPlatformConfigForAdmin } from "./actions";
import ConfigForm from "./ConfigForm";

export const metadata = {
  title: "Admin Settings",
};

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const config = await getPlatformConfigForAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-3xl font-bold text-text-primary"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Settings
        </h1>
        <p className="text-text-muted mt-1">
          Configure platform integrations and AI provider settings
        </p>
      </div>

      <ConfigForm
        initial={{
          zernioApiKey: config.zernioApiKey,
          zernioEnabledPlatforms: config.zernioEnabledPlatforms,
          analyticsSyncFrequencyMinutes: config.analyticsSyncFrequencyMinutes,
          anthropicModel: config.anthropicModel,
          anthropicApiKey: config.anthropicApiKey,
          insightPromptTemplate: config.insightPromptTemplate,
          calendarPromptTemplate: config.calendarPromptTemplate,
          calendarStrategyPromptTemplate: config.calendarStrategyPromptTemplate,
          notifyOnSignup: config.notifyOnSignup,
          adminNotifyEmail: config.adminNotifyEmail,
        }}
        envZernioKey={!!process.env.ZERNIO_API_KEY}
        envAnthropicKey={!!process.env.ANTHROPIC_API_KEY}
        connectedAccounts={config._count?.zernioAccounts ?? 0}
      />
    </div>
  );
}
