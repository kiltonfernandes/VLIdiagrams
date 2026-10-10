import { DEFAULT_THEME_ID, diagramThemes, getTheme } from "./themes.js";
import { fallbackFlowchartFromSource, snapshotMermaid, nativeElements } from "./mermaid-native.js";
import { routeConnection } from "./connections.js";
import { layoutElements, geometryKey, diagramBounds } from "./layout.js";
import { sequenceGeometry, sequenceSvg, validateSequence } from "./sequence.js";
import { buildDiagramSvg, downloadDiagram, exportFilename, pngDimensions, portableMermaid, exportElements } from "./export.js";

const STORAGE_KEY = "vli-diagrams-v1";
const colors = ["#ffe58f", "#ffbdbd", "#c7f2c2", "#c8e4ff", "#e7d1ff", "#ffd8a8"];
function themeStyle(themeId=DEFAULT_THEME_ID){const t=getTheme(themeId);return `--diagram-canvas:${t.canvas};--diagram-grid:${t.grid};--diagram-lane:${t.lane};--diagram-lane-header:${t.laneHeader};--diagram-line:${t.border};--diagram-ink:${t.ink};--diagram-connector:${t.connector};--theme-process:${t.process};--theme-decision:${t.decision};--theme-terminal:${t.terminal};--theme-data:${t.data};--theme-subprocess:${t.subprocess};`;}

const flowNodeTypes = [
  { type:"process", label:"Novo passo", symbol:"▭", width:180, height:105 },
  { type:"decision", label:"Nova decisão", symbol:"◇", width:150, height:150 },
  { type:"terminator", label:"Início / fim", symbol:"⬭", width:170, height:78 },
  { type:"io", label:"Entrada / saída", symbol:"▱", width:180, height:95 },
  { type:"document", label:"Documento", symbol:"▤", width:170, height:100 },
  { type:"database", label:"Dados / armazenamento", symbol:"▤", width:160, height:100 },
  { type:"subprocess", label:"Subprocesso", symbol:"▣", width:180, height:105 }
];
const initialState = { folders: [], diagrams: [], activeDiagramId: null };
let state = structuredClone(initialState);
let workspaceReady = false;
let saveTimer = null;
let saveInProgress = false;
let mermaidPromise;
let mermaidQueue = Promise.resolve();
let selectedElement = null;
let connectMode = false;
let deleteHandlerBound = false;
let activeViewFolderId = null;
let currentScale = 1;
const MIN_SCALE = 0.02;
let layoutUndo = null;
let layoutBusy = false;
let overviewVisible = false;
let pan = { x: 0, y: 0 };
let drag = null;
let suppressClick = false;
let shareMode = new URLSearchParams(location.hash.slice(1)).has("share");

const app = document.querySelector("#app");

function readState() {
  try { return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return structuredClone(initialState); }
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveWorkspace, 350);
}
async function saveWorkspace() {
  if (saveInProgress) return;
  saveInProgress = true;
  const status = document.getElementById("saveStatus");
  if (status) status.innerHTML = "<i></i> Salvando…";
  try {
    let savedSnapshot = "";
    do {
      const snapshot = JSON.stringify(state);
      const response = await fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: snapshot });
      if (response.status === 401) { showLogin(); return; }
      if (!response.ok) throw new Error("Falha ao salvar no Turso");
      savedSnapshot = snapshot;
    } while (savedSnapshot !== JSON.stringify(state));
    if (status?.isConnected) status.innerHTML = "<i></i> Salvo no Turso";
  } catch (error) {
    console.error(error);
    if (status?.isConnected) status.innerHTML = "<i></i> Erro ao salvar";
  } finally { saveInProgress = false; }
}
function showLogin(message = "Entre com a chave de acesso configurada na Vercel para abrir seu espaço.") {
  workspaceReady = false;
  app.innerHTML = `<main class="login-screen"><form class="login-card" id="loginForm"><div class="brand-mark">V</div><p class="eyebrow">VLI DIAGRAMS</p><h1>Seu espaço privado</h1><p>${escapeHtml(message)}</p><label class="field-label" for="accessToken">Chave de acesso</label><input class="text-input" id="accessToken" type="password" autocomplete="current-password" required placeholder="VLI_MCP_TOKEN"/><button class="button primary" type="submit">Entrar</button><div class="login-error" id="loginError" role="alert"></div></form></main>`;
  document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault(); const button = event.currentTarget.querySelector("button[type=submit]"); button.disabled = true; button.textContent = "Conectando…";
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: document.getElementById("accessToken").value }) });
      if (!response.ok) throw new Error("A chave não foi aceita. Confira o valor de VLI_MCP_TOKEN na Vercel.");
      await bootWorkspace();
    } catch (error) { document.getElementById("loginError").textContent = error.message; button.disabled = false; button.textContent = "Entrar"; }
  });
}
async function bootWorkspace() {
  app.innerHTML = `<main class="login-screen"><div class="login-card loading-card"><div class="brand-mark">V</div><h1>Conectando ao seu espaço…</h1><p>Carregando diagramas do Turso.</p></div></main>`;
  try {
    const response = await fetch("/api/workspace");
    if (response.status === 401) { showLogin(); return; }
    if (!response.ok) throw new Error("A API não conseguiu ler o Turso. Confira as variáveis TURSO na Vercel.");
    const remote = await response.json();
    const local = readState();
    if (!remote.diagrams?.length && !remote.folders?.length && (local.diagrams?.length || local.folders?.length)) {
      const save = await fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(local) });
      if (!save.ok) throw new Error("Não foi possível copiar os dados deste navegador para o Turso.");
      state = local;
    } else state = { ...initialState, ...remote };
    let converted = false;
    for (const diagram of state.diagrams) {
      for (const card of [...(diagram.elements || []).filter(element => element.type === "mermaid" && element.convertOnLoad)]) {
        try {
          const elements = await convertMermaidFlowchart(card.code, { x: card.x || 0, y: card.y || 0 });
          diagram.elements = diagram.elements.filter(element => element.id !== card.id);
          diagram.elements.push(...elements);
          diagram.sourceMermaid = card.code;
          diagram.updatedAt = Date.now();
          converted = true;
        } catch (error) {
          card.convertOnLoad = false;
          console.warn("O código Mermaid ficou como cartão porque não deu para converter em formas editáveis:", error);
        }
      }
    }
    if (converted) {
      const save = await fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(state) });
      if (!save.ok) throw new Error("O Mermaid foi lido, mas as formas convertidas não puderam ser salvas no Turso.");
    }
    const requestedDiagramId = new URLSearchParams(location.search).get("diagram");
    const requestedDiagram = requestedDiagramId && state.diagrams.find(diagram => diagram.id === requestedDiagramId);
    if (requestedDiagram) {
      state.activeDiagramId = requestedDiagram.id;
      activeViewFolderId = requestedDiagram.folderId || null;
    }
    overviewVisible = shouldShowOverview(currentDiagram());
    workspaceReady = true; localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render();
    if (currentDiagram()) fitDiagramToView(currentDiagram());
  } catch (error) {
    app.innerHTML = `<main class="login-screen"><div class="login-card"><div class="brand-mark">V</div><h1>Não consegui carregar o espaço</h1><p>${escapeHtml(error.message)}</p><button class="button primary" id="retryWorkspace">Tentar novamente</button></div></main>`;
    document.getElementById("retryWorkspace").addEventListener("click", bootWorkspace);
  }
}
function id() { return crypto.randomUUID(); }
function escapeHtml(value = "") { return String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function currentDiagram() { return state.diagrams.find(d => d.id === state.activeDiagramId); }
function activeFolderId() { return currentDiagram()?.folderId || null; }
function diagramTitle(d) { return d?.title || "Diagrama sem título"; }
function formatDate(value) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value)); }
function itemSummary(d){const items=d.elements.filter(e=>e.type!=="connector").length,lanes=d.elements.filter(e=>e.type==="lane").length;return `${items} itens${lanes?` · ${lanes} raias`:""} no quadro`;}

