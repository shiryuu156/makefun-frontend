// The four pages, each a function from API data to HTML. Every value from the API is escaped
// before it reaches the page (see format.js esc), and time-left spans carry data-deadline so the
// router's ticker can refresh them without rebuilding the page.

import { date, entriesLabel, esc, money, num, shortDate, takesEntries, timeLeft } from './format.js';
import { md } from './md.js';

/** The reward as it stands now: the prize plus every entry fee paid into it. */
export const pot = (b) => money(b.potUsd ?? b.rewardAmount);

/** 'Free entry' or the fee, when the bounty charges one. */
export const feeLabel = (b) =>
  b.entryFeeUsd && Number(b.entryFeeUsd) > 0 ? `${money(b.entryFeeUsd)} entry fee` : 'Free entry';

/** Open / closing-soon / closed badge. A bounty past its deadline may still read 'open',
 *  so the deadline, not the status, decides. */
export function statusBadge(b) {
  if (!takesEntries(b)) return '<span class="badge closed">Entries closed</span>';
  const ms = new Date(b.deadline).getTime() - Date.now();
  if (ms < 24 * 3600000) return '<span class="badge soon">Closing soon</span>';
  return '<span class="badge open">Open</span>';
}

const bountyUrl = (slug) => `#/bounty/${encodeURIComponent(slug)}`;
const leaderboardUrl = (slug) => `#/bounty/${encodeURIComponent(slug)}/leaderboard`;
const profileUrl = (handle) => `#/u/${encodeURIComponent(handle)}`;

// ---------------------------------------------------------------- board

/** Sort the board's bounties by the toolbar's choice. */
export function sortBoard(items, sort) {
  const list = [...items];
  if (sort === 'pot') list.sort((a, b) => Number(b.potUsd ?? b.rewardAmount) - Number(a.potUsd ?? a.rewardAmount));
  else if (sort === 'entries') list.sort((a, b) => (b.submissionCount ?? 0) - (a.submissionCount ?? 0));
  else if (sort === 'newest') list.sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));
  else list.sort((a, b) => new Date(a.deadline) - new Date(b.deadline)); // 'deadline'
  return list;
}

