import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  playHorrorSound,
  setDevilProximity,
  startHorrorAudio,
  stopHorrorAudio,
} from "./horrorAudio";
import { ROOM_SCALE, roomLayouts, scaleRoomPoint } from "./roomLayouts";

const MansionScene = lazy(() => import("./MansionScene"));

const rooms = [
  {
    id: "gallery",
    name: "The Portrait Gallery",
    subtitle: "The eyes in the paintings turn as you pass.",
    clue: "Behind the cracked portrait: the first rune is IV.",
    clueAction: "Turn the portrait",
    item: "iron key",
    itemAction: "Search the fallen coat",
    itemMessage: "You find a cold iron key in the coat pocket.",
  },
  {
    id: "library",
    name: "The Forbidden Library",
    subtitle: "A book falls open by itself. Its pages are still warm.",
    clue: "In the ledger, the second rune is VII.",
    clueAction: "Read the family ledger",
    item: "matches",
    itemAction: "Search the writing desk",
    itemMessage: "A dry matchbox is hidden beneath the papers.",
  },
  {
    id: "chapel",
    name: "The Abandoned Chapel",
    subtitle: "Something scratches at the chapel door from outside.",
    clue: "Carved beneath the altar: the final rune is I.",
    clueAction: "Inspect the altar",
  },
];

const toWorldInteractions = (targets) => targets.map(({ x, z, radius, ...interaction }) => ({
  ...interaction,
  ...scaleRoomPoint({ x, z }),
  radius: radius * ROOM_SCALE,
}));

const createGame = () => ({
  roomIndex: 0,
  clues: [],
  inventory: [],
  searchedItems: [],
  health: 3,
  threat: 0,
  turns: 0,
  isHiding: false,
  hidingSpotId: null,
  attackId: 0,
  status: "playing",
  message: "",
  code: "",
});

