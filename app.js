const STORAGE_KEY = "vli-diagrams-v1";
const colors = ["#ffe58f", "#ffbdbd", "#c7f2c2", "#c8e4ff", "#e7d1ff", "#ffd8a8"];
const DEFAULT_THEME_ID="paper";
const diagramThemes=[["paper","Papel","#fbfcfe","#e6eaf0","#fff","#f3f5f8","#dbe1e8","#253247","#63748b","#5273a8","#c48620","#34846a","#36809a","#7b63a7"],["ocean","Oceano","#f7fbff","#dceaf5","#fff","#eaf4fb","#cfdfed","#17324d","#47708b","#2877a7","#d08a2d","#258877","#3e82a2","#557cb7"],["lavender","Lavanda","#faf9ff","#e8e2f4","#fff","#f3effa","#ded5ec","#302b48","#71658c","#7661bd","#bf8734","#498c79","#5188a0","#9b649d"],["forest","Floresta","#f8fbf8","#dfeae1","#fff","#edf5ee","#d4e2d6","#24392b","#55705e","#4d8060","#b38630","#26845b","#438279","#757f4f"],["sunset","Pôr do sol","#fffaf7","#f2e4dc","#fff","#fff0e7","#ead8cc","#493126","#806257","#c06b49","#cb862c","#518878","#55839a","#9b6479"],["sand","Areia","#fcfaf6","#ece5d9","#fff","#f5f0e6","#e3d9c8","#3e392f","#766d5d","#8b7550","#bc762e","#557d63","#587d8a","#8f6a9b"],["slate","Ardósia","#f8fafc","#e3e8ee","#fff","#eef2f6","#d5dde6","#263341","#586777","#52687f","#bd8230","#43806c","#3d7b91","#7273a5"],["mint","Menta","#f6fcfa","#dbeee8","#fff","#e8f6f1","#cfe4dc","#203c37","#4e766d","#398677","#b27d2d","#268263","#397f93","#5e7caa"],["coral","Coral","#fff9f8","#f1e1df","#fff","#fdf0ee","#ead6d4","#442f32","#7b5d62","#b45e68","#c5862f","#438578","#4b8090","#8a648b"],["cobalt","Cobalto","#f7faff","#dfe7f6","#fff","#edf2fc","#d3def0","#253250","#596b8f","#3e65b6","#c1842a","#34836e","#367f9c","#8266b0"],["sage","Sálvia","#fafbf7","#e7eadc","#fff","#f2f4e9","#dce1d0","#34392c","#68705c","#748655","#b98131","#448265","#4c8290","#8c6a91"],["berry","Amora","#fcf8fc","#eee1eb","#fff","#f7edf5","#e5d4e2","#402b3f","#765e75","#95629b","#c1842a","#43856e","#4f8096","#a34f79"],["ice","Gelo","#f7fcfd","#dcecef","#fff","#eaf5f6","#cee1e4","#21373d","#56747a","#398194","#c2862b","#318274","#357f90","#687fa6"],["terracotta","Terracota","#fcf8f5","#efe2d8","#fff","#f8eee6","#e4d4c7","#423329","#796557","#a66e4e","#c0812b","#4b826d","#4e7d89","#876b98"],["meadow","Campo","#f8fbf7","#e1ecdf","#fff","#eef6eb","#d3e3d0","#2b392b","#5d725a","#4d8c57","#bd8230","#368264","#488295","#8074a0"],["midnight","Noite clara","#f4f7fb","#dfe5ef","#fff","#e8edf5","#d0d9e6","#202a3b","#52627b","#4d68a3","#bb812b","#37806b","#3d7894","#7865a5"],["peach","Pêssego","#fffaf6","#f3e6dc","#fff","#fff1e6","#ead9ca","#46372f","#78685d","#bb7650","#c38a31","#51856d","#548297","#916d9e"],["orchid","Orquídea","#fbf9fd","#e9e3f0","#fff","#f4eff8","#ded5e8","#352b41","#70627c","#8559a5","#c08831","#498575","#4e8092","#a16083"],["lagoon","Lagoa","#f6fbfa","#dcebe8","#fff","#eaf5f2","#ccdfda","#203b3b","#52716f","#348b89","#bc812f","#2f7e68","#397f9b","#716ba2"],["contrast","Alto contraste","#fff","#e5e7eb","#fff","#f1f3f5","#cbd0d6","#111827","#4b5563","#1d4ed8","#b45309","#047857","#0369a1","#6d28d9"]].map(([id,name,canvas,grid,lane,laneHeader,border,ink,connector,process,decision,terminal,data,subprocess])=>({id,name,canvas,grid,lane,laneHeader,border,ink,connector,process,decision,terminal,data,subprocess}));
function getTheme(themeId=DEFAULT_THEME_ID){return diagramThemes.find(theme=>theme.id===themeId)||diagramThemes[0];}
function themeStyle(themeId=DEFAULT_THEME_ID){const t=getTheme(themeId);return `--diagram-canvas:${t.canvas};--diagram-grid:${t.grid};--diagram-lane:${t.lane};--diagram-lane-header:${t.laneHeader};--diagram-line:${t.border};--diagram-ink:${t.ink};--diagram-connector:${t.connector};--theme-process:${t.process};--theme-decision:${t.decision};--theme-terminal:${t.terminal};--theme-data:${t.data};--theme-subprocess:${t.subprocess};`;}

const flowNodeTypes = [
  { type:"process", label:"Novo passo", symbol:"▭", width:180, height:105 },
  { type:"decision", label:"Nova decisão", symbol:"◇", width:150, height:125 },
  { type:"terminator", label:"Início / fim", symbol:"⬭", width:170, height:78 },
  { type:"io", label:"Entrada / saída", symbol:"▱", width:180, height:95 },
  { type:"document", label:"Documento", symbol:"▤", width:170, height:100 },
  { type:"database", label:"Dados / armazenamento", symbol:"▤", width:160, height:100 },
  { type:"subprocess", label:"Subprocesso", symbol:"▣", width:180, height:105 }
];
const initialState = { folders: [], diagrams: [], activeDiagramId: null };
let state = readState();
let mermaidPromise;
let mermaidQueue = Promise.resolve();
let selectedElement = null;
let connectMode = false;
let deleteHandlerBound = false;
let activeViewFolderId = null;
let currentScale = 1;
let pan = { x: 0, y: 0 };
let drag = null;
let suppressClick = false;
let shareMode = new URLSearchParams(location.hash.slice(1)).has("share");

const app = document.querySelector("#app");

function readState() {
  try { return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return structuredClone(initialState); }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function id() { return crypto.randomUUID(); }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function currentDiagram() { return state.diagrams.find(d => d.id === state.activeDiagramId); }
function activeFolderId() { return currentDiagram()?.folderId || null; }
function diagramTitle(d) { return d?.title || "Diagrama sem título"; }
function formatDate(value) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value)); }
function itemSummary(d){const items=d.elements.filter(e=>e.type!=="connector").length,lanes=d.elements.filter(e=>e.type==="lane").length;return `${items} itens${lanes?` · ${lanes} raias`:""} no quadro`;}

