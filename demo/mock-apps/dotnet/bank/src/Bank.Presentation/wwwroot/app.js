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
var client = createClient({ baseUrl: "" });
var ACCOUNT_ID = "demo-account";
var balanceEl = document.getElementById("balance");
var ohppStatusEl = document.getElementById("ohpp-status");
var payeeListEl = document.getElementById("payee-list");
var payeeSelectEl = document.getElementById("payee-select");
var transferForm = document.getElementById("transfer-form");
var amountInput = document.getElementById("amount");
var referenceInput = document.getElementById("reference");
var transferResultEl = document.getElementById("transfer-result");
var ohppForm = document.getElementById("ohpp-form");
var resolverUrlInput = document.getElementById("resolver-url");
var accessTokenInput = document.getElementById("access-token");
var userIdInput = document.getElementById("user-id");
var ohppResultEl = document.getElementById("ohpp-result");
var transactionListEl = document.getElementById("transaction-list");
async function loadAccount() {
  const { data } = await client.GET("/api/accounts/{id}", {
    params: { path: { id: ACCOUNT_ID } }
  });
  if (!data) return;
  const account = data;
  balanceEl.textContent = `\xA3${account.balance.toFixed(2)}`;
  if (account.ohppRegistration) {
    ohppStatusEl.innerHTML = '<span class="ohpp-badge">OHPP Connected</span> Transfers require approval';
  } else {
    ohppStatusEl.innerHTML = '<span style="color:#666;">OHPP not connected \u2014 transfers execute immediately</span>';
  }
  payeeListEl.innerHTML = "";
  payeeSelectEl.innerHTML = "";
  for (const p of account.payees) {
    payeeListEl.innerHTML += `<li><span>${p.name}</span><span style="color:#888;font-size:0.85rem">${p.sortCode} / ${p.accountNumber}</span></li>`;
    payeeSelectEl.innerHTML += `<option value="${p.id}">${p.name}</option>`;
  }
}
async function loadTransactions() {
  const res = await fetch(`/api/transactions?accountId=${ACCOUNT_ID}`);
  if (!res.ok) return;
  const transactions = await res.json();
  if (transactions.length === 0) {
    transactionListEl.innerHTML = '<p style="color:#888; font-size:0.85rem;">No transactions yet.</p>';
    return;
  }
  transactionListEl.innerHTML = transactions.map((txn) => {
    const statusClass = txn.status.toLowerCase();
    const statusLabel = txn.status === "PendingApproval" ? "Pending" : txn.status;
    const time = new Date(txn.createdAt).toLocaleString();
    const ref = txn.reference ? ` \xB7 ${txn.reference}` : "";
    return `
      <div class="txn-item">
        <div class="txn-left">
          <span class="txn-payee">${txn.payeeName}</span>
          <span class="txn-meta">${time}${ref}</span>
        </div>
        <div class="txn-right">
          <span class="txn-amount">\xA3${txn.amount.toFixed(2)}</span>
          <span class="txn-status ${statusClass}">${statusLabel}</span>
        </div>
      </div>
    `;
  }).join("");
}
transferForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payeeId = payeeSelectEl.value;
  const amount = parseFloat(amountInput.value);
  const reference = referenceInput.value;
  transferResultEl.style.display = "block";
  transferResultEl.className = "status pending";
  transferResultEl.textContent = "Processing...";
  const { data, error } = await client.POST("/api/transfers", {
    body: { fromAccountId: ACCOUNT_ID, toPayeeId: payeeId, amount, reference }
  });
  const result = data ?? error;
  if (result.status === "Completed" || result.status === 0) {
    transferResultEl.className = "status success";
    transferResultEl.textContent = "\u2713 Transfer completed.";
    loadAccount();
    loadTransactions();
  } else if (result.status === "PendingApproval" || result.status === 1) {
    transferResultEl.className = "status pending";
    transferResultEl.textContent = `\u23F3 Waiting for approval on your device... (Request ID: ${result.participationRequestId})`;
    loadTransactions();
    if (result.participationRequestId) pollStatus(result.participationRequestId);
  } else {
    transferResultEl.className = "status error";
    transferResultEl.textContent = `\u2717 ${result.error || "Transfer failed"}`;
  }
});
async function pollStatus(requestId) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2e3));
    const { data } = await client.GET("/api/transfers/{requestId}/status", {
      params: { path: { requestId }, query: { accountId: ACCOUNT_ID } }
    });
    const result = data;
    if (!result) continue;
    if (result.status === "Completed" || result.status === 0) {
      transferResultEl.className = "status success";
      transferResultEl.textContent = "\u2713 Transfer approved and completed.";
      loadAccount();
      loadTransactions();
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
ohppForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { error } = await client.POST("/api/ohpp/register", {
    body: {
      accountId: ACCOUNT_ID,
      resolverUrl: resolverUrlInput.value,
      accessToken: accessTokenInput.value,
      userId: userIdInput.value
    }
  });
  ohppResultEl.style.display = "block";
  if (!error) {
    ohppResultEl.className = "status success";
    ohppResultEl.textContent = "\u2713 OHPP connected. Transfers now require approval.";
    loadAccount();
  } else {
    ohppResultEl.className = "status error";
    ohppResultEl.textContent = "\u2717 Failed to connect OHPP.";
  }
});
var generateBtn = document.getElementById("generate-challenge-btn");
var challengeDisplay = document.getElementById("challenge-display");
var challengeUriEl = document.getElementById("challenge-uri");
var copyBtn = document.getElementById("copy-challenge");
var disconnectSection = document.getElementById("ohpp-disconnect-section");
var disconnectBtn = document.getElementById("disconnect-btn");
generateBtn.addEventListener("click", async () => {
  const res = await fetch("/api/ohpp/generate-challenge", { method: "POST" });
  if (!res.ok) return;
  const data = await res.json();
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
  await fetch("/api/ohpp/disconnect", { method: "DELETE" });
  loadAccount();
  disconnectSection.style.display = "none";
});
async function pollForConnection() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3e3));
    const res = await fetch(`/api/accounts/${ACCOUNT_ID}`);
    if (!res.ok) continue;
    const account = await res.json();
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
loadAccount();
loadTransactions();
