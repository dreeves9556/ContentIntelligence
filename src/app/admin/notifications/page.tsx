import { NotificationsAdminClient } from "./NotificationsAdminClient";
import { getScheduledPushes, getRecentNotificationLogs } from "./actions";

export default async function NotificationsPage() {
  const [{ pushes }, { logs }] = await Promise.all([
    getScheduledPushes(),
    getRecentNotificationLogs(),
  ]);
  return <NotificationsAdminClient initialPushes={pushes} initialLogs={logs} />;
}
