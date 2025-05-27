import { redux } from "@luna/lib";

export function getCurrentReduxTime() {
  // time since timestamp
  const now = Date.now();
  const timestamp =
    redux.store.getState().playbackControls.latestCurrentTimeSyncTimestamp;

  const lct = redux.store.getState().playbackControls.latestCurrentTime;

  return lct + (now - timestamp) / 1000;
}

export function addCurrentTimeListener(
  callback: (currentTime: number) => void,
) {
  const observer = new MutationObserver((mutations) => {
    const playerElement: HTMLVideoElement | null =
      document.querySelector("#video-one");
    if (playerElement && playerElement.currentTime) {
      callback(playerElement.currentTime);
    }
  });

  // Start observing document body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    characterDataOldValue: true,
  });

  return observer; // Return observer in case you need to disconnect later
}
