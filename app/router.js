// The hash router: one route per surface, each reachable by link and by its own URL.
//
//   #/                              the bounty board
//   #/bounty/<slug>                 one bounty
//   #/bounty/<slug>/leaderboard     that bounty's leaderboard (?view=overall|performance)
//   #/u/<handle>                    an account's public profile
//
// window.__shotReady is false while a page loads and true once its data is on screen, so a
// screenshot script knows when to capture. A 30-second ticker refreshes every time-left label
// in place, without rebuilding the page or refetching anything.

import { getBounties, getBounty, getLeaderboard, getProfile } from './api.js';
import { timeLeft } from './format.js';
import { board, boardResults, bounty, leaderboard, notFound, profile } from './views.js';

const app = document.getElementById('app');
const PAGE_SIZE = 50;

const boardState = { query: '', sort: 'deadline', openOnly: true, closingSoon: false };
let boardData = null;
let lbLimit = PAGE_SIZE;
let lastRoute = '';

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, params: new URLSearchParams(query ?? '') };
}

function setNav(route) {
  document.querySelectorAll('.topnav a').forEach((a) => {
    a.setAttribute('aria-current', a.dataset.nav === route ? 'page' : 'false');
  });
}

function showLoading() {
  window.__shotReady = false;
  app.innerHTML = '<p class="loading">Loading…</p>';
}

function showError(err, retry) {
  app.innerHTML = `<p class="error">Couldn’t load this page: ${err.status ? `make.fun answered ${err.status}` : 'the network failed'}. Check your connection and try again.</p>
    <p><button class="btn" id="retry">Retry</button> <a href="#/">&larr; Back to the board</a></p>`;
  document.getElementById('retry')?.addEventListener('click', retry);
  window.__shotReady = true;
}

function refreshBoardResults() {
  const box = document.getElementById('board-results');
  if (box && boardData) box.innerHTML = boardResults(boardData, boardState);
}

function wireBoard() {
  const search = document.getElementById('board-search');
  const sort = document.getElementById('board-sort');
  const openBtn = document.getElementById('board-open');
  const closingBtn = document.getElementById('board-closing');
  search?.addEventListener('input', () => {
    boardState.query = search.value;
    refreshBoardResults();
  });
  sort?.addEventListener('change', () => {
    boardState.sort = sort.value;
    refreshBoardResults();
  });
  openBtn?.addEventListener('click', () => {
    boardState.openOnly = !boardState.openOnly;
    openBtn.setAttribute('aria-pressed', String(boardState.openOnly));
    refreshBoardResults();
  });
  closingBtn?.addEventListener('click', () => {
    boardState.closingSoon = !boardState.closingSoon;
    closingBtn.setAttribute('aria-pressed', String(boardState.closingSoon));
    refreshBoardResults();
  });
}

function wireLeaderboard() {
  document.getElementById('lb-more')?.addEventListener('click', () => {
    lbLimit += PAGE_SIZE;
    render(false);
    document.getElementById('lb-more')?.scrollIntoView({ block: 'center' });
  });
}

async function render(scrollTop = true) {
  const { parts, params } = parseHash();
  const routeKey = parts.join('/');
  if (routeKey !== lastRoute) lbLimit = PAGE_SIZE;
  lastRoute = routeKey;
  showLoading();

  try {
    if (parts.length === 0) {
      setNav('board');
      document.title = 'make.fun bounties';
      boardData = await getBounties();
      app.innerHTML = board(boardData, boardState);
      wireBoard();
    } else if (parts[0] === 'bounty' && parts[1] && parts[2] === 'leaderboard') {
      const slug = decodeURIComponent(parts[1]);
      const view = params.get('view') || undefined;
      const data = await getLeaderboard(slug, view);
      setNav('');
      document.title = `${data.competition?.title ?? slug} — leaderboard | make.fun bounties`;
      app.innerHTML = leaderboard(data, slug, lbLimit);
      wireLeaderboard();
    } else if (parts[0] === 'bounty' && parts[1]) {
      const slug = decodeURIComponent(parts[1]);
      const data = await getBounty(slug);
      setNav('');
      document.title = `${data.title} | make.fun bounties`;
      app.innerHTML = bounty(data);
    } else if (parts[0] === 'u' && parts[1]) {
      const handle = decodeURIComponent(parts[1]);
      const data = await getProfile(handle);
      setNav('');
      document.title = `${data.display_name ?? data.handle} (@${data.handle}) | make.fun bounties`;
      app.innerHTML = profile(data);
    } else {
      setNav('');
      document.title = 'Not found | make.fun bounties';
      app.innerHTML = notFound('Page');
    }
  } catch (err) {
    if (err.status === 404) {
      const what = parts[0] === 'u' ? 'Account' : parts[0] === 'bounty' ? 'Bounty' : 'Page';
      app.innerHTML = notFound(what, decodeURIComponent(parts[1] ?? ''));
    } else {
      showError(err, () => render());
      return;
    }
  }

  if (scrollTop) window.scrollTo(0, 0);
  window.__shotReady = true;
}

// Refresh every time-left label in place, twice a minute, without a rebuild or a refetch.
setInterval(() => {
  document.querySelectorAll('[data-deadline]').forEach((el) => {
    el.textContent = timeLeft(el.dataset.deadline);
  });
}, 30_000);

export function start() {
  window.addEventListener('hashchange', () => render());
  render();
}
