import { xml, color, textBlock, wrapText, svgDocument } from './svg.js';

// Mermaid 11 sequence database event names. Read from db.LINETYPE at import time.
const starts=new Set(['LOOP_START','ALT_START','OPT_START','PAR_START','PAR_OVER_START','RECT_START','CRITICAL_START','BREAK_START']);
const ends=new Set(['LOOP_END','ALT_END','OPT_END','PAR_END','RECT_END','CRITICAL_END','BREAK_END']);
const branches=new Set(['ALT_ELSE','PAR_AND','CRITICAL_OPTION']);
const arrows=new Set(['SOLID','DOTTED','SOLID_CROSS','DOTTED_CROSS','SOLID_OPEN','DOTTED_OPEN','SOLID_POINT','DOTTED_POINT','BIDIRECTIONAL_SOLID','BIDIRECTIONAL_DOTTED']);
export function sequenceFromDatabase(db,clean=value=>String(value??'')){
  if(!db?.getActors||!db?.getMessages)throw new Error('Não foi possível ler os participantes desta sequência.');
  const names=new Map(Object.entries(db.LINETYPE||{}).map(([name,num])=>[num,name]));
  const actors=db.getActors(), entries=actors instanceof Map?[...actors]:Object.entries(actors);
  const participants=entries.map(([id,a])=>({id:String(id),name:clean(a.description||a.name||id),kind:a.type||'participant',box:a.box?.name?clean(a.box.name):''}));
  const created=db.getCreatedActors?.(),destroyed=db.getDestroyedActors?.();
  if((created?.size||destroyed?.size))throw new Error('Criação e destruição dinâmica de participantes ainda ficam no cartão Mermaid. Remova create/destroy para converter em sequência nativa.');
  const events=db.getMessages().map((m,i)=>{
    const kind=names.get(m.type);if(!kind||!(arrows.has(kind)||starts.has(kind)||ends.has(kind)||branches.has(kind)||['NOTE','ACTIVE_START','ACTIVE_END','AUTONUMBER'].includes(kind)))throw new Error(`Evento de sequência ainda não suportado: ${m.type}. O original pode ser mantido como cartão Mermaid.`);
    return {id:`event-${i}`,kind,from:m.from??'',to:m.to??'',text:kind==='AUTONUMBER'?'':clean(m.message),placement:m.placement??2,...(kind==='AUTONUMBER'?{numbering:structuredClone(m.message)}:{})};
  });
  if(!participants.length)throw new Error('Adicione pelo menos um participante.');
  return {participants,events};
}
export function sequenceGeometry(model){
  if(!model.participants?.length)throw new Error('Adicione pelo menos um participante.');
  if(new Set(model.participants.map(p=>p.id)).size!==model.participants.length)throw new Error('Cada participante precisa de um identificador único.');
  const count=model.participants.length, gap=240, first=250;
  const centers=new Map(model.participants.map((p,i)=>[p.id,first+i*gap]));
  const width=Math.max(360,first*2+(count-1)*gap+100), rows=[];
  const headerHeight=Math.max(58,...model.participants.map(p=>wrapText(p.name,160,13).length*19+24));
  let y=42+headerHeight+45;
  for(const e of model.events){
    if(e.kind==='AUTONUMBER'){rows.push({...e,y,height:0});continue;}
    const a=centers.get(e.from)??first,b=centers.get(e.to)??a;
    const available=e.kind==='NOTE'?200:Math.max(160,Math.abs(b-a)-30);
    const lines=wrapText(e.text,available,13).length;
    const height=['ACTIVE_START','ACTIVE_END'].includes(e.kind)?16:Math.max(e.from===e.to&&arrows.has(e.kind)?86:66,lines*19+36);
    rows.push({...e,y,height});y+=height;
  }
  return {width,height:y+headerHeight+32,centers,rows,headerHeight};
}
export function renderSequence(model,theme={},prefix='seq'){
  const {width,height,centers,rows,headerHeight}=sequenceGeometry(model),ink=theme.ink||'#253247',line=theme.connector||'#63748b',accent=theme.process||'#5273a8',border=theme.border||'#dbe1e8';
  prefix=String(prefix).replace(/[^\w-]/g,'');
  let background='',lifelines='',frames='',activations='',content='';
  const boxNames=[...new Set(model.participants.map(p=>p.box).filter(Boolean))];
  for(const box of boxNames){const xs=model.participants.filter(p=>p.box===box).map(p=>centers.get(p.id)),left=Math.min(...xs)-100,right=Math.max(...xs)+100;background+=`<rect x="${left}" y="8" width="${right-left}" height="${height-16}" rx="8" fill="${color(theme.laneHeader,'#f3f5f8')}" stroke="${color(border)}"/>${textBlock(box,(left+right)/2,28,right-left-20,{size:12,fill:ink})}`;}
  for(const p of model.participants){
    const x=centers.get(p.id),label=p.name||p.id;
    lifelines+=`<path d="M ${x} ${42+headerHeight} V ${height-headerHeight-20}" fill="none" stroke="${color(line)}" stroke-dasharray="5 5"/>`;
    for(const top of [42,height-headerHeight-20]){
      if(p.kind==='actor'&&top===42){content+=`<circle cx="${x}" cy="53" r="9" fill="#fff" stroke="${color(accent)}"/><path d="M ${x} 62 V 82 M ${x-16} 71 H ${x+16} M ${x} 82 L ${x-12} 97 M ${x} 82 L ${x+12} 97" fill="none" stroke="${color(accent)}"/>${textBlock(label,x,115,180,{size:12,fill:ink,weight:600})}`;}
      else content+=`<rect x="${x-90}" y="${top}" width="180" height="${headerHeight}" rx="8" fill="#fff" stroke="${color(accent)}"/>${textBlock(label,x,top+24,160,{fill:ink,weight:600})}`;
    }
  }
  const stack=[],active=new Map();let number=1,numberStep=1,numberVisible=false;
  const maxDepth=rows.reduce((acc,r)=>{if(starts.has(r.kind)){acc.depth++;acc.max=Math.max(acc.max,acc.depth);}if(ends.has(r.kind))acc.depth--;return acc;},{depth:0,max:0}).max;
  for(const r of rows){
    const a=centers.get(r.from),b=centers.get(r.to),y=r.y;
    if(r.kind==='AUTONUMBER'){number=r.numbering?.start??number;numberStep=r.numbering?.step??numberStep;numberVisible=r.numbering?.visible??true;continue;}
    if(starts.has(r.kind)){stack.push({r,depth:stack.length});continue;}
    if(ends.has(r.kind)){
      const frame=stack.pop();if(frame&&frame.r.kind.replace(/_START$/,'').replace('PAR_OVER','PAR')!==r.kind.replace(/_END$/,''))throw new Error('Tipos de bloco de sequência incompatíveis.');if(!frame)throw new Error('Bloco de sequência sem início.');
      const inset=22+(maxDepth-frame.depth)*10,top=frame.r.y-20;
      frames+=`<rect x="${inset}" y="${top}" width="${width-inset*2}" height="${y-top+20}" rx="3" fill="${frame.r.kind==='RECT_START'?color(frame.r.text,'#f3f5f8'):'none'}" fill-opacity=".18" stroke="${color(border)}"/>${textBlock(frame.r.kind.replace(/_START$/,'').toLowerCase()+' '+frame.r.text,inset+12,top+20,width-inset*2-24,{anchor:'start',size:12,fill:ink,weight:600})}`;continue;
    }
    if(branches.has(r.kind)){if(!stack.length)throw new Error('Alternativa fora de um bloco.');content+=`<path d="M 32 ${y-12} H ${width-32}" stroke="${color(border)}" stroke-dasharray="5 4"/>${textBlock(r.kind==='ALT_ELSE'?'else '+r.text:r.text,45,y+10,width-90,{anchor:'start',size:12,fill:ink})}`;continue;}
    if(r.kind==='ACTIVE_START'){const list=active.get(r.from)||[];list.push({y,x:a+list.length*7});active.set(r.from,list);continue;}
    if(r.kind==='ACTIVE_END'){const start=active.get(r.from)?.pop();if(!start)throw new Error('Ativação sem início.');activations+=`<rect x="${start.x-6}" y="${start.y}" width="12" height="${Math.max(8,y-start.y)}" fill="#fff" stroke="${color(accent)}"/>`;continue;}
    if(r.kind==='NOTE'){
      if(a===undefined||b===undefined)throw new Error('Nota com participante inexistente.');
      const left=r.placement===0?a-230:r.placement===1?a+20:Math.min(a,b)-100,noteWidth=r.placement===2?Math.max(200,Math.abs(b-a)+200):200;
      content+=`<rect x="${left}" y="${y-12}" width="${noteWidth}" height="${r.height-12}" rx="5" fill="#fff3c4" stroke="#d9bf70"/>${textBlock(r.text,left+noteWidth/2,y+7,noteWidth-22,{fill:ink})}`;continue;
    }
    if(!arrows.has(r.kind))throw new Error('Evento de sequência não suportado: '+r.kind);
    if(a===undefined||b===undefined)throw new Error('Uma mensagem aponta para um participante inexistente.');
    const self=a===b,arrowY=y+r.height-24,labelX=self?a+85:(a+b)/2;
    const label=(numberVisible?`${number}. `:'')+r.text;number+=numberStep;
    const dashed=r.kind.includes('DOTTED')?' stroke-dasharray="6 4"':'';
    const marker=r.kind.includes('CROSS')?'cross':r.kind.includes('POINT')?'point':r.kind.includes('OPEN')?'open':'arrow';
    const labelWidth=self?160:Math.max(160,Math.abs(b-a)-30),labelLines=wrapText(label,labelWidth,13),labelBox=Math.min(labelWidth,Math.max(...labelLines.map(line=>Array.from(line).length))*7.5)+10;
    content+=`<rect x="${labelX-labelBox/2}" y="${y-12}" width="${labelBox}" height="${labelLines.length*19}" rx="3" fill="#fff"/>`+textBlock(label,labelX,y+3,labelWidth,{fill:ink});
    content+=`<path d="${self?`M ${a} ${arrowY-20} H ${a+100} V ${arrowY} H ${a}`:`M ${a} ${arrowY} H ${b}`}" fill="none" stroke="${color(line)}" stroke-width="1.6"${dashed} marker-end="url(#${prefix}-${marker})"${r.kind.startsWith('BIDIRECTIONAL')?` marker-start="url(#${prefix}-arrow)"`:''}/>`;
  }
  if(stack.length)throw new Error('Feche os blocos de sequência antes de salvar.');
  for(const list of active.values())for(const start of list)activations+=`<rect x="${start.x-6}" y="${start.y}" width="12" height="${height-headerHeight-20-start.y}" fill="#fff" stroke="${color(accent)}"/>`;
  const defs=`<defs><marker id="${prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 Z" fill="${color(line)}"/></marker><marker id="${prefix}-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="${color(line)}"/></marker><marker id="${prefix}-cross" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M 1 1 L 9 9 M 1 9 L 9 1" stroke="${color(line)}"/></marker><marker id="${prefix}-point" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6"><circle cx="5" cy="5" r="4" fill="${color(line)}"/></marker></defs>`;
  return {width,height,body:defs+background+lifelines+frames+activations+content};
}
export function sequenceSvg(model,theme,prefix){const s=renderSequence(model,theme,prefix);return svgDocument(s.body,s.width,s.height,{transparent:true,title:'Diagrama de sequência'});}
export function validateSequence(model){renderSequence(model);return structuredClone(model);}
