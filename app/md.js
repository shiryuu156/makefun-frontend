// A tiny safe Markdown renderer for bounty descriptions and rules.
// Only the constructs the API's texts actually use: headings, bold, italic, inline code,
// fenced code blocks, lists, blockquotes, links and paragraphs. Everything is escaped first,
// so no API text can inject markup; links are limited to http(s) targets.

import { esc } from './format.js';

const LINK_RE = /\[([^\]]+)\]\((https?:[^)\s]+)\)/g;

function inline(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, (_, code) => `<code>${code}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, bold) => `<strong>${bold}</strong>`);
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, (_, before, ital) => `${before}<em>${ital}</em>`);
  out = out.replace(LINK_RE, (_, label, href) => `<a href="${href}">${label}</a>`);
  return out;
}

export function md(text) {
  const lines = String(text ?? '').split('\n');
  const html = [];
  let para = [];
  let list = null; // 'ul' | 'ol' | null
  let fence = false;

  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${para.map(inline).join('<br>')}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (fence) html.push('</code></pre>');
      else {
        flushPara();
        flushList();
        html.push('<pre><code>');
      }
      fence = !fence;
      continue;
    }
    if (fence) {
      html.push(esc(line));
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara();
      flushList();
      html.push(`<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>`);
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bullet || ordered) {
      flushPara();
      const kind = bullet ? 'ul' : 'ol';
      if (list !== kind) {
        flushList();
        html.push(`<${kind}>`);
        list = kind;
      }
      html.push(`<li>${inline((bullet ?? ordered)[1])}</li>`);
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushPara();
      flushList();
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }
    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }
    para.push(line);
  }
  flushPara();
  flushList();
  if (fence) html.push('</code></pre>');
  return html.join('\n');
}
