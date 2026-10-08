// Anonymous website activity: one ping per page view and per Book / Call /
// Text tap, read back on the /admin "Website activity" card. No cookies, no
// IDs, no personal data. Fails silently; never blocks a click.
(function () {
  if (navigator.webdriver) return; // headless checks and bots
  var send = function (t) {
    try {
      var body = JSON.stringify({ t: t, p: location.pathname });
      if (navigator.sendBeacon) navigator.sendBeacon('/api/t', new Blob([body], { type: 'application/json' }));
      else fetch('/api/t', { method: 'POST', headers: { 'content-type': 'application/json' }, body: body, keepalive: true });
    } catch (e) {}
  };
  send('view');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/^\/book(\?|$)/.test(h) || /triplerdump\.com\/book/.test(h)) send('book_click');
    else if (/^tel:/i.test(h)) send('call_click');
    else if (/^sms:/i.test(h)) send('text_click');
  }, true);
})();
