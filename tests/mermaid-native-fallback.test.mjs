import test from "node:test";
import assert from "node:assert/strict";
import { fallbackFlowchartFromSource, isFlowchartSource, renderedMermaidElement } from "../mermaid-native.js";

test("fallback flowchart parser keeps labels out of the node list and preserves swimlanes", () => {
  const source = `flowchart TD
subgraph APP["Aplicativo"]
  login["Autenticar usuário"] --> balance{"Saldo suficiente?"}
end`;
  const graph = fallbackFlowchartFromSource(source);
  assert.deepEqual(graph.vertices.map(node => node.id).sort(), ["balance", "login"]);
  assert.equal(graph.vertices.find(node => node.id === "balance").type, "diamond");
  assert.deepEqual(graph.groups[0].nodes.sort(), ["balance", "login"]);
});

test("non-flowchart Mermaid is stored as a visual native diagram", () => {
  const source = `classDiagram
  Animal <|-- Duck`;
  assert.equal(isFlowchartSource(source), false);
  const [element] = renderedMermaidElement(source, { x: 10, y: 20 }, () => "visual");
  assert.deepEqual(element, { id: "visual", type: "mermaid-render", title: "Diagrama Mermaid", code: source, x: 70, y: 90, width: 920, height: 640 });
});
