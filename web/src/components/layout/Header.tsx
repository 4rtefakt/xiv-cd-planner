export function Header() {
  return (
    <header className="header">
      <div className="logo">
        <div className="logo-diamond" />
        COOLDOWN<span className="slash">//</span>PLANNER
      </div>
      <div className="header-right">
        <button className="header-btn" type="button">+ NEW</button>
        <button className="header-btn" type="button">+ IMPORT PARTY</button>
        <div className="header-tag">S9.NET</div>
        <div className="header-tag">V0.1</div>
      </div>
    </header>
  );
}
