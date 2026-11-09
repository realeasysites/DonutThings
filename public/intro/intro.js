// Donut Things entrance film. Plays once per visitor; add ?intro=1 to any URL to replay.
(function () {
  var KEY = 'dt-intro-seen-v3';
  var force = /[?&]intro=1\b/.test(location.search);
  var seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ((seen || reduced) && !force) return;

  var root = document.documentElement;
  var wrap = document.createElement('div');
  wrap.className = 'dt-intro';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'Donut Things Café intro video');

  var video = document.createElement('video');
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.preload = 'auto';
  video.poster = '/intro/intro-poster.jpg?v=3';
  [['/intro/intro.webm?v=3', 'video/webm'], ['/intro/intro.mp4?v=3', 'video/mp4']].forEach(function (s) {
    var source = document.createElement('source');
    source.src = s[0];
    source.type = s[1];
    video.appendChild(source);
  });

  var skip = button('Skip intro', 'dt-intro-skip');
  var sound = button('Sound on', 'dt-intro-sound');
  wrap.appendChild(video);
  wrap.appendChild(sound);
  wrap.appendChild(skip);
  root.classList.add('dt-intro-open');
  (document.body || root).appendChild(wrap);

  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    try { localStorage.setItem(KEY, '1'); } catch (e) {}
    root.classList.remove('dt-intro-open');
    wrap.classList.add('is-done');
    setTimeout(function () { video.pause(); wrap.remove(); }, 600);
  }

  function button(text, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.className = 'dt-intro-btn ' + cls;
    return b;
  }

  skip.addEventListener('click', finish);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') finish(); });
  sound.addEventListener('click', function () {
    video.muted = !video.muted;
    sound.textContent = video.muted ? 'Sound on' : 'Sound off';
  });
  video.addEventListener('ended', finish);
  video.addEventListener('error', finish, true);

  var attempt = video.play();
  if (attempt && attempt.catch) attempt.catch(finish); // Autoplay blocked: go straight to the site.

  // Safety net: a slow or stalled connection never traps someone behind the film.
  var started = false;
  video.addEventListener('playing', function () { started = true; });
  setTimeout(function () { if (!started) finish(); }, 4000);
  setTimeout(finish, 10000);
})();
