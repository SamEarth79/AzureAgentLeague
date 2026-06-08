import { Handle, Position, NodeProps } from "reactflow";
import {
  Cpu, Database, MessageSquare, Brain, Globe,
  HardDrive, Shield, Activity, Server,
} from "lucide-react";
import type { Service } from "../../types/architecture";

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; Icon: any; label: string }> = {
  Compute:    { color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  Icon: Cpu,            label: "COMPUTE"    },
  Storage:    { color: "#14b8a6", bg: "rgba(20,184,166,0.15)",  Icon: HardDrive,      label: "STORAGE"    },
  Messaging:  { color: "#ef4444", bg: "rgba(239,68,68,0.15)",   Icon: MessageSquare,  label: "QUEUE"      },
  AI:         { color: "#8b5cf6", bg: "rgba(139,92,246,0.15)",  Icon: Brain,          label: "AI"         },
  Networking: { color: "#00d4ff", bg: "rgba(0,212,255,0.15)",   Icon: Globe,          label: "NETWORKING" },
  Management: { color: "#94a3b8", bg: "rgba(148,163,184,0.15)", Icon: Activity,       label: "MONITORING" },
  Security:   { color: "#10b981", bg: "rgba(16,185,129,0.15)",  Icon: Shield,         label: "SECURITY"   },
  Database:   { color: "#6366f1", bg: "rgba(99,102,241,0.15)",  Icon: Database,       label: "DATABASE"   },
  Default:    { color: "#00d4ff", bg: "rgba(0,212,255,0.15)",   Icon: Server,         label: "SERVICE"    },
};

function inferCategory(type: string): string {
  const t = type.toLowerCase();
  if (/function|app service|kubernetes|container apps/.test(t)) return "Compute";
  if (/blob|cosmos|sql|redis/.test(t)) return "Storage";
  if (/service bus|event grid|event hub|queue storage/.test(t)) return "Messaging";
  if (/openai|ai search|intelligence|speech/.test(t)) return "AI";
  if (/api management|front door|cdn|dns/.test(t)) return "Networking";
  if (/monitor|insights/.test(t)) return "Management";
  if (/vault|key/.test(t)) return "Security";
  return "Default";
}

export default function ServiceNode({ data, selected }: NodeProps<Service>) {
  const category = data.category || inferCategory(data.type);
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG["Default"];
  const { color, bg, Icon, label } = cfg;

  const displayName = data.name || data.type.replace(/^Azure\s+/i, "");

  return (
    <div
      style={{
        background: "#111118",
        border: `1px solid ${selected ? color : "transparent"}`,
        borderRadius: 14,
        padding: "12px 14px 22px 14px",
        minWidth: 170,
        boxShadow: selected
          ? `0 0 0 1px ${color}33, 0 8px 32px rgba(0,0,0,0.6)`
          : "0 4px 24px rgba(0,0,0,0.5)",
        position: "relative",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = color;
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 1px ${color}22, 0 8px 32px rgba(0,0,0,0.6)`;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 24px rgba(0,0,0,0.5)";
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 8, height: 8, border: "none", left: -4 }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            background: bg,
            borderRadius: 8,
            padding: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc", lineHeight: 1.2 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, lineHeight: 1.3 }}>
            {data.type}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#475569",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: 3,
            }}
          >
            {label}
          </div>
        </div>
      </div>

      {data.cost_estimate != null && (
        <div
          style={{
            position: "absolute",
            bottom: -10,
            right: 12,
            background: "#f59e0b",
            color: "#000",
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 12,
            padding: "2px 8px",
            boxShadow: "0 2px 8px rgba(245,158,11,0.4)",
          }}
        >
          ${data.cost_estimate}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: color, width: 8, height: 8, border: "none", right: -4 }}
      />
    </div>
  );
}
