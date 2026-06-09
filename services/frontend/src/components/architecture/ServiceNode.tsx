import { useState } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { X, Cpu, Database, MessageSquare, Brain, Globe, HardDrive, Shield, Activity, Server } from "lucide-react";
import type { Service } from "../../types/architecture";
import { useArchitectureStore } from "../../stores/architectureStore";

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

const FAILURE_STYLES: Record<string, { border: string; shadow: string; opacity: number; badge?: string; badgeColor?: string }> = {
  failed:         { border: "#ef4444", shadow: "0 0 0 2px #ef4444aa, 0 0 32px 8px #ef444466", opacity: 1, badge: "FAILED",   badgeColor: "#ef4444" },
  direct_failure: { border: "#f97316", shadow: "0 0 0 2px #f97316aa, 0 0 24px 6px #f9731655", opacity: 1, badge: "FAILING",  badgeColor: "#f97316" },
  degraded:       { border: "#f59e0b", shadow: "0 0 0 2px #f59e0baa, 0 0 18px 4px #f59e0b44", opacity: 1, badge: "DEGRADED", badgeColor: "#f59e0b" },
  delayed_impact: { border: "#eab308", shadow: "0 0 0 1px #eab308aa, 0 0 12px 2px #eab30833", opacity: 1, badge: "AT RISK",  badgeColor: "#eab308" },
  unaffected:     { border: "transparent", shadow: "0 4px 24px rgba(0,0,0,0.5)", opacity: 0.25 },
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

export default function ServiceNode({ data, selected }: NodeProps<Service & { failureImpact?: string }>) {
  const [hovered, setHovered] = useState(false);
  const removeService = useArchitectureStore((s) => s.removeService);

  const category = data.category || inferCategory(data.type);
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG["Default"];
  const { color, bg, Icon, label } = cfg;

  const displayName = data.name || data.type.replace(/^Azure\s+/i, "");

  const failureImpact = data.failureImpact;
  const failureStyle = failureImpact ? FAILURE_STYLES[failureImpact] : undefined;

  const borderColor = failureStyle ? failureStyle.border : selected ? color : hovered ? color : "transparent";
  const boxShadow = failureStyle
    ? failureStyle.shadow
    : selected
      ? `0 0 0 1px ${color}33, 0 8px 32px rgba(0,0,0,0.6)`
      : hovered
        ? `0 0 0 1px ${color}22, 0 8px 32px rgba(0,0,0,0.6)`
        : "0 4px 24px rgba(0,0,0,0.5)";
  const opacity = failureStyle ? failureStyle.opacity : 1;

  return (
    <div
      style={{
        background: "#111118",
        overflow: "visible",
        border: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: "12px 14px 22px 14px",
        minWidth: 170,
        boxShadow,
        opacity,
        position: "relative",
        cursor: "pointer",
        transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.2s",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: color, width: 8, height: 8, border: "none", left: -4 }}
      />

      {/* Failure impact badge */}
      {failureStyle?.badge && (
        <div style={{
          position: "absolute",
          top: -10,
          left: 12,
          background: `${failureStyle.badgeColor}22`,
          border: `1px solid ${failureStyle.badgeColor}66`,
          borderRadius: 6,
          padding: "1px 6px",
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: failureStyle.badgeColor,
        }}>
          {failureStyle.badge}
        </div>
      )}

      {/* Delete button — visible on hover or selected */}
      {(hovered || selected) && !failureImpact && (
        <button
          onClick={(e) => { e.stopPropagation(); removeService(data.id); }}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 6,
            padding: "2px 4px",
            cursor: "pointer",
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            lineHeight: 1,
          }}
        >
          <X size={11} />
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ background: bg, borderRadius: 8, padding: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={18} style={{ color }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#f8fafc", lineHeight: 1.2 }}>
            {displayName}
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, lineHeight: 1.3 }}>
            {data.type}
          </div>
          <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 3 }}>
            {label}
          </div>
        </div>
      </div>

      {data.cost_estimate != null && (
        <div style={{
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
        }}>
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
