const STORAGE_KEY = "vli-diagrams-v1";
const colors = ["#ffe58f", "#ffbdbd", "#c7f2c2", "#c8e4ff", "#e7d1ff", "#ffd8a8"];
const initialState = { folders: [], diagrams: [], activeDiagramId: null };
let state = readState();
let mermaidPromise;
let selectedElement = null;
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

function render() {
  if (shareMode) return renderShared();
  const diagram = currentDiagram();
  app.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand"><div class="brand-mark">V</div><div><strong>VLI Diagrams</strong><small>Quadros e diagramas</small></div></div>
        <button class="new-diagram" id="newDiagram"><span>＋</span> Novo diagrama</button>
        <div class="nav-section"><div class="nav-label">ESPAÇO DE TRABALHO <button class="icon-button tiny" id="newFolder" title="Criar pasta">＋</button></div>
          <button class="nav-item ${!diagram ? "active" : ""}" id="allDiagrams"><span>▦</span> Todos os diagramas <span class="count">${state.diagrams.length}</span></button>
          <div id="folderList">${state.folders.map(f => `<div class="folder-row"><button class="nav-item folder-item ${activeFolderId() === f.id ? "active" : ""}" data-folder="${f.id}"><span>▰</span><span class="folder-name">${escapeHtml(f.name)}</span><span class="folder-count">${state.diagrams.filter(d => d.folderId === f.id).length}</span></button><button class="row-more" data-folder-menu="${f.id}" title="Opções da pasta">···</button></div>`).join("")}</div>
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
    ${state.diagrams.length ? `<div class="diagram-grid" id="diagramGrid">${state.diagrams.map(d => `<article class="diagram-card" data-card="${d.id}"><button class="card-open" data-open="${d.id}"><div class="card-preview"><div class="preview-grid"></div>${miniPreview(d)}</div><div class="card-meta"><div class="card-title"><h3>${escapeHtml(diagramTitle(d))}</h3><button class="row-more card-menu" data-diagram-menu="${d.id}" title="Opções">···</button></div><div class="card-sub"><span>▰ ${escapeHtml(state.folders.find(f => f.id === d.folderId)?.name || "Sem pasta")}</span><span>· ${formatDate(d.updatedAt || d.createdAt)}</span></div></div></button></article>`).join("")}</div>` : `<div class="empty-state"><div class="empty-illustration"><span>▱</span><span>✦</span></div><h2>Seu primeiro quadro começa aqui</h2><p>Crie um diagrama e organize o espaço com Mermaid e notas adesivas.</p><button class="button primary" id="emptyNewDiagram">＋ Criar diagrama</button></div>`}
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
        <button class="tool wide" id="addMermaid" title="Adicionar bloco Mermaid"><span class="tool-mermaid">⌘</span><span>Mermaid</span></button>
        <div class="toolbar-spacer"></div><div class="zoom-controls"><button class="icon-button" id="zoomOut">−</button><span id="zoomLabel">100%</span><button class="icon-button" id="zoomIn">＋</button><button class="icon-button" id="fitCanvas" title="Ajustar à tela">⛶</button></div>
      </div>
      <div class="canvas-wrap" id="canvasWrap"><div class="canvas" id="canvas"><div class="canvas-content" id="canvasContent">${d.elements.map(renderElement).join("")}</div></div><div class="canvas-hint" id="canvasHint">Arraste as notas e blocos para organizar suas ideias</div></div>
      <div class="bottom-bar"><span><i class="live-dot"></i> Salvamento automático</span><span>${d.elements.length} itens no quadro</span></div>
    </div>`;
}

function renderElement(e) {
  if (e.type === "sticky") return `<article class="sticky" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;background:${e.color};width:${e.width || 220}px;height:${e.height || 190}px"><div class="sticky-head"><span class="drag-grip">⠿</span><div class="sticky-controls"><button class="sticky-control" data-color="${e.id}" title="Mudar cor">●</button><button class="sticky-control" data-delete="${e.id}" title="Excluir">×</button></div></div><textarea class="sticky-text" data-text="${e.id}" placeholder="Escreva uma ideia...">${escapeHtml(e.text)}</textarea><div class="resize-handle" data-resize="${e.id}"></div></article>`;
  return `<article class="mermaid-card" data-element="${e.id}" style="left:${e.x}px;top:${e.y}px;width:${e.width || 390}px;min-height:${e.height || 250}px"><div class="mermaid-head"><div><span class="mermaid-symbol">⌘</span><strong>${escapeHtml(e.title || "Diagrama Mermaid")}</strong></div><div><button class="mermaid-action" data-edit-mermaid="${e.id}" title="Editar código">✎</button><button class="mermaid-action" data-delete="${e.id}" title="Excluir">×</button></div></div><div class="mermaid-render" data-render="${e.id}"><div class="render-loading">Renderizando diagrama…</div></div><div class="mermaid-foot"><span>MERMAID 11+</span><button data-edit-mermaid="${e.id}">Editar código</button></div><div class="resize-handle" data-resize="${e.id}"></div></article>`;
}

