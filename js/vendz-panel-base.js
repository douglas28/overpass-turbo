// Unified Vendz Panel Base Template
// Extracted from POI Filter Panel for reuse

export function createVendzPanel({
  id,
  title,
  headerClass = "",
  bodyHtml = "",
  footerHtml = "",
  tabs = [],
  onTabClick = null,
  onClose = null,
  onOpen = null,
  draggable = true,
  toggleBtn = null,
  startOpen = false,
  extraInit = null
}) {
  // Toggle button (optional)
  let togBtn = toggleBtn;
  if (!togBtn) {
    togBtn = document.createElement("button");
    togBtn.id = id + "-toggle";
    togBtn.textContent = title;
    document.body.appendChild(togBtn);
  }

  // Panel
  const panel = document.createElement("div");
  panel.id = id;
  panel.className = "vendz-panel";
  panel.innerHTML =
    `<div class="${headerClass}"><span>${title}</span><button class="panel-close">\u00D7</button></div>` +
    (tabs.length
      ? `<div class="panel-tabs">${tabs.map((tab) => `<button class="panel-tab" data-tab="${tab.key}">${tab.label}</button>`).join("")}</div>`
      : "") +
    `<div class="panel-body">${bodyHtml}</div>` +
    (footerHtml ? `<div class="panel-footer">${footerHtml}</div>` : "");
  document.body.appendChild(panel);

  // Drag
  if (draggable) {
    const header =
      panel.querySelector(`.${headerClass}`) || panel.firstElementChild;
    if (header) window.makeDraggable(panel, header);
  }

  // Toggle
  togBtn.addEventListener("click", () => {
    panel.classList.toggle("open");
    if (panel.classList.contains("open") && onOpen) onOpen(panel);
  });
  panel.querySelector(".panel-close").addEventListener("click", () => {
    panel.classList.remove("open");
    if (onClose) onClose(panel);
  });

  // Tabs
  if (tabs.length && onTabClick) {
    panel.querySelectorAll(".panel-tab").forEach((tabBtn) => {
      tabBtn.addEventListener("click", (e) => {
        const key = tabBtn.dataset.tab;
        onTabClick(key, panel);
        panel
          .querySelectorAll(".panel-tab")
          .forEach((t) => t.classList.remove("active"));
        tabBtn.classList.add("active");
      });
    });
  }

  // Start open
  if (startOpen) panel.classList.add("open");

  // Extra init
  if (extraInit) extraInit(panel);

  return panel;
}