function render() {
  if (shareMode) return renderShared();
  const diagram = currentDiagram();
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">V</div><div><strong>VLI Diagrams</strong><small>Quadros e diagramas</small></div></div>
        <button class="new-diagram" id="newDiagram"><span>＋</span> Novo diagrama</button>
        <div class="nav-section"><div class="nav-label">ESPAÇO DE TRABALHO <button class="icon-button tiny" id="newFolder" title="Criar pasta">＋</button></div>
          <button class="nav-item ${!diagram && !activeViewFolderId ? "active" : ""}" id="allDiagrams"><span>▦</span> Todos os diagramas <span class="count">${state.diagrams.length}</span></button>
          <div id="folderList">${state.folders.map(f => `<div class="folder-row"><button class="nav-item folder-item ${(activeViewFolderId || activeFolderId()) === f.id ? "active" : ""}" data-folder="${f.id}"><span>▰</span><span class="folder-name">${escapeHtml(f.name)}</span><span class="folder-count">${state.diagrams.filter(d => d.folderId === f.id).length}</span></button><button class="row-more" data-folder-menu="${f.id}" title="Opções da pasta">···</button></div>`).join("")}</div>
        </div>
        <div class="sidebar-bottom"><div class="profile"><div class="avatar">K</div><div><b>Meu espaço</b><small>Armazenado neste navegador</small></div><button class="icon-button" id="settings" title="Configurações">⚙</button></div></div>
      </aside>
      <main class="main">
        ${diagram ? renderEditor(diagram) : renderLibrary()}
      </main>
    </div>
    <div id="modalRoot"></div>
    <div id="toast" class="toast" role="status"></div>`;
  bindShell();
  if (diagram) bindEditor(diagram);
}

function renderLibrary() {
  return `<header class="topbar"><div><div class="eyebrow">MEU ESPAÇO</div><h1>Seus diagramas</h1></div><div class="top-actions"><button class="button secondary" id="importButton">Importar Mermaid</button><button class="button primary" id="newDiagramTop">＋ Novo diagrama</button></div></header>
    <section class="library-wrap"><div class="library-heading"><div><h2>Diagramas</h2><p>Organize suas ideias em pastas e abra qualquer quadro para editar.</p></div><div class="search-wrap"><span>⌕</span><input id="searchDiagrams" placeholder="Buscar diagramas" /></div></div>
    ${state.diagrams.length ? `<div class="diagram-grid" id="diagramGrid">${state.diagrams.map(d => `<article class="diagram-card" data-card="${d.id}"><div class="card-open" role="button" tabindex="0" data-open="${d.id}"><div class="card-preview"><div class="preview-grid"></div>${miniPreview(d)}</div><div class="card-meta"><div class="card-title"><h3>${escapeHtml(diagramTitle(d))}</h3><button class="row-more card-menu" data-diagram-menu="${d.id}" title="Opções">···</button></div><div class="card-sub"><span>▰ ${escapeHtml(state.folders.find(f => f.id === d.folderId)?.name || "Sem pasta")}</span><span>· ${formatDate(d.updatedAt || d.createdAt)}</span></div></div></div></article>`).join("")}</div>` : `<div class="empty-state"><div class="empty-illustration"><span>▱</span><span>✦</span></div><h2>Seu primeiro quadro começa aqui</h2><p>Crie um diagrama e organize o espaço com Mermaid e notas adesivas.</p><button class="button primary" id="emptyNewDiagram">＋ Criar diagrama</button></div>`}
    </section>`;
}

function miniPreview(d) {
  const note = d.elements?.find(e => e.type === "sticky");
  const mermaid = d.elements?.find(e => e.type === "mermaid");
  if (!note && !mermaid) return `<div class="preview-placeholder"><i></i><i></i><i></i></div>`;
  return `${note ? `<div class="mini-note" style="left:19%;top:23%;background:${note.color}">${escapeHtml(note.text.slice(0, 26) || "Nota adesiva")}</div>` : ""}${mermaid ? `<div class="mini-flow"><b></b><em></em><b></b></div>` : ""}`;
}

function renderEditor(d) {
  return `<header class="editor-topbar"><button class="back-button" id="backToLibrary" title="Voltar">←</button><div class="title-stack"><div class="crumbs"><span>Diagramas</span><span>/</span><span>${escapeHtml(state.folders.find(f => f.id === d.folderId)?.name || "Sem pasta")}</span></div><input class="diagram-title-input" id="diagramTitle" value="${escapeHtml(diagramTitle(d))}" aria-label="Nome do diagrama" /></div><span class="save-status" id="saveStatus"><i></i> Salvo</span><div class="top-actions"><button class="button secondary" id="moveDiagram">Mover para pasta</button><button class="button secondary" id="diagramMenu">···</button><button class="button primary" id="publishDiagram">Publicar ↗</button></div></header>
    <div class="workspace">
      <div class="canvas-toolbar">
        <div class="tool-group"><button class="tool active" data-tool="select" title="Selecionar e mover">↖</button><button class="tool" data-tool="pan" title="Mover tela">✥</button></div><div class="tool-divider"></div>
        <button class="tool wide" id="addSticky" title="Adicionar nota adesiva"><span class="tool-sticky">▰</span><span>Nota</span></button>
        <button class="tool wide" id="addShape" title="Escolher forma"><span class="tool-shape">◇</span><span>Forma</span></button>
        <button class="tool wide" id="addLane" title="Adicionar raia de responsabilidade"><span class="tool-lane">▤</span><span>Raia</span></button>
        <button class="tool wide" id="connectItems" title="Conectar dois itens"><span>⤳</span><span>Conectar</span></button>
        <button class="tool wide" id="addMermaid" title="Adicionar bloco Mermaid"><span class="tool-mermaid">⌘</span><span>Mermaid</span></button><button class="tool wide" id="themeButton" title="Escolher tema do diagrama"><span class="tool-theme">◉</span><span>Tema</span></button>
        <div class="toolbar-spacer"></div><div class="zoom-controls"><button class="icon-button" id="zoomOut">−</button><span id="zoomLabel">100%</span><button class="icon-button" id="zoomIn">＋</button><button class="icon-button" id="fitCanvas" title="Ajustar à tela">⛶</button></div>
      </div>
      <div class="canvas-wrap" id="canvasWrap" style="${themeStyle(d.themeId)}"><div class="canvas" id="canvas"><div class="canvas-content" id="canvasContent">${d.elements.filter(e=>e.type==="lane").map(renderElement).join("")}<svg class="connections" id="connections" width="5000" height="5000" aria-label="Conectores"></svg>${d.elements.filter(e => e.type !== "connector" && e.type !== "lane").map(renderElement).join("")}</div></div><div class="canvas-hint" id="canvasHint">Organize as etapas nas raias e conecte os pontos do processo</div></div>
      <div class="bottom-bar"><span><i class="live-dot"></i> Salvamento automático</span><span>${itemSummary(d)}</span></div>
    </div>`;
}

function renderElement(e) {
  if (e.type === "connector") return "";
  if (e.type === "lane") return `<section class="swimlane" data-lane="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width}px;height:${e.height}px"><div class="lane-label"><span>RAIA</span><strong>${escapeHtml(e.name)}</strong><button class="lane-menu-button" data-lane-menu="${e.id}" title="Opções da raia">···</button></div><div class="lane-resize" data-resize-lane="${e.id}" title="Arraste para ajustar a altura"></div></section>`;
  if (e.type === "sticky") return `<article class="sticky" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;background:${e.color};width:${e.width || 220}px;height:${e.height || 190}px"><div class="sticky-head"><span class="drag-grip">⠿</span><div class="sticky-controls"><button class="sticky-control" data-color="${e.id}" title="Mudar cor">●</button><button class="sticky-control" data-delete="${e.id}" title="Excluir">×</button></div></div><textarea class="sticky-text" data-text="${e.id}" placeholder="Escreva uma ideia...">${escapeHtml(e.text)}</textarea><div class="resize-handle" data-resize="${e.id}"></div></article>`;
  if (e.type === "shape") return `<article class="shape-card ${escapeHtml(e.shape || "process")}" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width || 180}px;height:${e.height || 105}px;${e.colorMode === "custom" ? `--node-accent:${e.color};` : ""}"><div class="shape-head"><button class="sticky-control" data-color="${e.id}" title="Mudar cor">●</button><button class="sticky-control" data-delete="${e.id}" title="Excluir">×</button></div><textarea data-text="${e.id}" placeholder="Texto da forma">${escapeHtml(e.text)}</textarea>${["top","right","bottom","left"].map(side=>`<button class="node-port ${side}" data-add-node="${e.id}" data-side="${side}" title="Adicionar item ${side === "top" ? "acima" : side === "right" ? "à direita" : side === "bottom" ? "abaixo" : "à esquerda"}">+</button>`).join("")}<div class="resize-handle" data-resize="${e.id}"></div></article>`;
  return `<article class="mermaid-card" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width || 390}px;min-height:${e.height || 250}px"><div class="mermaid-head"><div><span class="mermaid-symbol">⌘</span><strong>${escapeHtml(e.title || "Diagrama Mermaid")}</strong></div><div><button class="mermaid-action" data-convert-mermaid="${e.id}" title="Converter em formas editáveis">◇</button><button class="mermaid-action" data-edit-mermaid="${e.id}" title="Editar código">✎</button><button class="mermaid-action" data-delete="${e.id}" title="Excluir">×</button></div></div><div class="mermaid-render" data-render="${e.id}"><div class="render-loading">Renderizando diagrama…</div></div><div class="mermaid-foot"><span>MERMAID 11+</span><button data-edit-mermaid="${e.id}">Editar código</button></div><div class="resize-handle" data-resize="${e.id}"></div></article>`;
}

function bindShell() {
  ["newDiagram", "newDiagramTop", "emptyNewDiagram"].forEach(idName => document.getElementById(idName)?.addEventListener("click", () => createDiagram()));
  document.getElementById("newFolder")?.addEventListener("click", createFolder);
  document.getElementById("allDiagrams")?.addEventListener("click", () => { state.activeDiagramId = null; activeViewFolderId=null; render(); });
  document.querySelectorAll("[data-folder]").forEach(el => el.addEventListener("click", () => showFolder(el.dataset.folder)));
  document.querySelectorAll("[data-folder-menu]").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); folderMenu(el.dataset.folderMenu); }));
  document.querySelectorAll("[data-open]").forEach(el => {
    el.addEventListener("click", () => openDiagram(el.dataset.open));
    el.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openDiagram(el.dataset.open); } });
  });
  document.querySelectorAll("[data-diagram-menu]").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); diagramMenu(el.dataset.diagramMenu); }));
  document.getElementById("searchDiagrams")?.addEventListener("input", ev => {
    document.querySelectorAll("[data-card]").forEach(card => card.hidden = !card.textContent.toLowerCase().includes(ev.target.value.toLowerCase()));
  });
  document.getElementById("importButton")?.addEventListener("click", () => showMermaidModal(null, { importAsDiagram: true }));
  document.getElementById("settings")?.addEventListener("click", () => toast("Configurações e Notion chegam em uma etapa futura."));
}

