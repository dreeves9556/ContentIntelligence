import { getScheduledBroadcasts } from "./actions";
import { getLoginAnnouncements } from "./login-queries";
import { LoginAnnouncementsTab } from "./LoginAnnouncementsTab";

export default async function AnnouncementsPage() {
  const [{ broadcasts }, { announcements }] = await Promise.all([
    getScheduledBroadcasts(),
    getLoginAnnouncements(),
  ]);

  return <LoginAnnouncementsTab broadcasts={broadcasts} loginAnnouncements={announcements} />;
}
