import { useState } from "react";
import { Cpu, Database, MessageSquare, Brain, Globe, HardDrive, Shield, Activity, Server } from "lucide-react";
import { SERVICE_CATALOG } from "../../lib/serviceCatalog";
import { useArchitectureStore } from "../../stores/architectureStore";

const CATEGORY_CONFIG: Record<string, { color: string; bg: string; Icon: any }> = {
  Compute:    { color: "#f59e0b", bg: "rgba(245,158,11,0.15)",  Icon: Cpu           },
  Storage:    { color: "#14b8a6", bg: "rgba(20,184,166,0.15)",  Icon: HardDrive     },
  Messaging:  { color: "#ef4444", bg: "rgba(239,68,68,0.15)",   Icon: MessageSquare },
  AI:         { color: "#8b5cf6", bg: "rgba(139,92,246,0.15)",  Icon: Brain         },
  Networking: { color: "#00d4ff", bg: "rgba(0,212,255,0.15)",   Icon: Globe         },
  Management: { color: "#94a3b8", bg: "rgba(148,163,184,0.15)", Icon: Activity      },
  Security:   { color: "#10b981", bg: "rgba(16,185,129,0.15)",  Icon: Shield        },
  Database:   { color: "#6366f1", bg: "rgba(99,102,241,0.15)",  Icon: Database      },
  Default:    { color: "#00d4ff", bg: "rgba(0,212,255,0.15)",   Icon: Server        },
};

export default function NodePicker({ className }: { className?: string }) {
  const [filter, setFilter] = useState("All");
  const addService = useArchitectureStore((s) => s.addServiceManually);

  const categories = ["All", "Compute", "Storage", "Messaging", "AI", "Networking", "Management", "Security"];
  const filtered =
    filter === "All" ? SERVICE_CATALOG : SERVICE_CATALOG.filter((s) => s.category === filter);

  const handleDragStart = (e: React.DragEvent, service: (typeof SERVICE_CATALOG)[0]) => {
    e.dataTransfer.setData("application/json", JSON.stringify(service));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className={`${className} flex flex-col`}>
      <div className="p-3 border-b border-white/10 flex justify-between items-center gap-3">
        <h3 className="font-semibold text-sm shrink-0">Azure Services</h3>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className="text-xs px-2 py-1 rounded whitespace-nowrap transition"
                style={
                  filter === cat
                    ? { background: cfg ? `${cfg.color}22` : "rgba(0,212,255,0.15)", color: cfg?.color ?? "#00d4ff", border: `1px solid ${cfg?.color ?? "#00d4ff"}44` }
                    : { color: "#64748b", border: "1px solid transparent" }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 grid grid-cols-4 gap-2 content-start">
        {filtered.map((service) => {
          const cfg = CATEGORY_CONFIG[service.category] || CATEGORY_CONFIG["Default"];
          const { color, bg, Icon } = cfg;
          return (
            <div
              key={service.id}
              draggable
              onDragStart={(e) => handleDragStart(e, service)}
              className="rounded-lg p-2.5 cursor-move transition group"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = `${color}55`;
                (e.currentTarget as HTMLDivElement).style.background = `${color}08`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.08)";
                (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.03)";
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded shrink-0" style={{ background: bg }}>
                  <Icon size={13} style={{ color }} />
                </div>
                <div className="text-xs font-medium text-foreground truncate">
                  {service.name}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
                {service.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