function createDiagram(folderId = null) {
  const d = { id: id(), title: "Novo diagrama", folderId, themeId: DEFAULT_THEME_ID, elements: [], createdAt: Date.now(), updatedAt: Date.now() };
  state.diagrams.unshift(d); state.activeDiagramId = d.id; persist(); render();
  const input = document.getElementById("diagramTitle"); input?.focus(); input?.select();
}
function createFolder() {
  showNameDialog({title:"Criar pasta",label:"Nome da pasta",saveLabel:"Criar pasta",onSave:name=>{const folder={id:id(),name};state.folders.push(folder);persist();activeViewFolderId=folder.id;showFolder(folder.id);toast("Pasta criada");}});
}
function showFolder(folderId) {
  state.activeDiagramId = null; activeViewFolderId=folderId; render();
  const folder = state.folders.find(f => f.id === folderId);
  const main = document.querySelector(".main");
  const items = state.diagrams.filter(d => d.folderId === folderId);
  main.innerHTML = `<header class="topbar"><div><div class="eyebrow">PASTA</div><h1>${escapeHtml(folder?.name || "Pasta")}</h1></div><div class="top-actions"><button class="button primary" id="newInFolder">＋ Novo diagrama</button></div></header><section class="library-wrap"><div class="library-heading"><div><h2>Diagramas nesta pasta</h2><p>${items.length} diagramas</p></div></div>${items.length ? `<div class="diagram-grid">${items.map(d => `<article class="diagram-card"><div class="card-open" role="button" tabindex="0" data-open="${d.id}"><div class="card-preview"><div class="preview-grid"></div>${miniPreview(d)}</div><div class="card-meta"><div class="card-title"><h3>${escapeHtml(diagramTitle(d))}</h3><button class="row-more card-menu" data-diagram-menu="${d.id}">···</button></div><div class="card-sub"><span>${formatDate(d.updatedAt || d.createdAt)}</span></div></div></div></article>`).join("")}</div>` : `<div class="empty-state compact"><div class="empty-illustration"><span>▰</span></div><h2>Esta pasta está vazia</h2><p>Crie um diagrama dentro dela.</p><button class="button primary" id="newInFolder2">＋ Novo diagrama</button></div>`}</section>`;
  document.getElementById("newInFolder")?.addEventListener("click", () => createDiagram(folderId));
  document.getElementById("newInFolder2")?.addEventListener("click", () => createDiagram(folderId));
  document.querySelectorAll("[data-open]").forEach(el => {
    el.addEventListener("click", () => openDiagram(el.dataset.open));
    el.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); openDiagram(el.dataset.open); } });
  });
  document.querySelectorAll("[data-diagram-menu]").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); diagramMenu(el.dataset.diagramMenu); }));
}
function refreshLibrary(){if(state.activeDiagramId){render();return;}if(activeViewFolderId){showFolder(activeViewFolderId);return;}render();}

function folderMenu(folderId) {
  const folder = state.folders.find(f => f.id === folderId); if (!folder) return;
  const anchor=document.querySelector(`[data-folder-menu="${folderId}"]`);
  openActionMenu(anchor,[
    {label:"Renomear pasta",icon:"✎",run:()=>showNameDialog({title:"Renomear pasta",label:"Nome da pasta",value:folder.name,saveLabel:"Salvar",onSave:name=>{folder.name=name;persist();refreshLibrary();toast("Pasta renomeada");}})},
    {label:"Excluir pasta",icon:"⌫",danger:true,run:()=>showConfirmDialog({title:"Excluir esta pasta?",message:"Os diagramas continuarão salvos e irão para Sem pasta.",confirmLabel:"Excluir pasta",onConfirm:()=>{state.diagrams.forEach(d=>{if(d.folderId===folderId)d.folderId=null;});state.folders=state.folders.filter(f=>f.id!==folderId);if(activeViewFolderId===folderId)activeViewFolderId=null;persist();render();toast("Pasta excluída");}})}
  ]);
}
function diagramMenu(diagramId) {
  const d = state.diagrams.find(x => x.id === diagramId); if (!d) return;
  const anchor=document.querySelector(`[data-diagram-menu="${diagramId}"]`)||document.getElementById("diagramMenu");
  openActionMenu(anchor,[
    {label:"Renomear diagrama",icon:"✎",run:()=>showNameDialog({title:"Renomear diagrama",label:"Nome do diagrama",value:d.title,saveLabel:"Salvar",onSave:name=>{d.title=name;persist();refreshLibrary();toast("Diagrama renomeado");}})},
    {label:"Mover para pasta",icon:"▰",run:()=>moveDiagramById(d)},
    {label:"Excluir diagrama",icon:"⌫",danger:true,run:()=>showConfirmDialog({title:"Excluir este diagrama?",message:`“${diagramTitle(d)}” será removido permanentemente deste navegador.`,confirmLabel:"Excluir diagrama",onConfirm:()=>{state.diagrams=state.diagrams.filter(x=>x.id!==d.id);if(state.activeDiagramId===d.id)state.activeDiagramId=null;persist();refreshLibrary();toast("Diagrama excluído");}})}
  ]);
}
function moveDiagramById(d) {
  const root=document.getElementById("modalRoot");let choice=d.folderId||"";
  const choices=[{id:"",name:"Sem pasta"},...state.folders.map(f=>({id:f.id,name:f.name}))];
  root.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><section class="modal action-modal"><div class="modal-head"><div><div><h2>Mover diagrama</h2><p>Escolha onde “${escapeHtml(diagramTitle(d))}” ficará guardado.</p></div></div><button class="icon-button" data-close-modal>×</button></div><div class="folder-choice-list">${choices.map(f=>`<button class="folder-choice ${choice===f.id?"selected":""}" data-choice="${f.id}"><span class="choice-icon">▰</span><span>${escapeHtml(f.name)}</span><span class="choice-check">✓</span></button>`).join("")}</div><div class="modal-actions"><button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" id="saveMove">Mover para pasta</button></div></section></div>`;
  root.querySelectorAll("[data-choice]").forEach(btn=>btn.addEventListener("click",()=>{choice=btn.dataset.choice;root.querySelectorAll("[data-choice]").forEach(x=>x.classList.toggle("selected",x===btn));}));
  root.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModal));
  root.querySelector("#modalBackdrop").addEventListener("click",ev=>{if(ev.target.id==="modalBackdrop")closeModal();});
  root.querySelector("#saveMove").addEventListener("click",()=>{d.folderId=choice||null;persist();closeModal();if(d.folderId)showFolder(d.folderId);else{activeViewFolderId=null;render();}toast("Diagrama movido");});
}
function closeModal(){const root=document.getElementById("modalRoot");if(root)root.innerHTML="";}
function showNameDialog({title,label,value="",saveLabel="Salvar",onSave}){
  const root=document.getElementById("modalRoot");
  root.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><section class="modal action-modal"><div class="modal-head"><div><div><h2>${title}</h2><p>Use um nome curto e fácil de encontrar.</p></div></div><button class="icon-button" data-close-modal>×</button></div><label class="field-label">${label}<input class="text-input" id="nameInput" maxlength="80" value="${escapeHtml(value)}" placeholder="Digite um nome" /></label><div class="modal-actions"><button class="button secondary" data-close-modal>Cancelar</button><button class="button primary" id="saveName">${saveLabel}</button></div></section></div>`;
  const input=root.querySelector("#nameInput");root.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModal));
  root.querySelector("#modalBackdrop").addEventListener("click",ev=>{if(ev.target.id==="modalBackdrop")closeModal();});
  const save=()=>{const name=input.value.trim();if(!name){input.classList.add("invalid");input.focus();return;}closeModal();onSave(name);};
  root.querySelector("#saveName").addEventListener("click",save);input.addEventListener("keydown",ev=>{if(ev.key==="Enter")save();});input.focus();input.select();
}
function showConfirmDialog({title,message,confirmLabel="Excluir",onConfirm}){
  const root=document.getElementById("modalRoot");root.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><section class="modal action-modal"><div class="modal-head"><div><div><h2>${title}</h2><p>${message}</p></div></div><button class="icon-button" data-close-modal>×</button></div><div class="modal-actions"><button class="button secondary" data-close-modal>Cancelar</button><button class="button danger-button" id="confirmAction">${confirmLabel}</button></div></section></div>`;
  root.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModal));root.querySelector("#modalBackdrop").addEventListener("click",ev=>{if(ev.target.id==="modalBackdrop")closeModal();});root.querySelector("#confirmAction").addEventListener("click",()=>{closeModal();onConfirm();});
}
function openActionMenu(anchor,actions){
  if(!anchor)return;const root=document.getElementById("modalRoot"),rect=anchor.getBoundingClientRect();
  root.innerHTML=`<div class="action-menu-backdrop" id="actionMenuBackdrop"><div class="action-menu" id="actionMenu">${actions.map((a,i)=>`<button class="action-menu-item ${a.danger?"danger":""}" data-action-index="${i}"><span>${a.icon}</span>${a.label}</button>`).join("")}</div></div>`;
  const menu=root.querySelector("#actionMenu");menu.style.left=`${Math.min(rect.right-menu.offsetWidth,window.innerWidth-menu.offsetWidth-8)}px`;menu.style.top=`${Math.min(rect.bottom+5,window.innerHeight-menu.offsetHeight-8)}px`;
  root.querySelector("#actionMenuBackdrop").addEventListener("pointerdown",ev=>{if(ev.target.id==="actionMenuBackdrop")closeModal();});
  menu.querySelectorAll("[data-action-index]").forEach(btn=>btn.addEventListener("click",()=>{const action=actions[Number(btn.dataset.actionIndex)];closeModal();action.run();}));
}
function openDiagram(diagramId) { const d=state.diagrams.find(item=>item.id===diagramId);activeViewFolderId=d?.folderId||null;state.activeDiagramId = diagramId; persist(); render(); }

