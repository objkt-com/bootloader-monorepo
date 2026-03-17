import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const bootWeb = await import("../../tmp/bootloader-tests/shared/bootloaders/boot-web.js");
const bootWebParams = await import(
  "../../tmp/bootloader-tests/shared/bootloaders/boot-web-params.js"
);
const catalog = await import("../../tmp/bootloader-tests/shared/bootloaders/catalog.js");
const contracts = await import(
  "../../tmp/bootloader-tests/shared/bootloaders/contracts.js"
);
const seedHex = await import("../../tmp/bootloader-tests/seed-hex.js");

test("boot:web manifest accepts omitted entry and resolves defaults", () => {
  const manifest = bootWeb.parseBootWebManifest(
    JSON.stringify({ spec: bootWeb.BOOT_WEB_SPEC })
  );
  const resolved = bootWeb.resolveBootWebManifest(manifest);

  assert.equal(resolved.spec, bootWeb.BOOT_WEB_SPEC);
  assert.equal(resolved.entry, bootWeb.BOOT_WEB_DEFAULT_ENTRY);
  assert.equal(
    resolved.capture.width,
    bootWeb.BOOT_WEB_DEFAULT_CAPTURE_WIDTH
  );
  assert.equal(
    resolved.capture.height,
    bootWeb.BOOT_WEB_DEFAULT_CAPTURE_HEIGHT
  );
  assert.equal(
    resolved.capture.delayMs,
    bootWeb.BOOT_WEB_DEFAULT_CAPTURE_DELAY_MS
  );
  assert.equal(resolved.capture.mode, "auto");
  assert.equal(resolved.animation, null);
});

test("boot:web manifest rejects non-index entry", () => {
  assert.throws(
    () =>
      bootWeb.parseBootWebManifest(
        JSON.stringify({
          spec: bootWeb.BOOT_WEB_SPEC,
          entry: "nested/index.html",
        })
      ),
    /index\.html/
  );
});

test("boot:web params codec round-trips nested values and floats", () => {
  const input = {
    bool: true,
    int: 7,
    float: 0.12345678901234567,
    nested: {
      colors: ["#fff", "#000"],
      threshold: 1.25,
    },
  };

  const encoded = bootWebParams.encodeBootWebParamsForQuery(input);
  assert.ok(encoded);
  const decoded = bootWebParams.decodeBootWebParamsFromQuery(encoded);

  assert.deepEqual(decoded, input);
});

test("archive helpers normalize and strip wrapped roots", () => {
  const normalized = bootWeb.normalizeArchivePath(
    "project/./assets/../index.html"
  );
  assert.equal(normalized, "project/index.html");

  const prefix = bootWeb.detectArchiveRootPrefix([
    "project/index.html",
    "project/manifest.json",
  ]);
  assert.equal(prefix, "project");
  assert.equal(
    bootWeb.stripArchivePrefix("project/index.html", prefix),
    "index.html"
  );
});

test("shared bootloader catalog stays aligned with ids", () => {
  assert.deepEqual(
    Object.keys(catalog.SHARED_BOOTLOADER_CATALOG).sort(),
    [...catalog.BOOTLOADER_IDS].sort()
  );

  for (const id of catalog.BOOTLOADER_IDS) {
    assert.ok(catalog.isSharedBootloaderId(id));
    const entry = catalog.getSharedBootloaderCatalogEntry(id);
    assert.equal(entry.id, id);
    assert.ok(entry.spec.length > 0);
    assert.ok(entry.currentVersion.length > 0);
  }
});

test("shared contract map resolves known contracts", () => {
  assert.equal(
    contracts.getSharedBootloaderArtifactContract("svg-js", "mainnet"),
    "KT1CB4MYiAViCuXWBU961x7LjQXGeA8SnQwt"
  );
  assert.equal(
    contracts.getSharedBootloaderArtifactContract("generic-web", "shadownet"),
    "KT1MkVTbYNJ6hkJKWSukLBgPaXtkHFKugK6v"
  );
  assert.equal(
    contracts.getSharedBootloaderRngContract("generic-web", "shadownet"),
    "KT1Mub11JnyhBA8huycUekE26DFB5VW4SDqh"
  );
  assert.equal(contracts.getSharedBootloaderRngContract("svg-js", "mainnet"), "");
});

test("generic-web seed helpers produce normalized 32-byte hex seeds", () => {
  const generated = seedHex.generateGenericWebSeedHex();
  assert.match(generated, /^[0-9a-f]{64}$/);
  assert.equal(generated.length, seedHex.GENERIC_WEB_SEED_HEX_LENGTH);
  assert.equal(seedHex.GENERIC_WEB_PREVIEW_SEED.length, 64);

  assert.equal(
    seedHex.normalizeGenericWebSeedHex("0xAbC"),
    `${"0".repeat(61)}abc`
  );
  assert.equal(
    seedHex.normalizeGenericWebSeedHex("g-1"),
    `${"0".repeat(61)}ff1`
  );
});

test("public generic-web snippet preserves normalized 64-char hashes", async () => {
  const snippetPath = new URL(
    "../../apps/web/public/snippet/bootloader.js",
    import.meta.url
  );
  const snippetSource = await fs.readFile(snippetPath, "utf8");
  const inputSeed = "0123456789abcdef".repeat(4);
  const postedMessages = [];

  const context = {
    URL,
    URLSearchParams,
    crypto: globalThis.crypto,
    location: {
      search: `?s=${inputSeed}&i=7&c=true`,
    },
    document: {
      referrer: "https://media.shadownet.bootloader.art/embed/generator/generic-web/1",
    },
    Date,
    Math,
  };

  const parent = {
    postMessage(message, origin) {
      postedMessages.push({ message, origin });
    },
  };

  context.window = {
    parent,
    location: context.location,
    document: context.document,
    crypto: context.crypto,
    Math,
    Date,
  };
  context.window.window = context.window;

  vm.createContext(context);
  vm.runInContext(snippetSource, context);

  assert.equal(context.window.$bootloader.hash, inputSeed);
  assert.equal(context.window.$bootloader.iteration, 7);
  assert.equal(context.window.$bootloader.isCapture, true);
  assert.ok(
    postedMessages.some(({ message }) => message?.id === "bootloader:ready")
  );
});
