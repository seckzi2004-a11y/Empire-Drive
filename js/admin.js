// ============================================================
// Espace administrateur : véhicules, prix, photos, réservations
// ============================================================

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n).toLocaleString("fr-FR") + " FCFA";

const cfg = window.FIREBASE_CONFIG;
const configured = cfg && cfg.apiKey && !cfg.apiKey.startsWith("VOTRE") && window.firebase;

if (!configured) {
  $("setup").hidden = false;
} else {
  start();
}

function start() {
  firebase.initializeApp(cfg);
  const auth = firebase.auth();
  const db = firebase.firestore();
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  let unsubVehicles = null;
  let unsubBookings = null;
  let vehicles = [];
  let editingId = null;
  let photoData = ""; // image choisie (data URL), "" = aucune

  // ---------- Connexion ----------
  auth.onAuthStateChanged((user) => {
    if (user) {
      $("login").hidden = true;
      $("app").hidden = false;
      $("who").textContent = user.email;
      listen();
    } else {
      stopListening();
      $("app").hidden = true;
      $("login").hidden = false;
    }
  });

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("login-error");
    err.hidden = true;
    try {
      await auth.signInWithEmailAndPassword($("email").value.trim(), $("password").value);
      $("password").value = "";
    } catch (ex) {
      err.textContent = "Email ou mot de passe incorrect.";
      err.hidden = false;
    }
  });
  $("logout").addEventListener("click", () => auth.signOut());

  // Envoie un email pour choisir ou changer son mot de passe
  $("reset-btn").addEventListener("click", async () => {
    const err = $("login-error"), info = $("login-info");
    err.hidden = true; info.hidden = true;
    const email = $("email").value.trim();
    if (!email) {
      err.textContent = "Saisis d'abord ton email ci-dessus, puis clique à nouveau.";
      err.hidden = false;
      return;
    }
    try {
      await auth.sendPasswordResetEmail(email);
    } catch (ex) {
      console.error(ex);
    }
    // Même message dans tous les cas, pour ne pas révéler quels emails existent
    info.textContent = "Si ce compte existe, un email vient d'être envoyé pour choisir un mot de passe. Pense à vérifier les courriers indésirables.";
    info.hidden = false;
  });

  // ---------- Onglets ----------
  function selectTab(name) {
    ["vehicles", "bookings"].forEach((t) => {
      $("tab-" + t).setAttribute("aria-selected", String(t === name));
      $("panel-" + t).hidden = t !== name;
    });
  }
  $("tab-vehicles").addEventListener("click", () => selectTab("vehicles"));
  $("tab-bookings").addEventListener("click", () => selectTab("bookings"));

  // ---------- Écoute en temps réel ----------
  function showAppError(msg) {
    $("app-error").textContent = msg;
    $("app-error").hidden = !msg;
  }
  function onSnapshotError(ex) {
    console.error(ex);
    showAppError("Accès refusé ou connexion impossible. Vérifie que ton email est bien celui autorisé dans firestore.rules.");
  }

  function listen() {
    stopListening();
    showAppError("");
    unsubVehicles = db.collection("vehicles").orderBy("createdAt").onSnapshot((snap) => {
      vehicles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderVehicles();
    }, onSnapshotError);
    unsubBookings = db.collection("reservations").orderBy("createdAt", "desc").onSnapshot((snap) => {
      renderBookings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, onSnapshotError);
  }
  function stopListening() {
    if (unsubVehicles) unsubVehicles();
    if (unsubBookings) unsubBookings();
    unsubVehicles = unsubBookings = null;
  }

  // ---------- Véhicules : liste ----------
  function renderVehicles() {
    $("count-vehicles").textContent = vehicles.length;
    const list = $("vehicle-list");
    if (!vehicles.length) {
      list.innerHTML = `<p class="empty">Aucun véhicule pour le moment. Ajoute le premier avec le formulaire ci-dessus.</p>`;
      return;
    }
    list.innerHTML = vehicles.map((v) => `
      <div class="vrow ${v.available === false ? "off" : ""}" data-id="${esc(v.id)}">
        <div class="thumb">${v.image ? `<img src="${esc(v.image)}" alt="">` : "Sans photo"}</div>
        <div class="vinfo">
          <strong>${esc(v.name)}</strong>
          <span>${esc(v.cat)} · ${esc(v.seats)} places · ${esc(v.trans)} · ${esc(v.fuel)}</span>
        </div>
        <div class="price-edit">
          <input type="number" min="0" step="500" value="${esc(v.price)}" aria-label="Prix par jour de ${esc(v.name)}">
          <span>FCFA / jour</span>
          <button class="btn btn-red btn-sm" type="button" data-act="price">OK</button>
        </div>
        <div class="vactions">
          <span class="pill ${v.available === false ? "off" : ""}">${v.available === false ? "Indisponible" : "Disponible"}</span>
          <button class="btn btn-ghost-dark btn-sm" type="button" data-act="toggle">${v.available === false ? "Remettre en ligne" : "Marquer indisponible"}</button>
          <button class="btn btn-ghost-dark btn-sm" type="button" data-act="edit">Modifier</button>
          <button class="btn btn-danger btn-sm" type="button" data-act="delete">Supprimer</button>
        </div>
      </div>`).join("");
  }

  $("vehicle-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const row = btn.closest(".vrow");
    const v = vehicles.find((x) => x.id === row.dataset.id);
    if (!v) return;
    try {
      if (btn.dataset.act === "price") {
        const price = Number(row.querySelector("input").value);
        if (!(price >= 0)) return;
        await db.collection("vehicles").doc(v.id).update({ price });
      } else if (btn.dataset.act === "toggle") {
        await db.collection("vehicles").doc(v.id).update({ available: v.available === false });
      } else if (btn.dataset.act === "edit") {
        fillForm(v);
      } else if (btn.dataset.act === "delete") {
        if (confirm(`Supprimer « ${v.name} » ? Cette action est définitive.`)) {
          await db.collection("vehicles").doc(v.id).delete();
          if (editingId === v.id) resetForm();
        }
      }
    } catch (ex) {
      console.error(ex);
      showAppError("L'action a échoué. Vérifie ta connexion et tes droits d'accès.");
    }
  });

  // ---------- Véhicules : formulaire ----------
  const f = {
    name: $("v-name"), cat: $("v-cat"), price: $("v-price"), seats: $("v-seats"),
    trans: $("v-trans"), fuel: $("v-fuel"), photo: $("v-photo"), avail: $("v-available")
  };

  function setPreview(src) {
    $("photo-preview").innerHTML = src ? `<img src="${esc(src)}" alt="Aperçu">` : `<span>Aucune photo</span>`;
  }

  function resetForm() {
    editingId = null;
    photoData = "";
    $("vehicle-form").reset();
    f.seats.value = 5;
    f.avail.checked = true;
    setPreview("");
    $("form-title").textContent = "Ajouter un véhicule";
    $("save-btn").textContent = "Enregistrer le véhicule";
    $("cancel-btn").hidden = true;
  }

  function fillForm(v) {
    editingId = v.id;
    photoData = v.image || "";
    f.name.value = v.name || "";
    f.cat.value = v.cat || "Berline";
    f.price.value = v.price ?? "";
    f.seats.value = v.seats ?? 5;
    f.trans.value = v.trans || "Automatique";
    f.fuel.value = v.fuel || "Essence";
    f.avail.checked = v.available !== false;
    f.photo.value = "";
    setPreview(photoData);
    $("form-title").textContent = "Modifier « " + v.name + " »";
    $("save-btn").textContent = "Enregistrer les modifications";
    $("cancel-btn").hidden = false;
    $("vehicle-form").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("cancel-btn").addEventListener("click", resetForm);

  // Redimensionne la photo et la convertit en texte (WebP) pour la stocker dans la base
  function imageToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        for (const maxW of [900, 700, 520, 400]) {
          const s = Math.min(1, maxW / img.width);
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * s);
          c.height = Math.round(img.height * s);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          let out = c.toDataURL("image/webp", 0.85);
          if (!out.startsWith("data:image/webp")) out = c.toDataURL("image/png");
          if (out.length < 800000) return resolve(out);
        }
        reject(new Error("Image trop lourde"));
      };
      img.onerror = () => reject(new Error("Image illisible"));
      img.src = url;
    });
  }

  f.photo.addEventListener("change", async () => {
    const file = f.photo.files[0];
    if (!file) return;
    try {
      photoData = await imageToDataUrl(file);
      setPreview(photoData);
    } catch (ex) {
      formMessage("Impossible de lire cette image. Essaie un fichier PNG ou JPG plus léger.", true);
    }
  });

  function formMessage(text, isError) {
    const m = $("form-msg");
    m.textContent = text;
    m.classList.toggle("error", Boolean(isError));
    m.hidden = false;
  }

  $("vehicle-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    let ok = true;
    [f.name, f.price, f.seats].forEach((el) => {
      const bad = !String(el.value).trim();
      el.classList.toggle("invalid", bad);
      if (bad) ok = false;
    });
    if (!ok) return formMessage("Renseigne au minimum le nom, le prix et le nombre de places.", true);

    const data = {
      name: f.name.value.trim(),
      cat: f.cat.value,
      price: Number(f.price.value),
      seats: Number(f.seats.value),
      trans: f.trans.value,
      fuel: f.fuel.value,
      image: photoData,
      available: f.avail.checked
    };

    const btn = $("save-btn");
    btn.disabled = true;
    try {
      if (editingId) {
        await db.collection("vehicles").doc(editingId).update(data);
        formMessage("Modifications enregistrées. Elles sont visibles sur le site.");
      } else {
        await db.collection("vehicles").add({ ...data, createdAt: ts() });
        formMessage("Véhicule ajouté. Il est visible sur le site.");
      }
      resetForm();
    } catch (ex) {
      console.error(ex);
      formMessage("Enregistrement impossible. Vérifie ta connexion et la taille de la photo.", true);
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Réservations ----------
  const STATUS = { nouvelle: "Nouvelle", confirmee: "Confirmée", annulee: "Annulée" };

  function when(t) {
    const d = t && t.toDate ? t.toDate() : null;
    return d ? d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "à l'instant";
  }

  function renderBookings(list) {
    const fresh = list.filter((b) => (b.status || "nouvelle") === "nouvelle").length;
    $("count-new").textContent = fresh;
    $("count-new").hidden = fresh === 0;

    const box = $("booking-list");
    if (!list.length) {
      box.innerHTML = `<p class="empty">Aucune demande pour le moment. Les demandes envoyées depuis le site apparaissent ici.</p>`;
      return;
    }
    box.innerHTML = list.map((b) => {
      const st = b.status || "nouvelle";
      const digits = String(b.tel || "").replace(/\D/g, "");
      const wa = digits ? `https://wa.me/${digits.length === 9 ? "221" + digits : digits}` : "";
      return `
      <article class="brow ${st === "confirmee" ? "done" : st === "annulee" ? "cancel" : ""}" data-id="${esc(b.id)}">
        <div>
          <h3>${esc(b.nom)}</h3>
          <p class="small">${esc(b.tel)}</p>
          <p class="small">Reçue le ${esc(when(b.createdAt))}</p>
        </div>
        <div>
          <p><strong>${esc(b.car)}</strong></p>
          <p class="small">${esc(b.city)}</p>
          <p class="small">Du ${esc(b.start)} au ${esc(b.end)} (${esc(b.days)} j)</p>
        </div>
        <div>
          <p class="total">${fmt(b.total || 0)}</p>
          <div class="row-actions">
            <select aria-label="Statut de la demande de ${esc(b.nom)}" data-act="status">
              ${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${k === st ? "selected" : ""}>${l}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="row-actions">
          ${wa ? `<a href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
          ${digits ? `<a href="tel:+${digits.length === 9 ? "221" + digits : digits}">Appeler</a>` : ""}
          <button class="btn btn-danger btn-sm" type="button" data-act="delete">Supprimer</button>
        </div>
      </article>`;
    }).join("");
  }

  $("booking-list").addEventListener("change", async (e) => {
    if (e.target.dataset.act !== "status") return;
    const id = e.target.closest(".brow").dataset.id;
    try { await db.collection("reservations").doc(id).update({ status: e.target.value }); }
    catch (ex) { console.error(ex); showAppError("Le statut n'a pas pu être modifié."); }
  });

  $("booking-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act='delete']");
    if (!btn) return;
    const id = btn.closest(".brow").dataset.id;
    if (!confirm("Supprimer cette demande ?")) return;
    try { await db.collection("reservations").doc(id).delete(); }
    catch (ex) { console.error(ex); showAppError("La suppression a échoué."); }
  });
}
