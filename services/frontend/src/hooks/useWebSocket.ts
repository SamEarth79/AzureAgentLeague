import { useEffect, useRef, useCallback } from "react";
import { useArchitectureStore } from "../stores/architectureStore";
import { WSClient } from "../lib/wsClient";
import type { Message } from "../types/architecture";

export function useWebSocket(sessionId: string | null) {
  const wsRef = useRef<WSClient | null>(null);
  const addMessage = useArchitectureStore((s) => s.addMessage);
  const setArchitecture = useArchitectureStore((s) => s.setArchitecture);
  const setConnected = useArchitectureStore((s) => s.setConnected);
  const setLoading = useArchitectureStore((s) => s.setLoading);
  const pendingMessage = useArchitectureStore((s) => s.pendingMessage);
  const setPendingMessage = useArchitectureStore((s) => s.setPendingMessage);

  // Use refs so onConnect closure always sees latest values without re-creating the WS
  const pendingMessageRef = useRef(pendingMessage);
  const addMessageRef = useRef(addMessage);
  const setPendingMessageRef = useRef(setPendingMessage);
  useEffect(() => { pendingMessageRef.current = pendingMessage; }, [pendingMessage]);
  useEffect(() => { addMessageRef.current = addMessage; }, [addMessage]);
  useEffect(() => { setPendingMessageRef.current = setPendingMessage; }, [setPendingMessage]);

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WSClient(sessionId, {
      onMessage: (data) => {
        switch (data.type) {
          case "reasoning":
            addMessageRef.current({
              role: "assistant",
              type: "reasoning",
              content: data.content,
              step: data.step,
            });
            break;
          case "tool_call":
            addMessageRef.current({
              role: "assistant",
              type: "tool_call",
              content: data.content || "Calling tool...",
              data: data.data,
            });
            break;
          case "tool_result":
            addMessageRef.current({
              role: "system",
              type: "tool_result",
              content: data.content,
              data: data.data,
            });
            break;
          case "architecture":
            setArchitecture(data.data);
            addMessageRef.current({
              role: "assistant",
              type: "architecture",
              content: "Architecture generated",
              data: data.data,
            });
            break;
          case "warning":
            addMessageRef.current({
              role: "assistant",
              type: "warning",
              content: data.content,
            });
            break;
          case "complete":
            setLoading(false);
            break;
        }
      },
      onConnect: () => {
        setConnected(true);
        if (pendingMessageRef.current) {
          ws.send({ type: "user_message", content: pendingMessageRef.current });
          addMessageRef.current({ role: "user", type: "reasoning", content: pendingMessageRef.current });
          setPendingMessageRef.current(null);
        }
      },
      onDisconnect: () => setConnected(false),
    });

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, [sessionId, setArchitecture, setConnected, setLoading]);

  const sendMessage = useCallback(
    (content: string) => {
      wsRef.current?.send({ type: "user_message", content });
      addMessage({
        role: "user",
        type: "reasoning",
        content,
      } as Message);
    },
    [addMessage]
  );

  return { sendMessage };
}
