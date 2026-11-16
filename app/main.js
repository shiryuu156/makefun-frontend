// Boot the app: the header's account search, then the hash router.
// No framework, no build step — the modules under app/ are the whole app.

import { start } from './router.js';

const search = document.getElementById('profile-search');
const handleInput = document.getElementById('handle-input');

search?.addEventListener('submit', (event) => {
  event.preventDefault();
  const handle = handleInput.value.trim().replace(/^@/, '');
  if (handle) location.hash = `#/u/${encodeURIComponent(handle)}`;
});

start();
