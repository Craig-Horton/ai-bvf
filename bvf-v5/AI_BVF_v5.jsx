import { useState, useMemo } from "react";

const C = {
  navy:"#0D1F3C",navy2:"#162D4E",navy3:"#1C3A62",
  copper:"#B87333",copperL:"#D4956A",
  ice:"#E8EEF5",muted:"#6B7E9A",slate:"#9BAEC8",white:"#FFFFFF",
  green:"#2E7D52",greenL:"#4CAF80",amber:"#C07A1A",amberL:"#F5A623",
  red:"#8B2020",redL:"#E05252",purple:"#5B21B6",purpleL:"#8B5CF6",
};

const INDUSTRIES=[
  {id:"universal",label:"Universal / Other"},
  {id:"healthcare",label:"Healthcare / MedTech"},
  {id:"manufacturing",label:"Manufacturing & Supply Chain"},
  {id:"financial",label:"Financial Services"},
  {id:"retail",label:"Retail / Consumer"},
  {id:"technology",label:"Technology"},
];
const FUNCTIONS=[
  {id:"finance",label:"Finance & CFO",icon:"◈"},
  {id:"hr",label:"HR & Workforce",icon:"◎"},
  {id:"sales",label:"Sales & Revenue",icon:"◆"},
  {id:"supply",label:"Supply Chain",icon:"⬡"},
  {id:"cx",label:"Customer Experience",icon:"◉"},
  {id:"risk",label:"Risk & Compliance",icon:"◪"},
  {id:"it",label:"IT & Platform",icon:"◫"},
  {id:"rd",label:"R&D / Innovation",icon:"◬"},
];
const LAYERS=[
  {id:"board",label:"Board KPIs",note:"NORTH ↑"},
  {id:"external",label:"External Pressures",note:"↓"},
  {id:"initiatives",label:"Business Initiatives",note:"↓"},
  {id:"operating",label:"Operating KPIs",note:"↓"},
  {id:"ai",label:"AI Capabilities",note:"SOUTH ↓"},
];
const HORIZONS=["Now (0–90 days)","Next (90–180 days)","Later (180+ days)"];
const RISK_LEVELS=["Low","Medium","High"];
const RISK_COLORS={Low:C.greenL,Medium:C.amberL,High:C.redL};

// R3: Agentic tiers
const AI_TIERS=[
  {id:"gen1",label:"Gen 1 — Automation",short:"Gen 1",color:C.slate,desc:"RPA, rule-based automation, workflow triggers"},
  {id:"gen2",label:"Gen 2 — GenAI",short:"Gen 2",color:C.copper,desc:"LLM-powered assistants, content generation, semantic search"},
  {id:"gen3",label:"Gen 3 — Agentic",short:"Gen 3",color:C.purpleL,desc:"Autonomous multi-step agents, decision-making, self-orchestration"},
];

const BASE_RATES={
  finance:{rev:{lo:0,hi:0},cost:{lo:.030,hi:.060},ebt:{lo:0,hi:0},drivers:["Automated financial close (–40% cycle time)","AI-powered FP&A & forecasting","Anomaly detection reducing write-offs"],source:"McKinsey Global Institute — finance automation benchmark"},
  hr:{rev:{lo:0,hi:0},cost:{lo:.020,hi:.040},ebt:{lo:0,hi:0},drivers:["Attrition reduction (–15–25% replacement cost)","GenAI HR service desk (–30% AHT)","AI-driven onboarding acceleration"],source:"Deloitte Future of Work 2024"},
  sales:{rev:{lo:.030,hi:.080},cost:{lo:0,hi:0},ebt:{lo:0,hi:0},drivers:["Hyper-personalisation at scale","Predictive lead scoring & pipeline accuracy","AI deal coaching & next-best-action"],source:"McKinsey — AI personalisation drives up to 40% revenue uplift"},
  supply:{rev:{lo:0,hi:0},cost:{lo:.040,hi:.090},ebt:{lo:.005,hi:.015},drivers:["Predictive maintenance (–10–25% unplanned downtime)","Inventory optimisation (–15% holding cost)","Quality defect AI (–20% rework)"],source:"Gartner Supply Chain AI Benchmark 2024"},
  cx:{rev:{lo:.020,hi:.050},cost:{lo:.020,hi:.050},ebt:{lo:0,hi:0},drivers:["GenAI deflection (up to 87% self-service)","AHT reduction –20–35%","Retention uplift from personalisation"],source:"Forrester CX AI Impact 2024 · ServiceNow Now on Now"},
  risk:{rev:{lo:0,hi:0},cost:{lo:.020,hi:.040},ebt:{lo:0,hi:0},drivers:["AML false-positive reduction –30–50%","Automated CSRD / EU AI Act reporting","Continuous compliance monitoring"],source:"Accenture Regulatory AI Report 2024"},
  it:{rev:{lo:0,hi:0},cost:{lo:.030,hi:.070},ebt:{lo:0,hi:0},drivers:["MTTR reduction –20–40%","Incident volume reduction via AIOps","GenAI ITSM deflection & auto-resolution"],source:"ServiceNow Platform Value Report 2024"},
  rd:{rev:{lo:.010,hi:.040},cost:{lo:0,hi:0},ebt:{lo:0,hi:0},drivers:["Compressed time-to-market (–20–35% dev cycle)","AI-assisted design & simulation","Literature synthesis & IP analysis"],source:"BCG — AI in R&D: The Next Frontier 2024"},
};
const IND_MULT={
  universal:{finance:1,hr:1,sales:1,supply:1,cx:1,risk:1,it:1,rd:1},
  healthcare:{finance:1.1,hr:1.1,sales:1.0,supply:0.8,cx:1.1,risk:1.4,it:1.0,rd:1.5},
  manufacturing:{finance:1.0,hr:1.0,sales:0.9,supply:1.4,cx:0.9,risk:1.1,it:1.3,rd:1.1},
  financial:{finance:1.4,hr:1.1,sales:1.2,supply:0.7,cx:1.3,risk:1.5,it:1.1,rd:0.8},
  retail:{finance:1.0,hr:1.0,sales:1.4,supply:1.2,cx:1.4,risk:0.9,it:1.0,rd:0.8},
  technology:{finance:1.0,hr:1.1,sales:1.2,supply:0.8,cx:1.1,risk:1.0,it:1.4,rd:1.4},
};

// R1: Regulatory data
const REG_FRAMEWORKS=[
  {id:"euai",label:"EU AI Act",color:C.redL,icon:"⚖",shortLabel:"EU AI Act",
   risk:"High Risk",timeline:"Aug 2026 — Feb 2027",
   obligations:["High-risk AI systems must register in EU database","Mandatory conformity assessments for high-risk use cases","Human oversight requirements for automated decisions","Incident reporting to national authorities within 15 days"],
   costDrivers:["Compliance audit & gap assessment","Technical documentation & logging infrastructure","Human oversight staffing","Registration & conformity process"],
   costRange:{lo:.0005,hi:.002},costBase:"revenue",
   desc:"The EU AI Act classifies AI systems by risk. High-risk categories include HR, credit scoring, critical infrastructure, and law enforcement. Full compliance mandatory by August 2026.",
   source:"EU AI Act — Regulation 2024/1689, Aug 2024"},
  {id:"dora",label:"DORA",color:C.amberL,icon:"🛡",shortLabel:"DORA",
   risk:"Financial Services",timeline:"Jan 2025",
   obligations:["ICT risk management framework with AI oversight","Third-party AI provider risk assessments","Digital operational resilience testing (TLPT)","Incident classification & reporting within 4 hours"],
   costDrivers:["ICT risk framework uplift for AI systems","Third-party provider due diligence","Resilience testing programme","Reporting infrastructure"],
   costRange:{lo:.001,hi:.003},costBase:"revenue",
   desc:"DORA applies to all financial entities in the EU including banks, insurers, investment firms, and crypto-asset service providers. AI systems must be included in ICT risk frameworks.",
   source:"DORA — Regulation 2022/2554, in force Jan 2025"},
  {id:"csrd",label:"CSRD",color:C.greenL,icon:"🌱",shortLabel:"CSRD",
   risk:"ESG Reporting",timeline:"2024–2028 phased",
   obligations:["Mandatory AI-assisted ESG data collection & reporting","Third-party verification of sustainability claims","Double materiality assessment including AI impact","Value chain emissions including AI energy consumption"],
   costDrivers:["ESG data platform & AI tooling","Third-party assurance engagement","Internal ESG reporting capability","Technology carbon footprint measurement"],
   costRange:{lo:.0003,hi:.0015},costBase:"revenue",
   desc:"CSRD requires large companies to report on environmental and social impact including AI-related energy consumption. AI can both assist reporting and must be reported on.",
   source:"CSRD — Directive 2022/2464, phased 2024–2028"},
  {id:"gdpr",label:"GDPR / AI",color:C.purpleL,icon:"🔒",shortLabel:"GDPR AI",
   risk:"Data Privacy",timeline:"Ongoing",
   obligations:["Automated decision-making rights (Art. 22) for AI","Data minimisation requirements in model training","Privacy impact assessments for AI use cases","Right to explanation for AI-driven decisions"],
   costDrivers:["Privacy-by-design AI development uplift","Data governance & lineage tooling","DPO capacity for AI assessments","Explainability layer development"],
   costRange:{lo:.0002,hi:.001},costBase:"revenue",
   desc:"GDPR's Article 22 restricts solely automated decisions with legal effects. AI deployments in HR, credit, and customer service face the highest exposure.",
   source:"GDPR Art. 22 — as applied to AI systems, EDPB Guidelines 2023"},
];

