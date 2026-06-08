import { useState } from "react";
import { createSession } from "../lib/api";
import { useArchitectureStore } from "../stores/architectureStore";

export function useSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSessionId = useArchitectureStore((s) => s.setSessionId);
  const addMessage = useArchitectureStore((s) => s.addMessage);

  const startSession = async (prompt: string) => {
    setLoading(true);
    setError(null);
    try {
      const { session_id } = await createSession(prompt);
      setSessionId(session_id);
      addMessage({
        role: "system",
        type: "reasoning",
        content: `Connecting to session ${session_id}...`,
      });
      return session_id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create session";
      setError(msg);
      addMessage({
        role: "system",
        type: "warning",
        content: msg,
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { startSession, loading, error };
}