function bindShell() {
  ["newDiagram", "newDiagramTop", "emptyNewDiagram"].forEach(idName => document.getElementById(idName)?.addEventListener("click", () => createDiagram()));
  document.getElementById("newFolder")?.addEventListener("click", createFolder);
  document.getElementById("allDiagrams")?.addEventListener("click", () => { state.activeDiagramId = null; render(); });
  document.querySelectorAll("[data-folder]").forEach(el => el.addEventListener("click", () => showFolder(el.dataset.folder)));
  document.querySelectorAll("[data-folder-menu]").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); folderMenu(el.dataset.folderMenu); }));
  document.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openDiagram(el.dataset.open)));
  document.querySelectorAll("[data-diagram-menu]").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); diagramMenu(el.dataset.diagramMenu); }));
  document.getElementById("searchDiagrams")?.addEventListener("input", ev => {
    document.querySelectorAll("[data-card]").forEach(card => card.hidden = !card.textContent.toLowerCase().includes(ev.target.value.toLowerCase()));
  });
  document.getElementById("importButton")?.addEventListener("click", () => showMermaidModal());
  document.getElementById("settings")?.addEventListener("click", () => toast("Configurações e Notion chegam em uma etapa futura."));
}

function createDiagram(folderId = null) {
  const d = { id: id(), title: "Novo diagrama", folderId, elements: [], createdAt: Date.now(), updatedAt: Date.now() };
  state.diagrams.unshift(d); state.activeDiagramId = d.id; persist(); render();
  const input = document.getElementById("diagramTitle"); input?.focus(); input?.select();
}
function createFolder() {
  const name = prompt("Nome da pasta:");
  if (!name?.trim()) return;
  const folder = { id: id(), name: name.trim() }; state.folders.push(folder); persist(); render();
  toast("Pasta criada");
}
function showFolder(folderId) {
  state.activeDiagramId = null; render();
  const folder = state.folders.find(f => f.id === folderId);
  const main = document.querySelector(".main");
  const items = state.diagrams.filter(d => d.folderId === folderId);
  main.innerHTML = `<header class="topbar"><div><div class="eyebrow">PASTA</div><h1>${escapeHtml(folder?.name || "Pasta")}</h1></div><div class="top-actions"><button class="button primary" id="newInFolder">＋ Novo diagrama</button></div></header><section class="library-wrap"><div class="library-heading"><div><h2>Diagramas nesta pasta</h2><p>${items.length} diagramas</p></div></div>${items.length ? `<div class="diagram-grid">${items.map(d => `<article class="diagram-card"><button class="card-open" data-open="${d.id}"><div class="card-preview"><div class="preview-grid"></div>${miniPreview(d)}</div><div class="card-meta"><div class="card-title"><h3>${escapeHtml(diagramTitle(d))}</h3><button class="row-more card-menu" data-diagram-menu="${d.id}">···</button></div><div class="card-sub"><span>${formatDate(d.updatedAt || d.createdAt)}</span></div></div></button></article>`).join("")}</div>` : `<div class="empty-state compact"><div class="empty-illustration"><span>▰</span></div><h2>Esta pasta está vazia</h2><p>Crie um diagrama dentro dela.</p><button class="button primary" id="newInFolder2">＋ Novo diagrama</button></div>`}</section>`;
  document.getElementById("newInFolder")?.addEventListener("click", () => createDiagram(folderId));
  document.getElementById("newInFolder2")?.addEventListener("click", () => createDiagram(folderId));
  document.querySelectorAll("[data-open]").forEach(el => el.addEventListener("click", () => openDiagram(el.dataset.open)));
  document.querySelectorAll("[data-diagram-menu]").forEach(el => el.addEventListener("click", ev => { ev.stopPropagation(); diagramMenu(el.dataset.diagramMenu); }));
}

