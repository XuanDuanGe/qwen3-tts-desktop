function TitleBar() {
  return (
    <header className="flex h-9 shrink-0 select-none items-center gap-2 border-b border-border bg-canvas px-3">
      <div
        aria-hidden="true"
        className="h-4 w-4 shrink-0 rounded-ui border border-primary bg-primary-muted"
      />
      <span className="truncate text-xs font-medium text-text">Echo Float</span>
    </header>
  );
}

export default TitleBar;
