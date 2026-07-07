import { AnnouncementsClient } from "./AnnouncementsClient";
import { getScheduledBroadcasts } from "./actions";

export default async function AnnouncementsPage() {
  const { broadcasts } = await getScheduledBroadcasts();
  return <AnnouncementsClient initialBroadcasts={broadcasts} />;
}
