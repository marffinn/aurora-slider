/* Aurora Slider - frontend runtime (no dependencies) */
(function () {
	'use strict';

	var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	var P = 'perspective(1200px) ';

	// Each transition returns [enteringKeyframes, leavingKeyframes] for direction d (1 = forward, -1 = back)
	var T = {
		fade: function () {
			return [[{ opacity: 0 }, { opacity: 1 }], [{ opacity: 1 }, { opacity: 1 }]];
		},
		slide: function (d) {
			return [
				[{ transform: 'translateX(' + 100 * d + '%)' }, { transform: 'translateX(0)' }],
				[{ transform: 'translateX(0)' }, { transform: 'translateX(' + -100 * d + '%)' }]
			];
		},
		vertical: function (d) {
			return [
				[{ transform: 'translateY(' + 100 * d + '%)' }, { transform: 'translateY(0)' }],
				[{ transform: 'translateY(0)' }, { transform: 'translateY(' + -100 * d + '%)' }]
			];
		},
		zoom: function () {
			return [
				[{ opacity: 0, transform: 'scale(1.25)' }, { opacity: 1, transform: 'scale(1)' }],
				[{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.85)' }]
			];
		},
		flip: function (d) {
			return [
				[{ opacity: 0, transform: P + 'rotateY(' + 90 * d + 'deg)' }, { opacity: 1, transform: P + 'rotateY(0deg)' }],
				[{ opacity: 1, transform: P + 'rotateY(0deg)' }, { opacity: 0, transform: P + 'rotateY(' + -90 * d + 'deg)' }]
			];
		},
		blur: function () {
			return [
				[{ opacity: 0, filter: 'blur(24px)' }, { opacity: 1, filter: 'blur(0px)' }],
				[{ opacity: 1, filter: 'blur(0px)' }, { opacity: 0, filter: 'blur(24px)' }]
			];
		},
		curtain: function (d) {
			var from = d > 0 ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)';
			return [
				[{ clipPath: from }, { clipPath: 'inset(0 0 0 0)' }],
				[{ transform: 'translateX(0)' }, { transform: 'translateX(' + -18 * d + '%)' }]
			];
		},
		rotate: function (d) {
			return [
				[{ opacity: 0, transform: 'rotate(' + 8 * d + 'deg) scale(1.2)' }, { opacity: 1, transform: 'rotate(0deg) scale(1)' }],
				[{ opacity: 1, transform: 'rotate(0deg) scale(1)' }, { opacity: 0, transform: 'rotate(' + -8 * d + 'deg) scale(.9)' }]
			];
		}
	};

	function Slider(el) {
		if (el.__aurora) return;
		el.__aurora = true;

		var cfg = {};
		try { cfg = JSON.parse(el.getAttribute('data-config') || '{}'); } catch (e) {}

		// Scale the layer design space (1200px wide) down on narrow containers
		function resize() {
			var s = Math.max(0.4, Math.min(1, el.clientWidth / 1200));
			el.style.setProperty('--as-s', s.toFixed(4));
		}
		resize();
		if (window.ResizeObserver) new ResizeObserver(resize).observe(el);
		else window.addEventListener('resize', resize);

		var slides = [].slice.call(el.querySelectorAll('.as-slide'));
		if (slides.length < 2) return;

		var dots = [].slice.call(el.querySelectorAll('.as-dots button'));
		var prev = el.querySelector('.as-prev');
		var next = el.querySelector('.as-next');
		var bar = el.querySelector('.as-progress span');
		var cur = 0, busy = false, timer = null, barAnim = null, hovering = false, inView = true;

		function updateUI() {
			dots.forEach(function (d, i) {
				d.classList.toggle('is-active', i === cur);
				if (i === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
			});
			slides.forEach(function (s, i) { s.setAttribute('aria-hidden', i === cur ? 'false' : 'true'); });
		}

		function stopTimer() {
			clearTimeout(timer);
			if (barAnim) { barAnim.cancel(); barAnim = null; }
		}

		function schedule() {
			stopTimer();
			if (!cfg.autoplay || hovering || !inView || document.hidden) return;
			timer = setTimeout(function () { go(cur + 1, 1); }, cfg.delay);
			if (bar && bar.animate) {
				barAnim = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: cfg.delay, easing: 'linear', fill: 'forwards' });
			}
		}

		function go(n, dir) {
			var len = slides.length;
			if (busy) return;
			if (n >= len) { if (!cfg.loop) return; n = 0; }
			if (n < 0) { if (!cfg.loop) return; n = len - 1; }
			if (n === cur) return;
			dir = dir || (n > cur ? 1 : -1);

			var a = slides[cur], b = slides[n], name = cfg.transition;
			if (name === 'random') {
				var keys = Object.keys(T);
				name = keys[Math.floor(Math.random() * keys.length)];
			}

			busy = true;
			stopTimer();
			a.classList.remove('is-active');
			a.classList.add('is-leaving');
			b.classList.add('is-active');
			cur = n;
			updateUI();

			var anims = null;
			function finish() {
				a.classList.remove('is-leaving');
				if (anims) anims.forEach(function (x) { x.cancel(); });
				busy = false;
				schedule();
			}

			if (!b.animate) { finish(); return; }
			var kf = (T[name] || T.fade)(dir);
			var opts = { duration: reduce ? 1 : cfg.speed, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' };
			anims = [b.animate(kf[0], opts), a.animate(kf[1], opts)];
			Promise.all(anims.map(function (x) { return x.finished; })).then(finish, finish);
		}

		if (prev) prev.addEventListener('click', function () { go(cur - 1, -1); });
		if (next) next.addEventListener('click', function () { go(cur + 1, 1); });
		dots.forEach(function (d) {
			d.addEventListener('click', function () {
				var i = parseInt(d.getAttribute('data-i'), 10);
				go(i, i > cur ? 1 : -1);
			});
		});

		if (cfg.pauseHover) {
			el.addEventListener('mouseenter', function () { hovering = true; stopTimer(); });
			el.addEventListener('mouseleave', function () { hovering = false; schedule(); });
		}

		if (cfg.keyboard) {
			el.addEventListener('keydown', function (e) {
				if (e.key === 'ArrowLeft') go(cur - 1, -1);
				else if (e.key === 'ArrowRight') go(cur + 1, 1);
			});
		}

		if (cfg.swipe) {
			var sx = null, sy = 0;
			el.addEventListener('pointerdown', function (e) {
				if (e.target.closest && e.target.closest('.as-arrow, .as-dots')) return;
				sx = e.clientX; sy = e.clientY;
			}, { passive: true });
			el.addEventListener('pointerup', function (e) {
				if (sx === null) return;
				var dx = e.clientX - sx, dy = e.clientY - sy;
				sx = null;
				if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
			});
			el.addEventListener('pointercancel', function () { sx = null; });
		}

		if (window.IntersectionObserver) {
			new IntersectionObserver(function (en) {
				inView = en[0].isIntersecting;
				if (inView) schedule(); else stopTimer();
			}, { threshold: 0.2 }).observe(el);
		}
		document.addEventListener('visibilitychange', function () {
			if (document.hidden) stopTimer(); else schedule();
		});

		updateUI();
		schedule();
	}

	function init() {
		[].slice.call(document.querySelectorAll('.aurora-slider')).forEach(Slider);
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();

	window.AuroraSlider = { init: init };
})();
