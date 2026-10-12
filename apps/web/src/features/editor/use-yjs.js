import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { runtime } from '@/config/runtime';

const getWsUrl = () => {
  const apiUrl = runtime.apiBaseUrl || window.location.origin;
  return apiUrl.replace(/^http/, 'ws') + '/api/v1/realtime';
};

const getRealtimeSession = async (dashboardId) => {
  const apiUrl = runtime.apiBaseUrl;
  const response = await fetch(
    `${apiUrl}/api/v1/dashboards/${encodeURIComponent(dashboardId)}/realtime-token`,
    {
      method: 'POST',
      credentials: 'include',
    },
  );
  const payload = await response.json();
  if (
    !response.ok ||
    !payload.success ||
    typeof payload.data?.token !== 'string' ||
    !payload.data.user
  ) {
    throw new Error(payload.error?.message || 'Realtime access could not be verified.');
  }
  return payload.data;
};

const presenceColors = ['#6d28d9', '#1d4ed8', '#0f766e', '#b45309', '#be123c', '#475569'];

function getPresenceUser(user) {
  const id = typeof user?.id === 'string' ? user.id : '';
  const hash = Array.from(id).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    7,
  );
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';

  return {
    id: id || undefined,
    name: displayName || 'Voxel member',
    avatarUrl: typeof user?.avatarUrl === 'string' ? user.avatarUrl : null,
    color: presenceColors[hash % presenceColors.length],
  };
}

export function useYjs(dashboardId, initialScene, currentUser) {
  const [scene, setScene] = useState(initialScene);
  const [awareness, setAwareness] = useState(null);
  const [awarenessStates, setAwarenessStates] = useState([]);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    if (!dashboardId) return;

    let cancelled = false;
    const doc = new Y.Doc();
    const yScene = doc.getMap('scene');
    let hpProvider;
    hpProvider = new HocuspocusProvider({
      url: getWsUrl(),
      name: dashboardId,
      document: doc,
      token: async () => {
        const session = await getRealtimeSession(dashboardId);
        if (!cancelled) {
          hpProvider.awareness.setLocalStateField('user', getPresenceUser(session.user));
        }
        return session.token;
      },
    });
    hpProvider.awareness.setLocalStateField('user', getPresenceUser(currentUser));
    setProvider(hpProvider);
    setAwareness(hpProvider.awareness);

    const updateLocalState = () => setScene(yScene.toJSON());
    yScene.observeDeep(updateLocalState);

    hpProvider.on('synced', () => {
      if (Array.from(yScene.keys()).length === 0 && initialScene) {
        doc.transact(() => {
          for (const [key, value] of Object.entries(initialScene)) {
            yScene.set(key, value);
          }
        });
      } else {
        updateLocalState();
      }
    });

    const handleAwarenessChange = () => {
      setAwarenessStates(Array.from(hpProvider.awareness.getStates().entries()));
    };

    hpProvider.awareness.on('change', handleAwarenessChange);
    handleAwarenessChange();

    return () => {
      cancelled = true;
      hpProvider.awareness.off('change', handleAwarenessChange);
      hpProvider.destroy();
      setProvider(null);
      setAwareness(null);
      setAwarenessStates([]);
      doc.destroy();
    };
  }, [dashboardId]);

  useEffect(() => {
    if (awareness && currentUser) {
      awareness.setLocalStateField('user', getPresenceUser(currentUser));
    }
  }, [awareness, currentUser]);

  const updateScene = useCallback(
    (nextScene) => {
      if (provider && provider.document) {
        try {
          const yScene = provider.document.getMap('scene');
          provider.document.transact(() => {
            for (const [key, value] of Object.entries(nextScene)) {
              yScene.set(key, value);
            }
          });
        } catch (_err) {
          // ignore
        }
      }
      // Always update local state immediately so UI and grid controls function
      setScene(nextScene);
    },
    [provider],
  );

  return { scene, updateScene, awareness, awarenessStates };
}
