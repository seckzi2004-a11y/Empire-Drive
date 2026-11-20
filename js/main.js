// ============================================================
// Configuration : à modifier selon ton activité
// ============================================================

// Numéro WhatsApp au format international, sans + ni espaces
const WHATSAPP_NUMBER = "221774729776";

// Flotte de démonstration. Elle s'affiche seulement tant que Firebase n'est pas
// configuré (js/firebase-config.js). Ensuite, les voitures se gèrent depuis admin.html.
const DEFAULT_FLEET = [
  { name: "Ford Fusion",    cat: "Berline",  seats: 5,  trans: "Automatique", fuel: "Essence", price: 25000, image: "images/ford-fusion.png" },
  { name: "Toyota Yaris",   cat: "Citadine", seats: 5,  trans: "Manuelle",    fuel: "Essence", price: 20000, image: "" },
  { name: "Hyundai Accent", cat: "Berline",  seats: 5,  trans: "Automatique", fuel: "Essence", price: 30000, image: "" },
  { name: "Toyota Corolla", cat: "Berline",  seats: 5,  trans: "Automatique", fuel: "Essence", price: 40000, image: "" },
  { name: "Toyota RAV4",    cat: "SUV",      seats: 5,  trans: "Automatique", fuel: "Essence", price: 60000, image: "" },
  { name: "Toyota Prado",   cat: "4x4",      seats: 7,  trans: "Automatique", fuel: "Diesel",  price: 90000, image: "" },
  { name: "Toyota Hiace",   cat: "Minibus",  seats: 14, trans: "Manuelle",    fuel: "Diesel",  price: 85000, image: "" }
];

// ============================================================
// Code du site
// ============================================================

const fmt = (n) => Number(n).toLocaleString("fr-FR") + " FCFA";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let FLEET = DEFAULT_FLEET;

// --- Base de données (Firebase) : voitures et réservations gérées dans admin.html ---
function getDb() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.startsWith("VOTRE") || !window.firebase) return null;
  try {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    return firebase.firestore();
  } catch (err) {
    console.error("Firebase :", err);
    return null;
  }
}
const db = getDb();

async function loadFleet() {
  if (!db) return; // pas configuré : on garde la flotte de démonstration
  try {
    const snap = await db.collection("vehicles").orderBy("createdAt").get();
    FLEET = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("Impossible de charger les véhicules :", err);
    FLEET = DEFAULT_FLEET;
  }
}

function saveReservation(r) {
  if (!db) return;
  db.collection("reservations")
    .add({ ...r, status: "nouvelle", createdAt: firebase.firestore.FieldValue.serverTimestamp() })
    .catch((err) => console.error("Réservation non enregistrée :", err));
}

const filtersEl = document.getElementById("filters");
const fleetEl = document.getElementById("fleet");
const carSelect = document.getElementById("car");
const form = document.getElementById("reserver");
const startInput = document.getElementById("start");
const endInput = document.getElementById("end");
const estimateLabel = document.getElementById("estimate-label");
const estimateTotal = document.getElementById("estimate-total");
const messageEl = document.getElementById("form-message");

let currentCat = "Tous";

// --- Filtres par catégorie ---
function renderFilters() {
  const cats = ["Tous", ...new Set(FLEET.map((c) => c.cat))];
  filtersEl.innerHTML = "";
  cats.forEach((cat) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pill";
    btn.textContent = cat;
    btn.setAttribute("aria-pressed", String(cat === currentCat));
    btn.addEventListener("click", () => {
      currentCat = cat;
      renderFilters();
      renderFleet();
    });
    filtersEl.appendChild(btn);
  });
}

// --- Cartes des véhicules ---
function renderFleet() {
  fleetEl.innerHTML = "";
  if (!FLEET.length) {
    fleetEl.innerHTML = `<p class="empty">Nos véhicules seront bientôt en ligne. Contactez-nous sur WhatsApp pour connaître les disponibilités.</p>`;
    return;
  }
  FLEET.filter((c) => currentCat === "Tous" || c.cat === currentCat).forEach((car) => {
    const card = document.createElement("article");
    card.className = "card";
    const free = car.available !== false;

    const photo = car.image
      ? `<img src="${esc(car.image)}" alt="${esc(car.name)}">`
      : carSvg(car.cat);

    card.innerHTML = `
      <div class="card-photo">${photo}</div>
      <div class="card-body">
        <div class="card-head">
          <h3>${esc(car.name)}</h3>
          <span class="tag">${esc(car.cat)}</span>
        </div>
        <div class="card-specs">${esc(car.seats)} places · ${esc(car.trans)} · ${esc(car.fuel)}</div>
        <div class="card-foot">
          <div class="price"><strong>${fmt(car.price)}</strong><span> / jour</span></div>
          ${free ? `<a class="btn" href="#reserver">Réserver</a>` : `<span class="badge-off">Indisponible</span>`}
        </div>
      </div>`;

    const btn = card.querySelector(".btn");
    if (btn) btn.addEventListener("click", () => {
      carSelect.value = car.name;
      updateEstimate();
    });
    fleetEl.appendChild(card);
  });
}

