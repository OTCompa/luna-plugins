import { ReactiveStore } from "@luna/core";
import React from "react";

import {} from "@luna/lib";
import {
  LunaSettings,
  LunaNumberSetting,
  LunaTextSetting,
  LunaSwitchSetting,
} from "@luna/ui";

export const settings = await ReactiveStore.getPluginStorage("playbackapi", {
  apiHost: "127.0.0.1",
  apiPort: 3665,
  notifyClient: false,
  clientHost: "127.0.0.1",
  clientPort: 3666,
});

export const Settings = () => {
  const [apiHost, setApiHost] = React.useState(settings.apiHost);
  const [apiPort, setApiPort] = React.useState(settings.apiPort);
  const [notifyClient, setNotifyClient] = React.useState(settings.notifyClient);
  const [clientHost, setClientHost] = React.useState(settings.clientHost);
  const [clientPort, setClientPort] = React.useState(settings.clientPort);
  return (
    <LunaSettings>
      <LunaTextSetting
        title="API Host"
        desc="Host to broadcast to"
        value={apiHost}
        onChange={(host: string) => setApiHost((settings.apiHost = host))}
      />
      <LunaNumberSetting
        title="API Port"
        desc="Desired port to broadcast to"
        value={apiPort}
        min={1}
        max={65535}
        onNumber={(num: number) => setApiPort((settings.apiPort = num))}
      />
      <LunaSwitchSetting
        title="Notify Client"
        desc="Whether to notify the client of server life on load"
        checked={notifyClient}
        onChange={(value: boolean) =>
          setNotifyClient((settings.notifyClient = value))
        }
      />
      <LunaTextSetting
        title="Client Host"
        desc="Desired websocket host to notify of load"
        value={clientHost}
        onChange={(host: string) => setClientHost((settings.apiHost = host))}
      />
      <LunaNumberSetting
        title="Client Port"
        desc="Desired websocket port to notify of load"
        value={clientPort}
        min={1}
        max={65535}
        onNumber={(num: number) => setClientPort((settings.clientPort = num))}
      />
    </LunaSettings>
  );
};
