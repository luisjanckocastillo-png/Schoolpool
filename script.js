/* SchoolPool - cliente web. La clave publishable puede estar en el navegador; nunca colocar service_role aquí. */
const SUPABASE_URL = "https://hkksjllgntoimczuyslf.supabase.co";
const SUPABASE_KEY = "sb_publishable_VvKZ5RZRSWnWQmJ1KmCEnA_Ga7m_4jE";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  user: null, profile: null, trip: null, places: [], tripPlaces: [],
  activities: [], completions: [], currentPlace: null, activityFilter: "all",
  map: null, miniMap: null, markers: [], miniMarkers: []
};
const viewNames = {
  overview: "Resumen", places: "Lugares", map: "Mapa interactivo",
  detail: "Detalle del lugar", activities: "Actividades", progress: "Mi recorrido",
  admin: "Administración"
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function toast(message, isError = false) {
  const el = $("#toast");
  el.textContent = message;
  el.className = "toast show" + (isError ? " error" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.className = "toast", 3600);
}
function initials(name = "Estudiante") {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "E";
}
function isAdmin() { return state.profile?.role === "admin"; }
function currentTripId() { return state.trip?.id || null; }
function orderedPlaces() {
  const order = new Map(state.tripPlaces.map(item => [item.place_id, item.visit_order]));
  return state.places.filter(place => order.has(place.id))
    .sort((a, b) => order.get(a.id) - order.get(b.id));
}
function activityPlaceName(activity) {
  return state.places.find(place => place.id === activity.place_id)?.name || "Actividad general";
}
function isCompleted(activityId) {
  return state.completions.some(item => item.activity_id === activityId);
}
function completionFor(activityId) {
  return state.completions.find(item => item.activity_id === activityId);
}
function showAuth(mode = "login") {
  const signup = mode === "signup";
  $("#login-form").classList.toggle("hidden", signup);
  $("#signup-form").classList.toggle("hidden", !signup);
  $("#auth-title").textContent = signup ? "Creá tu cuenta" : "Ingresá a tu cuenta";
  $("#auth-eyebrow").textContent = signup ? "SUMATE A LA EXPERIENCIA" : "TU ESPACIO EDUCATIVO";
  $("#auth-subtitle").textContent = signup ? "Registrate para acceder a los lugares y actividades." : "Continuá con el recorrido de tu salida educativa.";
  $("#auth-switch").innerHTML = signup
    ? '¿Ya tenés cuenta? <button type="button" id="show-login">Iniciar sesión</button>'
    : '¿Todavía no tenés cuenta? <button type="button" id="show-signup">Crear una cuenta</button>';
  $("#show-login")?.addEventListener("click", () => showAuth("login"));
  $("#show-signup")?.addEventListener("click", () => showAuth("signup"));
}
function showApp() {
  $("#auth-screen").classList.add("hidden");
  $("#app-screen").classList.remove("hidden");
  $("#user-name").textContent = state.profile?.full_name || state.user?.email?.split("@")[0] || "Estudiante";
  $("#user-avatar").textContent = initials(state.profile?.full_name || state.user?.email || "E");
  $("#user-role").textContent = isAdmin() ? "Administrador" : "Estudiante";
  $$(".admin-only").forEach(el => el.classList.toggle("hidden", !isAdmin()));
}
function setView(name) {
  if (name === "admin" && !isAdmin()) return;
  $$(".view").forEach(view => view.classList.remove("active"));
  $("#view-" + name)?.classList.add("active");
  $$(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.view === name));
  $("#breadcrumb-current").textContent = viewNames[name] || "SchoolPool";
  $("#sidebar").classList.remove("open");
  if (name === "map") setTimeout(() => { initMainMap(); state.map?.invalidateSize(); fitMap(state.map, state.markers); }, 100);
  if (name === "overview") setTimeout(() => { initMiniMap(); state.miniMap?.invalidateSize(); fitMap(state.miniMap, state.miniMarkers); }, 100);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function loadData() {
  const uid = state.user.id;
  const results = await Promise.all([
    db.from("profiles").select("id,full_name,role").eq("id", uid).single(),
    db.from("trips").select("*").eq("status", "published").order("start_date", { ascending: true }),
    db.from("places").select("*").order("name"),
    db.from("trip_places").select("*").order("visit_order"),
    db.from("activities").select("*").order("created_at"),
    db.from("completions").select("*").eq("user_id", uid).order("completed_at", { ascending: false })
  ]);
  const labels = ["perfil", "salidas", "lugares", "paradas", "actividades", "registros"];
  const failed = results.findIndex(result => result.error);
  if (failed !== -1) {
    console.error("SchoolPool load error:", labels[failed], results[failed].error);
    throw new Error("No se pudieron cargar los datos (" + labels[failed] + "): " + results[failed].error.message);
  }
  state.profile = results[0].data;
  state.trip = results[1].data?.[0] || null;
  state.places = results[2].data || [];
  state.tripPlaces = results[3].data || [];
  state.activities = results[4].data || [];
  state.completions = results[5].data || [];
  showApp();
  renderAll();
}
function renderAll() {
  const trip = state.trip;
  $("#trip-title").textContent = trip?.title || "Todavía no hay una salida publicada";
  $("#trip-description").textContent = trip?.description || "Cuando se publique una salida, vas a encontrar acá toda la información.";
  const places = orderedPlaces();
  const activities = trip ? state.activities.filter(item => item.trip_id === trip.id) : [];
  $("#stat-places").textContent = places.length;
  $("#stat-activities").textContent = activities.length;
  $("#stat-completed").textContent = activities.filter(item => isCompleted(item.id)).length;
  $("#route-count").textContent = places.length + (places.length === 1 ? " parada" : " paradas");
  $("#map-place-count").textContent = places.length + " lugares";
  renderRoute(places);
  renderPlaceCards();
  renderMapList(places);
  renderActivityCards(activities);
  renderActivities();
  renderProgress(activities);
  populateAdminSelects();
  renderMapMarkers();
  renderMiniMarkers();
}
function renderRoute(places) {
  $("#route-list").innerHTML = places.length ? places.map((place, index) => `
    <div class="route-item"><span class="route-number">${index + 1}</span>
      <div><strong>${escapeHtml(place.name)}</strong><small>${escapeHtml(place.category)}</small></div>
      <button type="button" data-place="${place.id}" aria-label="Ver ${escapeHtml(place.name)}">→</button>
    </div>`).join("") : '<p class="muted">Todavía no hay paradas cargadas.</p>';
  $$("#route-list [data-place]").forEach(button => button.addEventListener("click", () => openPlace(button.dataset.place)));
}
function placeImage(place, className = "place-image") {
  const fallback = `<div class="${className}">${escapeHtml((place.name || "S").slice(0, 1).toUpperCase())}</div>`;
  if (!place.image_url) return fallback;
  return `<div class="${className}"><img src="${escapeHtml(place.image_url)}" alt="${escapeHtml(place.name)}" loading="lazy" onerror="this.parentElement.innerHTML='${(place.name || "S").slice(0,1)}'"></div>`;
}
function renderPlaceCards() {
  const search = ($("#place-search")?.value || "").toLowerCase().trim();
  const category = $("#category-filter")?.value || "";
  const places = orderedPlaces().filter(place =>
    (!search || (place.name + " " + place.description + " " + place.address).toLowerCase().includes(search)) &&
    (!category || place.category === category)
  );
  const categories = [...new Set(orderedPlaces().map(place => place.category))].sort();
  const select = $("#category-filter");
  if (select && select.dataset.loaded !== "yes") {
    select.innerHTML = '<option value="">Todas las categorías</option>' + categories.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
    select.dataset.loaded = "yes";
  }
  $("#places-grid").innerHTML = places.length ? places.map(place => `
    <article class="place-card" data-open-place="${place.id}" tabindex="0" role="button" aria-label="Ver ${escapeHtml(place.name)}">
      ${placeImage(place)}
      <div class="place-body"><span class="category-tag">${escapeHtml(place.category)}</span>
        <h3>${escapeHtml(place.name)}</h3><p>${escapeHtml(place.description)}</p>
        <div class="place-meta"><span>⌖ ${escapeHtml(place.address || "Ubicación en el mapa")}</span><span>Ver →</span></div>
      </div></article>`).join("") : '<div class="panel" style="padding:24px;grid-column:1/-1"><p class="muted">No encontramos lugares con esos filtros.</p></div>';
  $$("[data-open-place]").forEach(card => {
    const open = () => openPlace(card.dataset.openPlace);
    card.addEventListener("click", open);
    card.addEventListener("keydown", event => { if (event.key === "Enter") open(); });
  });
}
function renderMapList(places) {
  $("#map-place-list").innerHTML = places.map((place, index) => `
    <button class="map-place-item" type="button" data-map-place="${place.id}">
      <span class="route-number">${index + 1}</span><span><strong>${escapeHtml(place.name)}</strong><small>${escapeHtml(place.category)}</small></span>
    </button>`).join("") || '<p class="muted">No hay ubicaciones cargadas.</p>';
  $$("[data-map-place]").forEach(button => button.addEventListener("click", () => focusPlace(button.dataset.mapPlace)));
}
function renderActivityCards(activities) {
  const featured = activities.slice(0, 2);
  $("#featured-activities").innerHTML = featured.length ? featured.map(activity => `
    <article class="activity-card"><span class="status-tag ${isCompleted(activity.id) ? "done" : ""}">${isCompleted(activity.id) ? "Completada" : "Para realizar"}</span>
      <h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.description || activity.instructions)}</p>
      <div class="activity-card-foot"><small>${escapeHtml(activityPlaceName(activity))}</small><button class="text-link" data-go="activities">Ver actividad →</button></div>
    </article>`).join("") : '<div class="panel" style="padding:20px;grid-column:1/-1"><p class="muted">Todavía no hay actividades publicadas.</p></div>';
}
function renderActivities() {
  const activities = state.trip ? state.activities.filter(item => item.trip_id === state.trip.id) : [];
  const visible = activities.filter(item => state.activityFilter === "all" || (state.activityFilter === "done" ? isCompleted(item.id) : !isCompleted(item.id)));
  $("#activity-counter").textContent = activities.length + " actividades";
  $("#activities-list").innerHTML = visible.length ? visible.map(activity => {
    const done = isCompleted(activity.id);
    return `<article class="activity-row"><div><span class="status-tag ${done ? "done" : ""}">${done ? "✓ Completada" : "Pendiente"}</span>
      <h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.description)}</p><p style="margin-top:8px"><strong>Consigna:</strong> ${escapeHtml(activity.instructions)}</p><span class="activity-place">⌖ ${escapeHtml(activityPlaceName(activity))}</span></div>
      <button class="btn ${done ? "btn-primary" : "btn-dark"}" data-complete="${activity.id}" ${done ? "disabled" : ""}>${done ? "Registrada ✓" : "Registrar actividad →"}</button></article>`;
  }).join("") : '<div class="panel" style="padding:24px"><p class="muted">No hay actividades en esta categoría.</p></div>';
  $$("[data-complete]").forEach(button => button.addEventListener("click", () => openCompletion(button.dataset.complete)));
}
function renderProgress(activities) {
  const total = activities.length;
  const completed = activities.filter(item => isCompleted(item.id)).length;
  const percent = total ? Math.round(completed / total * 100) : 0;
  $("#progress-fraction").textContent = completed + " de " + total + " actividades";
  $("#progress-percent").textContent = percent + "%";
  $("#progress-ring").style.background = `conic-gradient(#4d9a78 ${percent * 3.6}deg,#e8efeb 0deg)`;
  $("#progress-bar").style.width = percent + "%";
  const records = state.completions.filter(record => activities.some(item => item.id === record.activity_id));
  $("#my-completions").innerHTML = records.length ? records.map(record => {
    const activity = activities.find(item => item.id === record.activity_id);
    return `<article class="completion-item"><div><strong>${escapeHtml(activity?.title || "Actividad")}</strong><p>${escapeHtml(record.notes || "Actividad registrada")} · ${new Date(record.completed_at).toLocaleDateString("es-AR")}</p></div><span class="status-tag done">Completada</span></article>`;
  }).join("") : '<div class="panel" style="padding:22px"><p class="muted">Todavía no registraste actividades. Cuando completes una, aparecerá acá.</p></div>';
}
function populateAdminSelects() {
  const options = orderedPlaces().map(place => `<option value="${place.id}">${escapeHtml(place.name)}</option>`).join("");
  $("#admin-activity-place").innerHTML = '<option value="">Actividad general de la salida</option>' + options;
}
function openPlace(id) {
  const place = state.places.find(item => item.id === id);
  if (!place) return;
  state.currentPlace = place;
  const activities = state.activities.filter(item => item.place_id === id);
  $("#place-detail").innerHTML = `
    <div class="detail-hero">
      ${placeImage(place, "detail-visual")}
      <div class="detail-info"><span class="category-tag">${escapeHtml(place.category)}</span><h1>${escapeHtml(place.name)}</h1>
        <p>${escapeHtml(place.description || "Todavía no hay una descripción para este lugar.")}</p>
        <div class="detail-address">⌖ <strong>Ubicación</strong><br>${escapeHtml(place.address || "Consultá el mapa para ver dónde se encuentra.")}</div>
        <div class="detail-actions"><button class="btn btn-primary" id="detail-map-btn">Ver en el mapa ↗</button>
        ${place.website_url ? `<a class="btn btn-dark" href="${escapeHtml(place.website_url)}" target="_blank" rel="noopener">Sitio web ↗</a>` : ""}</div>
      </div>
    </div>
    <div class="detail-activities"><div class="section-heading"><div><span class="eyebrow">APRENDER EN ESTE LUGAR</span><h2>Actividades relacionadas</h2></div></div>
    <div class="activities-list">${activities.length ? activities.map(activity => `
      <article class="activity-row"><div><span class="status-tag ${isCompleted(activity.id) ? "done" : ""}">${isCompleted(activity.id) ? "Completada" : "Pendiente"}</span><h3>${escapeHtml(activity.title)}</h3><p>${escapeHtml(activity.description)}</p><p><strong>Consigna:</strong> ${escapeHtml(activity.instructions)}</p></div>
      <button class="btn btn-dark" data-detail-complete="${activity.id}" ${isCompleted(activity.id) ? "disabled" : ""}>${isCompleted(activity.id) ? "Registrada ✓" : "Registrar →"}</button></article>`).join("") : '<p class="muted">No hay actividades asociadas a este lugar todavía.</p>'}</div></div>`;
  $("#detail-map-btn").addEventListener("click", () => { setView("map"); setTimeout(() => focusPlace(id), 180); });
  $$("[data-detail-complete]").forEach(button => button.addEventListener("click", () => openCompletion(button.dataset.detailComplete)));
  setView("detail");
}
function initMainMap() {
  if (state.map || !window.L) return;
  state.map = L.map("main-map", { scrollWheelZoom: true }).setView([-34.6037, -58.3816], 12);
  addOsmTiles(state.map);
}
function initMiniMap() {
  if (state.miniMap || !window.L) return;
  state.miniMap = L.map("mini-map", { zoomControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false }).setView([-34.6037, -58.3816], 11);
  addOsmTiles(state.miniMap);
}
function addOsmTiles(map) {
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(map);
}
function clearMarkers(markers) { markers.forEach(marker => marker.remove()); markers.length = 0; }
function renderMapMarkers() {
  if (!state.map) return;
  clearMarkers(state.markers);
  orderedPlaces().forEach((place, index) => {
    const marker = L.marker([place.latitude, place.longitude]).addTo(state.map);
    marker.bindPopup(`<div class="map-popup"><strong>${escapeHtml(place.name)}</strong><br><small>${escapeHtml(place.category)}</small><br><button type="button" onclick="window.schoolPoolOpenPlace('${place.id}')">Ver información</button></div>`);
    state.markers.push(marker);
  });
  fitMap(state.map, state.markers);
}
function renderMiniMarkers() {
  if (!state.miniMap) return;
  clearMarkers(state.miniMarkers);
  orderedPlaces().forEach(place => {
    const marker = L.circleMarker([place.latitude, place.longitude], { radius: 6, color: "#276a55", fillColor: "#68ad8c", fillOpacity: .9, weight: 2 }).addTo(state.miniMap);
    marker.bindPopup(escapeHtml(place.name));
    state.miniMarkers.push(marker);
  });
  fitMap(state.miniMap, state.miniMarkers);
}
function fitMap(map, markers) {
  if (!map || !markers.length) return;
  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(.18), { maxZoom: 14 });
}
function focusPlace(id) {
  const place = state.places.find(item => item.id === id);
  if (!place) return;
  setView("map");
  setTimeout(() => {
    state.map?.setView([place.latitude, place.longitude], 16);
    const index = orderedPlaces().findIndex(item => item.id === id);
    if (index >= 0) state.markers[index]?.openPopup();
  }, 140);
}
window.schoolPoolOpenPlace = openPlace;