function bindEditor(d) {
  document.getElementById("backToLibrary").addEventListener("click", () => { const folderId=activeViewFolderId||d.folderId;state.activeDiagramId = null; persist();if(folderId)showFolder(folderId);else render(); });
  const title = document.getElementById("diagramTitle");
  title.addEventListener("input", () => { d.title = title.value; touchDiagram(d); });
  title.addEventListener("blur", () => { if (!title.value.trim()) title.value = d.title = "Diagrama sem título"; persist(); });
  document.getElementById("addSticky").addEventListener("click", () => addSticky(d));
  document.getElementById("addShape").addEventListener("click", () => showShapePicker(d, document.getElementById("addShape")));
  document.getElementById("addLane").addEventListener("click", () => addLane(d));
  document.getElementById("connectItems").addEventListener("click", () => {
    connectMode = !connectMode; selectedElement = null;
    document.getElementById("connectItems").classList.toggle("active", connectMode);
    toast(connectMode ? "Selecione dois itens para conectá-los" : "Modo de conexão encerrado");
  });
  document.getElementById("addMermaid").addEventListener("click", () => showMermaidModal());
  document.getElementById("themeButton").addEventListener("click", () => showThemePicker(d));
  document.getElementById("publishDiagram").addEventListener("click", () => publish(d));
  document.getElementById("moveDiagram").addEventListener("click", () => moveDiagramById(d));
  document.getElementById("diagramMenu").addEventListener("click", () => diagramMenu(d.id));
  document.getElementById("zoomIn").addEventListener("click", () => zoom(1.12));
  document.getElementById("zoomOut").addEventListener("click", () => zoom(1 / 1.12));
  document.getElementById("fitCanvas").addEventListener("click", resetView);
  document.querySelectorAll("[data-tool]").forEach(btn => btn.addEventListener("click", () => {
    document.querySelectorAll("[data-tool]").forEach(t => t.classList.toggle("active", t === btn));
    document.getElementById("canvasWrap").classList.toggle("pan-mode", btn.dataset.tool === "pan");
  }));
  document.querySelectorAll(".sticky-text").forEach(input => input.addEventListener("input", () => {
    const el = d.elements.find(e => e.id === input.dataset.text); if (el) el.text = input.value; touchDiagram(d);
  }));
  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", ev => { ev.stopPropagation(); confirmDeleteElement(d, btn.dataset.delete); }));
  document.querySelectorAll("[data-color]").forEach(btn => btn.addEventListener("click", ev => { ev.stopPropagation(); showColorMenu(d,btn.dataset.color,btn); }));
  document.querySelectorAll("[data-add-node]").forEach(btn => btn.addEventListener("click", ev => { ev.stopPropagation(); showNodeChoices(d,btn.dataset.addNode,btn.dataset.side,btn); }));
  document.querySelectorAll("[data-lane-menu]").forEach(btn => btn.addEventListener("click", ev => {ev.stopPropagation();laneMenu(d,btn.dataset.laneMenu,btn);}));
  document.querySelectorAll("[data-edit-mermaid]").forEach(btn => btn.addEventListener("click", () => editMermaid(d, btn.dataset.editMermaid)));
  document.querySelectorAll("[data-convert-mermaid]").forEach(btn => btn.addEventListener("click", ev => {ev.stopPropagation();convertMermaidCard(d,btn.dataset.convertMermaid);}));
  document.querySelectorAll("[data-resize]").forEach(handle => handle.addEventListener("pointerdown", ev => startResize(ev, d, handle.dataset.resize)));
  document.querySelectorAll("[data-resize-lane]").forEach(handle => handle.addEventListener("pointerdown", ev => startLaneResize(ev,d,handle.dataset.resizeLane)));
  document.querySelectorAll("[data-element]").forEach(el => {
    el.addEventListener("pointerdown", ev => startDrag(ev, d, el));
    el.addEventListener("click", () => {
      if (suppressClick) return;
      if (connectMode) {
        if (!selectedElement) { selectedElement = el.dataset.element; el.classList.add("selected"); toast("Agora selecione o segundo item"); }
        else if (selectedElement !== el.dataset.element) { d.elements.push({ id:id(),type:"connector",from:selectedElement,to:el.dataset.element }); connectMode=false; selectedElement=null; document.getElementById("connectItems")?.classList.remove("active"); touchDiagram(d); drawConnections(d); toast("Conector adicionado"); }
      } else { selectedElement = el.dataset.element; document.querySelectorAll("[data-element]").forEach(x => x.classList.toggle("selected", x === el)); }
    });
  });
  const wrap = document.getElementById("canvasWrap");
  wrap.addEventListener("wheel", ev => { ev.preventDefault(); zoom(ev.deltaY < 0 ? 1.08 : 1 / 1.08, { x: ev.clientX, y: ev.clientY }); }, { passive: false });
  wrap.addEventListener("pointerdown", ev => { if (ev.target.closest("[data-element]") || !wrap.classList.contains("pan-mode")) return; drag = { type: "pan", x: ev.clientX, y: ev.clientY, panX: pan.x, panY: pan.y }; wrap.setPointerCapture(ev.pointerId); });
  wrap.addEventListener("pointermove", ev => {
    if (!drag || drag.type !== "pan") return; pan.x = drag.panX + ev.clientX - drag.x; pan.y = drag.panY + ev.clientY - drag.y; applyTransform();
  });
  wrap.addEventListener("pointerup", () => { if (drag?.type === "pan") drag = null; });
  if (!deleteHandlerBound) {
    window.addEventListener("keydown", ev => {
      const active = currentDiagram();
      if (active && (ev.key === "Delete" || ev.key === "Backspace") && selectedElement && !ev.target.closest("textarea,input")) { deleteElement(active, selectedElement); selectedElement = null; }
    });
    deleteHandlerBound = true;
  }
  drawConnections(d);
  renderAllMermaid(d);
}

