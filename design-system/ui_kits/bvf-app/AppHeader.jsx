/* AI BVF app — sticky header with brand mark + tab nav. UI-kit screen. */
function AppHeader({ tab, setTab }) {
  const { Button } = window.AIBVFDesignSystem_ab2d84;
  const tabs = ['Score', 'Portfolio', 'Advisor'];
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      height: 'var(--header-h)', padding: '0 32px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(15,30,53,0.92)', backdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px', height: '38px', border: '1.5px solid #B87333',
            borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700,
            fontSize: '13px', color: '#D9A672', background: 'rgba(184,115,51,0.12)',
          }}>BVF</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '16px', color: '#FFFFFF' }}>AI BVF</div>
            <div style={{ fontSize: '9px', letterSpacing: '2.4px', color: '#E0B482', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>Business Value Framework</div>
          </div>
        </div>
        <nav style={{ display: 'flex', gap: '4px' }}>
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '9px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '12px', fontWeight: 600,
              letterSpacing: '1.4px', textTransform: 'uppercase',
              color: tab === t ? '#E0B482' : 'rgba(255,255,255,0.82)',
              borderBottom: `2px solid ${tab === t ? '#B87333' : 'transparent'}`,
              transition: 'color var(--dur) var(--ease)',
            }}>{t}</button>
          ))}
        </nav>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.78)' }}>Craig Horton</span>
        <div style={{
          width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(184,115,51,0.16)',
          border: '1px solid rgba(184,115,51,0.34)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#D9A672',
        }}>CH</div>
      </div>
    </header>
  );
}
window.AppHeader = AppHeader;
