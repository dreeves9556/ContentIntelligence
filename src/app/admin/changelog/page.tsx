import ChangelogAdminClient from "./ChangelogAdminClient";
import { getChangelogEntries } from "./actions";

export default async function ChangelogPage() {
  const entries = await getChangelogEntries();
  return <ChangelogAdminClient initialEntries={entries} />;
}
