/* @ds-bundle: {"format":4,"namespace":"AIBVFDesignSystem_ab2d84","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"KpiCard","sourcePath":"components/core/KpiCard.jsx"},{"name":"Label","sourcePath":"components/core/Label.jsx"},{"name":"Mirror","sourcePath":"components/core/Mirror.jsx"},{"name":"PillarMeter","sourcePath":"components/core/PillarMeter.jsx"},{"name":"VerdictBadge","sourcePath":"components/core/VerdictBadge.jsx"},{"name":"GateBadge","sourcePath":"components/feedback/GateBadge.jsx"},{"name":"Scorecard","sourcePath":"components/feedback/Scorecard.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"}],"sourceHashes":{"components/core/Button.jsx":"e4fceb99e90c","components/core/Card.jsx":"42c00b8e789c","components/core/KpiCard.jsx":"4070719c781c","components/core/Label.jsx":"56315b2c6aca","components/core/Mirror.jsx":"569c8832947a","components/core/PillarMeter.jsx":"c0fb526f0a42","components/core/VerdictBadge.jsx":"3867fcfbf8cc","components/feedback/GateBadge.jsx":"509c34b050bb","components/feedback/Scorecard.jsx":"81987e34a63c","components/forms/Input.jsx":"e713564aef59","components/forms/Select.jsx":"07d959c448a1","ui_kits/bvf-app/AdvisorBrain.jsx":"ba99fb6de575","ui_kits/bvf-app/AppHeader.jsx":"ac678758a33d","ui_kits/bvf-app/PortfolioDashboard.jsx":"97f2cfccfa94","ui_kits/bvf-app/ScoreWorkspace.jsx":"0ccd24f92ddc","ui_kits/protocol/ProtocolPage.jsx":"812f1478d16e"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.AIBVFDesignSystem_ab2d84 = window.AIBVFDesignSystem_ab2d84 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * AI BVF primary action button. Copper fill for the one primary action per view;
 * ghost for secondary. Uppercase, wide-tracked, restrained radius.
 */
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  style,
  children,
  ...rest
}) {
  const base = {
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    borderRadius: 'var(--radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition: 'background var(--dur) var(--ease), box-shadow var(--dur) var(--ease), color var(--dur) var(--ease), transform var(--dur-fast) var(--ease)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.5 : 1
  };
  const sizes = {
    sm: {
      padding: '8px 18px',
      fontSize: '11px'
    },
    md: {
      padding: '12px 24px',
      fontSize: '12px'
    },
    lg: {
      padding: '15px 34px',
      fontSize: '13px'
    }
  };
  const variants = {
    primary: {
      background: 'var(--copper)',
      color: 'var(--on-accent)',
      boxShadow: 'var(--shadow-accent)'
    },
    ghost: {
      background: 'var(--fill-1)',
      borderColor: 'var(--line-strong)',
      color: 'var(--text-body)'
    },
    outline: {
      background: 'transparent',
      borderColor: 'var(--copper-line)',
      color: 'var(--copper-300)'
    }
  };
  const [hover, setHover] = React.useState(false);
  const hoverStyle = !disabled && hover ? {
    primary: {
      background: 'var(--copper-300)',
      boxShadow: '0 6px 22px rgba(184,115,51,0.30)'
    },
    ghost: {
      borderColor: 'var(--copper-line)',
      color: 'var(--copper-300)',
      background: 'var(--fill-2)'
    },
    outline: {
      background: 'var(--copper-wash)',
      color: 'var(--copper-200)'
    }
  }[variant] : {};
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      ...base,
      ...sizes[size],
      ...variants[variant],
      ...hoverStyle,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Surface container on the navy canvas. `elevated` adds shadow; `accent` adds
 * a copper left rule (the "mirror"/callout treatment).
 */
function Card({
  elevated = false,
  accent = false,
  padding,
  style,
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-card)',
      borderRadius: accent ? '0 var(--radius-lg) var(--radius-lg) 0' : 'var(--radius-lg)',
      borderLeft: accent ? '3px solid var(--copper)' : undefined,
      padding: padding || '26px 30px',
      boxShadow: elevated ? 'var(--shadow-md)' : 'var(--shadow-sm)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/KpiCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Executive KPI tile — big Playfair value, uppercase label, optional sub note.
 * `tone` recolours the value to a RAG signal.
 */
function KpiCard({
  label,
  value,
  sub,
  tone = 'accent',
  style,
  ...rest
}) {
  const tones = {
    accent: 'var(--copper-300)',
    accelerate: 'var(--accelerate-bright)',
    fix: 'var(--fix-bright)',
    stop: 'var(--stop-bright)',
    neutral: 'var(--ice)'
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: 'var(--surface-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-lg)',
      padding: '22px 24px',
      boxShadow: 'var(--shadow-sm)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '10px',
      fontWeight: 600,
      letterSpacing: '1.6px',
      textTransform: 'uppercase',
      color: 'var(--text-muted)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '32px',
      lineHeight: 1.05,
      color: tones[tone] || tones.accent,
      marginTop: '10px'
    }
  }, value), sub && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      color: 'var(--text-body)',
      marginTop: '8px',
      lineHeight: 1.5
    }
  }, sub));
}
Object.assign(__ds_scope, { KpiCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/KpiCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Label.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The copper micro-label / eyebrow used above headings across every surface.
 */
function Label({
  children,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-block',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-label)',
      letterSpacing: 'var(--ls-label)',
      textTransform: 'uppercase',
      fontWeight: 600,
      color: 'var(--copper-300)',
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Label });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Label.jsx", error: String((e && e.message) || e) }); }

// components/core/Mirror.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * "The Mirror" — the brand's signature copper-ruled quote block. Serif
 * (upright) body with an attribution line.
 */
function Mirror({
  quote,
  attribution,
  style,
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      padding: '24px 28px',
      background: 'var(--copper-wash-2)',
      border: '1px solid var(--copper-line-2)',
      borderLeft: '3px solid var(--copper)',
      borderRadius: '0 var(--radius-lg) var(--radius-lg) 0',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("blockquote", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontStyle: 'normal',
      fontSize: '19px',
      lineHeight: 1.6,
      color: 'var(--ice)'
    }
  }, quote || children), attribution && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '12px',
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      color: 'var(--text-muted)'
    }
  }, attribution));
}
Object.assign(__ds_scope, { Mirror });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Mirror.jsx", error: String((e && e.message) || e) }); }