const BVF_DATA={
  finance:{board:{c:"Operating Income · Free Cash Flow · Revenue Growth"},external:{c:"Inflation · FX volatility · Interest rate cycles · Tariffs"},initiatives:{c:"Finance transformation · Cost reduction · Capital reallocation"},operating:{c:"Close cycle time · Forecast accuracy · Cost-to-finance ratio"},ai:{c:"Predictive forecasting · Automated close · GenAI FP&A · Anomaly detection"}},
  hr:{board:{c:"Talent retention · Workforce productivity · Cost-per-hire"},external:{c:"Skills shortage · Hybrid work complexity · Generational shifts"},initiatives:{c:"Workforce transformation · Upskilling · Culture change"},operating:{c:"Time-to-hire · Employee NPS · Attrition rate · Training completion"},ai:{c:"GenAI HR service desk · Skills intelligence · Predictive attrition · Onboarding automation"}},
  sales:{board:{c:"Revenue growth · New market entry · Customer lifetime value"},external:{c:"Consumer pricing sensitivity · Private label rise · Market saturation"},initiatives:{c:"New market expansion · Account growth · Sales productivity"},operating:{c:"Win rate · Pipeline velocity · Average deal size · Forecast accuracy"},ai:{c:"Predictive lead scoring · AI deal coaching · Revenue intelligence · Dynamic pricing"}},
  supply:{board:{c:"Inventory efficiency · Supplier risk · Margin protection"},external:{c:"Geopolitics · Tariffs · Climate disruption · PPWR / ESPR"},initiatives:{c:"Supply chain digitalisation · Nearshoring · ESG traceability"},operating:{c:"OEE · On-time delivery · Inventory turns · Defect rate · Yield"},ai:{c:"Demand sensing · Predictive maintenance · ESG traceability · Quality inspection AI"}},
  cx:{board:{c:"Customer retention · NPS · Revenue from existing customers"},external:{c:"Shifting expectations · Digital-native competition · Channel proliferation"},initiatives:{c:"CX transformation · Omnichannel · Personalisation at scale"},operating:{c:"CSAT · First Contact Resolution · AHT · Self-service deflection rate"},ai:{c:"GenAI service agents · Sentiment analysis · Personalisation engines · Proactive outreach"}},
  risk:{board:{c:"Risk-adjusted margin · Regulatory fines avoidance · Audit confidence"},external:{c:"EU AI Act · DORA · CSRD · AML/sanctions · ESPR"},initiatives:{c:"Regulatory transformation · Fraud reduction · ESG reporting · Model risk"},operating:{c:"False positive rate · Audit cycle time · Compliance coverage · Fraud loss ratio"},ai:{c:"Regulatory AI · AML/fraud detection · ESG reporting automation · Model risk governance"}},
  it:{board:{c:"IT cost ratio · Platform resilience · Technology debt reduction"},external:{c:"Vendor consolidation · Cybersecurity escalation · Cloud cost pressure"},initiatives:{c:"Platform consolidation · Technical debt · IT modernisation"},operating:{c:"MTTR · Incident volume · Platform health score · Deflection rate"},ai:{c:"AIOps · Predictive incident management · GenAI ITSM · Automated remediation"}},
  rd:{board:{c:"Innovation pipeline · Time-to-market · IP value creation"},external:{c:"Competitor innovation pace · Patent landscape · Regulatory timelines"},initiatives:{c:"Product innovation · Clinical development · R&D efficiency"},operating:{c:"Time-to-prototype · R&D cost-per-outcome · Trial success rate"},ai:{c:"Generative design · Literature synthesis · Simulation acceleration · IP analysis"}},
};

const fmt=(n)=>{if(!n||n===0)return"—";if(n>=1e9)return`€${(n/1e9).toFixed(1)}B`;if(n>=1e6)return`€${(n/1e6).toFixed(1)}M`;if(n>=1e3)return`€${(n/1e3).toFixed(0)}K`;return`€${n.toFixed(0)}`;};
const parseNum=(v)=>{if(!v)return 0;const s=String(v).replace(/[€,\s]/g,"").toUpperCase();if(s.endsWith("B"))return parseFloat(s)*1e9;if(s.endsWith("M"))return parseFloat(s)*1e6;if(s.endsWith("K"))return parseFloat(s)*1e3;return parseFloat(s)||0;};
const pct=(a,b)=>b>0?((a/b)*100).toFixed(1)+"%":"—";
const RAG=(cm,tot)=>{if(!tot)return null;const p=cm/tot;return p>=.10?"green":p>=.05?"amber":"red";};
const RAG_CFG={green:{label:"COMPLIANT",bg:"rgba(46,125,82,0.2)",border:C.greenL,text:C.greenL,desc:"≥ 10% allocated — meets Prosci minimum"},amber:{label:"AT RISK",bg:"rgba(192,122,26,0.2)",border:C.amberL,text:C.amberL,desc:"5–10% allocated — below Prosci minimum"},red:{label:"CRITICAL GAP",bg:"rgba(139,32,32,0.2)",border:C.redL,text:C.redL,desc:"< 5% allocated — high risk of value loss"}};