function addSticky(d, x = 100 + Math.random() * 140, y = 100 + Math.random() * 110, text = "") {
  const note = { id: id(), type: "sticky", text, color: colors[d.elements.filter(e => e.type === "sticky").length % colors.length], x, y, width: 220, height: 190 };
  d.elements.push(note); touchDiagram(d); render();
  const textarea = document.querySelector(`[data-text="${note.id}"]`); textarea?.focus();
}
function addShape(d, shape = "process") {
  const preset=flowNodeTypes.find(item=>item.type===shape)||flowNodeTypes[0];
  const item = { id:id(),type:"shape",shape,text:preset.label,colorMode:"theme",x:240+Math.random()*120,y:130+Math.random()*120,width:preset.width,height:preset.height };
  d.elements.push(item); touchDiagram(d); render(); document.querySelector(`[data-text="${item.id}"]`)?.focus();
}
function showShapePicker(d,anchor){
  const root=document.getElementById("modalRoot"),rect=anchor.getBoundingClientRect();
  root.innerHTML=`<div class="node-picker-backdrop" id="shapePickerBackdrop"><section class="node-picker" id="shapePicker"><div class="node-picker-title">FORMAS DE PROCESSO</div>${flowNodeTypes.map(item=>`<button data-shape-type="${item.type}"><span>${item.symbol}</span>${item.label}</button>`).join("")}</section></div>`;
  const menu=root.querySelector("#shapePicker");menu.style.left=`${Math.min(rect.left,window.innerWidth-250)}px`;menu.style.top=`${Math.min(rect.bottom+7,window.innerHeight-menu.offsetHeight-14)}px`;
  root.querySelector("#shapePickerBackdrop").addEventListener("pointerdown",ev=>{if(ev.target.id==="shapePickerBackdrop")closeModal();});
  menu.querySelectorAll("[data-shape-type]").forEach(button=>button.addEventListener("click",()=>{const shape=button.dataset.shapeType;closeModal();addShape(d,shape);}));
}
function addLane(d){
  const number=d.elements.filter(e=>e.type==="lane").length+1;
  showNameDialog({title:"Adicionar raia",label:"Área, equipe ou responsável",value:`Raia ${number}`,saveLabel:"Adicionar raia",onSave:name=>{
    const lanes=d.elements.filter(e=>e.type==="lane"),y=lanes.length?Math.max(...lanes.map(l=>l.y+l.height))+16:100;
    d.elements.push({id:id(),type:"lane",name,x:70,y,width:1800,height:260,color:"#e8e6f8"});touchDiagram(d);render();toast("Raia adicionada");
  }});
}
function laneMenu(d,laneId,anchor){
  const lane=d.elements.find(e=>e.type==="lane"&&e.id===laneId);if(!lane)return;
  openActionMenu(anchor,[
    {label:"Renomear raia",icon:"✎",run:()=>showNameDialog({title:"Renomear raia",label:"Área, equipe ou responsável",value:lane.name,saveLabel:"Salvar",onSave:name=>{lane.name=name;touchDiagram(d);render();}})},
    {label:"Excluir raia",icon:"⌫",danger:true,run:()=>showConfirmDialog({title:"Excluir esta raia?",message:"Os elementos permanecerão no quadro, nas posições atuais.",confirmLabel:"Excluir raia",onConfirm:()=>{d.elements=d.elements.filter(e=>e.id!==lane.id);touchDiagram(d);render();toast("Raia excluída");}})}
  ]);
}
function startLaneResize(ev,d,laneId){
  ev.preventDefault();ev.stopPropagation();const lane=d.elements.find(e=>e.type==="lane"&&e.id===laneId),node=document.querySelector(`[data-lane="${laneId}"]`);if(!lane||!node)return;
  const start={y:ev.clientY,height:lane.height};
  const onMove=moveEv=>{lane.height=Math.max(150,start.height+(moveEv.clientY-start.y)/currentScale);node.style.height=`${lane.height}px`;};
  const onUp=()=>{window.removeEventListener("pointermove",onMove);touchDiagram(d);};window.addEventListener("pointermove",onMove);window.addEventListener("pointerup",onUp,{once:true});
}
function showNodeChoices(d,fromId,side,anchor){
  const root=document.getElementById("modalRoot"),rect=anchor.getBoundingClientRect();
  root.innerHTML=`<div class="node-picker-backdrop" id="nodePickerBackdrop"><section class="node-picker" id="nodePicker"><div class="node-picker-title">O que vem depois?</div>${flowNodeTypes.map(item=>`<button data-node-type="${item.type}"><span>${item.symbol}</span>${item.label}</button>`).join("")}</section></div>`;
  const menu=document.getElementById("nodePicker");
  menu.style.left=`${Math.min(rect.left,window.innerWidth-250)}px`;
  menu.style.top=`${Math.min(rect.bottom+7,window.innerHeight-menu.offsetHeight-14)}px`;
  document.getElementById("nodePickerBackdrop").addEventListener("pointerdown",ev=>{if(ev.target.id==="nodePickerBackdrop")root.innerHTML="";});
  menu.querySelectorAll("[data-node-type]").forEach(button=>button.addEventListener("click",()=>{addConnectedNode(d,fromId,side,button.dataset.nodeType);root.innerHTML="";}));
}
function addConnectedNode(d,fromId,side,type){
  const source=d.elements.find(e=>e.id===fromId);if(!source)return;
  const preset=flowNodeTypes.find(item=>item.type===type)||flowNodeTypes[0],gap=100;
  const x=side==="right"?source.x+(source.width||180)+gap:side==="left"?source.x-preset.width-gap:source.x+((source.width||180)-preset.width)/2;
  let y=side==="bottom"?source.y+(source.height||105)+gap:side==="top"?source.y-preset.height-gap:source.y+((source.height||105)-preset.height)/2;
  const lane=d.elements.find(e=>e.type==="lane"&&source.x+(source.width||180)/2>=e.x+135&&source.x+(source.width||180)/2<=e.x+e.width&&source.y+(source.height||105)/2>=e.y&&source.y+(source.height||105)/2<=e.y+e.height);
  if(lane&&(side==="left"||side==="right"))y=Math.max(lane.y+12,Math.min(y,lane.y+lane.height-preset.height-12));
  const next={id:id(),type:"shape",shape:type,text:preset.label,colorMode:"theme",x,y,width:preset.width,height:preset.height};
  d.elements.push(next,{id:id(),type:"connector",from:source.id,to:next.id});selectedElement=null;touchDiagram(d);render();
}
function showMermaidModal(existing = null, options = {}) {
  const importAsDiagram = Boolean(options.importAsDiagram && !existing);
  const defaultCode = `flowchart TD\n    A[Ideia] --> B[Etapa]\n    B --> C[Resultado]`;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop" id="modalBackdrop"><section class="modal mermaid-modal"><div class="modal-head"><div><span class="mermaid-symbol">⌘</span><div><h2>${existing ? "Editar Mermaid" : importAsDiagram ? "Importar como diagrama" : "Adicionar Mermaid"}</h2><p>${importAsDiagram ? "O fluxograma será convertido em formas, conectores e raias editáveis." : "Cole ou escreva código Mermaid 11+."}</p></div></div><button class="icon-button" id="closeModal">×</button></div><label class="field-label">${importAsDiagram ? "Nome do diagrama" : "Título do bloco"}<input class="text-input" id="mermaidTitleInput" value="${escapeHtml(existing?.title || "Diagrama Mermaid")}" /></label><div class="code-preview"><div class="code-pane"><div class="pane-label">CÓDIGO</div><textarea id="mermaidCodeInput" spellcheck="false">${escapeHtml(existing?.code || defaultCode)}</textarea></div><div class="preview-pane"><div class="pane-label">PRÉVIA</div><div id="modalPreview"><span class="render-loading">Renderizando…</span></div></div></div><div class="modal-foot"><span id="validationMessage">${importAsDiagram ? "Cada etapa e conexão ficará editável no quadro." : "A prévia atualiza enquanto você digita."}</span><div><button class="button secondary" id="cancelModal">Cancelar</button><button class="button primary" id="saveMermaid">${existing ? "Salvar alterações" : importAsDiagram ? "Criar diagrama editável" : "Adicionar ao quadro"}</button></div></div></section></div>`;
  const close = () => root.innerHTML = "";
  document.getElementById("closeModal").onclick = close; document.getElementById("cancelModal").onclick = close;
  document.getElementById("modalBackdrop").addEventListener("click", ev => { if (ev.target.id === "modalBackdrop") close(); });
  const codeInput = document.getElementById("mermaidCodeInput");
  const renderPreview = debounce(async () => {
    const target = document.getElementById("modalPreview"); if (!target) return;
    try { target.innerHTML = await renderSvg(codeInput.value, "preview-" + id()); document.getElementById("validationMessage").textContent = "Mermaid válido"; }
    catch (error) { target.innerHTML = `<pre class="render-error">${escapeHtml(error.message || "Erro de sintaxe")}</pre>`; document.getElementById("validationMessage").textContent = "Revise o código Mermaid"; }
  }, 280);
  codeInput.addEventListener("input", renderPreview); renderPreview();
  document.getElementById("saveMermaid").onclick = async () => {
    const code = codeInput.value.trim();
    if (!code) { toast("Escreva o código Mermaid antes de salvar"); return; }
    if (importAsDiagram) {
      const saveButton = document.getElementById("saveMermaid"), status = document.getElementById("validationMessage");
      saveButton.disabled = true; saveButton.textContent = "Convertendo…"; status.textContent = "Lendo formas, conexões e raias…";
      try {
        const elements = await convertMermaidFlowchart(code);
        const title = document.getElementById("mermaidTitleInput").value.trim() || "Diagrama Mermaid";
        const d = { id:id(), title, folderId:null, themeId:DEFAULT_THEME_ID, elements, sourceMermaid:code, createdAt:Date.now(), updatedAt:Date.now() };
        state.diagrams.unshift(d); state.activeDiagramId=d.id; persist(); close(); render(); fitDiagramToView(d); toast("Fluxograma convertido em itens editáveis");
      } catch (error) {
        saveButton.disabled = false; saveButton.textContent = "Criar diagrama editável";
        status.textContent = error.message || "Não foi possível converter este fluxograma.";
      }
      return;
    }
    let d = currentDiagram();
    if (!d) {
      d = { id: id(), title: document.getElementById("mermaidTitleInput").value.trim() || "Novo diagrama", folderId: null, themeId:DEFAULT_THEME_ID, elements: [], createdAt: Date.now(), updatedAt: Date.now() };
      state.diagrams.unshift(d); state.activeDiagramId = d.id;
    }
    const blockTitle = document.getElementById("mermaidTitleInput").value.trim() || "Diagrama Mermaid";
    if (existing) { const item = d.elements.find(e => e.id === existing.id); if (item) { item.code = code; item.title = blockTitle; } }
    else d.elements.push({ id: id(), type: "mermaid", title: blockTitle, code, x: 390 + Math.random() * 80, y: 110 + Math.random() * 80, width: 390, height: 250 });
    touchDiagram(d); close(); render();
  };
}
function editMermaid(d, elementId) { const el = d.elements.find(e => e.id === elementId); if (el) showMermaidModal(el); }
function deleteElement(d, elementId) { d.elements = d.elements.filter(e => e.id !== elementId&&!(e.type==="connector"&&(e.from===elementId||e.to===elementId))); touchDiagram(d); render(); }
function confirmDeleteElement(d,elementId){const item=d.elements.find(e=>e.id===elementId);if(!item)return;showConfirmDialog({title:"Excluir este item?",message:"Essa ação removerá o item e as conexões ligadas a ele.",confirmLabel:"Excluir item",onConfirm:()=>{d.elements=d.elements.filter(e=>e.id!==elementId&&!(e.type==="connector"&&(e.from===elementId||e.to===elementId)));selectedElement=null;touchDiagram(d);render();}});}
function showThemePicker(d){
  let selected=d.themeId||DEFAULT_THEME_ID;
  const root=document.getElementById("modalRoot");
  const options=diagramThemes.map(theme=>`<button class="theme-option ${selected===theme.id?"selected":""}" data-theme-choice="${theme.id}" aria-pressed="${selected===theme.id}" style="${themeStyle(theme.id)}"><span class="theme-sample"><i></i><i></i><i></i></span><span class="theme-name">${theme.name}</span><span class="theme-swatches"><i style="--swatch:${theme.process}"></i><i style="--swatch:${theme.decision}"></i><i style="--swatch:${theme.terminal}"></i><i style="--swatch:${theme.data}"></i></span></button>`).join("");
  root.innerHTML=`<div class="modal-backdrop" id="themeBackdrop"><section class="modal theme-modal" role="dialog" aria-modal="true" aria-labelledby="themeTitle"><div class="modal-head"><div><div class="eyebrow">APARÊNCIA DO QUADRO</div><h2 id="themeTitle">Escolha um tema</h2><p>Visualize as cores, selecione uma paleta e salve no diagrama.</p></div><button class="icon-button" data-close-theme aria-label="Fechar">×</button></div><div class="theme-grid">${options}</div><div class="modal-foot"><span>O tema escolhido fica salvo neste diagrama.</span><div><button class="button secondary" data-close-theme>Cancelar</button><button class="button primary" id="saveTheme">Salvar tema</button></div></div></section></div>`;
  const close=()=>{root.innerHTML="";const canvas=document.getElementById("canvasWrap");if(canvas)canvas.style.cssText=themeStyle(d.themeId||DEFAULT_THEME_ID);};
  root.querySelectorAll("[data-close-theme]").forEach(button=>button.addEventListener("click",close));
  root.querySelector("#themeBackdrop").addEventListener("click",event=>{if(event.target.id==="themeBackdrop")close();});
  root.querySelectorAll("[data-theme-choice]").forEach(button=>button.addEventListener("click",()=>{
    selected=button.dataset.themeChoice;
    root.querySelectorAll("[data-theme-choice]").forEach(option=>{const active=option.dataset.themeChoice===selected;option.classList.toggle("selected",active);option.setAttribute("aria-pressed",String(active));});
    const canvas=document.getElementById("canvasWrap");if(canvas)canvas.style.cssText=themeStyle(selected);
  }));
  root.querySelector("#saveTheme").addEventListener("click",()=>{d.themeId=selected;touchDiagram(d);root.innerHTML="";render();toast(`Tema “${getTheme(selected).name}” aplicado`);});
}
function showColorMenu(d,elementId,anchor){const item=d.elements.find(e=>e.id===elementId);if(!item)return;const root=document.getElementById("modalRoot"),rect=anchor.getBoundingClientRect();root.innerHTML=`<div class="action-menu-backdrop" id="actionMenuBackdrop"><div class="color-menu" id="colorMenu">${colors.map(color=>`<button data-color-choice="${color}" style="--swatch:${color}" aria-label="Selecionar cor" title="Selecionar cor"></button>`).join("")}</div></div>`;const menu=root.querySelector("#colorMenu");menu.style.left=`${Math.min(rect.left,window.innerWidth-menu.offsetWidth-8)}px`;menu.style.top=`${Math.min(rect.bottom+5,window.innerHeight-menu.offsetHeight-8)}px`;root.querySelector("#actionMenuBackdrop").addEventListener("pointerdown",ev=>{if(ev.target.id==="actionMenuBackdrop")closeModal();});menu.querySelectorAll("[data-color-choice]").forEach(button=>button.addEventListener("click",()=>{item.color=button.dataset.colorChoice;if(item.type==="shape")item.colorMode="custom";closeModal();touchDiagram(d);render();}));}

