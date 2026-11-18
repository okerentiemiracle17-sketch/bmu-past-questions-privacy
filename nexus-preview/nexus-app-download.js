// The official Android APKs are published as assets of GitHub Release v1.0.3.
// Links go directly to GitHub Releases; cross-origin HEAD checks are not reliable.
// Store badges remain informational until their official listings are verified.
(function () {
  const anchors = document.querySelectorAll('[data-apk-link]');
  const expectedRelease = 'https://github.com/okerentiemiracle17-sketch/bmu-past-questions-privacy/releases/download/v1.0.3/';
  let available = 0;
  for (const a of anchors) {
    if ((a.getAttribute('href') || '').startsWith(expectedRelease)) {
      a.removeAttribute('aria-disabled');
      a.removeAttribute('download');
      a.setAttribute('rel', 'noopener noreferrer');
      available++;
    } else {
      a.setAttribute('aria-disabled', 'true');
    }
    a.addEventListener('click', (e) => {
      if (a.getAttribute('aria-disabled') === 'true') e.preventDefault();
    });
  }
  const status = document.getElementById('nexusApkStatus');
  if (status) status.textContent = available === 2
    ? 'Nexus BMU v1.0.3 is available for 32-bit and 64-bit ARM Android phones. Choose the version compatible with your device.'
    : 'Android download links are being configured. You can continue studying in your browser.';
})();
