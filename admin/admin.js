/* Aurora Slider - dashboard app (vanilla JS, talks to the REST API) */
(() => {
	'use strict';

	const C = window.AuroraAdmin || {};
	const root = document.getElementById('aurora-app');
	if (!root) return;

	/* ---------------------------------------------------------------- */
	/* Helpers                                                           */
	/* ---------------------------------------------------------------- */
	const $ = (s, r = root) => r.querySelector(s);
	const $$ = (s, r = root) => [...r.querySelectorAll(s)];
	const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
	const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
	const r1 = n => Math.round(n * 10) / 10;
	const uid = () => 'l' + Math.random().toString(36).slice(2, 9);
	const cssUrl = u => `url('${String(u).replace(/'/g, '%27').replace(/"/g, '%22').replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20')}')`;
	const rgba = (hex, pct) => {
		let h = String(hex || '#000000').replace('#', '');
		if (h.length === 3) h = h.split('').map(c => c + c).join('');
		const n = parseInt(h, 16) || 0;
		return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${(pct / 100).toFixed(3)})`;
	};

	const ic = d => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
	const I = {
		plus: ic('<path d="M12 5v14M5 12h14"/>'),
		trash: ic('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
		copy: ic('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>'),
		play: ic('<path d="M7 4l13 8-13 8z"/>'),
		save: ic('<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>'),
		back: ic('<path d="M15 5l-7 7 7 7"/>'),
		grid: ic('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
		cog: ic('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>'),
		book: ic('<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10"/>'),
		up: ic('<path d="M6 15l6-6 6 6"/>'),
		down: ic('<path d="M6 9l6 6 6-6"/>'),
		left: ic('<path d="M15 6l-6 6 6 6"/>'),
		right: ic('<path d="M9 6l6 6-6 6"/>'),
		edit: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
		chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
		chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
		logo: '<svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true"><defs><linearGradient id="ag" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6d5cff"/><stop offset="1" stop-color="#3ee0ff"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#ag)"/><path d="M7 21c4-9 9-12 18-10-6 1-10 4-12 10z" fill="#fff"/><circle cx="22" cy="21" r="2.4" fill="#fff" opacity=".8"/></svg>'
	};

	/* ---------------------------------------------------------------- */
	/* State + API                                                       */
	/* ---------------------------------------------------------------- */
	const S = { view: 'list', sliders: [], cur: null, global: null, tab: 'slide', si: 0, li: null, dirty: false };
	let editorOpen = false;
	let drag = null;
	let replayT = null;

	const api = async (path, method = 'GET', body) => {
		const r = await fetch(C.rest + path, {
			method,
			headers: { 'X-WP-Nonce': C.nonce, 'Content-Type': 'application/json' },
			body: body ? JSON.stringify(body) : undefined
		});
		const j = await r.json().catch(() => ({}));
		if (!r.ok) throw new Error(j.message || 'Request failed');
		return j;
	};

	let toastEl, toastT;
	const toast = (msg, err) => {
		if (!toastEl) { toastEl = document.createElement('div'); document.body.appendChild(toastEl); }
		toastEl.textContent = msg;
		toastEl.className = 'toast show' + (err ? ' err' : '');
		clearTimeout(toastT);
		toastT = setTimeout(() => toastEl.classList.remove('show'), 2800);
	};

	const curSlide = () => S.cur && S.cur.slides[S.si];
	const curLayer = () => { const s = curSlide(); return s && s.layers.find(l => l.id === S.li); };
	const layerById = id => curSlide().layers.find(l => l.id === id);

	const ctxRoot = n => ({ settings: S.cur && S.cur.settings, slide: curSlide(), layer: curLayer(), global: S.global, slider: S.cur }[n]);
	const getP = path => { const p = path.split('.'); let o = ctxRoot(p.shift()); while (o != null && p.length) o = o[p.shift()]; return o; };
	const setP = (path, v) => { const p = path.split('.'); let o = ctxRoot(p.shift()); while (p.length > 1) o = o[p.shift()]; o[p[0]] = v; };

	const defLayer = type => {
		const base = { id: uid(), type, name: '', x: 10, y: 30, w: 45, ax: 'left', ay: 'top', anim: { in: 'fade-up', delay: 300, duration: 800 } };
		if (type === 'text') return { ...base, name: 'Text', html: '<h2 style="font-size:56px;font-weight:800;color:#ffffff;">New headline</h2>', shadow: false };
		if (type === 'button') return { ...base, name: 'Button', y: 64, label: 'Learn more', url: '#', newTab: false, anim: { in: 'zoom-in', delay: 700, duration: 700 }, style: { bg: '#7c5cff', color: '#ffffff', hoverBg: '#ffffff', hoverColor: '#1b1740', radius: 40, fontSize: 18, weight: '700', px: 34, py: 16 } };
		return { ...base, name: 'Image', src: '', alt: '', w: 30 };
	};
	const defSlide = () => ({ id: uid(), name: '', bg: { image: '', color: '#1b1740', size: 'cover', position: 'center center' }, overlay: { color: '#000000', opacity: 25 }, layers: [defLayer('text'), defLayer('button')] });

	const markDirty = () => { S.dirty = true; const b = $('#as-save'); if (b) b.classList.add('dirty'); };
	window.addEventListener('beforeunload', e => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

	/* ---------------------------------------------------------------- */
	/* Field builders                                                    */
	/* ---------------------------------------------------------------- */
	const row = (l, inner, hint) => `<label class="f"><span class="f-l">${esc(l)}</span>${inner}${hint ? `<small>${esc(hint)}</small>` : ''}</label>`;
	const fText = (l, p, ph, hint) => row(l, `<input type="text" data-b="${p}" value="${esc(getP(p))}" placeholder="${esc(ph || '')}">`, hint);
	const fNum = (l, p, min, max, step, unit) => row(l, `<span class="num"><input type="number" data-b="${p}" value="${esc(getP(p))}" min="${min}" max="${max}" step="${step || 1}"><i>${unit || ''}</i></span>`);
	const fRange = (l, p, min, max, step) => row(l, `<span class="rng"><input type="range" data-b="${p}" value="${esc(getP(p))}" min="${min}" max="${max}" step="${step || 1}"><b>${esc(getP(p))}</b></span>`);
	const fColor = (l, p) => row(l, `<span class="clr"><input type="color" data-b="${p}" value="${esc(getP(p))}"><code>${esc(getP(p))}</code></span>`);
	const fToggle = (l, p, hint) => `<label class="tg"><span><b>${esc(l)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span><input type="checkbox" data-b="${p}" ${getP(p) ? 'checked' : ''}><i></i></label>`;
	const fSelect = (l, p, opts) => row(l, `<select data-b="${p}">${opts.map(o => `<option value="${esc(o[0])}" ${String(getP(p)) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`);
	const fSeg = (l, p, opts) => `<div class="f"><span class="f-l">${esc(l)}</span><div class="seg" data-seg="${p}">${opts.map(o => `<button type="button" data-v="${esc(o[0])}" class="${String(getP(p)) === String(o[0]) ? 'on' : ''}">${esc(o[1])}</button>`).join('')}</div></div>`;
	const fMedia = (l, p, hint) => {
		const v = getP(p);
		return `<div class="f"><span class="f-l">${esc(l)}</span><div class="media">${v ? `<img src="${esc(v)}" alt="">` : '<div class="ph">No image</div>'}<div class="media-b"><button type="button" class="btn sm" data-media="${p}">${v ? 'Replace' : 'Choose / upload'}</button>${v ? `<button type="button" class="btn sm ghost" data-clear="${p}">Remove</button>` : ''}</div></div>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
	};
	const animOpts = () => Object.entries(C.anims || {});

	/* ---------------------------------------------------------------- */
	/* Shell + views                                                     */
	/* ---------------------------------------------------------------- */
	const shell = inner => `<div class="ar"><aside class="ar-nav"><div class="brand">${I.logo}<div><b>Aurora</b><span>Slider</span></div></div>
		<nav><a data-go="list" class="${S.view === 'list' || S.view === 'edit' ? 'on' : ''}" tabindex="0">${I.grid} Sliders</a>
		<a data-go="global" class="${S.view === 'global' ? 'on' : ''}" tabindex="0">${I.cog} Global settings</a>
		<a data-go="help" class="${S.view === 'help' ? 'on' : ''}" tabindex="0">${I.book} How to use</a></nav>
		<div class="nav-foot">Version ${esc(C.version)}</div></aside><main class="ar-main">${inner}</main></div>`;

	function destroyEditor() {
		if (editorOpen && window.wp && wp.editor) { try { wp.editor.remove('as-mce'); } catch (e) { /* ignore */ } }
		editorOpen = false;
	}

	function render() {
		destroyEditor();
		if (S.view === 'list') renderList();
		else if (S.view === 'edit') renderEdit();
		else if (S.view === 'global') renderGlobal();
		else renderHelp();
	}

	function renderList() {
		const cards = S.sliders.map(s => `<article class="card"><div class="cv"><b>${s.slides} slide${s.slides === 1 ? '' : 's'}</b></div>
			<div class="bd"><h3>${esc(s.title)}</h3><div class="meta">Updated ${esc(s.updated_at || '')}</div>
			<span class="short" data-act="copy" data-text="[aurora_slider id=&quot;${s.id}&quot;]" title="Copy shortcode">${I.copy} [aurora_slider id="${s.id}"]</span></div>
			<div class="ft"><button class="btn sm pri" data-act="edit" data-id="${s.id}">${I.edit} Edit</button><button class="btn sm" data-act="dup" data-id="${s.id}">${I.copy} Duplicate</button><button class="btn sm danger" data-act="del" data-id="${s.id}">${I.trash}</button></div></article>`).join('');
		root.innerHTML = shell(`<header class="top"><div><h1>Sliders</h1><p>Build, style and embed responsive sliders.</p></div><button class="btn pri" data-act="new">${I.plus} New slider</button></header>
			${cards ? `<div class="cards">${cards}</div>` : `<div class="empty"><h2>No sliders yet</h2><p>Create your first slider, then paste its shortcode into any page.</p><button class="btn pri" data-act="new">${I.plus} Create slider</button></div>`}`);
	}

	function renderEdit() {
		const id = S.cur.id;
		root.innerHTML = shell(`<header class="top ed-top"><button class="btn ghost" data-act="back">${I.back} Sliders</button>
			<input class="title-in" data-b="slider.title" value="${esc(S.cur.title)}" aria-label="Slider title">
			<span class="short" data-act="copy" data-text="[aurora_slider id=&quot;${id}&quot;]" title="Copy shortcode">${I.copy} [aurora_slider id="${id}"]</span>
			<button class="btn pri ${S.dirty ? 'dirty' : ''}" id="as-save" data-act="save">${I.save} Save changes</button></header>
			<div class="ed"><section class="ed-main">
				<div class="stage-bar"><span>Canvas: desktop preview. Drag layers to move them; drag the cyan handle to resize text.</span><button class="btn sm" data-act="replay">${I.play} Replay animations</button></div>
				<div class="stage-wrap" id="as-wrap"><div class="as-stage" id="as-stage"></div></div>
				<div class="strip" id="as-strip"></div>
			</section><aside class="ed-side"><div class="tabs" id="as-tabs" role="tablist"></div><div class="panel" id="as-panel"></div></aside></div>`);
		renderStage(); renderStrip(); renderTabs(); renderPanel(); fitStage();
		if (window.ResizeObserver) new ResizeObserver(fitStage).observe($('#as-wrap'));
	}

	/* ---------------------------------------------------------------- */
	/* Canvas                                                            */
	/* ---------------------------------------------------------------- */
	const AX = { left: '0', center: '-50%', right: '-100%' };
	const AY = { top: '0', middle: '-50%', bottom: '-100%' };
	const layerStyle = l => `left:${l.x}%;top:${l.y}%;${l.type === 'button' ? '' : `width:${l.w}%;`}transform:translate(${AX[l.ax] || '0'},${AY[l.ay] || '0'});`;
	const inVars = l => `--an:${l.anim.in === 'none' ? 'none' : 'as-' + l.anim.in};--dur:${l.anim.duration}ms;--delay:${l.anim.delay}ms;`;
	function layerInner(l) {
		if (l.type === 'text') return l.html || '<p>Empty text</p>';
		if (l.type === 'button') {
			const s = l.style;
			return `<a class="as-btn" style="--as-bb:${s.bg};--as-bc:${s.color};--as-bhb:${s.hoverBg};--as-bhc:${s.hoverColor};--as-br:${s.radius}px;--as-bfs:${s.fontSize}px;--as-bfw:${s.weight};--as-bpx:${s.px}px;--as-bpy:${s.py}px">${esc(l.label)}</a>`;
		}
		return l.src ? `<img src="${esc(l.src)}" alt="">` : '<div class="ph">Choose an image</div>';
	}
	const layerEl = l => `<div class="as-l as-l-${l.type} ${l.id === S.li ? 'sel' : ''}" data-id="${esc(l.id)}" style="${layerStyle(l)}"><div class="as-in ${l.shadow ? 'as-shadow' : ''}" style="${inVars(l)}">${layerInner(l)}</div>${l.type === 'button' ? '' : '<span class="as-rz"></span>'}</div>`;

	function renderStage() {
		const st = $('#as-stage'); if (!st) return;
		st.innerHTML = `<div class="as-s-bg"></div><div class="as-s-ov"></div>${curSlide().layers.map(layerEl).join('')}`;
		renderStageBg();
	}
	function renderStageBg() {
		const s = curSlide(), bg = $('.as-s-bg'), ov = $('.as-s-ov'); if (!bg) return;
		bg.style.cssText = `background:${s.bg.color}${s.bg.image ? ` ${cssUrl(s.bg.image)} ${s.bg.position}/${s.bg.size} no-repeat` : ''}`;
		ov.style.cssText = `background:${rgba(s.overlay.color, s.overlay.opacity)}`;
	}
	function fitStage() {
		const w = $('#as-wrap'), st = $('#as-stage'); if (!w || !st) return;
		const sc = Math.min(1, w.clientWidth / 1200), h = S.cur.settings.height.desktop;
		st.style.transform = `scale(${sc})`;
		st.style.height = h + 'px';
		w.style.height = (h * sc) + 'px';
	}
	function updateLayerEl(l) {
		const el = $(`.as-l[data-id="${l.id}"]`); if (!el) return;
		el.style.cssText = layerStyle(l);
		const inn = el.querySelector('.as-in');
		inn.style.cssText = inVars(l);
		inn.className = 'as-in' + (l.shadow ? ' as-shadow' : '');
		inn.innerHTML = layerInner(l);
	}
	function replay() {
		const st = $('#as-stage'); if (!st) return;
		st.classList.remove('as-play'); void st.offsetWidth; st.classList.add('as-play');
		clearTimeout(replayT);
		const mx = Math.max(0, ...curSlide().layers.map(l => l.anim.delay + l.anim.duration));
		replayT = setTimeout(() => st.classList.remove('as-play'), mx + 250);
	}

	// Drag + resize layers directly on the canvas
	root.addEventListener('pointerdown', e => {
		const st = e.target.closest('#as-stage'); if (!st) return;
		const el = e.target.closest('.as-l');
		if (!el) { if (S.li) selectLayer(null); return; }
		const l = layerById(el.dataset.id);
		if (S.li !== l.id) selectLayer(l.id);
		const live = $(`.as-l[data-id="${l.id}"]`);
		drag = { l, el: live, mode: e.target.closest('.as-rz') ? 'resize' : 'move', sx: e.clientX, sy: e.clientY, x: l.x, y: l.y, w: l.w, rect: $('#as-stage').getBoundingClientRect() };
		try { live.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
		e.preventDefault();
	});
	root.addEventListener('pointermove', e => {
		if (!drag) return;
		const dx = (e.clientX - drag.sx) / drag.rect.width * 100;
		const dy = (e.clientY - drag.sy) / drag.rect.height * 100;
		const l = drag.l;
		if (drag.mode === 'move') {
			l.x = r1(clamp(drag.x + dx, 0, 100)); l.y = r1(clamp(drag.y + dy, 0, 100));
			drag.el.style.left = l.x + '%'; drag.el.style.top = l.y + '%';
		} else {
			l.w = r1(clamp(drag.w + dx, 2, 100));
			drag.el.style.width = l.w + '%';
		}
		['x', 'y', 'w'].forEach(k => { const inp = $(`[data-b="layer.${k}"]`); if (inp) inp.value = l[k]; });
		markDirty();
	});
	const endDrag = () => { drag = null; };
	root.addEventListener('pointerup', endDrag);
	root.addEventListener('pointercancel', endDrag);
	root.addEventListener('click', e => { if (e.target.closest('#as-stage a')) e.preventDefault(); });

	function selectLayer(id) {
		S.li = id;
		$$('.as-l').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
		if (id) S.tab = 'layer';
		else if (S.tab === 'layer') S.tab = 'slide';
		renderTabs(); renderPanel();
	}

	/* ---------------------------------------------------------------- */
	/* Slide strip, tabs, panels                                         */
	/* ---------------------------------------------------------------- */
	function renderStrip() {
		const el = $('#as-strip'); if (!el) return;
		el.innerHTML = S.cur.slides.map((s, i) => {
			const st = `background:${s.bg.color}${s.bg.image ? ` ${cssUrl(s.bg.image)} center/cover` : ''}`;
			return `<div class="th ${i === S.si ? 'on' : ''}" data-act="pick-slide" data-i="${i}" tabindex="0" role="button" aria-label="Slide ${i + 1}" style="${st}"><span>${i + 1}</span></div>`;
		}).join('') + `<button type="button" class="th add" data-act="add-slide" aria-label="Add slide">+</button>
			<div class="strip-tools"><button class="ibtn" data-act="mv-slide" data-d="-1" title="Move left">${I.left}</button><button class="ibtn" data-act="mv-slide" data-d="1" title="Move right">${I.right}</button><button class="ibtn" data-act="dup-slide" title="Duplicate slide">${I.copy}</button><button class="ibtn danger" data-act="del-slide" title="Delete slide">${I.trash}</button></div>`;
	}

	const TABS = [['slide', 'Slide'], ['layer', 'Layer'], ['transition', 'Motion'], ['arrows', 'Arrows'], ['dots', 'Dots'], ['general', 'Layout']];
	function renderTabs() {
		const el = $('#as-tabs'); if (!el) return;
		el.innerHTML = TABS.map(t => `<button type="button" class="tab ${S.tab === t[0] ? 'on' : ''}" role="tab" data-act="tab" data-t="${t[0]}">${t[1]}</button>`).join('');
	}

	function renderPanel() {
		const el = $('#as-panel'); if (!el) return;
		destroyEditor();
		el.innerHTML = ({ slide: pSlide, layer: pLayer, transition: pTransition, arrows: pArrows, dots: pDots, general: pGeneral }[S.tab] || pSlide)();
		const l = curLayer();
		if (S.tab === 'layer' && l && l.type === 'text') initEditor(l);
	}

	const typeLabel = l => ({ text: 'Text', button: 'Button', image: 'Image' }[l.type]);

	function pSlide() {
		const s = curSlide();
		const list = s.layers.map((l, i) => `<li class="${l.id === S.li ? 'on' : ''}" data-act="pick-layer" data-id="${esc(l.id)}"><span class="k">${typeLabel(l)}</span><span class="t">${esc(l.name || typeLabel(l))}</span>
			<button class="ibtn" data-act="mv-layer" data-id="${esc(l.id)}" data-d="-1" title="Send backward" ${i === 0 ? 'disabled' : ''}>${I.down}</button><button class="ibtn" data-act="mv-layer" data-id="${esc(l.id)}" data-d="1" title="Bring forward" ${i === s.layers.length - 1 ? 'disabled' : ''}>${I.up}</button></li>`).join('');
		return `<div class="grp"><h3>Layers</h3><div class="add-l"><button class="btn sm" data-act="add-layer" data-type="text">${I.plus} Text</button><button class="btn sm" data-act="add-layer" data-type="button">${I.plus} Button</button><button class="btn sm" data-act="add-layer" data-type="image">${I.plus} Image</button></div>
			<ul class="ll">${list || '<li style="cursor:default">No layers yet</li>'}</ul></div>
			<div class="grp"><h3>Background</h3>${fText('Slide name', 'slide.name', 'Slide ' + (S.si + 1))}${fMedia('Image', 'slide.bg.image')}${fColor('Fallback color', 'slide.bg.color')}
			${fSeg('Image fit', 'slide.bg.size', [['cover', 'Cover'], ['contain', 'Contain']])}
			${fSelect('Position', 'slide.bg.position', [['center center', 'Center'], ['top center', 'Top'], ['bottom center', 'Bottom'], ['left center', 'Left'], ['right center', 'Right']])}</div>
			<div class="grp"><h3>Overlay</h3>${fColor('Color', 'slide.overlay.color')}${fRange('Opacity', 'slide.overlay.opacity', 0, 100, 1)}</div>`;
	}

	function pLayer() {
		const l = curLayer();
		if (!l) return '<div class="hint">Click a layer on the canvas, or pick one from the Slide tab.</div>';
		let h = `<div class="grp"><h3>${typeLabel(l)} layer</h3>${fText('Layer name', 'layer.name', typeLabel(l))}`;
		if (l.type === 'text') {
			h += `<div class="f"><span class="f-l">Text (visual editor)</span><textarea id="as-mce" rows="6">${esc(l.html)}</textarea><small>Use the toolbar for size, color, alignment and links.</small></div>${fToggle('Text shadow', 'layer.shadow', 'Improves readability over busy photos')}`;
		} else if (l.type === 'button') {
			h += `${fText('Label', 'layer.label')}${fText('Link URL', 'layer.url', 'https://')}${fToggle('Open in new tab', 'layer.newTab')}`;
		} else {
			h += `${fMedia('Image', 'layer.src')}${fText('Alt text', 'layer.alt')}`;
		}
		h += '</div>';
		if (l.type === 'button') {
			h += `<div class="grp"><h3>Button style</h3><div class="two">${fColor('Background', 'layer.style.bg')}${fColor('Text', 'layer.style.color')}${fColor('Hover background', 'layer.style.hoverBg')}${fColor('Hover text', 'layer.style.hoverColor')}</div>
				${fRange('Corner radius', 'layer.style.radius', 0, 60)}${fRange('Font size', 'layer.style.fontSize', 10, 48)}
				${fSelect('Font weight', 'layer.style.weight', [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold']])}
				<div class="two">${fNum('Padding X', 'layer.style.px', 0, 100, 1, 'px')}${fNum('Padding Y', 'layer.style.py', 0, 60, 1, 'px')}</div></div>`;
		}
		h += `<div class="grp"><h3>Position</h3><div class="two">${fNum('X', 'layer.x', 0, 100, 0.5, '%')}${fNum('Y', 'layer.y', 0, 100, 0.5, '%')}</div>
			${l.type !== 'button' ? fNum('Width', 'layer.w', 2, 100, 0.5, '%') : ''}
			${fSeg('Horizontal anchor', 'layer.ax', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']])}
			${fSeg('Vertical anchor', 'layer.ay', [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']])}
			<small style="color:#6a7392">Tip: set X to 50 with a Center anchor to center a layer.</small></div>
			<div class="grp"><h3>Entrance animation</h3>${fSelect('Effect', 'layer.anim.in', animOpts())}<div class="two">${fNum('Delay', 'layer.anim.delay', 0, 10000, 50, 'ms')}${fNum('Duration', 'layer.anim.duration', 50, 5000, 50, 'ms')}</div>
			<button class="btn sm" data-act="replay">${I.play} Preview</button></div>
			<div class="actions"><button class="btn" data-act="dup-layer">${I.copy} Duplicate</button><button class="btn danger" data-act="del-layer">${I.trash} Delete</button></div>`;
		return h;
	}

	const GLYPH = { fade: '◐', slide: '⇄', vertical: '⇅', zoom: '⤢', flip: '⟲', blur: '≈', curtain: '▤', rotate: '↻', random: '✦' };
	function pTransition() {
		const cur = getP('settings.transition');
		const cards = Object.entries(C.transitions || {}).map(([k, v]) => `<button type="button" class="${cur === k ? 'on' : ''}" data-set="settings.transition" data-v="${k}"><span class="gl">${GLYPH[k] || '•'}</span>${esc(v)}</button>`).join('');
		return `<div class="grp"><h3>Slide transition</h3><div class="pick">${cards}</div>${fNum('Transition speed', 'settings.speed', 100, 5000, 50, 'ms')}</div>
			<div class="grp"><h3>Playback</h3>${fToggle('Autoplay', 'settings.autoplay')}${fNum('Time per slide', 'settings.delay', 1000, 60000, 100, 'ms')}${fToggle('Pause on hover', 'settings.pauseHover')}${fToggle('Loop', 'settings.loop')}${fToggle('Progress bar', 'settings.progress', 'Shows time left on the current slide')}${fToggle('Ken Burns zoom', 'settings.kenburns', 'Slowly zooms the background image')}</div>`;
	}

	function pArrows() {
		const st = getP('settings.arrows.style'), a = 'settings.arrows.';
		const styles = [['circle', 'Circle'], ['square', 'Square'], ['minimal', 'Minimal'], ['custom', 'My graphics']];
		const cards = styles.map(([k, v]) => `<button type="button" class="${st === k ? 'on' : ''}" data-set="${a}style" data-v="${k}"><span class="ap ap-${k}">${k === 'custom' ? '↑' : I.chevR}</span>${v}</button>`).join('');
		return `<div class="grp"><h3>Arrows</h3>${fToggle('Show arrows', a + 'enabled')}<div class="pick" style="grid-template-columns:repeat(2,1fr)">${cards}</div>
			${st === 'custom' ? `${fMedia('Previous arrow graphic', a + 'prevImage', 'PNG, WebP, GIF or JPG. Leave empty to use the default from Global settings.')}${fMedia('Next arrow graphic', a + 'nextImage')}` : `${fColor('Arrow color', a + 'color')}${st !== 'minimal' ? `${fColor('Background', a + 'bg')}${fRange('Background opacity', a + 'bgOpacity', 0, 100)}` : ''}`}
			${fRange('Size', a + 'size', 16, 140)}${fRange('Distance from edge', a + 'offset', -40, 200)}${fToggle('Show only on hover', a + 'hoverOnly')}${fToggle('Hide on mobile', a + 'hideMobile')}</div>`;
	}

	function pDots() {
		const d = 'settings.dots.';
		return `<div class="grp"><h3>Dots</h3>${fToggle('Show navigation dots', d + 'enabled')}${fSeg('Style', d + 'style', [['dots', 'Dots'], ['lines', 'Lines'], ['numbers', 'Numbers']])}
			${fSelect('Position', d + 'position', [['bottom-center', 'Bottom center'], ['bottom-left', 'Bottom left'], ['bottom-right', 'Bottom right'], ['top-center', 'Top center'], ['right-center', 'Right (vertical)']])}
			<div class="two">${fColor('Color', d + 'color')}${fColor('Active color', d + 'active')}</div>
			${fRange('Size', d + 'size', 6, 40)}${fRange('Spacing', d + 'gap', 0, 40)}${fRange('Inactive opacity', d + 'inactiveOpacity', 10, 100)}${fRange('Distance from edge', d + 'offset', 0, 200)}</div>`;
	}

	function pGeneral() {
		return `<div class="grp"><h3>Height</h3><p style="margin:0 0 10px;color:#6a7392">Layers scale down automatically on smaller screens.</p>
			${fNum('Desktop', 'settings.height.desktop', 120, 1400, 10, 'px')}${fNum('Tablet (up to 1024px)', 'settings.height.tablet', 120, 1400, 10, 'px')}${fNum('Mobile (up to 640px)', 'settings.height.mobile', 120, 1400, 10, 'px')}</div>
			<div class="grp"><h3>Width</h3>${fNum('Maximum width (0 = full width)', 'settings.maxWidth', 0, 3000, 10, 'px')}</div>
			<div class="grp"><h3>Interaction</h3>${fToggle('Swipe on touch screens', 'settings.swipe')}${fToggle('Arrow-key navigation', 'settings.keyboard')}</div>`;
	}

	/* ---------------------------------------------------------------- */
	/* WYSIWYG (TinyMCE via wp.editor)                                   */
	/* ---------------------------------------------------------------- */
	function initEditor(l) {
		if (!window.wp || !wp.editor) return;
		wp.editor.initialize('as-mce', {
			tinymce: {
				height: 240,
				menubar: false,
				toolbar1: 'formatselect,fontsizeselect,bold,italic,underline,forecolor,|,alignleft,aligncenter,alignright,|,link,unlink,removeformat',
				toolbar2: '',
				block_formats: 'Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3;Heading 4=h4',
				fontsize_formats: '12px 14px 16px 18px 20px 24px 28px 32px 40px 48px 56px 64px 72px 88px 104px',
				content_style: 'body{background:#2a2f55;color:#fff;font-family:sans-serif;padding:10px}a{color:#8fe9ff}',
				setup(ed) {
					const sync = () => {
						const html = ed.getContent();
						if (l.html !== html) { l.html = html; updateLayerEl(l); markDirty(); }
					};
					ed.on('input change keyup undo redo SetContent ExecCommand', sync);
				}
			},
			quicktags: false,
			mediaButtons: false
		});
		editorOpen = true;
	}

	/* ---------------------------------------------------------------- */
	/* Field events                                                      */
	/* ---------------------------------------------------------------- */
	function onField(e) {
		const t = e.target, p = t.dataset && t.dataset.b;
		if (!p) return;
		const isCheck = t.type === 'checkbox', isSel = t.tagName === 'SELECT';
		if ((isCheck || isSel) && e.type === 'input') return; // handled by 'change'
		const v = isCheck ? t.checked : (t.type === 'number' || t.type === 'range') ? (t.value === '' ? 0 : parseFloat(t.value)) : t.value;
		setP(p, v);
		if (t.type === 'range') { const b = t.parentNode.querySelector('b'); if (b) b.textContent = v; }
		if (t.type === 'color') { const c = t.parentNode.querySelector('code'); if (c) c.textContent = v; }
		changed(p);
	}
	root.addEventListener('input', onField);
	root.addEventListener('change', onField);

	function changed(p) {
		if (S.view === 'global') return;
		markDirty();
		const k = p.split('.')[0];
		if (k === 'layer') {
			updateLayerEl(curLayer());
			if (p === 'layer.name') { /* list label refreshes on next render */ }
		} else if (k === 'slide') { renderStageBg(); renderStrip(); }
		else if (p.startsWith('settings.height')) fitStage();
	}

	function pickMedia(path) {
		if (!window.wp || !wp.media) { toast('Media library is not available.', true); return; }
		const frame = wp.media({ title: 'Choose an image', multiple: false, library: { type: 'image' }, button: { text: 'Use this image' } });
		frame.on('select', () => {
			const a = frame.state().get('selection').first().toJSON();
			setP(path, a.url);
			if (S.view === 'global') renderGlobal(); else { changed(path); renderPanel(); }
		});
		frame.open();
	}

	/* ---------------------------------------------------------------- */
	/* Click actions                                                     */
	/* ---------------------------------------------------------------- */
	const confirmLeave = () => !S.dirty || window.confirm('You have unsaved changes. Leave without saving?');

	async function go(view) {
		if (S.view === 'edit' && !confirmLeave()) return;
		S.dirty = false;
		if (view === 'list') { try { S.sliders = await api('sliders'); } catch (e) { toast(e.message, true); } }
		S.view = view; S.cur = null; render();
	}

	async function openSlider(id) {
		try {
			const s = await api('sliders/' + id);
			s.slides.forEach(sl => { sl.layers = sl.layers || []; });
			S.cur = s; S.si = 0; S.li = null; S.tab = 'slide'; S.dirty = false; S.view = 'edit'; render();
		} catch (e) { toast(e.message, true); }
	}

	async function save() {
		const btn = $('#as-save'); if (btn) btn.disabled = true;
		try {
			const d = S.cur;
			const r = await api('sliders/' + d.id, 'PUT', { title: d.title, settings: d.settings, slides: d.slides });
			S.cur = r; S.si = Math.min(S.si, r.slides.length - 1);
			if (!curLayer()) S.li = null;
			S.dirty = false;
			renderStage(); renderStrip(); renderPanel();
			const b = $('#as-save'); if (b) b.classList.remove('dirty');
			toast('Saved');
		} catch (e) { toast(e.message, true); }
		const b2 = $('#as-save'); if (b2) b2.disabled = false;
	}

	const swap = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
	const cloneSlide = s => { const c = JSON.parse(JSON.stringify(s)); c.id = uid(); c.layers.forEach(l => { l.id = uid(); }); return c; };

	root.addEventListener('click', async e => {
		const seg = e.target.closest('.seg button');
		if (seg) {
			const p = seg.parentNode.dataset.seg;
			setP(p, seg.dataset.v);
			$$('button', seg.parentNode).forEach(b => b.classList.toggle('on', b === seg));
			changed(p);
			return;
		}
		const set = e.target.closest('[data-set]');
		if (set) { setP(set.dataset.set, set.dataset.v); changed(set.dataset.set); renderPanel(); return; }
		const med = e.target.closest('[data-media]');
		if (med) { pickMedia(med.dataset.media); return; }
		const clr = e.target.closest('[data-clear]');
		if (clr) { setP(clr.dataset.clear, ''); if (S.view === 'global') renderGlobal(); else { changed(clr.dataset.clear); renderPanel(); } return; }
		const go_ = e.target.closest('[data-go]');
		if (go_) { go(go_.dataset.go); return; }

		const el = e.target.closest('[data-act]');
		if (!el || el.disabled) return;
		const d = el.dataset, s = S.cur && curSlide();

		switch (d.act) {
			case 'new': try { const n = await api('sliders', 'POST', { title: 'Untitled slider' }); await openSlider(n.id); } catch (err) { toast(err.message, true); } break;
			case 'edit': openSlider(d.id); break;
			case 'dup': try { await api(`sliders/${d.id}/duplicate`, 'POST'); S.sliders = await api('sliders'); renderList(); toast('Slider duplicated'); } catch (err) { toast(err.message, true); } break;
			case 'del': if (window.confirm('Delete this slider and all of its slides? This cannot be undone.')) { try { await api('sliders/' + d.id, 'DELETE'); S.sliders = await api('sliders'); renderList(); toast('Slider deleted'); } catch (err) { toast(err.message, true); } } break;
			case 'copy': try { await navigator.clipboard.writeText(d.text); toast('Shortcode copied'); } catch (err) { toast(d.text); } break;
			case 'back': go('list'); break;
			case 'save': save(); break;
			case 'replay': replay(); break;
			case 'tab': S.tab = d.t; renderTabs(); renderPanel(); break;
			case 'pick-slide': S.si = +d.i; S.li = null; if (S.tab === 'layer') S.tab = 'slide'; renderStage(); renderStrip(); renderTabs(); renderPanel(); break;
			case 'add-slide': S.cur.slides.push(defSlide()); S.si = S.cur.slides.length - 1; S.li = null; S.tab = 'slide'; markDirty(); renderStage(); renderStrip(); renderTabs(); renderPanel(); break;
			case 'dup-slide': S.cur.slides.splice(S.si + 1, 0, cloneSlide(s)); S.si++; S.li = null; markDirty(); renderStage(); renderStrip(); renderPanel(); break;
			case 'del-slide':
				if (S.cur.slides.length < 2) { toast('A slider needs at least one slide.', true); break; }
				if (window.confirm('Delete this slide?')) { S.cur.slides.splice(S.si, 1); S.si = Math.max(0, S.si - 1); S.li = null; markDirty(); renderStage(); renderStrip(); renderPanel(); }
				break;
			case 'mv-slide': if (swap(S.cur.slides, S.si, +d.d)) { S.si += +d.d; markDirty(); renderStrip(); } break;
			case 'add-layer': { const l = defLayer(d.type); s.layers.push(l); S.li = l.id; S.tab = 'layer'; markDirty(); renderStage(); renderTabs(); renderPanel(); break; }
			case 'pick-layer': S.li = d.id; S.tab = 'layer'; $$('.as-l').forEach(x => x.classList.toggle('sel', x.dataset.id === d.id)); renderTabs(); renderPanel(); break;
			case 'mv-layer': { const i = s.layers.findIndex(l => l.id === d.id); if (swap(s.layers, i, +d.d)) { markDirty(); renderStage(); renderPanel(); } break; }
			case 'dup-layer': { const l = curLayer(), c = JSON.parse(JSON.stringify(l)); c.id = uid(); c.x = Math.min(100, c.x + 3); c.y = Math.min(100, c.y + 3); s.layers.push(c); S.li = c.id; markDirty(); renderStage(); renderPanel(); break; }
			case 'del-layer': s.layers = s.layers.filter(l => l.id !== S.li); S.li = null; S.tab = 'slide'; markDirty(); renderStage(); renderTabs(); renderPanel(); break;
			case 'save-global': try { S.global = await api('settings', 'PUT', S.global); toast('Settings saved'); renderGlobal(); } catch (err) { toast(err.message, true); } break;
			default: break;
		}
	});

	// Keyboard access for the pseudo-buttons
	root.addEventListener('keydown', e => {
		if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.th[data-act], .ar-nav a[data-go]')) { e.preventDefault(); e.target.click(); }
	});

	/* ---------------------------------------------------------------- */
	/* Global settings + help                                            */
	/* ---------------------------------------------------------------- */
	function renderGlobal() {
		const g = 'global.';
		root.innerHTML = shell(`<header class="top"><div><h1>Global settings</h1><p>Defaults for new sliders and plugin-wide options.</p></div><button class="btn pri" data-act="save-global">${I.save} Save settings</button></header>
			<div class="pg"><section class="box"><h2>Defaults for new sliders</h2><p>Existing sliders keep their own settings.</p>
				${fSelect('Transition', g + 'transition', Object.entries(C.transitions || {}))}${fNum('Transition speed', g + 'speed', 100, 5000, 50, 'ms')}${fToggle('Autoplay', g + 'autoplay')}${fNum('Time per slide', g + 'delay', 1000, 60000, 100, 'ms')}</section>
			<section class="box"><h2>Default arrow graphics</h2><p>Used by any slider set to "My graphics" that has no arrow images of its own.</p>${fMedia('Previous arrow', g + 'arrowPrevImage')}${fMedia('Next arrow', g + 'arrowNextImage')}</section>
			<section class="box"><h2>Custom CSS</h2><p>Loaded on pages that contain a slider.</p>${row('CSS', `<textarea data-b="${g}customCss" spellcheck="false" placeholder=".aurora-slider .as-btn { letter-spacing: .04em; }">${esc(S.global.customCss)}</textarea>`)}</section>
			<section class="box"><h2>Uninstall</h2>${fToggle('Delete all sliders and settings when the plugin is deleted', g + 'deleteOnUninstall', 'Removes the three Aurora database tables')}</section></div>`);
	}

	function renderHelp() {
		root.innerHTML = shell(`<header class="top"><div><h1>How to use</h1><p>From first slide to live page in a few steps.</p></div></header>
			<div class="pg"><section class="box"><h2>Publish a slider</h2><ol><li>Create a slider and add your slides, text, buttons and images.</li><li>Select <b>Save changes</b>.</li><li>Paste the shortcode, for example <code>[aurora_slider id="1"]</code>, into a page, post or a Shortcode block.</li></ol>
			<h2>In a theme template</h2><p><code>&lt;?php aurora_slider( 1 ); ?&gt;</code></p></section>
			<section class="box"><h2>Working on the canvas</h2><ul><li>Drag any text, button or image to place it. Drag the cyan handle to resize text and images.</li><li>The anchor setting decides which point of a layer sits at X and Y, so you can center things exactly.</li><li>Use Replay animations to preview entrance effects.</li></ul></section>
			<section class="box"><h2>Where your data lives</h2><p>Sliders, slides and settings are stored in three database tables with the prefix <code>aurora_</code>. Images stay in your Media Library.</p></section></div>`);
	}

	/* ---------------------------------------------------------------- */
	/* Boot                                                              */
	/* ---------------------------------------------------------------- */
	(async () => {
		try {
			[S.sliders, S.global] = await Promise.all([api('sliders'), api('settings')]);
			render();
		} catch (e) {
			root.innerHTML = `<p class="aurora-loading">Could not load Aurora Slider: ${esc(e.message)}</p>`;
		}
	})();
})();