function startDrag(ev, d, el) {
  if (ev.target.closest("button,textarea,input,[data-resize]")) return;
  if (document.getElementById("canvasWrap").classList.contains("pan-mode")) return;
  ev.preventDefault(); ev.currentTarget.setPointerCapture(ev.pointerId);
  drag = { type: "element", id: el.dataset.element, x: ev.clientX, y: ev.clientY, startX: Number.parseFloat(el.style.left), startY: Number.parseFloat(el.style.top) };
  selectedElement = el.dataset.element;
  document.querySelectorAll("[data-element]").forEach(x => x.classList.toggle("selected", x === ev.currentTarget));
  const onMove = moveEv => {
    if (!drag || drag.type !== "element") return;
    const item = d.elements.find(e => e.id === drag.id), node = document.querySelector(`[data-element="${drag.id}"]`); if (!item || !node) return;
    item.x = drag.startX + (moveEv.clientX - drag.x) / currentScale; item.y = drag.startY + (moveEv.clientY - drag.y) / currentScale;
    node.style.left = item.x + "px"; node.style.top = item.y + "px"; suppressClick = true; drawConnections(d);
  };
  const onUp = () => { if (drag?.type === "element") { drag = null; touchDiagram(d); setTimeout(() => suppressClick = false, 10); } window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp, { once: true });
}
function startResize(ev, d, elementId) {
  ev.preventDefault(); ev.stopPropagation();
  const el = d.elements.find(e => e.id === elementId), node = document.querySelector(`[data-element="${elementId}"]`); if (!el || !node) return;
  const start = { x: ev.clientX, y: ev.clientY, width: node.offsetWidth, height: node.offsetHeight };
  const onMove = moveEv => { el.width = Math.max(180, start.width + (moveEv.clientX - start.x) / currentScale); el.height = Math.max(105, start.height + (moveEv.clientY - start.y) / currentScale); node.style.width = `${el.width}px`; node.style.height = `${el.height}px`; drawConnections(d); };
  const onUp = () => { window.removeEventListener("pointermove", onMove); touchDiagram(d); };
  window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp, { once: true });
}
function zoom(factor, point) {
  const next = Math.min(2.4, Math.max(0.45, currentScale * factor));
  if (point) { const rect = document.getElementById("canvasWrap").getBoundingClientRect(); const px = point.x - rect.left, py = point.y - rect.top; pan.x = px - (px - pan.x) * next / currentScale; pan.y = py - (py - pan.y) * next / currentScale; }
  currentScale = next; applyTransform();
}
function applyTransform() { const content = document.getElementById("canvasContent"); if (content) content.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${currentScale})`; const label = document.getElementById("zoomLabel"); if (label) label.textContent = `${Math.round(currentScale * 100)}%`; }
function resetView() { currentScale = 1; pan = { x: 0, y: 0 }; applyTransform(); }

async function renderAllMermaid(d) {
  for (const element of d.elements.filter(e => e.type === "mermaid")) {
    const target = document.querySelector(`[data-render="${element.id}"]`); if (!target) continue;
    try { target.innerHTML = await renderSvg(element.code, "canvas-" + element.id); }
    catch (error) { target.innerHTML = `<pre class="render-error">${escapeHtml(error.message || "Não foi possível renderizar este Mermaid")}</pre>`; }
  }
}
function connectionPoint(item,side){
  const x=item.x,y=item.y,w=item.width||220,h=item.height||190;
  if(item.shape==="decision"){
    const insetX=w*.14,insetY=h*.14;
    if(side==="top")return{x:x+w/2,y:y+insetY};
    if(side==="bottom")return{x:x+w/2,y:y+h-insetY};
    if(side==="left")return{x:x+insetX,y:y+h/2};
    return{x:x+w-insetX,y:y+h/2};
  }
  if(side==="top")return{x:x+w/2,y};
  if(side==="bottom")return{x:x+w/2,y:y+h};
  if(side==="left")return{x,y:y+h/2};
  return{x:x+w,y:y+h/2};
}
function routeConnection(line,d){
  const a=d.elements.find(e=>e.id===line.from),b=d.elements.find(e=>e.id===line.to);
  if(!a||!b)return null;
  const center=e=>({x:e.x+(e.width||220)/2,y:e.y+(e.height||190)/2});
  const ca=center(a),cb=center(b),sides=["top","right","bottom","left"];
  const vector={top:{x:0,y:-1},right:{x:1,y:0},bottom:{x:0,y:1},left:{x:-1,y:0}};
  const obstacles=d.elements.filter(e=>e.id!==a.id&&e.id!==b.id&&e.type!=="connector"&&e.type!=="lane");
  const stub=24;
  const compact=points=>{
    const unique=points.filter((p,i)=>i===0||Math.abs(p.x-points[i-1].x)>.5||Math.abs(p.y-points[i-1].y)>.5);
    return unique.filter((p,i,all)=>i===0||i===all.length-1||!((Math.abs(p.x-all[i-1].x)<.5&&Math.abs(p.x-all[i+1].x)<.5)||(Math.abs(p.y-all[i-1].y)<.5&&Math.abs(p.y-all[i+1].y)<.5)));
  };
  const blocked=(p1,p2,o)=>{
    const pad=12,left=o.x-pad,right=o.x+(o.width||220)+pad,top=o.y-pad,bottom=o.y+(o.height||190)+pad;
    if(Math.abs(p1.y-p2.y)<.5)return p1.y>top&&p1.y<bottom&&Math.max(Math.min(p1.x,p2.x),left)<Math.min(Math.max(p1.x,p2.x),right);
    if(Math.abs(p1.x-p2.x)<.5)return p1.x>left&&p1.x<right&&Math.max(Math.min(p1.y,p2.y),top)<Math.min(Math.max(p1.y,p2.y),bottom);
    return true;
  };
  const length=pts=>pts.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-pts[i].x)+Math.abs(p.y-pts[i].y),0);
  let best=null;
  for(const fromSide of sides)for(const toSide of sides)for(const horizontalFirst of [true,false]){
    const start=connectionPoint(a,fromSide),end=connectionPoint(b,toSide);
    const p1={x:start.x+vector[fromSide].x*stub,y:start.y+vector[fromSide].y*stub};
    const p4={x:end.x+vector[toSide].x*stub,y:end.y+vector[toSide].y*stub};
    const bend=horizontalFirst?{x:p4.x,y:p1.y}:{x:p1.x,y:p4.y};
    const pts=compact([start,p1,bend,p4,end]);
    let collisions=0;
    for(let i=1;i<pts.length;i++)for(const obstacle of obstacles)if(blocked(pts[i-1],pts[i],obstacle))collisions++;
    const toward={x:cb.x-ca.x,y:cb.y-ca.y};
    const sourceDot=vector[fromSide].x*toward.x+vector[fromSide].y*toward.y;
    const targetDot=vector[toSide].x*(-toward.x)+vector[toSide].y*(-toward.y);
    const directionPenalty=(sourceDot<0?1:0)+(targetDot<0?1:0);
    const score=collisions*100000+directionPenalty*900+length(pts)+Math.max(0,pts.length-2)*7;
    if(!best||score<best.score)best={pts,score};
  }
  if(!best)return null;
  const dPath=best.pts.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");
  let label=null,maxLength=-1;
  for(let i=1;i<best.pts.length;i++){
    const p1=best.pts[i-1],p2=best.pts[i],segLength=Math.abs(p2.x-p1.x)+Math.abs(p2.y-p1.y);
    if(segLength>maxLength){maxLength=segLength;label={x:(p1.x+p2.x)/2+(Math.abs(p1.x-p2.x)<1?8:0),y:(p1.y+p2.y)/2-(Math.abs(p1.y-p2.y)<1?8:0),anchor:Math.abs(p1.x-p2.x)<1?"start":"middle"};}
  }
  return{dPath,label};
}
function drawConnections(d) {
  const svg=document.getElementById("connections");if(!svg)return;
  const lines=d.elements.filter(e=>e.type==="connector");
  svg.innerHTML=`<defs><marker id="arrowhead" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L9,4 L0,8 Z" style="fill:var(--diagram-connector,#63748b)" /></marker></defs>`+lines.map(line=>{
    const route=routeConnection(line,d);if(!route)return "";
    const style=line.stroke==="dotted"?'stroke-dasharray="5 5"':line.stroke==="thick"?'stroke-width="3"':"";
    return `<path class="connector-path ${selectedElement===line.id?"selected":""}" data-connector="${line.id}" d="${route.dPath}" marker-end="url(#arrowhead)" ${style}/>${line.text?`<text class="connector-label" x="${route.label.x}" y="${route.label.y}" text-anchor="${route.label.anchor}">${escapeHtml(line.text)}</text>`:""}`;
  }).join("");
  svg.querySelectorAll("[data-connector]").forEach(path=>path.addEventListener("click",ev=>{ev.stopPropagation();selectedElement=path.dataset.connector;drawConnections(d);}));
}
async function getMermaid() {
  if (!mermaidPromise) mermaidPromise = import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs").then(module => { module.default.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default", flowchart: { curve: "linear", htmlLabels: true } }); return module.default; });
  return mermaidPromise;
}
function serializeMermaid(task){const result=mermaidQueue.then(task,task);mermaidQueue=result.then(()=>undefined,()=>undefined);return result;}
async function renderSvg(source, renderId) {
  const mermaid = await getMermaid();
  return serializeMermaid(async()=>{const result=await mermaid.render(renderId.replace(/[^a-zA-Z0-9_-]/g,""),source);return result.svg;});
}