// components/core/PillarMeter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Four-pillar score meter (0–100). Fill colour follows the value against the
 * framework thresholds unless `tone` is forced.
 */
function PillarMeter({
  label,
  score = 0,
  threshold,
  tone,
  style,
  ...rest
}) {
  const v = Math.max(0, Math.min(100, Number(score) || 0));
  const auto = v >= 60 ? 'accelerate' : v >= 40 ? 'fix' : 'stop';
  const t = tone || auto;
  const colors = {
    accelerate: 'var(--accelerate)',
    fix: 'var(--fix)',
    stop: 'var(--stop)',
    accent: 'var(--copper)'
  };
  const c = colors[t] || colors.accent;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--font-sans)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: '7px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '12px',
      color: 'var(--text-body)',
      fontWeight: 500
    }
  }, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      fontWeight: 600,
      color: c
    }
  }, v)), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '7px',
      borderRadius: '999px',
      background: 'var(--fill-2)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      width: `${v}%`,
      background: c,
      borderRadius: '999px',
      transition: 'width var(--dur-slow) var(--ease)'
    }
  }), typeof threshold === 'number' && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '-2px',
      bottom: '-2px',
      left: `${threshold}%`,
      width: '1.5px',
      background: 'var(--line-strong)'
    }
  })));
}
Object.assign(__ds_scope, { PillarMeter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/PillarMeter.jsx", error: String((e && e.message) || e) }); }

// components/core/VerdictBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * The framework's core signal. Renders Accelerate / Fix / Stop (or a custom
 * verdict) as a RAG chip. `size="lg"` gives the standalone readout treatment.
 */
function VerdictBadge({
  verdict = 'Fix',
  size = 'md',
  style,
  children,
  ...rest
}) {
  const key = String(verdict).toLowerCase();
  const map = {
    accelerate: {
      color: 'var(--accelerate-bright)',
      border: 'var(--accelerate-line)',
      bg: 'var(--accelerate-wash)'
    },
    fix: {
      color: 'var(--fix-bright)',
      border: 'var(--fix-line)',
      bg: 'var(--fix-wash)'
    },
    stop: {
      color: 'var(--stop-bright)',
      border: 'var(--stop-line)',
      bg: 'var(--stop-wash)'
    }
  };
  const c = map[key] || map.fix;
  const sizes = {
    sm: {
      padding: '4px 10px',
      fontSize: '9px',
      letterSpacing: '1px',
      borderRadius: 'var(--radius-xs)'
    },
    md: {
      padding: '5px 12px',
      fontSize: '10px',
      letterSpacing: '1px',
      borderRadius: 'var(--radius-xs)'
    },
    lg: {
      padding: '9px 18px',
      fontSize: '13px',
      letterSpacing: '1.5px',
      borderRadius: 'var(--radius-sm)'
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '7px',
      fontFamily: 'var(--font-sans)',
      fontWeight: 700,
      textTransform: 'uppercase',
      border: '1px solid',
      color: c.color,
      borderColor: c.border,
      background: c.bg,
      ...sizes[size],
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: size === 'lg' ? '8px' : '6px',
      height: size === 'lg' ? '8px' : '6px',
      borderRadius: '50%',
      background: c.color,
      boxShadow: `0 0 6px ${c.color}`
    }
  }), children || verdict);
}
Object.assign(__ds_scope, { VerdictBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/VerdictBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/GateBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * GateBadge — the PASS / FAIL stamp emitted by the CI pre-flight gate.
 * Bold, monospace, verdict-coloured. The signature "gate result" mark.
 */
function GateBadge({
  status = 'pass',
  size = 'md',
  style,
  ...rest
}) {
  const pass = String(status).toLowerCase() === 'pass';
  const c = pass ? {
    fg: 'var(--accelerate-bright)',
    line: 'var(--accelerate-line)',
    bg: 'var(--accelerate-wash)'
  } : {
    fg: 'var(--stop-bright)',
    line: 'var(--stop-line)',
    bg: 'var(--stop-wash)'
  };
  const sizes = {
    sm: {
      padding: '4px 10px',
      fontSize: '11px',
      gap: '6px',
      dot: '7px'
    },
    md: {
      padding: '7px 16px',
      fontSize: '14px',
      gap: '9px',
      dot: '9px'
    },
    lg: {
      padding: '11px 22px',
      fontSize: '18px',
      gap: '11px',
      dot: '11px'
    }
  };
  const s = sizes[size] || sizes.md;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: s.gap,
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      letterSpacing: '1.5px',
      textTransform: 'uppercase',
      color: c.fg,
      background: c.bg,
      border: `1px solid ${c.line}`,
      borderRadius: 'var(--radius-sm)',
      padding: s.padding,
      fontSize: s.fontSize,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: s.dot,
      height: s.dot,
      borderRadius: '2px',
      background: c.fg,
      boxShadow: `0 0 8px ${c.fg}`
    }
  }), pass ? 'PASS' : 'FAIL');
}
Object.assign(__ds_scope, { GateBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/GateBadge.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Scorecard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Scorecard — the CI pre-flight gate output ("SonarQube for AI"). A branded
 * aibvf-check report: overall gate result + per-initiative check rows with
 * verdict, score, and pass/fail against the configured threshold.
 *
 * checks: [{ name, verdict: 'Accelerate'|'Fix'|'Stop', score, pass }]
 */
function Scorecard({
  command = 'aibvf-check ./portfolio.bvf.json',
  threshold = 'min-verdict=Fix · max-governance-risk=60',
  checks = [],
  footer = "What you don't gate, you don't govern.",
  style,
  ...rest
}) {
  const failed = checks.filter(c => !c.pass).length;
  const gate = failed === 0 ? 'pass' : 'fail';
  const pass = gate === 'pass';
  const vColor = v => ({
    accelerate: 'var(--accelerate-bright)',
    fix: 'var(--fix-bright)',
    stop: 'var(--stop-bright)'
  })[String(v).toLowerCase()] || 'var(--text-body)';
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      fontFamily: 'var(--font-mono)',
      background: 'var(--surface-panel)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)',
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '12px 16px',
      borderBottom: '1px solid var(--line)',
      background: 'var(--fill-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: '6px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: '11px',
      height: '11px',
      borderRadius: '50%',
      background: 'var(--stop-bright)',
      opacity: 0.5
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: '11px',
      height: '11px',
      borderRadius: '50%',
      background: 'var(--fix-bright)',
      opacity: 0.5
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      width: '11px',
      height: '11px',
      borderRadius: '50%',
      background: 'var(--accelerate-bright)',
      opacity: 0.5
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '12px',
      color: 'var(--text-muted)',
      marginLeft: '4px'
    }
  }, "ci \xB7 pre-flight gate")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 20px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '13px',
      color: 'var(--text)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--copper-300)'
    }
  }, "$"), " ", command), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '14px',
      marginTop: '16px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-muted)',
      letterSpacing: '1px',
      textTransform: 'uppercase'
    }
  }, "Quality gate"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-dim)',
      marginTop: '4px'
    }
  }, threshold)), /*#__PURE__*/React.createElement(__ds_scope.GateBadge, {
    status: gate,
    size: "lg"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      borderTop: '1px solid var(--line)'
    }
  }, checks.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'grid',
      gridTemplateColumns: '20px 1fr auto auto',
      gap: '12px',
      alignItems: 'center',
      padding: '12px 20px',
      borderBottom: i < checks.length - 1 ? '1px solid var(--line-soft)' : 'none',
      background: c.pass ? 'transparent' : 'var(--stop-wash)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: c.pass ? 'var(--accelerate-bright)' : 'var(--stop-bright)',
      fontWeight: 700
    }
  }, c.pass ? '✓' : '✕'), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '14px',
      color: 'var(--ice)',
      fontWeight: 500
    }
  }, c.name), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: vColor(c.verdict),
      letterSpacing: '0.5px',
      textTransform: 'uppercase'
    }
  }, c.verdict), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: 'var(--text-body)',
      minWidth: '34px',
      textAlign: 'right'
    }
  }, c.score)))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 20px',
      borderTop: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      flexWrap: 'wrap',
      background: 'var(--fill-1)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontStyle: 'normal',
      fontSize: '14px',
      color: 'var(--copper-300)'
    }
  }, footer), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '12px',
      color: pass ? 'var(--accelerate-bright)' : 'var(--stop-bright)'
    }
  }, pass ? 'exit 0 · build continues' : `exit 1 · ${failed} initiative${failed > 1 ? 's' : ''} blocked`)));
}
Object.assign(__ds_scope, { Scorecard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Scorecard.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Text input on the navy canvas. Optional label + hint. Copper focus ring.
 */
function Input({
  label,
  hint,
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: inputId,
    style: {
      display: 'block',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: 'var(--copper-300)',
      marginBottom: '7px'
    }
  }, label), /*#__PURE__*/React.createElement("input", _extends({
    id: inputId,
    onFocus: e => {
      setFocus(true);
      rest.onFocus && rest.onFocus(e);
    },
    onBlur: e => {
      setFocus(false);
      rest.onBlur && rest.onBlur(e);
    },
    style: {
      width: '100%',
      background: focus ? 'var(--fill-3)' : 'var(--fill-2)',
      border: `1px solid ${focus ? 'var(--border-focus)' : 'var(--line-strong)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 14px',
      color: 'var(--ice)',
      fontSize: '14px',
      fontFamily: 'var(--font-sans)',
      outline: 'none',
      boxShadow: focus ? 'var(--ring-accent)' : 'none',
      transition: 'all var(--dur) var(--ease)',
      ...style
    }
  }, rest)), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '11px',
      color: 'var(--text-muted)',
      marginTop: '6px'
    }
  }, hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Select on the navy canvas. Options passed as an array of {value,label} or
 * strings. Copper focus ring, custom copper chevron.
 */
function Select({
  label,
  options = [],
  id,
  style,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const selId = id || (label ? `sel-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);
  const norm = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)'
    }
  }, label && /*#__PURE__*/React.createElement("label", {
    htmlFor: selId,
    style: {
      display: 'block',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: 'var(--copper-300)',
      marginBottom: '7px'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: selId,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      width: '100%',
      appearance: 'none',
      WebkitAppearance: 'none',
      background: focus ? 'var(--fill-3)' : 'var(--fill-2)',
      border: `1px solid ${focus ? 'var(--border-focus)' : 'var(--line-strong)'}`,
      borderRadius: 'var(--radius-md)',
      padding: '12px 38px 12px 14px',
      color: 'var(--ice)',
      fontSize: '14px',
      fontFamily: 'var(--font-sans)',
      outline: 'none',
      cursor: 'pointer',
      boxShadow: focus ? 'var(--ring-accent)' : 'none',
      transition: 'all var(--dur) var(--ease)',
      ...style
    }
  }, rest), norm.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value,
    style: {
      background: 'var(--navy-800)',
      color: '#fff'
    }
  }, o.label))), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      right: '14px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
      color: 'var(--copper-300)',
      fontSize: '11px'
    }
  }, "\u25BE")));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bvf-app/AdvisorBrain.jsx
