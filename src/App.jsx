import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULTS = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakEvery: 4,
};

function clampInt(value, min, max) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function nextSessionType(completedWorkSessions, longBreakEvery) {
  // After completing a work session, decide the next break type
  if (completedWorkSessions > 0 && completedWorkSessions % longBreakEvery === 0) {
    return "Long Break";
  }
  return "Short Break";
}

export default function App() {
  const [settings, setSettings] = useState(DEFAULTS);

  const [sessionType, setSessionType] = useState("Work"); // Work | Short Break | Long Break
  const [completedWorkSessions, setCompletedWorkSessions] = useState(0);

  const initialSeconds = useMemo(() => settings.workMinutes * 60, [settings.workMinutes]);
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  // Keep timer duration in sync when settings change AND timer is not running.
  useEffect(() => {
    if (isRunning) return;
    if (sessionType === "Work") setSecondsLeft(settings.workMinutes * 60);
    if (sessionType === "Short Break") setSecondsLeft(settings.shortBreakMinutes * 60);
    if (sessionType === "Long Break") setSecondsLeft(settings.longBreakMinutes * 60);
  }, [settings, sessionType, isRunning]);

  // Timer tick
  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  // When timer hits zero -> play sound -> switch session
  useEffect(() => {
    if (secondsLeft !== 0) return;

    // Only fire transition if we were running
    if (!isRunning) return;

    setIsRunning(false);

    // Play sound
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // Some browsers require user interaction; ignore if blocked
      });
    }

    // Switch sessions
    if (sessionType === "Work") {
      const newCount = completedWorkSessions + 1;
      setCompletedWorkSessions(newCount);

      const breakType = nextSessionType(newCount, settings.longBreakEvery);
      setSessionType(breakType);
      setSecondsLeft(
        breakType === "Long Break" ? settings.longBreakMinutes * 60 : settings.shortBreakMinutes * 60
      );
    } else {
      setSessionType("Work");
      setSecondsLeft(settings.workMinutes * 60);
    }
  }, [secondsLeft, isRunning, sessionType, completedWorkSessions, settings]);

  const totalForCurrentSession = useMemo(() => {
    if (sessionType === "Work") return settings.workMinutes * 60;
    if (sessionType === "Short Break") return settings.shortBreakMinutes * 60;
    return settings.longBreakMinutes * 60;
  }, [sessionType, settings]);

  const progress = useMemo(() => {
    const done = totalForCurrentSession - secondsLeft;
    return Math.min(1, Math.max(0, done / totalForCurrentSession));
  }, [totalForCurrentSession, secondsLeft]);

  function start() {
    setIsRunning(true);
  }

  function stop() {
    setIsRunning(false);
  }

  function resetSession() {
    setIsRunning(false);
    if (sessionType === "Work") setSecondsLeft(settings.workMinutes * 60);
    if (sessionType === "Short Break") setSecondsLeft(settings.shortBreakMinutes * 60);
    if (sessionType === "Long Break") setSecondsLeft(settings.longBreakMinutes * 60);
  }

  function skipToNext() {
    setIsRunning(false);
    if (sessionType === "Work") {
      const newCount = completedWorkSessions + 1;
      setCompletedWorkSessions(newCount);
      const breakType = nextSessionType(newCount, settings.longBreakEvery);
      setSessionType(breakType);
      setSecondsLeft(
        breakType === "Long Break" ? settings.longBreakMinutes * 60 : settings.shortBreakMinutes * 60
      );
    } else {
      setSessionType("Work");
      setSecondsLeft(settings.workMinutes * 60);
    }
  }

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">Pomodoro Timer</h1>
        <p className="subtitle" id="app-desc">
          Work in focused sessions and take breaks. Configurable intervals, session tracking, and sound alerts.
        </p>
      </header>

      <main className="grid" aria-describedby="app-desc">
        <section className="card" aria-label="Timer">
          <div className="row">
            <div>
              <p className="label">Current session</p>
              <p className="session" aria-live="polite">{sessionType}</p>
            </div>
            <div className="pill" aria-label="Completed work sessions">
              Work sessions: <strong>{completedWorkSessions}</strong>
            </div>
          </div>

          <div className="timerWrap">
            <div className="progress" role="img" aria-label={`Progress ${Math.round(progress * 100)}%`}>
              <div className="progressBar" style={{ transform: `scaleX(${progress})` }} />
            </div>

            <div className="time" aria-live="polite" aria-atomic="true">
              {formatTime(secondsLeft)}
            </div>
          </div>

          <div className="buttons" role="group" aria-label="Timer controls">
            {!isRunning ? (
              <button className="btn primary" onClick={start} aria-label="Start or resume timer">
                Start / Resume
              </button>
            ) : (
              <button className="btn" onClick={stop} aria-label="Stop timer">
                Stop
              </button>
            )}

            <button className="btn" onClick={resetSession} aria-label="Reset current session">
              Reset
            </button>

            <button className="btn" onClick={skipToNext} aria-label="Skip to next session">
              Skip
            </button>
          </div>

          {/* tiny built-in beep (base64-free approach): use an online mp3 later if you want; for now use WebAudio fallback */}
          <audio
            ref={audioRef}
            src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
            preload="auto"
          />
          <p className="hint">
            Tip: If sound doesn’t play, click a button once (some browsers require interaction).
          </p>
        </section>

        <section className="card" aria-label="Settings">
          <h2 className="cardTitle">Settings</h2>

          <div className="form">
            <label className="field">
              <span>Work (minutes)</span>
              <input
                type="number"
                min="1"
                max="120"
                value={settings.workMinutes}
                onChange={(e) => updateSetting("workMinutes", clampInt(e.target.value, 1, 120))}
                disabled={isRunning}
              />
            </label>

            <label className="field">
              <span>Short break (minutes)</span>
              <input
                type="number"
                min="1"
                max="60"
                value={settings.shortBreakMinutes}
                onChange={(e) => updateSetting("shortBreakMinutes", clampInt(e.target.value, 1, 60))}
                disabled={isRunning}
              />
            </label>

            <label className="field">
              <span>Long break (minutes)</span>
              <input
                type="number"
                min="1"
                max="90"
                value={settings.longBreakMinutes}
                onChange={(e) => updateSetting("longBreakMinutes", clampInt(e.target.value, 1, 90))}
                disabled={isRunning}
              />
            </label>

            <label className="field">
              <span>Long break after (work sessions)</span>
              <input
                type="number"
                min="2"
                max="10"
                value={settings.longBreakEvery}
                onChange={(e) => updateSetting("longBreakEvery", clampInt(e.target.value, 2, 10))}
                disabled={isRunning}
              />
            </label>
          </div>

          <p className="hint">
            Settings are disabled while the timer is running (prevents weird timing bugs).
          </p>
        </section>
      </main>

      <footer className="footer">
        <small>Built with React + Vite. Deployable to GitHub Pages.</small>
      </footer>
    </div>
  );
}
