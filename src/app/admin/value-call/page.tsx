import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getValueCallSettingsForAdmin } from "./actions";
import ValueCallAdminClient from "./ValueCallAdminClient";

export const metadata = {
  title: "Value Call Settings",
};

export default async function ValueCallAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const settings = await getValueCallSettingsForAdmin();

  return <ValueCallAdminClient settings={settings} />;
}
