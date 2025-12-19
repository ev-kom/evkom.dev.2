document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sign-form');
  const status = document.getElementById('form-status');

  if (!form || !status) return;

  // Submit Form
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = 'Sending...';
    status.style.color = '';

    const payload = {
      name: form.name.value,
      message: form.message.value,
    };

    try {
      const res = await fetch('/api/guestbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        status.textContent = 'Posted!';
        status.style.color = 'green';
        form.reset();
        // Reload to show current entries (rendered via SSR)
        setTimeout(() => location.reload(), 1000);
      } else {
        throw new Error(data.error || 'Error');
      }
    } catch (err) {
      status.textContent = err.message;
      status.style.color = 'red';
    }
  });
});
