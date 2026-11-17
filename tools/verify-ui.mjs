// Dependency-free browser checks using an already-running Chrome DevTools session.
// Start the frontend and Chrome with --remote-debugging-port=9222 first.
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const origin = process.env.UI_ORIGIN || "http://localhost:5173";
const debugOrigin = process.env.CHROME_DEBUG_ORIGIN || "http://localhost:9222";
const target = await (
  await fetch(`${debugOrigin}/json/new?about:blank`, { method: "PUT" })
).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});
let sequence = 0;
const pending = new Map();
const errors = [];
const retiredRequests = [];
socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (
    message.method === "Network.requestWillBeSent" &&
    /:8000|\/api\/health/.test(message.params.request.url)
  )
    retiredRequests.push(message.params.request.url);
  if (message.method === "Runtime.exceptionThrown")
    errors.push(message.params.exceptionDetails.text);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`CDP timeout: ${method}`));
    }, 15_000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`UI condition failed: ${expression}`);
}
async function navigate(path) {
  await send("Page.navigate", { url: `${origin}${path}` });
  await until(
    "document.readyState === 'complete' && !!document.querySelector('main h1')",
  );
}
async function viewport(width) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
}
const routes = [
  "/",
  "/movies",
  "/shows",
  "/watchlist",
  "/favorites",
  "/analytics",
  "/import-export",
  "/settings",
  "/missing-scene",
];
await mkdir(".qa", { recursive: true });
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  for (const width of [1440, 1024, 768, 390]) {
    await viewport(width);
    for (const path of routes) {
      await navigate(path);
      assert.equal(
        await evaluate("document.documentElement.scrollWidth <= innerWidth"),
        true,
        `Horizontal overflow: ${path} at ${width}`,
      );
      assert.equal(
        await evaluate(
          '!!document.querySelector("main h1")?.textContent.trim()',
        ),
        true,
      );
      if (path === "/") {
        await until(
          "document.querySelector('[role=status]')?.textContent.includes('Local Storage Ready')",
        );
        const image = await send("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        await writeFile(
          `.qa/dashboard-${width}.png`,
          Buffer.from(image.data, "base64"),
        );
      }
    }
    console.log(
      `PASS: all 8 routes + 404 at ${width}px, no horizontal overflow`,
    );
  }
  await navigate("/");
  await evaluate(
    "document.querySelector('[aria-label=\"Open navigation\"]').click()",
  );
  await until("document.querySelector('dialog')?.open");
  assert.equal(
    await evaluate("!!document.activeElement.closest('dialog')"),
    true,
    "Drawer should receive focus",
  );
  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await until("!document.querySelector('dialog')");
  await evaluate(
    "document.querySelector('[aria-label=\"Open navigation\"]').click()",
  );
  await until("document.querySelector('dialog')?.open");
  await evaluate("document.querySelector('dialog a[href=\"/shows\"]').click()");
  await until(
    "location.pathname === '/shows' && !document.querySelector('dialog')",
  );
  console.log("PASS: mobile drawer focus, Escape, and route navigation");
  await viewport(1440);
  await navigate("/settings");
  await until(
    "document.querySelector('[role=status]')?.textContent.includes('Local Storage Ready')",
  );
  const checkbox = `document.querySelector('input[type="checkbox"]')`;
  const initialCollapsed = await evaluate(checkbox + ".checked");
  await evaluate(checkbox + ".click()");
  await until(
    checkbox +
      ".checked === " +
      !initialCollapsed +
      " && !" +
      checkbox +
      ".disabled",
  );
  await navigate("/settings");
  await until(
    "document.querySelector('[role=status]')?.textContent.includes('Local Storage Ready')",
  );
  assert.equal(
    await evaluate(checkbox + ".checked"),
    !initialCollapsed,
    "Preference persists across reload",
  );
  await evaluate(checkbox + ".click()");
  await until(
    checkbox +
      ".checked === " +
      initialCollapsed +
      " && !" +
      checkbox +
      ".disabled",
  );
  if (initialCollapsed) {
    await evaluate(checkbox + ".click()");
    await until(checkbox + ".checked === false && !" + checkbox + ".disabled");
  }
  const settingsImage = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  await writeFile(
    ".qa/settings-1440.png",
    Buffer.from(settingsImage.data, "base64"),
  );
  await evaluate(
    `document.querySelector('[aria-label="Collapse sidebar"]').click()`,
  );
  await until(
    "document.querySelector('.app-layout').classList.contains('is-collapsed')",
  );
  await navigate("/");
  await until(
    "document.querySelector('.app-layout').classList.contains('is-collapsed')",
  );
  await evaluate(
    `document.querySelector('[aria-label="Expand sidebar"]').click()`,
  );
  await until(
    "!document.querySelector('.app-layout').classList.contains('is-collapsed')",
  );
  console.log(
    "PASS: sidebar and Settings share a persisted IndexedDB preference, including reloads",
  );
  await send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await evaluate(
    `document.querySelector('.sidebar a[href="/movies"]').click()`,
  );
  await until(
    "location.pathname === '/movies' && !!document.querySelector('.sidebar a.active[href=\"/movies\"]')",
  );
  assert.equal(
    await evaluate(
      "document.querySelector('[role=status]').textContent.includes('Local Storage Ready')",
    ),
    true,
  );
  console.log("PASS: loaded app and navigation work without a network");
  await send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  const injection = await send("Page.addScriptToEvaluateOnNewDocument", {
    source:
      "Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true })",
  });
  await navigate("/settings");
  await until(
    "document.querySelector('[role=status]')?.textContent.includes('Storage Unavailable')",
  );
  assert.equal(await evaluate(checkbox + ".disabled"), true);
  assert.equal(
    await evaluate("!!document.querySelector('[role=alert]')"),
    true,
  );
  await evaluate(
    `document.querySelector('.sidebar a[href="/movies"]').click()`,
  );
  await until("location.pathname === '/movies'");
  console.log(
    "PASS: denied storage shows an honest error, disables persistence controls, and preserves navigation",
  );
  await send("Page.removeScriptToEvaluateOnNewDocument", {
    identifier: injection.identifier,
  });
  await navigate("/");
  await until(
    "document.querySelector('[role=status]')?.textContent.includes('Local Storage Ready')",
  );
  assert.equal(await evaluate("document.title.includes('Kinoquill')"), true);
  assert.deepEqual(retiredRequests, [], "No requests to the retired backend");
  assert.deepEqual(errors, [], "No browser runtime exceptions");
  console.log(
    "PASS: Kinoquill branding; no retired API requests; no browser runtime exceptions; screenshots in .qa/",
  );
} finally {
  socket.close();
  await fetch(`${debugOrigin}/json/close/${target.id}`);
}
