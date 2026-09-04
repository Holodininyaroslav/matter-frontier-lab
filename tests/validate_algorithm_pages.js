"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const pages = ["cudaq-shor-demo", "hybrid-quantum-asic-demo", "multiquark-algorithm"];
const languages = ["en", "ru", "he"];

function loadConfig(page) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, page, "app.js"), "utf8"), context);
  return context.window.INSPECTOR_CONFIG;
}

function requireTranslations(value, label) {
  for (const language of languages) {
    if (!value || typeof value[language] !== "string" || !value[language].trim()) {
      throw new Error(`${label} is missing ${language}`);
    }
  }
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page, "index.html"), "utf8");
  if (!html.includes(`data-demo-page="${page === "cudaq-shor-demo" ? "shor" : page === "hybrid-quantum-asic-demo" ? "asic" : "quark"}"`)) {
    throw new Error(`${page} has no matching shared demonstration-tab identity`);
  }
  if (!html.includes("data-demo-tabs")) {
    throw new Error(`${page} has no shared demonstration tabs`);
  }
  const config = loadConfig(page);
  if (!config || !Array.isArray(config.stages) || !config.stages.length) {
    throw new Error(`${page} has no inspector stages`);
  }
  for (const language of languages) {
    if (!config.copy[language]?.title || !config.copy[language]?.intro) {
      throw new Error(`${page} is missing ${language} page copy`);
    }
  }
  requireTranslations(config.boundary, `${page} boundary`);
  if (!config.flow || !Array.isArray(config.flow.nodes) || !config.flow.nodes.length) {
    throw new Error(`${page} has no interactive flow map`);
  }
  for (const language of languages) {
    if (!config.copy[language]?.flowTitle || !config.copy[language]?.flowIntro) {
      throw new Error(`${page} is missing ${language} flow copy`);
    }
  }
  const flowNodeIds = new Set();
  config.flow.nodes.forEach((node, nodeIndex) => {
    if (!Number.isInteger(node.stage) || node.stage < 0 || node.stage >= config.stages.length) {
      throw new Error(`${page} flow node ${nodeIndex + 1} references an invalid stage`);
    }
    if (!node.id || flowNodeIds.has(node.id)) {
      throw new Error(`${page} flow node ${nodeIndex + 1} has a missing or duplicate id`);
    }
    flowNodeIds.add(node.id);
    if (node.title) requireTranslations(node.title, `${page} flow node ${node.id} title`);
    if (node.caption) requireTranslations(node.caption, `${page} flow node ${node.id} caption`);
  });
  (config.flow.lanes || []).forEach((lane, laneIndex) => requireTranslations(lane.title, `${page} flow lane ${laneIndex + 1}`));
  (config.flow.edges || []).forEach((edge, edgeIndex) => {
    if (!flowNodeIds.has(edge.from) || !flowNodeIds.has(edge.to)) {
      throw new Error(`${page} flow edge ${edgeIndex + 1} references a missing node`);
    }
    if (edge.label) requireTranslations(edge.label, `${page} flow edge ${edgeIndex + 1} label`);
  });
  requireTranslations(config.flow.note, `${page} flow note`);

  config.stages.forEach((stage, stageIndex) => {
    requireTranslations(stage.title, `${page} stage ${stageIndex + 1} title`);
    requireTranslations(stage.summary, `${page} stage ${stageIndex + 1} summary`);
    const sourcePath = path.resolve(root, page, stage.source);
    if (!sourcePath.startsWith(root) || !fs.existsSync(sourcePath)) {
      throw new Error(`${page} stage ${stageIndex + 1} source is missing: ${sourcePath}`);
    }
    const source = fs.readFileSync(sourcePath, "utf8");
    const start = stage.start ? source.indexOf(stage.start) : 0;
    const end = stage.end ? source.indexOf(stage.end, start + 1) : source.length;
    if (start < 0 || end < start) {
      throw new Error(`${page} stage ${stageIndex + 1} has invalid source markers`);
    }
    (stage.substeps || []).forEach((substep, substepIndex) => {
      requireTranslations(substep.title, `${page} stage ${stageIndex + 1} substep ${substepIndex + 1}`);
      const subStart = source.indexOf(substep.start, start);
      const subEnd = substep.end ? source.indexOf(substep.end, subStart + 1) : source.length;
      if (subStart < 0 || subEnd < subStart) {
        throw new Error(`${page} stage ${stageIndex + 1} substep ${substepIndex + 1} has invalid markers`);
      }
    });
    (stage.notes || []).forEach((note, noteIndex) => {
      requireTranslations(note.text, `${page} stage ${stageIndex + 1} note ${noteIndex + 1}`);
    });
  });

  for (const source of config.sources) {
    const sourcePath = path.resolve(root, page, source.path);
    if (!sourcePath.startsWith(root) || !fs.existsSync(sourcePath)) {
      throw new Error(`${page} inventory source is missing: ${sourcePath}`);
    }
  }
  console.log(`PASS ${page}: ${config.stages.length} stages, 3 languages`);
}
