// make.fun's public API: read-only GET requests, open to any origin (CORS).
// The full API is described at https://make.fun/api/openapi.json.
//
// Every answer is cached in memory and revalidated with its ETag, so a view that is
// revisited within a minute costs no request at all, and a later visit costs one cheap
// 304 instead of a full download. The API's ETags turn over each minute, so stale data
// can never linger long.

const API = 'https://make.fun/api';
const TTL_MS = 60_000; // a cached answer is fresh for one minute
const cache = new Map(); // url -> { etag, body, fetchedAt }

async function get(path) {
  const url = API + path;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.body;

  const headers = {};
  if (hit?.etag) headers['If-None-Match'] = hit.etag;
  const res = await fetch(url, { headers });
  if (res.status === 304 && hit) {
    hit.fetchedAt = Date.now();
    return hit.body;
  }
  if (!res.ok) {
    const err = new Error(`make.fun API ${res.status} for ${path}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  cache.set(url, { etag: res.headers.get('ETag'), body, fetchedAt: Date.now() });
  return body;
}

// The open bounties, newest deadlines first is left to the board's sort.
export const getBounties = () => get('/competitions?status=open&limit=100');

// One bounty, by its slug. The answer carries the live pot, the rewards table, rules and dates.
export const getBounty = (slug) => get(`/competitions/${encodeURIComponent(slug)}`);

// A bounty's leaderboard. `view` is 'overall' or 'performance' where the bounty offers both.
// The answer lists every entry, so the view paginates it on the client instead of refetching.
export const getLeaderboard = (slug, view) =>
  get(`/competitions/${encodeURIComponent(slug)}/leaderboard${view ? `?view=${encodeURIComponent(view)}` : ''}`);

// An account's public profile, with its record and its entries.
export const getProfile = (handle) => get(`/profiles/${encodeURIComponent(handle)}`);
