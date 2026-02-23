
const STORAGE_KEY = "aschke_beratungsbogen_native_v1";

const IDS_TEXT = [
  "vorname","nachname","strasse","hausnr","plz","ort","telefon","gebdatum","email",
  "abschluss","ausbildung","beruf","weiterbildung_text","termin_datum","termin_uhr","berater"
];
const IDS_CHECK = ["i_praktikum","i_ausbildung","i_weiterbildung","ds_ack"];

const btnConfirm = document.getElementById("btnConfirm");
const toast = document.getElementById("toast");
const toastOk = document.getElementById("toastOk");

const $ = (id) => document.getElementById(id);

function pad2(n){ return String(n).padStart(2,"0"); }
function formatISO(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function safeNamePart(s){
  return (s||"")
    .trim()
    .replace(/\s+/g,"_")
    .replace(/[^\wäöüÄÖÜß\-]/g,"");
}

function getFormData(){
  const data = {};
  for (const id of IDS_TEXT) data[id] = ($(id)?.value || "").trim();
  for (const id of IDS_CHECK) data[id] = !!$(id)?.checked;
  return data;
}

function setFormData(data){
  for (const id of IDS_TEXT){ const el = $(id); if (el) el.value = data?.[id] ?? ""; }
  for (const id of IDS_CHECK){ const el = $(id); if (el) el.checked = !!data?.[id]; }
}

function saveDraft(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(getFormData())); }catch(e){}
}

