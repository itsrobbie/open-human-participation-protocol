// node_modules/openapi-fetch/dist/index.js
var DEFAULT_HEADERS = {
  "Content-Type": "application/json"
};
var PATH_PARAM_RE = /\{[^{}]+\}/g;
var CustomRequest = class extends Request {
  constructor(input, init) {
    super(input, init);
    for (const key in init) {
      if (!(key in this)) {
        this[key] = init[key];
      }
    }
  }
};
function randomID() {
  return Math.random().toString(36).slice(2, 11);
}
function createClient(clientOptions) {
  let {
    baseUrl = "",
    fetch: baseFetch = globalThis.fetch,
    querySerializer: globalQuerySerializer,
    bodySerializer: globalBodySerializer,
    headers: baseHeaders,
    ...baseOptions
  } = { ...clientOptions };
  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.substring(0, baseUrl.length - 1);
  }
  baseHeaders = mergeHeaders(DEFAULT_HEADERS, baseHeaders);
  const middlewares = [];
  async function coreFetch(schemaPath, fetchOptions) {
    const {
      fetch: fetch2 = baseFetch,
      headers,
      params = {},
      parseAs = "json",
      querySerializer: requestQuerySerializer,
      bodySerializer = globalBodySerializer ?? defaultBodySerializer,
      ...init
    } = fetchOptions || {};
    let querySerializer = typeof globalQuerySerializer === "function" ? globalQuerySerializer : createQuerySerializer(globalQuerySerializer);
    if (requestQuerySerializer) {
      querySerializer = typeof requestQuerySerializer === "function" ? requestQuerySerializer : createQuerySerializer({
        ...typeof globalQuerySerializer === "object" ? globalQuerySerializer : {},
        ...requestQuerySerializer
      });
    }
    const requestInit = {
      redirect: "follow",
      ...baseOptions,
      ...init,
      headers: mergeHeaders(baseHeaders, headers, params.header)
    };
    if (requestInit.body) {
      requestInit.body = bodySerializer(requestInit.body);
      if (requestInit.body instanceof FormData) {
        requestInit.headers.delete("Content-Type");
      }
    }
    let id;
    let options;
    let request = new CustomRequest(createFinalURL(schemaPath, { baseUrl, params, querySerializer }), requestInit);
    if (middlewares.length) {
      id = randomID();
      options = Object.freeze({
        baseUrl,
        fetch: fetch2,
        parseAs,
        querySerializer,
        bodySerializer
      });
      for (const m of middlewares) {
        if (m && typeof m === "object" && typeof m.onRequest === "function") {
          const result = await m.onRequest({
            request,
            schemaPath,
            params,
            options,
            id
          });
          if (result) {
            if (!(result instanceof Request)) {
              throw new Error("onRequest: must return new Request() when modifying the request");
            }
            request = result;
          }
        }
      }
    }
    let response = await fetch2(request);
    if (middlewares.length) {
      for (let i = middlewares.length - 1; i >= 0; i--) {
        const m = middlewares[i];
        if (m && typeof m === "object" && typeof m.onResponse === "function") {
          const result = await m.onResponse({
            request,
            response,
            schemaPath,
            params,
            options,
            id
          });
          if (result) {
            if (!(result instanceof Response)) {
              throw new Error("onResponse: must return new Response() when modifying the response");
            }
            response = result;
          }
        }
      }
    }
    if (response.status === 204 || response.headers.get("Content-Length") === "0") {
      return response.ok ? { data: {}, response } : { error: {}, response };
    }
    if (response.ok) {
      if (parseAs === "stream") {
        return { data: response.body, response };
      }
      return { data: await response[parseAs](), response };
    }
    let error = await response.text();
    try {
      error = JSON.parse(error);
    } catch {
    }
    return { error, response };
  }
  return {
    /** Call a GET endpoint */
    GET(url, init) {
      return coreFetch(url, { ...init, method: "GET" });
    },
    /** Call a PUT endpoint */
    PUT(url, init) {
      return coreFetch(url, { ...init, method: "PUT" });
    },
    /** Call a POST endpoint */
    POST(url, init) {
      return coreFetch(url, { ...init, method: "POST" });
    },
    /** Call a DELETE endpoint */
    DELETE(url, init) {
      return coreFetch(url, { ...init, method: "DELETE" });
    },
    /** Call a OPTIONS endpoint */
    OPTIONS(url, init) {
      return coreFetch(url, { ...init, method: "OPTIONS" });
    },
    /** Call a HEAD endpoint */
    HEAD(url, init) {
      return coreFetch(url, { ...init, method: "HEAD" });
    },
    /** Call a PATCH endpoint */
    PATCH(url, init) {
      return coreFetch(url, { ...init, method: "PATCH" });
    },
    /** Call a TRACE endpoint */
    TRACE(url, init) {
      return coreFetch(url, { ...init, method: "TRACE" });
    },
    /** Register middleware */
    use(...middleware) {
      for (const m of middleware) {
        if (!m) {
          continue;
        }
        if (typeof m !== "object" || !("onRequest" in m || "onResponse" in m)) {
          throw new Error("Middleware must be an object with one of `onRequest()` or `onResponse()`");
        }
        middlewares.push(m);
      }
    },
    /** Unregister middleware */
    eject(...middleware) {
      for (const m of middleware) {
        const i = middlewares.indexOf(m);
        if (i !== -1) {
          middlewares.splice(i, 1);
        }
      }
    }
  };
}
function serializePrimitiveParam(name, value, options) {
  if (value === void 0 || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error(
      "Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these."
    );
  }
  return `${name}=${options?.allowReserved === true ? value : encodeURIComponent(value)}`;
}
function serializeObjectParam(name, value, options) {
  if (!value || typeof value !== "object") {
    return "";
  }
  const values = [];
  const joiner = {
    simple: ",",
    label: ".",
    matrix: ";"
  }[options.style] || "&";
  if (options.style !== "deepObject" && options.explode === false) {
    for (const k in value) {
      values.push(k, options.allowReserved === true ? value[k] : encodeURIComponent(value[k]));
    }
    const final2 = values.join(",");
    switch (options.style) {
      case "form": {
        return `${name}=${final2}`;
      }
      case "label": {
        return `.${final2}`;
      }
      case "matrix": {
        return `;${name}=${final2}`;
      }
      default: {
        return final2;
      }
    }
  }
  for (const k in value) {
    const finalName = options.style === "deepObject" ? `${name}[${k}]` : k;
    values.push(serializePrimitiveParam(finalName, value[k], options));
  }
  const final = values.join(joiner);
  return options.style === "label" || options.style === "matrix" ? `${joiner}${final}` : final;
}
function serializeArrayParam(name, value, options) {
  if (!Array.isArray(value)) {
    return "";
  }
  if (options.explode === false) {
    const joiner2 = { form: ",", spaceDelimited: "%20", pipeDelimited: "|" }[options.style] || ",";
    const final = (options.allowReserved === true ? value : value.map((v) => encodeURIComponent(v))).join(joiner2);
    switch (options.style) {
      case "simple": {
        return final;
      }
      case "label": {
        return `.${final}`;
      }
      case "matrix": {
        return `;${name}=${final}`;
      }
      default: {
        return `${name}=${final}`;
      }
    }
  }
  const joiner = { simple: ",", label: ".", matrix: ";" }[options.style] || "&";
  const values = [];
  for (const v of value) {
    if (options.style === "simple" || options.style === "label") {
      values.push(options.allowReserved === true ? v : encodeURIComponent(v));
    } else {
      values.push(serializePrimitiveParam(name, v, options));
    }
  }
  return options.style === "label" || options.style === "matrix" ? `${joiner}${values.join(joiner)}` : values.join(joiner);
}
function createQuerySerializer(options) {
  return function querySerializer(queryParams) {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === void 0 || value === null) {
          continue;
        }
        if (Array.isArray(value)) {
          search.push(
            serializeArrayParam(name, value, {
              style: "form",
              explode: true,
              ...options?.array,
              allowReserved: options?.allowReserved || false
            })
          );
          continue;
        }
        if (typeof value === "object") {
          search.push(
            serializeObjectParam(name, value, {
              style: "deepObject",
              explode: true,
              ...options?.object,
              allowReserved: options?.allowReserved || false
            })
          );
          continue;
        }
        search.push(serializePrimitiveParam(name, value, options));
      }
    }
    return search.join("&");
  };
}
function defaultPathSerializer(pathname, pathParams) {
  let nextURL = pathname;
  for (const match of pathname.match(PATH_PARAM_RE) ?? []) {
    let name = match.substring(1, match.length - 1);
    let explode = false;
    let style = "simple";
    if (name.endsWith("*")) {
      explode = true;
      name = name.substring(0, name.length - 1);
    }
    if (name.startsWith(".")) {
      style = "label";
      name = name.substring(1);
    } else if (name.startsWith(";")) {
      style = "matrix";
      name = name.substring(1);
    }
    if (!pathParams || pathParams[name] === void 0 || pathParams[name] === null) {
      continue;
    }
    const value = pathParams[name];
    if (Array.isArray(value)) {
      nextURL = nextURL.replace(match, serializeArrayParam(name, value, { style, explode }));
      continue;
    }
    if (typeof value === "object") {
      nextURL = nextURL.replace(match, serializeObjectParam(name, value, { style, explode }));
      continue;
    }
    if (style === "matrix") {
      nextURL = nextURL.replace(match, `;${serializePrimitiveParam(name, value)}`);
      continue;
    }
    nextURL = nextURL.replace(match, style === "label" ? `.${encodeURIComponent(value)}` : encodeURIComponent(value));
  }
  return nextURL;
}
function defaultBodySerializer(body) {
  if (body instanceof FormData) {
    return body;
  }
  return JSON.stringify(body);
}
function createFinalURL(pathname, options) {
  let finalURL = `${options.baseUrl}${pathname}`;
  if (options.params?.path) {
    finalURL = defaultPathSerializer(finalURL, options.params.path);
  }
  let search = options.querySerializer(options.params.query ?? {});
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    finalURL += `?${search}`;
  }
  return finalURL;
}
function mergeHeaders(...allHeaders) {
  const finalHeaders = new Headers();
  for (const h of allHeaders) {
    if (!h || typeof h !== "object") {
      continue;
    }
    const iterator = h instanceof Headers ? h.entries() : Object.entries(h);
    for (const [k, v] of iterator) {
      if (v === null) {
        finalHeaders.delete(k);
      } else if (Array.isArray(v)) {
        for (const v2 of v) {
          finalHeaders.append(k, v2);
        }
      } else if (v !== void 0) {
        finalHeaders.set(k, v);
      }
    }
  }
  return finalHeaders;
}

