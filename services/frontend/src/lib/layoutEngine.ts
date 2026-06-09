import dagre from "dagre";
import { Node, Edge } from "reactflow";
import type { Service, Connection } from "../types/architecture";

export function getLayoutedElements(services: Service[], connections: Connection[]) {
  const nodes: Node[] = services.map((service) => {
    let pos = service.position;

    if (!pos) {
      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120 });
      g.setDefaultEdgeLabel(() => ({}));

      services.forEach((s) => {
        g.setNode(s.id, { width: 190, height: 70 });
      });

      connections.forEach((conn) => {
        g.setEdge(conn.source_id, conn.target_id);
      });

      dagre.layout(g);
      const dagrePos = g.node(service.id);
      pos = { x: dagrePos.x - 90, y: dagrePos.y - 40 };
    }

    return {
      id: service.id,
      type: "serviceNode",
      position: pos,
      data: service,
      draggable: true,
      deletable: true,
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
