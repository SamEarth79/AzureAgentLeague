import { create } from "zustand";
import type { Message, Architecture, Service, Connection, ClarificationQuestion, ValidationFixProposal, FailureSimResult } from "../types/architecture";
import { SERVICE_CATALOG } from "../lib/serviceCatalog";

function normalizeCosts(services: Service[]): Service[] {
  return services.map((s) => {
    // Only fill in cost when the backend didn't provide one (manual drops, unknown types)
    if (s.cost_estimate != null) return s;
    const entry = SERVICE_CATALOG.find((c) => c.type === s.type);
    return entry ? { ...s, cost_estimate: entry.default_cost_estimate } : s;
  });
}

function sumCosts(services: Service[]): number {
  return services.reduce((acc, s) => acc + (s.cost_estimate ?? 0), 0);
}

interface ArchitectureStore {
  sessionId: string | null;
  setSessionId: (id: string) => void;

  messages: Message[];
  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  architecture: Architecture | null;
  setArchitecture: (arch: Architecture) => void;

  selectedNodeId: string | null;
  setSelectedNode: (id: string | null) => void;

  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  isConnected: boolean;
  setConnected: (connected: boolean) => void;

  detailLevel: "simple" | "detailed" | "expert";
  setDetailLevel: (level: "simple" | "detailed" | "expert") => void;

  pendingMessage: string | null;
  setPendingMessage: (msg: string | null) => void;

  addServiceManually: (service: Service) => void;
  removeService: (serviceId: string) => void;
  updateServicePosition: (serviceId: string, x: number, y: number) => void;

  addConnectionManually: (conn: Connection) => void;

  awaitingClarification: ClarificationQuestion[] | null;
  clarificationAnswers: Record<string, string>;
  setAwaitingClarification: (questions: ClarificationQuestion[] | null) => void;
  setClarificationAnswer: (questionId: string, answer: string) => void;
  clearClarifications: () => void;

  pendingValidationFixes: ValidationFixProposal[] | null;
  validationFixChoices: Record<string, boolean>;
  setValidationFixChoice: (fixId: string, apply: boolean) => void;
  setValidationFixes: (fixes: ValidationFixProposal[] | null) => void;
  clearValidationFixes: () => void;

  failureSimResult: FailureSimResult | null;
  setFailureSimResult: (result: FailureSimResult | null) => void;
  clearFailureSim: () => void;
}

export const useArchitectureStore = create<ArchitectureStore>((set) => ({
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),

  architecture: null,
  setArchitecture: (arch) => {
    const services = normalizeCosts(arch.services);
    set({
      architecture: {
        ...arch,
        services,
        metadata: {
          ...arch.metadata,
          estimated_cost_monthly: sumCosts(services),
        },
      },
    });
  },

  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),

  isLoading: false,
  setLoading: (loading) => set({ isLoading: loading }),

  isConnected: false,
  setConnected: (connected) => set({ isConnected: connected }),

  detailLevel: "detailed",
  setDetailLevel: (level) => set({ detailLevel: level }),

  pendingMessage: null,
  setPendingMessage: (msg) => set({ pendingMessage: msg }),

  awaitingClarification: null,
  clarificationAnswers: {},
  setAwaitingClarification: (questions) =>
    set({ awaitingClarification: questions }),
  setClarificationAnswer: (questionId, answer) =>
    set((state) => ({
      clarificationAnswers: { ...state.clarificationAnswers, [questionId]: answer },
    })),
  clearClarifications: () =>
    set({ awaitingClarification: null, clarificationAnswers: {} }),

  pendingValidationFixes: null,
  validationFixChoices: {},
  setValidationFixChoice: (fixId, apply) =>
    set((state) => ({
      validationFixChoices: { ...state.validationFixChoices, [fixId]: apply },
    })),
  setValidationFixes: (fixes) =>
    set({ pendingValidationFixes: fixes, validationFixChoices: {} }),
  clearValidationFixes: () =>
    set({ pendingValidationFixes: null, validationFixChoices: {} }),

  addServiceManually: (service) =>
    set((state) => {
      const prev = state.architecture;
      if (prev) {
        const services = [...prev.services, service];
        return {
          architecture: {
            ...prev,
            services,
            metadata: {
              ...prev.metadata,
              estimated_cost_monthly: sumCosts(services),
            },
          },
        };
      }
      return {
        architecture: {
          services: [service],
          connections: [],
          metadata: {
            estimated_cost_monthly: service.cost_estimate ?? 0,
            estimated_latency_p95: "",
            estimated_throughput: "",
            sla: "",
          },
          warnings: [],
        },
      };
    }),

  removeService: (serviceId) =>
    set((state) => {
      if (!state.architecture) return state;
      const services = state.architecture.services.filter((s) => s.id !== serviceId);
      return {
        architecture: {
          ...state.architecture,
          services,
          connections: state.architecture.connections.filter(
            (c) => c.source_id !== serviceId && c.target_id !== serviceId
          ),
          metadata: {
            ...state.architecture.metadata,
            estimated_cost_monthly: sumCosts(services),
          },
        },
      };
    }),

  updateServicePosition: (serviceId, x, y) =>
    set((state) => ({
      architecture: state.architecture
        ? {
            ...state.architecture,
            services: state.architecture.services.map((s) =>
              s.id === serviceId ? { ...s, position: { x, y } } : s
            ),
          }
        : null,
    })),

  addConnectionManually: (conn) =>
    set((state) => {
      if (!state.architecture) return state;
      const exists = state.architecture.connections.some(
        (c) => c.source_id === conn.source_id && c.target_id === conn.target_id
      );
      if (exists) return state;
      return {
        architecture: {
          ...state.architecture,
          connections: [...state.architecture.connections, conn],
        },
      };
    }),

  failureSimResult: null,
  setFailureSimResult: (result) => set({ failureSimResult: result }),
  clearFailureSim: () => set({ failureSimResult: null }),
}));