try { (() => {
/* AI BVF — Advisor Brain. diagnose_process: heaviness → intervention →
   net EUR saving. UI-kit screen. */
function AdvisorBrain() {
  const NS = window.AIBVFDesignSystem_ab2d84;
  const {
    Label,
    Card,
    KpiCard,
    Button,
    VerdictBadge,
    PillarMeter,
    Mirror
  } = NS;
  const signals = [{
    k: 'Volume',
    v: '42k / mo',
    w: 78
  }, {
    k: 'Labour',
    v: '11 FTE',
    w: 64
  }, {
    k: 'Cycle time',
    v: '6.2 days',
    w: 71
  }, {
    k: 'Handoffs',
    v: '9',
    w: 82
  }, {
    k: 'Rework',
    v: '18%',
    w: 60
  }, {
    k: 'Automation',
    v: '12%',
    w: 24
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1120px',
      margin: '0 auto',
      padding: '40px 32px 80px'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Advisor Brain \xB7 diagnose_process"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '10px 0 6px',
      fontSize: '30px'
    }
  }, "Invoice matching & exceptions"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-body)',
      maxWidth: '620px',
      fontSize: '15px'
    }
  }, "Diagnose one business process from observed signals. The Brain returns heaviness, the right intervention, and a net EUR saving with a verdict."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      marginTop: '28px',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement(Label, null, "Observed signals"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      marginTop: '16px'
    }
  }, signals.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.k,
    style: {
      display: 'grid',
      gridTemplateColumns: '110px 1fr 70px',
      gap: '12px',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: 'var(--text-body)'
    }
  }, s.k), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '6px',
      borderRadius: '999px',
      background: 'var(--fill-2)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${s.w}%`,
      height: '100%',
      background: 'var(--copper)',
      borderRadius: '999px'
    }
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--ice)',
      textAlign: 'right'
    }
  }, s.v)))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '22px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Diagnose process"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    accent: true,
    elevated: true,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Verdict"), /*#__PURE__*/React.createElement(VerdictBadge, {
    verdict: "Fix",
    size: "lg"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "Process heaviness",
    value: "Heavy",
    tone: "fix",
    style: {
      padding: '16px 18px'
    }
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Net EUR saving",
    value: "\u20AC1.9M",
    tone: "accent",
    style: {
      padding: '16px 18px'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Recommended intervention"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-body)',
      fontSize: '14px',
      marginTop: '8px',
      lineHeight: 1.6
    }
  }, "Nine handoffs and 18% rework mark this as agent-suitable orchestration, not headcount. Deploy a gen2 exception-handling agent behind a human approval gate; efficiency gain modelled at 41%."))), /*#__PURE__*/React.createElement(Mirror, {
    quote: "Automate the exceptions, not the whole desk. The saving is in the handoffs.",
    attribution: "\u2014 AI BVF Advisor Brain"
  }))));
}
window.AdvisorBrain = AdvisorBrain;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bvf-app/AdvisorBrain.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bvf-app/AppHeader.jsx
try { (() => {
/* AI BVF app — sticky header with brand mark + tab nav. UI-kit screen. */
function AppHeader({
  tab,
  setTab
}) {
  const {
    Button
  } = window.AIBVFDesignSystem_ab2d84;
  const tabs = ['Score', 'Portfolio', 'Advisor'];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 'var(--header-h)',
      padding: '0 32px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      background: 'rgba(15,30,53,0.92)',
      backdropFilter: 'blur(20px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '28px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '38px',
      height: '38px',
      border: '1.5px solid #B87333',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '13px',
      color: '#D9A672',
      background: 'rgba(184,115,51,0.12)'
    }
  }, "BVF"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '16px',
      color: '#FFFFFF'
    }
  }, "AI BVF"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '9px',
      letterSpacing: '2.4px',
      color: '#E0B482',
      fontWeight: 700,
      textTransform: 'uppercase',
      marginTop: '2px'
    }
  }, "Business Value Framework"))), /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      gap: '4px'
    }
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    onClick: () => setTab(t),
    style: {
      padding: '9px 16px',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '1.4px',
      textTransform: 'uppercase',
      color: tab === t ? '#E0B482' : 'rgba(255,255,255,0.82)',
      borderBottom: `2px solid ${tab === t ? '#B87333' : 'transparent'}`,
      transition: 'color var(--dur) var(--ease)'
    }
  }, t)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '12px',
      color: 'rgba(255,255,255,0.78)'
    }
  }, "Craig Horton"), /*#__PURE__*/React.createElement("div", {
    style: {
      width: '30px',
      height: '30px',
      borderRadius: '50%',
      background: 'rgba(184,115,51,0.16)',
      border: '1px solid rgba(184,115,51,0.34)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontWeight: 700,
      color: '#D9A672'
    }
  }, "CH")));
}
window.AppHeader = AppHeader;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bvf-app/AppHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bvf-app/PortfolioDashboard.jsx
try { (() => {
/* AI BVF — Portfolio board readout. Aggregates score_portfolio into the
   board-level shape: counts, aggregate EUR, top + highest-risk initiative.
   UI-kit screen. */
function PortfolioDashboard() {
  const NS = window.AIBVFDesignSystem_ab2d84;
  const {
    Label,
    Card,
    KpiCard,
    VerdictBadge,
    PillarMeter,
    Button
  } = NS;
  const rows = [{
    name: 'CX copilot rollout',
    fn: 'CX',
    tier: 'gen3',
    v: 'Accelerate',
    val: '€12.4M',
    conf: 72,
    gr: 34
  }, {
    name: 'Claims triage automation',
    fn: 'Operations',
    tier: 'gen2',
    v: 'Fix',
    val: '€8.1M',
    conf: 54,
    gr: 48
  }, {
    name: 'Autonomous procurement agent',
    fn: 'Finance',
    tier: 'gen3',
    v: 'Stop',
    val: '€0.0M',
    conf: 38,
    gr: 74
  }, {
    name: 'HR onboarding assistant',
    fn: 'HR',
    tier: 'gen2',
    v: 'Accelerate',
    val: '€4.6M',
    conf: 66,
    gr: 30
  }, {
    name: 'Demand forecast rebuild',
    fn: 'Operations',
    tier: 'gen2',
    v: 'Fix',
    val: '€6.9M',
    conf: 58,
    gr: 41
  }, {
    name: 'Contact-centre voice bot',
    fn: 'CX',
    tier: 'gen3',
    v: 'Stop',
    val: '€0.0M',
    conf: 44,
    gr: 71
  }];
  const tone = v => v.toLowerCase();
  const th = {
    textAlign: 'left',
    padding: '13px 14px',
    fontSize: '10px',
    letterSpacing: '1.4px',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    fontWeight: 600,
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap'
  };
  const td = {
    padding: '15px 14px',
    fontSize: '14px',
    color: 'var(--text)',
    borderBottom: '1px solid var(--line-soft)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1120px',
      margin: '0 auto',
      padding: '40px 32px 80px'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Board readout \xB7 score_portfolio"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      gap: '20px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '10px 0 0',
      fontSize: '30px'
    }
  }, "Q3 AI investment portfolio"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "sm"
  }, "Export executive readout")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '14px',
      marginTop: '26px'
    }
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "Net value at stake",
    value: "\u20AC32.0M",
    sub: "Aggregate across 6",
    tone: "accent"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Accelerate / Fix / Stop",
    value: "2 \xB7 2 \xB7 2",
    sub: "Portfolio split",
    tone: "neutral"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Mean confidence",
    value: "55",
    sub: "Board-level",
    tone: "fix"
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Highest risk",
    value: "GR 74",
    sub: "Procurement agent",
    tone: "stop"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.7fr 1fr',
      gap: '20px',
      marginTop: '20px',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    padding: "8px 8px 4px"
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse'
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Initiative"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Function"), /*#__PURE__*/React.createElement("th", {
    style: th
  }, "Verdict"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      textAlign: 'right'
    }
  }, "Net value"), /*#__PURE__*/React.createElement("th", {
    style: {
      ...th,
      textAlign: 'right'
    }
  }, "Conf."))), /*#__PURE__*/React.createElement("tbody", null, rows.map(r => /*#__PURE__*/React.createElement("tr", {
    key: r.name
  }, /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 500,
      color: 'var(--ice)'
    }
  }, r.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-muted)',
      marginTop: '2px'
    }
  }, r.tier)), /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      color: 'var(--text-body)'
    }
  }, r.fn), /*#__PURE__*/React.createElement("td", {
    style: td
  }, /*#__PURE__*/React.createElement(VerdictBadge, {
    verdict: r.v,
    size: "sm"
  })), /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      textAlign: 'right',
      fontFamily: 'var(--font-mono)',
      color: 'var(--copper-300)'
    }
  }, r.val), /*#__PURE__*/React.createElement("td", {
    style: {
      ...td,
      textAlign: 'right',
      fontFamily: 'var(--font-mono)'
    }
  }, r.conf)))))), /*#__PURE__*/React.createElement(Card, {
    accent: true,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Top initiative by value"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      color: 'var(--ice)',
      fontSize: '18px',
      marginTop: '8px'
    }
  }, "CX copilot rollout"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      color: 'var(--copper-300)',
      fontSize: '20px',
      marginTop: '4px'
    }
  }, "\u20AC12.4M")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      paddingTop: '4px',
      borderTop: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Aggregate pillar health"), /*#__PURE__*/React.createElement(PillarMeter, {
    label: "Strategic Alignment",
    score: 68
  }), /*#__PURE__*/React.createElement(PillarMeter, {
    label: "Financial Return",
    score: 52
  }), /*#__PURE__*/React.createElement(PillarMeter, {
    label: "Change Enablement",
    score: 49
  }), /*#__PURE__*/React.createElement(PillarMeter, {
    label: "Governance Risk",
    score: 50,
    tone: "fix"
  })))));
}
window.PortfolioDashboard = PortfolioDashboard;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bvf-app/PortfolioDashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/bvf-app/ScoreWorkspace.jsx
try { (() => {
/* AI BVF — Score workspace. Enter the four pillars, get a live verdict.
   Recreates the score_initiative surface. UI-kit screen. */
function ScoreWorkspace() {
  const NS = window.AIBVFDesignSystem_ab2d84;
  const {
    Label,
    Card,
    Button,
    Select,
    Input,
    PillarMeter,
    VerdictBadge,
    KpiCard,
    Mirror
  } = NS;
  const {
    useState
  } = React;
  const [scores, setScores] = useState({
    sa: 70,
    fr: 50,
    ce: 55,
    gr: 45
  });
  const set = k => e => setScores(s => ({
    ...s,
    [k]: Number(e.target.value)
  }));

  // Deterministic framework rules
  const {
    sa,
    fr,
    ce,
    gr
  } = scores;
  let verdict = 'Fix';
  if (gr >= 70 || fr <= 20) verdict = 'Stop';else if (sa >= 60 && fr >= 60 && ce >= 60 && gr <= 40) verdict = 'Accelerate';
  const confidence = Math.round((sa + fr + ce + (100 - gr)) / 4);
  const low = (fr / 100 * 24).toFixed(1);
  const high = (fr / 100 * 84).toFixed(1);
  const pillars = [{
    k: 'sa',
    label: 'Strategic Alignment',
    v: sa
  }, {
    k: 'fr',
    label: 'Financial Return',
    v: fr
  }, {
    k: 'ce',
    label: 'Change Enablement',
    v: ce
  }, {
    k: 'gr',
    label: 'Governance Risk',
    v: gr,
    invert: true
  }];
  const reasons = {
    Accelerate: 'All four pillars clear the bar and governance exposure is contained. This survives a board review.',
    Fix: 'Strategic alignment is credible, but change enablement and financial return are not yet strong enough to defend an Accelerate call.',
    Stop: 'Governance exposure or financial return falls below the deterministic floor. Do not commit budget as scoped.'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: '1120px',
      margin: '0 auto',
      padding: '40px 32px 80px'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Pre-flight check \xB7 score_initiative"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: '10px 0 6px',
      fontSize: '30px'
    }
  }, "Score an AI initiative"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-body)',
      maxWidth: '620px',
      fontSize: '15px'
    }
  }, "Four pillars, 0\u2013100, honest self-assessment. The engine returns a deterministic verdict with a modelled EUR range and a specific gap list."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1.1fr 1fr',
      gap: '20px',
      marginTop: '28px',
      alignItems: 'start'
    }
  }, /*#__PURE__*/React.createElement(Card, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      marginBottom: '22px'
    }
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Industry",
    options: ['retail', 'healthcare', 'financial services', 'manufacturing']
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Function",
    options: ['cx', 'operations', 'finance', 'hr']
  }), /*#__PURE__*/React.createElement(Select, {
    label: "AI tier",
    options: [{
      value: 'gen2',
      label: 'Gen 2 · Assistive'
    }, {
      value: 'gen3',
      label: 'Gen 3 · Agentic'
    }]
  }), /*#__PURE__*/React.createElement(Select, {
    label: "Readiness",
    options: ['traditional', 'emerging', 'optimised']
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px'
    }
  }, pillars.map(p => /*#__PURE__*/React.createElement("div", {
    key: p.k
  }, /*#__PURE__*/React.createElement(PillarMeter, {
    label: p.label,
    score: p.v,
    tone: p.invert ? p.v >= 70 ? 'stop' : p.v >= 40 ? 'fix' : 'accelerate' : undefined
  }), /*#__PURE__*/React.createElement("input", {
    type: "range",
    min: "0",
    max: "100",
    value: p.v,
    onChange: set(p.k),
    style: {
      width: '100%',
      marginTop: '8px',
      accentColor: 'var(--copper)'
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '24px',
      display: 'flex',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary"
  }, "Score initiative"), /*#__PURE__*/React.createElement(Button, {
    variant: "ghost"
  }, "Reset"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement(Card, {
    accent: true,
    elevated: true,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Classification"), /*#__PURE__*/React.createElement(VerdictBadge, {
    verdict: verdict,
    size: "lg"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement(KpiCard, {
    label: "Net value range",
    value: `€${low}–${high}M`,
    tone: "accent",
    style: {
      padding: '16px 18px'
    }
  }), /*#__PURE__*/React.createElement(KpiCard, {
    label: "Decision confidence",
    value: confidence,
    tone: "neutral",
    style: {
      padding: '16px 18px'
    }
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Label, null, "Why"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-body)',
      fontSize: '14px',
      marginTop: '8px',
      lineHeight: 1.6
    }
  }, reasons[verdict])), /*#__PURE__*/React.createElement("div", {
    style: {
      paddingTop: '4px',
      borderTop: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "Applied modules"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginTop: '10px'
    }
  }, ['four_pillar_base', 'readiness_capture_traditional', 'retail_cx_benchmark'].map(m => /*#__PURE__*/React.createElement("span", {
    key: m,
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--copper-300)',
      padding: '4px 10px',
      background: 'var(--copper-wash-2)',
      border: '1px solid var(--copper-line-2)',
      borderRadius: 'var(--radius-xs)'
    }
  }, m))))), /*#__PURE__*/React.createElement(Mirror, {
    quote: verdict === 'Accelerate' ? 'Fund it, name the owner, and hold the line on governance.' : 'Raise Change Enablement by 15, name an accountable owner, fund adoption, then rerun.',
    attribution: "\u2014 recommend_improvements"
  }))));
}
window.ScoreWorkspace = ScoreWorkspace;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/bvf-app/ScoreWorkspace.jsx", error: String((e && e.message) || e) }); }

