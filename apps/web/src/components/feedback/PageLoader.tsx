export function PageLoader() {
  return (
    <div
      role="status"
      aria-label="Loading Voxel"
      className="grid min-h-screen place-items-center bg-slate-950"
    >
      <span className="size-9 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
    </div>
  );
}
