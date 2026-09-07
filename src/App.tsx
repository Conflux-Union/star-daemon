import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { chapterCount, clamp, journeyState, planets } from './journey';

const Scene = lazy(() => import('./Scene'));

function OrbitMark({ small = false }: { small?: boolean }) {
  return (
    <svg
      width={small ? 20 : 32}
      height={small ? 20 : 32}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="9" stroke="currentColor" />
      <ellipse cx="20" cy="20" rx="19" ry="6" transform="rotate(-40 20 20)" stroke="currentColor" />
      <circle cx="20" cy="20" r="2.5" fill="currentColor" />
    </svg>
  );
}

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={diagonal ? { transform: 'rotate(-45deg)' } : undefined}
    >
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function App() {
  const progress = useRef(0);
  const panels = useRef<(HTMLElement | null)[]>([]);
  const progressLine = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [available, setAvailable] = useState(supportsWebGL);
  const [ready, setReady] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  const onReady = useCallback(() => setReady(true), []);
  const onFailure = useCallback(() => {
    setAvailable(false);
    setReady(false);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const step = document.getElementById('chapter-1')!.offsetTop;
      const value = clamp(window.scrollY / Math.max(1, step), 0, chapterCount - 1);
      progress.current = value;
      const state = journeyState(value);
      setActive(state.active);
      if (progressLine.current)
        progressLine.current.style.transform = `scaleX(${value / (chapterCount - 1)})`;
      panels.current.forEach((panel, i) => {
        if (!panel) return;
        let opacity = 0;
        if (state.from === state.to && i === state.from) opacity = 1;
        else if (i === state.from) opacity = clamp(1 - state.t * 3, 0, 1);
        else if (i === state.to) opacity = clamp((state.t - 0.65) / 0.35, 0, 1);
        if (reducedMotion) opacity = i === state.active ? 1 : 0;
        panel.style.opacity = String(opacity);
        panel.style.transform = `translateY(${reducedMotion ? 0 : (1 - opacity) * 16}px)`;
        panel.inert = opacity < 0.5;
        panel.setAttribute('aria-hidden', String(opacity < 0.5));
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!available || ready) return;
    const timeout = window.setTimeout(onFailure, 20000);
    return () => window.clearTimeout(timeout);
  }, [available, ready, onFailure]);

  useEffect(() => {
    if (aboutOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [aboutOpen]);

  const goTo = (index: number) => {
    const element = document.getElementById(`chapter-${index}`);
    if (element)
      window.scrollTo({ top: element.offsetTop, behavior: reducedMotion ? 'instant' : 'smooth' });
  };

  const retry = () => window.location.reload();

  return (
    <>
      <a className="skip-link" href="#chapter-navigation">
        跳至章节导航
      </a>
      <div className={`universe ${!available ? 'is-fallback' : ''}`} aria-hidden="true">
        {!available && <div className="space-dust" />}
        {!available && <div className={`fallback-planet planet-${active}`} />}
        {available && (
          <SceneBoundary onFailure={onFailure}>
            <Suspense fallback={null}>
              <Scene
                progress={progress}
                reducedMotion={reducedMotion}
                onReady={onReady}
                onFailure={onFailure}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
      <div className="screen-shade" aria-hidden="true" />

      <header className="site-header">
        <a
          className="wordmark"
          href="#chapter-0"
          onClick={(event) => {
            event.preventDefault();
            goTo(0);
          }}
          aria-label="Demo，返回首页"
        >
          <OrbitMark />
          <span>XXXXX</span>
        </a>
        <div className="header-center">
          <span className="status-dot" /> XXXXX XXXXX
        </div>
        <button className="about-button" onClick={() => setAboutOpen(true)}>
          关于 <Arrow diagonal />
        </button>
      </header>

      <main aria-label="演示页面">
        <div className="scroll-track">
          {Array.from({ length: chapterCount }, (_, i) => (
            <div key={i} id={`chapter-${i}`} className="chapter-anchor" />
          ))}
        </div>
        <div className="content-stage">
          <section
            className="hero chapter-panel"
            ref={(element) => {
              panels.current[0] = element;
            }}
            aria-labelledby="hero-title"
          >
            <div className="eyebrow">
              <span className="tiny-cross">+</span> XXXXX XXXXX <span className="eyebrow-line" />
            </div>
            <h1 id="hero-title">
              XXXXX
              <br />
              <span className="serif-word">XXXXX.</span>
            </h1>
            <p className="hero-chinese">XXXXX XXXXX</p>
            <p className="hero-description">
              XXXXX XXXXX XXXXX XXXXX
              <br />
              XXXXX XXXXX XXXXX XXXXX
            </p>
            <button className="explore-button" onClick={() => goTo(1)}>
              <span className="button-orbit">
                <Arrow />
              </span>
              <span>
                开始演示<span className="button-caption">XXXXX</span>
              </span>
            </button>
            <div className="hero-coordinate">
              XXXXX <span> / </span> XXXXX XXXXX
            </div>
          </section>
          {planets.map((planet, index) => (
            <section
              key={planet.id}
              ref={(element) => {
                panels.current[index + 1] = element;
              }}
              className={`planet-copy chapter-panel ${index % 2 === 0 ? 'copy-left' : 'copy-right'}`}
              style={{ '--planet-color': planet.color, opacity: 0 } as CSSProperties}
              aria-labelledby={`title-${planet.id}`}
            >
              <div className="eyebrow">
                <span className="chapter-number">0{index + 1}</span> / {planet.subtitle}
              </div>
              <p className="planet-name">{planet.name}</p>
              <h2 id={`title-${planet.id}`}>
                {planet.title}
                <span>.</span>
              </h2>
              <p className="planet-description">{planet.description}</p>
              <dl className="planet-facts">
                {planet.facts.map(([label, value], factIndex) => (
                  <div key={factIndex}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <button className="next-button" onClick={() => goTo(index === 5 ? 0 : index + 2)}>
                {index === 5 ? '返回首页' : '下一页'}
                <Arrow />
              </button>
              <div className="planet-footnote">
                XXXXX XXXXX <span> / </span> XXXXX XXXXX XXXXX
              </div>
            </section>
          ))}
        </div>
      </main>

      <nav className="chapter-nav" id="chapter-navigation" aria-label="章节导航">
        <span className="nav-caption">XXXXX</span>
        {['总览', ...planets.map((planet) => planet.name)].map((label, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={active === i ? 'active' : ''}
            aria-label={`${i === 0 ? '' : `第 ${i} 颗星球：`}${label}`}
            aria-current={active === i ? 'step' : undefined}
          >
            <span className="nav-label">{label}</span>
            <span className="nav-tick" />
          </button>
        ))}
        <span className="nav-counter">
          0{active + 1}
          <span>/ 07</span>
        </span>
      </nav>

      <footer className="site-footer">
        <div className="scroll-hint">
          <span className="mouse-icon">
            <span />
          </span>
          <span>{active === 6 ? '向上滚动' : '向下滚动'}</span>
        </div>
        <div className="footer-center">
          <span className="status-dot" />
          XXXXX XXXXX XXXXX
        </div>
        <span className="footer-right">
          XXXXX XXXXX <span>↗</span>
        </span>
      </footer>
      <div className="journey-progress" aria-hidden="true">
        <div ref={progressLine} />
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {active === 0 ? '恒星系总览' : `第 ${active} 颗星球：${planets[active - 1].title}`}
      </div>

      {available && !ready && (
        <div className="loading-notice" role="status">
          <span className="loading-ring" />
          正在加载<span className="loading-note">LOADING</span>
        </div>
      )}
      {!available && (
        <div className="fallback-notice" role="status">
          当前显示静态星图
          <button onClick={retry}>
            重试 3D <span>↻</span>
          </button>
        </div>
      )}

      <dialog
        ref={dialog}
        className="about-dialog"
        onCancel={() => setAboutOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setAboutOpen(false);
        }}
        aria-labelledby="about-title"
      >
        <button className="close-dialog" onClick={() => setAboutOpen(false)} aria-label="关闭介绍">
          ×
        </button>
        <OrbitMark />
        <p className="eyebrow">XXXXX XXXXX XXXXX</p>
        <h2 id="about-title">XXXXX XXXXX</h2>
        <p>XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.</p>
        <p>XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX XXXXX.</p>
        <p className="asset-credit">
          星球表面素材：
          <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">
            Solar System Scope
          </a>{' '}
          ·{' '}
          <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
          ，部分经调色演绎。
        </p>
        <div className="dialog-signoff">
          XXXXX XXXXX <span>XXXXX</span>
        </div>
      </dialog>
    </>
  );
}
