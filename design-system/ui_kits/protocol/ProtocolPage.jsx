/* AI BVF — Protocol / landing page. Theme-aware (light + dark via
   data-theme on <html>). Composes design-system primitives. UI-kit screen. */
const NS = window.AIBVFDesignSystem_ab2d84;

function ThemeToggle() {
  const [dark, setDark] = React.useState(true);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return (
    <button onClick={() => setDark(d => !d)} aria-label="Toggle theme" style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '8px 14px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
      background: 'var(--fill-1)', border: '1px solid var(--line-strong)',
      color: 'var(--text-body)', fontFamily: 'var(--font-sans)', fontSize: '12px',
      fontWeight: 600, letterSpacing: '0.5px',
    }}>
      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: 'var(--copper)' }} />
      {dark ? 'Dark' : 'Light'}
    </button>
  );
}

function Nav() {
  const { Button } = NS;
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 30,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '18px 44px', borderBottom: '1px solid var(--line)',
      background: 'color-mix(in srgb, var(--bg-app) 82%, transparent)', backdropFilter: 'blur(20px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '36px', height: '36px', border: '2px solid var(--copper)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '12px', color: 'var(--copper)' }}>BVF</div>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px', color: 'var(--ice)' }}><span style={{ color: 'var(--copper)' }}>AI</span> BVF</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '26px' }}>
        <div style={{ display: 'flex', gap: '24px' }} className="nav-links">
          {['Protocol', 'MCP Tools', 'CI Gate', 'Install'].map(l => (
            <a key={l} href={'#' + l.toLowerCase().replace(' ', '-')} style={{ color: 'var(--text-body)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>{l}</a>
          ))}
        </div>
        <ThemeToggle />
        <Button variant="primary" size="sm">GitHub</Button>
      </div>
    </nav>
  );
}

function Hero() {
  const { Button, VerdictBadge } = NS;
  return (
    <section style={{ textAlign: 'center', padding: '92px 32px 60px', background: 'radial-gradient(ellipse at 50% 22%, var(--copper-wash) 0%, transparent 58%)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', color: 'var(--copper-300)', fontSize: '12px', letterSpacing: '4px', textTransform: 'uppercase', fontWeight: 600, marginBottom: '22px' }}>
        <span style={{ width: '30px', height: '1px', background: 'var(--copper)' }} />
        The pre-flight check for agentic AI
        <span style={{ width: '30px', height: '1px', background: 'var(--copper)' }} />
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(34px,4.6vw,54px)', color: 'var(--ice)', lineHeight: 1.12, maxWidth: '840px', margin: '0 auto 24px', letterSpacing: '-0.01em' }}>
        Stop bad AI projects before<br />agents <span style={{ color: 'var(--copper-300)' }}>recommend them.</span>
      </h1>
      <p style={{ fontSize: '18px', color: 'var(--text-body)', maxWidth: '640px', margin: '0 auto 36px', lineHeight: 1.7 }}>
        The scoring tool your Claude agent calls before it recommends an AI deployment. It checks the business case, operating-model readiness, change enablement and governance exposure — then returns Accelerate, Fix, or Stop with a modelled EUR value.
      </p>
      <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button variant="primary" size="lg">npx aibvf-mcp</Button>
        <Button variant="outline" size="lg">Read the protocol</Button>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '30px', flexWrap: 'wrap' }}>
        {['Deterministic', 'Open', 'On-prem', 'MIT'].map(t => (
          <span key={t} style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', padding: '5px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-pill)' }}>{t}</span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '28px' }}>
        <VerdictBadge verdict="Accelerate" />
        <VerdictBadge verdict="Fix" />
        <VerdictBadge verdict="Stop" />
      </div>
    </section>
  );
}

function WhatItDoes() {
  const { Label, Mirror } = NS;
  const pillars = [
    ['Strategic Alignment', 'How clearly this moves a board-level KPI.'],
    ['Financial Return', 'Strength of the modelled return.'],
    ['Change Enablement', 'Sponsor in place, owner named, change budget funded.'],
    ['Governance Risk', 'Regulatory and reputational exposure. Higher is worse.'],
  ];
  return (
    <section style={{ maxWidth: '980px', margin: '0 auto', padding: '48px 32px 40px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <Label>What it does</Label>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--ice)', marginTop: '12px' }}>Four pillars, one deterministic call</h2>
        <p style={{ color: 'var(--text-body)', maxWidth: '600px', margin: '12px auto 0', fontSize: '16px', lineHeight: 1.7 }}>
          Every initiative is scored 0–100 on four pillars, honest self-assessment. Rules are deterministic — no network, no dependencies.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '14px' }}>
        {pillars.map(([t, d], i) => (
          <div key={t} style={{ display: 'flex', gap: '16px', padding: '20px 22px', background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '22px', color: 'var(--copper-300)', lineHeight: 1 }}>{String(i + 1).padStart(2, '0')}</span>
            <div>
              <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '15px', color: 'var(--ice)' }}>{t}</div>
              <div style={{ fontSize: '14px', color: 'var(--text-body)', marginTop: '5px', lineHeight: 1.55 }}>{d}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '20px' }}>
        <Mirror quote="GR ≥ 70 or FR ≤ 20 returns Stop. All four pillars at or above 60 with GR ≤ 40 returns Accelerate. Everything else is Fix — with a specific gap list." attribution="— The deterministic rule set" />
      </div>
    </section>
  );
}

