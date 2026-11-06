import { createContext } from 'react';

// Standalone previews keep their avatars. Inside the app only the owner may
// render one, including React portals and lazy transition/fallback content.
export const CompaiAvatarContext = createContext(true);
