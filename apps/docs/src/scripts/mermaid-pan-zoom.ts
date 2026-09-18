import mermaid from 'mermaid';

function getMermaidTheme(): 'dark' | 'default' {
  const theme = document.documentElement.dataset.theme;
  return theme === 'dark' ? 'dark' : 'default';
}

function initMermaid(): void {
  mermaid.initialize({
    startOnLoad: false,
    theme: getMermaidTheme(),
    securityLevel: 'loose',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });
}

function setupPanZoom(container: HTMLElement, svg: SVGElement): {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
} {
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  const updateTransform = () => {
    svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    updateTransform();
  };

  const onMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      container.style.cursor = 'grab';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
  };

  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
    container.style.cursor = 'grabbing';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });

  // Touch Support (Drag & Pinch-to-Zoom on mobile)
  let touchStartX = 0;
  let touchStartY = 0;
  let initialPinchDist = 0;
  let initialScale = 1;

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1 && e.touches[0]) {
      isDragging = true;
      touchStartX = e.touches[0].clientX - translateX;
      touchStartY = e.touches[0].clientY - translateY;
    } else if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
      isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDist = Math.hypot(dx, dy);
      initialScale = scale;
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1 && e.touches[0]) {
      translateX = e.touches[0].clientX - touchStartX;
      translateY = e.touches[0].clientY - touchStartY;
      updateTransform();
    } else if (e.touches.length === 2 && e.touches[0] && e.touches[1] && initialPinchDist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / initialPinchDist;
      scale = Math.min(Math.max(initialScale * factor, 0.2), 6.0);
      updateTransform();
    }
  }, { passive: true });

  container.addEventListener('touchend', () => {
    isDragging = false;
    initialPinchDist = 0;
  }, { passive: true });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.2), 6.0);
    scale = newScale;
    updateTransform();
  }, { passive: false });

  return {
    zoomIn: () => {
      scale = Math.min(scale * 1.25, 6.0);
      updateTransform();
    },
    zoomOut: () => {
      scale = Math.max(scale * 0.8, 0.2);
      updateTransform();
    },
    reset: () => {
      scale = 1;
      translateX = 0;
      translateY = 0;
      updateTransform();
    },
  };
}

async function renderMermaidDiagrams(): Promise<void> {
  const codeBlocks = document.querySelectorAll<HTMLElement>(
    'pre[data-language="mermaid"], pre:has(code.language-mermaid), pre.language-mermaid, pre.mermaid, code.language-mermaid'
  );

  if (codeBlocks.length === 0) return;

  initMermaid();

  for (let i = 0; i < codeBlocks.length; i++) {
    const block = codeBlocks[i];
    if (!block || block.dataset.processed === 'true') continue;

    const preElement = block.tagName === 'PRE' ? block : block.closest('pre');
    if (!preElement || preElement.dataset.processed === 'true') continue;

    preElement.dataset.processed = 'true';

    // In Expressive Code, code lines are inside .ec-line divs
    const ecLines = preElement.querySelectorAll('.ec-line');
    let rawCode = '';
    if (ecLines.length > 0) {
      rawCode = Array.from(ecLines).map(line => line.textContent || '').join('\n').trim();
    } else {
      rawCode = (preElement.textContent || '').trim();
    }

    if (!rawCode) continue;

    const diagramId = `mermaid-dynamic-${Date.now()}-${i}`;

    try {
      const { svg } = await mermaid.render(diagramId, rawCode);

      const wrapper = document.createElement('div');
      wrapper.className = 'mermaid-wrapper';

      const toolbar = document.createElement('div');
      toolbar.className = 'mermaid-toolbar';

      const title = document.createElement('div');
      title.className = 'mermaid-title';
      title.innerHTML = '<span>📊</span><span>مخطط تفاعلي (Pan & Zoom)</span>';

      const actions = document.createElement('div');
      actions.className = 'mermaid-actions';

      const zoomInBtn = document.createElement('button');
      zoomInBtn.type = 'button';
      zoomInBtn.className = 'mermaid-btn';
      zoomInBtn.title = 'تكبير (Zoom In)';
      zoomInBtn.innerText = '➕';

      const zoomOutBtn = document.createElement('button');
      zoomOutBtn.type = 'button';
      zoomOutBtn.className = 'mermaid-btn';
      zoomOutBtn.title = 'تصغير (Zoom Out)';
      zoomOutBtn.innerText = '➖';

      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'mermaid-btn';
      resetBtn.title = 'إعادة ضبط (Reset)';
      resetBtn.innerText = '⟲';

      const fullscreenBtn = document.createElement('button');
      fullscreenBtn.type = 'button';
      fullscreenBtn.className = 'mermaid-btn';
      fullscreenBtn.title = 'شاشة كاملة (Fullscreen)';
      fullscreenBtn.innerText = '⛶';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'mermaid-btn';
      copyBtn.title = 'نسخ كود المخطط';
      copyBtn.innerText = '📋';

      actions.appendChild(zoomInBtn);
      actions.appendChild(zoomOutBtn);
      actions.appendChild(resetBtn);
      actions.appendChild(fullscreenBtn);
      actions.appendChild(copyBtn);

      toolbar.appendChild(title);
      toolbar.appendChild(actions);

      const viewport = document.createElement('div');
      viewport.className = 'mermaid-viewport';
      viewport.innerHTML = svg;

      wrapper.appendChild(toolbar);
      wrapper.appendChild(viewport);

      const svgElement = viewport.querySelector<SVGElement>('svg');
      if (svgElement) {
        svgElement.style.width = '100%';
        svgElement.style.height = '100%';

        const controls = setupPanZoom(viewport, svgElement);
        zoomInBtn.addEventListener('click', controls.zoomIn);
        zoomOutBtn.addEventListener('click', controls.zoomOut);
        resetBtn.addEventListener('click', controls.reset);

        fullscreenBtn.addEventListener('click', () => {
          wrapper.classList.toggle('mermaid-fullscreen');
          controls.reset();
        });

        // Close on Escape if fullscreen
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && wrapper.classList.contains('mermaid-fullscreen')) {
            wrapper.classList.remove('mermaid-fullscreen');
            controls.reset();
          }
        });

        copyBtn.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(rawCode);
            copyBtn.innerText = '✓';
            setTimeout(() => {
              copyBtn.innerText = '📋';
            }, 1500);
          } catch {
            // ignore clipboard errors
          }
        });
      }

      // Replace outer container (e.g. Expressive Code frame or pre)
      const targetContainer = preElement.closest('.expressive-code') || preElement.closest('figure') || preElement;
      targetContainer.parentNode?.replaceChild(wrapper, targetContainer);
    } catch (err) {
      console.warn('Mermaid rendering failed for block:', err);
    }
  }
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => void renderMermaidDiagrams());
  } else {
    void renderMermaidDiagrams();
  }
  document.addEventListener('astro:page-load', () => {
    void renderMermaidDiagrams();
  });
}