function render() {
  if (shareMode) return renderShared();
  if (!workspaceReady) return;
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
        <div class="sidebar-bottom"><div class="profile"><div class="avatar">K</div><div><b>Meu espaço</b><small>Sincronizado no Turso</small></div><button class="icon-button" id="settings" title="Configurações">⚙</button></div></div>
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
  return `<header class="editor-topbar"><button class="back-button" id="backToLibrary" title="Voltar">←</button><div class="title-stack"><div class="crumbs"><span>Diagramas</span><span>/</span><span>${escapeHtml(state.folders.find(f => f.id === d.folderId)?.name || "Sem pasta")}</span></div><input class="diagram-title-input" id="diagramTitle" value="${escapeHtml(diagramTitle(d))}" aria-label="Nome do diagrama" /></div><span class="save-status" id="saveStatus"><i></i> Salvo</span><div class="top-actions"><button class="button secondary" id="moveDiagram">Mover para pasta</button><button class="button secondary" id="diagramMenu">···</button><button class="button secondary" id="exportDiagram">Exportar ↓</button><button class="button primary" id="publishDiagram">Publicar ↗</button></div></header>
    <div class="workspace">
      <div class="canvas-toolbar">
        <div class="tool-group"><button class="tool active" data-tool="select" title="Selecionar e mover">↖</button><button class="tool" data-tool="pan" title="Mover tela">✥</button></div><div class="tool-divider"></div>
        <button class="tool wide" id="addSticky" title="Adicionar nota adesiva"><span class="tool-sticky">▰</span><span>Nota</span></button>
        <button class="tool wide" id="addShape" title="Escolher forma"><span class="tool-shape">◇</span><span>Forma</span></button>
        <button class="tool wide" id="addLane" title="Adicionar raia de responsabilidade"><span class="tool-lane">▤</span><span>Raia</span></button>
        <button class="tool wide" id="connectItems" title="Conectar dois itens"><span>⤳</span><span>Conectar</span></button>
        <button class="tool wide" id="addMermaid" title="Adicionar bloco Mermaid"><span class="tool-mermaid">⌘</span><span>Mermaid</span></button><button class="tool wide" id="addSequence" title="Adicionar sequência nativa"><span>⇄</span><span>Sequência</span></button><button class="tool wide" id="themeButton" title="Escolher tema do diagrama"><span class="tool-theme">◉</span><span>Tema</span></button>
        <div class="toolbar-spacer"></div><div class="zoom-controls"><button class="icon-button" id="zoomOut" aria-label="Diminuir zoom">−</button><span id="zoomLabel">100%</span><button class="icon-button" id="zoomIn" aria-label="Aumentar zoom">＋</button><button class="icon-button" id="fitCanvas" title="Ver diagrama inteiro" aria-label="Ver diagrama inteiro">⛶</button><button class="icon-button" id="readCanvas" title="Ler etapa selecionada ou início" aria-label="Ler etapa selecionada ou início">1:1</button></div>
      </div>
      <div class="reading-toolbar"><button class="button secondary ${overviewVisible?"":"active"}" id="fullFlowCanvas" aria-pressed="${!overviewVisible}">Fluxo completo</button><button class="button secondary ${overviewVisible?"active":""}" id="overviewCanvas" aria-pressed="${overviewVisible}" ${d.elements.some(e=>e.type==="lane")?"":"disabled"}>Visão por fases</button><button class="button secondary" id="organizeFlow">Organizar fluxo</button><button class="button secondary" id="undoLayout" ${layoutUndo?.diagramId===d.id?"":"disabled"}>Desfazer organização</button><label>Direção <select id="flowDirection" aria-label="Direção do fluxo"><option value="DOWN" ${d.layoutDirection!=="RIGHT"?"selected":""}>De cima para baixo</option><option value="RIGHT" ${d.layoutDirection==="RIGHT"?"selected":""}>Da esquerda para a direita</option></select></label><label>Foco <select id="focusLane" aria-label="Focar uma fase ou raia"><option value="">Diagrama inteiro</option>${d.elements.filter(e=>e.type==="lane").map(l=>`<option value="${l.id}">${escapeHtml(l.name)}</option>`).join("")}</select></label></div>
      <div class="canvas-wrap ${overviewVisible?"overview-mode":""}" id="canvasWrap" style="${themeStyle(d.themeId)}"><div class="canvas" id="canvas"><div class="canvas-content" id="canvasContent">${d.elements.filter(e=>e.type==="lane").map(e=>renderElement(e,d.themeId)).join("")}<svg class="connections" id="connections" width="5000" height="5000" aria-label="Conectores"></svg>${d.elements.filter(e => e.type !== "connector" && e.type !== "lane").map(e=>renderElement(e,d.themeId)).join("")}</div></div>${renderPhaseOverview(d)}<div class="canvas-hint" id="canvasHint">Role para mover a tela; Ctrl + rolagem para aproximar</div><button class="diagram-minimap" id="diagramMinimap" aria-label="Minimapa: clique para centralizar uma região"><svg id="minimapSvg" viewBox="0 0 176 112" aria-hidden="true"></svg></button></div>
      <div class="bottom-bar"><span><i class="live-dot"></i> Salvamento automático</span><span>${itemSummary(d)}</span></div>
    </div>`;
}

