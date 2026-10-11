import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { runtime } from '@/config/runtime';

const getWsUrl = () => {
  const apiUrl = runtime.apiBaseUrl || window.location.origin;
  return apiUrl.replace(/^http/, 'ws') + '/api/v1/realtime';
};

const getRealtimeToken = async (dashboardId) => {
  const apiUrl = runtime.apiBaseUrl;
  const response = await fetch(`${apiUrl}/api/v1/dashboards/${encodeURIComponent(dashboardId)}/realtime-token`, {
    method: 'POST',
    credentials: 'include',
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.error?.message || 'Realtime access could not be verified.');
  }
  return payload.data.token;
};

export function useYjs(dashboardId, initialScene) {
  const [scene, setScene] = useState(initialScene);
  const [awareness, setAwareness] = useState(null);
  const [awarenessStates, setAwarenessStates] = useState([]);
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    if (!dashboardId) return;

    const doc = new Y.Doc();
    const hpProvider = new HocuspocusProvider({
      url: getWsUrl(),
      name: dashboardId,
      document: doc,
      token: () => getRealtimeToken(dashboardId),
    });

    const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padEnd(6, '0');
    hpProvider.awareness.setLocalStateField('user', {
      name: 'User ' + Math.floor(Math.random() * 1000),
      color,
    });

    setProvider(hpProvider);
    setAwareness(hpProvider.awareness);

    const yScene = doc.getMap('scene');

    const updateLocalState = () => {
      setScene(yScene.toJSON());
    };

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
    handleAwarenessChange(); // initial state

    return () => {
      hpProvider.awareness.off('change', handleAwarenessChange);
      hpProvider.destroy();
      doc.destroy();
    };
  }, [dashboardId]);

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
    [provider]
  );

  return { scene, updateScene, awareness, awarenessStates };
}
