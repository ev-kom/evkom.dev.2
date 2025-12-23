window.onloadTurnstileCallback = function () {
  const container = document.getElementById('cf-widget-container');
  if (!container) return;
  const siteKey = container.getAttribute('data-sitekey');
  if (!siteKey) {
    console.error('Site key not found');
    return;
  }

  turnstile.render('#cf-widget-container', {
    sitekey: siteKey,
    callback: onTurnstileSuccess,
    'error-callback': onTurnstileError,
    'expired-callback': onTurnstileError,
    theme: 'light',
  });
};

window.replaceDocument = function (html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Replace document content
  document.documentElement.innerHTML = doc.documentElement.innerHTML;

  // Re-execute scripts
  const scripts = document.querySelectorAll('script');
  scripts.forEach((oldScript) => {
    const newScript = document.createElement('script');
    Array.from(oldScript.attributes).forEach((attr) =>
      newScript.setAttribute(attr.name, attr.value)
    );
    newScript.textContent = oldScript.textContent;
    oldScript.parentNode.replaceChild(newScript, oldScript);
  });
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