function Mansion({ onExit, onEscape, isSignedIn }) {
  const [game, setGame] = useState(createGame);
  const [seconds, setSeconds] = useState(240);
  const [syncMessage, setSyncMessage] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState("");
  const [scareFinishedId, setScareFinishedId] = useState(0);
  const [sceneResetId, setSceneResetId] = useState(0);
  const [entryId, setEntryId] = useState(0);
  const [devilStateInfo, setDevilStateInfo] = useState({ entryId: 0, state: "IDLE" });
  const [nearbyInteractionId, setNearbyInteractionId] = useState(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [exitCodeOpen, setExitCodeOpen] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const previousTurns = useRef(0);
  const movementKeys = useRef(new Set());
  const runeCodeInput = useRef(null);
  const feedbackTimer = useRef(null);
  const isTouchDevice = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);
  const [bestTime, setBestTime] = useState(() => {
    const saved = window.localStorage.getItem("hauntedEscapeBestTime");
    const savedSeconds = saved ? Number(saved) : null;
    return savedSeconds !== null && savedSeconds <= 240 ? savedSeconds : null;
  });
  const devilState = devilStateInfo.entryId === entryId ? devilStateInfo.state : "IDLE";

  useEffect(() => {
    if (game.status !== "playing") return undefined;

    const timer = window.setTimeout(() => {
      if (seconds <= 1) {
        setSeconds(0);
        setGame((state) => ({
          ...state,
          status: "lost",
          message: "The mansion swallows the last of the light.",
        }));
        return;
      }

      setSeconds(seconds - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [game.status, seconds]);

  useEffect(() => () => stopHorrorAudio(), []);

  useEffect(() => {
    setDevilProximity(
      devilState === "CHASE" || devilState === "ATTACK"
        ? 1
        : devilState === "INVESTIGATE" || devilState === "SEARCH"
          ? 0.55
          : 0
    );
    if (devilState === "IDLE") setDevilProximity(0);
  }, [devilState]);

  useEffect(() => {
    if (game.turns > previousTurns.current && !game.isHiding) {
      playHorrorSound("footsteps");
    }
    previousTurns.current = game.turns;
  }, [game.turns, game.isHiding]);

  useEffect(() => {
    if (game.attackId === 0) return undefined;

    playHorrorSound("growl");
  }, [game.attackId]);

  useEffect(() => () => window.clearTimeout(feedbackTimer.current), []);

  const room = rooms[game.roomIndex];
  const canUnlock = rooms.every((entry) => game.clues.includes(entry.id))
    && game.inventory.includes("iron key");
  const interactions = useMemo(() => {
    const layout = roomLayouts[game.roomIndex];
    const furniture = layout.furniture;
    const findFurniture = (name) => furniture.find((item) => item.name === name);
    const targets = [
      { id: `${room.id}-next`, type: "door", direction: 1, x: -2.75, z: 3.12, radius: 1.1, prompt: "Enter the next room" },
      { id: `${room.id}-previous`, type: "door", direction: -1, x: 2.75, z: 3.12, radius: 1.1, prompt: "Return to the previous room" },
    ];

    if (game.isHiding) {
      const spot = layout.hidingSpots.find(({ id }) => id === game.hidingSpotId);
      if (spot) {
        targets.push({
          id: `${room.id}-leave-hiding-${spot.id}`,
          type: "unhide",
          spotId: spot.id,
          x: spot.position.x,
          z: spot.position.z,
          radius: 0.9,
          prompt: `Leave ${spot.label}`,
        });
      }
      return toWorldInteractions(targets);
    }

    if (game.roomIndex === 0) {
      const portrait = findFurniture("portrait-center-left");
      if (!game.clues.includes(room.id)) {
        targets.push({
          id: "gallery-clue",
          type: "clue",
          x: portrait.x,
          z: portrait.z + 0.85,
          radius: 1.3,
          prompt: room.clueAction,
        });
      }

      const coat = findFurniture("fallen-coat");
      if (!game.searchedItems.includes(room.id)) {
        targets.push({
          id: "gallery-item",
          type: "item",
          x: coat.x,
          z: coat.z,
          radius: 1.2,
          prompt: room.itemAction,
        });
      }
    } else if (game.roomIndex === 1) {
      const desk = findFurniture("desk");
      const deskInteraction = {
        x: desk.x + desk.width / 2 + 0.35,
        z: desk.z + desk.depth / 2 + 0.35,
        radius: 1.45,
      };

      if (!game.clues.includes(room.id)) {
        targets.push({
          id: "library-clue",
          type: "clue",
          ...deskInteraction,
          prompt: room.clueAction,
        });
      } else if (!game.searchedItems.includes(room.id)) {
        targets.push({
          id: "library-item",
          type: "item",
          ...deskInteraction,
          prompt: room.itemAction,
        });
      }
    } else {
      const altar = findFurniture("altar");
      if (!game.clues.includes(room.id)) {
        targets.push({
          id: "chapel-clue",
          type: "clue",
          x: altar.x,
          z: altar.z + altar.depth / 2 + 0.45,
          radius: 1.05,
          prompt: room.clueAction,
        });
      }
    }

    if (game.roomIndex === 0) {
      targets.push({
        id: "gallery-exit",
        type: "exit",
        x: 0,
        z: 3.12,
        radius: 1.05,
        prompt: canUnlock ? "Unlock the front door" : "Inspect the locked front door",
      });
    }

    layout.hidingSpots.forEach((spot) => {
      targets.push({
        id: `${room.id}-hide-${spot.id}`,
        type: "hide",
        spotId: spot.id,
        x: spot.position.x,
        z: spot.position.z,
        radius: 0.9,
        prompt: `Hide ${spot.label}`,
      });
    });

    return toWorldInteractions(targets);
  }, [canUnlock, game.clues, game.hidingSpotId, game.isHiding, game.roomIndex, game.searchedItems, room]);
  const activeInteraction = interactions.find((interaction) => interaction.id === nearbyInteractionId) || null;

  const showFeedback = useCallback((message) => {
    setFeedbackMessage(message);
    window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = window.setTimeout(() => {
      setFeedbackMessage("");
      feedbackTimer.current = null;
    }, 2200);
  }, []);

  const handleDevilState = useCallback((nextState) => {
    setDevilStateInfo({ entryId, state: nextState });
    if (nextState === "CHASE") {
      showFeedback("The devil has seen you. Run or hide!");
      playHorrorSound("heartbeat");
    }
  }, [entryId, showFeedback]);

  const playDevilFootstep = useCallback(() => {
    playHorrorSound("devilStep");
  }, []);

  const takeTurn = useCallback((message, pressureChange = 1, change = (state) => state) => {
    showFeedback(message);
    setGame((state) => {
      let next = change(state);
      if (next === state) return state;
      if (next.status !== "playing") return next;

      return {
        ...next,
        threat: Math.min(4, Math.max(0, next.threat + pressureChange)),
        turns: next.turns + 1,
        message,
      };
    });
  }, [showFeedback]);

  const handleDevilAttack = useCallback(() => {
    showFeedback("The devil lunges at you. Run or hide!");
    setGame((state) => {
      if (state.status !== "playing" || state.isHiding) return state;
      const health = state.health - 1;
      return {
        ...state,
        health,
        threat: 0,
        attackId: state.attackId + 1,
        status: health <= 0 ? "lost" : "playing",
        message: health <= 0
          ? "The devil catches you. The mansion falls silent."
          : "The devil lunges at you. Run or hide before it reaches you again.",
      };
    });
  }, [showFeedback]);

  const searchClue = useCallback(() => {
    if (game.clues.includes(room.id)) {
      showFeedback("You have already found this clue.");
      setGame((state) => ({ ...state, message: "You have searched this clue already. The footsteps are getting closer." }));
      return;
    }

    takeTurn(room.clue, 1, (state) => {
      if (state.clues.includes(room.id)) return state;
      return { ...state, clues: [...state.clues, room.id] };
    });
  }, [game.clues, room.clue, room.id, takeTurn, showFeedback]);

  const searchItem = useCallback(() => {
    if (!room.item || game.searchedItems.includes(room.id)) return;

    takeTurn(room.itemMessage, 1, (state) => {
      if (state.searchedItems.includes(room.id)) return state;
      return {
        ...state,
        inventory: [...state.inventory, room.item],
        searchedItems: [...state.searchedItems, room.id],
      };
    });
  }, [game.searchedItems, room, takeTurn]);

  const changeRoom = useCallback((direction) => {
    playHorrorSound("door");
    movementKeys.current.clear();
    setEntryId((value) => value + 1);
    setNearbyInteractionId(null);
    setExitCodeOpen(false);
    setInventoryOpen(false);
    takeTurn(
      direction > 0 ? "You hurry through the connecting passage. Something hurries after you." : "You double back, trying not to make a sound.",
      1,
      (state) => ({
        ...state,
        roomIndex: (state.roomIndex + direction + rooms.length) % rooms.length,
        isHiding: false,
        hidingSpotId: null,
      })
    );
  }, [takeTurn]);

  const hide = useCallback((spotId) => {
    if (game.isHiding) {
      const spot = roomLayouts[game.roomIndex].hidingSpots.find(({ id }) => id === game.hidingSpotId);
      takeTurn(`You leave ${spot?.label || "your hiding place"}. The devil turns toward you.`, 1, (state) => ({
        ...state,
        isHiding: false,
        hidingSpotId: null,
      }));
      return;
    }

    const spot = roomLayouts[game.roomIndex].hidingSpots.find(({ id }) => id === spotId);
    if (!spot) {
      showFeedback("There is no hiding place here.");
      return;
    }

    playHorrorSound("hide");
    movementKeys.current.clear();
    showFeedback(`You hide ${spot.label}. Hold your breath.`);
    setGame((state) => ({
      ...state,
      isHiding: true,
      hidingSpotId: spot.id,
      threat: Math.max(0, state.threat - 2),
      turns: state.turns + 1,
      message: `You hide ${spot.label} and hold your breath as heavy footsteps pass.`,
    }));
  }, [game.hidingSpotId, game.isHiding, game.roomIndex, takeTurn, showFeedback]);

  const lightMatch = useCallback(() => {
    if (!game.inventory.includes("matches")) return;
    playHorrorSound("match");
    takeTurn(
      "The match flares. For a moment, you see a face watching from the ceiling.",
      -3,
      (state) => ({
        ...state,
        inventory: state.inventory.filter((item) => item !== "matches"),
      })
    );
  }, [game.inventory, takeTurn]);

  const interact = useCallback((interaction) => {
    if (!interaction) return;

    switch (interaction.type) {
      case "clue":
        searchClue();
        break;
      case "item":
        searchItem();
        break;
      case "hide":
      case "unhide":
        hide(interaction.spotId);
        break;
      case "door":
        changeRoom(interaction.direction);
        break;
      case "exit":
        if (!canUnlock) {
          showFeedback("The front door needs three runes and the iron key.");
          return;
        }
        setExitCodeOpen(true);
        document.exitPointerLock?.();
        window.setTimeout(() => runeCodeInput.current?.focus(), 0);
        break;
      default:
        return;
    }
  }, [canUnlock, changeRoom, hide, searchClue, searchItem, showFeedback]);

  useEffect(() => {
    if (game.status !== "playing" || game.isHiding) movementKeys.current.clear();

    const directions = {
      KeyW: "forward",
      ArrowUp: "forward",
      KeyS: "backward",
      ArrowDown: "backward",
      KeyA: "left",
      ArrowLeft: "left",
      KeyD: "right",
      ArrowRight: "right",
    };

    const handleKeyDown = (event) => {
      if (event.code === "Escape" && exitCodeOpen) {
        setExitCodeOpen(false);
        return;
      }

      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable=true]")) return;

      const direction = directions[event.code];
      if (direction && game.status === "playing" && !game.isHiding) {
        event.preventDefault();
        movementKeys.current.add(direction);
        return;
      }

      if (event.repeat || game.status !== "playing") return;
      if (event.code === "KeyE" && activeInteraction) {
        event.preventDefault();
        interact(activeInteraction);
      } else if (event.code === "KeyI") {
        event.preventDefault();
        setInventoryOpen((open) => !open);
      } else if (event.code === "KeyF" && game.inventory.includes("matches")) {
        event.preventDefault();
        lightMatch();
      }
    };
    const handleKeyUp = (event) => {
      const direction = directions[event.code];
      if (direction) movementKeys.current.delete(direction);
    };
    const clearMovement = () => movementKeys.current.clear();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearMovement);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearMovement);
    };
  }, [activeInteraction, exitCodeOpen, game.inventory, game.isHiding, game.status, interact, lightMatch]);

  const toggleSound = async () => {
    if (soundEnabled) {
      stopHorrorAudio();
      setSoundEnabled(false);
      return;
    }

    try {
      await startHorrorAudio();
      setSoundEnabled(true);
      setSoundError("");
    } catch (error) {
      const details = error instanceof Error ? error.message : String(error);
      setSoundError(`Audio could not be started: ${details}`);
    }
  };

  const unlockDoor = (event) => {
    event.preventDefault();
    if (!canUnlock) return;

    if (game.code.trim() === "471") {
      setExitCodeOpen(false);
      setGame((state) => ({ ...state, status: "won", message: "The key turns. The lock answers with three quiet clicks." }));
      setBestTime((current) => {
        if (current === null || seconds > current) {
          window.localStorage.setItem("hauntedEscapeBestTime", String(seconds));
          return seconds;
        }
        return current;
      });
      setSyncMessage(isSignedIn ? "Saving escape to your account..." : "Sign in to save escapes to your account.");
      if (onEscape) {
        onEscape(seconds)
          .then(setSyncMessage)
          .catch((error) => setSyncMessage(`Could not sync this escape: ${error.message}`));
      }
      return;
    }

    takeTurn("Wrong sequence. The lock clicks, and something answers from upstairs.");
    setGame((state) => ({ ...state, code: "" }));
  };

  const restart = () => {
    document.exitPointerLock?.();
    setGame(createGame());
    setSeconds(240);
    setSyncMessage("");
    setScareFinishedId(0);
    movementKeys.current.clear();
    setNearbyInteractionId(null);
    setInventoryOpen(false);
    setExitCodeOpen(false);
    setFeedbackMessage("");
    setEntryId(0);
    setSceneResetId((value) => value + 1);
  };

  const handleMovementPointerDown = useCallback((event) => {
    event.preventDefault();
    const direction = event.currentTarget.dataset.direction;
    if (direction && game.status === "playing" && !game.isHiding) movementKeys.current.add(direction);
  }, [game.isHiding, game.status]);
  const handleMovementPointerUp = useCallback((event) => {
    event.preventDefault();
    movementKeys.current.delete(event.currentTarget.dataset.direction);
  }, []);

  const timeLabel = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;
  const hidingSpot = game.isHiding
    ? roomLayouts[game.roomIndex].hidingSpots.find(({ id }) => id === game.hidingSpotId)
    : null;
  const hidingPosition = hidingSpot ? scaleRoomPoint(hidingSpot.position) : null;

  const exitGame = () => {
    document.exitPointerLock?.();
    stopHorrorAudio();
    onExit();
  };

  return (
    <main
      className={`mansion mansion-${room.id}${["CHASE", "ATTACK", "INVESTIGATE", "SEARCH"].includes(devilState) ? " devil-nearby" : ""}`}
      data-devil-state={devilState}
    >
      <Suspense fallback={<div className="scene-loading" role="status">LOADING MANSION</div>}>
        <MansionScene
          roomIndex={game.roomIndex}
          entryId={entryId}
          movementKeys={movementKeys}
          interactions={game.status === "playing" ? interactions : []}
          onNearbyInteraction={setNearbyInteractionId}
          threat={game.threat}
          isHiding={game.isHiding}
          hidingPosition={hidingPosition}
          attackId={game.attackId}
          canAttack={game.status === "playing"}
          onAttack={handleDevilAttack}
          onDevilState={handleDevilState}
          onFootstep={playDevilFootstep}
          onPointerLock={setIsPointerLocked}
          isTouchDevice={isTouchDevice}
          resetId={sceneResetId}
        />
      </Suspense>
      <div className="mansion-overlay" aria-hidden="true" />
      {game.attackId > scareFinishedId && (
        <div
          key={game.attackId}
          className="jumpscare-flash"
          aria-hidden="true"
          onAnimationEnd={() => setScareFinishedId(game.attackId)}
        />
      )}

      <header className="immersive-hud" aria-label="Game status">
        <div className="hud-status">
          <div className="health-meter" aria-label={`${game.health} lives remaining`}>
            {Array.from({ length: 3 }, (_, index) => (
              <span className={index < game.health ? "heart-full" : "heart-empty"} key={index}>♥</span>
            ))}
          </div>
          <span className="objective">CLUES {game.clues.length} / 3</span>
        </div>
        <div className="hud-actions">
          <button
            className="sound-toggle"
            type="button"
            onClick={toggleSound}
            aria-pressed={soundEnabled}
            aria-label={soundEnabled ? "Mute horror audio" : "Enable horror audio"}
          >
            {soundEnabled ? "♪ ON" : "♪ OFF"}
          </button>
          <p className={`game-clock${seconds <= 30 ? " clock-danger" : ""}`} aria-label={`${timeLabel} remaining`}>
            {timeLabel}
          </p>
          <button className="back-button" onClick={exitGame} aria-label="Exit to main menu">EXIT</button>
        </div>
      </header>
      {soundError && <p className="audio-error" role="status">{soundError}</p>}

      <div className="crosshair" aria-hidden="true" />
      {game.status === "playing" && activeInteraction && (
        <button className="interaction-prompt" type="button" onClick={() => interact(activeInteraction)}>
          <kbd>E</kbd>
          <span>PRESS E TO INTERACT</span>
          <strong>{activeInteraction.prompt}</strong>
        </button>
      )}
      {!isPointerLocked && game.status === "playing" && !isTouchDevice && (
        <p className="controls-hint">CLICK TO LOOK · WASD TO MOVE · E TO INTERACT · I FOR INVENTORY</p>
      )}
      {isTouchDevice && game.status === "playing" && !game.isHiding && (
        <div className="movement-pad" aria-label="Player movement controls">
          <span />
          <button type="button" data-direction="forward" aria-label="Move forward" onPointerDown={handleMovementPointerDown} onPointerUp={handleMovementPointerUp} onPointerLeave={handleMovementPointerUp} onPointerCancel={handleMovementPointerUp}>↑</button>
          <span />
          <button type="button" data-direction="left" aria-label="Move left" onPointerDown={handleMovementPointerDown} onPointerUp={handleMovementPointerUp} onPointerLeave={handleMovementPointerUp} onPointerCancel={handleMovementPointerUp}>←</button>
          <button type="button" data-direction="backward" aria-label="Move backward" onPointerDown={handleMovementPointerDown} onPointerUp={handleMovementPointerUp} onPointerLeave={handleMovementPointerUp} onPointerCancel={handleMovementPointerUp}>↓</button>
          <button type="button" data-direction="right" aria-label="Move right" onPointerDown={handleMovementPointerDown} onPointerUp={handleMovementPointerUp} onPointerLeave={handleMovementPointerUp} onPointerCancel={handleMovementPointerUp}>→</button>
        </div>
      )}
      {inventoryOpen && (
        <aside className="inventory-panel" aria-label="Inventory">
          <p>INVENTORY <kbd>I</kbd></p>
          {game.inventory.length
            ? game.inventory.map((item) => <span key={item}>{item}</span>)
            : <span>Empty</span>}
          {game.inventory.includes("matches") && <small>Press F to use matches</small>}
          {game.clues.length > 0 && (
            <section className="inventory-clues" aria-label="Found clues">
              <strong>FOUND CLUES</strong>
              {rooms.filter((entry) => game.clues.includes(entry.id)).map((entry) => (
                <span key={entry.id}>{entry.clue}</span>
              ))}
            </section>
          )}
        </aside>
      )}
      {feedbackMessage && game.status === "playing" && (
        <p className="game-feedback" role="status">{feedbackMessage}</p>
      )}
      {exitCodeOpen && canUnlock && game.status === "playing" && (
        <form className="exit-code-panel" onSubmit={unlockDoor}>
          <label htmlFor="rune-code">ENTER THE RUNES</label>
          <input
            ref={runeCodeInput}
            id="rune-code"
            value={game.code}
            onChange={(event) => setGame((state) => ({
              ...state,
              code: event.target.value.replace(/\D/g, "").slice(0, 3),
            }))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="___"
            aria-label="Three-digit rune code"
          />
          <button type="submit">UNLOCK</button>
          <button type="button" onClick={() => setExitCodeOpen(false)}>CANCEL</button>
        </form>
      )}

      {game.status !== "playing" && (
        <div className="end-screen">
          <div className="end-card">
            <p className="room-kicker">{game.status === "won" ? "THE CURSE IS BROKEN" : "THE MANSION CLAIMS ANOTHER"}</p>
            <h2>{game.status === "won" ? "You Escaped" : "Night Has Fallen"}</h2>
            <p>{game.status === "won"
              ? `You escaped with ${timeLabel} remaining.`
              : game.message}</p>
            {game.status === "won" && bestTime !== null && (
              <p className="best-time">
                Personal best: {String(Math.floor(bestTime / 60)).padStart(2, "0")}:{String(bestTime % 60).padStart(2, "0")}
              </p>
            )}
            {game.status === "won" && <p className="sync-message">{syncMessage}</p>}
            <button className="primary-game-button" onClick={restart}>PLAY AGAIN</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default Mansion;
