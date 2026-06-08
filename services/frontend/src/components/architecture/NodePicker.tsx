import { useState } from "react";
import { Database, Cpu, MessageSquare, Cloud, Brain } from "lucide-react";
import { SERVICE_CATALOG } from "../../lib/serviceCatalog";
import { useArchitectureStore } from "../../stores/architectureStore";

const iconMap: Record<string, any> = {
  Database,
  Cpu,
  MessageSquare,
  Cloud,
  Brain,
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
      <div className="p-3 border-b border-white/10 flex justify-between items-center">
        <h3 className="font-semibold text-sm">Azure Services</h3>
        <div className="flex gap-1 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`text-xs px-2 py-1 rounded whitespace-nowrap transition ${
                filter === cat
                  ? "bg-electric text-white"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-4 gap-2 content-start">
        {filtered.map((service) => {
          const Icon = iconMap[service.icon] || Cloud;
          return (
            <div
              key={service.id}
              draggable
              onDragStart={(e) => handleDragStart(e, service)}
              className="glass border border-white/10 rounded-lg p-2.5 cursor-move hover:border-electric/50 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded bg-electric/10 group-hover:bg-electric/20 transition">
                  <Icon size={14} className="text-electric-soft" />
                </div>
                <div className="text-xs font-medium text-foreground">
                  {service.name}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground leading-tight">
                {service.description}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
