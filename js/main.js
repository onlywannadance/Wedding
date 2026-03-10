(function () {
  'use strict';

  var EVENT_DATE = new Date('2026-08-01T12:00:00');

  // URL веб-приложения Google Apps Script (оставьте пустым, если не используете таблицу)
  var SHEETS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxNSAyRzyjwwixCHwltgzwIKjizLW5ElDZ_ie-EyrgMNaM0YmFTBUBEpmSEh_L-5gSU/exec';
  // При открытии с localhost запрос идёт через локальный прокси (обход CORS). Запустите: node proxy-server.js
  var SUBMIT_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:3456'
    : SHEETS_WEB_APP_URL;

  // Соответствие value напитков и подписей для таблицы
  var DRINK_LABELS = {
    'champagne': 'Шампанское',
    'red': 'Вино красное',
    'white': 'Вино белое',
    'whiskey': 'Виски',
    'vodka': 'Водка',
    'martini': 'Мартини',
    'non-alcoholic': 'Безалкогольные напитки',
    'none': 'Не буду пить алкоголь'
  };

  // AOS init
  AOS.init({
    duration: 800,
    easing: 'ease-out-cubic',
    offset: 60,
    once: true,
    disable: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  });

  // Hero video
  var heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    heroVideo.play().catch(function () {});
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        heroVideo.pause();
      } else {
        heroVideo.play().catch(function () {});
      }
    });
  }

  // Red silk videos in sections (play when visible, pause when not)
  var silkVideos = document.querySelectorAll('.silk-video');
  if (silkVideos.length && 'IntersectionObserver' in window) {
    var videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var video = entry.target;
        if (entry.isIntersecting) {
          video.play().catch(function () {});
        } else {
          video.pause();
        }
      });
    }, { rootMargin: '50px', threshold: 0.1 });
    silkVideos.forEach(function (v) {
      videoObserver.observe(v);
    });
  } else {
    silkVideos.forEach(function (v) {
      v.play().catch(function () {});
    });
  }

  // Countdown timer (1 августа 2026)
  function updateCountdown() {
    var now = new Date();
    var diff = EVENT_DATE.getTime() - now.getTime();

    var elDays = document.getElementById('days');
    var elHours = document.getElementById('hours');
    var elMinutes = document.getElementById('minutes');
    var elSeconds = document.getElementById('seconds');

    if (diff <= 0) {
      if (elDays) elDays.textContent = '0';
      if (elHours) elHours.textContent = '0';
      if (elMinutes) elMinutes.textContent = '0';
      if (elSeconds) elSeconds.textContent = '0';
      return;
    }

    var s = Math.floor(diff / 1000) % 60;
    var m = Math.floor(diff / 60000) % 60;
    var h = Math.floor(diff / 3600000) % 24;
    var d = Math.floor(diff / 86400000);

    if (elDays) elDays.textContent = d;
    if (elHours) elHours.textContent = String(h).padStart(2, '0');
    if (elMinutes) elMinutes.textContent = String(m).padStart(2, '0');
    if (elSeconds) elSeconds.textContent = String(s).padStart(2, '0');
  }

  updateCountdown();
  setInterval(updateCountdown, 1000);

  // Guest form submit
  var guestForm = document.getElementById('guestForm');
  if (guestForm) {
    guestForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var attendVal = document.getElementById('attendInput') && document.getElementById('attendInput').value;
      if (!attendVal) {
        alert('Пожалуйста, укажите, планируете ли вы присутствовать.');
        var tr = document.getElementById('attendTrigger');
        if (tr) tr.focus();
        return;
      }
      var formData = new FormData(guestForm);
      var data = { guests: [] };
      formData.forEach(function (value, key) {
        if (key === 'attend') {
          data[key] = value;
        } else if (key === 'drink') {
          if (!data.guests[0]) data.guests[0] = {};
          if (!data.guests[0].drink) data.guests[0].drink = [];
          data.guests[0].drink.push(value);
        } else if (key.match(/^drink_\d+$/)) {
          var num = key.replace(/\D/g, '');
          var i = parseInt(num, 10) - 1;
          if (i >= 0) {
            while (data.guests.length <= i) data.guests.push({});
            if (!data.guests[i].drink) data.guests[i].drink = [];
            data.guests[i].drink.push(value);
          }
        } else if (key === 'name' || key === 'partner' || key === 'children') {
          if (!data.guests[0]) data.guests[0] = {};
          data.guests[0][key] = value;
        } else if (key.match(/^name_\d+$/) || key.match(/^partner_\d+$/) || key.match(/^children_\d+$/)) {
          var num = key.replace(/\D/g, '');
          var field = key.replace(/_\d+$/, '');
          var i = parseInt(num, 10) - 1;
          if (i >= 0) {
            while (data.guests.length <= i) data.guests.push({});
            data.guests[i][field] = value;
          }
        } else {
          data[key] = value;
        }
      });
      var attendText = data.attend === 'yes' ? 'Я приду / Мы придём' : 'К сожалению, не смогу / не сможем';
      function formatDrinks(arr) {
        if (!arr || !arr.length) return '';
        return arr.map(function (v) { return DRINK_LABELS[v] || v; }).join(', ');
      }
      if (SHEETS_WEB_APP_URL) {
        var submitBtn = guestForm.querySelector('.form-submit');
        if (submitBtn) submitBtn.disabled = true;
        var payload = {
          attend: attendText,
          guests: data.guests.map(function (g) {
            return {
              name: g.name || '',
              partner: g.partner || '',
              children: g.children || '',
              attend: attendText,
              drinks: formatDrinks(g.drink)
            };
          })
        };
        var headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        if (SUBMIT_URL.indexOf('127.0.0.1') !== -1) headers['X-Forward-To'] = SHEETS_WEB_APP_URL;
        fetch(SUBMIT_URL, {
          method: 'POST',
          headers: headers,
          body: 'data=' + encodeURIComponent(JSON.stringify(payload))
        }).then(function (res) {
          if (submitBtn) submitBtn.disabled = false;
          return res.text().then(function (text) {
            var result;
            try { result = JSON.parse(text); } catch (_) { result = {}; }
            if (!res.ok) {
              var msg = 'Сервер вернул ' + res.status;
              if (result && result.error) {
                var errText = result.error;
                if (errText.indexOf('<') !== -1 || errText.length > 200) {
                  msg += '. Вероятно, неверный URL веб-приложения — проверьте SHEETS_WEB_APP_URL (Развернуть → Управление развёртываниями в Apps Script).';
                } else {
                  msg += ': ' + errText;
                }
              }
              throw new Error(msg);
            }
            if (result && result.ok === false) throw new Error(result.error || 'Ошибка скрипта');
            return text;
          });
        }).then(function (text) {
          var result;
          try { result = JSON.parse(text); } catch (_) { result = {}; }
          var msg = 'Спасибо! Ваши данные сохранены. Мы ждём вас на празднике!';
          if (result && typeof result.rows === 'number') msg += ' Записано гостей: ' + result.rows + '.';
          alert(msg);
          guestForm.reset();
          var blocks = guestForm.querySelectorAll('.guest-block');
          for (var b = 1; b < blocks.length; b++) blocks[b].remove();
        }).catch(function (err) {
          if (submitBtn) submitBtn.disabled = false;
          console.error('Guest form:', err);
          alert('Не удалось отправить анкету. ' + (err.message || 'Проверьте интернет и URL в SHEETS_WEB_APP_URL.'));
        });
      } else {
        console.log('Guest form:', data);
        alert('Спасибо! Ваши данные сохранены. Мы ждём вас на празднике!');
        guestForm.reset();
        var blocks = guestForm.querySelectorAll('.guest-block');
        for (var b = 1; b < blocks.length; b++) blocks[b].remove();
      }
    });

    // Добавить гостя
    var addGuestBtn = document.getElementById('addGuestBtn');
    var guestBlocks = document.getElementById('guestBlocks');
    if (addGuestBtn && guestBlocks) {
      addGuestBtn.addEventListener('click', function () {
        var blocks = guestBlocks.querySelectorAll('.guest-block');
        var template = blocks[0];
        if (!template) return;
        var index = blocks.length + 1;
        var clone = template.cloneNode(true);
        clone.setAttribute('data-guest-index', index);
        clone.classList.add('guest-block-added');
        var inputs = clone.querySelectorAll('input[type="text"]');
        inputs.forEach(function (inp) {
          inp.value = '';
          var n = inp.getAttribute('name');
          if (n) inp.setAttribute('name', n + '_' + index);
        });
        var drinkChecks = clone.querySelectorAll('input[name="drink"]');
        drinkChecks.forEach(function (cb) {
          cb.checked = false;
          cb.setAttribute('name', 'drink_' + index);
        });
        guestBlocks.appendChild(clone);
      });

      // Удалить гостя (только у добавленных блоков, если блоков больше одного)
      guestBlocks.addEventListener('click', function (e) {
        if (!e.target.closest('.form-remove-guest')) return;
        var block = e.target.closest('.guest-block');
        var blocks = guestBlocks.querySelectorAll('.guest-block');
        if (block && blocks.length > 1) {
          block.remove();
          var remaining = guestBlocks.querySelectorAll('.guest-block');
          var lastBlock = remaining[remaining.length - 1];
          if (lastBlock) lastBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }

    // Кастомный выпадающий список «Планируете ли присутствовать?»
    var attendDropdown = document.getElementById('attendDropdown');
    var attendTrigger = document.getElementById('attendTrigger');
    var attendInput = document.getElementById('attendInput');
    var attendOptions = document.getElementById('attendOptions');
    var attendValueEl = attendDropdown && attendDropdown.querySelector('.custom-select-value');

    if (attendDropdown && attendTrigger && attendOptions && attendValueEl) {
      function openAttend() {
        attendDropdown.classList.add('is-open');
        attendOptions.removeAttribute('hidden');
        attendTrigger.setAttribute('aria-expanded', 'true');
      }
      function closeAttend() {
        attendDropdown.classList.remove('is-open');
        attendOptions.setAttribute('hidden', '');
        attendTrigger.setAttribute('aria-expanded', 'false');
      }

      attendTrigger.addEventListener('click', function (e) {
        e.preventDefault();
        if (attendDropdown.classList.contains('is-open')) {
          closeAttend();
        } else {
          openAttend();
        }
      });

      attendOptions.querySelectorAll('.custom-select-option').forEach(function (opt) {
        opt.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          var value = this.getAttribute('data-value');
          var text = this.textContent.trim();
          if (attendInput) attendInput.value = value;
          attendValueEl.textContent = text;
          attendValueEl.classList.remove('placeholder');
          closeAttend();
        });
      });

      document.addEventListener('click', function (e) {
        if (attendDropdown && !attendDropdown.contains(e.target)) {
          closeAttend();
        }
      });
    }
  }

  // Parallax hero (optional)
  var heroContent = document.querySelector('.hero-content');
  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (heroContent && heroVideo && !prefersReducedMotion) {
    window.addEventListener('scroll', function () {
      var hero = document.getElementById('hero');
      if (!hero) return;
      var rect = hero.getBoundingClientRect();
      if (rect.bottom > 0) {
        var rate = -rect.top * 0.15;
        heroContent.style.transform = 'translateY(' + rate + 'px)';
      } else {
        heroContent.style.transform = '';
      }
    }, { passive: true });
  }

  // Smooth scroll for # links
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Точка таймлайна движется вдоль линии вслед за прокруткой
  var timingSection = document.getElementById('timing');
  var timingTimeline = timingSection && timingSection.querySelector('.timing-timeline');
  var timingDot = timingTimeline && timingTimeline.querySelector('.timing-start-dot');
  if (timingSection && timingTimeline && timingDot && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var dotHeight = 10;
    function updateTimingDotPosition() {
      var rect = timingSection.getBoundingClientRect();
      var sectionTop = rect.top + window.pageYOffset;
      var sectionHeight = timingSection.offsetHeight;
      var timelineHeight = timingTimeline.offsetHeight;
      var scrollY = window.pageYOffset;
      var windowH = window.innerHeight;
      var start = sectionTop - windowH * 0.3;
      var end = sectionTop + sectionHeight - windowH * 0.3;
      var progress = (scrollY - start) / (end - start);
      progress = Math.max(0, Math.min(1, progress));
      var top = progress * (timelineHeight - dotHeight);
      timingDot.style.transform = 'translateY(' + (top - 5) + 'px)';
    }
    updateTimingDotPosition();
    window.addEventListener('scroll', updateTimingDotPosition, { passive: true });
    window.addEventListener('resize', updateTimingDotPosition);
  }
})();
