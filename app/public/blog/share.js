/* Share bar on blog posts: copy link, and the device's own share sheet where there is one. The share links work without this file. */
(function () {
  var bar = document.querySelector('.share');
  if (!bar) return;
  var url = bar.getAttribute('data-url'), title = bar.getAttribute('data-title');
  var status = bar.querySelector('.status'), copy = bar.querySelector('.copy'), nat = bar.querySelector('.native');
  function say(t) { status.textContent = t; setTimeout(function () { status.textContent = ''; }, 2500); }
  copy.addEventListener('click', function () {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { say('Link copied'); }, function () { say('Copy failed. Select the address bar instead.'); });
    } else {
      var t = document.createElement('textarea'); t.value = url; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { say(document.execCommand('copy') ? 'Link copied' : 'Copy failed. Select the address bar instead.'); } catch (e) { say('Copy failed. Select the address bar instead.'); }
      document.body.removeChild(t);
    }
  });
  if (navigator.share) {
    nat.hidden = false;
    nat.addEventListener('click', function () { navigator.share({ title: title, url: url }).catch(function () {}); });
  }
})();