function openCompletion(activityId) {
  const activity = state.activities.find(item => item.id === activityId);
  if (!activity) return;
  $("#completion-activity-id").value = activityId;
  $("#modal-title").textContent = activity.title;
  $("#modal-description").textContent = activity.instructions || activity.description;
  $("#completion-notes").value = "";
  $("#completion-modal").classList.remove("hidden");
}
function closeCompletion() { $("#completion-modal").classList.add("hidden"); }

async function signIn(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const { error } = await db.auth.signInWithPassword({
    email: $("#login-email").value.trim(),
    password: $("#login-password").value
  });
  button.disabled = false;
  if (error) toast(error.message, true);
}
async function signUp(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const { data, error } = await db.auth.signUp({
    email: $("#signup-email").value.trim(),
    password: $("#signup-password").value,
    options: { data: { full_name: $("#signup-name").value.trim() } }
  });
  button.disabled = false;
  if (error) return toast(error.message, true);
  if (data.session) toast("Cuenta creada. Ya podés empezar.");
  else toast("Cuenta creada. Revisá tu correo para confirmar el registro antes de iniciar sesión.");
  showAuth("login");
}
async function saveCompletion(event) {
  event.preventDefault();
  const activityId = $("#completion-activity-id").value;
  const notes = $("#completion-notes").value.trim();
  const { error } = await db.from("completions").upsert({
    activity_id: activityId, user_id: state.user.id, notes
  }, { onConflict: "activity_id,user_id" });
  if (error) return toast("No se pudo guardar el registro: " + error.message, true);
  closeCompletion();
  toast("Actividad registrada correctamente.");
  await loadData();
}
async function createPlace(event) {
  event.preventDefault();
  if (!isAdmin() || !currentTripId()) return toast("No hay una salida activa para asociar el lugar.", true);
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form).entries());
  const latitude = Number(data.latitude), longitude = Number(data.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return toast("Revisá las coordenadas.", true);
  const { data: place, error } = await db.from("places").insert({
    name: data.name.trim(), category: data.category, address: data.address.trim(),
    latitude, longitude, description: data.description.trim(),
    image_url: data.image_url.trim() || null, website_url: data.website_url.trim() || null
  }).select().single();
  if (error) return toast("No se pudo guardar el lugar: " + error.message, true);
  const { error: relationError } = await db.from("trip_places").insert({
    trip_id: currentTripId(), place_id: place.id, visit_order: Number(data.visit_order)
  });
  if (relationError) toast("El lugar se guardó, pero no se pudo agregar al recorrido: " + relationError.message, true);
  else toast("Lugar agregado al recorrido.");
  form.reset();
  await loadData();
}
async function createActivity(event) {
  event.preventDefault();
  if (!isAdmin() || !currentTripId()) return toast("No hay una salida activa.", true);
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  const { error } = await db.from("activities").insert({
    trip_id: currentTripId(), place_id: data.place_id || null,
    title: data.title.trim(), description: data.description.trim(), instructions: data.instructions.trim()
  });
  if (error) return toast("No se pudo guardar la actividad: " + error.message, true);
  toast("Actividad publicada.");
  event.currentTarget.reset();
  await loadData();
}
async function signOut() {
  const { error } = await db.auth.signOut();
  if (error) toast(error.message, true);
}