// --- Liste déroulante du formulaire ---
function renderCarSelect() {
  carSelect.innerHTML = FLEET
    .filter((c) => c.available !== false)
    .map((c) => `<option value="${esc(c.name)}">${esc(c.name)} · ${fmt(c.price)} / jour</option>`)
    .join("");
}

// --- Estimation du prix ---
function getDays() {
  if (!startInput.value || !endInput.value) return 0;
  const ms = new Date(endInput.value) - new Date(startInput.value);
  return Math.round(ms / 86400000);
}

function updateEstimate() {
  const car = FLEET.find((c) => c.name === carSelect.value);
  const days = getDays();
  if (!car) {
    estimateLabel.textContent = "Aucun véhicule disponible pour le moment";
    estimateTotal.textContent = "";
    return;
  }
  if (days > 0) {
    estimateLabel.textContent = `Total estimé pour ${days} ${days > 1 ? "jours" : "jour"}`;
    estimateTotal.textContent = fmt(car.price * days);
  } else {
    estimateLabel.textContent = "Choisissez vos dates pour voir le total estimé";
    estimateTotal.textContent = fmt(car.price) + " / jour";
  }
}

// --- Envoi de la demande par WhatsApp ---
function showMessage(text, isError) {
  messageEl.textContent = text;
  messageEl.classList.toggle("error", Boolean(isError));
  messageEl.hidden = false;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const days = getDays();

  // Vérification simple des champs obligatoires
  let ok = true;
  ["start", "end", "nom", "tel"].forEach((id) => {
    const input = document.getElementById(id);
    const empty = !input.value.trim();
    input.classList.toggle("invalid", empty);
    if (empty) ok = false;
  });
  if (!ok) return showMessage("Merci de remplir tous les champs.", true);
  if (days <= 0) return showMessage("La date de retour doit être après la date de départ.", true);

  const car = FLEET.find((c) => c.name === data.get("car"));
  if (!car) return showMessage("Choisissez un véhicule disponible.", true);
  const text =
    `Bonjour, je souhaite réserver :\n` +
    `Véhicule : ${car.name}\n` +
    `Lieu : ${data.get("city")}\n` +
    `Du ${data.get("start")} au ${data.get("end")} (${days} jours)\n` +
    `Total estimé : ${fmt(car.price * days)}\n` +
    `Nom : ${data.get("nom")}\n` +
    `Téléphone : ${data.get("tel")}`;

  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener");
  // Enregistre aussi la demande dans l'espace admin (si Firebase est configuré)
  saveReservation({
    nom: String(data.get("nom")).trim().slice(0, 100),
    tel: String(data.get("tel")).trim().slice(0, 40),
    car: car.name,
    city: String(data.get("city")),
    start: String(data.get("start")),
    end: String(data.get("end")),
    days,
    total: car.price * days
  });
  showMessage("Votre demande s'ouvre dans WhatsApp. Envoyez le message pour la confirmer.");
});

[startInput, endInput, carSelect].forEach((el) => el.addEventListener("change", updateEstimate));

// Dates : pas avant aujourd'hui, retour après le départ
const today = new Date().toISOString().split("T")[0];
startInput.min = today;
endInput.min = today;
startInput.addEventListener("change", () => { endInput.min = startInput.value || today; });

