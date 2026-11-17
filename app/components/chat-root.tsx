"use client";

import dynamic from "next/dynamic";

// The A2UI basic catalog registers custom elements and touches `document`, so
// the chat runs in the browser only.
const Chat = dynamic(() => import("./chat").then((module) => module.Chat), {
  ssr: false,
  loading: () => <div className="shell" />,
});

export function ChatRoot() {
  return <Chat />;
}
