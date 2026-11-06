import { useState } from 'react';
import AgentOfflineGuard from './AgentOfflineGuard';

// Keep an opened conversation mounted when connectivity changes. A first
// offline visit shows connection guidance until the visitor is online.
export default function AgentConnectionBoundary({ online, onBack, children }) {
  const [openedOnline, setOpenedOnline] = useState(online);
  if (online && !openedOnline) setOpenedOnline(true);
  if (!online && !openedOnline) return <AgentOfflineGuard onBack={onBack} />;
  return children;
}
