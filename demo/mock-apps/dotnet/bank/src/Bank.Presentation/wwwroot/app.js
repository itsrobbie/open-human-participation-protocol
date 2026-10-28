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
var accessToken = localStorage.getItem("ohpp-bank-access-token");
var apiFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : void 0));
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401 || response.status === 403) {
    signOut("Your Bank session has expired. Please sign in again.");
  }
  return response;
};
var client = createClient({ baseUrl: "", fetch: apiFetch });
var activeAccountId = "demo-account";
var accounts = [];
var transactions = [];
var loginCard = document.getElementById("login-card");
var bankApp = document.getElementById("bank-app");
var appNav = document.getElementById("app-nav");
var loginForm = document.getElementById("login-form");
var loginResult = document.getElementById("login-result");
async function signIn(username, password) {
  const { data: config } = await client.GET("/.well-known/ohpp/auth-config");
  if (!config?.authority || !config.clientId) throw new Error("Could not load sign-in configuration");
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
  accessToken = (await response.json()).access_token;
  localStorage.setItem("ohpp-bank-access-token", accessToken);
}
function showAuthenticatedApp() {
  loginCard.hidden = true;
  bankApp.hidden = false;
  appNav.hidden = false;
  showBankPage(routeFromHash());
}
function signOut(message = "") {
  accessToken = null;
  localStorage.removeItem("ohpp-bank-access-token");
  loginCard.hidden = false;
  bankApp.hidden = true;
  loginResult.className = message ? "status error" : "";
  loginResult.textContent = message;
}
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginResult.className = "status pending";
  loginResult.textContent = "Signing in...";
  try {
    await signIn(
      document.getElementById("login-username").value,
      document.getElementById("login-password").value
    );
    showAuthenticatedApp();
    await loadWorkspace();
  } catch (error) {
    loginResult.className = "status error";
    loginResult.textContent = error instanceof Error ? error.message : "Could not sign in";
  }
});
var balanceEl = document.getElementById("balance");
var accountListEl = document.getElementById("account-list");
var activeAccountEl = document.getElementById("active-account");
var ohppStatusEl = document.getElementById("ohpp-status");
var payeeListEl = document.getElementById("payee-list");
var payeeSelectEl = document.getElementById("payee-select");
var transferForm = document.getElementById("transfer-form");
var amountInput = document.getElementById("amount");
var referenceInput = document.getElementById("reference");
var scheduleModeEl = document.getElementById("schedule-mode");
var scheduleDateEl = document.getElementById("schedule-date");
var scheduleDateTimeEl = document.getElementById("schedule-datetime");
var scheduleDateRowEl = document.getElementById("schedule-date-row");
var scheduleDateTimeRowEl = document.getElementById("schedule-datetime-row");
var transferResultEl = document.getElementById("transfer-result");
var ohppResultEl = document.getElementById("ohpp-result");
var transactionListEl = document.getElementById("transaction-list");
var recentActivityEl = document.getElementById("recent-activity");
var transactionSearchEl = document.getElementById("transaction-search");
var transactionStatusFilterEl = document.getElementById("transaction-status-filter");
var transferReviewEl = document.getElementById("transfer-review");
var confirmTransferEl = document.getElementById("confirm-transfer");
var cancelTransferEl = document.getElementById("cancel-transfer");
async function loadAccounts() {
  const { data } = await client.GET("/api/accounts");
  if (!data?.length) return;
  accounts = data;
  if (!accounts.some((account) => account.id === activeAccountId)) activeAccountId = accounts[0].id;
  accountListEl.replaceChildren();
  activeAccountEl.replaceChildren();
  for (const account of accounts) {
    const card = document.createElement("article");
    card.className = "account-card";
    const name = document.createElement("strong");
    name.textContent = account.name;
    const balance = document.createElement("p");
    balance.textContent = formatMoney(account.balance);
    const identifier = document.createElement("small");
    identifier.textContent = account.id;
    card.append(name, balance, identifier);
    accountListEl.append(card);
    const option = document.createElement("option");
    option.value = account.id;
    option.textContent = account.name;
    option.selected = account.id === activeAccountId;
    activeAccountEl.append(option);
  }
}
async function loadAccount() {
  const { data } = await client.GET("/api/accounts/{id}", {
    params: { path: { id: activeAccountId } }
  });
  if (!data) return;
  const account = data;
  balanceEl.textContent = formatMoney(account.balance);
  ohppStatusEl.replaceChildren();
  if (account.ohppRegistration) {
    const badge = document.createElement("span");
    badge.className = "ohpp-badge";
    badge.dataset.testid = "ohpp.bank.connected-badge";
    badge.textContent = "OHPP Connected";
    ohppStatusEl.append(badge, " Transfers require approval");
    generateBtn.textContent = "Generate new connection link";
    document.getElementById("ohpp-disconnect-section").style.display = "block";
  } else {
    const disconnected = document.createElement("span");
    disconnected.style.color = "#666";
    disconnected.dataset.testid = "ohpp.bank.disconnected-notice";
    disconnected.textContent = "OHPP not connected. Transfers execute immediately.";
    ohppStatusEl.append(disconnected);
    document.getElementById("ohpp-connect-section").removeAttribute("hidden");
    generateBtn.textContent = "Generate connection link";
    document.getElementById("ohpp-disconnect-section").style.display = "none";
  }
  payeeListEl.replaceChildren();
  payeeSelectEl.replaceChildren();
  for (const p of account.payees) {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = p.name;
    const details = document.createElement("span");
    details.style.color = "#888";
    details.style.fontSize = "0.85rem";
    details.textContent = `${p.sortCode} / ${p.accountNumber}`;
    item.append(name, details);
    payeeListEl.append(item);
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    payeeSelectEl.append(option);
  }
}
async function loadTransactions() {
  const { data } = await client.GET("/api/transactions", {
    params: { query: { accountId: activeAccountId } }
  });
  if (!data) return;
  transactions = data;
  renderTransactions();
}
function renderTransactions() {
  const search = transactionSearchEl.value.trim().toLowerCase();
  const statusFilter = transactionStatusFilterEl.value;
  const filtered = transactions.filter((transaction) => {
    const matchesSearch = !search || transaction.payeeName.toLowerCase().includes(search) || transaction.reference?.toLowerCase().includes(search);
    const matchesStatus = statusFilter === "All" || transaction.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  transactionListEl.replaceChildren();
  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.style.color = "#888";
    empty.style.fontSize = "0.85rem";
    empty.textContent = transactions.length === 0 ? "No transactions yet." : "No transactions match your filters.";
    transactionListEl.append(empty);
    return;
  }
  for (const txn of filtered) {
    const statusClass = txn.status.toLowerCase();
    const statusLabel = txn.status === "PendingApproval" ? "Pending" : txn.status;
    const time = new Date(txn.createdAt).toLocaleString();
    const ref = txn.reference ? ` \xB7 ${txn.reference}` : "";
    const item = document.createElement("div");
    item.className = "txn-item";
    const left = document.createElement("div");
    left.className = "txn-left";
    const payee = document.createElement("span");
    payee.className = "txn-payee";
    payee.textContent = txn.payeeName;
    const metadata = document.createElement("span");
    metadata.className = "txn-meta";
    const request = txn.participationRequestId ? ` \xB7 Request ${txn.participationRequestId}` : "";
    const scheduled = txn.scheduledFor ? ` \xB7 Scheduled ${new Date(txn.scheduledFor).toLocaleString()}` : "";
    metadata.textContent = `${time}${ref}${scheduled}${request}`;
    left.append(payee, metadata);
    const right = document.createElement("div");
    right.className = "txn-right";
    const amount = document.createElement("span");
    amount.className = "txn-amount";
    amount.textContent = `\xA3${txn.amount.toFixed(2)}`;
    const status = document.createElement("span");
    status.className = `txn-status ${statusClass}`;
    status.textContent = statusLabel;
    right.append(amount, status);
    item.append(left, right);
    transactionListEl.append(item);
  }
  const recentItems = Array.from(transactionListEl.children).slice(0, 5).map((child) => {
    const clone = child.cloneNode(true);
    clone.classList.remove("txn-item");
    clone.classList.add("recent-item");
    return clone;
  });
  recentActivityEl.replaceChildren(...recentItems);
}
var bankPages = Array.from(document.querySelectorAll("[data-bank-page]"));
var bankRoutes = new Set(bankPages.map((page) => page.dataset.bankPage));
var routeAliases = { account: "overview", transfer: "payments", history: "transactions", ohpp: "settings" };
function routeFromHash() {
  const requested = window.location.hash.slice(1);
  const resolved = routeAliases[requested] ?? requested;
  return bankRoutes.has(resolved) ? resolved : "overview";
}
function showBankPage(route) {
  const selectedRoute = bankRoutes.has(route) ? route : "overview";
  for (const page of bankPages) page.hidden = page.dataset.bankPage !== selectedRoute;
  for (const link of Array.from(document.querySelectorAll("[data-bank-route]"))) {
    if (link.dataset.bankRoute === selectedRoute) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}
window.addEventListener("hashchange", () => showBankPage(routeFromHash()));
for (const button of Array.from(document.querySelectorAll("[data-route-button]"))) {
  button.addEventListener("click", () => {
    window.location.hash = button.dataset.routeButton;
  });
}
async function loadWorkspace() {
  await loadAccounts();
  await loadTransactions();
  await loadAccount();
}
activeAccountEl.addEventListener("change", async () => {
  activeAccountId = activeAccountEl.value;
  transferReviewEl.hidden = true;
  pendingTransfer = null;
  await loadTransactions();
  await loadAccount();
});
transactionSearchEl.addEventListener("input", renderTransactions);
transactionStatusFilterEl.addEventListener("change", renderTransactions);
document.getElementById("add-payee-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = document.getElementById("payee-result");
  const { error } = await client.POST("/api/payees", {
    body: {
      accountId: activeAccountId,
      name: document.getElementById("payee-name").value,
      sortCode: document.getElementById("payee-sort-code").value,
      accountNumber: document.getElementById("payee-account-number").value
    }
  });
  if (error) {
    result.className = "status error";
    result.textContent = "Could not add payee.";
    return;
  }
  result.className = "status success";
  result.textContent = "Payee added.";
  form.reset();
  await loadAccount();
});
var pendingTransfer = null;
scheduleModeEl.addEventListener("change", () => {
  scheduleDateRowEl.hidden = scheduleModeEl.value !== "date";
  scheduleDateTimeRowEl.hidden = scheduleModeEl.value !== "datetime";
  scheduleDateEl.required = scheduleModeEl.value === "date";
  scheduleDateTimeEl.required = scheduleModeEl.value === "datetime";
});
transferForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payeeId = payeeSelectEl.value;
  const amount = parseFloat(amountInput.value);
  const reference = referenceInput.value;
  const scheduleValue = scheduleModeEl.value === "date" ? scheduleDateEl.value ? `${scheduleDateEl.value}T09:00:00` : "" : scheduleModeEl.value === "datetime" ? scheduleDateTimeEl.value : "";
  const scheduledFor = scheduleValue ? new Date(scheduleValue).toISOString() : void 0;
  pendingTransfer = { payeeId, amount, reference, scheduledFor };
  document.getElementById("review-account").textContent = accounts.find((account) => account.id === activeAccountId)?.name ?? activeAccountId;
  document.getElementById("review-payee").textContent = payeeSelectEl.selectedOptions[0]?.textContent ?? payeeId;
  document.getElementById("review-amount").textContent = formatMoney(amount);
  document.getElementById("review-reference").textContent = reference || "No reference";
  document.getElementById("review-schedule").textContent = scheduledFor ? new Date(scheduledFor).toLocaleString() : "Immediately";
  transferReviewEl.hidden = false;
  confirmTransferEl.focus();
});
confirmTransferEl.addEventListener("click", async () => {
  if (!pendingTransfer) return;
  const { payeeId, amount, reference, scheduledFor } = pendingTransfer;
  transferResultEl.style.display = "block";
  transferResultEl.className = "status pending";
  transferResultEl.textContent = "Processing...";
  const { data, error, response } = await client.POST("/api/transfers", {
    params: {},
    body: { fromAccountId: activeAccountId, toPayeeId: payeeId, amount, reference, scheduledFor }
  });
  const result = data ?? error;
  if (result?.status === "Completed" || result?.status === 0) {
    transferResultEl.className = "status success";
    transferResultEl.textContent = "\u2713 Transfer completed.";
    await loadAccount();
    await loadTransactions();
  } else if (result?.status === "PendingApproval" || result?.status === 1) {
    transferResultEl.className = "status pending";
    transferResultEl.textContent = `\u23F3 Waiting for approval on your device... (Request ID: ${result.participationRequestId})`;
    await loadTransactions();
    if (result.participationRequestId) pollStatus(result.participationRequestId);
  } else if (result?.status === "Scheduled" || result?.status === 5) {
    transferResultEl.className = "status success";
    transferResultEl.textContent = "\u2713 Transfer scheduled.";
    await loadTransactions();
  } else {
    transferResultEl.className = "status error";
    transferResultEl.textContent = `\u2717 ${result?.error || result?.title || result?.detail || `HTTP ${response.status}`}`;
  }
  transferReviewEl.hidden = true;
  pendingTransfer = null;
});
cancelTransferEl.addEventListener("click", () => {
  transferReviewEl.hidden = true;
  pendingTransfer = null;
  amountInput.focus();
});
async function pollStatus(requestId) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2e3));
    const { data } = await client.GET("/api/transfers/{requestId}/status", {
      params: { path: { requestId }, query: { accountId: activeAccountId } }
    });
    const result = data;
    if (!result) continue;
    if (result.status === "Completed" || result.status === 0) {
      transferResultEl.className = "status success";
      transferResultEl.textContent = "\u2713 Transfer approved and completed.";
      await loadAccount();
      await loadTransactions();
      return;
    } else if (result.status === "Scheduled" || result.status === 5) {
      transferResultEl.className = "status success";
      transferResultEl.textContent = "\u2713 Transfer approved and scheduled.";
      await loadTransactions();
      return;
    } else if (result.status === "Denied" || result.status === 2) {
      transferResultEl.className = "status error";
      transferResultEl.textContent = "\u2717 Transfer denied by user.";
      loadTransactions();
      return;
    } else if (result.status === "Failed" || result.status === 3) {
      transferResultEl.className = "status error";
      transferResultEl.textContent = `\u2717 ${result.error || "Transfer failed"}`;
      loadTransactions();
      return;
    }
  }
  transferResultEl.className = "status error";
  transferResultEl.textContent = "\u2717 Timed out waiting for approval.";
}
var generateBtn = document.getElementById("generate-challenge-btn");
var challengeDisplay = document.getElementById("challenge-display");
var challengeUriEl = document.getElementById("challenge-uri");
var copyBtn = document.getElementById("copy-challenge");
var disconnectSection = document.getElementById("ohpp-disconnect-section");
var disconnectBtn = document.getElementById("disconnect-btn");
generateBtn.addEventListener("click", async () => {
  const { data } = await client.POST("/api/ohpp/generate-challenge", {
    body: { accountId: activeAccountId }
  });
  if (!data) return;
  challengeUriEl.value = data.challengeUri;
  challengeDisplay.style.display = "block";
  pollForConnection();
});
copyBtn.addEventListener("click", () => {
  challengeUriEl.select();
  navigator.clipboard.writeText(challengeUriEl.value);
  copyBtn.textContent = "Copied!";
  setTimeout(() => {
    copyBtn.textContent = "Copy to clipboard";
  }, 2e3);
});
disconnectBtn.addEventListener("click", async () => {
  await client.DELETE("/api/ohpp/disconnect", { params: { query: { accountId: activeAccountId } } });
  loadAccount();
  disconnectSection.style.display = "none";
});
async function pollForConnection() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3e3));
    const { data } = await client.GET("/api/accounts/{id}", {
      params: { path: { id: activeAccountId } }
    });
    const account = data;
    if (!account) continue;
    if (account.ohppRegistration) {
      ohppResultEl.style.display = "block";
      ohppResultEl.className = "status success";
      ohppResultEl.textContent = "\u2713 OHPP connected via registration ceremony!";
      challengeDisplay.style.display = "none";
      loadAccount();
      return;
    }
  }
}
var protocolScenarioEl = document.getElementById("protocol-scenario");
var createProtocolScenarioEl = document.getElementById("create-protocol-scenario");
var refreshProtocolScenarioEl = document.getElementById("refresh-protocol-scenario");
var protocolScenarioResultEl = document.getElementById("protocol-scenario-result");
var protocolScenarioRequestId = null;
createProtocolScenarioEl.addEventListener("click", async () => {
  protocolScenarioResultEl.className = "status pending";
  protocolScenarioResultEl.textContent = "Creating participation request...";
  const { data, error } = await client.POST("/api/ohpp/scenarios/{scenario}", {
    params: { path: { scenario: protocolScenarioEl.value } },
    body: { accountId: activeAccountId }
  });
  if (!data || error) {
    protocolScenarioResultEl.className = "status error";
    protocolScenarioResultEl.textContent = "Could not create the protocol scenario. Connect OHPP first.";
    return;
  }
  protocolScenarioRequestId = data.requestId ?? null;
  protocolScenarioResultEl.className = "status pending";
  protocolScenarioResultEl.textContent = `Awaiting human participation. Request ${protocolScenarioRequestId}`;
  refreshProtocolScenarioEl.hidden = false;
});
refreshProtocolScenarioEl.addEventListener("click", async () => {
  if (!protocolScenarioRequestId) return;
  const { data } = await client.GET("/api/ohpp/scenarios/{requestId}/status", {
    params: {
      path: { requestId: protocolScenarioRequestId },
      query: { accountId: activeAccountId }
    }
  });
  if (!data) return;
  if (data.status !== "Resolved") {
    protocolScenarioResultEl.className = data.status === "Expired" ? "status error" : "status pending";
    protocolScenarioResultEl.textContent = data.status ?? "Pending";
    return;
  }
  if (!data.attestationVerified) {
    protocolScenarioResultEl.className = "status error";
    protocolScenarioResultEl.textContent = `Attestation verification failed: ${data.error ?? "unknown error"}`;
    return;
  }
  const answer = data.selectedOption ?? data.selectedOptions?.join(", ") ?? data.value ?? "acknowledged";
  protocolScenarioResultEl.className = "status success";
  protocolScenarioResultEl.textContent = `Verified bank interpretation: ${answer}`;
});
function formatMoney(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}
document.getElementById("logout-button").addEventListener("click", () => signOut());
if (accessToken) {
  showAuthenticatedApp();
  void loadWorkspace();
}
