import { validBearer, validSession } from './auth.js';
import { renderDiagramFile } from './render-diagram.js';
export function exportHandler(readWorkspace){return {async fetch(request){
  if(!validSession(request)&&!validBearer(request))return Response.json({error:'Faça login no VLI ou use a credencial MCP.'},{status:401,headers:{'Cache-Control':'no-store'}});
  if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
  const url=new URL(request.url),format=url.searchParams.get('format')||'png',scope=url.searchParams.get('scope')||'full',quality=Number(url.searchParams.get('quality')||2);
  try{
    const diagram=(await readWorkspace()).diagrams.find(d=>d.id===url.searchParams.get('diagram'));
    if(!diagram)return Response.json({error:'Diagrama não encontrado.'},{status:404});
    const file=await renderDiagramFile(diagram,{format,scope,quality,transparent:url.searchParams.get('transparent')==='true'});
    return new Response(file.bytes,{headers:{'Content-Type':file.mimeType,'Content-Disposition':`attachment; filename="${file.filename}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
  }catch(error){return Response.json({error:error.message||'Não foi possível exportar o diagrama.'},{status:error.status||422,headers:{'Cache-Control':'no-store'}});}
}};}
