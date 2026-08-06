/* ==========================================================
   THONUS Engenharia — JavaScript principal
   ========================================================== */

(function () {
  'use strict';

  /* ── Header scroll ─────────────────────────────────────── */
  const header = document.querySelector('.header');
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 20);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── Menu hamburguer ────────────────────────────────────── */
  const toggle = document.querySelector('.nav-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (toggle && mobileMenu) {
    toggle.addEventListener('click', () => {
      const isOpen = mobileMenu.classList.toggle('open');
      toggle.classList.toggle('open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    /* fecha ao clicar em um link */
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    /* fecha ao clicar fora */
    document.addEventListener('click', (e) => {
      if (!header.contains(e.target) && mobileMenu.classList.contains('open')) {
        mobileMenu.classList.remove('open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── Marca link ativo no menu ──────────────────────────── */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-menu a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* ── Animação fade-in via IntersectionObserver ─────────── */
  const fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    fadeEls.forEach(el => observer.observe(el));
  }

  /* ── Filtro de portfólio ────────────────────────────────── */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const projectCards = document.querySelectorAll('.project-card');

  if (filterBtns.length && projectCards.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const category = btn.dataset.filter;
        projectCards.forEach(card => {
          const match = category === 'todos' || card.dataset.category === category;
          card.style.display = match ? '' : 'none';
        });
      });
    });
  }

  /* ── Ano do rodapé ──────────────────────────────────────── */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ── Formulário de contato (Web3Forms) ─────────────────── */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    const statusEl = document.getElementById('form-status');
    const submitBtn = document.getElementById('form-submit-btn');

    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'enviando...';
      statusEl.textContent = '';
      statusEl.className = 'form-status';

      try {
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(contactForm)
        });
        const result = await response.json();

        if (result.success) {
          statusEl.textContent = 'mensagem enviada com sucesso! entraremos em contato em breve.';
          statusEl.classList.add('form-status-success');
          contactForm.reset();
        } else {
          throw new Error(result.message || 'falha no envio');
        }
      } catch (err) {
        statusEl.textContent = 'não foi possível enviar agora. tente novamente ou fale pelo whatsapp.';
        statusEl.classList.add('form-status-error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'enviar mensagem';
      }
    });
  }

  /* ── Notícias do setor (blog) ──────────────────────────── */
  function formatShortDate(isoString) {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  function createNewsCard(item) {
    const article = document.createElement('article');
    article.className = 'news-card fade-in';

    if (item.image) {
      const thumb = document.createElement('a');
      thumb.className = 'news-card-thumb';
      thumb.href = item.link;
      thumb.target = '_blank';
      thumb.rel = 'noopener noreferrer';
      thumb.tabIndex = -1;
      thumb.setAttribute('aria-hidden', 'true');
      const img = document.createElement('img');
      img.src = item.image;
      img.alt = '';
      img.loading = 'lazy';
      thumb.appendChild(img);
      article.appendChild(thumb);
    }

    const info = document.createElement('div');
    info.className = 'news-card-info';

    const title = document.createElement('h3');
    title.className = 'news-card-title';
    const titleLink = document.createElement('a');
    titleLink.href = item.link;
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.textContent = item.title;
    title.appendChild(titleLink);
    info.appendChild(title);

    if (item.excerpt) {
      const excerpt = document.createElement('p');
      excerpt.className = 'news-card-excerpt';
      excerpt.textContent = item.excerpt;
      info.appendChild(excerpt);
    }

    const meta = document.createElement('p');
    meta.className = 'news-card-meta';
    const dateLabel = item.publishedAt ? formatShortDate(item.publishedAt) : '';
    meta.textContent = item.source + (dateLabel ? ' · ' + dateLabel : '');
    info.appendChild(meta);

    article.appendChild(info);
    return article;
  }

  const newsGrid = document.getElementById('news-grid');
  if (newsGrid) {
    const newsEmpty = document.getElementById('news-empty');
    const newsUpdated = document.getElementById('news-updated');

    fetch('/api/news')
      .then(response => response.json())
      .then(data => {
        const items = (data && data.items) || [];

        if (!items.length) {
          if (newsEmpty) newsEmpty.hidden = false;
          return;
        }

        items.forEach(item => newsGrid.appendChild(createNewsCard(item)));

        if (newsUpdated && data.generatedAt) {
          const updatedDate = new Date(data.generatedAt);
          if (!isNaN(updatedDate.getTime())) {
            const dateStr = updatedDate.toLocaleDateString('pt-BR');
            const timeStr = updatedDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            newsUpdated.textContent = `atualizado em ${dateStr} às ${timeStr}`;
            newsUpdated.hidden = false;
          }
        }

        const newsObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              newsObserver.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        newsGrid.querySelectorAll('.fade-in').forEach(el => newsObserver.observe(el));
      })
      .catch(() => {
        if (newsEmpty) newsEmpty.hidden = false;
      });
  }

  /* ── Contador de números (stats) ───────────────────────── */
  const statEls = document.querySelectorAll('[data-count]');
  if (statEls.length) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.count, 10);
          const suffix = el.dataset.suffix || '';
          const duration = 1200;
          const step = Math.ceil(target / (duration / 16));
          let current = 0;
          const timer = setInterval(() => {
            current += step;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            el.textContent = current + suffix;
          }, 16);
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    statEls.forEach(el => countObserver.observe(el));
  }

})();
