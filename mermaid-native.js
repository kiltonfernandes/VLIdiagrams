import { layoutElements } from "./layout.js";
import { sequenceFromDatabase, sequenceGeometry } from "./sequence.js";
import { wrapText } from './svg.js';
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
export function fallbackFlowchartFromSource(source, plainMermaidLabel=value=>String(value??"")) {
  const vertices = new Map(), edges = [], lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
  const direction = lines.map(line=>line.trim()).map(line=>line.match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/i)?.[1]).find(Boolean)?.toUpperCase() || "TD";
  const addNode = (id, label, type) => {
    if (!id || /^(flowchart|graph|subgraph|end|class|classDef|style|linkStyle)$/i.test(id)) return;
    const existing = vertices.get(id);
    vertices.set(id, { id, text: plainMermaidLabel(label ?? existing?.text ?? id).replace(/^["']|["']$/g,''), type: type ?? existing?.type ?? 'rect' });
  };
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || /^(flowchart|graph|subgraph|end|class|classDef|style|linkStyle|direction|%%)\b/i.test(line)) continue;
    const definitions=/\b([A-Za-z_][\w-]*)\s*(\(\[(.*?)\]\)|\[\[(.*?)\]\]|\[\((.*?)\)\]|\[(.*?)\]|\{(.*?)\}|\((.*?)\))/g;
    const normalized=line.replace(definitions,(whole,id,token,stadium,subprocess,database,bracket,diamond,rounded)=>{
      addNode(id,stadium??subprocess??database??bracket??diamond??rounded,diamond!==undefined?'diamond':stadium!==undefined||rounded!==undefined?'stadium':database!==undefined?'cylinder':subprocess!==undefined?'subroutine':'rect');
      return id;
    });
    const pattern=/([A-Za-z_][\w-]*)\s*(?:--\s*(?:"([^"]*)"|'([^']*)'|([^<>]*?))\s*)?(-->|==>|-\.->|---)\s*(?:\|([^|]*)\|\s*)?([A-Za-z_][\w-]*)/g;
    let match;
    while((match=pattern.exec(normalized))){
      const [,start,quoted,single,bare,arrow,piped,end]=match;
      addNode(start);addNode(end);edges.push({start,end,text:plainMermaidLabel(quoted??single??piped??bare??'').trim(),stroke:arrow==='-.->'?'dotted':arrow==='==>'?'thick':'normal'});
      pattern.lastIndex-=end.length;
    }
    if(/^[A-Za-z_][\w-]*$/.test(normalized))addNode(normalized);
  }
  const knownNodes = new Set(vertices.keys()), groups = sourceSubgraphs(source, knownNodes, plainMermaidLabel);
  if (!vertices.size) throw new Error("Não encontrei etapas em formato de fluxograma.");
  return { diagramType:"flowchart", vertices:withSourceStyles([...vertices.values()],source), edges, groups, direction };
}

function withSourceStyles(vertices,source){
  const definitions=new Map(),nodeClasses=new Map(),direct=new Map();
  for(const raw of String(source||'').split(/\r?\n/)){
    let match=raw.trim().match(/^classDef\s+([\w-]+)\s+(.+?);?$/);
    if(match){definitions.set(match[1],match[2]);continue;}
    match=raw.trim().match(/^class\s+([\w, -]+)\s+([\w-]+);?$/);
    if(match)for(const id of match[1].split(',').map(s=>s.trim()))nodeClasses.set(id,match[2]);
    match=raw.trim().match(/^style\s+([\w-]+)\s+(.+?);?$/);
    if(match)direct.set(match[1],match[2]);
    for(const inline of raw.matchAll(/\b([\w-]+)(?:\[[^\]]*\]|\{[^}]*\}|\([^)]*\))?:::([\w-]+)/g))nodeClasses.set(inline[1],inline[2]);
  }
  return vertices.map(vertex=>{
    const styles=[definitions.get('default'),...(vertex.classes||[]).map(name=>definitions.get(name)),definitions.get(nodeClasses.get(vertex.id)),...(vertex.styles||[]),direct.get(vertex.id)].filter(Boolean).join(',');
    const visualStyle={};
    for(const declaration of styles.split(/[,;]/)){
      const at=declaration.indexOf(':');if(at<0)continue;
      const key=declaration.slice(0,at).trim(),value=declaration.slice(at+1).trim();
      if(['fill','stroke','color'].includes(key)&&/^(#[\da-f]{3,8}|[a-z]{1,24}|rgba?\([\d.,%\s]+\))$/i.test(value))visualStyle[{fill:'fillColor',stroke:'borderColor',color:'textColor'}[key]]=value;
      if(key==='stroke-width'&&/^\d+(?:\.\d+)?(?:px)?$/.test(value))visualStyle.borderWidth=Math.max(.5,Math.min(8,parseFloat(value)));
    }
    return {...vertex,visualStyle};
  });
}

export function isFlowchartSource(source) {
  return /^\s*(?:flowchart|graph)\b/im.test(String(source || ""));
}
export function renderedMermaidElement(source, offset={x:0,y:0}, makeId=()=>crypto.randomUUID()) {
  return [{ id:makeId(), type:"mermaid-render", title:"Diagrama Mermaid", code:String(source || ""), x:60+offset.x, y:70+offset.y, width:920, height:640 }];
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
    const sourceGroups=sourceSubgraphs(source,knownNodes,plainMermaidLabel);
    const groups=sourceGroups.length ? sourceGroups.map(group=>({...group,nodes:[...new Set([...group.nodes,...(parserGroups.find(g=>g.id===group.id)?.nodes||[])])]})) : parserGroups;
    const direction=typeof db.getDirection==="function"?String(db.getDirection()||"TD").toUpperCase():"TD";
    return {diagramType,vertices:withSourceStyles(vertices,source),edges,groups,direction};
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
    const swimlane=groups.length>0,width=swimlane?(shape==='decision'?200:190):preset.width;
    const available=shape==='decision'?width*.62:width-28,lines=wrapText(text,available,13).length;
    const height=swimlane?Math.max(shape==='decision'?132:74,shape==='decision'?(lines*18.85+8)/.52:lines*18.85+24):Math.max(preset.height,lines*20+40);
    const item={id:makeId(),type:"shape",shape,text,colorMode:"theme",sourceId:key,x:0,y:0,width,height:Math.ceil(height),flowStyle:swimlane,...vertex.visualStyle};
    if(swimlane&&!item.fillColor){item.fillColor=shape==='decision'?'#fff8dc':shape==='terminator'?(/recus|devolvid|suspeita|falh|erro/i.test(text)?'#fff0f0':'#e6f6ed'):'#fff';}
    if(swimlane&&!item.borderColor)item.borderColor=shape==='decision'?'#d4a62b':shape==='terminator'?(/recus|devolvid|suspeita|falh|erro/i.test(text)?'#d76161':'#55a879'):'#9aa5b1';
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
    const lane={id:makeId(),type:"lane",name:plainMermaidLabel(group.title||group.id||"Raia"),sourceId:String(group.id),layout:'swimlane',x:0,y:0,width:760,height:230};
    elements.push(lane);
    for(const key of members)byKey.get(key).laneId=lane.id;
  }
  for(const edge of edges){
    const from=byKey.get(String(edge.start)),to=byKey.get(String(edge.end));
    if(from&&to)elements.push({id:makeId(),type:"connector",from:from.id,to:to.id,text:plainMermaidLabel(edge.text||""),stroke:edge.stroke});
  }
  const layoutDirection=groups.length?(direction==='RL'?'LEFT':'RIGHT'):({LR:"RIGHT",RL:"LEFT",BT:"UP"})[direction]||"DOWN";
  return layoutElements(elements,layoutDirection,engine,{x:60+offset.x,y:70+offset.y});
}