async function convertMermaidFlowchart(source,offset={x:0,y:0}) {
  const graph=await serializeMermaid(async()=>{
    const mermaid=await getMermaid(),parsed=await mermaid.mermaidAPI.getDiagramFromText(source),db=parsed.db||parsed.parser?.yy;
    const diagramType=String(parsed.type||parsed.diagramType||"").toLowerCase();
    if(!/flowchart|graph|swimlane/.test(diagramType)||!db?.getVertices||!db?.getEdges) throw new Error("A conversão editável aceita Mermaid flowchart, graph e swimlane. Outros tipos podem ser adicionados como cartão Mermaid no editor.");
    const rawVertices=db.getVertices(),vertices=[...(rawVertices instanceof Map?rawVertices.values():Array.isArray(rawVertices)?rawVertices:Object.values(rawVertices||{}))].map(v=>({...v}));
    const edges=Array.from(db.getEdges()||[]).map(e=>({...e}));
    const groups=typeof db.getSubGraphs==="function"?(db.getSubGraphs()||[]).map(group=>({...group,nodes:[...(group.nodes||[])]})):[];
    const direction=typeof db.getDirection==="function"?String(db.getDirection()||"TD").toUpperCase():"TD";
    return {diagramType,vertices,edges,groups,direction};
  });
  const {vertices,edges,groups,direction}=graph;
  if(!vertices.length)throw new Error("Não encontrei etapas neste fluxograma.");
  const byId=new Map(vertices.map(v=>[String(v.id),v]));
  const validEdges=edges.filter(e=>byId.has(String(e.start))&&byId.has(String(e.end)));
  const ranks=new Map(vertices.map(v=>[String(v.id),0])),incoming=new Map(vertices.map(v=>[String(v.id),0])),outgoing=new Map(vertices.map(v=>[String(v.id),[]]));
  for(const edge of validEdges){incoming.set(String(edge.end),(incoming.get(String(edge.end))||0)+1);outgoing.get(String(edge.start))?.push(String(edge.end));}
  const queue=vertices.map(v=>String(v.id)).filter(key=>incoming.get(key)===0);
  for(let i=0;i<queue.length;i++){const from=queue[i];for(const to of outgoing.get(from)||[]){ranks.set(to,Math.max(ranks.get(to)||0,(ranks.get(from)||0)+1));incoming.set(to,incoming.get(to)-1);if(incoming.get(to)===0)queue.push(to);}}
  const maxRank=Math.max(0,...ranks.values());
  const laneGroups=[];const assigned=new Set();
  for(const group of groups||[]){
    const members=(group.nodes||[]).map(String).filter(key=>byId.has(key)&&!assigned.has(key));
    if(!members.length)continue;
    members.forEach(key=>assigned.add(key));laneGroups.push({id:String(group.id||id()),name:String(group.title||group.id||"Raia"),members});
  }
  const ungrouped=vertices.map(v=>String(v.id)).filter(key=>!assigned.has(key));
  const elementByKey=new Map();let elements=[];const shapeCount={};
  const makeNode=(key,x,y)=>{
    const vertex=byId.get(key),shape=mermaidShape(vertex.type),preset=flowNodeTypes.find(item=>item.type===shape)||flowNodeTypes[0];
    const label=plainMermaidLabel(vertex.text||key),width=preset.width,height=preset.height,nodeId=id();
    shapeCount[shape]=(shapeCount[shape]||0)+1;
    const item={id:nodeId,type:"shape",shape,text:label,colorMode:"theme",x,y,width,height};
    elementByKey.set(key,item);elements.push(item);return item;
  };
  let freeNodesTop=90;
  if(laneGroups.length){
    const laneX=60,laneWidth=Math.max(760,(maxRank+1)*255+230);let laneY=70;
    for(const group of laneGroups){
      const members=group.members.slice().sort((a,b)=>(ranks.get(a)-ranks.get(b))||a.localeCompare(b));
      const layerCounts=new Map();members.forEach(key=>layerCounts.set(ranks.get(key),(layerCounts.get(ranks.get(key))||0)+1));
      const laneHeight=Math.max(230,...[...layerCounts.values()].map(count=>count*150+90));
      elements.push({id:id(),type:"lane",name:group.name,x:laneX,y:laneY,width:laneWidth,height:laneHeight});
      const layerIndexes=new Map();
      for(const key of members){const rank=ranks.get(key)||0,index=layerIndexes.get(rank)||0;layerIndexes.set(rank,index+1);const preset=flowNodeTypes.find(item=>item.type===mermaidShape(byId.get(key).type))||flowNodeTypes[0];const count=layerCounts.get(rank)||1;const rowY=laneY+(laneHeight-(count*preset.height+(count-1)*18))/2+index*(preset.height+18);makeNode(key,laneX+185+rank*255,rowY);}
      laneY+=laneHeight+14;
    }
    freeNodesTop=laneY+20;
  }
  if(ungrouped.length){
    const remaining=ungrouped.slice().sort((a,b)=>(ranks.get(a)-ranks.get(b))||a.localeCompare(b)),layers=new Map();
    for(const key of remaining){const rank=ranks.get(key)||0;if(!layers.has(rank))layers.set(rank,[]);layers.get(rank).push(key);}
    for(const [rank,keys] of layers){keys.forEach((key,index)=>{const preset=flowNodeTypes.find(item=>item.type===mermaidShape(byId.get(key).type))||flowNodeTypes[0];if(direction==="LR"||direction==="RL"){const col=direction==="RL"?maxRank-rank:rank;makeNode(key,100+col*280,freeNodesTop+index*175);}else{const row=direction==="BT"?maxRank-rank:rank;makeNode(key,120+index*235,freeNodesTop+row*205);}});}
  }
  for(const edge of validEdges){const from=elementByKey.get(String(edge.start)),to=elementByKey.get(String(edge.end));if(from&&to)elements.push({id:id(),type:"connector",from:from.id,to:to.id,text:plainMermaidLabel(edge.text||""),stroke:edge.stroke});}
  elements.forEach(element=>{if(element.type!=="connector"){element.x+=offset.x;element.y+=offset.y;}});return elements;
}
function convertMermaidCard(d,elementId){
  const card=d.elements.find(e=>e.id===elementId&&e.type==="mermaid");if(!card)return;
  showConfirmDialog({title:"Converter para formas editáveis?",message:"O cartão será trocado por formas, raias e setas. O código original fica guardado no quadro.",confirmLabel:"Converter diagrama",onConfirm:async()=>{
    try{const elements=await convertMermaidFlowchart(card.code,{x:(card.x||0)-60,y:(card.y||0)-70});d.elements=d.elements.filter(e=>e.id!==card.id);d.elements.push(...elements);d.sourceMermaid=card.code;touchDiagram(d);render();fitDiagramToView(d);toast("Diagrama convertido em itens editáveis");}
    catch(error){toast(error.message||"Não foi possível converter este fluxograma");}
  }});
}
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
function plainMermaidLabel(value){
  const box=document.createElement("textarea");box.innerHTML=String(value).replaceAll("<br>"," ").replaceAll("<br/>"," ").replaceAll("<br />"," ").replace(/<[^>]*>/g,"");return box.value.trim();
}
function fitDiagramToView(d){
  requestAnimationFrame(()=>{const wrap=document.getElementById("canvasWrap");if(!wrap)return;const items=d.elements.filter(e=>e.type!=="connector");if(!items.length)return;const left=Math.min(...items.map(e=>e.x)),top=Math.min(...items.map(e=>e.y)),right=Math.max(...items.map(e=>e.x+(e.width||180))),bottom=Math.max(...items.map(e=>e.y+(e.height||105))),width=right-left,height=bottom-top;currentScale=Math.max(.45,Math.min(1.15,(wrap.clientWidth-72)/width,(wrap.clientHeight-72)/height));pan.x=(wrap.clientWidth-width*currentScale)/2-left*currentScale;pan.y=(wrap.clientHeight-height*currentScale)/2-top*currentScale;applyTransform();});
}

