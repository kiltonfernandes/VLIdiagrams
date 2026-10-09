import test from "node:test";
import assert from "node:assert/strict";
import ELK from "elkjs/lib/elk.bundled.js";
import { layoutElements, geometryKey, diagramBounds } from "../layout.js";

const node = (id, laneId) => ({id,type:"shape",shape:"process",text:id,x:0,y:0,width:180,height:105,...(laneId?{laneId}:{})});
const edge = (id, from, to, text = "") => ({id,type:"connector",from,to,text});
function assertGeometry(items) {
  const shapes=items.filter(e=>e.type==="shape");
  for(const shape of shapes) {
    for(const value of [shape.x,shape.y,shape.width,shape.height])assert.ok(Number.isFinite(value));
    const lane=items.find(e=>e.id===shape.laneId);
    if(lane){assert.ok(shape.x>=lane.x+176);assert.ok(shape.y>=lane.y);assert.ok(shape.x+shape.width<=lane.x+lane.width);assert.ok(shape.y+shape.height<=lane.y+lane.height);}
  }
  for(let i=0;i<shapes.length;i++)for(let j=i+1;j<shapes.length;j++) {
    const a=shapes[i],b=shapes[j];
    assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,`overlap ${a.id}/${b.id}`);
  }
  for(const line of items.filter(e=>e.type==="connector")) {
    assert.ok(line.route?.points.length>1,`missing route ${line.id}`);
    assert.equal(line.route.key,geometryKey(items));
    const points=line.route.points;
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i];
      assert.ok(Math.abs(a.x-b.x)<.01||Math.abs(a.y-b.y)<.01,`diagonal ${line.id}`);
      for(const obstacle of shapes.filter(e=>e.id!==line.from&&e.id!==line.to)) {
        const hit=Math.abs(a.x-b.x)<.01
          ? a.x>obstacle.x+.1&&a.x<obstacle.x+obstacle.width-.1&&Math.max(a.y,b.y)>obstacle.y+.1&&Math.min(a.y,b.y)<obstacle.y+obstacle.height-.1
          : a.y>obstacle.y+.1&&a.y<obstacle.y+obstacle.height-.1&&Math.max(a.x,b.x)>obstacle.x+.1&&Math.min(a.x,b.x)<obstacle.x+obstacle.width-.1;
        assert.equal(hit,false,`route ${line.id} crosses ${obstacle.id}`);
      }
    }
  }
}
for(const count of [50,150,500])test(`${count} steps with branches, a retry and four phases`,async()=>{
  const lanes=Array.from({length:4},(_,i)=>({id:`l${i}`,type:"lane",name:`Fase ${i+1}`,x:0,y:0,width:760,height:230}));
  const nodes=Array.from({length:count},(_,i)=>node(`n${i}`,`l${Math.min(3,Math.floor(i/(count/4)))}`));
  const edges=nodes.slice(1).map((n,i)=>edge(`e${i}`,nodes[i].id,n.id));
  edges.push(edge("retry",`n${Math.floor(count*.7)}`,`n${Math.floor(count*.4)}`,"Tentar novamente"));
  edges.push(edge("branch","n3","n7","Sim"));
  const input=[...lanes,...nodes,...edges],before=JSON.stringify(input);
  const out=await layoutElements(input,"DOWN",new ELK());
  assert.equal(JSON.stringify(input),before);
  assert.deepEqual(out.map(e=>e.id),input.map(e=>e.id));
  assertGeometry(out);
  const phases=out.filter(e=>e.type==="lane");
  for(let i=1;i<phases.length;i++)assert.ok(phases[i].y>phases[i-1].y);
  assert.equal(new Set(phases.map(e=>e.x)).size,1);
  assert.equal(new Set(phases.map(e=>e.width)).size,1);
  assert.ok(diagramBounds(out).height>5000||count===50);
});
test("self loops, parallel edges, disconnected nodes and reverse directions",async()=>{
  const input=[node("a"),node("b"),node("c"),edge("ab","a","b","Sim"),edge("ab2","a","b","Outro"),edge("aa","a","a","Voltar")];
  for(const direction of ["RIGHT","LEFT","UP","DOWN"]){
    const out=await layoutElements(input,direction,new ELK());assertGeometry(out);
    const a=out.find(e=>e.id==="a"),b=out.find(e=>e.id==="b");
    if(direction==="RIGHT")assert.ok(b.x>a.x);
    if(direction==="LEFT")assert.ok(b.x<a.x);
    if(direction==="UP")assert.ok(b.y<a.y);
    if(direction==="DOWN")assert.ok(b.y>a.y);
    const changed=structuredClone(out);changed[0].x+=1;assert.notEqual(geometryKey(changed),geometryKey(out));
  }
});

test('cycle inside a phase with an edge to an ungrouped step',async()=>{
  const input=[{id:'lane',type:'lane',name:'Fase',x:0,y:0,width:500,height:200},node('a','lane'),node('b','lane'),node('c'),edge('ab','a','b'),edge('bc','b','c','Sim'),edge('ba','b','a','Não')];
  const result=await layoutElements(input,'DOWN',new ELK());
  assertGeometry(result);assert.deepEqual(result.map(e=>e.id),input.map(e=>e.id));
});