// ui_kits/protocol/ProtocolPage.jsx
try { (() => {
/* AI BVF — Protocol / landing page. Theme-aware (light + dark via
   data-theme on <html>). Composes design-system primitives. UI-kit screen. */
const NS = window.AIBVFDesignSystem_ab2d84;
function ThemeToggle() {
  const [dark, setDark] = React.useState(true);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => setDark(d => !d),
    "aria-label": "Toggle theme",
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 14px',
      borderRadius: 'var(--radius-sm)',
      cursor: 'pointer',
      background: 'var(--fill-1)',
      border: '1px solid var(--line-strong)',
      color: 'var(--text-body)',
      fontFamily: 'var(--font-sans)',
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '0.5px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: '9px',
      height: '9px',
      borderRadius: '50%',
      background: 'var(--copper)'
    }
  }), dark ? 'Dark' : 'Light');
}
function Nav() {
  const {
    Button
  } = NS;
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 44px',
      borderBottom: '1px solid var(--line)',
      background: 'color-mix(in srgb, var(--bg-app) 82%, transparent)',
      backdropFilter: 'blur(20px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: '36px',
      height: '36px',
      border: '2px solid var(--copper)',
      borderRadius: 'var(--radius-md)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '12px',
      color: 'var(--copper)'
    }
  }, "BVF"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      fontSize: '15px',
      color: 'var(--ice)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--copper)'
    }
  }, "AI"), " BVF")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '26px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '24px'
    },
    className: "nav-links"
  }, ['Protocol', 'MCP Tools', 'CI Gate', 'Install'].map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: '#' + l.toLowerCase().replace(' ', '-'),
    style: {
      color: 'var(--text-body)',
      textDecoration: 'none',
      fontSize: '13px',
      fontWeight: 500
    }
  }, l))), /*#__PURE__*/React.createElement(ThemeToggle, null), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm"
  }, "GitHub")));
}
function Hero() {
  const {
    Button,
    VerdictBadge
  } = NS;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      textAlign: 'center',
      padding: '92px 32px 60px',
      background: 'radial-gradient(ellipse at 50% 22%, var(--copper-wash) 0%, transparent 58%)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '12px',
      color: 'var(--copper-300)',
      fontSize: '12px',
      letterSpacing: '4px',
      textTransform: 'uppercase',
      fontWeight: 600,
      marginBottom: '22px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: '30px',
      height: '1px',
      background: 'var(--copper)'
    }
  }), "The pre-flight check for agentic AI", /*#__PURE__*/React.createElement("span", {
    style: {
      width: '30px',
      height: '1px',
      background: 'var(--copper)'
    }
  })), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: 'clamp(34px,4.6vw,54px)',
      color: 'var(--ice)',
      lineHeight: 1.12,
      maxWidth: '840px',
      margin: '0 auto 24px',
      letterSpacing: '-0.01em'
    }
  }, "Stop bad AI projects before", /*#__PURE__*/React.createElement("br", null), "agents ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--copper-300)'
    }
  }, "recommend them.")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: '18px',
      color: 'var(--text-body)',
      maxWidth: '640px',
      margin: '0 auto 36px',
      lineHeight: 1.7
    }
  }, "The scoring tool your Claude agent calls before it recommends an AI deployment. It checks the business case, operating-model readiness, change enablement and governance exposure \u2014 then returns Accelerate, Fix, or Stop with a modelled EUR value."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '14px',
      justifyContent: 'center',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg"
  }, "npx aibvf-mcp"), /*#__PURE__*/React.createElement(Button, {
    variant: "outline",
    size: "lg"
  }, "Read the protocol")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'center',
      marginTop: '30px',
      flexWrap: 'wrap'
    }
  }, ['Deterministic', 'Open', 'On-prem', 'MIT'].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '12px',
      color: 'var(--text-muted)',
      padding: '5px 12px',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-pill)'
    }
  }, t))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '10px',
      justifyContent: 'center',
      marginTop: '28px'
    }
  }, /*#__PURE__*/React.createElement(VerdictBadge, {
    verdict: "Accelerate"
  }), /*#__PURE__*/React.createElement(VerdictBadge, {
    verdict: "Fix"
  }), /*#__PURE__*/React.createElement(VerdictBadge, {
    verdict: "Stop"
  })));
}
function WhatItDoes() {
  const {
    Label,
    Mirror
  } = NS;
  const pillars = [['Strategic Alignment', 'How clearly this moves a board-level KPI.'], ['Financial Return', 'Strength of the modelled return.'], ['Change Enablement', 'Sponsor in place, owner named, change budget funded.'], ['Governance Risk', 'Regulatory and reputational exposure. Higher is worse.']];
  return /*#__PURE__*/React.createElement("section", {
    style: {
      maxWidth: '980px',
      margin: '0 auto',
      padding: '48px 32px 40px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: '40px'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "What it does"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '30px',
      color: 'var(--ice)',
      marginTop: '12px'
    }
  }, "Four pillars, one deterministic call"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-body)',
      maxWidth: '600px',
      margin: '12px auto 0',
      fontSize: '16px',
      lineHeight: 1.7
    }
  }, "Every initiative is scored 0\u2013100 on four pillars, honest self-assessment. Rules are deterministic \u2014 no network, no dependencies.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: '14px'
    }
  }, pillars.map(([t, d], i) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      gap: '16px',
      padding: '20px 22px',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-lg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '22px',
      color: 'var(--copper-300)',
      lineHeight: 1
    }
  }, String(i + 1).padStart(2, '0')), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontWeight: 600,
      fontSize: '15px',
      color: 'var(--ice)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: '14px',
      color: 'var(--text-body)',
      marginTop: '5px',
      lineHeight: 1.55
    }
  }, d))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: '20px'
    }
  }, /*#__PURE__*/React.createElement(Mirror, {
    quote: "GR \u2265 70 or FR \u2264 20 returns Stop. All four pillars at or above 60 with GR \u2264 40 returns Accelerate. Everything else is Fix \u2014 with a specific gap list.",
    attribution: "\u2014 The deterministic rule set"
  })));
}
function Tools() {
  const {
    Label
  } = NS;
  const tools = [['score_initiative', 'Four-pillar score → Accelerate / Fix / Stop with EUR value range, decision confidence, applied modules, reasoning.'], ['score_portfolio', 'Scores every initiative in one call. Returns the board-level shape: verdict counts, aggregate EUR, mean confidence.'], ['recommend_improvements', 'For Stop or Fix, the specific pillar raises that would flip the call toward Accelerate.'], ['calculate_pace_layer_drag', 'Annual Organisational Drag Cost in EUR from AI-tier vs operating-model misalignment.'], ['validate_portfolio', 'Validates a portfolio JSON document against the BVF v1.0 schema.'], ['get_benchmark', 'Published benchmark rates for a business function and industry.'], ['list_taxonomy', 'Valid values for industries, functions, AI tiers, readiness levels.'], ['diagnose_process', 'Advisor Brain: diagnoses one process from observed signals → verdict + net EUR saving.']];
  return /*#__PURE__*/React.createElement("section", {
    id: "mcp-tools",
    style: {
      maxWidth: '980px',
      margin: '0 auto',
      padding: '40px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: '40px'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "MCP Server \xB7 8 tools"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '30px',
      color: 'var(--ice)',
      marginTop: '12px'
    }
  }, "Callable from any agent")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2,1fr)',
      gap: '12px'
    }
  }, tools.map(([name, desc]) => /*#__PURE__*/React.createElement("div", {
    key: name,
    style: {
      padding: '18px 20px',
      background: 'var(--surface-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-lg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      color: 'var(--copper-300)',
      fontWeight: 600
    }
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-sans)',
      fontSize: '13px',
      color: 'var(--text-body)',
      marginTop: '8px',
      lineHeight: 1.55
    }
  }, desc)))));
}
function CiGate() {
  const {
    Label,
    Scorecard
  } = NS;
  return /*#__PURE__*/React.createElement("section", {
    id: "ci-gate",
    style: {
      maxWidth: '900px',
      margin: '0 auto',
      padding: '44px 32px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: '36px'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "CI/CD pre-flight gate \xB7 aibvf-check"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '30px',
      color: 'var(--ice)',
      marginTop: '12px'
    }
  }, "SonarQube for AI"), /*#__PURE__*/React.createElement("p", {
    style: {
      color: 'var(--text-body)',
      maxWidth: '560px',
      margin: '12px auto 0',
      fontSize: '16px',
      lineHeight: 1.7
    }
  }, "Wire the gate into CI. Initiatives that can't survive a board review fail the build \u2014 before the budget is committed.")), /*#__PURE__*/React.createElement(Scorecard, {
    checks: [{
      name: 'CX copilot rollout',
      verdict: 'Accelerate',
      score: 72,
      pass: true
    }, {
      name: 'HR onboarding assistant',
      verdict: 'Accelerate',
      score: 66,
      pass: true
    }, {
      name: 'Claims triage automation',
      verdict: 'Fix',
      score: 54,
      pass: true
    }, {
      name: 'Autonomous procurement agent',
      verdict: 'Stop',
      score: 38,
      pass: false
    }, {
      name: 'Contact-centre voice bot',
      verdict: 'Stop',
      score: 44,
      pass: false
    }]
  }));
}
function Install() {
  const {
    Label
  } = NS;
  const line = (prompt, cmd) => /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: '12px',
      padding: '12px 18px',
      fontFamily: 'var(--font-mono)',
      fontSize: '14px',
      borderBottom: '1px solid var(--line-soft)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--copper-300)'
    }
  }, prompt), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text)'
    }
  }, cmd));
  return /*#__PURE__*/React.createElement("section", {
    id: "install",
    style: {
      maxWidth: '760px',
      margin: '0 auto',
      padding: '40px 32px 88px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      marginBottom: '32px'
    }
  }, /*#__PURE__*/React.createElement(Label, null, "30-second install"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '30px',
      color: 'var(--ice)',
      marginTop: '12px'
    }
  }, "Run it directly")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-panel)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
      boxShadow: 'var(--shadow-md)'
    }
  }, line('$', 'npx -y aibvf-mcp'), line('$', 'npm install -g aibvf-mcp'), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 18px',
      fontFamily: 'var(--font-mono)',
      fontSize: '13px',
      color: 'var(--text-muted)'
    }
  }, '{ "mcpServers": { "aibvf": { "command": "aibvf-mcp" } } }')), /*#__PURE__*/React.createElement("p", {
    style: {
      textAlign: 'center',
      color: 'var(--text-muted)',
      fontSize: '14px',
      marginTop: '20px'
    }
  }, "Register with Claude Desktop, Claude Code, or any MCP client. Deterministic \xB7 open \xB7 on-prem \xB7 MIT."));
}
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      borderTop: '1px solid var(--line)',
      padding: '30px 44px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: '15px',
      color: 'var(--copper-300)'
    }
  }, "What you don't gate, you don't govern."), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: '13px',
      color: 'var(--text-dim)'
    }
  }, "AI BVF \xB7 Craig Horton \xB7 Amsterdam"));
}
function ProtocolPage() {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement(Hero, null), /*#__PURE__*/React.createElement(WhatItDoes, null), /*#__PURE__*/React.createElement(Tools, null), /*#__PURE__*/React.createElement(CiGate, null), /*#__PURE__*/React.createElement(Install, null), /*#__PURE__*/React.createElement(Footer, null));
}
window.ProtocolPage = ProtocolPage;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/protocol/ProtocolPage.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.KpiCard = __ds_scope.KpiCard;

__ds_ns.Label = __ds_scope.Label;

__ds_ns.Mirror = __ds_scope.Mirror;

__ds_ns.PillarMeter = __ds_scope.PillarMeter;

__ds_ns.VerdictBadge = __ds_scope.VerdictBadge;

__ds_ns.GateBadge = __ds_scope.GateBadge;

__ds_ns.Scorecard = __ds_scope.Scorecard;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

})();
