import type { LunaUnload } from "@luna/core";
import { redux, MediaItem, PlayState, ipcRenderer } from "@luna/lib";

import { intercept } from "plugins/lib/src/redux";
import { getCurrentReduxTime } from "./time";
import {
  startServer,
  stopServer,
  updateMediaInfo,
  checkInput,
} from "./serveApi.native";

export const unloads = new Set<LunaUnload>();

interface MediaInfo {
  /// the current track
  item: any | null;
  /// the playhead position in seconds
  position: number | null;
  /// the duration of the current track in seconds
  duration: number | null;
  /// an art URL for the current track's album
  albumArt: string | null;
  /// an art URL for the current track's artist
  artistArt: string | null;
  /// is the player paused
  paused: boolean;
  lastUpdate: number;
}

interface UpdateInfo {
  track?: MediaItem;
  time?: number;
  paused?: boolean;
}

let currentInfo: MediaInfo | null = null;

const getMediaURL = (id?: string, path = "/1280x1280.jpg") =>
  id
    ? "https://resources.tidal.com/images/" + id.split("-").join("/") + path
    : null;

const pollForInput = async () => {
  let input = await checkInput();
  if (input) {
    switch (input.playbackControl) {
      case "Play":
        PlayState.play();
        break;
      case "Pause":
        PlayState.pause();
        break;
      case "Next":
        PlayState.next();
        break;
      case "Previous":
        PlayState.previous();
        break;
    }
    if (input.shuffle) PlayState.setShuffle(!PlayState.shuffle);
    if (input.repeat) {
      let next = PlayState.repeat + 1;
      if (next > 2) next = 0;
      PlayState.setRepeat(next);
    }
    if (input.seek !== null && input.seek >= 0) {
      PlayState.seek(input.seek);
      PlayState.play();
    }
  }
};

export const update = async (info?: UpdateInfo) => {
  if (!info) {
    return;
  }

  if (!currentInfo) {
    currentInfo = {
      item: null,
      position: 0,
      duration: null,
      albumArt: null,
      artistArt: null,
      paused: false,
      lastUpdate: Date.now(),
    };
  }

  if (info.track) {
    currentInfo.item = info.track.tidalItem;
    console.log("Track changed:", currentInfo.item);
    const track = currentInfo.item;
    currentInfo.albumArt = await info.track.coverUrl();
    currentInfo.artistArt =
      track.artist && track.artist.picture
        ? getMediaURL(track.artist.picture, "/320x320.jpg")
        : null;

    currentInfo.duration = track.duration;
  }

  // Handle time and paused state updates (from polling)
  if (info.time !== undefined) {
    currentInfo.position = info.time;
    currentInfo.lastUpdate = Date.now();
  }

  if (info.paused !== undefined) {
    currentInfo.paused = info.paused;
  }

  //console.log("Current playback state:", currentInfo);

  // Ensure we have some minimal info before sending
  if (currentInfo.item || currentInfo.position !== null) {
    //console.log("Sending update");
    updateMediaInfo(currentInfo);
  } else {
    console.log("Not enough info to send update.");
  }
};

// forever
(() => {
  console.log(redux);
  const printPlayTime = async () => {
    let info = {
      time:
        PlayState.state === "NOT_PLAYING"
          ? redux.store.getState().playbackControls.latestCurrentTime
          : getCurrentReduxTime(),
      paused: PlayState.state === "NOT_PLAYING",
    };
    update(info);
    // wait for 1 second
    let t = setTimeout(printPlayTime, 1000);
    unloads.add(() => clearTimeout(t));
  };
  printPlayTime();
})();

const poll = async () => {
  pollForInput();
  let t = setTimeout(poll, 200);
  unloads.add(() => clearTimeout(t));
};
poll();

MediaItem.onMediaTransition(unloads, async (mediaItem) => {
  console.log("Media transitioned to " + (await mediaItem.title()));
  update({
    track: mediaItem,
  });
});

PlayState.onState(unloads, (state) => {
  console.log("Play state changed to " + state);
  update({
    paused: state !== "PLAYING",
  });
});
console.log(MediaItem);

export const onLoad = () => {
  console.log("Loading PlaybackAPI on port " + 3665);
  console.log("Secure mode " + "disabled.");
  try {
    server = startServer({
      port: 3665,
      secure: false,
      apiKey: undefined,
    });
    console.log("PlaybackAPI started");
    unloads.add(() => stopServer());
    unloads.add(() => {
      stopServer();
    });

    // finally, init the media info store
    const initStore = async () => {
      const item = await MediaItem.fromPlaybackContext();
      update({
        track: item,
      });
      console.log("Initial media info:", item);
    };
    initStore();
  } catch (error) {
    console.error("Failed to start PlaybackAPI:", error);
  }
};

onLoad();
