const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface SessionResponse {
  session_id: string;
}

export interface Session {
  session_id: string;
  messages: any[];
  current_architecture?: any;
  created_at: string;
}

export async function createSession(initialPrompt: string): Promise<SessionResponse> {
  const res = await fetch(`${API_URL}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initial_prompt: initialPrompt }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function getSession(sessionId: string): Promise<Session> {
  const res = await fetch(`${API_URL}/api/sessions/${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}