function renderElement(e,themeId=currentDiagram()?.themeId) {
  if (e.type === "connector") return "";
  if (e.type === "lane") return `<section class="swimlane" data-lane="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width}px;height:${e.height}px"><div class="lane-label"><span>${e.kind==="phase"?"FASE":"RAIA"}</span><strong>${escapeHtml(e.name)}</strong><button class="lane-menu-button" data-lane-menu="${e.id}" title="Opções da raia">···</button></div><div class="lane-resize" data-resize-lane="${e.id}" title="Arraste para ajustar a altura"></div></section>`;
  if (e.type === "sticky") return `<article class="sticky" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;background:${e.color};width:${e.width || 220}px;height:${e.height || 190}px"><div class="sticky-head"><span class="drag-grip">⠿</span><div class="sticky-controls"><button class="sticky-control" data-color="${e.id}" title="Mudar cor">●</button><button class="sticky-control" data-delete="${e.id}" title="Excluir">×</button></div></div><textarea class="sticky-text" data-text="${e.id}" placeholder="Escreva uma ideia...">${escapeHtml(e.text)}</textarea><div class="resize-handle" data-resize="${e.id}"></div></article>`;
  if(e.type === "sequence") return `<article class="sequence-card" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width}px;height:${e.height}px"><div class="sequence-head"><strong>${escapeHtml(e.title||"Sequência")}</strong><div><button class="button secondary" data-edit-sequence="${e.id}">Editar sequência</button><button class="icon-button" data-delete="${e.id}" aria-label="Excluir sequência">×</button></div></div>${sequenceSvg(e.model,getTheme(themeId),"native-"+e.id)}</article>`;
  if (e.type === "shape") return `<article class="shape-card ${escapeHtml(e.shape || "process")}" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width || 180}px;height:${e.height || 105}px;${e.colorMode === "custom" ? `--node-accent:${e.color};` : ""}"><div class="shape-head"><button class="sticky-control" data-color="${e.id}" title="Mudar cor">●</button><button class="sticky-control" data-delete="${e.id}" title="Excluir">×</button></div><textarea data-text="${e.id}" placeholder="Texto da forma">${escapeHtml(e.text)}</textarea>${["top","right","bottom","left"].map(side=>`<button class="node-port ${side}" data-add-node="${e.id}" data-side="${side}" title="Adicionar item ${side === "top" ? "acima" : side === "right" ? "à direita" : side === "bottom" ? "abaixo" : "à esquerda"}">+</button>`).join("")}<div class="resize-handle" data-resize="${e.id}"></div></article>`;
  return `<article class="mermaid-card" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width || 390}px;min-height:${e.height || 250}px"><div class="mermaid-head"><div><span class="mermaid-symbol">⌘</span><strong>${escapeHtml(e.title || "Diagrama Mermaid")}</strong></div><div><button class="mermaid-action" data-convert-mermaid="${e.id}" title="Converter em formas editáveis">◇</button><button class="mermaid-action" data-edit-mermaid="${e.id}" title="Editar código">✎</button><button class="mermaid-action" data-delete="${e.id}" title="Excluir">×</button></div></div><div class="mermaid-render" data-render="${e.id}"><div class="render-loading">Renderizando diagrama…</div></div><div class="mermaid-foot"><span>MERMAID 11+</span><button data-edit-mermaid="${e.id}">Editar código</button></div><div class="resize-handle" data-resize="${e.id}"></div></article>`;
}
function shouldShowOverview(d){return Boolean(d&&d.elements.filter(e=>e.type==="shape").length>25&&d.elements.some(e=>e.type==="lane"));}
function renderPhaseOverview(d){
  const lanes=d.elements.filter(e=>e.type==="lane"),nodes=d.elements.filter(e=>e.type==="shape");
  const byId=new Map(d.elements.map(e=>[e.id,e]));
  const members=lane=>nodes.filter(e=>e.laneId===lane.id||(!e.laneId&&e.x>=lane.x+176&&e.x<lane.x+lane.width&&e.y>=lane.y&&e.y<lane.y+lane.height));
  const cards=lanes.map((lane,index)=>{
    const steps=members(lane),keys=new Set(steps.map(e=>e.id)),destinations=new Map();
    for(const line of d.elements.filter(e=>e.type==="connector"&&keys.has(e.from)&&!keys.has(e.to))){
      const target=byId.get(line.to);if(!target)continue;
      const targetLane=lanes.find(l=>target.laneId===l.id||(!target.laneId&&members(l).some(e=>e.id===target.id)));
      const name=targetLane?.name||"Etapas fora dos grupos";
      destinations.set(name,(destinations.get(name)||0)+1);
    }
    return `<article class="phase-summary"><span class="phase-number">${String(index+1).padStart(2,"0")}</span><h3>${escapeHtml(lane.name)}</h3><p>${steps.length} etapas · ${steps.filter(e=>e.shape==="decision").length} ${steps.filter(e=>e.shape==="decision").length===1?"decisão":"decisões"}</p><div class="phase-links">${destinations.size?[...destinations].map(([name,count])=>`<span>Vai para <b>${escapeHtml(name)}</b> · ${count} ${count===1?"conexão":"conexões"}</span>`).join(""):"Sem conexões de saída para outros grupos"}</div><button class="button primary" data-read-phase="${lane.id}">Ler etapas</button></article>`;
  });
  const assigned=new Set(lanes.flatMap(l=>members(l).map(e=>e.id))),free=nodes.filter(e=>!assigned.has(e.id));
  return `<section class="phase-overview" aria-label="Visão geral por fases"><header><div class="eyebrow">VISÃO GERAL</div><h2>${escapeHtml(diagramTitle(d))}</h2><p>${nodes.length} etapas em ${lanes.length} grupos. Escolha um trecho para ler o fluxo.</p></header><div class="phase-summary-grid">${cards.join("")}</div>${free.length?`<p>${free.length} etapas fora dos grupos. <button class="button secondary" data-read-free>Ler essas etapas</button></p>`:""}</section>`;
}
function showOverview(value){
  overviewVisible=value;document.getElementById("canvasWrap")?.classList.toggle("overview-mode",value);
  for(const [name,active] of [["fullFlowCanvas",!value],["overviewCanvas",value]]){
    const button=document.getElementById(name);if(button){button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active));}
  }
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
  document.getElementById("settings")?.addEventListener("click", showSettings);
}