function bindEvents() {
  $("#login-form").addEventListener("submit", signIn);
  $("#signup-form").addEventListener("submit", signUp);
  $("#completion-form").addEventListener("submit", saveCompletion);
  $("#modal-close").addEventListener("click", closeCompletion);
  $("#completion-modal").addEventListener("click", event => { if (event.target.id === "completion-modal") closeCompletion(); });
  $("#logout-btn").addEventListener("click", signOut);
  $("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  $("#place-search").addEventListener("input", renderPlaceCards);
  $("#category-filter").addEventListener("change", renderPlaceCards);
  $("#admin-place-form").addEventListener("submit", createPlace);
  $("#admin-activity-form").addEventListener("submit", createActivity);
  $("#activity-filters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.activityFilter = button.dataset.filter;
    $$("#activity-filters .filter-pill").forEach(item => item.classList.toggle("active", item === button));
    renderActivities();
  });
  document.addEventListener("click", event => {
    const nav = event.target.closest("[data-view]");
    const go = event.target.closest("[data-go]");
    if (nav) setView(nav.dataset.view);
    if (go) setView(go.dataset.go);
  });
}
bindEvents();
showAuth("login");

db.auth.onAuthStateChange(async (_event, session) => {
  if (!session?.user) {
    state.user = null;
    state.profile = null;
    $("#app-screen").classList.add("hidden");
    $("#auth-screen").classList.remove("hidden");
    return;
  }
  state.user = session.user;
  try {
    await loadData();
    setView("overview");
  } catch (error) {
    console.error(error);
    toast(error.message || "Error al cargar SchoolPool.", true);
  }
});
