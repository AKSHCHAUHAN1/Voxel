import { useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';

const getWsUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  return apiUrl.replace(/^http/, 'ws') + '/api/v1/realtime';
};

const getAuthToken = () => {
  // Simple way to get the voxel_access cookie for WebSocket auth
  const match = document.cookie.match(/(?:^|;)\s*voxel_access=([^;]+)/);
  return match ? match[1] : '';
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
      token: getAuthToken(),
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
