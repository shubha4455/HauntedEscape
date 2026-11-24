import { useEffect, useState } from "react";
import MansionScene from "./game/Mansion";
import { getAccount, loginAccount, registerAccount, saveEscape } from "./lib/accountApi";
import "./App.css";

function App() {
  const [playing, setPlaying] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [accountMode, setAccountMode] = useState("login");
  const [authToken, setAuthToken] = useState(() => window.sessionStorage.getItem("hauntedEscapeToken"));
  const [account, setAccount] = useState(null);
  const [accountError, setAccountError] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!authToken) return undefined;

    let active = true;
    getAccount(authToken)
      .then(({ account: currentAccount }) => {
        if (active) setAccount(currentAccount);
      })
      .catch((error) => {
        if (!active) return;
        window.sessionStorage.removeItem("hauntedEscapeToken");
        setAuthToken(null);
        setAccount(null);
        setAccountError(error.message);
      });

    return () => {
      active = false;
    };
  }, [authToken]);

  const openAccount = () => {
    setAccountError("");
    setDialog("account");
  };

  const submitAccount = async (event) => {
    event.preventDefault();
    setAccountBusy(true);
    setAccountError("");

    try {
      const result = accountMode === "register"
        ? await registerAccount({ email, displayName, password })
        : await loginAccount({ email, password });
      window.sessionStorage.setItem("hauntedEscapeToken", result.token);
      setAuthToken(result.token);
      setAccount(result.account);
      setPassword("");
    } catch (error) {
      setAccountError(error.message);
    } finally {
      setAccountBusy(false);
    }
  };

  const signOut = () => {
    window.sessionStorage.removeItem("hauntedEscapeToken");
    setAuthToken(null);
    setAccount(null);
    setAccountError("");
  };

  const recordEscape = async (remainingSeconds) => {
    if (!authToken) return "Sign in to save escapes to your account.";

    try {
      const result = await saveEscape(authToken, remainingSeconds);
      setAccount(result.account);
      return "Escape saved to your account.";
    } catch (error) {
      setAccountError(error.message);
      return `Could not sync this escape: ${error.message}`;
    }
  };

  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return "No escapes yet";
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };

  return (
    <div className="app-container">
      {!playing ? (
        <div className="main-menu">
          <div className="fog"></div>
          <div className="menu-content">
            <p className="subtitle">THE FORGOTTEN MANSION</p>
            <h1>
              HAUNTED
              <span>ESCAPE</span>
            </h1>
            <p className="description">
              Every shadow hides a secret.
              <br />
              Every door leads to the unknown.
            </p>

            <div className="menu-buttons">
              <button className="play-button" onClick={() => setPlaying(true)}>
                ENTER THE MANSION
              </button>
              <button onClick={openAccount}>
                {account ? `ACCOUNT · ${account.displayName}` : "SIGN IN / CREATE ACCOUNT"}
              </button>
              <button onClick={() => setDialog("settings")}>SETTINGS</button>
              <button onClick={() => setDialog("credits")}>CREDITS</button>
            </div>

            {account && (
              <p className="account-summary">
                CLOUD BEST: {formatTime(account.bestTime)} · ESCAPES: {account.escapeCount}
              </p>
            )}
            <p className="footer-text">A NIGHTMARE YOU CANNOT FORGET</p>
          </div>
        </div>
      ) : (
        <div className="game-screen">
          <MansionScene
            onExit={() => setPlaying(false)}
            onEscape={recordEscape}
            isSignedIn={Boolean(account)}
          />
        </div>
      )}

      {dialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}>
          <section
            className="info-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={dialog === "account" ? "Player account" : dialog === "settings" ? "Settings" : "Credits"}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {dialog === "account" ? (
              <>
                <p className="room-kicker">PLAYER ACCOUNT</p>
                {account ? (
                  <>
                    <h2>{account.displayName}</h2>
                    <p>{account.email}</p>
                    <p>Cloud best: {formatTime(account.bestTime)} · Escapes: {account.escapeCount}</p>
                    {accountError && <p className="account-error" role="alert">{accountError}</p>}
                    <div className="account-dialog-actions">
                      <button className="secondary-game-button" onClick={signOut}>SIGN OUT</button>
                      <button className="primary-game-button" onClick={() => setDialog(null)}>CLOSE</button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>{accountMode === "register" ? "Create Account" : "Welcome Back"}</h2>
                    <form className="account-form" onSubmit={submitAccount}>
                      {accountMode === "register" && (
                        <label>
                          Display name
                          <input
                            value={displayName}
                            onChange={(event) => setDisplayName(event.target.value)}
                            minLength={2}
                            maxLength={24}
                            autoComplete="nickname"
                            required
                          />
                        </label>
                      )}
                      <label>
                        Email
                        <input
                          type="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          autoComplete="email"
                          maxLength={254}
                          required
                        />
                      </label>
                      <label>
                        Password {accountMode === "register" && "(10+ characters)"}
                        <input
                          type="password"
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          minLength={accountMode === "register" ? 10 : 1}
                          maxLength={128}
                          autoComplete={accountMode === "register" ? "new-password" : "current-password"}
                          required
                        />
                      </label>
                      {accountError && <p className="account-error" role="alert">{accountError}</p>}
                      <button className="primary-game-button" type="submit" disabled={accountBusy}>
                        {accountBusy ? "PLEASE WAIT..." : accountMode === "register" ? "CREATE ACCOUNT" : "SIGN IN"}
                      </button>
                    </form>
                    <button
                      className="account-mode-button"
                      onClick={() => {
                        setAccountMode(accountMode === "register" ? "login" : "register");
                        setAccountError("");
                      }}
                    >
                      {accountMode === "register" ? "Already registered? Sign in" : "New here? Create an account"}
                    </button>
                    <button className="account-mode-button" onClick={() => setDialog(null)}>
                      CLOSE
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="room-kicker">{dialog === "settings" ? "GAME OPTIONS" : "PROJECT CREDITS"}</p>
                <h2>{dialog === "settings" ? "Settings" : "Credits"}</h2>
                {dialog === "settings" ? (
                  <p>Your local best time stays in this browser. Sign in to save escape records to your account.</p>
                ) : (
                  <p>Created for Haunted Escape — a cinematic React puzzle adventure.</p>
                )}
                <button className="primary-game-button" onClick={() => setDialog(null)}>CLOSE</button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