// --- Silhouettes de voitures (dessins vectoriels génériques) ---
const SHAPES = {
  Citadine: { r: 13, body: "M10 60 V48 Q11 42 20 41 L52 37 Q60 21 80 20 H122 Q138 21 148 37 L178 42 Q192 44 192 54 V60 Z",
              win: "M60 37 Q66 26 82 25 H98 V37 Z M104 25 H122 Q133 26 141 37 H104 Z" },
  Berline:  { r: 13, body: "M8 60 V50 Q9 44 18 43 L50 39 Q64 22 88 21 H118 Q138 22 150 38 L182 43 Q194 45 194 54 V60 Z",
              win: "M62 38 Q72 26 90 26 H100 V38 Z M106 26 H118 Q132 27 142 38 H106 Z" },
  SUV:      { r: 14, body: "M8 60 V44 Q9 38 20 37 L44 35 L58 19 H148 Q160 19 166 33 L184 37 Q196 39 196 52 V60 Z",
              win: "M62 33 L70 24 H98 V33 Z M104 24 H146 Q153 25 158 33 H104 Z" },
  "4x4":    { r: 15, body: "M8 60 V40 L30 38 L44 19 H152 L166 37 L192 39 Q196 41 196 54 V60 Z",
              win: "M50 35 L58 24 H98 V35 Z M104 24 H146 L154 35 H104 Z" },
  Minibus:  { r: 14, body: "M6 60 V22 Q6 16 14 16 H150 Q160 16 168 31 L192 39 Q197 41 197 52 V60 Z",
              win: "M14 22 H44 V36 H14 Z M50 22 H80 V36 H50 Z M86 22 H116 V36 H86 Z M122 22 H148 Q155 24 160 36 H122 Z" }
};

function wheelSvg(cx, cy, r) {
  return `<g class="wheel">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#070D16"/>
    <circle cx="${cx}" cy="${cy}" r="${r - 4}" fill="#1A2638" stroke="currentColor" stroke-width="1.5" opacity="0.9"/>
    <path d="M${cx - r + 6} ${cy}H${cx + r - 6}M${cx} ${cy - r + 6}V${cy + r - 6}M${cx - 5} ${cy - 5}L${cx + 5} ${cy + 5}M${cx + 5} ${cy - 5}L${cx - 5} ${cy + 5}" stroke="currentColor" stroke-width="1.2" opacity="0.8"/>
    <circle cx="${cx}" cy="${cy}" r="2.6" fill="currentColor"/>
  </g>`;
}

function carSvg(type) {
  const s = SHAPES[type] || SHAPES.Berline;
  return `<svg class="car-svg" viewBox="0 0 200 78" aria-hidden="true">
    <path d="${s.body}" fill="currentColor"/>
    <path d="${s.win}" fill="rgba(7,13,22,0.6)"/>
    <rect x="186" y="47" width="8" height="4" rx="2" fill="#FFE08A"/>
    <rect x="7" y="47" width="4" height="4" rx="1" fill="#E5484D"/>
    ${wheelSvg(52, 60, s.r)}${wheelSvg(150, 60, s.r)}
  </svg>`;
}

// --- Décor animé du hero : vraies voitures qui roulent sur la route ---
// Pour ajouter d'autres voitures : mets une photo détourée (PNG transparent,
// voiture vue de 3/4 avant, roulant vers la gauche) dans images/ et ajoute-la ici.
const SCENE_CARS = [
  { src: "images/ford-fusion.png", lane: "far",  dur: 46, delay: -8,  x: "62%" },
  { src: "images/ford-fusion.png", lane: "mid",  dur: 31, delay: -22, x: "30%" },
  { src: "images/ford-fusion.png", lane: "near", dur: 21, delay: -6,  x: "12%" },
  { src: "images/ford-fusion.png", lane: "far",  dur: 46, delay: -31, x: "85%" },
  { src: "images/ford-fusion.png", lane: "near", dur: 21, delay: -17, x: "55%" }
];

function renderScene() {
  const scene = document.getElementById("scene");
  if (!scene) return;
  scene.innerHTML =
    `<div class="road"></div>` +
    SCENE_CARS.map((c) =>
      `<div class="car car-${c.lane}" style="--dur:${c.dur}s;--delay:${c.delay}s;--x:${c.x}">
         <div class="car-inner"><span class="beam"></span><span class="glow"></span><img src="${c.src}" alt=""></div>
       </div>`
    ).join("");
}

// --- Apparition au défilement ---
function setupReveal() {
  const items = document.querySelectorAll(".section-title, .section-intro, .filters, .service, .terms > div, .contact-inner > *");
  items.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = (i % 4) * 80 + "ms";
  });
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  items.forEach((el) => io.observe(el));
}

// --- Démarrage ---
function renderAll() {
  renderFilters();
  renderFleet();
  renderCarSelect();
  if (FLEET.some((c) => c.name === "Ford Fusion" && c.available !== false)) carSelect.value = "Ford Fusion";
  updateEstimate();
}

renderScene();
setupReveal();
if (db) {
  fleetEl.innerHTML = `<p class="empty">Chargement des véhicules…</p>`;
  loadFleet().then(renderAll);
} else {
  renderAll();
}
