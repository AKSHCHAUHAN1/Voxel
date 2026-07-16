const apiBaseUrl = import.meta.env.VITE_VOXEL_API_URL ?? '';

export const runtime = Object.freeze({ apiBaseUrl: apiBaseUrl.replace(/\/$/, '') });
