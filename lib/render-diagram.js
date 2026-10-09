import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import ELK from 'elkjs/lib/elk.bundled.js';
import { JSDOM } from 'jsdom';
import { snapshotMermaid, nativeElements } from '../mermaid-native.js';
import { sequenceGeometry } from '../sequence.js';
import { getTheme } from '../themes.js';
import { routeConnection } from '../connections.js';
import { geometryKey } from '../layout.js';
import { buildDiagramSvg, pngDimensions, exportFilename } from '../export.js';

let parserPromise,parserQueue=Promise.resolve();
export class ExportError extends Error{constructor(message,status=422){super(message);this.status=status;}}
async function parseMermaid(code){
  const task=parserQueue.then(async()=>{
    if(!parserPromise)parserPromise=(async()=>{
      // DOMPurify uses this isolated DOM to decode/sanitize labels; no scripts run.
      const dom=new JSDOM('');globalThis.window=dom.window;globalThis.document=dom.window.document;
      const {default:mermaid}=await import('mermaid');mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'default'});return mermaid;
    })();
    const mermaid=await parserPromise;
    const clean=value=>{const box=document.createElement('textarea');box.innerHTML=String(value??'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]*>/g,'');return box.value.trim();};
    return snapshotMermaid(await mermaid.mermaidAPI.getDiagramFromText(String(code).replace(/\r\n?/g,'\n')),clean);
  });parserQueue=task.catch(()=>{});return task;
}
export async function renderDiagramFile(diagram,{format='png',scope='full',transparent=false,quality=2}={}){
  if(!['png','svg'].includes(format))throw new ExportError('Escolha PNG ou SVG.',400);
  if(![1,2].includes(quality))throw new ExportError('Resolução aceita: 1 ou 2.',400);
  const snapshot=structuredClone(diagram);
  // Convert in memory so MCP export works immediately after creation, before opening the app.
  for(const card of snapshot.elements.filter(e=>e.type==='mermaid')){
    try{
      const model=await parseMermaid(card.code),native=await nativeElements(model,{x:(card.x||0)-60,y:(card.y||0)-70},new ELK());
      if(native[0]?.type==='sequence')native[0].title=card.title||diagram.title;
      // Keep external connections to this card attached to its generated first item.
      for(const edge of snapshot.elements.filter(e=>e.type==='connector')){if(edge.from===card.id)edge.from=native[0].id;if(edge.to===card.id)edge.to=native[0].id;}
      snapshot.elements=snapshot.elements.filter(e=>e.id!==card.id);snapshot.elements.push(...native);
    }catch(error){throw new ExportError(`Não foi possível exportar o cartão "${card.title||'Mermaid'}": ${error.message}`);}
  }
  for(const e of snapshot.elements.filter(e=>e.type==='sequence')){const g=sequenceGeometry(e.model);e.width=g.width;e.height=g.height+40;}
  const key=geometryKey(snapshot.elements),connections=snapshot.elements.filter(e=>e.type==='connector').flatMap(e=>{const route=routeConnection(e,snapshot,key);return route?[{...e,...route}]:[];});
  const result=buildDiagramSvg(snapshot,{scope,transparent,theme:getTheme(diagram.themeId),connections});
  const filename=exportFilename(diagram.title,scope==='full'?'':scope==='overview'?'fases':'fase')+'.'+format;
  if(format==='svg')return {bytes:Buffer.from(result.svg),mimeType:'image/svg+xml',filename,width:result.width,height:result.height,reduced:false};
  const size=pngDimensions(result.width,result.height,quality);
  const fontFiles=['NotoSans-Regular.ttf','NotoSans-Bold.ttf'].map(name=>fileURLToPath(new URL('../assets/fonts/'+name,import.meta.url)));
  const svg=result.svg.replace(/width="\d+" height="\d+" viewBox=/,`width="${size.width}" height="${size.height}" viewBox=`);
  const renderer=new Resvg(svg,{font:{fontFiles,loadSystemFonts:false,defaultFontFamily:'Noto Sans',sansSerifFamily:'Noto Sans'}}),image=renderer.render(),bytes=image.asPng();
  if(bytes.length>3*1024*1024)throw new ExportError('Este PNG ultrapassa o limite de download. Exporte em SVG ou escolha uma fase.',413);
  return {bytes,mimeType:'image/png',filename,width:image.width,height:image.height,reduced:size.reduced};
}
export function exportDownloadUrl(origin,diagramId,options={}){
  const url=new URL('/api/export',origin);url.searchParams.set('diagram',diagramId);url.searchParams.set('format',options.format||'png');url.searchParams.set('scope',options.scope||'full');url.searchParams.set('quality',String(options.quality||2));if(options.transparent)url.searchParams.set('transparent','true');return url.toString();
}
export async function exportToolResult(diagram,origin,options={}){
  const file=await renderDiagramFile(diagram,options),url=exportDownloadUrl(origin,diagram.id,options);
  const metadata={diagram_id:diagram.id,format:options.format||'png',filename:file.filename,mime_type:file.mimeType,width:file.width,height:file.height,bytes:file.bytes.length,reduced:file.reduced,url,app_url:new URL('/?diagram='+encodeURIComponent(diagram.id),origin).toString(),download_auth:'Requer sessão do VLI no navegador ou Authorization: Bearer com a credencial MCP.'};
  const content=[{type:'text',text:JSON.stringify(metadata,null,2)}];
  if(file.mimeType==='image/png'&&file.bytes.length<=2*1024*1024)content.push({type:'image',data:file.bytes.toString('base64'),mimeType:file.mimeType});
  else if(file.mimeType==='image/svg+xml')content.push({type:'resource',resource:{uri:url,mimeType:file.mimeType,text:file.bytes.toString('utf8')}});
  return {structuredContent:metadata,content};
}