function folderMenu(folderId) {
  const folder = state.folders.find(f => f.id === folderId); if (!folder) return;
  const action = prompt(`Pasta: ${folder.name}\nDigite: renomear ou excluir`);
  if (action?.toLowerCase() === "renomear") {
    const next = prompt("Novo nome:", folder.name); if (next?.trim()) folder.name = next.trim();
  } else if (action?.toLowerCase() === "excluir") {
    if (!confirm(`Excluir a pasta “${folder.name}”? Os diagramas irão para Sem pasta.`)) return;
    state.diagrams.forEach(d => { if (d.folderId === folderId) d.folderId = null; }); state.folders = state.folders.filter(f => f.id !== folderId);
  } else return;
  persist(); render(); toast("Pasta atualizada");
}
function diagramMenu(diagramId) {
  const d = state.diagrams.find(x => x.id === diagramId); if (!d) return;
  const action = prompt(`Diagrama: ${diagramTitle(d)}\nDigite: renomear, mover ou excluir`);
  if (action?.toLowerCase() === "renomear") {
    const next = prompt("Novo nome:", d.title); if (next?.trim()) d.title = next.trim();
  } else if (action?.toLowerCase() === "mover") moveDiagramById(d);
  else if (action?.toLowerCase() === "excluir") {
    if (!confirm(`Excluir “${diagramTitle(d)}”?`)) return;
    state.diagrams = state.diagrams.filter(x => x.id !== d.id); if (state.activeDiagramId === d.id) state.activeDiagramId = null;
  } else return;
  persist(); render(); toast("Diagrama atualizado");
}
function moveDiagramById(d) {
  const options = ["Sem pasta", ...state.folders.map(f => f.name)];
  const selected = prompt(`Mover “${diagramTitle(d)}” para:\n${options.map((x, i) => `${i + 1}. ${x}`).join("\n")}`, "1");
  const index = Number(selected) - 1;
  if (Number.isInteger(index) && index >= 0 && index < options.length) d.folderId = index === 0 ? null : state.folders[index - 1].id;
}
function openDiagram(diagramId) { state.activeDiagramId = diagramId; persist(); render(); }

function bindEditor(d) {
  document.getElementById("backToLibrary").addEventListener("click", () => { state.activeDiagramId = null; persist(); render(); });
  const title = document.getElementById("diagramTitle");
  title.addEventListener("input", () => { d.title = title.value; touchDiagram(d); });
  title.addEventListener("blur", () => { if (!title.value.trim()) title.value = d.title = "Diagrama sem título"; persist(); });
  document.getElementById("addSticky").addEventListener("click", () => addSticky(d));
  document.getElementById("addMermaid").addEventListener("click", () => showMermaidModal());
  document.getElementById("publishDiagram").addEventListener("click", () => publish(d));
  document.getElementById("moveDiagram").addEventListener("click", () => { moveDiagramById(d); persist(); render(); });
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
  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", ev => { ev.stopPropagation(); deleteElement(d, btn.dataset.delete); }));
  document.querySelectorAll("[data-color]").forEach(btn => btn.addEventListener("click", ev => { ev.stopPropagation(); cycleColor(d, btn.dataset.color); }));
  document.querySelectorAll("[data-edit-mermaid]").forEach(btn => btn.addEventListener("click", () => editMermaid(d, btn.dataset.editMermaid)));
  document.querySelectorAll("[data-resize]").forEach(handle => handle.addEventListener("pointerdown", ev => startResize(ev, d, handle.dataset.resize)));
  document.querySelectorAll("[data-element]").forEach(el => {
    el.addEventListener("pointerdown", ev => startDrag(ev, d, el));
    el.addEventListener("click", () => { if (!suppressClick) { selectedElement = el.dataset.element; document.querySelectorAll("[data-element]").forEach(x => x.classList.toggle("selected", x === el)); } });
  });
  const wrap = document.getElementById("canvasWrap");
  wrap.addEventListener("wheel", ev => { ev.preventDefault(); zoom(ev.deltaY < 0 ? 1.08 : 1 / 1.08, { x: ev.clientX, y: ev.clientY }); }, { passive: false });
  wrap.addEventListener("pointerdown", ev => { if (ev.target.closest("[data-element]") || !wrap.classList.contains("pan-mode")) return; drag = { type: "pan", x: ev.clientX, y: ev.clientY, panX: pan.x, panY: pan.y }; wrap.setPointerCapture(ev.pointerId); });
  wrap.addEventListener("pointermove", ev => {
    if (!drag || drag.type !== "pan") return; pan.x = drag.panX + ev.clientX - drag.x; pan.y = drag.panY + ev.clientY - drag.y; applyTransform();
  });
  wrap.addEventListener("pointerup", () => { if (drag?.type === "pan") drag = null; });
  renderAllMermaid(d);
}