// src/app.ts
var token = sessionStorage.getItem("ohpp-insurance-token");
var currentClaims = [];
var policiesById = /* @__PURE__ */ new Map();
var element = (id) => document.getElementById(id);
var scenarios = [
  ["SelectDisposition", "Select next action"],
  ["AffectedItems", "Confirm affected items"],
  ["ClaimantNote", "Add claimant note"],
  ["EstimatedAmount", "Confirm estimated amount"],
  ["IncidentDate", "Confirm incident date"],
  ["AdjusterAppointment", "Choose adjuster appointment"],
  ["ClaimantDeclaration", "Sign claimant declaration"]
];
var apiFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : void 0));
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 || response.status === 403) {
    signOut("Your Insurance Claims session has expired. Please sign in again.");
  }
  return response;
};
var client = createClient({ baseUrl: "", fetch: apiFetch });
async function signIn(username, password) {
  const { data: config, error } = await client.GET("/.well-known/ohpp/auth-config");
  if (!config) throw new Error(readableError(error, "Could not load sign-in configuration"));
  if (!config.authority || !config.clientId) throw new Error("Sign-in configuration is incomplete");
  const body = new URLSearchParams({
    client_id: config.clientId,
    grant_type: "password",
    username,
    password
  });
  const response = await fetch(`${config.authority}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) throw new Error("Invalid demo credentials");
  token = (await response.json()).access_token;
  sessionStorage.setItem("ohpp-insurance-token", token);
}
function showApp() {
  element("login").hidden = true;
  element("app").hidden = false;
  showPage(routeFromHash());
}
function signOut(message = "") {
  token = null;
  sessionStorage.removeItem("ohpp-insurance-token");
  element("app").hidden = true;
  element("login").hidden = false;
  element("login-result").textContent = message;
}
element("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const result = element("login-result");
  result.textContent = "";
  try {
    await signIn(
      element("username").value,
      element("password").value
    );
    showApp();
    await loadWorkspace();
  } catch (error) {
    result.textContent = error instanceof Error ? error.message : "Could not sign in";
  }
});
element("logout-button").addEventListener("click", () => signOut());
var pages = Array.from(document.querySelectorAll("[data-page]"));
var validRoutes = new Set(pages.map((page) => page.dataset.page));
function routeFromHash() {
  const requested = window.location.hash.slice(1);
  return validRoutes.has(requested) ? requested : "dashboard";
}
function showPage(route) {
  const selected = validRoutes.has(route) ? route : "dashboard";
  for (const page of pages) page.hidden = page.dataset.page !== selected;
  for (const link of Array.from(document.querySelectorAll("[data-route]"))) {
    if (link.dataset.route === selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", () => showPage(routeFromHash()));
for (const button of Array.from(document.querySelectorAll("[data-route-button]"))) {
  button.addEventListener("click", () => {
    window.location.hash = button.dataset.routeButton;
  });
}
async function loadWorkspace() {
  await loadPolicies();
  await Promise.all([loadClaims(), loadConnectionStatus()]);
}
async function loadPolicies() {
  const { data: policies, error } = await client.GET("/api/policies");
  if (!policies) {
    element("policy-summary").textContent = readableError(error, "Could not load policy.");
    return;
  }
  policiesById.clear();
  for (const policy2 of policies) policiesById.set(policy2.id, policy2);
  const policySelect = element("policy");
  policySelect.replaceChildren();
  for (const policy2 of policies) {
    const option = document.createElement("option");
    option.value = policy2.id;
    option.textContent = `${policy2.policyNumber} - ${policy2.status}`;
    policySelect.append(option);
  }
  const summary = element("policy-summary");
  if (policies.length === 0) {
    summary.textContent = "No active policies";
    return;
  }
  const policy = policies[0];
  summary.innerHTML = `${escapeHtml(policy.policyNumber)}<br><span style="font-size:.85rem; font-weight:400;">${formatMoney(policy.coverageLimit)} coverage - ${escapeHtml(policy.status)}</span>`;
}
async function loadClaims() {
  const { data: claims, error } = await client.GET("/api/claims");
  if (!claims) {
    element("claims-result").textContent = readableError(error, "Could not load claims.");
    return;
  }
  currentClaims = claims;
  updateDashboardStats();
  renderClaims();
  renderRecentClaims();
}
function updateDashboardStats() {
  const total = currentClaims.length;
  const pending = currentClaims.filter((c) => c.status === "AwaitingParticipation").length;
  const drafts = currentClaims.filter((c) => c.status === "Draft").length;
  const approved = currentClaims.filter((c) => c.status === "ApprovedForNextStep").length;
  const noun = total === 1 ? "claim" : "claims";
  element("claim-summary").innerHTML = `<strong>${total} total ${noun}</strong><br><span class="muted">${pending} awaiting participation</span>`;
  const stats = element("dashboard-stats");
  stats.innerHTML = `
    <div class="stat"><strong>${drafts}</strong><small>Drafts</small></div>
    <div class="stat"><strong>${pending}</strong><small>Awaiting</small></div>
    <div class="stat"><strong>${approved}</strong><small>Approved</small></div>
    <div class="stat"><strong>${total}</strong><small>Total</small></div>
  `;
}
function renderRecentClaims() {
  const container = element("recent-claims");
  const recent = currentClaims.slice(0, 3);
  if (recent.length === 0) {
    container.innerHTML = '<p class="muted">No claims yet. Submit your first claim to get started.</p>';
    return;
  }
  container.replaceChildren();
  for (const claim of recent) {
    const item = document.createElement("div");
    item.style.cssText = "padding:.8rem 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; align-items:center; gap:1rem;";
    const statusClass = claim.status.toLowerCase();
    item.innerHTML = `
      <div>
        <strong style="font-size:.92rem;">${escapeHtml(claim.claimNumber)}</strong>
        <p style="margin:.2rem 0 0; font-size:.82rem; color:var(--muted);">${escapeHtml(claim.description).slice(0, 60)}${claim.description.length > 60 ? "..." : ""}</p>
      </div>
      <span class="claim-status status-${statusClass}">${escapeHtml(claim.status)}</span>
    `;
    container.append(item);
  }
}
function renderClaims() {
  const filter = element("claim-status-filter").value;
  const claims = filter === "All" ? currentClaims : currentClaims.filter((c) => c.status === filter);
  const container = element("claims");
  const emptyEl = element("claims-empty");
  container.replaceChildren();
  emptyEl.hidden = claims.length > 0 || currentClaims.length === 0;
  if (currentClaims.length === 0) {
    container.innerHTML = '<p class="muted">No claims yet.</p>';
    return;
  }
  for (const claim of claims) container.append(createClaimCard(claim));
}
function createClaimCard(claim) {
  const card = document.createElement("article");
  card.className = "claim-card";
  card.dataset.testid = `claim-${claim.id}`;
  const statusClass = claim.status.toLowerCase();
  card.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:start; gap:1rem; flex-wrap:wrap;">
      <h3>${escapeHtml(claim.claimNumber)}</h3>
      <span class="claim-status status-${statusClass}">Status: ${escapeHtml(claim.status)}</span>
    </div>
    <p style="color:var(--muted); font-size:.88rem; margin:.4rem 0 .8rem;">${escapeHtml(claim.description)}</p>
  `;
  const meta = document.createElement("div");
  meta.className = "claim-meta";
  appendMeta(meta, "Policy", policiesById.get(claim.policyId)?.policyNumber ?? claim.policyId);
  appendMeta(meta, "Claimant", claim.claimantName);
  appendMeta(meta, "Incident", formatDate(claim.incidentDate));
  appendMeta(meta, "Incident time", formatDateTime(claim.incidentAt));
  appendMeta(meta, "Estimate", formatMoney(claim.estimatedAmount));
  card.append(meta);
  for (const note of claim.notes) appendAnswerTag(card, `Note: ${note.body}`);
  if (claim.affectedItems.length) appendAnswerTag(card, `Affected items: ${claim.affectedItems.join(", ")}`);
  if (claim.status === "Submitted") {
    const actions = document.createElement("div");
    actions.style.cssText = "display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; margin-top:1rem;";
    const select = document.createElement("select");
    select.setAttribute("aria-label", `Participation scenario for ${claim.claimNumber}`);
    select.dataset.testid = `participation-scenario-${claim.id}`;
    for (const [value, label] of scenarios) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = label;
      select.append(option);
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Request human participation";
    button.dataset.testid = `request-participation-${claim.id}`;
    button.addEventListener("click", async () => {
      const { error } = await client.POST("/api/claims/{id}/participation", {
        params: {
          path: { id: claim.id },
          query: { scenario: select.value }
        }
      });
      if (error) {
        showStatus(card, readableError(error, "Could not request participation."), "error");
        return;
      }
      await loadClaims();
      void pollClaimStatus(claim.id);
    });
    actions.append(select, button);
    card.append(actions);
  } else if (claim.status === "Draft") {
    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "Submit draft";
    submit.dataset.testid = `submit-draft-${claim.id}`;
    submit.style.marginTop = "1rem";
    submit.addEventListener("click", async () => {
      const { data, error } = await client.POST("/api/claims/{id}/submit", {
        params: { path: { id: claim.id } }
      });
      if (!data) showStatus(card, readableError(error, "Could not submit draft."), "error");
      else await loadClaims();
    });
    card.append(submit);
  } else if (claim.status === "AwaitingParticipation") {
    const refresh = document.createElement("button");
    refresh.type = "button";
    refresh.textContent = "Refresh participation status";
    refresh.className = "secondary";
    refresh.dataset.testid = `refresh-participation-${claim.id}`;
    refresh.style.marginTop = "1rem";
    refresh.addEventListener("click", () => void refreshClaimStatus(claim.id));
    card.append(refresh);
  }
  if (claim.selectedOption) appendAnswerTag(card, `Answer: ${claim.selectedOption}`);
  else if (claim.selectedOptions?.length) appendAnswerTag(card, `Answers: ${claim.selectedOptions.join(", ")}`);
  else if (claim.answerValue) appendAnswerTag(card, `Answer: ${claim.answerValue}`);
  const timeline = document.createElement("section");
  timeline.className = "timeline";
  timeline.innerHTML = `
    <strong>Timeline</strong>
    <p>${claim.status === "Draft" ? "Draft saved" : "Created"} ${formatDateTime(claim.createdAt)}</p>
    <p>Last updated ${formatDateTime(claim.updatedAt)}</p>
    ${claim.participationRequestId ? `<p>Participation request ${claim.participationRequestId}</p>` : ""}
  `;
  card.append(timeline);
  return card;
}
function appendMeta(container, label, value) {
  if (!value) return;
  const item = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = label;
  item.append(strong, " ", value);
  container.append(item);
}
function appendAnswerTag(card, text) {
  const tag = document.createElement("span");
  tag.className = "answer-tag";
  tag.textContent = text;
  card.append(tag);
}
function showStatus(container, message, type) {
  let el = container.querySelector(".status");
  if (!el) {
    el = document.createElement("p");
    container.append(el);
  }
  el.className = `status ${type}`;
  el.textContent = message;
}
element("claim-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  await submitClaim(false);
});
element("save-draft").addEventListener("click", async () => {
  await submitClaim(true);
});
async function submitClaim(isDraft) {
  const result = element("claim-result");
  result.className = "";
  result.textContent = "";
  const body = getClaimFormData();
  const { data, error } = await (isDraft ? client.POST("/api/claims/drafts", { body }) : client.POST("/api/claims", { body }));
  if (!data) {
    result.className = "status error";
    result.textContent = readableError(error, "Could not submit claim.");
    return;
  }
  result.className = "status success";
  result.textContent = isDraft ? "Draft saved successfully." : `Claim ${data.claimNumber} submitted successfully.`;
  element("claim-form").reset();
  element("claimant").value = "Demo User";
  await loadClaims();
}
function getClaimFormData() {
  const affectedItems = [];
  if (element("affected-building").checked) affectedItems.push("Building");
  if (element("affected-contents").checked) affectedItems.push("Contents");
  if (element("affected-accommodation").checked) affectedItems.push("Temporary accommodation");
  const note = element("claimant-note").value.trim();
  return {
    policyId: element("policy").value,
    claimantName: element("claimant").value,
    incidentDate: element("date").value,
    incidentAt: element("incident-at").value || void 0,
    description: element("description").value,
    affectedItems,
    estimatedAmount: parseFloat(element("amount").value),
    claimantNote: note || void 0
  };
}
async function refreshClaimStatus(claimId) {
  const { data: claim, error } = await client.GET("/api/claims/{id}/participation/status", {
    params: { path: { id: claimId } }
  });
  if (!claim) {
    element("claims-result").textContent = readableError(error, "Could not refresh participation status.");
    return null;
  }
  await loadClaims();
  return claim;
}
async function pollClaimStatus(claimId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2e3));
    const claim = await refreshClaimStatus(claimId);
    if (!claim || claim.status !== "AwaitingParticipation") return;
  }
  element("claims-result").textContent = "Timed out waiting for the participation response.";
}
async function loadConnectionStatus() {
  const { data: result, error } = await client.GET("/api/ohpp/status");
  if (!result) {
    element("ohpp-result").textContent = readableError(error, "Could not load the connection status.");
    return;
  }
  const status = element("ohpp-status");
  status.textContent = result.connected ? "Connected to the Resolver" : "Not connected to the Resolver";
  status.className = result.connected ? "success" : "muted";
  const badge = element("dashboard-ohpp-status");
  badge.textContent = result.connected ? "Connected" : "Not connected";
  badge.className = `badge ${result.connected ? "badge-connected" : "badge-disconnected"}`;
}
element("generate-challenge").addEventListener("click", async () => {
  const { data: challenge, error } = await client.POST("/api/ohpp/generate-challenge");
  if (!challenge) {
    element("ohpp-result").textContent = readableError(error, "Could not generate a registration challenge.");
    return;
  }
  element("challenge-uri").value = challenge.challengeUri;
  element("challenge-panel").hidden = false;
  element("ohpp-result").className = "status success";
  element("ohpp-result").textContent = 'Challenge ready. Copy and paste into the Portal "Connect App" page.';
});
element("copy-challenge").addEventListener("click", () => {
  const uri = element("challenge-uri").value;
  void navigator.clipboard.writeText(uri);
  element("ohpp-result").className = "status success";
  element("ohpp-result").textContent = "Challenge URI copied to clipboard.";
});
element("refresh-connection").addEventListener("click", async () => {
  await loadConnectionStatus();
  element("ohpp-result").className = "status success";
  element("ohpp-result").textContent = "Connection status refreshed.";
});
element("disconnect-ohpp").addEventListener("click", async () => {
  const { error } = await client.DELETE("/api/ohpp/disconnect");
  if (error) {
    element("ohpp-result").className = "status error";
    element("ohpp-result").textContent = readableError(error, "Could not revoke the connection.");
    return;
  }
  element("challenge-panel").hidden = true;
  element("ohpp-result").className = "status success";
  element("ohpp-result").textContent = "Resolver credentials revoked. Generate a new challenge to reconnect.";
  await loadConnectionStatus();
});
element("claim-status-filter").addEventListener("change", renderClaims);
function readableError(error, fallback) {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object") {
    const body = error;
    for (const key of ["error", "detail", "title"]) {
      if (typeof body[key] === "string" && body[key]) return body[key];
    }
  }
  return fallback;
}
function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}
function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(/* @__PURE__ */ new Date(`${value}T12:00:00Z`));
}
function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(date);
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
if (token) {
  showApp();
  void loadWorkspace();
}