function effectiveRates(industry,overrides){
  const mult=IND_MULT[industry]||IND_MULT.universal;
  const result={};
  FUNCTIONS.forEach(fn=>{
    const base=BASE_RATES[fn.id];const m=mult[fn.id]||1;const ov=overrides[fn.id]||{};
    result[fn.id]={rev:{lo:ov.revLo!==undefined?ov.revLo/100:base.rev.lo*m,hi:ov.revHi!==undefined?ov.revHi/100:base.rev.hi*m},cost:{lo:ov.costLo!==undefined?ov.costLo/100:base.cost.lo*m,hi:ov.costHi!==undefined?ov.costHi/100:base.cost.hi*m},ebt:{lo:ov.ebtLo!==undefined?ov.ebtLo/100:base.ebt.lo*m,hi:ov.ebtHi!==undefined?ov.ebtHi/100:base.ebt.hi*m},drivers:base.drivers,source:base.source};
  });
  return result;
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
const FL=({children,mb=6})=>(<div style={{fontSize:"9px",letterSpacing:"2.5px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:600,marginBottom:mb,textTransform:"uppercase"}}>{children}</div>);
const Inp=({value,onChange,placeholder,style={}})=>(<input type="text" value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",background:"rgba(255,255,255,0.06)",border:`1px solid rgba(184,115,51,0.3)`,borderRadius:"3px",color:C.ice,fontSize:"13px",fontFamily:"'Trebuchet MS',sans-serif",outline:"none",...style}}/>);
const Sel=({value,onChange,options})=>(<select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",boxSizing:"border-box",padding:"9px 12px",background:C.navy2,border:`1px solid rgba(184,115,51,0.3)`,borderRadius:"3px",color:C.ice,fontSize:"12px",fontFamily:"'Trebuchet MS',sans-serif",outline:"none",cursor:"pointer"}}>{options.map(o=><option key={typeof o==="string"?o:o.value} value={typeof o==="string"?o:o.value}>{typeof o==="string"?o:o.label}</option>)}</select>);
const Btn=({onClick,children,variant="primary",small,disabled})=>(<button onClick={onClick} disabled={disabled} style={{padding:small?"6px 14px":"10px 20px",background:variant==="primary"?`linear-gradient(135deg,${C.copper},${C.copperL})`:variant==="ghost"?"transparent":"rgba(255,255,255,0.06)",border:variant==="ghost"?`1px solid rgba(184,115,51,0.3)`:"none",borderRadius:"3px",color:disabled?C.muted:C.white,fontSize:small?"11px":"12px",fontFamily:"'Trebuchet MS',sans-serif",fontWeight:700,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,whiteSpace:"nowrap"}}>{children}</button>);
const Mirror=({sub})=>(<div style={{marginTop:"28px",padding:"22px 28px",background:"rgba(184,115,51,0.07)",border:`1px solid rgba(184,115,51,0.28)`,borderLeft:`4px solid ${C.copper}`,borderRadius:"3px"}}><FL>Holding Up The Mirror</FL><blockquote style={{margin:0,fontSize:"16px",fontStyle:"italic",color:C.ice,lineHeight:1.65}}>"What percentage of the ROI for this AI programme relies on people actually adopting and implementing the change?"</blockquote><div style={{marginTop:"8px",fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>{sub||"The question I ask in every C-suite conversation. The silence that follows is diagnostic. — Craig Horton"}</div></div>);

// ─── Profile Banner ───────────────────────────────────────────────────────────
function ProfileBanner({profile,setProfile,rates,overrides,setOverrides}){
  const[open,setOpen]=useState(true);const[showOv,setShowOv]=useState(false);
  const complete=profile.revenue&&profile.costBase&&profile.ebitda;
  const rev=parseNum(profile.revenue),cost=parseNum(profile.costBase),ebt=parseNum(profile.ebitda);
  return(
    <div style={{borderBottom:`1px solid rgba(184,115,51,0.2)`,background:"rgba(0,0,0,0.2)"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{width:"100%",padding:"12px 48px",background:"transparent",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"16px",flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <div style={{width:"8px",height:"8px",borderRadius:"50%",background:complete?C.greenL:C.amberL,boxShadow:complete?`0 0 6px ${C.greenL}`:`0 0 6px ${C.amberL}`}}/>
            <span style={{fontSize:"11px",fontFamily:"'Trebuchet MS',sans-serif",color:complete?C.greenL:C.amberL,fontWeight:700,letterSpacing:"1px"}}>{complete?"COMPANY PROFILE ACTIVE":"STEP 1 — ENTER COMPANY PROFILE"}</span>
          </div>
          {complete&&<div style={{display:"flex",gap:"20px",flexWrap:"wrap"}}>{[{l:"Company",v:profile.company||"—"},{l:"Industry",v:INDUSTRIES.find(i=>i.id===profile.industry)?.label||"—"},{l:"Revenue",v:fmt(rev)},{l:"Cost Base",v:fmt(cost)},{l:"EBITDA",v:fmt(ebt)}].map(s=>(<div key={s.l} style={{display:"flex",gap:"6px",alignItems:"baseline"}}><span style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1px"}}>{s.l.toUpperCase()}</span><span style={{fontSize:"12px",color:C.ice,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:600}}>{s.v}</span></div>))}</div>}
        </div>
        <span style={{color:C.copper,fontSize:"14px"}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{padding:"0 48px 24px"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"14px",marginBottom:"14px"}}>
            {[{l:"Company Name",p:"e.g. AuraLife",k:"company"},{l:"Annual Revenue",p:"e.g. 500M",k:"revenue"},{l:"Annual Cost Base",p:"e.g. 350M",k:"costBase"},{l:"Current EBITDA",p:"e.g. 75M",k:"ebitda"}].map(f=>(<div key={f.k}><FL>{f.l}</FL><Inp value={profile[f.k]||""} onChange={v=>setProfile(p=>({...p,[f.k]:v}))} placeholder={f.p}/></div>))}
            <div><FL>Industry</FL><Sel value={profile.industry||"universal"} onChange={v=>setProfile(p=>({...p,industry:v}))} options={INDUSTRIES.map(i=>({value:i.id,label:i.label}))}/></div>
          </div>
          <button onClick={()=>setShowOv(s=>!s)} style={{background:"transparent",border:`1px solid rgba(184,115,51,0.2)`,borderRadius:"3px",padding:"5px 14px",color:C.muted,fontSize:"11px",fontFamily:"'Trebuchet MS',sans-serif",cursor:"pointer"}}>{showOv?"▲ Hide":"▼ Override"} Benchmark Rates</button>
          {showOv&&(
            <div style={{marginTop:"14px",padding:"18px 22px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.15)`,borderRadius:"3px"}}>
              <FL mb={4}>Manual Rate Overrides — Leave blank to use industry benchmarks</FL>
              <div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginBottom:"14px"}}>Enter % values. Each source, year & applicability shown on the BVF tab.</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"10px"}}>
                {FUNCTIONS.map(fn=>{const eff=rates[fn.id];const ov=overrides[fn.id]||{};const hasRev=BASE_RATES[fn.id].rev.hi>0;const hasCost=BASE_RATES[fn.id].cost.hi>0;return(<div key={fn.id} style={{padding:"10px 12px",background:"rgba(0,0,0,0.2)",borderRadius:"3px",border:`1px solid rgba(184,115,51,0.1)`}}><div style={{fontSize:"11px",fontWeight:700,color:C.ice,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"6px"}}>{fn.icon} {fn.label}</div><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"6px"}}>{hasRev?`Rev ${(eff.rev.lo*100).toFixed(1)}–${(eff.rev.hi*100).toFixed(1)}%`:""}{hasRev&&hasCost?" · ":""}{hasCost?`Cost ${(eff.cost.lo*100).toFixed(1)}–${(eff.cost.hi*100).toFixed(1)}%`:""}</div><div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>{hasRev&&[{lbl:"Rev Lo%",ok:"revLo"},{lbl:"Rev Hi%",ok:"revHi"}].map(f=>(<div key={f.ok} style={{flex:1,minWidth:"70px"}}><div style={{fontSize:"9px",color:C.muted,marginBottom:"2px",fontFamily:"'Trebuchet MS',sans-serif"}}>{f.lbl}</div><Inp value={ov[f.ok]!==undefined?String(ov[f.ok]):""} placeholder="auto" style={{fontSize:"11px",padding:"4px 8px"}} onChange={v=>setOverrides(p=>({...p,[fn.id]:{...p[fn.id],[f.ok]:v===""?undefined:parseFloat(v)||0}}))}/></div>))}{hasCost&&[{lbl:"Cost Lo%",ok:"costLo"},{lbl:"Cost Hi%",ok:"costHi"}].map(f=>(<div key={f.ok} style={{flex:1,minWidth:"70px"}}><div style={{fontSize:"9px",color:C.muted,marginBottom:"2px",fontFamily:"'Trebuchet MS',sans-serif"}}>{f.lbl}</div><Inp value={ov[f.ok]!==undefined?String(ov[f.ok]):""} placeholder="auto" style={{fontSize:"11px",padding:"4px 8px"}} onChange={v=>setOverrides(p=>({...p,[fn.id]:{...p[fn.id],[f.ok]:v===""?undefined:parseFloat(v)||0}}))}/></div>))}</div></div>);})}
              </div>
              <button onClick={()=>setOverrides({})} style={{marginTop:"10px",background:"transparent",border:`1px solid rgba(224,82,82,0.3)`,borderRadius:"3px",padding:"4px 12px",color:C.redL,fontSize:"11px",fontFamily:"'Trebuchet MS',sans-serif",cursor:"pointer"}}>Reset All Overrides</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab 1: BVF ───────────────────────────────────────────────────────────────
function BVFTab({profile,rates}){
  const[activeFn,setActiveFn]=useState("finance");const[activeLayer,setActiveLayer]=useState(null);const[showSource,setShowSource]=useState(null);
  const rev=parseNum(profile.revenue),cost=parseNum(profile.costBase),ebt=parseNum(profile.ebitda);
  const complete=rev>0&&cost>0&&ebt>0;
  const scorecard=useMemo(()=>{let rL=0,rH=0,cL=0,cH=0,eL=0,eH=0;FUNCTIONS.forEach(fn=>{const r=rates[fn.id];rL+=rev*r.rev.lo;rH+=rev*r.rev.hi;cL+=cost*r.cost.lo;cH+=cost*r.cost.hi;eL+=ebt*r.ebt.lo;eH+=ebt*r.ebt.hi;});return{rL,rH,cL,cH,eL,eH,totL:cL+rL*.2+eL,totH:cH+rH*.2+eH};},[rates,rev,cost,ebt]);
  const r=rates[activeFn];
  return(
    <div>
      {complete&&(<div style={{marginBottom:"24px",padding:"18px 24px",background:"rgba(0,0,0,0.2)",border:`1px solid rgba(184,115,51,0.2)`,borderRadius:"4px"}}>
        <FL>Total AI Value Potential — {profile.company||"Your Enterprise"}</FL>
        <div style={{display:"flex",gap:"12px",flexWrap:"wrap",marginTop:"8px"}}>
          {[{l:"Revenue Uplift",lo:scorecard.rL,hi:scorecard.rH,col:C.greenL,base:rev,baseL:"revenue"},{l:"Cost Reduction",lo:scorecard.cL,hi:scorecard.cH,col:C.copperL,base:cost,baseL:"cost base"},{l:"Combined EBITDA Impact",lo:scorecard.totL,hi:scorecard.totH,col:C.copper,base:ebt,baseL:"vs current EBITDA",bold:true}].map(s=>(<div key={s.l} style={{flex:1,minWidth:"160px",padding:"12px 16px",background:s.bold?"rgba(184,115,51,0.1)":"rgba(255,255,255,0.03)",border:`1px solid ${s.bold?C.copper:"rgba(184,115,51,0.15)"}`,borderRadius:"3px"}}><div style={{fontSize:"9px",letterSpacing:"1.5px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"5px"}}>{s.l.toUpperCase()}</div><div style={{fontSize:s.bold?"20px":"17px",fontWeight:700,color:s.col,fontFamily:"'Georgia',serif"}}>{s.lo>0?`${fmt(s.lo)} – ${fmt(s.hi)}`:"—"}</div>{s.lo>0&&s.base>0&&(<div style={{fontSize:"10px",color:C.muted,marginTop:"2px",fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>{((s.lo/s.base)*100).toFixed(1)}–{((s.hi/s.base)*100).toFixed(1)}% of {fmt(s.base)} {s.baseL}</div>)}</div>))}
        </div>
      </div>)}
      <div style={{marginBottom:"16px"}}><FL>← East · Select Function · West →</FL><div style={{display:"flex",gap:"7px",flexWrap:"wrap",marginTop:"8px"}}>{FUNCTIONS.map(fn=>(<button key={fn.id} onClick={()=>{setActiveFn(fn.id);setActiveLayer(null);}} style={{padding:"7px 13px",background:activeFn===fn.id?`linear-gradient(135deg,${C.copper},${C.copperL})`:"rgba(255,255,255,0.04)",border:activeFn===fn.id?"none":`1px solid rgba(184,115,51,0.18)`,borderRadius:"3px",color:activeFn===fn.id?C.white:C.slate,fontSize:"12px",fontFamily:"'Trebuchet MS',sans-serif",fontWeight:activeFn===fn.id?700:400,cursor:"pointer"}}>{fn.icon} {fn.label}</button>))}</div></div>
      {complete&&(<div style={{marginBottom:"14px",padding:"14px 18px",background:`linear-gradient(135deg,rgba(184,115,51,0.12),rgba(184,115,51,0.04))`,border:`1px solid ${C.copper}`,borderRadius:"3px",display:"flex",gap:"16px",flexWrap:"wrap",alignItems:"center"}}>
        <div style={{fontSize:"12px",fontWeight:700,color:C.ice,fontFamily:"'Trebuchet MS',sans-serif",flexShrink:0}}>{FUNCTIONS.find(f=>f.id===activeFn)?.icon} {FUNCTIONS.find(f=>f.id===activeFn)?.label}</div>
        <div style={{display:"flex",gap:"14px",flexWrap:"wrap"}}>
          {r.rev.hi>0&&rev>0&&(<div><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1px"}}>REVENUE UPLIFT</div><div style={{fontSize:"15px",fontWeight:700,color:C.greenL,fontFamily:"'Georgia',serif"}}>{fmt(rev*r.rev.lo)} – {fmt(rev*r.rev.hi)}</div><div style={{fontSize:"10px",color:C.muted,fontStyle:"italic",fontFamily:"'Trebuchet MS',sans-serif"}}>{(r.rev.lo*100).toFixed(1)}–{(r.rev.hi*100).toFixed(1)}% of {fmt(rev)}</div></div>)}
          {r.cost.hi>0&&cost>0&&(<div><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1px"}}>COST REDUCTION</div><div style={{fontSize:"15px",fontWeight:700,color:C.copperL,fontFamily:"'Georgia',serif"}}>{fmt(cost*r.cost.lo)} – {fmt(cost*r.cost.hi)}</div><div style={{fontSize:"10px",color:C.muted,fontStyle:"italic",fontFamily:"'Trebuchet MS',sans-serif"}}>{(r.cost.lo*100).toFixed(1)}–{(r.cost.hi*100).toFixed(1)}% of {fmt(cost)}</div></div>)}
        </div>
        {/* R2: Benchmark transparency */}
        <button onClick={()=>setShowSource(showSource===activeFn?null:activeFn)} style={{marginLeft:"auto",background:"transparent",border:`1px solid rgba(184,115,51,0.3)`,borderRadius:"3px",padding:"4px 10px",color:C.muted,fontSize:"10px",fontFamily:"'Trebuchet MS',sans-serif",cursor:"pointer"}}>📖 {showSource===activeFn?"Hide":"Show"} Source</button>
      </div>)}
      {/* R2: Transparency panel */}
      {showSource===activeFn&&(<div style={{marginBottom:"14px",padding:"14px 18px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.15)`,borderLeft:`4px solid rgba(184,115,51,0.4)`,borderRadius:"3px"}}>
        <FL mb={4}>Benchmark Methodology — {FUNCTIONS.find(f=>f.id===activeFn)?.label}</FL>
        <div style={{fontSize:"11px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.6,marginBottom:"8px"}}><strong style={{color:C.copper}}>Source:</strong> {r.source}</div>
        <div style={{fontSize:"11px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.6,marginBottom:"8px"}}><strong style={{color:C.copper}}>Industry Multiplier:</strong> {(IND_MULT[profile.industry||"universal"]?.[activeFn]||1).toFixed(2)}× applied to base rates for {INDUSTRIES.find(i=>i.id===(profile.industry||"universal"))?.label}</div>
        <div style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>Ranges represent typical achievable impact from mature AI deployments. Actual results depend on adoption depth, implementation quality, and change management investment. Override rates in the Company Profile if you have internal benchmarks.</div>
      </div>)}
      <div style={{display:"flex",gap:"12px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"8px",width:"140px",flexShrink:0}}>
          <div style={{height:"16px",fontSize:"9px",letterSpacing:"2px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:600}}>↑ NORTH</div>
          {LAYERS.map((layer,i)=>(<button key={layer.id} onClick={()=>setActiveLayer(activeLayer===layer.id?null:layer.id)} style={{padding:"10px 10px",background:activeLayer===layer.id?i===4?`linear-gradient(135deg,${C.copper},${C.copperL})`:"rgba(255,255,255,0.09)":"rgba(255,255,255,0.03)",border:`1px solid ${activeLayer===layer.id?C.copper:"rgba(184,115,51,0.12)"}`,borderRadius:"3px",cursor:"pointer",textAlign:"left",minHeight:"60px",display:"flex",flexDirection:"column",justifyContent:"center"}}><div style={{fontSize:"8px",letterSpacing:"1.5px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"3px"}}>{layer.note}</div><div style={{fontSize:"11px",fontWeight:700,fontFamily:"'Trebuchet MS',sans-serif",color:C.ice,lineHeight:1.3}}>{layer.label}</div></button>))}
          <div style={{height:"16px",fontSize:"9px",letterSpacing:"2px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:600}}>↓ SOUTH</div>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:"8px"}}><div style={{height:"16px"}}/>
          {LAYERS.map((layer,i)=>{const cell=BVF_DATA[activeFn][layer.id];const isLast=i===4;const isActive=activeLayer===layer.id;return(<div key={layer.id} onClick={()=>setActiveLayer(activeLayer===layer.id?null:layer.id)} style={{padding:"14px 18px",background:isActive?isLast?"rgba(184,115,51,0.1)":"rgba(255,255,255,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${isActive?C.copper:"rgba(184,115,51,0.1)"}`,borderLeft:isLast?`4px solid ${C.copper}`:isActive?`4px solid rgba(184,115,51,0.5)`:`4px solid rgba(184,115,51,0.1)`,borderRadius:"3px",cursor:"pointer",minHeight:"60px"}}><div style={{fontSize:"13px",fontWeight:600,color:C.ice,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.45}}>{cell.c}</div>{isActive&&isLast&&(<div style={{marginTop:"10px",paddingTop:"10px",borderTop:`1px solid rgba(184,115,51,0.2)`}}><FL mb={6}>Value Drivers · {FUNCTIONS.find(f=>f.id===activeFn)?.label}</FL>{r.drivers.map((d,j)=>(<div key={j} style={{display:"flex",gap:"8px",marginBottom:"5px"}}><span style={{color:C.copper,fontSize:"9px",marginTop:"3px",flexShrink:0}}>◆</span><span style={{fontSize:"12px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.5}}>{d}</span></div>))}</div>)}</div>);})}
          <div style={{height:"16px"}}/>
        </div>
      </div>
      <Mirror/>
    </div>
  );
}

// ─── Tab 2: Portfolio ─────────────────────────────────────────────────────────
const BLANK_INIT=()=>({id:Date.now(),name:"",fn:"it",tier:"gen2",budget:"",cmBudget:"",horizon:HORIZONS[0],owner:"",outcome:"",risk:"Medium",pilotAnswers:{sponsored:"",owner:"",scaled:"",kpi:"",funded:""}});

// R6: Pilot Trap questions
const PILOT_QS=[
  {key:"sponsored",q:"Does this initiative have named C-suite sponsorship?"},
  {key:"owner",q:"Is there a named business owner accountable for adoption?"},
  {key:"scaled",q:"Has this moved beyond pilot / PoC stage?"},
  {key:"kpi",q:"Is success tied to a specific board-level KPI?"},
  {key:"funded",q:"Is the change management budget separately funded?"},
];
const pilotScore=(a)=>{if(!a)return null;const vals=Object.values(a);if(vals.every(v=>!v))return null;const yes=vals.filter(v=>v==="yes").length;return{score:yes,total:vals.filter(v=>v).length,label:yes>=4?"LOW RISK":yes>=2?"PILOT TRAP RISK":"CRITICAL PILOT TRAP",color:yes>=4?C.greenL:yes>=2?C.amberL:C.redL};};

function PortfolioTab({profile,initiatives,setInitiatives}){
  const[editing,setEditing]=useState(null);const[form,setForm]=useState(null);const[showPilot,setShowPilot]=useState(false);
  const rev=parseNum(profile.revenue),cost=parseNum(profile.costBase);
  const startAdd=()=>{const b=BLANK_INIT();setForm(b);setEditing(b.id);setShowPilot(false);};
  const startEdit=(i)=>{setForm({...i});setEditing(i.id);setShowPilot(false);};
  const cancel=()=>{setEditing(null);setForm(null);};
  const save=()=>{if(!form?.name?.trim())return;setInitiatives(prev=>{const ex=prev.find(i=>i.id===form.id);return ex?prev.map(i=>i.id===form.id?form:i):[...prev,form];});cancel();};
  const remove=(id)=>setInitiatives(prev=>prev.filter(i=>i.id!==id));
  const totBudget=initiatives.reduce((s,i)=>s+parseNum(i.budget),0);
  const totCM=initiatives.reduce((s,i)=>s+parseNum(i.cmBudget),0);
  // R3: tier distribution
  const tierCounts=AI_TIERS.map(t=>({...t,count:initiatives.filter(i=>i.tier===t.id).length,budget:initiatives.filter(i=>i.tier===t.id).reduce((s,i)=>s+parseNum(i.budget),0)}));

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"20px",flexWrap:"wrap",gap:"12px"}}>
        <div><FL>AI Initiative Portfolio{profile.company?` — ${profile.company}`:""}</FL><div style={{fontSize:"13px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif"}}>Track every AI investment with Gen tier, CM allocation, owner, and Pilot Trap diagnostic</div></div>
        <Btn onClick={startAdd}>+ Add Initiative</Btn>
      </div>

      {/* R3: Tier distribution */}
      {initiatives.length>0&&(<div style={{display:"flex",gap:"10px",marginBottom:"20px",flexWrap:"wrap"}}>
        {tierCounts.map(t=>(<div key={t.id} style={{flex:1,minWidth:"140px",padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,0.08)`,borderTop:`3px solid ${t.color}`,borderRadius:"3px"}}><div style={{fontSize:"9px",letterSpacing:"1.5px",color:t.color,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:700,marginBottom:"5px"}}>{t.short}</div><div style={{fontSize:"18px",fontWeight:700,color:C.ice,fontFamily:"'Georgia',serif"}}>{t.count} <span style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:400}}>initiatives</span></div><div style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>{fmt(t.budget)}</div><div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginTop:"3px"}}>{t.desc}</div></div>))}
      </div>)}

      {editing&&form&&(<div style={{marginBottom:"20px",padding:"22px 26px",background:"rgba(184,115,51,0.07)",border:`1px solid ${C.copper}`,borderRadius:"4px"}}>
        <FL>{initiatives.find(i=>i.id===form.id)?"Edit Initiative":"New AI Initiative"}</FL>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))",gap:"12px",marginTop:"10px"}}>
          <div style={{gridColumn:"1/3"}}><FL>Initiative Name *</FL><Inp value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="e.g. GenAI Customer Service Agent"/></div>
          <div><FL>BVF Function</FL><Sel value={form.fn} onChange={v=>setForm(p=>({...p,fn:v}))} options={FUNCTIONS.map(f=>({value:f.id,label:`${f.icon} ${f.label}`}))}/></div>
          <div><FL>AI Generation Tier</FL><Sel value={form.tier||"gen2"} onChange={v=>setForm(p=>({...p,tier:v}))} options={AI_TIERS.map(t=>({value:t.id,label:t.label}))}/>
            {form.tier&&<div style={{fontSize:"10px",color:AI_TIERS.find(t=>t.id===form.tier)?.color,marginTop:"3px",fontFamily:"'Trebuchet MS',sans-serif"}}>{AI_TIERS.find(t=>t.id===form.tier)?.desc}</div>}
          </div>
          <div><FL>Total Budget</FL><Inp value={form.budget} onChange={v=>setForm(p=>({...p,budget:v}))} placeholder="e.g. 2M"/>{rev>0&&parseNum(form.budget)>0&&<div style={{fontSize:"10px",color:C.muted,marginTop:"3px",fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>{pct(parseNum(form.budget),rev)} of revenue</div>}</div>
          <div><FL>CM Budget</FL><Inp value={form.cmBudget} onChange={v=>setForm(p=>({...p,cmBudget:v}))} placeholder="e.g. 200K"/>{parseNum(form.budget)>0&&parseNum(form.cmBudget)>0&&(()=>{const p2=parseNum(form.cmBudget)/parseNum(form.budget);const col=p2>=.10?C.greenL:p2>=.05?C.amberL:C.redL;return<div style={{fontSize:"10px",color:col,marginTop:"3px",fontFamily:"'Trebuchet MS',sans-serif",fontWeight:700}}>{(p2*100).toFixed(1)}% {p2>=.10?"✓ Prosci compliant":p2>=.05?"⚠ Below minimum":"✗ Critical gap"}</div>;})()}</div>
          <div><FL>Horizon</FL><Sel value={form.horizon} onChange={v=>setForm(p=>({...p,horizon:v}))} options={HORIZONS}/></div>
          <div><FL>Owner</FL><Inp value={form.owner} onChange={v=>setForm(p=>({...p,owner:v}))} placeholder="e.g. CIO / CDO"/></div>
          <div><FL>Risk Level</FL><Sel value={form.risk} onChange={v=>setForm(p=>({...p,risk:v}))} options={RISK_LEVELS}/></div>
          <div style={{gridColumn:"1/-1"}}><FL>Expected Business Outcome</FL><Inp value={form.outcome} onChange={v=>setForm(p=>({...p,outcome:v}))} placeholder="e.g. 30% AHT reduction → CX Operating KPI → Cost reduction"/></div>
        </div>
        {/* R6: Pilot Trap */}
        <button onClick={()=>setShowPilot(s=>!s)} style={{marginTop:"14px",background:"transparent",border:`1px solid rgba(245,166,35,0.3)`,borderRadius:"3px",padding:"6px 14px",color:C.amberL,fontSize:"11px",fontFamily:"'Trebuchet MS',sans-serif",cursor:"pointer"}}>⚠ {showPilot?"Hide":"Run"} Pilot Trap Diagnostic</button>
        {showPilot&&(<div style={{marginTop:"12px",padding:"16px 18px",background:"rgba(192,122,26,0.08)",border:`1px solid rgba(245,166,35,0.25)`,borderRadius:"3px"}}>
          <FL mb={4}>Pilot Trap Diagnostic — 5 Questions</FL>
          <div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginBottom:"12px"}}>42% of companies abandoned most AI projects in 2025 citing unclear value. Answer honestly.</div>
          {PILOT_QS.map(q=>(<div key={q.key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid rgba(255,255,255,0.05)`}}>
            <span style={{fontSize:"12px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",flex:1,paddingRight:"16px"}}>{q.q}</span>
            <div style={{display:"flex",gap:"6px",flexShrink:0}}>
              {["yes","no","partial"].map(v=>(<button key={v} onClick={()=>setForm(p=>({...p,pilotAnswers:{...p.pilotAnswers,[q.key]:v}}))} style={{padding:"4px 10px",background:form.pilotAnswers?.[q.key]===v?(v==="yes"?C.green:v==="no"?C.red:C.amber):"rgba(255,255,255,0.05)",border:"none",borderRadius:"2px",color:C.white,fontSize:"10px",fontFamily:"'Trebuchet MS',sans-serif",cursor:"pointer",fontWeight:form.pilotAnswers?.[q.key]===v?700:400}}>{v}</button>))}
            </div>
          </div>))}
          {pilotScore(form.pilotAnswers)&&(()=>{const ps=pilotScore(form.pilotAnswers);return(<div style={{marginTop:"10px",padding:"10px 14px",background:"rgba(0,0,0,0.2)",borderRadius:"3px",display:"flex",alignItems:"center",gap:"12px"}}><span style={{fontSize:"13px",fontWeight:700,color:ps.color,fontFamily:"'Trebuchet MS',sans-serif"}}>{ps.label}</span><span style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>{ps.score}/{ps.total} readiness indicators met</span></div>);})()}
        </div>)}
        <div style={{display:"flex",gap:"10px",marginTop:"14px"}}><Btn onClick={save}>Save Initiative</Btn><Btn onClick={cancel} variant="ghost">Cancel</Btn></div>
      </div>)}

      {initiatives.length===0?(<div style={{textAlign:"center",padding:"48px",border:`1px dashed rgba(184,115,51,0.25)`,borderRadius:"4px"}}><div style={{fontSize:"14px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>No initiatives yet. Click "+ Add Initiative" to build your AI portfolio.</div></div>):(
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12px",fontFamily:"'Trebuchet MS',sans-serif"}}>
            <thead><tr style={{borderBottom:`1px solid rgba(184,115,51,0.25)`}}>{["Initiative","Function","Tier","Budget","% Rev","CM Alloc","CM %","Horizon","Owner","Risk","Pilot",""].map(h=>(<th key={h} style={{padding:"9px 9px",textAlign:"left",fontSize:"9px",letterSpacing:"1.5px",color:C.copper,fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>))}</tr></thead>
            <tbody>{initiatives.map((init,idx)=>{
              const bud=parseNum(init.budget),cm=parseNum(init.cmBudget);
              const rag=RAG(cm,bud),rc=rag?RAG_CFG[rag]:null;
              const fn=FUNCTIONS.find(f=>f.id===init.fn);
              const tier=AI_TIERS.find(t=>t.id===init.tier);
              const ps=pilotScore(init.pilotAnswers);
              return(<tr key={init.id} style={{borderBottom:`1px solid rgba(255,255,255,0.05)`,background:idx%2===0?"rgba(255,255,255,0.02)":"transparent"}}>
                <td style={{padding:"10px 9px",color:C.ice,fontWeight:600,maxWidth:"150px"}}>{init.name||"—"}</td>
                <td style={{padding:"10px 9px",color:C.slate,whiteSpace:"nowrap"}}>{fn?.icon} {fn?.label}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{tier&&<span style={{color:tier.color,fontWeight:700,fontSize:"11px"}}>{tier.short}</span>}</td>
                <td style={{padding:"10px 9px",color:C.ice,whiteSpace:"nowrap"}}>{fmt(bud)}</td>
                <td style={{padding:"10px 9px",color:C.muted,whiteSpace:"nowrap"}}>{rev>0?pct(bud,rev):"—"}</td>
                <td style={{padding:"10px 9px",color:C.ice,whiteSpace:"nowrap"}}>{fmt(cm)}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{rc?<span style={{padding:"3px 7px",borderRadius:"2px",background:rc.bg,color:rc.text,fontSize:"9px",fontWeight:700,border:`1px solid ${rc.border}`}}>{pct(cm,bud)}</span>:<span style={{color:C.muted}}>—</span>}</td>
                <td style={{padding:"10px 9px",color:C.slate,whiteSpace:"nowrap"}}>{init.horizon}</td>
                <td style={{padding:"10px 9px",color:C.slate}}>{init.owner||"—"}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}><span style={{color:RISK_COLORS[init.risk],fontWeight:700}}>{init.risk}</span></td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}>{ps?<span style={{color:ps.color,fontSize:"10px",fontWeight:700}}>{ps.score}/{ps.total}</span>:<span style={{color:C.muted,fontSize:"10px"}}>—</span>}</td>
                <td style={{padding:"10px 9px",whiteSpace:"nowrap"}}><div style={{display:"flex",gap:"5px"}}><Btn onClick={()=>startEdit(init)} variant="secondary" small>Edit</Btn><Btn onClick={()=>remove(init.id)} variant="ghost" small>✕</Btn></div></td>
              </tr>);})}
            </tbody>
          </table>
        </div>
      )}
      {initiatives.length>0&&(<div style={{marginTop:"16px",display:"flex",gap:"10px",flexWrap:"wrap"}}>
        {[{l:"Total AI Investment",v:fmt(totBudget),sub:rev>0?`${pct(totBudget,rev)} of revenue`:"",col:C.copper},{l:"Total CM Allocated",v:fmt(totCM),sub:`${pct(totCM,totBudget)} of portfolio`,col:totBudget>0&&totCM/totBudget>=.10?C.greenL:totCM/totBudget>=.05?C.amberL:C.redL},{l:"Gen 3 Agentic Share",v:totBudget>0?pct(tierCounts.find(t=>t.id==="gen3")?.budget||0,totBudget):"—",sub:"of portfolio budget",col:C.purpleL},{l:"Pilot Trap Issues",v:initiatives.filter(i=>pilotScore(i.pilotAnswers)&&pilotScore(i.pilotAnswers).score<2).length||"—",sub:"initiatives with <2 readiness indicators",col:C.amberL}].map(s=>(<div key={s.l} style={{flex:1,minWidth:"140px",padding:"12px 16px",background:"rgba(255,255,255,0.04)",border:`1px solid rgba(184,115,51,0.18)`,borderRadius:"3px"}}><div style={{fontSize:"9px",letterSpacing:"1.5px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"5px"}}>{s.l.toUpperCase()}</div><div style={{fontSize:"18px",fontWeight:700,color:s.col,fontFamily:"'Georgia',serif"}}>{s.v}</div>{s.sub&&<div style={{fontSize:"10px",color:C.muted,marginTop:"2px",fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>{s.sub}</div>}</div>))}
      </div>)}
    </div>
  );
}

// ─── Tab 3: CM Health ─────────────────────────────────────────────────────────
function CMTab({profile,initiatives}){
  const totBudget=initiatives.reduce((s,i)=>s+parseNum(i.budget),0);
  const totCM=initiatives.reduce((s,i)=>s+parseNum(i.cmBudget),0);
  const prosciLow=totBudget*.10,prosciHigh=totBudget*.15;
  const gapLow=Math.max(0,prosciLow-totCM),gapHigh=Math.max(0,prosciHigh-totCM);
  const portRAG=totBudget>0?RAG(totCM,totBudget):null,rc=portRAG?RAG_CFG[portRAG]:null;
  const cmPct=totBudget>0?(totCM/totBudget)*100:0,barW=Math.min(100,cmPct/15*100);
  const rev=parseNum(profile.revenue);
  return(
    <div>
      <div style={{marginBottom:"18px"}}><FL>Change Management Health Check{profile.company?` — ${profile.company}`:""}</FL><div style={{fontSize:"13px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif"}}>Prosci: a minimum of <strong style={{color:C.copper}}>10–15%</strong> of project budget must fund change management for AI value to land.</div></div>
      {initiatives.length===0?(<div style={{textAlign:"center",padding:"48px",border:`1px dashed rgba(184,115,51,0.25)`,borderRadius:"4px"}}><div style={{fontSize:"14px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>Add initiatives in the Portfolio tab to generate your CM Health Check.</div></div>):(
        <>
          {rc&&(<div style={{marginBottom:"22px",padding:"18px 22px",background:rc.bg,border:`1px solid ${rc.border}`,borderRadius:"4px",display:"flex",alignItems:"center",gap:"18px",flexWrap:"wrap"}}><div style={{fontSize:"24px",fontWeight:700,color:rc.text,fontFamily:"'Trebuchet MS',sans-serif"}}>{rc.label}</div><div style={{flex:1}}><div style={{fontSize:"13px",color:C.ice,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"2px"}}>{rc.desc}</div><div style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>Portfolio CM: {cmPct.toFixed(1)}% · Prosci min: 10% · Recommended: 15%{rev>0?` · Gap = ${pct(gapLow,rev)}–${pct(gapHigh,rev)} of revenue`:""}</div></div></div>)}
          <div style={{marginBottom:"22px",padding:"18px 22px",background:"rgba(0,0,0,0.2)",border:`1px solid rgba(184,115,51,0.18)`,borderRadius:"4px"}}><FL>CM Allocation vs Prosci Benchmark</FL>
            <div style={{marginTop:"12px",position:"relative",height:"40px",background:"rgba(255,255,255,0.04)",borderRadius:"3px",overflow:"hidden"}}>
              {[{pct:33.3,col:"rgba(224,82,82,0.1)",bdr:"rgba(224,82,82,0.35)"},{pct:33.3,col:"rgba(245,166,35,0.08)",bdr:"rgba(245,166,35,0.35)"},{pct:33.4,col:"rgba(76,175,128,0.08)",bdr:null}].map((s,i)=>(<div key={i} style={{position:"absolute",left:`${i*33.3}%`,top:0,width:`${s.pct}%`,height:"100%",background:s.col,borderRight:s.bdr?`1px dashed ${s.bdr}`:""}}/>))}
              <div style={{position:"absolute",left:0,top:0,height:"100%",width:`${barW}%`,background:rc?`linear-gradient(90deg,${rc.border},${rc.border}aa)`:C.copper,transition:"width 0.5s"}}/>
              {["5%","10%","15% ✓"].map((lbl,i)=>(<div key={lbl} style={{position:"absolute",left:`${(i+1)*33.3}%`,top:"50%",transform:"translate(-50%,-50%)",fontSize:"9px",fontFamily:"'Trebuchet MS',sans-serif",fontWeight:700,color:[C.redL,C.amberL,C.greenL][i]}}>{lbl}</div>))}
              <div style={{position:"absolute",left:`${barW}%`,top:0,bottom:0,width:"2px",background:C.white,transform:"translateX(-1px)"}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:"6px",fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}><span style={{color:C.redL}}>Critical (&lt;5%)</span><span style={{color:C.amberL}}>At risk (5–10%)</span><span style={{color:C.greenL}}>Prosci compliant (≥10%)</span></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:"10px",marginBottom:"22px"}}>
            {[{l:"Total AI Portfolio",v:fmt(totBudget),sub:rev>0?`${pct(totBudget,rev)} of revenue`:"",col:C.copper},{l:"CM Allocated",v:fmt(totCM),sub:`${cmPct.toFixed(1)}% of portfolio`,col:cmPct>=10?C.greenL:cmPct>=5?C.amberL:C.redL},{l:"Prosci Minimum (10%)",v:fmt(prosciLow),col:C.amberL},{l:"Prosci Recommended (15%)",v:fmt(prosciHigh),col:C.greenL},{l:"Gap to Minimum",v:gapLow>0?fmt(gapLow):"✓ Met",col:gapLow>0?C.redL:C.greenL,sub:gapLow>0?"Additional CM to reach 10%":""},{l:"Gap to Recommended",v:gapHigh>0?fmt(gapHigh):"✓ Met",col:gapHigh>0?C.amberL:C.greenL,sub:gapHigh>0?"Additional CM to reach 15%":""}].map(s=>(<div key={s.l} style={{padding:"14px 16px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.15)`,borderRadius:"3px"}}><div style={{fontSize:"9px",letterSpacing:"1.5px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"6px"}}>{s.l.toUpperCase()}</div><div style={{fontSize:"17px",fontWeight:700,color:s.col,fontFamily:"'Georgia',serif",marginBottom:"2px"}}>{s.v}</div>{s.sub&&<div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>{s.sub}</div>}</div>))}
          </div>
          <div style={{marginBottom:"22px"}}><FL>Initiative-Level CM Status</FL><div style={{display:"flex",flexDirection:"column",gap:"7px",marginTop:"10px"}}>
            {initiatives.map(init=>{const bud=parseNum(init.budget),cm=parseNum(init.cmBudget),rag=RAG(cm,bud),irc=rag?RAG_CFG[rag]:null,fn=FUNCTIONS.find(f=>f.id===init.fn),tier=AI_TIERS.find(t=>t.id===init.tier),p2=bud>0?(cm/bud)*100:0,iBarW=Math.min(100,p2/15*100),ps=pilotScore(init.pilotAnswers);
              return(<div key={init.id} style={{padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.12)`,borderLeft:`4px solid ${irc?irc.border:"rgba(184,115,51,0.2)"}`,borderRadius:"3px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"8px",marginBottom:"8px"}}>
                  <div><div style={{fontSize:"12px",fontWeight:700,color:C.ice,fontFamily:"'Trebuchet MS',sans-serif"}}>{init.name||"Unnamed"}</div><div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginTop:"2px"}}>{fn?.icon} {fn?.label}{tier?<span style={{color:tier.color}}> · {tier.short}</span>:""} · {init.horizon}</div></div>
                  <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                    <div style={{textAlign:"right"}}><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>Budget</div><div style={{fontSize:"13px",fontWeight:700,color:C.copper,fontFamily:"'Georgia',serif"}}>{fmt(bud)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>CM</div><div style={{fontSize:"13px",fontWeight:700,color:irc?.text||C.muted,fontFamily:"'Georgia',serif"}}>{fmt(cm)}</div></div>
                    {irc&&<div style={{padding:"3px 8px",borderRadius:"2px",background:irc.bg,color:irc.text,fontSize:"9px",fontWeight:700,border:`1px solid ${irc.border}`}}>{irc.label}</div>}
                    {ps&&<div style={{padding:"3px 8px",borderRadius:"2px",background:"rgba(0,0,0,0.2)",color:ps.color,fontSize:"9px",fontWeight:700,border:`1px solid ${ps.color}`}}>PILOT {ps.label}</div>}
                  </div>
                </div>
                {bud>0&&(<><div style={{height:"4px",background:"rgba(255,255,255,0.05)",borderRadius:"3px",overflow:"hidden"}}><div style={{height:"100%",width:`${iBarW}%`,background:irc?irc.border:C.muted,borderRadius:"3px"}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:"3px",fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}><span>CM: {p2.toFixed(1)}%</span>{cm<bud*.10&&<span style={{color:C.redL}}>Gap to 10%: {fmt(bud*.10-cm)}</span>}{cm>=bud*.15&&<span style={{color:C.greenL}}>✓ Recommended met</span>}</div></>)}
              </div>);})}
          </div></div>
          <div style={{padding:"20px 24px",background:"rgba(184,115,51,0.06)",border:`1px solid rgba(184,115,51,0.25)`,borderLeft:`4px solid ${C.copper}`,borderRadius:"3px"}}><FL>The Prosci Principle</FL><p style={{margin:"8px 0 8px",fontSize:"13px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.7,fontStyle:"italic"}}>"Organisations that invest in change management are six times more likely to meet project objectives. A minimum of 10–15% of total project budget should be allocated to the people side."</p><div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>Prosci Best Practices in Change Management · 11th Edition</div></div>
        </>
      )}
      <Mirror sub="The answer is almost always: most of it. And the CM budget is almost always the first thing cut. — Craig Horton"/>
    </div>
  );
}

// ─── Tab 4: Regulatory Readiness (R1) ────────────────────────────────────────
function RegulatoryTab({profile}){
  const[selected,setSelected]=useState(["euai","csrd"]);
  const rev=parseNum(profile.revenue);
  const complete=rev>0;
  const toggle=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const activeRegs=REG_FRAMEWORKS.filter(r=>selected.includes(r.id));
  const totalLo=activeRegs.reduce((s,r)=>s+(rev*(r.costRange.lo)),0);
  const totalHi=activeRegs.reduce((s,r)=>s+(rev*(r.costRange.hi)),0);
  return(
    <div>
      <div style={{marginBottom:"18px"}}><FL>Regulatory Readiness — EU AI Landscape 2025–2027</FL><div style={{fontSize:"13px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.6}}>Select the regulations applicable to {profile.company||"your organisation"}. Compliance costs are calculated against your revenue profile and shown as a preparedness risk alongside your AI investment.</div></div>
      <div style={{display:"flex",gap:"10px",marginBottom:"22px",flexWrap:"wrap"}}>
        {REG_FRAMEWORKS.map(r=>(<button key={r.id} onClick={()=>toggle(r.id)} style={{padding:"10px 16px",background:selected.includes(r.id)?`rgba(${r.id==="euai"?"224,82,82":r.id==="dora"?"245,166,35":r.id==="csrd"?"76,175,128":"139,92,246"},0.15)`:"rgba(255,255,255,0.04)",border:`1px solid ${selected.includes(r.id)?r.color:"rgba(255,255,255,0.1)"}`,borderRadius:"3px",cursor:"pointer",textAlign:"left"}}>
          <div style={{fontSize:"11px",fontWeight:700,color:selected.includes(r.id)?r.color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>{r.icon} {r.label}</div>
          <div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginTop:"2px"}}>{r.risk} · {r.timeline}</div>
        </button>))}
      </div>
      {complete&&activeRegs.length>0&&(<div style={{marginBottom:"22px",padding:"18px 22px",background:"rgba(0,0,0,0.2)",border:`1px solid rgba(184,115,51,0.2)`,borderRadius:"4px"}}>
        <FL>Estimated Regulatory Compliance Investment — {profile.company||"Your Enterprise"}</FL>
        <div style={{display:"flex",gap:"12px",flexWrap:"wrap",marginTop:"8px"}}>
          <div style={{flex:1,minWidth:"160px",padding:"12px 16px",background:"rgba(184,115,51,0.08)",border:`1px solid ${C.copper}`,borderRadius:"3px"}}><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1.5px",marginBottom:"5px"}}>TOTAL COMPLIANCE COST RANGE</div><div style={{fontSize:"22px",fontWeight:700,color:C.copper,fontFamily:"'Georgia',serif"}}>{fmt(totalLo)} – {fmt(totalHi)}</div><div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginTop:"3px"}}>{((totalLo/rev)*100).toFixed(2)}–{((totalHi/rev)*100).toFixed(2)}% of {fmt(rev)} revenue</div></div>
          {activeRegs.map(r=>(<div key={r.id} style={{flex:1,minWidth:"130px",padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:`1px solid ${r.color}22`,borderTop:`3px solid ${r.color}`,borderRadius:"3px"}}><div style={{fontSize:"9px",color:r.color,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:700,letterSpacing:"1px",marginBottom:"5px"}}>{r.shortLabel}</div><div style={{fontSize:"17px",fontWeight:700,color:C.ice,fontFamily:"'Georgia',serif"}}>{fmt(rev*r.costRange.lo)}–{fmt(rev*r.costRange.hi)}</div><div style={{fontSize:"10px",color:C.muted,marginTop:"2px",fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>{(r.costRange.lo*100).toFixed(2)}–{(r.costRange.hi*100).toFixed(2)}% of rev</div></div>))}
        </div>
      </div>)}
      <div style={{display:"flex",flexDirection:"column",gap:"14px",marginBottom:"22px"}}>
        {REG_FRAMEWORKS.filter(r=>selected.includes(r.id)).map(r=>(<div key={r.id} style={{padding:"18px 22px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(255,255,255,0.08)`,borderLeft:`4px solid ${r.color}`,borderRadius:"3px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px",flexWrap:"wrap",gap:"8px"}}>
            <div><div style={{fontSize:"14px",fontWeight:700,color:C.ice,fontFamily:"'Trebuchet MS',sans-serif"}}>{r.icon} {r.label} — {r.risk}</div><div style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginTop:"2px"}}>Effective: {r.timeline}</div></div>
            {complete&&<div style={{textAlign:"right"}}><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>Estimated Cost</div><div style={{fontSize:"16px",fontWeight:700,color:r.color,fontFamily:"'Georgia',serif"}}>{fmt(rev*r.costRange.lo)} – {fmt(rev*r.costRange.hi)}</div></div>}
          </div>
          <p style={{margin:"0 0 10px",fontSize:"12px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.6}}>{r.desc}</p>
          <FL mb={4}>Key Obligations</FL>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"5px",marginBottom:"8px"}}>
            {r.obligations.map((o,j)=>(<div key={j} style={{display:"flex",gap:"7px",padding:"5px 0"}}><span style={{color:r.color,fontSize:"9px",marginTop:"3px",flexShrink:0}}>◆</span><span style={{fontSize:"11px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",lineHeight:1.5}}>{o}</span></div>))}
          </div>
          <FL mb={4}>Cost Drivers</FL>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {r.costDrivers.map((d,j)=>(<span key={j} style={{padding:"3px 9px",background:"rgba(255,255,255,0.05)",border:`1px solid rgba(255,255,255,0.1)`,borderRadius:"2px",fontSize:"10px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif"}}>{d}</span>))}
          </div>
          <div style={{marginTop:"10px",fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>Source: {r.source}</div>
        </div>))}
      </div>
      {!complete&&(<div style={{padding:"20px",background:"rgba(192,122,26,0.1)",border:`1px solid rgba(245,166,35,0.3)`,borderRadius:"3px",textAlign:"center"}}><div style={{fontSize:"13px",color:C.amberL,fontFamily:"'Trebuchet MS',sans-serif"}}>Enter your annual revenue in the Company Profile to see compliance costs in your currency.</div></div>)}
      <Mirror sub="Regulatory readiness is not a legal question. It is a board-level risk and cost question. The organisations that get ahead of this will spend less and move faster. — Craig Horton"/>
    </div>
  );
}

// ─── Tab 5: AI Alignment Map (R4) ────────────────────────────────────────────
function AlignmentTab({profile,initiatives,rates}){
  const rev=parseNum(profile.revenue),cost=parseNum(profile.costBase),ebt=parseNum(profile.ebitda);
  const complete=rev>0&&cost>0&&ebt>0;
  const scorecard=useMemo(()=>{let rL=0,rH=0,cL=0,cH=0,eL=0,eH=0;FUNCTIONS.forEach(fn=>{const r=rates[fn.id];rL+=rev*r.rev.lo;rH+=rev*r.rev.hi;cL+=cost*r.cost.lo;cH+=cost*r.cost.hi;eL+=ebt*r.ebt.lo;eH+=ebt*r.ebt.hi;});return{rL,rH,cL,cH,eL,eH,totL:cL+rL*.2+eL,totH:cH+rH*.2+eH};},[rates,rev,cost,ebt]);
  const totBudget=initiatives.reduce((s,i)=>s+parseNum(i.budget),0);
  const totCM=initiatives.reduce((s,i)=>s+parseNum(i.cmBudget),0);
  const cmPct=totBudget>0?(totCM/totBudget)*100:0;
  const portRAG=totBudget>0?RAG(totCM,totBudget):null,rc=portRAG?RAG_CFG[portRAG]:null;
  const topFns=complete?FUNCTIONS.map(fn=>{const r=rates[fn.id];const impact=(rev*r.rev.lo+cost*r.cost.lo+ebt*r.ebt.lo+rev*r.rev.hi+cost*r.cost.hi+ebt*r.ebt.hi)/2;return{...fn,impact};}).sort((a,b)=>b.impact-a.impact).slice(0,3):[];
  const pilotRisk=initiatives.filter(i=>{const ps=pilotScore(i.pilotAnswers);return ps&&ps.score<2;}).length;
  const tierCounts=AI_TIERS.map(t=>({...t,count:initiatives.filter(i=>i.tier===t.id).length,pct:initiatives.length>0?Math.round(initiatives.filter(i=>i.tier===t.id).length/initiatives.length*100):0}));

  return(
    <div>
      <div style={{marginBottom:"18px"}}><FL>AI Alignment Map — Board Summary</FL><div style={{fontSize:"13px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif"}}>One-page board-ready view. Complete the Company Profile and build your Portfolio to activate all sections.</div></div>
      {/* Header identity */}
      <div style={{padding:"18px 24px",background:`linear-gradient(135deg,rgba(13,31,60,0.8),rgba(22,45,78,0.8))`,border:`1px solid rgba(184,115,51,0.3)`,borderRadius:"4px",marginBottom:"16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"12px"}}>
        <div><div style={{fontSize:"9px",letterSpacing:"3px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"6px"}}>AI ALIGNMENT MAP · CRAIG HORTON · {new Date().getFullYear()}</div><div style={{fontSize:"22px",fontWeight:700,color:C.white,fontFamily:"'Georgia',serif"}}>{profile.company||"[Company Name]"}</div><div style={{fontSize:"12px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",marginTop:"2px"}}>{INDUSTRIES.find(i=>i.id===(profile.industry||"universal"))?.label}{complete?` · Rev ${fmt(rev)} · Cost ${fmt(cost)} · EBITDA ${fmt(ebt)}`:""}</div></div>
        <div style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",textAlign:"right"}}>{new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</div>
      </div>
      {/* Three-column summary */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"12px",marginBottom:"16px"}}>
        {/* Value Potential */}
        <div style={{padding:"16px 18px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.2)`,borderTop:`3px solid ${C.copper}`,borderRadius:"3px"}}>
          <FL>AI Value Potential</FL>
          {complete?(<>
            <div style={{fontSize:"20px",fontWeight:700,color:C.copper,fontFamily:"'Georgia',serif",marginBottom:"4px"}}>{fmt(scorecard.totL)} – {fmt(scorecard.totH)}</div>
            <div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginBottom:"10px"}}>Combined annual EBITDA impact</div>
            {[{l:"Revenue uplift",lo:scorecard.rL,hi:scorecard.rH,col:C.greenL},{l:"Cost reduction",lo:scorecard.cL,hi:scorecard.cH,col:C.copperL}].map(s=>(<div key={s.l} style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}><span style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>{s.l}</span><span style={{fontSize:"11px",fontWeight:700,color:s.col,fontFamily:"'Trebuchet MS',sans-serif"}}>{s.lo>0?`${fmt(s.lo)}–${fmt(s.hi)}`:"—"}</span></div>))}
          </>):(<div style={{fontSize:"12px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginTop:"8px"}}>Enter financials in Company Profile</div>)}
        </div>
        {/* Portfolio Health */}
        <div style={{padding:"16px 18px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.2)`,borderTop:`3px solid ${rc?.border||C.muted}`,borderRadius:"3px"}}>
          <FL>Portfolio Health</FL>
          {initiatives.length>0?(<>
            <div style={{fontSize:"20px",fontWeight:700,color:rc?.text||C.muted,fontFamily:"'Georgia',serif",marginBottom:"4px"}}>{rc?.label||"—"}</div>
            <div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginBottom:"10px"}}>CM rate: {cmPct.toFixed(1)}% · Prosci min: 10%</div>
            {[{l:"Total investment",v:fmt(totBudget)},{l:"CM allocated",v:fmt(totCM)},{l:"Initiatives",v:initiatives.length},{l:"Pilot trap risk",v:pilotRisk>0?`${pilotRisk} flagged`:"None flagged",col:pilotRisk>0?C.amberL:C.greenL}].map(s=>(<div key={s.l} style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}><span style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>{s.l}</span><span style={{fontSize:"11px",fontWeight:700,color:s.col||C.ice,fontFamily:"'Trebuchet MS',sans-serif"}}>{s.v}</span></div>))}
          </>):(<div style={{fontSize:"12px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginTop:"8px"}}>Add initiatives in Portfolio tab</div>)}
        </div>
        {/* Generation Mix */}
        <div style={{padding:"16px 18px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.2)`,borderTop:`3px solid ${C.purpleL}`,borderRadius:"3px"}}>
          <FL>AI Generation Mix</FL>
          {initiatives.length>0?(<>
            <div style={{fontSize:"20px",fontWeight:700,color:C.purpleL,fontFamily:"'Georgia',serif",marginBottom:"4px"}}>{tierCounts.find(t=>t.id==="gen3")?.pct||0}% Agentic</div>
            <div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginBottom:"10px"}}>Gen 3 share of portfolio</div>
            {tierCounts.map(t=>(<div key={t.id} style={{display:"flex",justifyContent:"space-between",marginBottom:"4px",alignItems:"center"}}><span style={{fontSize:"11px",color:t.color,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:700}}>{t.short}</span><div style={{display:"flex",gap:"8px",alignItems:"center"}}><div style={{width:"60px",height:"4px",background:"rgba(255,255,255,0.08)",borderRadius:"2px",overflow:"hidden"}}><div style={{height:"100%",width:`${t.pct}%`,background:t.color,borderRadius:"2px"}}/></div><span style={{fontSize:"11px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",width:"28px",textAlign:"right"}}>{t.pct}%</span></div></div>))}
          </>):(<div style={{fontSize:"12px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginTop:"8px"}}>Add initiatives in Portfolio tab</div>)}
        </div>
      </div>
      {/* Top 3 functions */}
      {complete&&topFns.length>0&&(<div style={{marginBottom:"16px",padding:"16px 20px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.18)`,borderRadius:"3px"}}>
        <FL>Top 3 Value Functions — Highest AI Impact for {profile.company||"Your Enterprise"}</FL>
        <div style={{display:"flex",gap:"10px",marginTop:"10px",flexWrap:"wrap"}}>
          {topFns.map((fn,i)=>{const r=rates[fn.id];const lo=(rev*r.rev.lo+cost*r.cost.lo+ebt*r.ebt.lo);const hi=(rev*r.rev.hi+cost*r.cost.hi+ebt*r.ebt.hi);return(<div key={fn.id} style={{flex:1,minWidth:"160px",padding:"12px 14px",background:i===0?"rgba(184,115,51,0.08)":"rgba(255,255,255,0.03)",border:`1px solid ${i===0?C.copper:"rgba(184,115,51,0.15)"}`,borderRadius:"3px"}}><div style={{fontSize:"9px",letterSpacing:"1.5px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"5px"}}>{i===0?"#1 PRIORITY":"#"+(i+1)+" PRIORITY"}</div><div style={{fontSize:"14px",fontWeight:700,color:C.ice,fontFamily:"'Trebuchet MS',sans-serif",marginBottom:"4px"}}>{fn.icon} {fn.label}</div><div style={{fontSize:"15px",fontWeight:700,color:C.copper,fontFamily:"'Georgia',serif"}}>{fmt(lo)} – {fmt(hi)}</div><div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic",marginTop:"2px"}}>estimated annual impact</div></div>);})}
        </div>
      </div>)}
      {/* Portfolio vs Potential gap */}
      {complete&&totBudget>0&&(<div style={{marginBottom:"16px",padding:"16px 20px",background:"rgba(255,255,255,0.03)",border:`1px solid rgba(184,115,51,0.18)`,borderRadius:"3px"}}>
        <FL>Investment vs Value Potential</FL>
        <div style={{display:"flex",gap:"16px",flexWrap:"wrap",marginTop:"8px",alignItems:"center"}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1px"}}>AI INVESTMENT</div><div style={{fontSize:"22px",fontWeight:700,color:C.copper,fontFamily:"'Georgia',serif"}}>{fmt(totBudget)}</div></div>
          <div style={{fontSize:"24px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>→</div>
          <div style={{textAlign:"center"}}><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1px"}}>VALUE POTENTIAL (LOW)</div><div style={{fontSize:"22px",fontWeight:700,color:C.greenL,fontFamily:"'Georgia',serif"}}>{fmt(scorecard.totL)}</div></div>
          <div style={{fontSize:"24px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>→</div>
          <div style={{textAlign:"center"}}><div style={{fontSize:"9px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1px"}}>VALUE POTENTIAL (HIGH)</div><div style={{fontSize:"22px",fontWeight:700,color:C.greenL,fontFamily:"'Georgia',serif"}}>{fmt(scorecard.totH)}</div></div>
          <div style={{flex:1,minWidth:"140px",padding:"10px 14px",background:"rgba(76,175,128,0.08)",border:`1px solid ${C.greenL}`,borderRadius:"3px",textAlign:"center"}}><div style={{fontSize:"9px",color:C.greenL,fontFamily:"'Trebuchet MS',sans-serif",letterSpacing:"1px",marginBottom:"3px"}}>INDICATIVE ROI RANGE</div><div style={{fontSize:"18px",fontWeight:700,color:C.greenL,fontFamily:"'Georgia',serif"}}>{totBudget>0?`${(scorecard.totL/totBudget).toFixed(1)}× – ${(scorecard.totH/totBudget).toFixed(1)}×`:"—"}</div></div>
        </div>
      </div>)}
      {/* Mirror */}
      <Mirror sub="This is the board view. Every number flows from your inputs. The gap between value potential and CM allocation is the conversation that needs to happen. — Craig Horton"/>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App(){
  const[tab,setTab]=useState(0);
  const[initiatives,setInitiatives]=useState([]);
  const[profile,setProfile]=useState({company:"",revenue:"",costBase:"",ebitda:"",industry:"universal"});
  const[overrides,setOverrides]=useState({});
  const rates=useMemo(()=>effectiveRates(profile.industry||"universal",overrides),[profile.industry,overrides]);
  const totBudget=initiatives.reduce((s,i)=>s+parseNum(i.budget),0);
  const totCM=initiatives.reduce((s,i)=>s+parseNum(i.cmBudget),0);
  const cmAlert=initiatives.length>0&&totBudget>0&&totCM/totBudget<0.10;
  const profileComplete=profile.revenue&&profile.costBase&&profile.ebitda;
  const pilotAlert=initiatives.some(i=>{const ps=pilotScore(i.pilotAnswers);return ps&&ps.score<2;});
  const TABS=[
    {label:"◈  BVF",long:"AI Business Value Framework"},
    {label:"⬡  Portfolio",long:"AI Investment Portfolio"},
    {label:"◉  CM Health",long:"Change Management Health"},
    {label:"⚖  Regulatory",long:"Regulatory Readiness"},
    {label:"◬  Alignment Map",long:"AI Alignment Map"},
  ];
  return(
    <div style={{fontFamily:"'Georgia','Palatino Linotype',serif",background:`linear-gradient(160deg,${C.navy} 0%,#0A1628 100%)`,minHeight:"100vh",color:C.white}}>
      <div style={{padding:"24px 48px 16px",borderBottom:`1px solid rgba(184,115,51,0.15)`,background:`radial-gradient(ellipse at 80% 0%,rgba(184,115,51,0.1) 0%,transparent 60%)`}}>
        <div style={{fontSize:"9px",letterSpacing:"4px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif",fontWeight:600,marginBottom:"6px"}}>CRAIG HORTON · AI BUSINESS VALUE FRAMEWORK · 2026</div>
        <h1 style={{fontSize:"24px",fontWeight:700,margin:"0 0 3px",letterSpacing:"-0.5px"}}>AI Business Value Framework</h1>
        <p style={{margin:0,fontSize:"12px",color:C.slate,fontFamily:"'Trebuchet MS',sans-serif",fontStyle:"italic"}}>North to South · East to West — Every AI investment mapped to the metrics that matter</p>
      </div>
      <ProfileBanner profile={profile} setProfile={setProfile} rates={rates} overrides={overrides} setOverrides={setOverrides}/>
      <div style={{padding:"0 48px",borderBottom:`1px solid rgba(184,115,51,0.15)`,display:"flex",gap:0,overflowX:"auto"}}>
        {TABS.map((t,i)=>(<button key={i} onClick={()=>setTab(i)} style={{padding:"12px 18px",background:"transparent",border:"none",borderBottom:tab===i?`2px solid ${C.copper}`:"2px solid transparent",color:tab===i?C.copper:C.muted,fontSize:"12px",fontFamily:"'Trebuchet MS',sans-serif",fontWeight:tab===i?700:400,cursor:"pointer",letterSpacing:"0.5px",display:"flex",alignItems:"center",gap:"5px",whiteSpace:"nowrap"}}>
          {t.label}
          {i===2&&cmAlert&&<span style={{width:"6px",height:"6px",borderRadius:"50%",background:C.redL,boxShadow:`0 0 4px ${C.redL}`}}/>}
          {i===1&&pilotAlert&&<span style={{width:"6px",height:"6px",borderRadius:"50%",background:C.amberL}}/>}
          {i===0&&!profileComplete&&<span style={{fontSize:"9px",color:C.amberL,fontStyle:"italic"}}>↑ profile</span>}
        </button>))}
      </div>
      <div style={{padding:"32px 48px 56px"}}>
        {tab===0&&<BVFTab profile={profile} rates={rates}/>}
        {tab===1&&<PortfolioTab profile={profile} initiatives={initiatives} setInitiatives={setInitiatives}/>}
        {tab===2&&<CMTab profile={profile} initiatives={initiatives}/>}
        {tab===3&&<RegulatoryTab profile={profile}/>}
        {tab===4&&<AlignmentTab profile={profile} initiatives={initiatives} rates={rates}/>}
      </div>
      <div style={{padding:"12px 48px",borderTop:`1px solid rgba(184,115,51,0.1)`,display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:"8px"}}>
        <div style={{fontSize:"10px",color:C.muted,fontFamily:"'Trebuchet MS',sans-serif"}}>AI BVF v5 · Craig Horton · 2026 · McKinsey · Gartner · Forrester · Deloitte · Prosci benchmarks</div>
        <div style={{fontSize:"10px",color:C.copper,fontFamily:"'Trebuchet MS',sans-serif"}}>craigmds1@gmail.com · linkedin.com/in/Craig-Horton-7a27128</div>
      </div>
    </div>
  );
}