function addSticky(d, x = 100 + Math.random() * 140, y = 100 + Math.random() * 110, text = "") {
  const note = { id: id(), type: "sticky", text, color: colors[d.elements.filter(e => e.type === "sticky").length % colors.length], x, y, width: 220, height: 190 };
  d.elements.push(note); touchDiagram(d); render();
  const textarea = document.querySelector(`[data-text="${note.id}"]`); textarea?.focus();
}
function showMermaidModal(existing = null) {
  const defaultCode = `flowchart TD\n    A[Ideia] --> B[Etapa]\n    B --> C[Resultado]`;
  const root = document.getElementById("modalRoot");
  root.innerHTML = `<div class="modal-backdrop" id="modalBackdrop"><section class="modal mermaid-modal"><div class="modal-head"><div><span class="mermaid-symbol">⌘</span><div><h2>${existing ? "Editar Mermaid" : "Adicionar Mermaid"}</h2><p>Cole ou escreva código Mermaid 11+.</p></div></div><button class="icon-button" id="closeModal">×</button></div><label class="field-label">Título do bloco<input class="text-input" id="mermaidTitleInput" value="${escapeHtml(existing?.title || "Diagrama Mermaid")}" /></label><div class="code-preview"><div class="code-pane"><div class="pane-label">CÓDIGO</div><textarea id="mermaidCodeInput" spellcheck="false">${escapeHtml(existing?.code || defaultCode)}</textarea></div><div class="preview-pane"><div class="pane-label">PRÉVIA</div><div id="modalPreview"><span class="render-loading">Renderizando…</span></div></div></div><div class="modal-foot"><span id="validationMessage">A prévia atualiza enquanto você digita.</span><div><button class="button secondary" id="cancelModal">Cancelar</button><button class="button primary" id="saveMermaid">${existing ? "Salvar alterações" : "Adicionar ao quadro"}</button></div></div></section></div>`;
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
  document.getElementById("saveMermaid").onclick = () => {
    const d = currentDiagram(); if (!d) return;
    const code = codeInput.value.trim(); if (!code) { toast("Escreva o código Mermaid antes de salvar"); return; }
    const blockTitle = document.getElementById("mermaidTitleInput").value.trim() || "Diagrama Mermaid";
    if (existing) { const item = d.elements.find(e => e.id === existing.id); if (item) { item.code = code; item.title = blockTitle; } }
    else d.elements.push({ id: id(), type: "mermaid", title: blockTitle, code, x: 390 + Math.random() * 80, y: 110 + Math.random() * 80, width: 390, height: 250 });
    touchDiagram(d); close(); render();
  };
}
function editMermaid(d, elementId) { const el = d.elements.find(e => e.id === elementId); if (el) showMermaidModal(el); }
function deleteElement(d, elementId) { d.elements = d.elements.filter(e => e.id !== elementId); touchDiagram(d); render(); }
function cycleColor(d, elementId) { const el = d.elements.find(e => e.id === elementId); if (!el) return; el.color = colors[(colors.indexOf(el.color) + 1) % colors.length]; touchDiagram(d); render(); }

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
    node.style.left = item.x + "px"; node.style.top = item.y + "px"; suppressClick = true;
  };
  const onUp = () => { if (drag?.type === "element") { drag = null; touchDiagram(d); setTimeout(() => suppressClick = false, 10); } window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp, { once: true });
}
function startResize(ev, d, elementId) {
  ev.preventDefault(); ev.stopPropagation();
  const el = d.elements.find(e => e.id === elementId), node = document.querySelector(`[data-element="${elementId}"]`); if (!el || !node) return;
  const start = { x: ev.clientX, y: ev.clientY, width: node.offsetWidth, height: node.offsetHeight };
  const onMove = moveEv => { el.width = Math.max(180, start.width + (moveEv.clientX - start.x) / currentScale); el.height = Math.max(150, start.height + (moveEv.clientY - start.y) / currentScale); node.style.width = `${el.width}px`; node.style.height = `${el.height}px`; };
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
async function renderSvg(source, renderId) {
  if (!mermaidPromise) mermaidPromise = import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs").then(module => { module.default.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default", flowchart: { curve: "basis", htmlLabels: true } }); return module.default; });
  const mermaid = await mermaidPromise;
  const result = await mermaid.render(renderId.replace(/[^a-zA-Z0-9_-]/g, ""), source);
  return result.svg;
}

