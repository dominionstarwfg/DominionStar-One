
(() => {
  const forms = [
    {
      form: document.getElementById('consultationForm'),
      button: document.getElementById('consultationSubmit'),
      status: document.getElementById('consultationStatus')
    },
    {
      form: document.getElementById('appointmentForm'),
      button: document.getElementById('appointmentSubmit'),
      status: document.getElementById('appointmentStatus')
    }
  ].filter(item => item.form);

  const encode = data => new URLSearchParams(data).toString();

  for (const item of forms) {
    const { form, button, status } = item;

    const dateInput = form.querySelector('input[type="date"]');
    if (dateInput) {
      dateInput.min = new Date().toISOString().split('T')[0];
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();

      if (!form.reportValidity()) return;

      button.disabled = true;
      button.textContent = 'Submitting…';
      status.textContent = 'Sending your request securely…';
      status.className = 'form-status show info';

      try {
        const response = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encode(new FormData(form))
        });

        if (!response.ok) throw new Error('Submission was not accepted.');

        form.reset();
        status.innerHTML =
          '<strong>Request received.</strong> Your information was submitted successfully. ' +
          'A DominionStar professional will follow up using your selected contact method.';
        status.className = 'form-status show success';
        button.textContent = 'Request Received ✓';
      } catch (error) {
        status.textContent =
          'We could not submit the request. Please check your connection and try again.';
        status.className = 'form-status show error';
        button.textContent = 'Try Again';
      } finally {
        button.disabled = false;
      }
    });
  }
})();
