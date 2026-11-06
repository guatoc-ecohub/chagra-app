import { useContext } from 'react';
import { CompaiAvatarContext } from './CompaiAvatarContext.js';

/** Native scene rigs obey the same owner as DOM avatars. */
export default function CompaiScenePresence({ children }) {
  return useContext(CompaiAvatarContext) ? children : null;
}
