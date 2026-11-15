// Activate APK links only when the actual files exist at the website URL.
// Keep store badges informational until official store URLs are verified.
(async function () {
  const anchors = document.querySelectorAll('[data-apk-link]');
  let available = 0;
  for (const a of anchors) {
    const url = a.getAttribute('href');
    try {
      const response = await fetch(url, {method:'HEAD',cache:'no-store'});
      if (response.ok && (response.headers.get('content-type') || '').indexOf('text/html') === -1) {
        a.removeAttribute('aria-disabled');
        available++;
      }
    } catch (_) { /* Keep disabled until uploaded. */ }
    a.addEventListener('click', (e) => {
      if (a.getAttribute('aria-disabled') === 'true') e.preventDefault();
    });
  }
  const status = document.getElementById('nexusApkStatus');
  if (status) status.textContent = available === 2
    ? 'Both Android APK downloads are available. Choose the version compatible with your device.'
    : available === 1
    ? 'One Android APK is available; the other will be enabled when uploaded.'
    : 'Android download files have not been uploaded to this website yet. You can continue studying in your browser.';
})();