function Tools() {
  const { Label } = NS;
  const tools = [
    ['score_initiative', 'Four-pillar score → Accelerate / Fix / Stop with EUR value range, decision confidence, applied modules, reasoning.'],
    ['score_portfolio', 'Scores every initiative in one call. Returns the board-level shape: verdict counts, aggregate EUR, mean confidence.'],
    ['recommend_improvements', 'For Stop or Fix, the specific pillar raises that would flip the call toward Accelerate.'],
    ['calculate_pace_layer_drag', 'Annual Organisational Drag Cost in EUR from AI-tier vs operating-model misalignment.'],
    ['validate_portfolio', 'Validates a portfolio JSON document against the BVF v1.0 schema.'],
    ['get_benchmark', 'Published benchmark rates for a business function and industry.'],
    ['list_taxonomy', 'Valid values for industries, functions, AI tiers, readiness levels.'],
    ['diagnose_process', 'Advisor Brain: diagnoses one process from observed signals → verdict + net EUR saving.'],
  ];
  return (
    <section id="mcp-tools" style={{ maxWidth: '980px', margin: '0 auto', padding: '40px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <Label>MCP Server · 12 tools</Label>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--ice)', marginTop: '12px' }}>Callable from any agent</h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '12px' }}>
        {tools.map(([name, desc]) => (
          <div key={name} style={{ padding: '18px 20px', background: 'var(--surface-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--copper-300)', fontWeight: 600 }}>{name}</div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--text-body)', marginTop: '8px', lineHeight: 1.55 }}>{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CiGate() {
  const { Label, Scorecard } = NS;
  return (
    <section id="ci-gate" style={{ maxWidth: '900px', margin: '0 auto', padding: '44px 32px' }}>
      <div style={{ textAlign: 'center', marginBottom: '36px' }}>
        <Label>CI/CD pre-flight gate · aibvf-check</Label>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--ice)', marginTop: '12px' }}>SonarQube for AI</h2>
        <p style={{ color: 'var(--text-body)', maxWidth: '560px', margin: '12px auto 0', fontSize: '16px', lineHeight: 1.7 }}>
          Wire the gate into CI. Initiatives that can't survive a board review fail the build — before the budget is committed.
        </p>
      </div>
      <Scorecard
        checks={[
          { name: 'CX copilot rollout', verdict: 'Accelerate', score: 72, pass: true },
          { name: 'HR onboarding assistant', verdict: 'Accelerate', score: 66, pass: true },
          { name: 'Claims triage automation', verdict: 'Fix', score: 54, pass: true },
          { name: 'Autonomous procurement agent', verdict: 'Stop', score: 38, pass: false },
          { name: 'Contact-centre voice bot', verdict: 'Stop', score: 44, pass: false },
        ]}
      />
    </section>
  );
}

function Install() {
  const { Label } = NS;
  const line = (prompt, cmd) => (
    <div style={{ display: 'flex', gap: '12px', padding: '12px 18px', fontFamily: 'var(--font-mono)', fontSize: '14px', borderBottom: '1px solid var(--line-soft)' }}>
      <span style={{ color: 'var(--copper-300)' }}>{prompt}</span>
      <span style={{ color: 'var(--text)' }}>{cmd}</span>
    </div>
  );
  return (
    <section id="install" style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 32px 88px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <Label>30-second install</Label>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '30px', color: 'var(--ice)', marginTop: '12px' }}>Run it directly</h2>
      </div>
      <div style={{ background: 'var(--surface-panel)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)' }}>
        {line('$', 'npx -y aibvf-mcp')}
        {line('$', 'npm install -g aibvf-mcp')}
        <div style={{ padding: '14px 18px', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-muted)' }}>
          {'{ "mcpServers": { "aibvf": { "command": "aibvf-mcp" } } }'}
        </div>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px', marginTop: '20px' }}>
        Register with Claude Desktop, Claude Code, or any MCP client. Deterministic · open · on-prem · MIT.
      </p>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', padding: '30px 44px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '15px', color: 'var(--copper-300)' }}>What you don't gate, you don't govern.</span>
      <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>AI BVF · Craig Horton · Amsterdam</span>
    </footer>
  );
}

function ProtocolPage() {
  return (
    <React.Fragment>
      <Nav /><Hero /><WhatItDoes /><Tools /><CiGate /><Install /><Footer />
    </React.Fragment>
  );
}
window.ProtocolPage = ProtocolPage;
