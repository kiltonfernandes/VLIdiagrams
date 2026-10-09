// Layout calculation is independent of the editor and can be exercised in Node.
let enginePromise;
export async function getLayoutEngine() {
  if (!enginePromise) {
    enginePromise = import("https://cdn.jsdelivr.net/npm/elkjs@0.11.0/+esm")
      .then(module => new module.default())
      .catch(error => { enginePromise = null; throw error; });
  }
  return enginePromise;
}

export function geometryKey(elements) {
  let hash = 2166136261;
  const input = elements.filter(e => e.type !== "connector")
    .map(e => `${e.id}:${e.x}:${e.y}:${e.width}:${e.height}`).join("|");
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

export function diagramBounds(elements) {
  const items = elements.filter(e => e.type !== "connector");
  const points = elements.flatMap(e => e.route?.points || []);
  if (!items.length) return null;
  const left = Math.min(...items.map(e => e.x), ...points.map(p => p.x));
  const top = Math.min(...items.map(e => e.y), ...points.map(p => p.y));
  const right = Math.max(...items.map(e => e.x + (e.width || 180)), ...points.map(p => p.x));
  const bottom = Math.max(...items.map(e => e.y + (e.height || 105)), ...points.map(p => p.y));
  return { left, top, right, bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

// Return a new snapshot. The caller can cancel or undo without changing its input.
export async function layoutElements(elements, direction = "DOWN", engine, offset = { x: 60, y: 70 }) {
  const result = structuredClone(elements);
  const shapes = result.filter(e => e.type === "shape");
  if (!shapes.length) throw new Error("Adicione etapas para organizar o fluxo.");
  const shapeIds = new Set(shapes.map(e => e.id));
  const lanes = result.filter(e => e.type === "lane");
  const laneIds = new Set(lanes.map(e => e.id));
  const children = new Map(lanes.map(lane => [lane.id, []]));
  const free = [];
  for (const shape of shapes) {
    let laneId = laneIds.has(shape.laneId) ? shape.laneId : null;
    if (!laneId) {
      const cx = shape.x + shape.width / 2, cy = shape.y + shape.height / 2;
      const containing = lanes.filter(lane => cx >= lane.x + 176 && cx <= lane.x + lane.width && cy >= lane.y && cy <= lane.y + lane.height)
        .sort((a, b) => a.width * a.height - b.width * b.height);
      laneId = containing[0]?.id;
    }
    const node = { id: shape.id, width: shape.width || 180, height: shape.height || 105 };
    if (laneId) { shape.laneId = laneId; children.get(laneId).push(node); }
    else { delete shape.laneId; free.push(node); }
  }
  const options = {
    "elk.algorithm": "layered",
    "elk.direction": direction,
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.hierarchyHandling": "INCLUDE_CHILDREN",
    "elk.spacing.nodeNode": "42",
    "elk.layered.spacing.nodeNodeBetweenLayers": "72",
    "elk.spacing.edgeNode": "20",
    "elk.spacing.edgeEdge": "14",
    "elk.spacing.componentComponent": "64",
    "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
    "elk.layered.cycleBreaking.strategy": "GREEDY_MODEL_ORDER",
    "elk.layered.feedbackEdges": "true",
    "elk.randomSeed": "1",
    "elk.padding": "[top=24,left=24,bottom=24,right=24]"
  };
  const graph = {
    id: "vli-layout", layoutOptions: { ...options, "elk.partitioning.activate": lanes.length ? "true" : "false" },
    children: [
      ...lanes.filter(lane => children.get(lane.id).length).map((lane,index) => ({
        id: lane.id, children: children.get(lane.id),
        layoutOptions: { ...options, "elk.partitioning.partition": String(index), "elk.padding": "[top=36,left=204,bottom=36,right=36]" }
      })), ...free.map(node=>({...node,layoutOptions:{"elk.partitioning.partition":String(lanes.length)}}))
    ],
    edges: result.filter(e => e.type === "connector" && shapeIds.has(e.from) && shapeIds.has(e.to)).map(edge => ({
      id: edge.id, sources: [edge.from], targets: [edge.to],
      labels: edge.text ? [{ id: edge.id + "-label", text: edge.text, width: Math.max(32, String(edge.text).length * 7.2), height: 20 }] : []
    }))
  };
  const laidOut = await (engine || await getLayoutEngine()).layout(graph);
  const byId = new Map(result.map(e => [e.id, e]));
  const routes = [];
  const origins = new Map();
  const pendingEdges = [];
  function collect(node, x, y) {
    origins.set(node.id,{x,y});
    const item = byId.get(node.id);
    if (item) {
      item.x = x; item.y = y; item.width = node.width; item.height = node.height;
    }
    for (const edge of node.edges || []) pendingEdges.push({edge,owner:node.id});
    for (const child of node.children || []) collect(child, x + child.x, y + child.y);
  }
  collect(laidOut, offset.x, offset.y);
  for(const {edge,owner} of pendingEdges) {
      // ELK retains edges at the root but identifies their coordinate container.
      const {x,y}=origins.get(edge.container||owner)||offset;
      const connector = byId.get(edge.id);
      const section = edge.sections?.[0];
      if (!connector || !section) continue;
      const points = [section.startPoint, ...(section.bendPoints || []), section.endPoint]
        .map(p => ({ x: p.x + x, y: p.y + y }));
      const label = edge.labels?.[0];
      connector.route = { points, label: label && { x: x + label.x + label.width / 2, y: y + label.y + 14, anchor: "middle" } };
      routes.push(connector.route);
  }
  // Give sequential phase bands a shared header edge and shared outer boundary.
  // Nodes and routed lines retain the coordinates calculated together by ELK.
  if((direction==="DOWN"||direction==="UP")&&lanes.length>1){
    const active=lanes.filter(lane=>children.get(lane.id).length);
    const sorted=[...active].sort((a,b)=>a.y-b.y);
    const separated=sorted.every((lane,i)=>!i||lane.y>=sorted[i-1].y+sorted[i-1].height);
    if(separated){
      const left=Math.min(...active.map(lane=>lane.x)),right=Math.max(...active.map(lane=>lane.x+lane.width));
      for(const lane of active){lane.x=left;lane.width=right-left;}
    }
  }
  // Empty containers and annotations stay separate from the generated flow.
  const key = geometryKey(result);
  for (const route of routes) route.key = key;
  return result;
}
