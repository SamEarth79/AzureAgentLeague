import { create } from "zustand";
import type { Message, Architecture, Service } from "../types/architecture";

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
}

export const useArchitectureStore = create<ArchitectureStore>((set) => ({
  sessionId: null,
  setSessionId: (id) => set({ sessionId: id }),

  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),

  architecture: null,
  setArchitecture: (arch) => set({ architecture: arch }),

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

  addServiceManually: (service) =>
    set((state) => ({
      architecture: state.architecture
        ? {
            ...state.architecture,
            services: [...state.architecture.services, service],
          }
        : null,
    })),

  removeService: (serviceId) =>
    set((state) => ({
      architecture: state.architecture
        ? {
            ...state.architecture,
            services: state.architecture.services.filter((s) => s.id !== serviceId),
            connections: state.architecture.connections.filter(
              (c) => c.source_id !== serviceId && c.target_id !== serviceId
            ),
          }
        : null,
    })),

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
}));
