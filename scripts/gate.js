window.onloadTurnstileCallback = function () {
  const container = document.getElementById('cf-widget-container');
  if (!container) return;
  const siteKey = container.getAttribute('data-sitekey');
  if (!siteKey) {
    console.error('Site key not found');
    return;
  }

  // Detect mobile/touch for compact widget sizing
  const isMobile = window.innerWidth < 768;

  turnstile.render('#cf-widget-container', {
    sitekey: siteKey,
    callback: onTurnstileSuccess,
    'error-callback': onTurnstileError,
    'expired-callback': onTurnstileError,
    size: isMobile ? 'compact' : 'normal',
    appearance: 'always',
    theme: 'dark',
  });
};

function initTerminalRetry() {
  const input = document.getElementById('terminal-retry-input');
  if (!input) return;

  input.style.width = '0ch'; // Initial width for cursor placement

  // Ensure input is focused
  input.focus();
  document.addEventListener('click', () => input.focus());

  input.addEventListener('input', () => {
    input.style.width = input.value.length + 'ch';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = input.value.toUpperCase();
      if (val === 'Y') {
        location.reload();
      } else if (val === 'N') {
        window.location.href = '/';
      } else {
        input.value = ''; // Reset if invalid
      }
    }
  });

  // Keep input focused even on blur
  input.addEventListener('blur', () => {
    setTimeout(() => input.focus(), 100);
  });
}

window.replaceDocument = function (html, sessionToken) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const newContent = doc.querySelector('.main-content-body-guestbook');
  const oldContent = document.querySelector('.main-content-body-guestbook');

  if (newContent && oldContent) {
    oldContent.innerHTML = newContent.innerHTML;

    // Extract sessionToken from hidden input if not provided manually
    if (!sessionToken) {
      const tokenInput = oldContent.querySelector('input[name="sessionToken"]');
      if (tokenInput) {
        sessionToken = tokenInput.value;
      }
    }

    // Update URL if sessionToken is found (for F5 persistence)
    if (sessionToken) {
      const url = new URL(window.location.href);
      url.searchParams.set('sessionToken', sessionToken);
      window.history.replaceState({}, '', url.toString());
    }

    // Re-execute any scripts if they are in the new content
    const scripts = newContent.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) =>
        newScript.setAttribute(attr.name, attr.value)
      );
      newScript.textContent = oldScript.textContent;
      document.body.appendChild(newScript);
    });

    // Re-initialize guestbook logic if present
    if (window.initGuestbook) {
      window.initGuestbook();
    }

    // After replaceDocument is done, check for retry input
    initTerminalRetry();
  } else {
    // Fallback to full page refresh if structure is different
    window.location.reload();
  }
};

function onTurnstileError() {
  // Fetch server-rendered error page
  fetch('/guestbook.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 'cf-turnstile-response': 'CLIENT_ERROR' }),
  })
    .then((res) => res.text())
    .then((html) => {
      window.replaceDocument(html);
    })
    .catch((e) => {
      console.error('Critical failure:', e);
      window.location.href = '/500.html';
    });
}

function onTurnstileSuccess(token) {
  fetch('/guestbook.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 'cf-turnstile-response': token }),
  })
    .then((response) => {
      if (!response.ok) throw new Error('Network response was not ok');
      return response.text();
    })
    .then((html) => {
      window.replaceDocument(html);
    })
    .catch((e) => {
      console.error('Critical failure:', e);
      // Fallback to 500 page if fetch fails
      window.location.href = '/500.html';
    });
}
