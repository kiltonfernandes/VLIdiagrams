import { xml, color, textBlock, wrapText, svgDocument } from './svg.js';
import { renderSequence } from './sequence.js';

export function exportFilename(title,scope=''){
  return (String(title||'diagrama').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'diagrama')+(scope?'-'+scope:'');
}
export function pngDimensions(width,height,quality=2){
  if(![width,height,quality].every(n=>Number.isFinite(n)&&n>0))throw new Error('Dimensões inválidas para exportação.');
  const scale=Math.min(quality,8192/width,8192/height,Math.sqrt(16000000/(width*height)));
  return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale)),scale,reduced:scale<quality-.001};
}
export function exportElements(elements,scope='full'){
  if(scope==='full')return structuredClone(elements);
  const lane=elements.find(e=>e.type==='lane'&&e.id===scope);
  if(!lane)throw new Error('Escolha uma fase existente.');
  const members=elements.filter(e=>e.type!=='lane'&&e.type!=='connector'&&(e.laneId===lane.id||(!e.laneId&&e.x>=lane.x+176&&e.x<lane.x+lane.width&&e.y>=lane.y&&e.y<lane.y+lane.height)));
  const ids=new Set(members.map(e=>e.id));
  return structuredClone([lane,...members,...elements.filter(e=>e.type==='connector'&&ids.has(e.from)&&ids.has(e.to))]);
}
function shapeSvg(e,t){
  const w=e.width||180,h=e.height||105,type=e.shape||'process',accent=color(e.colorMode==='custom'?e.color:({decision:t.decision,terminator:t.terminal,io:t.data,document:t.data,database:t.data,subprocess:t.subprocess}[type]||t.process));
  let outline=`<rect width="${w}" height="${h}" rx="${type==='terminator'?h/2:11}" fill="#fff" stroke="${accent}" stroke-width="1.5"/>`;
  if(type==='decision'){
    const points=`${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`;
    outline=`<polygon points="${points}" fill="#fffaf0" stroke="${accent}" stroke-width="2"/>`;
  }
  if(type==='io')outline=`<polygon points="${w*.18},0 ${w},0 ${w*.82},${h} 0,${h}" fill="#fff" stroke="${accent}" stroke-width="1.5"/>`;
  if(type==='document')outline=`<polygon points="0,0 ${w},0 ${w},${h*.84} ${w*.85},${h} ${w*.7},${h*.84} ${w*.55},${h} ${w*.4},${h*.84} ${w*.25},${h} ${w*.1},${h*.84} 0,${h}" fill="#fff" stroke="${accent}" stroke-width="1.5"/>`;
  if(type==='database')outline=`<path d="M 0 15 A ${w/2} 15 0 0 1 ${w} 15 V ${h-15} A ${w/2} 15 0 0 1 0 ${h-15} Z" fill="#fff" stroke="${accent}" stroke-width="1.5"/><ellipse cx="${w/2}" cy="15" rx="${w/2}" ry="15" fill="#fff" stroke="${accent}" stroke-width="1.5"/>`;
  if(type==='subprocess')outline+=`<path d="M 12 0 V ${h} M ${w-12} 0 V ${h}" stroke="${accent}"/>`;
  const available=type==='decision'?w*.63:type==='io'?w*.65:w-28,lines=wrapText(e.text,available,13).length;
  return `<g transform="translate(${e.x} ${e.y})">${outline}${textBlock(e.text,w/2,h/2-(lines-1)*9.425+4,available,{fill:t.ink,weight:600})}</g>`;
}
function overviewElements(diagram){
  const lanes=diagram.elements.filter(e=>e.type==='lane'),shapes=diagram.elements.filter(e=>e.type==='shape'),byId=new Map(shapes.map(e=>[e.id,e]));
  const group=e=>e.laneId||lanes.find(l=>e.x>=l.x+176&&e.x<l.x+l.width&&e.y>=l.y&&e.y<l.y+l.height)?.id;
  const cards=lanes.map((l,i)=>{
    const steps=shapes.filter(e=>group(e)===l.id),links=new Map();
    for(const c of diagram.elements.filter(e=>e.type==='connector'&&group(byId.get(e.from)||{})===l.id)){
      const dest=group(byId.get(c.to)||{});if(dest===l.id)continue;
      const label=lanes.find(n=>n.id===dest)?.name||'Etapas fora dos grupos';links.set(label,(links.get(label)||0)+1);
    }
    const text=`${steps.length} etapas · ${steps.filter(e=>e.shape==='decision').length} decisões\n`+[...links].map(([name,count])=>`Vai para ${name}: ${count} conexões`).join('\n');
    return {id:l.id,type:'summary',text,title:`${String(i+1).padStart(2,'0')}  ${l.name}`,x:32+(i%2)*460,y:92+Math.floor(i/2)*Math.max(240,120+lanes.length*25),width:430,height:Math.max(210,100+lanes.length*25)};
  });
  const free=shapes.filter(e=>!lanes.some(l=>group(e)===l.id)).length;
  return [{id:'overview-title',type:'summary',title:diagram.title||'Diagrama',text:`${shapes.length} etapas em ${lanes.length} grupos${free?` · ${free} etapas fora dos grupos`:''}`,x:32,y:0,width:890,height:76},...cards];
}
export function buildDiagramSvg(diagram,{theme={},scope='full',transparent=false,connections=[],mermaid={}}={}){
  const t={ink:'#253247',border:'#dbe1e8',connector:'#63748b',process:'#5273a8',decision:'#c48620',terminal:'#34846a',data:'#36809a',subprocess:'#7b63a7',laneHeader:'#f3f5f8',...theme};
  const items=scope==='overview'?overviewElements(diagram):exportElements(diagram.elements,scope);
  const nodes=items.filter(e=>e.type!=='connector');if(!nodes.length)throw new Error('Adicione itens ao diagrama antes de exportar.');
  const ids=new Set(items.filter(e=>e.type==='connector').map(e=>e.id)),lines=connections.filter(c=>ids.has(c.id));
  const xs=nodes.flatMap(e=>[e.x,e.x+(e.width||180)]),ys=nodes.flatMap(e=>[e.y,e.y+(e.height||105)]);
  for(const c of lines){const nums=c.dPath.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number)||[];for(let i=0;i<nums.length;i+=2){xs.push(nums[i]);ys.push(nums[i+1]);}if(c.text&&c.label){const size=Array.from(c.text).length*7;xs.push(c.label.x-(c.label.anchor==='start'?0:size/2)-8,c.label.x+size+8);ys.push(c.label.y-20,c.label.y+10);}}
  const left=Math.min(...xs)-32,top=Math.min(...ys)-32,width=Math.ceil(Math.max(...xs)-left+32),height=Math.ceil(Math.max(...ys)-top+32);
  let body=`<defs><marker id="export-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="${color(t.connector)}"/></marker></defs><g transform="translate(${-left} ${-top})">`;
  for(const e of nodes.filter(e=>e.type==='lane'))body+=`<g transform="translate(${e.x} ${e.y})"><rect width="${e.width}" height="${e.height}" rx="13" fill="#fff" stroke="${color(t.border)}"/><path d="M 13 0 H 176 V ${e.height} H 13 Q 0 ${e.height} 0 ${e.height-13} V 13 Q 0 0 13 0" fill="${color(t.laneHeader)}"/>${textBlock(e.kind==='phase'?'FASE':'RAIA',14,25,145,{anchor:'start',size:9,fill:t.connector})}${textBlock(e.name,14,48,146,{anchor:'start',fill:t.ink,weight:600})}</g>`;
  for(const c of lines){body+=`<path d="${xml(c.dPath)}" fill="none" stroke="${color(t.connector)}" stroke-width="${c.stroke==='thick'?3:1.6}"${c.stroke==='dotted'?' stroke-dasharray="5 4"':''} marker-end="url(#export-arrow)"/>`;if(c.text&&c.label)body+=textBlock(c.text,c.label.x,c.label.y,Math.max(40,Array.from(c.text).length*8),{fill:t.ink,size:12,anchor:c.label.anchor||'middle'});}
  for(const e of nodes.filter(e=>e.type!=='lane')){
    if(e.type==='shape')body+=shapeSvg(e,t);
    else if(e.type==='sequence'){const s=renderSequence(e.model,t,'export-'+e.id);body+=`<g transform="translate(${e.x} ${e.y+40})">${s.body}</g>${textBlock(e.title||'Sequência',e.x+16,e.y+24,e.width-32,{anchor:'start',fill:t.ink,weight:600})}`;}
    else if(e.type==='mermaid'){
      if(!mermaid[e.id])throw new Error('Aguarde o Mermaid terminar de renderizar e tente exportar novamente.');
      body+=`<g transform="translate(${e.x} ${e.y})"><rect width="${e.width||390}" height="${e.height||250}" rx="11" fill="#fff" stroke="${color(t.border)}"/>${textBlock(e.title||'Mermaid',16,25,(e.width||390)-32,{anchor:'start',size:12,fill:t.ink,weight:600})}<svg x="16" y="44" width="${(e.width||390)-32}" height="${(e.height||250)-58}" id="${xml(mermaid[e.id].id)}" viewBox="${xml(mermaid[e.id].viewBox)}" preserveAspectRatio="xMidYMid meet">${mermaid[e.id].body}</svg></g>`;
    }else if(e.type==='sticky'||e.type==='summary')body+=`<g transform="translate(${e.x} ${e.y})"><rect width="${e.width||220}" height="${e.height||190}" rx="9" fill="${e.type==='sticky'?color(e.color,'#ffe58f'):'#fff'}" stroke="${color(t.border)}"/>${e.title?textBlock(e.title,16,28,e.width-32,{anchor:'start',fill:t.ink,weight:600,size:15}):''}${textBlock(e.text,16,e.title?64:28,(e.width||220)-32,{anchor:'start',fill:t.ink,size:12})}</g>`;
  }
  body+='</g>';
  return {svg:svgDocument(body,width,height,{transparent,title:diagram.title||'Diagrama'}),width,height};
}
// No HTML, executable content or network requests inside a downloadable vector.
export function portableMermaid(svgText,prefix){
  const doc=new DOMParser().parseFromString(svgText,'image/svg+xml'),root=doc.documentElement;
  if(doc.querySelector('parsererror')||root.localName!=='svg')throw new Error('O SVG Mermaid não pôde ser exportado.');
  if(root.querySelector('foreignObject'))throw new Error('Este Mermaid contém rótulos HTML. Use rótulos de texto para exportar.');
  root.querySelectorAll('script,iframe,object,embed,audio,video').forEach(n=>n.remove());
  const idMap=new Map();root.querySelectorAll('[id]').forEach(n=>idMap.set(n.id,prefix+'-'+n.id));if(root.id)idMap.set(root.id,prefix+'-'+root.id);
  const external=value=>[...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].some(m=>!m[2].trim().startsWith('#'));
  const rewrite=value=>{for(const [old,next] of [...idMap].sort((a,b)=>b[0].length-a[0].length))value=value.replaceAll(`url(#${old})`,`url(#${next})`).replaceAll(`url("#${old}")`,`url("#${next}")`).replace(new RegExp('#'+old.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=[\\s{.:>,)]|$)','g'),'#'+next);return value;};
  for(const node of [root,...root.querySelectorAll('*')])for(const attr of [...node.attributes]){
    if(/^on/i.test(attr.name))node.removeAttribute(attr.name);
    else if(attr.name==='id')node.setAttribute('id',idMap.get(attr.value));
    else if(/^(?:xlink:)?href$/.test(attr.name)){if(attr.value.startsWith('#'))node.setAttribute(attr.name,'#'+(idMap.get(attr.value.slice(1))||attr.value.slice(1)));else if(!/^data:image\/(png|jpeg|webp);base64,/i.test(attr.value))throw new Error('Imagens externas precisam ser removidas antes de exportar este Mermaid.');}
    else {if(external(attr.value))throw new Error('Recurso externo no SVG.');node.setAttribute(attr.name,rewrite(attr.value));}
  }
  for(const style of root.querySelectorAll('style')){if(/@import/i.test(style.textContent)||external(style.textContent))throw new Error('Estilo externo no SVG.');style.textContent=rewrite(style.textContent);}
  const viewBox=root.getAttribute('viewBox');if(!viewBox||!/^[-+\d.eE\s,]+$/.test(viewBox))throw new Error('Dimensões ausentes no SVG Mermaid.');
  return {viewBox,id:root.id||prefix,body:[...root.childNodes].map(n=>new XMLSerializer().serializeToString(n)).join('')};
}
export async function downloadDiagram(result,{format='svg',quality=2,filename='diagrama'}={}){
  let blob;
  if(format==='svg')blob=new Blob([result.svg],{type:'image/svg+xml;charset=utf-8'});
  else{
    const size=pngDimensions(result.width,result.height,quality),url=URL.createObjectURL(new Blob([result.svg],{type:'image/svg+xml'}));
    try{
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=size.width;canvas.height=size.height;
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar o PNG.');ctx.drawImage(image,0,0,size.width,size.height);
      blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('Não foi possível gerar o PNG. Use SVG para este diagrama.');
    }finally{URL.revokeObjectURL(url);}
  }
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename+'.'+format;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
