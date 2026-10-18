/**
 * Chrono City application shell.
 *
 * Fullscreen Three.js canvas plus the HUD: timeline slider, active era panel,
 * sound toggle, loading overlay and a WebGL fallback. All scene lifetime is
 * owned by the mount effect, which removes the canvas and disposes the scene
 * even if construction throws after the renderer appended it.
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { CityScene, isWebGLAvailable } from '@/scene/CityScene';
import {
  ERAS,
  ERA_LIST,
  ERA_YEARS,
  stepEra,
  type EraYear,
} from '@/scene/eras';

const YEAR_START: EraYear = 1945;

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="chrono-icon">
      <path
        d="M4 9.5h3.2L12 5.5v13L7.2 14.5H4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {muted ? (
        <path
          d="M16 9l5 6M21 9l-5 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d="M16 9.5a4 4 0 010 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M18.5 7a7.5 7.5 0 010 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="chrono-icon">
      <path
        d="M4 12a8 8 0 1114.4 4.8M4 12V6m0 6h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChronoCityApp() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<CityScene | null>(null);
  const [year, setYear] = useState<EraYear>(YEAR_START);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [webglMissing, setWebglMissing] = useState(false);
  const yearRef = useRef<EraYear>(YEAR_START);

  const era = ERAS[year];
  const eraIndex = ERA_YEARS.indexOf(year);

  // ---------------------------------------------------------------------
  // Scene mount / unmount. Cleanup is unconditional: even if the CityScene
  // constructor throws after appending the renderer canvas, the canvas is
  // removed and any partially built scene is disposed.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let cancelled = false;
    let scene: CityScene | null = null;

    if (!isWebGLAvailable()) {
      setWebglMissing(true);
      setLoading(false);
      return;
    }

    try {
      scene = new CityScene(container, {
        year: YEAR_START,
        onFirstRender: () => {
          if (!cancelled) setLoading(false);
        },
      });
      sceneRef.current = scene;
    } catch {
      // Construction failed after the canvas may have been appended: clean up
      // and show the static fallback rather than leaving a broken canvas.
      container.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
      if (!cancelled) {
        setWebglMissing(true);
        setLoading(false);
      }
    }

    return () => {
      cancelled = true;
      scene?.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
      // Belt and braces: never leave an orphan canvas in the mount point.
      container.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
    };
  }, []);

  // The era state is the single source of truth: the scene follows it.
  useEffect(() => {
    sceneRef.current?.setEra(year);
  }, [year]);

  useEffect(() => {
    sceneRef.current?.setMuted(muted);
  }, [muted]);

  // AudioContext creation is gesture-gated.
  useEffect(() => {
    const unlock = () => sceneRef.current?.unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Apply the era to the scene synchronously (a click should start the
  // cross-fade immediately), then let React update the HUD.
  const selectEra = useCallback((next: EraYear) => {
    yearRef.current = next;
    sceneRef.current?.setEra(next);
    setYear(next);
  }, []);

  const step = useCallback((delta: number) => {
    selectEra(stepEra(yearRef.current, delta));
  }, [selectEra]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const isRange = target instanceof HTMLInputElement && target.type === 'range';
      const isTyping =
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLInputElement && !isRange) ||
        target?.isContentEditable === true;

      if (event.key === 'm' || event.key === 'M') {
        if (isTyping) return;
        event.preventDefault();
        setMuted((current) => !current);
        return;
      }
      if (isTyping || isRange) return;

      if (event.key >= '1' && event.key <= '5') {
        event.preventDefault();
        const index = Number(event.key) - 1;
        selectEra(ERA_YEARS[index]);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        step(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        step(-1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectEra, step]);

  useEffect(() => {
    if (!loading) return;
    const watchdog = window.setTimeout(() => setLoading(false), 12000);
    return () => window.clearTimeout(watchdog);
  }, [loading]);

  const accentStyle = { '--era-accent': era.palette.accent } as CSSProperties;

  return (
    <div
      className="chrono-app"
      style={accentStyle}
      data-active-era={era.year}
      data-testid="chrono-app"
    >
      <div ref={mountRef} className="chrono-stage" data-testid="chrono-stage" />
      <div className="chrono-vignette" aria-hidden="true" />

      {/* ------------------------------------------------------------------ */}
      {/* Top HUD: brand, timeline slider, sound                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="chrono-header">
        <div className="chrono-brand">
          <span className="chrono-kicker">Chrono City</span>
          <h1 className="chrono-wordmark">1945–2025</h1>
          <span className="chrono-subtitle">One block, eighty years</span>
        </div>

        <div className="chrono-timeline" role="group" aria-label="Timeline eras">
          <div className="chrono-timeline-labels">
            {ERA_LIST.map((entry) => (
              <button
                key={entry.year}
                type="button"
                className={`chrono-era-button${entry.year === year ? ' is-active' : ''}`}
                data-testid={`era-${entry.year}`}
                aria-pressed={entry.year === year}
                onClick={() => selectEra(entry.year)}
                title={entry.name}
              >
                <span className="chrono-era-year">{entry.year}</span>
              </button>
            ))}
          </div>
          <div className="chrono-track">
            <div
              className="chrono-track-fill"
              style={{ width: `${(eraIndex / (ERA_YEARS.length - 1)) * 100}%` }}
            />
            <input
              type="range"
              min={0}
              max={ERA_YEARS.length - 1}
              step={1}
              value={eraIndex}
              onChange={(event) => selectEra(ERA_YEARS[Number(event.target.value)] ?? year)}
              className="chrono-range"
              aria-label="Timeline year"
              data-testid="timeline-slider"
            />
          </div>
          <div className="chrono-timeline-meta">
            <span data-testid="timeline-caption">
              {era.year} · {era.name}
            </span>
            <span className="chrono-timeline-mood">{era.mood}</span>
          </div>
        </div>

        <div className="chrono-actions">
          <button
            type="button"
            className="chrono-control"
            data-testid="audio-toggle"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            aria-pressed={!muted}
            onClick={() => setMuted((current) => !current)}
            title="Toggle city sound (M)"
          >
            <SoundIcon muted={muted} />
            <span>{muted ? 'Muted' : 'Sound'}</span>
          </button>
          <button
            type="button"
            className="chrono-control chrono-control-icon"
            data-testid="reset-view"
            aria-label="Reset camera view"
            onClick={() => window.__chrono?.resetCamera()}
            title="Reset view"
          >
            <ResetIcon />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Era panel                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="chrono-panel" aria-live="polite">
        <div className="chrono-panel-head">
          <span className="chrono-panel-year" data-testid="era-year">
            {era.year}
          </span>
          <h2 className="chrono-panel-title" data-testid="era-label">
            {era.name}
          </h2>
        </div>
        <p className="chrono-panel-description" data-testid="era-description">
          {era.description}
        </p>
        <dl className="chrono-stats">
          <div>
            <dt>Vehicles</dt>
            <dd data-testid="era-vehicle-count">{era.vehicles.count}</dd>
          </div>
          <div>
            <dt>Pedestrians</dt>
            <dd data-testid="era-pedestrian-count">{era.pedestrians.count}</dd>
          </div>
          <div>
            <dt>Storefronts</dt>
            <dd data-testid="era-storefront-count">{era.storefronts.length}</dd>
          </div>
        </dl>
        <p className="chrono-hint">
          Drag to orbit · Scroll to zoom · Keys 1–5 select an era · ← → step · M mutes
        </p>
      </section>

      <div className="chrono-legend" aria-hidden="true">
        <span className="chrono-dot" />
        <span>Procedural scene · no external assets</span>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Loading overlay                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div
        className={`chrono-loading${loading ? ' is-visible' : ''}`}
        data-testid="loading"
        aria-hidden={!loading}
      >
        <div className="chrono-loading-card">
          <div className="chrono-spinner" aria-hidden="true" />
          <p className="chrono-loading-title">Building the block</p>
          <p className="chrono-loading-year">{year}</p>
          <p className="chrono-loading-note">Painting brick, glass, chrome and neon…</p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* WebGL fallback                                                      */}
      {/* ------------------------------------------------------------------ */}
      {webglMissing && (
        <div className="chrono-fallback" data-testid="webgl-fallback" role="alert">
          <div className="chrono-fallback-card">
            <span className="chrono-fallback-badge">Chrono City 1945–2025</span>
            <h2>WebGL is unavailable</h2>
            <p>
              This experience renders a full 3D city block in the browser. Enable hardware
              acceleration or open it in a WebGL-capable browser to travel through the eras.
            </p>
            <h3>
              {era.year} · {era.name}
            </h3>
            <p className="chrono-fallback-description">{era.description}</p>
            <div className="chrono-fallback-timeline" aria-hidden="true">
              {ERA_LIST.map((entry) => (
                <span key={entry.year} className={entry.year === year ? 'is-active' : ''}>
                  {entry.year}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