function touchDiagram(d) {
  d.updatedAt = Date.now(); persist();
  const status = document.getElementById("saveStatus"); if (status) { status.innerHTML = "<i></i> Salvando…"; clearTimeout(touchDiagram.timer); touchDiagram.timer = setTimeout(() => { if (status.isConnected) status.innerHTML = "<i></i> Salvo"; }, 450); }
  const count = document.querySelector(".bottom-bar span:nth-child(2)"); if (count) count.textContent = `${d.elements.length} itens no quadro`;
}
function publish(d) {
  const payload = base64UrlEncode(JSON.stringify({ title: diagramTitle(d), elements: d.elements }));
  const url = `${location.origin}${location.pathname}#share=${payload}`;
  navigator.clipboard?.writeText(url).then(() => toast("Link de visualização copiado")).catch(() => prompt("Copie o link de visualização:", url));
}
function renderShared() {
  try {
    const encoded = new URLSearchParams(location.hash.slice(1)).get("share");
    const data = JSON.parse(base64UrlDecode(encoded));
    app.innerHTML = `<div class="shared-view"><header class="shared-top"><a href="${location.pathname}" class="brand mini-brand"><div class="brand-mark">V</div><strong>VLI Diagrams</strong></a><span>Visualização publicada</span></header><main><div class="shared-title"><div class="eyebrow">QUADRO PUBLICADO</div><h1>${escapeHtml(data.title)}</h1></div><div class="shared-canvas-wrap"><div class="shared-canvas" id="sharedCanvas">${data.elements.map(renderElement).join("")}</div></div></main></div>`;
    data.elements.filter(e => e.type === "sticky").forEach(e => { const n = document.querySelector(`[data-text="${e.id}"]`); if (n) { n.disabled = true; n.readOnly = true; } });
    renderAllMermaid({ elements: data.elements });
  } catch { app.innerHTML = `<div class="share-error"><h1>Este link não parece válido</h1><a href="${location.pathname}">Abrir VLI Diagrams</a></div>`; }
}
function base64UrlEncode(value) { const bytes = new TextEncoder().encode(value); let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, ""); }
function base64UrlDecode(value) { const normal = value.replaceAll("-", "+").replaceAll("_", "/"); const binary = atob(normal + "=".repeat((4 - normal.length % 4) % 4)); const bytes = Uint8Array.from(binary, c => c.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function toast(message) { const el = document.getElementById("toast"); if (!el) return; el.textContent = message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 2400); }
function debounce(fn, wait) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), wait); }; }

render();
