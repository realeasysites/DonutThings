(function () {
  'use strict';
  var y = document.getElementById('yr');
  if (y) y.textContent = new Date().getFullYear();

  var form = document.getElementById('boxForm');
  if (!form) return;
  var msg = document.getElementById('formMsg');
  var btn = form.querySelector('button[type=submit]');

  var d = new Date();
  var today = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  form.pickup_date.min = today;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-msg';
    var data = {
      name: form.name.value,
      phone: form.phone.value,
      email: form.email.value,
      pickup_date: form.pickup_date.value,
      pickup_time: form.pickup_time.value,
      quantity: form.quantity.value,
      occasion: form.occasion.value,
      details: form.details.value,
      company: form.company.value,
      flavors: Array.prototype.map.call(form.querySelectorAll('input[name=flavors]:checked'), function (c) { return c.value; }),
      source: new URLSearchParams(location.search).get('utm_source') || document.referrer || 'direct',
    };
    btn.disabled = true;
    fetch('/api/box', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        btn.disabled = false;
        if (x.ok) {
          form.reset();
          msg.textContent = 'Request sent. We’ll call or text to confirm your box.';
        } else {
          msg.className = 'form-msg err';
          msg.textContent = x.j.error || 'That didn’t send. Call the shop at (207) 591-7112.';
        }
      })
      .catch(function () {
        btn.disabled = false;
        msg.className = 'form-msg err';
        msg.textContent = 'That didn’t send. Check your connection or call (207) 591-7112.';
      });
  });
})();