function showSettings() {
  const url = `${location.origin}/api/mcp`;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop" id="settingsBackdrop"><section class="modal action-modal"><div class="modal-head"><div><div class="eyebrow">CONFIGURAÇÕES</div><h2>Conexão com o Notion</h2><p>Adicione este servidor MCP ao Notion para criar e organizar diagramas por lá.</p></div><button class="icon-button" data-close-settings>×</button></div><label class="field-label">Endereço do servidor MCP<input class="text-input" id="mcpUrl" readonly value="${escapeHtml(url)}" /></label><div class="connection-help"><b>Autenticação</b><p>Escolha Bearer token no Notion e use o valor de <code>VLI_MCP_TOKEN</code> que você guardou na Vercel. O token não é exibido nesta tela.</p><b>O agente pode</b><p>Listar, criar, renomear, mover e excluir pastas e diagramas, além de criar e atualizar diagramas com Mermaid.</p></div><div class="modal-actions"><button class="button secondary" data-close-settings>Fechar</button><button class="button primary" id="copyMcpUrl">Copiar endereço</button></div></section></div>`;
  root.querySelectorAll("[data-close-settings]").forEach(button => button.addEventListener("click", closeModal));
  root.querySelector("#settingsBackdrop").addEventListener("click", event => { if (event.target.id === "settingsBackdrop") closeModal(); });
  root.querySelector("#copyMcpUrl").addEventListener("click", async () => { try { await navigator.clipboard.writeText(url); toast("Endereço MCP copiado"); closeModal(); } catch { const input = root.querySelector("#mcpUrl"); input.select(); document.execCommand("copy"); toast("Endereço MCP copiado"); closeModal(); } });
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
function setDiagramUrl(diagramId = null) {
  const url = new URL(location.href);
  if (diagramId) url.searchParams.set("diagram", diagramId);
  else url.searchParams.delete("diagram");
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}
function openDiagram(diagramId) { const d=state.diagrams.find(item=>item.id===diagramId);overviewVisible=shouldShowOverview(d);activeViewFolderId=d?.folderId||null;state.activeDiagramId = diagramId;setDiagramUrl(diagramId);persist();render();if(d)fitDiagramToView(d); }

function bindEditor(d) {
  document.getElementById("backToLibrary").addEventListener("click", () => { const folderId=activeViewFolderId||d.folderId;state.activeDiagramId = null;setDiagramUrl();persist();if(folderId)showFolder(folderId);else render(); });
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
  document.getElementById("exportDiagram").addEventListener("click", () => showExportModal(d));
  document.getElementById("addSequence").addEventListener("click", () => editSequence(d));
  document.querySelectorAll("[data-edit-sequence]").forEach(btn=>btn.addEventListener("click",()=>editSequence(d,btn.dataset.editSequence)));
  document.getElementById("publishDiagram").addEventListener("click", () => publish(d));
  document.getElementById("moveDiagram").addEventListener("click", () => moveDiagramById(d));
  document.getElementById("diagramMenu").addEventListener("click", () => diagramMenu(d.id));
  document.getElementById("zoomIn").addEventListener("click", () => zoom(1.12));
  document.getElementById("zoomOut").addEventListener("click", () => zoom(1 / 1.12));
  document.getElementById("fitCanvas").addEventListener("click", () => {showOverview(false);fitDiagramToView(d);});
  document.getElementById("fullFlowCanvas").addEventListener("click",()=>{showOverview(false);fitDiagramToView(d);});
  document.getElementById("overviewCanvas").addEventListener("click", () => showOverview(true));
  document.querySelectorAll("[data-read-phase]").forEach(button=>button.addEventListener("click",()=>{document.getElementById("focusLane").value=button.dataset.readPhase;selectedElement=null;readDiagram(d);}));
  document.querySelector("[data-read-free]")?.addEventListener("click",()=>{selectedElement=d.elements.find(e=>e.type==="shape"&&!e.laneId)?.id;document.getElementById("focusLane").value="";readDiagram(d);});
  document.getElementById("readCanvas").addEventListener("click", () => readDiagram(d));
  document.getElementById("organizeFlow").addEventListener("click", () => organizeDiagram(d));
  document.getElementById("undoLayout").addEventListener("click", () => undoOrganization(d));
  document.getElementById("focusLane").addEventListener("change", event => {
    showOverview(false);
    const lane = d.elements.find(e => e.id === event.target.value && e.type === "lane");
    if (lane) fitDiagramToView({ elements: [lane] }); else fitDiagramToView(d);
  });
  document.getElementById("diagramMinimap").addEventListener("click", event => moveFromMinimap(event, d));
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
      if (suppressClick || document.getElementById("canvasWrap")?.classList.contains("pan-mode")) return;
      if (connectMode) {
        if (!selectedElement) { selectedElement = el.dataset.element; el.classList.add("selected"); toast("Agora selecione o segundo item"); }
        else if (selectedElement !== el.dataset.element) { d.elements.push({ id:id(),type:"connector",from:selectedElement,to:el.dataset.element }); connectMode=false; selectedElement=null; document.getElementById("connectItems")?.classList.remove("active"); touchDiagram(d); drawConnections(d); toast("Conector adicionado"); }
      } else { selectedElement = el.dataset.element; document.querySelectorAll("[data-element]").forEach(x => x.classList.toggle("selected", x === el)); }
    });
  });
  const wrap = document.getElementById("canvasWrap");
  wrap.addEventListener("wheel", ev => {
    if(overviewVisible)return;
    if(ev.target.closest(".diagram-minimap"))return;
    ev.preventDefault();
    if(ev.ctrlKey||ev.metaKey){zoom(ev.deltaY < 0 ? 1.08 : 1 / 1.08, { x: ev.clientX, y: ev.clientY });return;}
    const unit=ev.deltaMode===1?18:ev.deltaMode===2?wrap.clientHeight:1;
    pan.x-=(ev.shiftKey?ev.deltaY:ev.deltaX)*unit;
    pan.y-=(ev.shiftKey?0:ev.deltaY)*unit;applyTransform();
  }, { passive: false });
  wrap.addEventListener("pointerdown", ev => {
    if (!wrap.classList.contains("pan-mode") || ev.target.closest("button")) return;
    ev.preventDefault();
    drag = { type: "pan", pointerId: ev.pointerId, x: ev.clientX, y: ev.clientY, panX: pan.x, panY: pan.y, moved: false };
    wrap.setPointerCapture(ev.pointerId);
  });
  wrap.addEventListener("pointermove", ev => {
    if (!drag || drag.type !== "pan" || drag.pointerId !== ev.pointerId) return;
    const dx=ev.clientX-drag.x,dy=ev.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>2){drag.moved=true;suppressClick=true;wrap.classList.add("panning");}
    pan.x=drag.panX+dx;pan.y=drag.panY+dy;applyTransform();
  });
  const stopPan = ev => {
    if (!drag || drag.type !== "pan" || (ev.pointerId!==undefined&&drag.pointerId!==ev.pointerId)) return;
    const moved=drag.moved,pointerId=drag.pointerId;drag=null;wrap.classList.remove("panning");
    if(wrap.hasPointerCapture(pointerId))wrap.releasePointerCapture(pointerId);
    if(moved)setTimeout(()=>suppressClick=false,0);
  };
  wrap.addEventListener("pointerup", stopPan);
  wrap.addEventListener("pointercancel", stopPan);
  wrap.addEventListener("lostpointercapture", stopPan);
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
  const children=d.elements.filter(e=>e.laneId===laneId);
  const minHeight=Math.max(150,...children.map(e=>e.y+(e.height||105)-lane.y+36));
  const onMove=moveEv=>{lane.height=Math.max(minHeight,start.height+(moveEv.clientY-start.y)/currentScale);node.style.height=`${lane.height}px`;updateMinimap(d);};
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
  root.innerHTML = `<div class="modal-backdrop" id="modalBackdrop"><section class="modal mermaid-modal"><div class="modal-head"><div><span class="mermaid-symbol">⌘</span><div><h2>${existing ? "Editar Mermaid" : importAsDiagram ? "Importar como diagrama" : "Adicionar Mermaid"}</h2><p>${importAsDiagram ? "Fluxogramas viram formas e conexões; sequências preservam participantes e mensagens editáveis." : "Cole ou escreva código Mermaid 11+."}</p></div></div><button class="icon-button" id="closeModal">×</button></div><label class="field-label">${importAsDiagram ? "Nome do diagrama" : "Título do bloco"}<input class="text-input" id="mermaidTitleInput" value="${escapeHtml(existing?.title || "Diagrama Mermaid")}" /></label><div class="code-preview"><div class="code-pane"><div class="pane-label">CÓDIGO</div><textarea id="mermaidCodeInput" spellcheck="false">${escapeHtml(existing?.code || defaultCode)}</textarea></div><div class="preview-pane"><div class="pane-label">PRÉVIA</div><div id="modalPreview"><span class="render-loading">Renderizando…</span></div></div></div><div class="modal-foot"><span id="validationMessage">${importAsDiagram ? "Etapas, participantes e mensagens poderão ser editados no quadro." : "A prévia atualiza enquanto você digita."}</span><div><button class="button secondary" id="cancelModal">Cancelar</button><button class="button primary" id="saveMermaid">${existing ? "Salvar alterações" : importAsDiagram ? "Criar diagrama editável" : "Adicionar ao quadro"}</button></div></div></section></div>`;
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
      saveButton.disabled = true; saveButton.textContent = "Convertendo…"; status.textContent = "Lendo a estrutura do diagrama…";
      try {
        const elements = await convertMermaidFlowchart(code);
        const title = document.getElementById("mermaidTitleInput").value.trim() || "Diagrama Mermaid";
        const d = { id:id(), title, folderId:null, themeId:DEFAULT_THEME_ID, elements, sourceMermaid:code, createdAt:Date.now(), updatedAt:Date.now() };
        state.diagrams.unshift(d); state.activeDiagramId=d.id; overviewVisible=shouldShowOverview(d); persist(); close(); render(); fitDiagramToView(d); toast("Diagrama convertido em itens editáveis");
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
  const onUp = () => { if (drag?.type === "element") { const item=d.elements.find(e=>e.id===drag.id); if(item?.type==="shape")updateLaneMembership(d,item); drag = null; touchDiagram(d); setTimeout(() => suppressClick = false, 10); } window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
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
function updateLaneMembership(d,item){
  const cx=item.x+item.width/2,cy=item.y+item.height/2;
  const lane=d.elements.filter(e=>e.type==="lane"&&cx>=e.x+176&&cx<=e.x+e.width&&cy>=e.y&&cy<=e.y+e.height).sort((a,b)=>a.width*a.height-b.width*b.height)[0];
  if(lane)item.laneId=lane.id;else delete item.laneId;
}
function zoom(factor, point) {
  const next = Math.min(2.4, Math.max(MIN_SCALE, currentScale * factor));
  if (!point) { const rect = document.getElementById("canvasWrap").getBoundingClientRect(); point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; }
  if (point) { const rect = document.getElementById("canvasWrap").getBoundingClientRect(); const px = point.x - rect.left, py = point.y - rect.top; pan.x = px - (px - pan.x) * next / currentScale; pan.y = py - (py - pan.y) * next / currentScale; }
  currentScale = next; applyTransform();
}
function applyTransform() { const content = document.getElementById("canvasContent"); if (content) content.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${currentScale})`; const label = document.getElementById("zoomLabel"); if (label) label.textContent = `${Math.round(currentScale * 100)}%`; const d = currentDiagram(); if (d) updateMinimap(d); }
function resetView() { currentScale = 1; pan = { x: 0, y: 0 }; applyTransform(); }

async function renderAllMermaid(d) {
  for (const element of d.elements.filter(e => e.type === "mermaid")) {
    const target = document.querySelector(`[data-render="${element.id}"]`); if (!target) continue;
    try { target.innerHTML = await renderSvg(element.code, "canvas-" + element.id); }
    catch (error) { target.innerHTML = `<pre class="render-error">${escapeHtml(error.message || "Não foi possível renderizar este Mermaid")}</pre>`; }
  }
}
function drawConnections(d) {
  const svg=document.getElementById("connections");if(!svg)return;
  const lines=d.elements.filter(e=>e.type==="connector");
  const key=geometryKey(d.elements);
  const bounds=diagramBounds(d.elements);
  if(bounds){svg.setAttribute("width",Math.max(5000,bounds.right+100));svg.setAttribute("height",Math.max(5000,bounds.bottom+100));}
  svg.innerHTML=`<defs><marker id="arrowhead" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L9,4 L0,8 Z" style="fill:var(--diagram-connector,#63748b)" /></marker></defs>`+lines.map(line=>{
    const route=routeConnection(line,d,key);if(!route)return "";
    const style=line.stroke==="dotted"?'stroke-dasharray="5 5"':line.stroke==="thick"?'stroke-width="3"':"";
    return `<path class="connector-path ${selectedElement===line.id?"selected":""}" data-connector="${line.id}" d="${route.dPath}" marker-end="url(#arrowhead)" ${style}/>${line.text?`<text class="connector-label" x="${route.label.x}" y="${route.label.y}" text-anchor="${route.label.anchor}">${escapeHtml(line.text)}</text>`:""}`;
  }).join("");
  svg.querySelectorAll("[data-connector]").forEach(path=>path.addEventListener("click",ev=>{ev.stopPropagation();selectedElement=path.dataset.connector;drawConnections(d);}));
  if(currentDiagram()?.id===d.id)updateMinimap(d);
}
async function getMermaid() {
  if (!mermaidPromise) mermaidPromise = import("https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.esm.min.mjs").then(module => { module.default.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default", flowchart: { curve: "linear", htmlLabels: true }, sequence: { wrap:true, useMaxWidth:false } }); return module.default; });
  return mermaidPromise;
}
function serializeMermaid(task){const result=mermaidQueue.then(task,task);mermaidQueue=result.then(()=>undefined,()=>undefined);return result;}
function normalizeMermaidSource(source) {
  if(/^\s*sequenceDiagram\b/m.test(String(source)))return String(source).replace(/\r\n?/g,"\n");
  return String(source || "").replace(/\r\n?/g, "\n").replace(/([\]\)}])[ \t]+(?=[A-Za-z0-9_][A-Za-z0-9_.-]*\s*(?:\[|\(|\{|>))/g, "$1\n");
}
async function renderSvg(source, renderId) {
  const mermaid = await getMermaid();
  const normalizedSource = normalizeMermaidSource(source);
  return serializeMermaid(async()=>{const result=await mermaid.render(renderId.replace(/[^a-zA-Z0-9_-]/g,""),normalizedSource);return result.svg;});
}

async function convertMermaidFlowchart(source,offset={x:0,y:0}) {
  const graph=await serializeMermaid(async()=>{
    try {
      const mermaid=await getMermaid(),parsed=await mermaid.mermaidAPI.getDiagramFromText(normalizeMermaidSource(source));
      return snapshotMermaid(parsed,plainMermaidLabel,source);
    } catch (error) {
      return fallbackFlowchartFromSource(source,plainMermaidLabel);
    }
  });
  return nativeElements(graph,offset);
}
function convertMermaidCard(d,elementId){
  const card=d.elements.find(e=>e.id===elementId&&e.type==="mermaid");if(!card)return;
  showConfirmDialog({title:"Converter para formas editáveis?",message:"O cartão será convertido em um diagrama nativo editável. O código original fica guardado no quadro.",confirmLabel:"Converter diagrama",onConfirm:async()=>{
    try{const elements=await convertMermaidFlowchart(card.code,{x:(card.x||0)-60,y:(card.y||0)-70});d.elements=d.elements.filter(e=>e.id!==card.id);d.elements.push(...elements);d.sourceMermaid=card.code;touchDiagram(d);render();fitDiagramToView(d);toast("Diagrama convertido em itens editáveis");}
    catch(error){toast(error.message||"Não foi possível converter este fluxograma");}
  }});
}
function plainMermaidLabel(value){
  const box=document.createElement("textarea");box.innerHTML=String(value).replaceAll("<br>"," ").replaceAll("<br/>"," ").replaceAll("<br />"," ").replace(/<[^>]*>/g,"");return box.value.trim();
}
function fitDiagramToView(d){
  requestAnimationFrame(()=>{
    const wrap=document.getElementById("canvasWrap"),bounds=diagramBounds(d.elements);
    if(!wrap||!bounds)return;
    currentScale=Math.max(MIN_SCALE,Math.min(1.15,(wrap.clientWidth-64)/bounds.width,(wrap.clientHeight-64)/bounds.height));
    pan.x=(wrap.clientWidth-bounds.width*currentScale)/2-bounds.left*currentScale;
    pan.y=(wrap.clientHeight-bounds.height*currentScale)/2-bounds.top*currentScale;
    applyTransform();
  });
}
function readDiagram(d){
  showOverview(false);
  const focus=document.getElementById("focusLane")?.value;
  const nodes=d.elements.filter(e=>e.type!=="connector"&&e.type!=="lane");
  const lane=d.elements.find(e=>e.id===focus&&e.type==="lane");
  const inLane=e=>e.laneId===focus||(lane&&e.x>=lane.x+176&&e.x<lane.x+lane.width&&e.y>=lane.y&&e.y<lane.y+lane.height);
  const item=nodes.find(e=>e.id===selectedElement)||nodes.filter(e=>!lane||inLane(e)).sort((a,b)=>a.y-b.y||a.x-b.x)[0];
  const wrap=document.getElementById("canvasWrap");if(!item||!wrap)return;
  const readingWidth=item.type==="sequence"?Math.min(item.width,760):(item.width||180),readingHeight=item.type==="sequence"?Math.min(item.height,460):(item.height||105);
  currentScale=Math.min(1,(wrap.clientWidth-64)/readingWidth,(wrap.clientHeight-64)/readingHeight);
  currentScale=Math.max(MIN_SCALE,currentScale);
  pan.x=wrap.clientWidth/2-(item.x+readingWidth/2)*currentScale;
  pan.y=wrap.clientHeight/2-(item.y+readingHeight/2)*currentScale;applyTransform();
}
function minimapProjection(d){
  const bounds=diagramBounds(d.elements);if(!bounds)return null;
  const scale=Math.min(160/bounds.width,96/bounds.height);
  return {bounds,scale,x:(176-bounds.width*scale)/2-bounds.left*scale,y:(112-bounds.height*scale)/2-bounds.top*scale};
}
function updateMinimap(d){
  const svg=document.getElementById("minimapSvg"),wrap=document.getElementById("canvasWrap"),map=minimapProjection(d);
  if(!svg||!wrap||!map)return;
  const {scale,x,y}=map;
  svg.innerHTML=d.elements.filter(e=>e.type!=="connector").map(e=>`<rect x="${x+e.x*scale}" y="${y+e.y*scale}" width="${Math.max(1,(e.width||180)*scale)}" height="${Math.max(1,(e.height||105)*scale)}" rx="1" class="${e.type==="lane"?"minimap-lane":"minimap-node"}"/>`).join("")+`<rect class="minimap-viewport" x="${x-pan.x/currentScale*scale}" y="${y-pan.y/currentScale*scale}" width="${wrap.clientWidth/currentScale*scale}" height="${wrap.clientHeight/currentScale*scale}"/>`;
}
function moveFromMinimap(event,d){
  if(event.detail===0){readDiagram(d);return;}
  const map=minimapProjection(d),wrap=document.getElementById("canvasWrap");if(!map||!wrap)return;
  const rect=document.getElementById("minimapSvg").getBoundingClientRect();
  const x=(event.clientX-rect.left)*176/rect.width,y=(event.clientY-rect.top)*112/rect.height;
  pan.x=wrap.clientWidth/2-(x-map.x)/map.scale*currentScale;
  pan.y=wrap.clientHeight/2-(y-map.y)/map.scale*currentScale;applyTransform();
}
async function organizeDiagram(d){
  if(layoutBusy)return;
  if(!d.elements.some(e=>e.type==="shape")){for(const e of d.elements.filter(e=>e.type==="sequence")){const size=sequenceGeometry(e.model);e.width=size.width;e.height=size.height+40;}touchDiagram(d);render();fitDiagramToView(d);toast("Sequência organizada pela ordem das mensagens");return;}
  layoutBusy=true;const button=document.getElementById("organizeFlow");button.disabled=true;button.textContent="Organizando…";
  const before=JSON.stringify(d.elements),direction=document.getElementById("flowDirection").value;
  try{
    const elements=await layoutElements(d.elements,direction);
    if(!state.diagrams.includes(d)||JSON.stringify(d.elements)!==before){toast("O quadro mudou durante a organização. Tente novamente.");return;}
    layoutUndo={diagramId:d.id,direction:d.layoutDirection,elements:JSON.parse(before)};
    d.elements=elements;d.layoutDirection=direction;touchDiagram(d);render();fitDiagramToView(d);toast("Fluxo organizado. Use 1:1 para ler as etapas.");
  }catch(error){console.error(error);toast("Não foi possível organizar o fluxo. Confira sua conexão e tente novamente.");}
  finally{layoutBusy=false;if(button.isConnected){button.disabled=false;button.textContent="Organizar fluxo";}}
}
function undoOrganization(d){
  if(layoutUndo?.diagramId!==d.id)return;
  const originals=new Map(layoutUndo.elements.map(e=>[e.id,e]));
  for(const item of d.elements){
    const original=originals.get(item.id);if(!original)continue;
    for(const key of ["x","y","width","height","laneId","route"]){if(key in original)item[key]=structuredClone(original[key]);else delete item[key];}
  }
  d.layoutDirection=layoutUndo.direction;layoutUndo=null;touchDiagram(d);render();fitDiagramToView(d);toast("Organização desfeita");
}

function touchDiagram(d) {
  d.updatedAt = Date.now(); persist();
  const status = document.getElementById("saveStatus"); if (status) status.innerHTML = "<i></i> Salvando…";
  const count = document.querySelector(".bottom-bar span:nth-child(2)"); if (count) count.textContent = itemSummary(d);
}
function editSequence(d,elementId){
  const existing=d.elements.find(e=>e.id===elementId&&e.type==='sequence');
  let draft=structuredClone(existing?.model||{participants:[{id:'cliente',name:'Cliente',kind:'actor'},{id:'app',name:'Aplicativo',kind:'participant'}],events:[{id:id(),kind:'SOLID',from:'cliente',to:'app',text:'Solicitar serviço'}]});
  let title=existing?.title||'Diagrama de sequência';
  const root=document.getElementById('modalRoot'),messageKinds=['SOLID','DOTTED','SOLID_OPEN','DOTTED_OPEN','SOLID_CROSS','DOTTED_CROSS','SOLID_POINT','DOTTED_POINT','BIDIRECTIONAL_SOLID','BIDIRECTIONAL_DOTTED'];
  const labels={SOLID:'Chamada',DOTTED:'Resposta',SOLID_OPEN:'Seta aberta',DOTTED_OPEN:'Resposta aberta',SOLID_CROSS:'Interrupção',DOTTED_CROSS:'Interrupção pontilhada',SOLID_POINT:'Ponto',DOTTED_POINT:'Ponto pontilhado',BIDIRECTIONAL_SOLID:'Bidirecional',BIDIRECTIONAL_DOTTED:'Bidirecional pontilhada',NOTE:'Nota'};
  const renderDialog=()=>{
    const options=value=>draft.participants.map(p=>`<option value="${escapeHtml(p.id)}" ${value===p.id?'selected':''}>${escapeHtml(p.name||p.id)}</option>`).join('');
    root.innerHTML=`<div class="modal-backdrop" id="sequenceBackdrop"><section class="modal sequence-modal" role="dialog" aria-modal="true" aria-labelledby="sequenceModalTitle"><div class="modal-head"><div><h2 id="sequenceModalTitle">Editar sequência</h2><p>Participantes em colunas. Mensagens na ordem em que acontecem.</p></div><button class="icon-button" data-close-sequence aria-label="Fechar">×</button></div><div class="sequence-editor-body"><label class="field-label">Título<input class="text-input" id="sequenceTitle" value="${escapeHtml(title)}"/></label><h3>Participantes</h3><div class="sequence-participants">${draft.participants.map((p,i)=>`<label>${escapeHtml(p.id)}<input class="text-input" data-participant="${i}" value="${escapeHtml(p.name)}" aria-label="Nome de ${escapeHtml(p.id)}"/></label>`).join('')}</div><button class="button secondary" id="sequenceAddParticipant">Adicionar participante</button><h3>Mensagens e blocos</h3><div class="sequence-events">${draft.events.map((e,i)=>`<div class="sequence-event"><span class="sequence-index">${i+1}</span>${messageKinds.includes(e.kind)?`<select data-event-kind="${i}" aria-label="Tipo da mensagem ${i+1}">${messageKinds.map(k=>`<option value="${k}" ${e.kind===k?'selected':''}>${labels[k]}</option>`).join('')}</select>`:`<strong>${escapeHtml(labels[e.kind]||e.kind.replaceAll('_',' ').toLowerCase())}</strong>`}${messageKinds.includes(e.kind)||e.kind==='NOTE'?`<select data-event-from="${i}" aria-label="Origem ${i+1}">${options(e.from)}</select><span>→</span><select data-event-to="${i}" aria-label="Destino ${i+1}">${options(e.to)}</select>`:''}${e.kind.endsWith('_END')||e.kind==='AUTONUMBER'||e.kind==='ACTIVE_START'?'':`<input class="text-input" data-event-text="${i}" value="${escapeHtml(e.text)}" aria-label="Texto do evento ${i+1}"/>`}<div class="sequence-row-actions"><button class="icon-button" data-sequence-insert="${i}" title="Inserir mensagem antes">＋</button>${messageKinds.includes(e.kind)||e.kind==='NOTE'?`<button class="icon-button" data-sequence-up="${i}" title="Mover para cima" ${i?'':'disabled'}>↑</button><button class="icon-button" data-sequence-remove="${i}" title="Excluir mensagem">×</button>`:''}</div></div>`).join('')}</div><div class="sequence-add-actions"><button class="button secondary" id="sequenceAddMessage">Adicionar mensagem</button><button class="button secondary" id="sequenceAddNote">Adicionar nota</button><button class="button secondary" id="sequenceAddAlt">Adicionar alt/else</button><button class="button secondary" id="sequenceAddLoop">Adicionar loop</button></div><details><summary>Prévia</summary><div id="sequencePreview" class="sequence-preview"></div></details><p id="sequenceValidation" role="status"></p></div><div class="modal-foot"><span>O código importado é preservado como referência.</span><div><button class="button secondary" data-close-sequence>Cancelar</button><button class="button primary" id="saveSequence">Salvar sequência</button></div></div></section></div>`;
    const preview=()=>{try{validateSequence(draft);root.querySelector('#sequencePreview').innerHTML=sequenceSvg(draft,getTheme(d.themeId),'preview-seq');root.querySelector('#sequenceValidation').textContent='Sequência válida';root.querySelector('#saveSequence').disabled=false;}catch(error){root.querySelector('#sequenceValidation').textContent=error.message;root.querySelector('#saveSequence').disabled=true;}};
    root.querySelectorAll('[data-close-sequence]').forEach(b=>b.onclick=closeModal);root.querySelector('#sequenceBackdrop').onclick=e=>{if(e.target.id==='sequenceBackdrop')closeModal();};
    root.querySelector('#sequenceTitle').oninput=e=>title=e.target.value;
    root.querySelectorAll('[data-participant]').forEach(input=>input.oninput=()=>{draft.participants[Number(input.dataset.participant)].name=input.value;preview();});
    for(const [attr,prop] of [['text','text'],['from','from'],['to','to'],['kind','kind']])root.querySelectorAll(`[data-event-${attr}]`).forEach(input=>input.addEventListener(input.tagName==='SELECT'?'change':'input',()=>{draft.events[Number(input.getAttribute('data-event-'+attr))][prop]=input.value;preview();}));
    const newMessage=()=>({id:id(),kind:'SOLID',from:draft.participants[0].id,to:draft.participants[Math.min(1,draft.participants.length-1)].id,text:'Nova mensagem'});
    const redraw=action=>{action();renderDialog();};
    root.querySelector('#sequenceAddParticipant').onclick=()=>redraw(()=>draft.participants.push({id:'p-'+id().slice(0,8),name:'Novo participante',kind:'participant'}));
    root.querySelector('#sequenceAddMessage').onclick=()=>redraw(()=>draft.events.push(newMessage()));
    root.querySelector('#sequenceAddNote').onclick=()=>redraw(()=>draft.events.push({...newMessage(),kind:'NOTE',text:'Nova nota',placement:2}));
    root.querySelector('#sequenceAddAlt').onclick=()=>redraw(()=>draft.events.push({id:id(),kind:'ALT_START',text:'Condição'},newMessage(),{id:id(),kind:'ALT_ELSE',text:'Outra condição'},newMessage(),{id:id(),kind:'ALT_END',text:''}));
    root.querySelector('#sequenceAddLoop').onclick=()=>redraw(()=>draft.events.push({id:id(),kind:'LOOP_START',text:'Enquanto necessário'},newMessage(),{id:id(),kind:'LOOP_END',text:''}));
    root.querySelectorAll('[data-sequence-insert]').forEach(b=>b.onclick=()=>redraw(()=>draft.events.splice(Number(b.dataset.sequenceInsert),0,newMessage())));
    root.querySelectorAll('[data-sequence-remove]').forEach(b=>b.onclick=()=>redraw(()=>draft.events.splice(Number(b.dataset.sequenceRemove),1)));
    root.querySelectorAll('[data-sequence-up]').forEach(b=>b.onclick=()=>redraw(()=>{const i=Number(b.dataset.sequenceUp);[draft.events[i-1],draft.events[i]]=[draft.events[i],draft.events[i-1]];}));
    root.querySelector('#saveSequence').onclick=()=>{try{const model=validateSequence(draft),size=sequenceGeometry(model);const item=existing||{id:id(),type:'sequence',x:80,y:80};Object.assign(item,{title:title.trim()||'Sequência',model,width:size.width,height:size.height+40});if(!existing)d.elements.push(item);touchDiagram(d);closeModal();render();fitDiagramToView(d);toast('Sequência salva');}catch(error){root.querySelector('#sequenceValidation').textContent=error.message;}};
    preview();
  };
  renderDialog();
}

async function exportSnapshot(d,scope,transparent){
  const snapshot=structuredClone(d),mermaid={};
  if(scope!=='overview')for(const e of exportElements(snapshot.elements,scope).filter(e=>e.type==='mermaid')){
    const native=await serializeMermaid(async()=>{
      const m=await getMermaid();
      try{m.initialize({startOnLoad:false,securityLevel:'strict',theme:'default',htmlLabels:false,flowchart:{htmlLabels:false,curve:'linear'},sequence:{wrap:true,useMaxWidth:false}});return (await m.render('export-'+id(),normalizeMermaidSource(e.code))).svg;}
      finally{m.initialize({startOnLoad:false,securityLevel:'strict',theme:'default',flowchart:{htmlLabels:true,curve:'linear'},sequence:{wrap:true,useMaxWidth:false}});}
    });
    mermaid[e.id]=portableMermaid(native,'file-'+e.id);
    const original=snapshot.elements.find(n=>n.id===e.id),size=document.querySelector(`[data-element="${e.id}"]`);if(size){original.height=size.offsetHeight;original.width=size.offsetWidth;}
  }
  const key=geometryKey(snapshot.elements),connections=snapshot.elements.filter(e=>e.type==='connector').flatMap(e=>{const route=routeConnection(e,snapshot,key);return route?[{...e,...route}]:[];});
  return buildDiagramSvg(snapshot,{scope,transparent,theme:getTheme(d.themeId),connections,mermaid});
}
function showExportModal(d){
  const root=document.getElementById('modalRoot'),lanes=d.elements.filter(e=>e.type==='lane');let previewUrl,revision=0,result;
  root.innerHTML=`<div class="modal-backdrop" id="exportBackdrop"><section class="modal export-modal" role="dialog" aria-modal="true" aria-labelledby="exportTitle"><div class="modal-head"><div><h2 id="exportTitle">Exportar diagrama</h2><p>Salve um arquivo com textos, formas e conexões.</p></div><button class="icon-button" data-close-export aria-label="Fechar">×</button></div><div class="export-body"><div class="export-fields"><label class="field-label">Formato<select class="text-input" id="exportFormat"><option value="png">PNG</option><option value="svg">SVG</option></select></label><label class="field-label">Conteúdo<select class="text-input" id="exportScope"><option value="full">Diagrama completo</option>${lanes.length?'<option value="overview">Visão geral por fases</option>':''}${lanes.map(l=>`<option value="${escapeHtml(l.id)}">Fase: ${escapeHtml(l.name)}</option>`).join('')}</select></label><label class="field-label">Fundo<select class="text-input" id="exportBackground"><option value="white">Branco</option><option value="transparent">Transparente</option></select></label><label class="field-label" id="exportQualityField">Resolução<select class="text-input" id="exportQuality"><option value="2">2×</option><option value="1">1×</option></select></label></div><div class="export-preview"><img id="exportPreview" alt="Prévia do arquivo exportado"/></div><p id="exportStatus" role="status">Preparando prévia…</p><p class="export-help">SVG mantém a nitidez em qualquer tamanho. Exportar uma fase inclui suas etapas e conexões internas.</p></div><div class="modal-foot"><span></span><div><button class="button secondary" data-close-export>Cancelar</button><button class="button primary" id="downloadExport" disabled>Baixar arquivo</button></div></div></section></div>`;
  const dialog=root.querySelector('.export-modal'),button=root.querySelector('#downloadExport'),status=root.querySelector('#exportStatus');
  const close=()=>{revision++;if(previewUrl)URL.revokeObjectURL(previewUrl);document.removeEventListener('keydown',keyHandler);closeModal();};
  const keyHandler=e=>{if(e.key==='Escape')close();if(e.key==='Tab'){const fields=[...dialog.querySelectorAll('button:not(:disabled),select')].filter(n=>n.offsetParent!==null),first=fields[0],last=fields.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
  document.addEventListener('keydown',keyHandler);root.querySelectorAll('[data-close-export]').forEach(b=>b.onclick=close);root.querySelector('#exportBackdrop').onclick=e=>{if(e.target.id==='exportBackdrop')close();};
  const scope=root.querySelector('#exportScope'),format=root.querySelector('#exportFormat'),quality=root.querySelector('#exportQuality'),background=root.querySelector('#exportBackground');
  if(overviewVisible&&lanes.length)scope.value='overview';else if(document.getElementById('focusLane')?.value)scope.value=document.getElementById('focusLane').value;
  const dimensions=()=>{root.querySelector('#exportQualityField').hidden=format.value==='svg';if(!result)return;const size=pngDimensions(result.width,result.height,Number(quality.value));status.textContent=format.value==='svg'?`${result.width} × ${result.height} · SVG vetorial`:`${size.width} × ${size.height} px${size.reduced?' · Resolução ajustada para este diagrama grande. SVG preserva todos os detalhes.':''}`;};
  const prepare=async()=>{const ticket=++revision;button.disabled=true;result=null;status.textContent='Preparando prévia…';try{const next=await exportSnapshot(d,scope.value,background.value==='transparent');if(ticket!==revision||!dialog.isConnected)return;result=next;if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(new Blob([result.svg],{type:'image/svg+xml'}));root.querySelector('#exportPreview').src=previewUrl;button.disabled=false;dimensions();}catch(error){if(ticket===revision&&dialog.isConnected)status.textContent=error.message||'Não foi possível preparar este arquivo.';}};
  scope.onchange=prepare;background.onchange=prepare;format.onchange=dimensions;quality.onchange=dimensions;
  button.onclick=async()=>{if(!result)return;button.disabled=true;status.textContent='Gerando arquivo…';try{await downloadDiagram(result,{format:format.value,quality:Number(quality.value),filename:exportFilename(diagramTitle(d),scope.value==='overview'?'fases':scope.value==='full'?'':exportFilename(lanes.find(l=>l.id===scope.value)?.name||'fase'))});if(dialog.isConnected){toast('Arquivo exportado');close();}}catch(error){if(dialog.isConnected){status.textContent=error.message;button.disabled=false;}}};
  prepare();format.focus();
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
    app.innerHTML = `<div class="shared-view"><header class="shared-top"><a href="${location.pathname}" class="brand mini-brand"><div class="brand-mark">V</div><strong>VLI Diagrams</strong></a><span>Visualização publicada</span></header><main><div class="shared-title"><div class="eyebrow">QUADRO PUBLICADO</div><h1>${escapeHtml(data.title)}</h1></div><div class="shared-canvas-wrap" style="${themeStyle(data.themeId)}"><div class="shared-canvas" id="sharedCanvas">${data.elements.filter(e=>e.type==="lane").map(e=>renderElement(e,data.themeId)).join("")}<svg class="connections" id="connections" width="5000" height="5000"></svg>${data.elements.filter(e=>e.type!=="connector"&&e.type!=="lane").map(e=>renderElement(e,data.themeId)).join("")}</div></div></main></div>`;
    data.elements.filter(e => e.type === "sticky").forEach(e => { const n = document.querySelector(`[data-text="${e.id}"]`); if (n) { n.disabled = true; n.readOnly = true; } });
    drawConnections({ elements: data.elements }); renderAllMermaid({ elements: data.elements });
  } catch { app.innerHTML = `<div class="share-error"><h1>Este link não parece válido</h1><a href="${location.pathname}">Abrir VLI Diagrams</a></div>`; }
}
function base64UrlEncode(value) { const bytes = new TextEncoder().encode(value); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
function base64UrlDecode(value) { const normal = value.replaceAll("-", "+").replaceAll("_", "/"); const binary = atob(normal + "=".repeat((4 - normal.length % 4) % 4)); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function toast(message) { const el = document.getElementById("toast"); if (!el) return; el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400); }
function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }

if (shareMode) render(); else bootWorkspace();


