function guestbookReplaceDocument(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

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
}

function initGuestbook() {
  const form = document.getElementById('sign-form');
  const status = document.getElementById('form-status');

  if (!form || !status) return;

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

        // Reload via fetch + replace to avoid "Confirm Form Resubmission"
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
                window.replaceDocument(html);
              } else {
                guestbookReplaceDocument(html);
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGuestbook);
} else {
  initGuestbook();
}
