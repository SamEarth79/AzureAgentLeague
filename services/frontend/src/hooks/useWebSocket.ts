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
  const setAwaitingClarification = useArchitectureStore((s) => s.setAwaitingClarification);
  const setValidationFixes = useArchitectureStore((s) => s.setValidationFixes);
  const setFailureSimResult = useArchitectureStore((s) => s.setFailureSimResult);
  const pendingMessage = useArchitectureStore((s) => s.pendingMessage);
  const setPendingMessage = useArchitectureStore((s) => s.setPendingMessage);

  // Use refs so onConnect closure always sees latest values without re-creating the WS
  const pendingMessageRef = useRef(pendingMessage);
  const addMessageRef = useRef(addMessage);
  const setPendingMessageRef = useRef(setPendingMessage);
  const warningBufferRef = useRef<{ content: string; severity: string }[]>([]);
  useEffect(() => { pendingMessageRef.current = pendingMessage; }, [pendingMessage]);
  useEffect(() => { addMessageRef.current = addMessage; }, [addMessage]);
  useEffect(() => { setPendingMessageRef.current = setPendingMessage; }, [setPendingMessage]);

  useEffect(() => {
    if (!sessionId) return;

    const ws = new WSClient(sessionId, {
      onMessage: (data) => {
        switch (data.type) {
          case "reasoning":
            // Flush buffered warnings before the next step so they appear right after Validating
            if (warningBufferRef.current.length > 0) {
              addMessageRef.current({
                role: "assistant",
                type: "warnings_group",
                content: "",
                warnings: [...warningBufferRef.current],
              });
              warningBufferRef.current = [];
            }
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
            warningBufferRef.current.push({ content: data.content, severity: data.severity ?? "medium" });
            break;
          case "chat_response":
            addMessageRef.current({
              role: "assistant",
              type: "chat_response",
              content: data.content,
            });
            break;
          case "summary":
            addMessageRef.current({
              role: "assistant",
              type: "summary",
              content: data.content,
            });
            break;
          case "complete":
            if (warningBufferRef.current.length > 0) {
              addMessageRef.current({
                role: "assistant",
                type: "warnings_group",
                content: "",
                warnings: [...warningBufferRef.current],
              });
              warningBufferRef.current = [];
            }
            setLoading(false);
            break;
          case "clarification_needed":
            addMessageRef.current({
              role: "assistant",
              type: "clarification_needed",
              content: "I need a few more details before I can design this architecture.",
              questions: data.questions,
              missing_fields: data.missing_fields,
            });
            setAwaitingClarification(data.questions);
            setLoading(false);
            break;
          case "validation_fixes_needed":
            addMessageRef.current({
              role: "assistant",
              type: "validation_fixes_needed",
              content: "Validation found issues that need your input.",
              fixes: data.fixes,
            });
            setValidationFixes(data.fixes);
            setLoading(false);
            break;
          case "failure_simulation_result":
            setFailureSimResult(data);
            break;
          case "simulate_scenario_result":
            if (data.failure_map) setFailureSimResult(data.failure_map);
            if (data.reasoning) {
              addMessageRef.current({
                role: "assistant",
                type: "summary",
                content: data.reasoning,
                scenario: data.scenario,
              });
            }
            setLoading(false);
            break;
          case "optimize_result":
            if (data.reasoning) {
              addMessageRef.current({
                role: "assistant",
                type: "summary",
                content: data.reasoning,
                commandType: "optimize",
                data: data.architecture ?? null,
              });
            }
            setLoading(false);
            break;
          case "audit_result":
          case "explain_result":
            if (data.reasoning) {
              addMessageRef.current({ role: "assistant", type: "summary", content: data.reasoning });
            }
            setLoading(false);
            break;
          case "error":
            setLoading(false);
            addMessageRef.current({
              role: "assistant",
              type: "warning",
              content: `Error: ${data.content ?? "Agent run failed"}`,
            });
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
      setLoading(false);
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

  const sendRaw = useCallback(
    (content: string) => {
      wsRef.current?.send({ type: "user_message", content });
    },
    [],
  );

  const sendFailureSim = useCallback((serviceId: string) => {
    wsRef.current?.send({ type: "failure_simulation", service_id: serviceId });
  }, []);

  const sendSimulation = useCallback((scenario: string) => {
    if (!wsRef.current) return;
    setLoading(true);
    addMessage({ role: "user", type: "reasoning", content: `/simulate ${scenario}` } as Message);
    wsRef.current.send({ type: "simulate_scenario", scenario });
  }, [addMessage, setLoading]);

  const sendOptimize = useCallback((goal: string) => {
    if (!wsRef.current) return;
    setLoading(true);
    addMessage({ role: "user", type: "reasoning", content: `/optimize ${goal}` } as Message);
    wsRef.current.send({ type: "optimize_architecture", goal });
  }, [addMessage, setLoading]);

  const sendApplyOptimization = useCallback((arch: any) => {
    if (!wsRef.current) return;
    setLoading(true);
    addMessage({ role: "user", type: "reasoning", content: "Implement optimization suggestions" } as Message);
    // Send as user_message with JSON payload — backend extracts arch and runs agent
    wsRef.current.send({ type: "user_message", content: JSON.stringify({ type: "apply_optimization", architecture: arch }) });
  }, [addMessage, setLoading]);

  const sendAudit = useCallback(() => {
    if (!wsRef.current) return;
    setLoading(true);
    addMessage({ role: "user", type: "reasoning", content: `/audit` } as Message);
    wsRef.current.send({ type: "audit_architecture" });
  }, [addMessage, setLoading]);

  const sendExplain = useCallback((audience: string) => {
    if (!wsRef.current) return;
    setLoading(true);
    addMessage({ role: "user", type: "reasoning", content: `/explain ${audience}` } as Message);
    wsRef.current.send({ type: "explain_architecture", audience });
  }, [addMessage, setLoading]);

  return { sendMessage, sendRaw, sendFailureSim, sendSimulation, sendOptimize, sendAudit, sendExplain, sendApplyOptimization };
}
