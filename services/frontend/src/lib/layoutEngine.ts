import dagre from "dagre";
import { Node, Edge } from "reactflow";
import type { Service, Connection } from "../types/architecture";

export function getLayoutedElements(services: Service[], connections: Connection[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));

  services.forEach((service) => {
    g.setNode(service.id, { width: 190, height: 70 });
  });

  connections.forEach((conn) => {
    g.setEdge(conn.source_id, conn.target_id);
  });

  dagre.layout(g);

  const nodes: Node[] = services.map((service) => {
    const pos = g.node(service.id);
    return {
      id: service.id,
      type: "serviceNode",
      position: service.position || { x: pos.x - 90, y: pos.y - 40 },
      data: service,
    };
  });

  const edges: Edge[] = connections.map((conn) => ({
    id: conn.id,
    source: conn.source_id,
    target: conn.target_id,
    type: "connectionEdge",
    data: conn,
  }));

  return { nodes, edges };
}
