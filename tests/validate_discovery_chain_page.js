"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "discovery-chain", "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "discovery-chain", "app.js"), "utf8");

for (const section of ["architecture", "console", "contract", "science"]) {
  if (!html.includes(`id="${section}"`)) throw new Error(`missing ${section} section`);
}
for (const endpoint of ["bootstrap", "task", "epoch", "worker", "reset"]) {
  if (!script.includes(`"${endpoint}"`)) throw new Error(`missing ${endpoint} control`);
}
for (const language of ["en", "ru", "he"]) {
  if (!script.includes(`${language}:{language:`)) throw new Error(`missing ${language} translations`);
}
for (const link of ["../multiquark-algorithm/", "blockchain/contracts/mflchain/mflchain.cpp"]) {
  if (!html.includes(link)) throw new Error(`missing architecture link: ${link}`);
}
if (!script.includes("mfl-pages-language") || !script.includes("searchParams.set(\"lang\"")) {
  throw new Error("language persistence is missing");
}

console.log("PASS discovery-chain: architecture, live controls, source links, 3 languages");
