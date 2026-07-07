import { UnsubscribeClient } from "./UnsubscribeClient";

export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  return <UnsubscribeClient searchParams={searchParams} />;
}
