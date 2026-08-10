(() => {
  const host = document.querySelector('#phone');
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const COLORS = {
    p: '#ff8ca8', r: '#f26158', o: '#ffad4f', y: '#ffd85a',
    g: '#6ecb86', m: '#42b8a7', b: '#63aee9', v: '#9d78d6',
    w: '#fffdf7', k: '#48515a', c: '#ffc9d6', n: '#c99a69'
  };
  const BEAD_DENSITY = 2;
  const LEVEL_TIME_SECONDS = 180;
  const COLOR_NAMES = { p: '樱花粉', r: '番茄红', o: '蜜橙', y: '柠檬黄', g: '草地绿', m: '薄荷绿', b: '天空蓝', v: '葡萄紫', w: '奶油白', k: '炭黑', c: '腮红粉', n: '焦糖棕' };
  const TEMPLATES = [
    { name: '小黄鸡', icon: '🐥', desc: '圆滚滚的第一颗拼豆', colors: ['y', 'o', 'k', 'c'], map: [
      '...yyyy...', '..yyyyyy..', '.yyyyyyyy.', '.yykyykyy.', '.yyyyyyyy.', '..yyyoyy..', '...yoo y...'.replace(' ', '.'), '....yyyy..', '...yyyyyy.', '..yy....yy'
    ] },
    { name: '薄荷小蛙', icon: '🐸', desc: '眨眨眼，慢慢拼', colors: ['g', 'm', 'w', 'k', 'c'], map: [
      '..gg..gg..', '.gggggggg.', 'ggwggggwgg', 'ggkggggkgg', 'gggggggggg', '.gggcccgg.', '..gggggg..', '.g..gg..g.', 'g...gg...g'
    ] },
    { name: '樱花小猫', icon: '🐱', desc: '把耳朵一颗颗拼出来', colors: ['p', 'w', 'k', 'c'], map: [
      '.p......p.', '.pp....pp.', '.pppppppp.', '.pwwppwwp.', '.pwkppkwp.', '.pppppppp.', '.ppccccpp.', '..pppppp..', '.p..pp..p.', 'p...pp...p'
    ] },
    { name: '彩虹小鱼', icon: '🐠', desc: '颜色会游进海里', colors: ['b', 'm', 'y', 'o', 'r', 'w', 'k'], map: [
      '.....bb...', '...bbbbb..', '.mmmmmybb.', 'mmwwwmyyb.', '.mmmmmybb.', '...bbbbb..', '.....bb...', '.......rr.', '......rrrr'
    ] },
    { name: '奶油熊', icon: '🐻', desc: '慢慢堆叠软乎乎', colors: ['n', 'w', 'k', 'c'], map: [
      '..nn..nn..', '.nnnnnnnn.', '.nnwwwwnn.', 'nnwnnnnw nn'.replace(' ', ''), 'nnwnknnw nn'.replace(' ', ''), '.nnnnnnnn.', '.nnnccnnn.', '..nnnnnn..', '.n..nn..n.', 'n...nn...n'
    ] },
    { name: '紫葡萄龟', icon: '🐢', desc: '完成后记得熨烫定型', colors: ['v', 'g', 'm', 'w', 'k'], map: [
      '....gg....', '...gggg...', '..vvvggvv.', '.vvvvvvvv.', 'vvvwwwwvvv', 'vvvwkkwvvv', '.vvvvvvvv.', '..vvvvvv..', '...v..v...', '..vv..vv..'
    ] }
  ];

  let W = 390, H = 780, DPR = 1;
  let screen = 'shelf';
  let level = 0;
  let placed = new Set();
  let selectedColor = null;
  let phase = 'placing';
  let toast = '';
  let toastUntil = 0;
  let particles = [];
  let ironProgress = 0;
  let resultStarted = 0;
  let last = performance.now();
  let board = null;
  let completed = loadCompleted();
  let wrongFlash = 0;
  let timeRemaining = LEVEL_TIME_SECONDS;
  let levelDeadline = 0;
  let tenSecondReminderShown = false;

  function loadCompleted() {
    try { return JSON.parse(localStorage.getItem('bead-beans-completed')) || []; } catch (_) { return []; }
  }
  function saveCompleted() { localStorage.setItem('bead-beans-completed', JSON.stringify(completed)); }
  function resize() {
    const rect = host.getBoundingClientRect();
    W = Math.max(320, rect.width || 390); H = Math.max(560, rect.height || 780);
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize); resize();

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function text(value, x, y, size, color, align = 'left', weight = '600') {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
  }
  function shadow(color = '#493c3030', blur = 12, y = 4) { ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetY = y; }
  function clearShadow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; }
  function templateCounts(tpl) {
    const c = {}; tpl.map.join('').split('').forEach(ch => { if (COLORS[ch]) c[ch] = (c[ch] || 0) + BEAD_DENSITY * BEAD_DENSITY; }); return c;
  }
  function gridDimensions(tpl) { return { rows: tpl.map.length * BEAD_DENSITY, cols: Math.max(...tpl.map.map(r => r.length)) * BEAD_DENSITY }; }
  function gridColor(tpl, row, col) { const line = tpl.map[Math.floor(row / BEAD_DENSITY)] || ''; return line[Math.floor(col / BEAD_DENSITY)] || '.'; }
  function cellKey(r, c) { return `${r}-${c}`; }
  function templateFilled(tpl) { return Object.values(templateCounts(tpl)).reduce((a, b) => a + b, 0); }
  function formatTime(seconds) { const safe = Math.max(0, seconds); return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`; }
  function showToast(value) { toast = value; toastUntil = performance.now() + 1500; }
  function isUnlocked(i) { return i === 0 || completed.includes(i - 1); }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fbf7ef'); g.addColorStop(1, '#e6f0eb'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const wash = ctx.createRadialGradient(W * .12, H * .18, 5, W * .12, H * .18, W * .65); wash.addColorStop(0, '#f6d9b83b'); wash.addColorStop(1, '#f6d9b800'); ctx.fillStyle = wash; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = .23; ctx.fillStyle = '#8eb9ae';
    for (let i = 0; i < 32; i++) { const x = (i * 79 + 24) % W; const y = (i * 111 + 42) % H; ctx.beginPath(); ctx.arc(x, y, 1.1 + i % 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function drawHeader(title, sub, back = false) {
    const left = back ? 62 : 24; text(title, left, 38, 25, '#263e3b', 'left', '800'); text(sub, left + 1, 64, 12, '#7a8b82', 'left', '600');
    if (back) { roundRect(18, 22, 34, 34, 17, '#ffffffcc'); text('‹', 35, 39, 23, '#49756b', 'center', '700'); }
  }
  function drawBead(x, y, radius, color, alpha = 1, selected = false) {
    ctx.save(); ctx.globalAlpha = alpha;
    const side = radius * .31;
    shadow('#5b4b4138', radius * .65, radius * .45); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y + side, radius, 0, Math.PI * 2); ctx.fill(); clearShadow();
    const bead = ctx.createRadialGradient(x - radius * .3, y - radius * .34, radius * .07, x, y, radius);
    bead.addColorStop(0, '#fff9'); bead.addColorStop(.22, color); bead.addColorStop(.72, color); bead.addColorStop(1, '#382c2335');
    ctx.fillStyle = bead; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffffb8'; ctx.lineWidth = Math.max(.8, radius * .1); ctx.beginPath(); ctx.arc(x, y - radius * .06, radius * .78, Math.PI * 1.05, Math.PI * 1.91); ctx.stroke();
    ctx.fillStyle = '#718a805c'; ctx.beginPath(); ctx.arc(x, y, radius * .45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#513d345c'; ctx.lineWidth = Math.max(.8, radius * .11); ctx.beginPath(); ctx.arc(x, y, radius * .45, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#d8eee3a8'; ctx.beginPath(); ctx.arc(x, y, radius * .29, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff8c'; ctx.lineWidth = Math.max(.6, radius * .06); ctx.beginPath(); ctx.arc(x, y - radius * .035, radius * .29, Math.PI * 1.03, Math.PI * 1.83); ctx.stroke();
    if (selected) { ctx.strokeStyle = '#776044'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + side * .2, radius + 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
  }
  function drawPeg(x, y, step, target) {
    const r = step * .23, h = step * .24;
    ctx.save();
    shadow('#52675f28', r * 1.1, r * .55); ctx.fillStyle = '#c7ddd8a8'; ctx.beginPath(); ctx.ellipse(x, y + h, r, r * .55, 0, 0, Math.PI * 2); ctx.fill(); clearShadow();
    const pillar = ctx.createLinearGradient(x - r, y, x + r, y + h);
    pillar.addColorStop(0, '#ffffffc0'); pillar.addColorStop(.3, '#d9efead2'); pillar.addColorStop(.68, '#96bbb5a6'); pillar.addColorStop(1, '#ffffff99');
    ctx.fillStyle = pillar; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r, y + h); ctx.quadraticCurveTo(x, y + h + r * .3, x + r, y + h); ctx.lineTo(x + r, y); ctx.closePath(); ctx.fill();
    const cap = ctx.createRadialGradient(x - r * .3, y - r * .28, 1, x, y, r);
    cap.addColorStop(0, '#ffffffef'); cap.addColorStop(.55, '#d8efeadc'); cap.addColorStop(1, '#8fb6afa8');
    ctx.fillStyle = cap; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffffc9'; ctx.lineWidth = Math.max(.6, step * .05); ctx.beginPath(); ctx.arc(x - r * .07, y - r * .08, r * .72, Math.PI * 1.04, Math.PI * 1.9); ctx.stroke();
    ctx.restore();
  }
  function miniTemplate(tpl, x, y, size) {
    const rows = tpl.map.length, cols = Math.max(...tpl.map.map(r => r.length)); const s = size / Math.max(rows, cols);
    for (let r = 0; r < rows; r++) for (let c = 0; c < tpl.map[r].length; c++) { const ch = tpl.map[r][c]; if (COLORS[ch]) { ctx.fillStyle = COLORS[ch]; ctx.beginPath(); ctx.arc(x + (c + .5) * s, y + (r + .5) * s, s * .38, 0, Math.PI * 2); ctx.fill(); } }
  }
  function drawFusedBead(x, y, radius, color, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(x - radius * .28, y - radius * .3, radius * .08, x, y, radius);
    g.addColorStop(0, '#ffffff9a'); g.addColorStop(.25, color); g.addColorStop(1, '#3d30272a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawIronedTemplate(tpl, x, y, size, alpha = 1) {
    const { rows, cols } = gridDimensions(tpl), s = size / Math.max(rows, cols);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const ch = gridColor(tpl, r, c); if (COLORS[ch]) drawFusedBead(x + (c + .5) * s, y + (r + .5) * s, s * .57, COLORS[ch], alpha); }
  }
  function drawReferenceCard() {
    const tpl = TEMPLATES[level], x = W - 154, y = 10, width = 134, height = 142;
    shadow('#5f51412d', 9, 3); roundRect(x, y, width, height, 18, '#fffefb', '#e2e7e2'); clearShadow();
    text('熨烫完成效果', x + width / 2, y + 16, 11, '#716a61', 'center', '800');
    const size = 102; drawIronedTemplate(tpl, x + (width - size) / 2, y + 22, size);
    text('照着效果图来拼', x + width / 2, y + 128, 10, '#5c8c80', 'center', '700');
  }
  function drawShelf() {
    drawHeader('拼豆豆', `已完成 ${completed.length} / ${TEMPLATES.length} 张小动物图纸`);
    roundRect(20, 88, W - 40, 76, 20, '#2e655d');
    text('今天拼哪一只小动物？', 38, 114, 18, '#fffdf6', 'left', '800'); text('拾取颜色拼豆，填满透明拼豆板', 38, 138, 12, '#d9f1de');
    const cols = 2, gap = 13, cardW = (W - 40 - gap) / 2, cardH = 168, startY = 184;
    TEMPLATES.forEach((tpl, i) => {
      const col = i % cols, row = Math.floor(i / cols), x = 20 + col * (cardW + gap), y = startY + row * (cardH + gap); const unlocked = isUnlocked(i), done = completed.includes(i);
      shadow(); roundRect(x, y, cardW, cardH, 20, unlocked ? '#ffffff' : '#dde5df'); clearShadow();
      if (unlocked) { roundRect(x + 12, y + 12, 58, 58, 16, '#f8f2e4'); miniTemplate(tpl, x + 17, y + 17, 48); text(tpl.name, x + 14, y + 92, 16, '#29413e', 'left', '800'); text(tpl.desc, x + 14, y + 115, 11, '#84918b');
        roundRect(x + 13, y + 133, cardW - 26, 23, 11, done ? '#d9f1df' : '#f8e6b5'); text(done ? '已定型 ✓' : '开始拼豆', x + cardW / 2, y + 145, 11, done ? '#36815d' : '#986527', 'center', '800');
      } else { text('🔒', x + cardW / 2, y + 58, 27, '#7b8b82', 'center'); text('完成上一张解锁', x + cardW / 2, y + 98, 12, '#738078', 'center'); }
    });
    text('真实玩法小提示：先选颜色，再轻点空的拼豆柱', W / 2, H - 24, 12, '#749083', 'center');
  }
  function setBoard() {
    const tpl = TEMPLATES[level], { rows, cols } = gridDimensions(tpl);
    const maxWidth = W - 70, maxHeight = Math.min(H * .43, 330); const step = Math.min(maxWidth / (cols + 1), maxHeight / (rows + 1), 18);
    const bw = cols * step + 30, bh = rows * step + 30, bx = (W - bw) / 2, by = 160;
    board = { bx, by, bw, bh, step, rows, cols };
  }
  function drawPegboard() {
    const tpl = TEMPLATES[level]; setBoard(); const { bx, by, bw, bh, step, rows, cols } = board;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ch = gridColor(tpl, r, c); if (!COLORS[ch]) continue; const x = bx + 15 + (c + .5) * step, y = by + 15 + (r + .5) * step; const key = cellKey(r, c);
      drawPeg(x, y, step, ch);
      if (placed.has(key)) drawBead(x, y - step * .06, step * .46, COLORS[ch]);
    }
    if (wrongFlash > performance.now()) { ctx.strokeStyle = '#ef6b61'; ctx.lineWidth = 4; ctx.globalAlpha = (wrongFlash - performance.now()) / 350; ctx.beginPath(); ctx.roundRect(bx - 2, by - 2, bw + 4, bh + 4, 24); ctx.stroke(); ctx.globalAlpha = 1; }
    if (phase === 'ironing') drawIronOverlay();
  }
  function paletteLayout(tpl) {
    const counts = templateCounts(tpl), keys = Object.keys(counts), perRow = Math.min(4, keys.length), rowCount = Math.ceil(keys.length / perRow), height = rowCount > 1 ? 174 : 124;
    const y = Math.min(H - height - 18, board.by + board.bh + 18), cellW = (W - 64) / perRow;
    return { counts, keys, perRow, rowCount, height, y, cellW };
  }
  function drawPalette() {
    const tpl = TEMPLATES[level], layout = paletteLayout(tpl), { counts, keys, perRow, rowCount, height, y, cellW } = layout;
    shadow('#506a621d', 8, 3); roundRect(20, y, W - 40, height, 18, '#fbfdfc', '#d9e4e0'); clearShadow();
    text(phase === 'placing' ? '颜色收纳盒' : '拼豆已经放好', 37, y + 20, 13, '#46675e', 'left', '800');
    text(phase === 'placing' ? '选择一格，拿起一种颜色' : '铺上烫纸，让拼豆融合定型', W - 35, y + 20, 10, '#879991', 'right', '600');
    const innerY = y + 34, slotH = 54 + (rowCount - 1) * 58; roundRect(31, innerY, W - 62, slotH, 12, '#f1f6f4', '#e1eae7');
    keys.forEach((key, i) => { const row = Math.floor(i / perRow), col = i % perRow, leftX = 32 + cellW * col, cx = leftX + cellW / 2, cy = innerY + 27 + row * 58; const left = counts[key] - [...placed].filter(v => { const [r, c] = v.split('-').map(Number); return gridColor(tpl, r, c) === key; }).length;
      if (col > 0) { ctx.strokeStyle = '#dce7e3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(leftX, innerY + row * 58 + 5); ctx.lineTo(leftX, innerY + row * 58 + 49); ctx.stroke(); }
      if (row > 0) { ctx.strokeStyle = '#dce7e3'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(36, innerY + row * 58); ctx.lineTo(W - 36, innerY + row * 58); ctx.stroke(); }
      if (selectedColor === key) { ctx.globalAlpha = .8; roundRect(leftX + 4, innerY + row * 58 + 4, cellW - 8, 50, 10, '#dcefe5'); ctx.globalAlpha = 1; }
      drawBead(cx - 23, cy - 2, 9, COLORS[key], left ? 1 : .24); drawBead(cx - 10, cy + 2, 7, COLORS[key], left > 1 ? 1 : .2); drawBead(cx, cy - 1, 6.5, COLORS[key], left > 2 ? 1 : .18);
      text(COLOR_NAMES[key], cx + 20, cy - 5, 9, '#526b63', 'center', '700'); text(`${left} 颗`, cx + 20, cy + 11, 9, '#93a29c', 'center', '600');
    });
    if (phase === 'ironReady') { roundRect(34, y + height - 46, W - 68, 34, 17, '#ffb95c'); text('铺上烫纸，开始熨烫定型', W / 2, y + height - 29, 13, '#70481e', 'center', '800'); }
  }
  function drawIronOverlay() {
    const p = ironProgress; ctx.fillStyle = `rgba(255,255,255,${Math.min(.8, p * .9)})`; ctx.fillRect(board.bx + 10, board.by + 10, (board.bw - 20) * p, board.bh - 20);
    const x = board.bx - 20 + (board.bw + 20) * p, y = board.by + board.bh * .52;
    shadow('#543a3540', 10, 4); roundRect(x - 24, y - 16, 55, 28, 9, '#ff716c'); roundRect(x - 5, y - 33, 19, 19, 6, '#5f7370'); clearShadow();
    ctx.fillStyle = '#fff2d4'; ctx.beginPath(); ctx.moveTo(x - 26, y + 12); ctx.lineTo(x + 35, y + 12); ctx.lineTo(x + 22, y + 23); ctx.lineTo(x - 20, y + 23); ctx.closePath(); ctx.fill();
  }
  function drawPlay() {
    const status = phase === 'placing' ? `${placed.size} / ${templateFilled(TEMPLATES[level])} 颗拼豆已放好 · ⏱ ${formatTime(timeRemaining)}` : phase === 'ironReady' ? '拼满啦，最后一步：熨烫定型' : phase === 'timeup' ? '时间到，点击重试后重新开始' : '正在熨烫，颜色会牢牢贴在一起';
    drawHeader(TEMPLATES[level].name, status, true);
    drawReferenceCard();
    drawPegboard(); drawPalette();
    if (selectedColor && phase === 'placing') { roundRect(26, 112, W - 52, 24, 12, '#ffefc9'); text(`已选择 ${COLOR_NAMES[selectedColor]} 拼豆 · 对照右上效果图放置`, W / 2, 124, 11, '#946a32', 'center', '700'); }
    if (phase === 'placing' && timeRemaining <= 10) { roundRect(30, 140, W - 60, 25, 12, '#ffe0cc'); text(`最后 ${timeRemaining} 秒，快完成这张拼豆图！`, W / 2, 152, 11, '#b85f42', 'center', '800'); }
    if (phase === 'timeup') drawTimeUp();
  }
  function drawTimeUp() {
    ctx.fillStyle = '#27433d55'; ctx.fillRect(0, 0, W, H); shadow('#2b423c4d', 16, 7); roundRect(42, H * .31, W - 84, 184, 26, '#fffdf8'); clearShadow();
    text('时间到', W / 2, H * .31 + 48, 29, '#31544b', 'center', '900'); text('再试一次，完成这张拼豆图吧', W / 2, H * .31 + 78, 14, '#70877d', 'center');
    roundRect(69, H * .31 + 110, W - 138, 46, 23, '#2f8e75'); text('重新拼这张图', W / 2, H * .31 + 133, 15, '#ffffff', 'center', '800');
  }
  function drawComplete() {
    drawBackground(); const tpl = TEMPLATES[level];
    const age = performance.now() - resultStarted;
    text('熨烫完成！', W / 2, 95, 32, '#284942', 'center', '900'); text(`${tpl.name} 变成完整拼豆作品啦`, W / 2, 125, 15, '#6f847c', 'center');
    shadow('#5a78602b', 16, 7); roundRect(45, 160, W - 90, 300, 28, '#ffffff'); clearShadow();
    const glow = .22 + .18 * Math.max(0, 1 - age / 1800); ctx.globalAlpha = glow; ctx.fillStyle = '#ffd85a'; ctx.beginPath(); ctx.arc(W / 2, 307, 135 + Math.sin(age / 120) * 7, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const size = Math.min(220, W - 130); drawIronedTemplate(tpl, (W - size) / 2, 190, size); text('与右上角效果图一致 ✓', W / 2, 424, 14, '#637e73', 'center', '800');
    if (age < 2300) { ctx.globalAlpha = Math.max(0, 1 - age / 2300); for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10 + age / 700; const d = 120 + Math.sin(age / 180 + i) * 12; text('✦', W / 2 + Math.cos(a) * d, 308 + Math.sin(a) * d * .72, 18, i % 2 ? '#ffb84c' : '#55af92', 'center', '800'); } ctx.globalAlpha = 1; }
    roundRect(45, 500, W - 90, 52, 25, '#2f8e75'); text(level < TEMPLATES.length - 1 ? '去拼下一只小动物 →' : '回到动物图纸柜', W / 2, 526, 16, '#ffffff', 'center', '800');
    roundRect(45, 566, W - 90, 44, 22, '#f3e4bc'); text('再拼一次', W / 2, 588, 14, '#9a6b30', 'center', '800');
  }
  function drawToast() { if (performance.now() >= toastUntil) return; const w = Math.min(W - 40, Math.max(150, toast.length * 14 + 38)); shadow('#332d2840', 10, 4); roundRect((W - w) / 2, H - 58, w, 34, 17, '#314943'); clearShadow(); text(toast, W / 2, H - 41, 12, '#ffffff', 'center', '700'); }
  function drawParticles() { particles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; }
  function render() { drawBackground(); if (screen === 'shelf') drawShelf(); else if (screen === 'play') drawPlay(); else drawComplete(); drawParticles(); drawToast(); }

  function hitShelf(x, y) {
    const cols = 2, gap = 13, cardW = (W - 40 - gap) / 2, cardH = 168, startY = 184;
    TEMPLATES.forEach((_, i) => { const col = i % cols, row = Math.floor(i / cols), cx = 20 + col * (cardW + gap), cy = startY + row * (cardH + gap); if (x >= cx && x <= cx + cardW && y >= cy && y <= cy + cardH && isUnlocked(i)) startLevel(i); });
  }
  function startLevel(i) { level = i; placed = new Set(); selectedColor = null; phase = 'placing'; timeRemaining = LEVEL_TIME_SECONDS; levelDeadline = performance.now() + LEVEL_TIME_SECONDS * 1000; tenSecondReminderShown = false; screen = 'play'; setBoard(); }
  function hitPlay(x, y) {
    if (x < 64 && y < 72) { screen = 'shelf'; return; }
    if (phase === 'timeup') { if (y > H * .31 + 100 && y < H * .31 + 168) startLevel(level); return; }
    const layout = paletteLayout(TEMPLATES[level]);
    if (phase === 'ironReady') { if (y > layout.y + layout.height - 54 && y < layout.y + layout.height - 4) { phase = 'ironing'; ironProgress = 0; return; } }
    if (phase !== 'placing') return;
    const tpl = TEMPLATES[level], { counts, keys, perRow, y: y0, cellW } = layout;
    for (let i = 0; i < keys.length; i++) { const row = Math.floor(i / perRow), col = i % perRow, px = 32 + cellW * (col + .5), py = y0 + 61 + row * 58; if (x > px - cellW / 2 && x < px + cellW / 2 && y > py - 28 && y < py + 30) { const key = keys[i]; const used = [...placed].filter(v => { const [r, c] = v.split('-').map(Number); return gridColor(tpl, r, c) === key; }).length; const remaining = counts[key] - used;
      if (remaining <= 0) showToast('这个颜色已经用完啦'); else { selectedColor = key; showToast(`选择了${COLOR_NAMES[key]}拼豆`); } return; } }
    const { bx, by, step, rows, cols } = board; const c = Math.floor((x - bx - 15) / step), r = Math.floor((y - by - 15) / step);
    const targetColor = gridColor(tpl, r, c);
    if (r < 0 || r >= rows || c < 0 || c >= cols || !COLORS[targetColor]) return;
    const key = cellKey(r, c); if (placed.has(key)) { showToast('这颗已经放好啦'); return; }
    if (!selectedColor) { showToast('先从颜色盒拾取一颗拼豆'); return; }
    if (targetColor !== selectedColor) { wrongFlash = performance.now() + 350; showToast('颜色不对，看看右上效果图'); return; }
    placed.add(key); burst(x, y, COLORS[selectedColor]);
    if (placed.size === templateFilled(tpl)) { selectedColor = null; phase = 'ironReady'; showToast('全部拼好了！熨烫一下吧'); }
  }
  function hitComplete(x, y) { if (y >= 500 && y <= 552) { if (level < TEMPLATES.length - 1) startLevel(level + 1); else screen = 'shelf'; } else if (y >= 566 && y <= 610) startLevel(level); }
  function burst(x, y, color) { for (let i = 0; i < 12; i++) particles.push({ x, y, vx: (Math.random() - .5) * 3.2, vy: -Math.random() * 3 - .4, size: 2 + Math.random() * 3, life: 1, color }); }
  function finishLevel() { if (!completed.includes(level)) { completed.push(level); completed.sort((a, b) => a - b); saveCompleted(); } particles = []; resultStarted = performance.now(); for (let i = 0; i < 80; i++) particles.push({ x: W / 2, y: H * .36, vx: (Math.random() - .5) * 7, vy: -Math.random() * 7 - 1, size: 3 + Math.random() * 4, life: 1, color: Object.values(COLORS)[i % 8] }); screen = 'complete'; }
  function animate(now) {
    const dt = Math.min(40, now - last); last = now;
    particles = particles.filter(p => { p.x += p.vx * dt / 16; p.y += p.vy * dt / 16; p.vy += .1 * dt / 16; p.life -= .018 * dt / 16; return p.life > 0; });
    if (screen === 'play' && phase === 'placing') { timeRemaining = Math.max(0, Math.ceil((levelDeadline - now) / 1000)); if (timeRemaining <= 10 && !tenSecondReminderShown) { tenSecondReminderShown = true; showToast('还剩 10 秒，抓紧完成！'); } if (timeRemaining <= 0) { selectedColor = null; phase = 'timeup'; showToast('时间到，本关需要重新挑战'); } }
    if (phase === 'ironing') { ironProgress += dt / 1500; if (ironProgress >= 1) { ironProgress = 1; phase = 'done'; finishLevel(); } }
    render(); requestAnimationFrame(animate);
  }
  function point(e) { const rect = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: (p.clientX - rect.left) * W / rect.width, y: (p.clientY - rect.top) * H / rect.height }; }
  function tap(e) { e.preventDefault(); const p = point(e); if (screen === 'shelf') hitShelf(p.x, p.y); else if (screen === 'play') hitPlay(p.x, p.y); else hitComplete(p.x, p.y); }
  canvas.addEventListener('touchstart', tap, { passive: false }); canvas.addEventListener('mousedown', tap);
  requestAnimationFrame(animate);
})();
