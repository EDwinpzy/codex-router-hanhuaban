// 网页面板的简体中文界面覆盖层。
//
// 与控制中心共用同一份词典（./ui-zh-data.mjs，由 control-center/src/ui-zh.ts
// 生成）。面板自身的 i18n 只覆盖了带 data-i18n 的节点，index.html 与 app.js 里
// 仍有大量硬编码英文；这里在渲染结果上补一层精确匹配的中文替换，不改动任何
// 现有组件代码，因此上游更新不会冲突。
//
// 只做「整个文本节点完全相等」的替换，且只在本机界面语言为中文时生效；
// 切回其他语言会自动还原。原始文本保存在 WeakMap，可无损回滚。

import { translateZhText } from "./ui-zh-data.mjs";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "NOSCRIPT", "SVG"]);
const TEXT_ATTRIBUTES = ["placeholder", "title", "aria-label", "alt"];

const textOriginals = new WeakMap();
const attributeOriginals = new WeakMap();

let active = false;
let observer = null;

function isSkipped(node) {
  let element = node instanceof Element ? node : node?.parentElement ?? null;
  while (element) {
    if (SKIP_TAGS.has(element.tagName)) return true;
    if (element.hasAttribute("data-zh-skip")) return true;
    element = element.parentElement;
  }
  return false;
}

function applyTextNode(node) {
  if (isSkipped(node)) return;
  const translated = translateZhText(node.data);
  if (translated === null || translated === node.data) return;
  // 记账用「翻译前的那一版」，切回英文时能还原成界面最后一次渲染的原文。
  textOriginals.set(node, node.data);
  node.data = translated;
}

function restoreTextNode(node) {
  const original = textOriginals.get(node);
  if (original === undefined) return;
  textOriginals.delete(node);
  if (node.data !== original) node.data = original;
}

function applyAttributes(element) {
  if (isSkipped(element)) return;
  for (const name of TEXT_ATTRIBUTES) {
    const value = element.getAttribute(name);
    if (value === null) continue;
    const translated = translateZhText(value);
    if (translated === null || translated === value) continue;
    let store = attributeOriginals.get(element);
    if (!store) {
      store = new Map();
      attributeOriginals.set(element, store);
    }
    if (!store.has(name)) store.set(name, value);
    element.setAttribute(name, translated);
  }
}

function restoreAttributes(element) {
  const store = attributeOriginals.get(element);
  if (!store) return;
  for (const [name, value] of store) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }
  attributeOriginals.delete(element);
}

function visit(root, onElement, onText) {
  if (root.nodeType === Node.TEXT_NODE) {
    onText(root);
    return;
  }
  if (root.nodeType === Node.ELEMENT_NODE) onElement(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) onText(current);
    else if (current.nodeType === Node.ELEMENT_NODE) onElement(current);
    current = walker.nextNode();
  }
}

function applySubtree(root) {
  visit(root, applyAttributes, applyTextNode);
}

function restoreSubtree(root) {
  visit(root, restoreAttributes, restoreTextNode);
}

function interfaceLanguageIsChinese() {
  try {
    const stored = localStorage.getItem("codex-router-language");
    if (stored) return stored.toLowerCase().startsWith("zh");
  } catch { /* 存储不可用时回落到文档语言 */ }
  const declared = document.documentElement?.lang || "";
  if (declared) return declared.toLowerCase().startsWith("zh");
  return (navigator.language || "").toLowerCase().startsWith("zh");
}

function start() {
  if (active || !document.body) return;
  active = true;
  applySubtree(document.body);
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") applyTextNode(record.target);
      else if (record.type === "attributes" && record.target instanceof Element) applyAttributes(record.target);
      else for (const node of Array.from(record.addedNodes)) applySubtree(node);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: TEXT_ATTRIBUTES,
  });
}

function stop() {
  if (!active) return;
  active = false;
  observer?.disconnect();
  observer = null;
  if (document.body) restoreSubtree(document.body);
}

function sync() {
  if (interfaceLanguageIsChinese()) start();
  else stop();
}

export function installUiZh() {
  const controller = {
    apply: () => document.body && applySubtree(document.body),
    restore: () => document.body && restoreSubtree(document.body),
    active: () => active,
    translate: translateZhText,
  };

  sync();
  // 语言切换时 i18n.mjs 会改写 <html lang>，监听它最可靠。
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  // 兜底：部分路径只改 localStorage，不写 lang。
  window.setInterval(sync, 1500);

  window.__codexRouterZh = controller;
  return controller;
}
