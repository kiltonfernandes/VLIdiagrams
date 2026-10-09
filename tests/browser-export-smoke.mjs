import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const cdnCache=new Map();
const root=fileURLToPath(new URL('../',import.meta.url));
const artifact=name=>join(tmpdir(),'vli-'+name);
const flow={elements:[]};
for(let component=0;component<2;component++){
 for(let i=0;i<14;i++){const id=`c${component}-${i}`;flow.elements.push({id,type:'shape',shape:i%4===1?'decision':'process',text:`Etapa ${i+1} (teste)`,x:component*420,y:i*180,width:180,height:105});if(i)flow.elements.push({id:'line-'+id,type:'connector',from:`c${component}-${i-1}`,to:id,text:i%4===2?'Sim':''});}
}
const seq=`sequenceDiagram
participant P as Pessoa
participant A as Aplicativo
participant T as Triagem
participant C as Operador
participant B as Carteira
participant BH as Banco
participant S as Rede
P->>A: Solicitar
A->>T: Validar
T-->>A: Aprovado
alt Carteira
A->>B: Reservar
B-->>A: Reservado
else Crédito
A->>BH: Aprovar
BH-->>A: Aprovado
end
A->>C: Oferecer
C-->>A: Aceitar
A->>S: Reservar slot
S-->>A: Confirmado
C->>P: Embarcar
P->>A: Confirmar
A->>B: Liberar
B-->>A: Concluir`;
flow.id='user-flow';flow.title='Regras de negócio: exemplo do usuário';
const fixture={id:'user-seq',title:'Sequência do usuário',elements:[{id:'source-seq',type:'mermaid',code:seq,title:'Corrida',convertOnLoad:true,x:0,y:0}]};
const raw={id:'raw',title:'Mermaid vetorial',elements:[{id:'raw-source',type:'mermaid',code:'flowchart TD\nA["Texto com parênteses (1) & acento"] -->|Sim| B["Resultado"]',title:'Mermaid',width:460,height:350,x:-50,y:-60}]};
const phase={id:'phases',title:'Fases & exportação',elements:[{id:'lane-a',type:'lane',name:'Entrada',x:0,y:0,width:500,height:220},{id:'lane-b',type:'lane',name:'Saída',x:0,y:260,width:500,height:220},{id:'a',type:'shape',shape:'process',text:'Entrada <dados> & ação',laneId:'lane-a',x:200,y:60,width:180,height:105},{id:'b',type:'shape',shape:'decision',text:'Aprovado?',laneId:'lane-b',x:200,y:290,width:150,height:125},{id:'ab',type:'connector',from:'a',to:'b',text:'Sim'}]};
let workspace={folders:[],activeDiagramId:'user-flow',diagrams:[flow,fixture,raw,phase]};
const server=createServer(async(req,res)=>{try{if(req.url.startsWith('/api/workspace')){if(req.method==='PUT'){let body='';for await(const p of req)body+=p;workspace=JSON.parse(body);}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(workspace));return;}let file=req.url.split('?')[0].slice(1)||'index.html';if(!/^(index.html|app.js|layout.js|connections.js|themes.js|mermaid-native.js|sequence.js|svg.js|export.js|styles.css)$/.test(file)){res.statusCode=404;res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(await readFile(root+'/'+file));}catch(e){res.statusCode=500;res.end(String(e));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const errors=[];
try{
const page=await browser.newPage({viewport:{width:1440,height:1000},ignoreHTTPSErrors:true});if(process.env.VLI_TEST_CURL_CDN==='1')await page.route('https://cdn.jsdelivr.net/**',async route=>{try{const url=route.request().url();if(!cdnCache.has(url))cdnCache.set(url,promisify(execFile)('curl',['-L','--max-time','30','-sSf',url],{maxBuffer:12*1024*1024}).then(r=>r.stdout));const source=await cdnCache.get(url);await route.fulfill({status:200,contentType:'application/javascript',body:source});}catch(e){console.log('CDN',e.message);await route.abort();}});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('BROWSER',m.type(),m.text());});
await page.goto(origin+'/?diagram=user-flow');await page.locator('#canvasWrap').waitFor({timeout:60000});assert.equal(await page.locator('.shape-card').count(),28);await page.screenshot({path:artifact('user-flow-current.png')});console.log('Disconnected 28-step flow visible');
async function download(format,path){await page.locator('#exportDiagram').click();await page.locator('#downloadExport').waitFor();await page.waitForFunction(()=>!document.getElementById('downloadExport').disabled,{},{timeout:60000});await page.locator('#exportFormat').selectOption(format);const promise=page.waitForEvent('download');await page.locator('#downloadExport').click();const file=await promise;await file.saveAs(path);}
await download('svg',artifact('user-flow.svg'));await download('png',artifact('user-flow.png'));console.log('Native SVG/PNG download passed');
await page.goto(origin+'/?diagram=user-seq');await page.locator('.sequence-card').waitFor({timeout:60000}).catch(async e=>{console.log('WORKSPACE',JSON.stringify(workspace.diagrams.find(d=>d.id==='user-seq')));console.log(await page.locator('body').innerText());throw e;});const item=workspace.diagrams.find(d=>d.id==='user-seq').elements[0];assert.equal(item.type,'sequence');assert.equal(item.model.participants.length,7);assert.equal(item.model.events.filter(e=>['SOLID','DOTTED'].includes(e.kind)).length,15);assert.equal(item.model.events.filter(e=>e.kind==='ALT_START').length,1);await writeFile(artifact('native-user-seq.json'),JSON.stringify(item));console.log('Real Mermaid parsed into native sequence',item.width,item.height);
await page.locator('#readCanvas').click();assert.equal(await page.locator('#zoomLabel').textContent(),'100%');await page.screenshot({path:artifact('user-seq-reading.png')});
await page.locator('[data-edit-sequence]').click();await page.locator('[data-event-text]').first().fill('Solicita corrida & confirma (1)');await page.locator('#sequenceAddMessage').click();await page.locator('#saveSequence').click();await page.waitForTimeout(600);assert.ok(workspace.diagrams.find(d=>d.id==='user-seq').elements[0].model.events[0].text.includes('&'));await download('svg',artifact('user-sequence.svg'));await download('png',artifact('user-sequence.png'));console.log('Native sequence edit & file download passed');
await page.goto(origin+'/?diagram=raw');await page.locator('.mermaid-render svg').waitFor({timeout:60000});await download('svg',artifact('raw-mermaid.svg'));await download('png',artifact('raw-mermaid.png'));console.log('Raw Mermaid portable SVG/PNG passed');
await page.goto(origin+'/?diagram=phases');await page.locator('#canvasWrap').waitFor();await page.locator('#exportDiagram').click();await page.locator('#exportScope').selectOption('lane-a');await page.waitForFunction(()=>!document.getElementById('downloadExport').disabled);await page.locator('#exportFormat').selectOption('svg');let pending=page.waitForEvent('download');await page.locator('#downloadExport').click();await(await pending).saveAs(artifact('phase.svg'));const phaseText=await readFile(artifact('phase.svg'),'utf8');assert.ok(phaseText.includes('Entrada'));assert.ok(!phaseText.includes('Aprovado'));assert.ok(!phaseText.includes('marker-end'));await page.locator('#overviewCanvas').click();await download('svg',artifact('overview.svg'));console.log('Phase and overview scopes passed');
await page.locator('#fullFlowCanvas').click();await page.locator('#exportDiagram').click();await page.locator('#exportBackground').selectOption('transparent');await page.waitForFunction(()=>!document.getElementById('downloadExport').disabled);pending=page.waitForEvent('download');await page.locator('#downloadExport').click();await(await pending).saveAs(artifact('transparent.png'));
await page.setViewportSize({width:390,height:700});await page.locator('#exportDiagram').click();await page.waitForFunction(()=>!document.getElementById('downloadExport').disabled);const bounds=await page.locator('.export-modal').boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=700);await page.keyboard.press('Escape');assert.equal(await page.locator('.export-modal').count(),0);assert.equal(errors.length,0,errors.join('\n'));console.log('Small viewport, Escape and no JS errors passed');
}finally{await browser.close();server.close();}
