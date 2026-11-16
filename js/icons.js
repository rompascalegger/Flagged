/* =========================================================
   FLAGGED – Symbole (eigene SVG-Zeichnungen der Kartensymbole)
   ========================================================= */
(function () {
  const S = (inner, vb = '0 0 24 24') =>
    `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;

  const arrowHead = (x, y, rot) =>
    `<path d="M0,-3.2 L3,0.6 L-3,0.6Z" transform="translate(${x} ${y}) rotate(${rot})" fill="currentColor"/>`;

  const cross4 = `<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M12 5.5V18.5M5.5 12H18.5"/></g>
      ${arrowHead(12, 3.6, 0)}${arrowHead(12, 20.4, 180)}${arrowHead(3.6, 12, -90)}${arrowHead(20.4, 12, 90)}`;
  const diag4 = `<g stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
      <path d="M7 7L17 17M17 7L7 17"/></g>
      ${arrowHead(5.4, 5.4, -45)}${arrowHead(18.6, 18.6, 135)}${arrowHead(18.6, 5.4, 45)}${arrowHead(5.4, 18.6, -135)}`;
  const horiz = `<g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M5 12H19"/></g>
      ${arrowHead(3.4, 12, -90)}${arrowHead(20.6, 12, 90)}<circle cx="12" cy="12" r="2.2" fill="currentColor"/>`;
  const all8 = `<g stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none">
      <path d="M12 6V18M6 12H18M8 8L16 16M16 8L8 16"/></g>
      ${arrowHead(12, 3.8, 0)}${arrowHead(12, 20.2, 180)}${arrowHead(3.8, 12, -90)}${arrowHead(20.2, 12, 90)}
      ${arrowHead(6.3, 6.3, -45)}${arrowHead(17.7, 17.7, 135)}${arrowHead(17.7, 6.3, 45)}${arrowHead(6.3, 17.7, -135)}`;

  const ring = (cx = 12, cy = 12, r = 6) => `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#6b5cff" stroke-width="3.2"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#c9b8ff" stroke-width="1.2"/>
      <circle cx="${cx}" cy="${cy}" r="${r - 2.6}" fill="#0b0a1c"/>`;

  const badge = (bg, rim, text, fs = 9, extra = '') => `
      <rect x="4" y="2.5" width="16" height="19" rx="3" fill="${bg}" stroke="${rim}" stroke-width="1.6"/>
      <rect x="6" y="4.5" width="12" height="15" rx="2" fill="none" stroke="rgba(255,255,255,.25)" stroke-width=".8"/>
      <text x="12" y="15.6" text-anchor="middle" font-family="Cinzel,serif" font-weight="900" font-size="${fs}" fill="#fff">${text}</text>${extra}`;

  const wallShape = (label) => `
      <path d="M3 6.5H21V19H3Z" fill="#3a3a3f" stroke="#cfcfd6" stroke-width="1.2"/>
      <path d="M3 10.6H21M3 14.8H21M8 6.5V10.6M15 6.5V10.6M11.5 10.6V14.8M6 14.8V19M17 14.8V19" stroke="#8d8d96" stroke-width=".9"/>
      ${label ? `<rect x="7.5" y="8.4" width="9" height="9" rx="1.5" fill="#111" stroke="#cfcfd6" stroke-width=".8"/>
      <text x="12" y="15.5" text-anchor="middle" font-family="Cinzel,serif" font-weight="900" font-size="${label.length > 1 ? 5.2 : 7.5}" fill="#fff">${label}</text>` : ''}`;

  const hood = (x = 12, s = 1, op = 1) => `
      <g transform="translate(${x} 12) scale(${s})" opacity="${op}">
        <path d="M-7 8 C-7 0,-5 -8,0 -9 C5 -8,7 0,7 8Z" fill="currentColor"/>
        <path d="M-3.6 3 C-3.6 -2,-2 -4.6,0 -4.6 C2 -4.6,3.6 -2,3.6 3Z" fill="#0b0b0f"/>
        <circle cx="-1.3" cy="-0.6" r=".7" fill="#7de3d0"/><circle cx="1.3" cy="-0.6" r=".7" fill="#7de3d0"/>
      </g>`;

  const ICONS = {
    MOVEMENT_STRAIGHT: S(cross4),
    MOVEMENT_DIAGONAL: S(diag4),
    MOVEMENT_HORIZONTAL: S(horiz),
    MOVEMENT_ALL: S(all8),
    MOVE: S(`<path d="M7 3H12.5V12.5L19.5 15.2C20.6 15.6 21 16.6 21 17.6V20H4.2C3.6 20 3.2 19.6 3.2 19V16.8L7 13.2Z"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3.2 17.4H21" stroke="currentColor" stroke-width="1.6"/>`),
    SNARED: S(`<path d="M7 3H12.5V12.5L19.5 15.2C20.6 15.6 21 16.6 21 17.6V20H4.2C3.6 20 3.2 19.6 3.2 19V16.8L7 13.2Z"
      fill="#8fd3ff" stroke="#dff4ff" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M5 8L10 6M5 11L11 9M14 17L18 19" stroke="#2a6f9e" stroke-width="1.3"/>
      <circle cx="5" cy="5" r="1.2" fill="#dff4ff"/><circle cx="19" cy="12" r="1" fill="#dff4ff"/>`),
    TELEPORT: S(ring()),
    TELEPORT_ALL: S(`${ring(12, 12, 5)}<g fill="#c9b8ff">${arrowHead(12, 2.6, 0)}${arrowHead(12, 21.4, 180)}${arrowHead(2.6, 12, -90)}${arrowHead(21.4, 12, 90)}
      ${arrowHead(5.4, 5.4, -45)}${arrowHead(18.6, 18.6, 135)}${arrowHead(18.6, 5.4, 45)}${arrowHead(5.4, 18.6, -135)}</g>`),
    TELEPORT_STRAIGHT: S(`${ring(12, 12, 5)}<g fill="#c9b8ff">${arrowHead(12, 2.6, 0)}${arrowHead(12, 21.4, 180)}${arrowHead(2.6, 12, -90)}${arrowHead(21.4, 12, 90)}</g>`),
    M1: S(badge('#a3172f', '#ff6b7f', '−1')),
    M2: S(badge('#a3172f', '#ff6b7f', '−2')),
    M3: S(badge('#a3172f', '#ff6b7f', '−3')),
    MX: S(badge('#a3172f', '#ff6b7f', '−X')),
    P1: S(badge('#17793b', '#7dffad', '+1')),
    P2: S(badge('#17793b', '#7dffad', '+2')),
    P3: S(badge('#17793b', '#7dffad', '+3')),
    PLAY1: S(badge('#a8741a', '#ffd76b', 'PLAY', 6.2)),
    PLAY2: S(badge('#a8741a', '#ffd76b', 'PLAY', 6.2)),
    DONT_PLAY: S(badge('#5d0d17', '#ff4d5e', 'PLAY', 6.2, '<path d="M5 20L19 4" stroke="#ff4d5e" stroke-width="2.4"/>')),
    ANTIKONTER: S(`<path d="M12 2.5L20 5.5V11.5C20 16.5 16.5 19.9 12 21.5C7.5 19.9 4 16.5 4 11.5V5.5Z" fill="#2b2b33" stroke="#d6d6de" stroke-width="1.4"/>
      <path d="M13.5 4.5L9 12H12.5L10.5 19.5L16 10.5H12.5Z" fill="#ff3b4e" stroke="#ffd0d5" stroke-width=".6"/>`),
    FLAG: S(`<path d="M5 2V22" stroke="#d9b45a" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M5.8 3.5C9 2 12 5.5 15.5 4C17.5 3.2 19 3.3 20.5 4V13C19 12.3 17.5 12.2 15.5 13C12 14.5 9 11 5.8 12.5Z" fill="#e8a52a" stroke="#ffe39a" stroke-width=".9"/>
      <path d="M11 6.5L12.6 9.6L10 9.2L12.8 7.6L13 10.4Z" fill="#7a3d06"/>`),
    TRAP: S(`<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2"/>
      <path d="M4.5 13H19.5" stroke="currentColor" stroke-width="1.6"/>
      <path d="M6 13L7.5 9.5L9 13L10.5 9.5L12 13L13.5 9.5L15 13L16.5 9.5L18 13" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M6 13L7.5 16.5L9 13L10.5 16.5L12 13L13.5 16.5L15 13L16.5 16.5L18 13" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <path d="M12 2V5" stroke="currentColor" stroke-width="2"/>`),
    BEGLEITER: S(`<g fill="currentColor"><ellipse cx="12" cy="15.5" rx="5" ry="4.3"/><ellipse cx="6" cy="10" rx="2" ry="2.6"/>
      <ellipse cx="18" cy="10" rx="2" ry="2.6"/><ellipse cx="9.3" cy="5.8" rx="1.9" ry="2.5"/><ellipse cx="14.7" cy="5.8" rx="1.9" ry="2.5"/></g>`),
    CLONE: S(hood(12, 1)),
    CLONES: S(`${hood(9, .85, .7)}${hood(15, .85, 1)}`),
    WALL1: S(wallShape('1')),
    WALL3: S(wallShape('3')),
    WALL4: S(wallShape('4')),
    WALLS: S(wallShape('')),
    ALL_WALLS: S(wallShape('ALL')),
    LOS: S(`<path d="M2 12C5 7 8.5 5 12 5S19 7 22 12C19 17 15.5 19 12 19S5 17 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>
      <path d="M12 1.5V5M12 19V22.5M.5 12H2M22 12H23.5" stroke="currentColor" stroke-width="1.4"/>`),
    PORTALE: S(`<g><path d="M2 21V10C2 6 4 4 6.5 4S11 6 11 10V21Z" fill="#1d2a6b" stroke="#9fb3ff" stroke-width="1.2"/>
      <path d="M4 20V11C4 8 5 6.6 6.5 6.6S9 8 9 11V20Z" fill="#5a7cff" opacity=".85"/>
      <path d="M13 21V10C13 6 15 4 17.5 4S22 6 22 10V21Z" fill="#1d2a6b" stroke="#9fb3ff" stroke-width="1.2"/>
      <path d="M15 20V11C15 8 16 6.6 17.5 6.6S20 8 20 11V20Z" fill="#5a7cff" opacity=".85"/></g>`),
    ABSTAND2: S(`<path d="M2 6V18M22 6V18" stroke="currentColor" stroke-width="2"/><path d="M5 12H19" stroke="currentColor" stroke-width="2"/>
      ${arrowHead(4.4, 12, -90)}${arrowHead(19.6, 12, 90)}<rect x="9" y="9.5" width="6" height="5" rx="1" fill="currentColor"/>`),
    UMFANG: S(`<rect x="2.5" y="2.5" width="19" height="19" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.4 1.6"/>
      <path d="M6 18L18 6M6 13L13 6M11 18L18 11" stroke="currentColor" stroke-width="1.2" opacity=".75"/>
      <rect x="9" y="9" width="6" height="6" fill="currentColor"/>`),
    MODE: S(`<rect x="1.5" y="6" width="21" height="12" rx="2.5" fill="#222" stroke="#e7e7ee" stroke-width="1.2"/>
      <text x="12" y="14.6" text-anchor="middle" font-family="Cinzel,serif" font-weight="900" font-size="6.5" fill="#fff">MODE</text>`),
    MOVE_STRAIGHT: S(`<g transform="translate(12 12) scale(.62) translate(-12 -12)">${wallShape('')}</g>
      <g fill="currentColor">${arrowHead(12, 2.6, 0)}${arrowHead(12, 21.4, 180)}${arrowHead(2.6, 12, -90)}${arrowHead(21.4, 12, 90)}</g>`),
    ADDITIONAL: S(`<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7V17M7 12H17" stroke="currentColor" stroke-width="2.2"/>`)
  };

  const LABELS = {
    MOVEMENT_STRAIGHT: 'Gerade Bewegung (1 Feld waagrecht/senkrecht)',
    MOVEMENT_DIAGONAL: 'Diagonale Bewegung',
    MOVEMENT_HORIZONTAL: 'Horizontale Bewegung (nur links/rechts)',
    MOVEMENT_ALL: 'Bewegung in alle Richtungen (inkl. diagonal)',
    MOVE: 'Bewegung (Auslöser: nach einer Bewegung)',
    SNARED: 'Festgesetzt – kann sich nicht bewegen',
    TELEPORT: 'Teleportation (ignoriert Wände)',
    TELEPORT_ALL: 'Teleportation in alle Richtungen',
    TELEPORT_STRAIGHT: 'Teleportation in gerader Richtung',
    M1: '1 Handkarte abwerfen', M2: '2 Handkarten abwerfen', M3: '3 Handkarten abwerfen', MX: 'Beliebig viele Handkarten abwerfen',
    P1: '1 Karte ziehen', P2: '2 Karten ziehen', P3: '3 Karten ziehen',
    PLAY1: 'Zusätzlich 1 Karte spielen', PLAY2: 'Zusätzlich Karten spielen',
    DONT_PLAY: 'Darf keine Karten spielen',
    ANTIKONTER: 'Antikonter – Gegner dürfen in diesem Zug keine Konterkarten spielen',
    FLAG: 'Flagge', TRAP: 'Falle', BEGLEITER: 'Begleiter (Fährtenwolf)',
    CLONE: 'Schattenklon', CLONES: 'Schattenklone',
    WALL1: '1 Wand', WALL3: '3 Wände', WALL4: '4 Wände', WALLS: 'Wände', ALL_WALLS: 'Alle Wände',
    LOS: 'Sichtlinie', PORTALE: 'Portale', ABSTAND2: 'Abstand in Feldern', UMFANG: 'Umkreis (Chebyshev)',
    MODE: 'Aktivierter Modus', MOVE_STRAIGHT: 'Wand gerade verschieben', ADDITIONAL: 'Zusätzlicher Effekt'
  };

  /* Große Symbole für Kartenkunst & Figuren */
  const SIGILS = {
    sword: S(`<path d="M12 1.5L14 4V15H10V4Z" fill="#e9e9f0" stroke="#fff" stroke-width=".4"/><path d="M12 2.5V14.5" stroke="#9aa" stroke-width=".6"/>
      <path d="M6 15H18V16.8H6Z" fill="#c9a24a"/><path d="M11 16.8H13V21H11Z" fill="#5a3b1c"/><circle cx="12" cy="22" r="1.4" fill="#c9a24a"/>`),
    dagger: S(`<path d="M12 2L13.6 5V13.5H10.4V5Z" fill="#e3f7f2" stroke="#fff" stroke-width=".4"/><path d="M7.5 13.5H16.5V15H7.5Z" fill="#2cae95"/>
      <path d="M11 15H13V20H11Z" fill="#222"/><path d="M12 20L13.5 22H10.5Z" fill="#2cae95"/>`),
    shield: S(`<path d="M12 2L20.5 5V11.5C20.5 16.8 16.8 20.2 12 22C7.2 20.2 3.5 16.8 3.5 11.5V5Z" fill="#2c3a63" stroke="#d6dcf0" stroke-width="1.2"/>
      <path d="M12 4.2L18.4 6.6V11.6C18.4 15.6 15.6 18.4 12 19.8Z" fill="#4c66b0"/><path d="M12 6V19" stroke="#d6dcf0" stroke-width=".8"/>`),
    bow: S(`<path d="M6 2C14 6 14 18 6 22" fill="none" stroke="#c49a5a" stroke-width="2"/><path d="M6 2V22" stroke="#eee" stroke-width=".6"/>
      <path d="M4 12H21" stroke="#ddd" stroke-width="1.2"/><path d="M21 12L18 10.3V13.7Z" fill="#ddd"/><path d="M4 12L2.5 10.5M4 12L2.5 13.5" stroke="#7aa33a" stroke-width="1.2"/>`),
    staff: S(`<path d="M8 22L15 7" stroke="#8a6a3a" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="5" r="3.4" fill="#5a7cff"/>
      <circle cx="16" cy="5" r="1.6" fill="#e1e8ff"/><path d="M16 0.5V2M20.5 5H19M16 9.5V8M11.5 5H13" stroke="#a9bbff" stroke-width=".8"/>`),
    hood: S(hood(12, 1.1)),
    helm: S(`<path d="M5 21V11C5 6 8 3 12 3S19 6 19 11V21H14.5V15H9.5V21Z" fill="#cfd3dc" stroke="#fff" stroke-width=".5"/>
      <path d="M7 12H17V13.8H13V18H11V13.8H7Z" fill="#20232b"/><path d="M12 3V9" stroke="#8a8f9c" stroke-width="1"/>`),
    eye: S(`<path d="M2 12C5.5 6.5 8.8 5 12 5S18.5 6.5 22 12C18.5 17.5 15.2 19 12 19S5.5 17.5 2 12Z" fill="#cfd6e6" stroke="#fff" stroke-width=".6"/>
      <circle cx="12" cy="12" r="4.6" fill="#29406e"/><circle cx="12" cy="12" r="2.4" fill="#05070c"/><circle cx="13.3" cy="10.7" r=".9" fill="#fff"/>`),
    cloud: S(`<path d="M6 18C3 18 2 15.5 3 13.6C3.6 12.4 5 11.8 6.2 12C6.4 8.5 9 6.5 12 6.8C14.6 7 16.2 8.8 16.6 10.6C19.6 10.4 21.6 12.6 21 15C20.6 16.8 19.2 18 17 18Z" fill="#9aa1ad" stroke="#e1e5ec" stroke-width=".8"/>`),
    banner: S(`<path d="M6 2V22" stroke="#c9a24a" stroke-width="1.6"/><path d="M6.8 3H19V14L15 12L12.9 15.5L10.8 12L6.8 14Z" fill="#8b1d26" stroke="#f2c96a" stroke-width=".8"/>
      <path d="M12.9 5.5L14 8.2L11.6 6.7H14.2L11.8 8.2Z" fill="#f2c96a"/>`),
    hourglass: S(`<path d="M6 2H18M6 22H18" stroke="#cfd3dc" stroke-width="1.6"/><path d="M7 2.8C7 8 11 10 11 12S7 16 7 21.2H17C17 16 13 14 13 12S17 8 17 2.8Z" fill="none" stroke="#cfd3dc" stroke-width="1.2"/>
      <path d="M9 19.5L12 15L15 19.5Z" fill="#e8a52a"/>`),
    coin: S(`<circle cx="12" cy="12" r="9" fill="#c9962c" stroke="#ffe39a" stroke-width="1.2"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="#7a5512" stroke-width="1"/>
      <path d="M12 7.5L13.2 10.6H16.4L13.8 12.6L14.8 15.8L12 13.8L9.2 15.8L10.2 12.6L7.6 10.6H10.8Z" fill="#7a5512"/>`),
    crystal: S(`<path d="M12 1.5L17 8L12 22.5L7 8Z" fill="#7fd6ff" stroke="#e8fbff" stroke-width=".8"/><path d="M12 1.5V22.5M7 8H17" stroke="#e8fbff" stroke-width=".5"/>
      <path d="M12 1.5L14.5 8L12 22.5Z" fill="#b6ecff" opacity=".7"/>`),
    rune: S(`<circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width=".7" stroke-dasharray="1.5 1"/>
      <path d="M12 4L14 12L12 20L10 12Z M4 12L12 10L20 12L12 14Z" fill="currentColor" opacity=".85"/>`),
    rotate: S(`<path d="M19 12A7 7 0 1 1 12 5H15" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 1.5L18.5 5L14 8.5Z" fill="currentColor"/>`),
    hand: S(`<path d="M8 21V11L5.5 8.4C4.7 7.5 5.6 6.2 6.7 6.8L9 9V4.5C9 3.3 10.8 3.3 10.8 4.5V9.5V3.6C10.8 2.4 12.6 2.4 12.6 3.6V9.5V4.4C12.6 3.2 14.4 3.2 14.4 4.4V10V6.4C14.4 5.2 16.2 5.2 16.2 6.4V14C16.2 18 14 21 11.5 21Z" fill="#d8c3a5" stroke="#fff" stroke-width=".5"/>`),
    deck: S(`<rect x="5" y="4" width="12" height="16" rx="2" fill="#30303a" stroke="#aaa" stroke-width=".8" transform="rotate(-8 11 12)"/>
      <rect x="7" y="3" width="12" height="16" rx="2" fill="#1b1b22" stroke="#e6e6ee" stroke-width="1"/><circle cx="13" cy="11" r="3" fill="none" stroke="#e6e6ee" stroke-width=".8"/><circle cx="13" cy="11" r="1.1" fill="#e6e6ee"/>`)
  };

  const tokenIcon = (name, cls = 'ic') => {
    const svg = ICONS[name];
    if (!svg) return `{${name}}`;
    return `<span class="${cls}" data-tip="${LABELS[name] || name}">${svg}</span>`;
  };

  function renderText(text) {
    return String(text || '')
      .replace(/\n/g, '<br>')
      .replace(/\{([A-Z0-9_]+)\}/g, (m, k) => tokenIcon(k));
  }

  window.FX_ICONS = { ICONS, LABELS, SIGILS, renderText, tokenIcon };
})();
