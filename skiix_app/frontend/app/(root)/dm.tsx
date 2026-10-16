/**
 * Legacy entry: Expo Router still links here from inbox / connect.
 * Real chat UI lives in `messages/[id].tsx`.
 */
import { Redirect, useLocalSearchParams } from "expo-router";

function one(v: string | string[] | undefined) {
  const x = Array.isArray(v) ? v[0] : v;
  return (x ?? "").toString();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function DMRedirectScreen() {
  const p = useLocalSearchParams<{
    peer?: string | string[];
    conversation?: string | string[];
    with?: string | string[];
    avatarUrl?: string | string[];
    lookupEmail?: string | string[];
    fullName?: string | string[];
  }>();

  const conversation = one(p.conversation).trim();
  const peer = one(p.peer).trim();
  const withParam = one(p.with);
  const avatarUrl = one(p.avatarUrl);
  const lookupEmail = one(p.lookupEmail);
  const fullName = one(p.fullName);

  const segment = UUID_RE.test(conversation) ? conversation : "new";

  return (
    <Redirect
      href={{
        pathname: "/messages/[id]",
        params: {
          id: segment,
          userId: peer,
          username: withParam || "member",
          avatarUrl,
          lookupEmail,
          ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
        },
      }}
    />
  );
}
