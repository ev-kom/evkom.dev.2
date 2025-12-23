window.guestbookReplaceDocument = function (html, sessionToken) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const newContent = doc.querySelector('.main-content-body-guestbook');
  const oldContent = document.querySelector('.main-content-body-guestbook');

  if (newContent && oldContent) {
    oldContent.innerHTML = newContent.innerHTML;

    // Update URL if sessionToken is provided (for F5 persistence)
    if (sessionToken) {
      const url = new URL(window.location.href);
      url.searchParams.set('sessionToken', sessionToken);
      window.history.replaceState({}, '', url.toString());
    }

    // Re-initialize logic
    if (window.initGuestbook) window.initGuestbook();
  } else {
    // Fallback to full page refresh if structure is different
    window.location.reload();
  }
};

window.initGuestbook = function () {
  const form = document.getElementById('sign-form');
  const status = document.getElementById('form-status');

  if (!form || !status) return;

  // Prevent double binding
  if (form.dataset.bound) return;
  form.dataset.bound = 'true';

  // Submit Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    status.textContent = 'TRANSMITTING DATA...';
    status.style.color = '';

    const payload = {
      name: form.name.value,
      message: form.message.value,
      sessionToken: form.sessionToken.value,
    };

    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        status.textContent = 'TRANSMISSION COMPLETE.';
        status.style.color = 'green';
        form.reset();

        const token = form.sessionToken.value;
        setTimeout(() => {
          fetch(window.location.pathname, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken: token }),
          })
            .then((r) => r.text())
            .then((html) => {
              if (window.replaceDocument) {
                window.replaceDocument(html, token);
              } else {
                window.guestbookReplaceDocument(html, token);
              }
            })
            .catch((err) => {
              console.error('Reload failed', err);
              status.textContent = 'RELOAD FAILED.';
              status.style.color = 'red';
            });
        }, 100);
      } else {
        throw new Error(data.error || 'Error');
      }
    } catch (err) {
      status.textContent = err.message;
      status.style.color = 'red';
    }
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', window.initGuestbook);
} else {
  window.initGuestbook();
}
