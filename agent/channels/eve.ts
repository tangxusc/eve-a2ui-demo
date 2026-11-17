import { localDev, none } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

// Public demo: anyone with the URL can talk to the agent. Swap `none()` for an
// app session check before this holds anything private.
export default eveChannel({
  auth: [localDev(), none()],
});
