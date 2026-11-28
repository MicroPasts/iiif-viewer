import { formatTime } from './temporal.js';

export class MediaStage {
  constructor(container, item, resolveUrl) {
    this.container = container;
    this.abort = new AbortController();
    const { media } = item;
    const player = document.createElement(media.type);
    this.player = player;
    player.preload = 'metadata';
    if (media.type === 'video') player.playsInline = true;
    player.setAttribute('aria-label', item.label);
    if (media.tracks.length) player.crossOrigin = 'anonymous';
    if (media.type === 'video' && media.poster) player.poster = resolveUrl(media.poster, 'thumbnail');
    const source = document.createElement('source');
    if (media.url) source.src = resolveUrl(media.url, 'media');
    if (media.format) source.type = media.format;
    player.append(source);
    const tracks = [];
    for (const caption of media.tracks) {
      const track = document.createElement('track');
      track.kind = 'captions';
      track.src = resolveUrl(caption.url, 'annotation');
      track.label = caption.label;
      if (caption.language) track.srclang = caption.language;
      track.addEventListener('error', () => {
        this.error.textContent = 'Unable to load captions. Check the URL, WebVTT format and CORS permissions.';
      }, { signal: this.abort.signal });
      player.append(track);
      tracks.push(track);
    }
    const presentation = document.createElement('div');
    presentation.className = 'iiif-media-presentation';
    if (media.type === 'audio') {
      presentation.classList.add('iiif-media-audio');
      const icon = document.createElement('span');
      icon.className = 'iiif-media-audio-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '♪';
      const title = document.createElement('strong');
      title.textContent = item.label;
      presentation.append(icon, title);
    }
    presentation.append(player);
    const controls = document.createElement('div');
    controls.className = 'iiif-media-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Playback controls');
    controls.innerHTML = `
      <div class="iiif-media-bar">
        <button type="button" class="iiif-media-play" data-media="play" aria-label="Play"></button>
        <input data-media="seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="Seek" disabled>
        <span class="iiif-media-time"><span data-media="elapsed">0:00</span> / <span data-media="duration">--:--</span></span>
        <button type="button" data-media="mute" aria-label="Mute"></button>
        <details class="iiif-media-options">
          <summary aria-label="Playback options" title="Playback options">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"></path>
            </svg>
          </summary>
          <div class="iiif-media-options-panel">
            <label>Volume <input data-media="volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="Volume"></label>
            <label>Speed <select data-media="speed" aria-label="Playback speed">
              <option value="0.5">0.5×</option><option value="0.75">0.75×</option>
              <option value="1" selected>1×</option><option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option><option value="2">2×</option>
            </select></label>
          </div>
        </details>
      </div>`;
    const options = controls.querySelector('.iiif-media-options-panel');
    if (tracks.length) {
      const label = document.createElement('label');
      label.append('Captions ');
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Captions');
      const off = document.createElement('option');
      off.value = '';
      off.textContent = 'Off';
      select.append(off);
      tracks.forEach((track, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.textContent = media.tracks[index].label;
        select.append(option);
      });
      label.append(select);
      options.append(label);
      select.addEventListener('change', () => {
        tracks.forEach((track, index) => {
          if (track.track) track.track.mode = select.value === String(index) ? 'showing' : 'disabled';
        });
      }, { signal: this.abort.signal });
    }
    const play = controls.querySelector('[data-media="play"]');
    const mute = controls.querySelector('[data-media="mute"]');
    const volume = controls.querySelector('[data-media="volume"]');
    const seek = controls.querySelector('[data-media="seek"]');
    const elapsed = controls.querySelector('[data-media="elapsed"]');
    const duration = controls.querySelector('[data-media="duration"]');
    const speed = controls.querySelector('[data-media="speed"]');
    const { signal } = this.abort;
    const optionsMenu = controls.querySelector('.iiif-media-options');
    optionsMenu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && optionsMenu.open) {
        event.preventDefault();
        event.stopPropagation();
        optionsMenu.open = false;
        optionsMenu.querySelector('summary').focus();
      }
    }, { signal });
    const updateTime = () => {
      const current = Number.isFinite(player.currentTime) ? player.currentTime : 0;
      const total = player.duration;
      const canSeek = Number.isFinite(total) && total > 0;
      seek.disabled = !canSeek;
      seek.max = canSeek ? String(total) : '0';
      seek.value = String(canSeek ? Math.min(current, total) : 0);
      seek.setAttribute('aria-valuetext', `${formatTime(current)} of ${canSeek ? formatTime(total) : 'unknown duration'}`);
      elapsed.textContent = formatTime(current);
      duration.textContent = canSeek ? formatTime(total) : '--:--';
    };
    const updatePlay = () => {
      const label = player.paused ? 'Play' : 'Pause';
      play.setAttribute('aria-label', label);
      play.title = label;
      play.innerHTML = player.paused
        ? '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>'
        : '<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zm8 0h4v14h-4z"></path></svg>';
    };
    const updateVolume = () => {
      const label = player.muted || player.volume === 0 ? 'Unmute' : 'Mute';
      mute.setAttribute('aria-label', label);
      mute.title = label;
      mute.innerHTML = label === 'Mute'
        ? '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"></path></svg>'
        : '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4zM16 9l5 6m0-6-5 6"></path></svg>';
      volume.value = String(player.muted ? 0 : player.volume);
      volume.setAttribute('aria-valuetext', `${Math.round(Number(volume.value) * 100)}%`);
    };
    play.addEventListener('click', () => {
      if (!player.paused) {
        player.pause();
      } else {
        if (this.error.textContent.startsWith('Unable to start playback.')) this.error.textContent = '';
        const result = player.play();
        result?.catch(() => {
          if (!signal.aborted) this.error.textContent = 'Unable to start playback. Check the media source and browser permissions.';
        });
      }
    }, { signal });
    mute.addEventListener('click', () => {
      if (player.muted || player.volume === 0) {
        if (player.volume === 0) player.volume = 1;
        player.muted = false;
      } else {
        player.muted = true;
      }
    }, { signal });
    volume.addEventListener('input', () => {
      player.volume = Number(volume.value);
      player.muted = false;
    }, { signal });
    seek.addEventListener('input', () => { player.currentTime = Number(seek.value); }, { signal });
    speed.addEventListener('change', () => { player.playbackRate = Number(speed.value); }, { signal });
    ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked'].forEach((event) =>
      player.addEventListener(event, updateTime, { signal }));
    ['play', 'pause', 'ended'].forEach((event) => player.addEventListener(event, updatePlay, { signal }));
    player.addEventListener('volumechange', updateVolume, { signal });
    player.addEventListener('ratechange', () => { speed.value = String(player.playbackRate); }, { signal });
    updateTime();
    updatePlay();
    updateVolume();
    this.status = document.createElement('p');
    this.status.setAttribute('role', 'status');
    this.error = document.createElement('p');
    this.error.setAttribute('role', 'alert');
    this.error.className = 'iiif-media-error';
    player.addEventListener('error', () => {
      this.error.textContent = 'Unable to load media. Check the URL, CORS permissions and browser codec support.';
    }, { signal: this.abort.signal });
    source.addEventListener('error', () => {
      this.error.textContent = 'Unable to load media. Check the URL, CORS permissions and browser codec support.';
    }, { signal: this.abort.signal });
    if (!media.url) this.error.textContent = 'This canvas has no media URL.';
    container.replaceChildren(presentation, controls, this.status, this.error);
  }

  seek(fragment) {
    this.fragment = fragment;
    this.status.textContent = `Selected time: ${formatTime(fragment.start)}${fragment.end === null ? '' : `–${formatTime(fragment.end)}`}`;
    this.pendingSeek?.abort();
    const apply = () => {
      const duration = this.player.duration;
      this.player.currentTime = Number.isFinite(duration) ? Math.min(fragment.start, duration) : fragment.start;
    };
    if (this.player.readyState >= 1) apply();
    else {
      this.pendingSeek = new AbortController();
      this.player.addEventListener('loadedmetadata', apply, { once: true, signal: this.pendingSeek.signal });
    }
  }

  destroy() {
    this.abort.abort();
    this.pendingSeek?.abort();
    this.player.pause();
    this.player.removeAttribute('src');
    this.player.replaceChildren();
    this.player.load();
    this.container.replaceChildren();
  }
}
