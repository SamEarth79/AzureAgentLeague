import { Handle, Position, NodeProps } from "reactflow";
import { Database, Cpu, MessageSquare, Cloud, Brain } from "lucide-react";
import type { Service } from "../../types/architecture";

const iconMap: Record<string, any> = {
  Cpu,
  Database,
  MessageSquare,
  Cloud,
  Brain,
};

export default function ServiceNode({ data }: NodeProps<Service>) {
  const Icon = iconMap[data.icon] || Cloud;
  const isGrounded = data.reasoning?.includes("Foundry IQ");

  return (
    <div className="glass border border-white/20 rounded-lg p-3 min-w-[180px] shadow-lg hover:shadow-electric/20 transition group">
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-electric" />

      <div className="flex items-start gap-2">
        <div className="p-2 rounded bg-electric/20">
          <Icon size={20} className="text-electric" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{data.name}</div>
          <div className="text-xs text-muted-foreground">{data.type}</div>
          {data.cost_estimate != null && (
            <div className="text-xs text-success mt-1">${data.cost_estimate}/mo</div>
          )}
        </div>
      </div>

      {isGrounded && (
        <div className="mt-2 text-[10px] text-purple px-1.5 py-0.5 bg-purple/10 rounded inline-block">
          Foundry IQ ✓
        </div>
      )}

      {data.foundry_iq_docs_link && (
        <a
          href={data.foundry_iq_docs_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 text-[10px] text-purple hover:underline block"
        >
          View Azure Docs →
        </a>
      )}

      {data.foundry_iq_confidence != null && (
        <div className="mt-1 text-[10px] text-muted-foreground">
          Confidence: {Math.round(data.foundry_iq_confidence * 100)}%
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-electric" />
    </div>
  );
}
