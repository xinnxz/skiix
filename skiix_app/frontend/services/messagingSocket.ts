import { getApiBaseUrl } from "@/lib/apiBaseUrl";

export type MessagingWsEvent =
  | "message_sent"
  | "message_received"
  | "message_read"
  | "typing_start"
  | "typing_stop";

export type MessagingWsPayload = {
  event: MessagingWsEvent;
  conversation_id: string;
  data?: Record<string, unknown>;
};

type Handler = (payload: MessagingWsPayload) => void;

let socket: WebSocket | null = null;
let handlers: Handler[] = [];

function wsBaseUrl(): string {
  const api = getApiBaseUrl().replace(/\/$/, "");
  return api.replace(/^http/, "ws") + "/api/v1/ws/messaging";
}

export function connectMessagingSocket(accessToken: string): void {
  if (!accessToken) return;
  disconnectMessagingSocket();
  const url = `${wsBaseUrl()}?token=${encodeURIComponent(accessToken)}`;
  try {
    socket = new WebSocket(url);
    socket.onmessage = (ev) => {
      try {
        const payload = JSON.parse(String(ev.data)) as MessagingWsPayload;
        handlers.forEach((h) => h(payload));
      } catch {
        /* ignore */
      }
    };
    socket.onerror = () => {
      if (__DEV__) console.warn("[MessagingWS] connection error");
    };
  } catch {
    if (__DEV__) console.warn("[MessagingWS] failed to connect");
  }
}

export function disconnectMessagingSocket(): void {
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
    socket = null;
  }
}

export function onMessagingEvent(handler: Handler): () => void {
  handlers.push(handler);
  return () => {
    handlers = handlers.filter((h) => h !== handler);
  };
}
