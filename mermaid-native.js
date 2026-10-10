import { layoutElements } from "./layout.js";
import { sequenceFromDatabase, sequenceGeometry } from "./sequence.js";
const flowNodeTypes = [
  { type:"process", label:"Novo passo", symbol:"▭", width:180, height:105 },
  { type:"decision", label:"Nova decisão", symbol:"◇", width:150, height:150 },
  { type:"terminator", label:"Início / fim", symbol:"⬭", width:170, height:78 },
  { type:"io", label:"Entrada / saída", symbol:"▱", width:180, height:95 },
  { type:"document", label:"Documento", symbol:"▤", width:170, height:100 },
  { type:"database", label:"Dados / armazenamento", symbol:"▤", width:160, height:100 },
  { type:"subprocess", label:"Subprocesso", symbol:"▣", width:180, height:105 }
];

function mermaidShape(type){
  const shape=String(type||"rect").toLowerCase().replaceAll("_","-");
  if(["diamond","diam","decision"].includes(shape))return "decision";
  if(["stadium","terminator","pill","start","stop","circle","doublecircle","ellipse"].includes(shape))return "terminator";
  if(["lean-right","lean-r","lean-left","lean-l","parallelogram","parallelogram-alt","manual-input"].includes(shape))return "io";
  if(["cylinder","cyl","database","db","datastore"].includes(shape))return "database";
  if(["document","doc","docs","lined-document"].includes(shape))return "document";
  if(["subroutine","subproc","subprocess","processes"].includes(shape))return "subprocess";
  return "process";
}

function sourceSubgraphs(source, knownNodes, plainMermaidLabel) {
  if (!source) return [];
  const groups = [], stack = [];
  for (const rawLine of String(source).split(/\r?\n/)) {
    const line = rawLine.trim();
    const start = line.match(/^subgraph\s+(.+)$/i);
    if (start) {
      const raw = start[1].trim();
      const bracketed = raw.match(/^([^\s\[]+)\s*\[[\"']?(.+?)[\"']?\]$/);
      const quoted = raw.match(/^[\"'](.+)[\"']$/);
      const group = { id: bracketed?.[1] || raw.replace(/[\[]\"']/g, "").replace(/\s+/g, "-"), title: plainMermaidLabel(bracketed?.[2] || quoted?.[1] || raw), nodes: [] };
      groups.push(group); stack.push(group); continue;
    }
    if (/^end$/i.test(line)) { stack.pop(); continue; }
    if (!stack.length) continue;
    const identifiers = [...line.matchAll(/\b([A-Za-z_][\w-]*)\s*(?:\[|\(|\{|\[\[)/g)].map(match => match[1]);
    for (const nodeId of identifiers) {
      if (!knownNodes.has(nodeId)) continue;
      for (const group of stack) if (!group.nodes.includes(nodeId)) group.nodes.push(nodeId);
    }
  }
  return groups.filter(group => group.nodes.length);
}
export function snapshotMermaid(parsed,plainMermaidLabel,source=""){
 const db=parsed.db||parsed.parser?.yy;
    const diagramType=String(parsed.type||parsed.diagramType||"").toLowerCase();
    if(diagramType.includes("sequence")) return {sequence:sequenceFromDatabase(db,plainMermaidLabel)};
    if(!/flowchart|graph|swimlane/.test(diagramType)||!db?.getVertices||!db?.getEdges) throw new Error("A conversão editável aceita fluxogramas e sequenceDiagram. Outros tipos podem ser mantidos como cartão Mermaid.");
    const rawVertices=db.getVertices(),vertices=[...(rawVertices instanceof Map?rawVertices.values():Array.isArray(rawVertices)?rawVertices:Object.values(rawVertices||{}))].map(v=>({...v,text:plainMermaidLabel(v.text||v.id)}));
    const edges=Array.from(db.getEdges()||[]).map(e=>({...e,text:plainMermaidLabel(e.text||"")}));
    const knownNodes=new Set(vertices.map(vertex=>String(vertex.id)));
    const parserGroups=typeof db.getSubGraphs==="function"?(db.getSubGraphs()||[]).map(group=>({...group,title:plainMermaidLabel(group.title||group.id),nodes:[...(group.nodes||[])]})).filter(group=>group.nodes.some(node=>knownNodes.has(String(node)))):[];
    const groups=parserGroups.length ? parserGroups : sourceSubgraphs(source,knownNodes,plainMermaidLabel);
    const direction=typeof db.getDirection==="function"?String(db.getDirection()||"TD").toUpperCase():"TD";
    return {diagramType,vertices,edges,groups,direction};
}
export async function nativeElements(graph,offset={x:0,y:0},engine,makeId=()=>crypto.randomUUID()){
  const plainMermaidLabel=value=>String(value??"");
  if(graph.sequence){const size=sequenceGeometry(graph.sequence);return [{id:makeId(),type:"sequence",title:"Diagrama de sequência",model:graph.sequence,x:60+offset.x,y:70+offset.y,width:size.width,height:size.height+40}];}
  const {vertices,edges,groups,direction}=graph;
  if(!vertices.length)throw new Error("Não encontrei etapas neste fluxograma.");
  const byKey=new Map(),elements=[],assigned=new Set();
  for(const vertex of vertices){
    const key=String(vertex.id),shape=mermaidShape(vertex.type),preset=flowNodeTypes.find(item=>item.type===shape)||flowNodeTypes[0];
    const text=plainMermaidLabel(vertex.text||key);
    const available=shape==="decision"?preset.width*.63:preset.width-24;
    const lines=Math.ceil(text.length/Math.max(10,Math.floor(available/7)));
    const minimumHeight=Math.max(preset.height,shape==="decision"?(lines*20+16)/.48:lines*20+40);
    const decisionSize=shape==="decision"?Math.ceil(Math.max(preset.width,minimumHeight)):null;
    const item={id:makeId(),type:"shape",shape,text,colorMode:"theme",sourceId:key,x:0,y:0,width:decisionSize||preset.width,height:decisionSize||minimumHeight};
    byKey.set(key,item);elements.push(item);
  }
  // Resolve membership from inner groups, then retain the source group order.
  const membership=new Map();
  for(const group of [...groups].sort((a,b)=>a.nodes.length-b.nodes.length)){
    const members=group.nodes.map(String).filter(key=>byKey.has(key)&&!assigned.has(key));
    membership.set(group,members);members.forEach(key=>assigned.add(key));
  }
  for(const group of groups){
    const members=membership.get(group);if(!members.length)continue;
    const lane={id:makeId(),type:"lane",name:plainMermaidLabel(group.title||group.id||"Raia"),x:0,y:0,width:760,height:230};
    elements.push(lane);
    for(const key of members)byKey.get(key).laneId=lane.id;
  }
  for(const edge of edges){
    const from=byKey.get(String(edge.start)),to=byKey.get(String(edge.end));
    if(from&&to)elements.push({id:makeId(),type:"connector",from:from.id,to:to.id,text:plainMermaidLabel(edge.text||""),stroke:edge.stroke});
  }
  const layoutDirection=({LR:"RIGHT",RL:"LEFT",BT:"UP"})[direction]||"DOWN";
  return layoutElements(elements,layoutDirection,engine,{x:60+offset.x,y:70+offset.y});
}