function touchDiagram(d) {
  d.updatedAt = Date.now(); persist();
  const status = document.getElementById("saveStatus"); if (status) { status.innerHTML = "<i></i> Salvando…"; clearTimeout(touchDiagram.timer); touchDiagram.timer = setTimeout(() => { if (status.isConnected) status.innerHTML = "<i></i> Salvo"; }, 450); }
  const count = document.querySelector(".bottom-bar span:nth-child(2)"); if (count) count.textContent = itemSummary(d);
}
function publish(d) {
  const payload = base64UrlEncode(JSON.stringify({ title: diagramTitle(d), themeId:d.themeId||DEFAULT_THEME_ID, elements: d.elements }));
  const url = `${location.origin}${location.pathname}#share=${payload}`;
  showShareDialog(url);
}
function showShareDialog(url){
  const root=document.getElementById("modalRoot");root.innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><section class="modal action-modal"><div class="modal-head"><div><div><h2>Publicar diagrama</h2><p>Qualquer pessoa com este link poderá visualizar o quadro.</p></div></div><button class="icon-button" data-close-modal>×</button></div><label class="field-label">Link de visualização<input class="text-input" id="shareUrl" readonly value="${escapeHtml(url)}" /></label><div class="modal-actions"><button class="button secondary" data-close-modal>Fechar</button><button class="button primary" id="copyShare">Copiar link</button></div></section></div>`;
  root.querySelectorAll("[data-close-modal]").forEach(btn=>btn.addEventListener("click",closeModal));root.querySelector("#modalBackdrop").addEventListener("click",ev=>{if(ev.target.id==="modalBackdrop")closeModal();});
  root.querySelector("#copyShare").addEventListener("click",async()=>{const input=root.querySelector("#shareUrl");try{await navigator.clipboard.writeText(url);toast("Link copiado");closeModal();}catch{input.focus();input.select();document.execCommand("copy");toast("Link copiado");}});
}
function renderShared() {
  try {
    const encoded = new URLSearchParams(location.hash.slice(1)).get("share");
    const data = JSON.parse(base64UrlDecode(encoded));
    app.innerHTML = `<div class="shared-view"><header class="shared-top"><a href="${location.pathname}" class="brand mini-brand"><div class="brand-mark">V</div><strong>VLI Diagrams</strong></a><span>Visualização publicada</span></header><main><div class="shared-title"><div class="eyebrow">QUADRO PUBLICADO</div><h1>${escapeHtml(data.title)}</h1></div><div class="shared-canvas-wrap" style="${themeStyle(data.themeId)}"><div class="shared-canvas" id="sharedCanvas">${data.elements.filter(e=>e.type==="lane").map(renderElement).join("")}<svg class="connections" id="connections" width="5000" height="5000"></svg>${data.elements.filter(e=>e.type!=="connector"&&e.type!=="lane").map(renderElement).join("")}</div></div></main></div>`;
    data.elements.filter(e => e.type === "sticky").forEach(e => { const n = document.querySelector(`[data-text="${e.id}"]`); if (n) { n.disabled = true; n.readOnly = true; } });
    drawConnections({ elements: data.elements }); renderAllMermaid({ elements: data.elements });
  } catch { app.innerHTML = `<div class="share-error"><h1>Este link não parece válido</h1><a href="${location.pathname}">Abrir VLI Diagrams</a></div>`; }
}
function base64UrlEncode(value) { const bytes = new TextEncoder().encode(value); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
function base64UrlDecode(value) { const normal = value.replaceAll("-", "+").replaceAll("_", "/"); const binary = atob(normal + "=".repeat((4 - normal.length % 4) % 4)); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function toast(message) { const el = document.getElementById("toast"); if (!el) return; el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400); }
function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }

render();
