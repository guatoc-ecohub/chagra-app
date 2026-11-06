import { useEffect, useState } from 'react';
import { getActiveTenantId } from '../../services/tenantContext';

function readDraft(key) {
  try { return sessionStorage.getItem(key) || ''; }
  catch { return ''; }
}

// Only the unsent text belongs here. Asset and Log state use their own stores.
export default function useChatDraft(initialDraft = '', operatorId = 'default-operator') {
  const key = `chagra:agent-draft:v1:${getActiveTenantId() || operatorId}`;
  const [draft, setDraft] = useState(() => {
    if (initialDraft !== '') return initialDraft;
    return readDraft(key);
  });
  const [draftKey, setDraftKey] = useState(key);
  if (draftKey !== key) {
    setDraftKey(key);
    setDraft(readDraft(key));
  }
  useEffect(() => {
    try {
      if (draft === '') sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, draft);
    } catch { /* The editable field remains available without storage. */ }
  }, [draft, key]);
  return /** @type {const} */ ([draft, setDraft]);
}
