import test from "node:test";
import assert from "node:assert/strict";
import { snapshotMermaid } from "../mermaid-native.js";
import { buildDiagramSvg } from "../export.js";

test("source Mermaid subgraphs become swimlanes when parser groups are absent", () => {
  const parsed = {
    type: "flowchart",
    db: {
      getVertices: () => new Map([
        ["start", { id: "start", text: "Início", type: "rect" }],
        ["check", { id: "check", text: "Saldo suficiente?", type: "diamond" }]
      ]),
      getEdges: () => [],
      getDirection: () => "TD"
    }
  };
  const source = `flowchart TD
subgraph FIN["Financeiro"]
  start["Início"] --> check{"Saldo suficiente?"}
end`;
  const snapshot = snapshotMermaid(parsed, value => String(value), source);
  assert.equal(snapshot.groups.length, 1);
  assert.equal(snapshot.groups[0].title, "Financeiro");
  assert.deepEqual(snapshot.groups[0].nodes.sort(), ["check", "start"]);
});

test("SVG export retains a swimlane and draws decisions as true diamonds", () => {
  const diagram = {
    title: "Fluxo",
    elements: [
      { id: "lane", type: "lane", name: "Financeiro", x: 0, y: 0, width: 480, height: 260 },
      { id: "check", type: "shape", shape: "decision", text: "Saldo suficiente?", laneId: "lane", x: 210, y: 55, width: 150, height: 150 }
    ]
  };
  const svg = buildDiagramSvg(diagram).svg;
  assert.ok(svg.includes("Financeiro"));
  assert.ok(svg.includes(">RAIA<"));
  assert.ok(svg.includes('points="75,0 150,75 75,150 0,75"'));
});
