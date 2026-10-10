import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { nativeElementsFromMermaid } from '../lib/render-diagram.js';
import { fallbackFlowchartFromSource, nativeElements } from '../mermaid-native.js';
import { layoutElements } from '../layout.js';
const source=fs.readFileSync(new URL('./fixtures/voltpix.mmd',import.meta.url),'utf8');
test('VoltPix: native horizontal swimlanes, labels, styles and obstacle-free orthogonal routes',async()=>{
const elements=await nativeElementsFromMermaid(source);
const fallback=await nativeElements(fallbackFlowchartFromSource(source));
for(const set of [elements,fallback]){
  const shapes=set.filter(e=>e.type==='shape'),lanes=set.filter(e=>e.type==='lane'),edges=set.filter(e=>e.type==='connector');
  assert.equal(shapes.length,20);assert.equal(lanes.length,4);assert.equal(edges.length,20);
  assert.deepEqual(lanes.map(e=>e.sourceId),['RAIA1','RAIA2','RAIA3','RAIA4']);
  assert.equal(new Set(lanes.map(e=>e.width)).size,1);
  assert.equal(new Set(lanes.map(e=>e.x)).size,1);
  assert.equal(shapes.find(e=>e.sourceId==='E11').fillColor,'#F96');
  assert.equal(edges.filter(e=>e.text==='Sim').length,4);assert.equal(edges.filter(e=>e.text==='Não').length,4);
  for(const node of shapes){const lane=lanes.find(l=>l.id===node.laneId);assert.ok(lane);assert.ok(node.x>=lane.x&&node.x+node.width<=lane.x+lane.width);assert.ok(node.y>=lane.y+42&&node.y+node.height<=lane.y+lane.height);}
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++){const a=shapes[i],b=shapes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);}
  for(const edge of edges){
    const points=edge.route.points;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];assert.ok(a.x===b.x||a.y===b.y,`diagonal ${edge.id}`);
      for(const obstacle of shapes.filter(n=>n.id!==edge.from&&n.id!==edge.to)){
        const vertical=a.x===b.x,hit=vertical?a.x>obstacle.x+.1&&a.x<obstacle.x+obstacle.width-.1&&Math.max(a.y,b.y)>obstacle.y+.1&&Math.min(a.y,b.y)<obstacle.y+obstacle.height-.1:a.y>obstacle.y+.1&&a.y<obstacle.y+obstacle.height-.1&&Math.max(a.x,b.x)>obstacle.x+.1&&Math.min(a.x,b.x)<obstacle.x+obstacle.width-.1;
        assert.equal(hit,false,`${shapes.find(n=>n.id===edge.from).sourceId} -> ${shapes.find(n=>n.id===edge.to).sourceId} crosses ${obstacle.sourceId}`);
      }
    }
  }
}
});
test('swimlane cycles and self loops retain every node without loading ELK',async()=>{
  const graph=fallbackFlowchartFromSource(`flowchart TD
subgraph TEAM["Equipe"]
A["Entrada"] --> B{"Decisão?"}
B -- "Não" --> A
B --> C["Saída"]
C --> C
end`);
  const elements=await nativeElements(graph);
  assert.equal(elements.filter(e=>e.type==='shape').length,3);
  assert.equal(elements.filter(e=>e.type==='connector').length,4);
  for(const edge of elements.filter(e=>e.type==='connector'))assert.ok(edge.route?.points.length>1);
  const organized=await layoutElements(elements,'RIGHT');
  assert.deepEqual(organized.map(e=>e.id),elements.map(e=>e.id));
});