function loadDraft(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

function clearDraft(){
  try{ localStorage.removeItem(STORAGE_KEY); }catch(e){}
}

function resetForm(){
  if (typeof clearSignature === "function") clearSignature();

  for (const id of IDS_TEXT){ const el=$(id); if(el) el.value=""; }
  for (const id of IDS_CHECK){ const el=$(id); if(el) el.checked=false; }
  clearDraft();
}

function validate(){
  // Signatur Pflicht
  if (typeof sigHasInk !== "undefined" && !sigHasInk) {
    alert("Bitte unterschreiben (Unterschrift-Feld).");
    return false;
  }

  const missing = [];
  if (!($("ds_ack")?.checked)) missing.push("Datenschutz akzeptieren (Haken setzen)");
  if (!($("vorname")?.value||"").trim()) missing.push("Vorname");
  if (!($("nachname")?.value||"").trim()) missing.push("Nachname");

  if (missing.length){
    alert("Bitte ergänzen:\n• " + missing.join("\n• "));
    return false;
  }
  return true;
}

function setTitleForExport(){
  const vn = safeNamePart($("vorname")?.value);
  const nn = safeNamePart($("nachname")?.value);
  const iso = formatISO(new Date());
  const base = [nn, vn, iso].filter(Boolean).join("_");
  document.title = base ? base : `Beratungsbogen_${iso}`;
}

function openToast(){ toast.classList.add("is-open"); }
function closeToast(){ toast.classList.remove("is-open"); }

function confirmAndSave(){
  if (!validate()) return;

  const ok = confirm("Sind alle Angaben korrekt?\n\nWenn ja, wird jetzt das PDF zum Speichern geöffnet.");
  if (!ok) return;

  setTitleForExport();
  setTimeout(() => {
    window.print();
    setTimeout(openToast, 250);
  }, 150);
}

btnConfirm.addEventListener("click", confirmAndSave);

toastOk.addEventListener("click", () => {
  closeToast();
  resetForm();
});

document.addEventListener("input", (e) => {
  if (e.target && e.target.tagName === "INPUT") saveDraft();
});
document.addEventListener("change", (e) => {
  if (e.target && e.target.tagName === "INPUT") saveDraft();
});

const draft = loadDraft();
if (draft) setFormData(draft);


// ---------- Signatur (Canvas) ----------
const sigCanvas = document.getElementById("sigCanvas");
const sigClear = document.getElementById("sigClear");
const todayLabel = document.getElementById("todayLabel");

let sigCtx = null;
let sigDrawing = false;
let sigHasInk = false;
let sigLast = {x:0,y:0};

function setToday(){
  const d = new Date();
  const label = `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()}`;
  if (todayLabel) todayLabel.textContent = label;
}

function resizeSignatureCanvas(){
  if (!sigCanvas) return;
  const rect = sigCanvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  sigCanvas.width = Math.max(1, Math.round(rect.width * dpr));
  sigCanvas.height = Math.max(1, Math.round(rect.height * dpr));
  sigCtx = sigCanvas.getContext("2d");
  sigCtx.scale(dpr, dpr);
  sigCtx.lineWidth = 2.2;
  sigCtx.lineCap = "round";
  sigCtx.lineJoin = "round";
  sigCtx.strokeStyle = "#111";
  // restore if existing
  restoreSignature();
}

function getPoint(evt){
  const rect = sigCanvas.getBoundingClientRect();
  const clientX = evt.clientX ?? (evt.touches && evt.touches[0]?.clientX);
  const clientY = evt.clientY ?? (evt.touches && evt.touches[0]?.clientY);
  return {
    x: (clientX - rect.left),
    y: (clientY - rect.top)
  };
}

function sigStart(evt){
  if (!sigCtx) return;
  sigDrawing = true;
  const p = getPoint(evt);
  sigLast = p;
  sigCtx.beginPath();
  sigCtx.moveTo(p.x, p.y);
  evt.preventDefault?.();
}

function sigMove(evt){
  if (!sigDrawing || !sigCtx) return;
  const p = getPoint(evt);
  sigCtx.lineTo(p.x, p.y);
  sigCtx.stroke();
  sigLast = p;
  sigHasInk = true;
  evt.preventDefault?.();
}

function sigEnd(){
  if (!sigDrawing) return;
  sigDrawing = false;
  saveSignature();
}

function clearSignature(){
  if (!sigCanvas) return;
  const rect = sigCanvas.getBoundingClientRect();
  sigCtx.clearRect(0,0, rect.width, rect.height);
  sigHasInk = false;
  try{ localStorage.removeItem(STORAGE_KEY + "_sig"); }catch(e){}
}

function saveSignature(){
  try{
    const dataUrl = sigCanvas.toDataURL("image/png");
    localStorage.setItem(STORAGE_KEY + "_sig", dataUrl);
  }catch(e){}
  saveDraft();
}

function restoreSignature(){
  if (!sigCanvas || !sigCtx) return;
  let dataUrl = null;
  try{ dataUrl = localStorage.getItem(STORAGE_KEY + "_sig"); }catch(e){}
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    const rect = sigCanvas.getBoundingClientRect();
    sigCtx.clearRect(0,0, rect.width, rect.height);
    sigCtx.drawImage(img, 0, 0, rect.width, rect.height);
    sigHasInk = true;
  };
  img.src = dataUrl;
}

// pointer events (best on iPad)
if (sigCanvas){
  sigCanvas.addEventListener("pointerdown", sigStart);
  sigCanvas.addEventListener("pointermove", sigMove);
  window.addEventListener("pointerup", sigEnd);
  window.addEventListener("pointercancel", sigEnd);

  // fallback touch
  sigCanvas.addEventListener("touchstart", (e)=>sigStart(e), {passive:false});
  sigCanvas.addEventListener("touchmove", (e)=>sigMove(e), {passive:false});
  sigCanvas.addEventListener("touchend", sigEnd);

  window.addEventListener("resize", () => {
    // keep ink via dataURL
    const had = sigHasInk;
    const data = had ? sigCanvas.toDataURL("image/png") : null;
    resizeSignatureCanvas();
    if (data){
      try{ localStorage.setItem(STORAGE_KEY + "_sig", data); }catch(e){}
      restoreSignature();
    }
  });

  if (sigClear) sigClear.addEventListener("click", clearSignature);
}

// Set date + prepare canvas after first paint
setToday();
setTimeout(resizeSignatureCanvas, 0);


if ("serviceWorker" in navigator){
  window.addEventListener("load", async () => {
    try{ await navigator.serviceWorker.register("./sw.js"); }catch(e){}
  });
}