/** Filter the board's bounties by the toolbar's search text and chips. */
export function filterBoard(items, { query, openOnly, closingSoon }) {
  const q = query.trim().toLowerCase();
  return items.filter((b) => {
    if (openOnly && !takesEntries(b)) return false;
    if (closingSoon && !(takesEntries(b) && new Date(b.deadline).getTime() - Date.now() < 24 * 3600000)) return false;
    if (!q) return true;
    const hay = `${b.title} ${b.summary ?? ''} ${b.category ?? ''} ${(b.skills ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
}

function card(b) {
  const open = takesEntries(b);
  return `
    <li class="card">
      <div class="row">${statusBadge(b)}<span class="tag">${esc(b.category ?? 'Bounty')}</span></div>
      <h2><a href="${bountyUrl(b.slug)}">${esc(b.title)}</a></h2>
      ${b.summary ? `<p class="summary">${esc(b.summary)}</p>` : ''}
      <div class="row"><span class="pot"><small>Live pot</small>${pot(b)}</span></div>
      <div class="meta">
        <span class="fee">${feeLabel(b)}</span>
        <span class="timeleft${open && new Date(b.deadline).getTime() - Date.now() < 24 * 3600000 ? ' soon' : ''}" data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</span>
        <span class="entries">${entriesLabel(b.submissionCount)}</span>
      </div>
      <div class="row"><span class="sponsor">by ${esc(b.sponsor?.name ?? 'make.fun')}</span>
        <a href="${leaderboardUrl(b.slug)}">Leaderboard</a></div>
    </li>`;
}

/** The board's results alone (count + cards), so the toolbar can filter without rebuilding itself. */
export function boardResults(data, state) {
  const filtered = sortBoard(filterBoard(data.items, state), state.sort);
  const rows = filtered.map(card).join('');
  return `
    <span class="count">${num(filtered.length)} of ${num(data.items.length)}</span>
    ${rows ? `<ul class="cards">${rows}</ul>` : '<p class="error">No bounties match. Try clearing the search or the filters.</p>'}`;
}

export function board(data, state) {
  return `
    <h1>Open bounties</h1>
    <p class="lede">Build an agent or a program, enter it, and get scored and ranked in the open. The pot is the
    prize plus every entry fee paid in so far.</p>
    <div class="toolbar" role="search">
      <input class="search" id="board-search" type="search" placeholder="Search bounties…" value="${esc(state.query)}" autocomplete="off">
      <select id="board-sort" aria-label="Sort bounties">
        <option value="deadline"${state.sort === 'deadline' ? ' selected' : ''}>Closing soonest</option>
        <option value="pot"${state.sort === 'pot' ? ' selected' : ''}>Biggest pot</option>
        <option value="entries"${state.sort === 'entries' ? ' selected' : ''}>Most entries</option>
        <option value="newest"${state.sort === 'newest' ? ' selected' : ''}>Newest</option>
      </select>
      <button class="chip" id="board-open" aria-pressed="${state.openOnly}">Open now</button>
      <button class="chip" id="board-closing" aria-pressed="${state.closingSoon}">Closing in 24h</button>
    </div>
    <div id="board-results">${boardResults(data, state)}</div>`;
}

// ---------------------------------------------------------------- bounty

function rewardsTable(b) {
  const now = Array.isArray(b.rewardsNow) ? b.rewardsNow : null;
  if (now && now.length) {
    const rows = now
      .map(
        (r) =>
          `<tr><td>${r.place === 1 ? '🥇' : r.place === 2 ? '🥈' : r.place === 3 ? '🥉' : ''} ${num(r.place)}${r.place === 1 ? 'st' : r.place === 2 ? 'nd' : r.place === 3 ? 'rd' : 'th'}</td><td class="num">${money(r.baseUsd)}</td><td class="num">${money(r.feeShareUsd)}</td><td class="num"><strong>${money(r.amountUsd)}</strong></td></tr>`,
      )
      .join('');
    return `<table><thead><tr><th>Place</th><th class="num">Prize</th><th class="num">Fee share</th><th class="num">Total now</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  const rewards = b.rewards && typeof b.rewards === 'object' ? b.rewards : null;
  if (rewards && Object.keys(rewards).length) {
    const rows = Object.entries(rewards)
      .sort((a, c) => Number(a[0]) - Number(c[0]))
      .map(([place, amount]) => `<tr><td>${num(place)}</td><td class="num"><strong>${money(amount)}</strong></td></tr>`)
      .join('');
    return `<table><thead><tr><th>Place</th><th class="num">Prize</th></tr></thead><tbody>${rows}</tbody></table>`;
  }
  return `<p>One prize of <strong>${money(b.rewardAmount)}</strong>.</p>`;
}

export function bounty(b) {
  const open = takesEntries(b);
  const phases = Array.isArray(b.phases) ? b.phases : [];
  return `
    <p class="backlink"><a href="#/">&larr; All bounties</a></p>
    <div class="row">${statusBadge(b)}<span class="tag">${esc(b.category ?? 'Bounty')}</span>
      <span class="sponsor">by ${esc(b.sponsor?.name ?? 'make.fun')}${b.sponsor?.isVerified ? ' ✓' : ''}</span></div>
    <h1>${esc(b.title)}</h1>
    ${b.summary ? `<p class="lede">${esc(b.summary)}</p>` : ''}
    ${(b.skills ?? []).length ? `<div class="skills">${b.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div>` : ''}
    <div class="facts">
      <div class="fact"><small>Live pot</small><strong>${pot(b)}</strong><span class="sub">prize ${money(b.rewardAmount)} + fees</span></div>
      <div class="fact"><small>Entry fee</small><strong>${b.entryFeeUsd && Number(b.entryFeeUsd) > 0 ? money(b.entryFeeUsd) : 'Free'}</strong>${b.entryFeePayers ? `<span class="sub">${num(b.entryFeePayers)} paid</span>` : ''}</div>
      <div class="fact"><small>Deadline</small><strong data-deadline="${esc(b.deadline)}">${timeLeft(b.deadline)}</strong><span class="sub">${date(b.deadline)}</span></div>
      <div class="fact"><small>Entries</small><strong>${num(b.submissionCount)}</strong><span class="sub">${open ? 'still taking entries' : 'entries closed'}</span></div>
      ${b.opensAt ? `<div class="fact"><small>Opened</small><strong>${shortDate(b.opensAt)}</strong></div>` : ''}
    </div>
    <div class="actions">
      <a class="btn" href="${leaderboardUrl(b.slug)}">Leaderboard</a>
      <a class="btn ghost" href="https://make.fun/c/${encodeURIComponent(b.slug)}">View on make.fun &nearr;</a>
    </div>
    ${open ? '' : `<p class="error">Entries closed on ${date(b.deadline)}. This page stays up for the results.</p>`}
    <h2>Rewards</h2>
    ${rewardsTable(b)}
    ${b.description ? `<h2>Description</h2><div class="md">${md(b.description)}</div>` : ''}
    ${b.rules ? `<h2>Rules</h2><div class="md">${md(b.rules)}</div>` : ''}
    ${b.prerequisites?.summary ? `<h2>Prerequisites</h2><p>${esc(b.prerequisites.summary)}</p>` : ''}
    ${phases.length ? `<h2>Phases</h2>${phases.map((p) => `<h3>${esc(p.title)}</h3><p>${esc(p.description ?? '')}</p><p class="sponsor">${shortDate(p.startsAt)} – ${shortDate(p.endsAt)}</p>`).join('')}` : ''}`;
}

// ---------------------------------------------------------------- leaderboard

const PAGE_SIZE = 50;

export function leaderboard(data, slug, limit) {
  const cols = (data.columns ?? []).filter((c) => !c.hidden);
  const entries = data.entries ?? [];
  const shown = entries.slice(0, limit);
  const viewLinks = (data.views ?? []).length > 1
    ? `<div class="row">${data.views.map((v) => `<a class="chip" href="${leaderboardUrl(slug)}?view=${encodeURIComponent(v)}" ${v === data.view ? 'aria-pressed="true" style="pointer-events:none"' : ''}>${esc(v)}</a>`).join('')}</div>`
    : '';
  const rows = shown
    .map((e) => {
      const cells = cols
        .map((c) => `<td class="num">${esc(e.display?.[c.key] ?? e.values?.[c.key] ?? '—')}</td>`)
        .join('');
      return `<tr>
        <td class="rank">${num(e.rank)}</td>
        <td><a class="handle" href="${profileUrl(e.handle)}">${esc(e.handle)}</a>${e.house ? ' <span class="badge house">house</span>' : ''}<div class="entry-title">${esc(e.title ?? '')}</div></td>
        ${cells}
      </tr>`;
    })
    .join('');
  return `
    <p class="backlink"><a href="${bountyUrl(slug)}">&larr; ${esc(data.competition?.title ?? slug)}</a></p>
    <h1>${esc(data.title ?? 'Leaderboard')}</h1>
    <p class="lede">${esc(data.competition?.title ?? '')} · ${num(entries.length)} entries · phase: ${esc(data.phase?.title ?? '—')}${data.phase?.scores === 'live' ? ' (live scores)' : ''}</p>
    ${viewLinks}
    <div class="lb-wrap"><table>
      <thead><tr><th>#</th><th>Entry</th>${cols.map((c) => `<th class="num">${esc(c.title)}</th>`).join('')}</tr></thead>
      <tbody>${rows || '<tr><td colspan="99">No entries yet.</td></tr>'}</tbody>
    </table></div>
    <div class="pager">
      <span class="count">Showing ${num(shown.length)} of ${num(entries.length)}</span>
      ${entries.length > limit ? `<button class="btn" id="lb-more">Show ${num(Math.min(PAGE_SIZE, entries.length - limit))} more</button>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- profile

export function profile(p) {
  const record = p.record ?? {};
  const solutions = p.solutions ?? [];
  const name = p.display_name ?? p.handle;
  const avatar = p.avatar ?? p.image;
  const links = [
    p.github_login ? `<a href="https://github.com/${encodeURIComponent(p.github_login)}">GitHub</a>` : '',
    p.x ? `<a href="https://x.com/${encodeURIComponent(p.x)}">X</a>` : '',
    p.discord ? `<span>Discord: ${esc(p.discord)}</span>` : '',
    p.wallet?.explorer_url ? `<a href="${esc(p.wallet.explorer_url)}">Wallet</a>` : '',
  ].filter(Boolean);
  const rows = solutions
    .map((s) => {
      const c = s.competition ?? {};
      const score = s.score ? `${esc(s.score.display ?? s.score.value)}` : '—';
      return `<tr>
        <td><a href="${bountyUrl(c.slug)}">${esc(s.title)}</a><div class="entry-title">${esc(c.title ?? '')}</div></td>
        <td class="num">${s.placement ? num(s.placement) : '—'}</td>
        <td class="num">${score}</td>
        <td class="num">${s.prize_usd ? money(s.prize_usd) : '—'}</td>
        <td>${shortDate(s.entered_at)}</td>
      </tr>`;
    })
    .join('');
  return `
    <p class="backlink"><a href="#/">&larr; All bounties</a></p>
    <div class="profile-head">
      ${avatar
        ? `<img class="avatar" src="${esc(avatar)}" alt="" crossorigin="anonymous" referrerpolicy="no-referrer">`
        : `<div class="avatar avatar-fallback" aria-hidden="true">${esc(name.slice(0, 1).toUpperCase())}</div>`}
      <div>
        <h1>${esc(name)}</h1>
        <p class="handle-line">@${esc(p.handle)} · joined ${shortDate(p.joined_at)}${p.house ? ' · <span class="badge house">house</span>' : ''}</p>
        ${p.bio ? `<p class="bio">${esc(p.bio)}</p>` : ''}
        ${links.length ? `<p class="row">${links.join(' · ')}</p>` : ''}
      </div>
    </div>
    <div class="statgrid">
      <div class="stat"><small>Entered</small><strong>${num(record.competitions_entered)}</strong></div>
      <div class="stat"><small>Placed</small><strong>${num(record.competitions_placed)}</strong></div>
      <div class="stat"><small>Won</small><strong>${num(record.competitions_won)}</strong></div>
      <div class="stat"><small>Best place</small><strong>${record.best_placement ? `#${num(record.best_placement)}` : '—'}</strong></div>
      <div class="stat"><small>Prize money</small><strong>${money(record.prize_usd ?? 0)}</strong></div>
    </div>
    <h2>Entries (${num(solutions.length)})</h2>
    ${rows
      ? `<div class="lb-wrap"><table>
          <thead><tr><th>Entry</th><th class="num">Place</th><th class="num">Score</th><th class="num">Prize</th><th>Entered</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : '<p>No entries yet.</p>'}`;
}

// ---------------------------------------------------------------- not found

export function notFound(what, detail) {
  return `<h1>Not found</h1><p class="error">${esc(what)}${detail ? `: ${esc(detail)}` : ''} — it may not exist, or it may have been removed.</p>
  <p><a href="#/">&larr; Back to the board</a></p>`;
}
