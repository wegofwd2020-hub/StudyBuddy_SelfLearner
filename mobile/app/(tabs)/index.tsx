import { Redirect } from "expo-router";

// The launch/landing route. Per product decision the app opens on the Library,
// so "/" redirects there. The Query screen lives at its own route (query.tsx)
// and is reached from the top nav. This screen renders nothing visible.
export default function Index() {
  return <Redirect href="/library" />;
}
