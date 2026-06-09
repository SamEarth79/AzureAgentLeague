export type EdgeConnectionType = "sync" | "async" | "event-driven";

const EDGE_TYPE_MAP: Record<string, EdgeConnectionType> = {
  "Compute→Messaging": "event-driven",
  "Messaging→Compute": "event-driven",
  "Compute→AI": "sync",
  "AI→Compute": "sync",
  "AI→Storage": "sync",
  "Compute→Storage": "sync",
  "Compute→Networking": "sync",
  "Networking→Compute": "sync",
  "Storage→Compute": "sync",
  "Storage→AI": "sync",
  "Messaging→Storage": "async",
  "Messaging→AI": "async",
  "Messaging→Messaging": "async",
};

export function inferEdgeType(
  sourceCategory: string,
  targetCategory: string
): EdgeConnectionType {
  const key = `${sourceCategory}→${targetCategory}`;
  return EDGE_TYPE_MAP[key] || "sync";
}
