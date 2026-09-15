import { useEffect, useMemo, useState } from "react";
import { BarChart3, Bike, Bot, CarFront, Check, ChevronRight, CircleHelp, Cloud, CloudSun, Leaf, LogIn, Menu, Plane, RefreshCw, Save, Sparkles, Target, TrainFront, TrendingDown, Utensils, Zap } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { calculateTotalEmissions, defaultCarbonInputs, type CarbonInputs, type CarbonResult, type CommuteMode, type DietType, type Level } from "@shared/carbon";

const CATEGORY_META = {
  transport: { label: "Transport", color: "#4c8c78", icon: CarFront, tint: "bg-[#e6f1ed] text-[#2e705c]" },
  electricity: { label: "Electricity", color: "#e5a84b", icon: Zap, tint: "bg-[#fff3dc] text-[#a86d16]" },
  diet: { label: "Diet", color: "#d77a5b", icon: Utensils, tint: "bg-[#fbe8e1] text-[#a84e34]" },
  lifestyle: { label: "Lifestyle", color: "#8b7bb8", icon: CloudSun, tint: "bg-[#eeeafa] text-[#66599a]" },
} as const;

type HistoryPoint = { date: string; totalKg: number };
type Recommendation = { title: string; detail: string; reduction: number };

const modeOptions: { value: CommuteMode; label: string; icon: typeof CarFront }[] = [
  { value: "car", label: "Car / cab", icon: CarFront },
  { value: "metro", label: "Metro / train", icon: TrainFront },
  { value: "bus", label: "Bus", icon: Cloud },
  { value: "bike", label: "Motorbike", icon: Bike },
  { value: "walk", label: "Walk / cycle", icon: Bike },
];

const dietOptions: { value: DietType; label: string; description: string }[] = [
  { value: "meat-heavy", label: "Meat-heavy", description: "Meat most days" },
  { value: "mixed", label: "Mixed", description: "A bit of everything" },
  { value: "vegetarian", label: "Vegetarian", description: "No meat" },
  { value: "vegan", label: "Plant-based", description: "Mostly plants" },
];

function formatKg(value: number) {
  return new Intl.NumberFormat("en-IN").format(Math.round(value));
}

function FootprintRing({ result }: { result: CarbonResult }) {
  const data = Object.entries(CATEGORY_META).map(([key, meta]) => ({ name: meta.label, value: result[key as keyof typeof CATEGORY_META], color: meta.color }));
  return (
    <div className="relative h-[230px] w-[230px] shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={76} outerRadius={106} paddingAngle={3} stroke="none" startAngle={90} endAngle={-270}>
            {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <Tooltip formatter={(value) => [`${formatKg(Number(value))} kg`, "CO₂e"]} contentStyle={{ borderRadius: 12, border: "1px solid #dce7e0", boxShadow: "0 8px 24px rgba(30,60,45,.12)" }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[29px] font-semibold tracking-[-0.06em] text-[#1d3b31]">{result.totalTonnes}</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#759087]">tonnes / year</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [inputs, setInputs] = useState<CarbonInputs>(defaultCarbonInputs);
  const [result, setResult] = useState<CarbonResult>(() => calculateTotalEmissions(defaultCarbonInputs));
  const [isCalculatorOpen, setCalculatorOpen] = useState(true);
  const [isWhatIf, setWhatIf] = useState(false);
  const [goalPercent, setGoalPercent] = useState(20);
  const [goalSaved, setGoalSaved] = useState(false);
  const [localHistory, setLocalHistory] = useState<HistoryPoint[]>(() => {
    try { return JSON.parse(localStorage.getItem("ecotrack-history") || "[]"); } catch { return []; }
  });
  const recommendations = trpc.carbon.recommend.useMutation();
  const saveCalculation = trpc.carbon.save.useMutation();
  const saveGoal = trpc.carbon.saveGoal.useMutation();
  const serverHistory = trpc.carbon.history.useQuery(undefined, { enabled: !!user });

  const displayRecommendations: Recommendation[] = (recommendations.data?.recommendations as Recommendation[] | undefined) ?? [
    { title: "Make one commute switch", detail: "Replace one weekly car trip with metro or bus. At your current distance, this is the fastest way to unlock a meaningful reduction.", reduction: 182 },
    { title: "Try two plant-forward days", detail: "Swap two meat-heavy meals each week for dal, rajma, paneer or seasonal vegetables. Keep the change practical and affordable.", reduction: 140 },
    { title: "Cool smarter", detail: "Set AC temperature to 24°C, clean filters monthly, and use a timer. Small habits can trim electricity without changing comfort.", reduction: 96 },
  ];

  const whatIfInputs = useMemo(() => ({ ...inputs, commuteMode: "metro" as CommuteMode, diet: "vegetarian" as DietType }), [inputs]);
  const whatIfResult = useMemo(() => calculateTotalEmissions(whatIfInputs), [whatIfInputs]);
  const potentialReduction = result.totalKg - whatIfResult.totalKg;
  const goalTarget = Math.round(result.totalKg * (1 - goalPercent / 100));
  const history = useMemo(() => {
    const dbHistory = (serverHistory.data ?? []).map((item) => ({ date: new Date(item.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" }), totalKg: item.totalKg }));
    return [...dbHistory, ...localHistory].slice(0, 6);
  }, [localHistory, serverHistory.data]);

  useEffect(() => {
    if (!recommendations.data && !recommendations.isPending) recommendations.mutate(inputs);
  }, []);

  function updateInput<K extends keyof CarbonInputs>(key: K, value: CarbonInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function handleCalculate() {
    const nextResult = calculateTotalEmissions(inputs);
    setResult(nextResult);
    const nextHistory = [{ date: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric" }), totalKg: nextResult.totalKg }, ...localHistory].slice(0, 6);
    setLocalHistory(nextHistory);
    localStorage.setItem("ecotrack-history", JSON.stringify(nextHistory));
    recommendations.mutate(inputs);
    if (user) saveCalculation.mutate({ inputs, result: nextResult });
    toast.success("Footprint recalculated", { description: "Your dashboard has been refreshed with the latest estimate." });
    document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSaveGoal() {
    setGoalSaved(true);
    if (user) saveGoal.mutate({ baselineKg: result.totalKg, targetKg: goalTarget, targetDate: "2026-12-31" });
    toast.success("Goal saved", { description: `You are aiming for ${formatKg(goalTarget)} kg CO₂e per year.` });
  }

  const reductionPercent = Math.round((result.totalKg / result.benchmarkKg) * 100);
  const impactCopy = result.highestImpact === "transport" ? "transport" : result.highestImpact === "electricity" ? "electricity use" : result.highestImpact;

  return (
    <div className="min-h-screen bg-[#f6f8f5] text-[#1d3b31]">
      <header className="sticky top-0 z-30 border-b border-[#e2ebe4]/90 bg-[#f6f8f5]/95 backdrop-blur-md">
        <div className="mx-auto flex h-[74px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
          <a href="#top" className="flex items-center gap-3" aria-label="EcoTrack home">
            <div className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#1d3b31] text-[#d5f078]"><Leaf size={19} strokeWidth={2.5} /></div>
            <div className="leading-none"><div className="font-serif text-[21px] font-semibold tracking-[-0.04em]">EcoTrack</div><div className="mt-1 text-[9px] font-bold uppercase tracking-[0.2em] text-[#7b9489]">personal climate action</div></div>
          </a>
          <nav className="hidden items-center gap-8 text-[13px] font-semibold text-[#6c8279] md:flex">
            <a href="#calculator" className="transition-colors hover:text-[#1d3b31]">Calculator</a>
            <a href="#results" className="transition-colors hover:text-[#1d3b31]">My footprint</a>
            <a href="#actions" className="transition-colors hover:text-[#1d3b31]">Actions</a>
          </nav>
          <div className="flex items-center gap-3">
            {user ? <span className="hidden text-[12px] font-semibold text-[#6c8279] sm:inline">Hi, {user.name?.split(" ")[0] || "there"}</span> : <button onClick={() => startLogin()} className="hidden items-center gap-2 rounded-full border border-[#cfddd4] px-4 py-2 text-[12px] font-bold text-[#45675a] transition hover:bg-white sm:flex"><LogIn size={14} /> Sign in to save</button>}
            <button onClick={() => setCalculatorOpen((open) => !open)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#527265] shadow-[0_3px_12px_rgba(30,60,45,.06)] md:hidden" aria-label="Toggle menu"><Menu size={18} /></button>
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1440px] px-5 pb-20 lg:px-10">
        <section className="grid items-center gap-8 py-10 md:grid-cols-[1.1fr_.9fr] md:py-16 lg:gap-20 lg:py-20">
          <div className="max-w-[650px]">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cfe2d6] bg-[#edf6ef] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#3d7b63]"><span className="h-1.5 w-1.5 rounded-full bg-[#82bd6c]" /> SDG 13 · climate action</div>
            <h1 className="font-serif text-[clamp(42px,6vw,80px)] font-semibold leading-[.93] tracking-[-0.055em] text-[#1d3b31]">Understand your footprint.<br /><span className="text-[#6caa7a]">Change what matters.</span></h1>
            <p className="mt-7 max-w-[510px] text-[16px] leading-7 text-[#6c8279]">A clearer way to measure the everyday emissions behind your commute, home, plate and purchases — then turn insight into one practical next step.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3"><a href="#calculator" className="group inline-flex items-center gap-2 rounded-full bg-[#1d3b31] px-5 py-3.5 text-[13px] font-bold text-white shadow-[0_8px_20px_rgba(29,59,49,.16)] transition hover:-translate-y-0.5 hover:bg-[#2e5848]">Calculate my footprint <ChevronRight size={16} className="transition group-hover:translate-x-0.5" /></a><a href="#results" className="inline-flex items-center gap-2 rounded-full border border-[#ccdbd2] bg-transparent px-5 py-3.5 text-[13px] font-bold text-[#527265] transition hover:bg-white"><BarChart3 size={15} /> View dashboard</a></div>
            <div className="mt-10 flex items-center gap-4 text-[11px] font-medium text-[#81958c]"><div className="flex -space-x-2"><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#f6f8f5] bg-[#e6f1ed] text-[#4c8c78]">♻</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#f6f8f5] bg-[#fff3dc] text-[#a86d16]">✦</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#f6f8f5] bg-[#eeeafa] text-[#66599a]">↗</span></div><span>Built for everyday choices in India<br /><span className="text-[#527265]">Approximate by design, useful by default.</span></span></div>
          </div>
          <div className="relative min-h-[330px] overflow-hidden rounded-[28px] bg-[#dcecdf] p-7 shadow-[0_20px_70px_rgba(54,103,72,.12)] lg:min-h-[410px] lg:p-10"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-[#bfdcbf]/65" /><div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full border-[34px] border-[#f5e6be]/70" /><div className="relative flex h-full min-h-[275px] flex-col justify-between"><div className="flex items-start justify-between"><div><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#5f8871]">Your climate, decoded</span><p className="mt-3 max-w-[210px] font-serif text-[26px] font-semibold leading-tight text-[#275340]">Small shifts add up.</p></div><span className="rounded-full bg-white/70 px-3 py-1.5 text-[10px] font-bold text-[#5f8871]">01 — 04</span></div><div className="relative mt-8 flex items-end justify-center gap-2"><div className="h-20 w-10 rounded-t-full bg-[#8bbd83]" /><div className="h-32 w-14 rounded-t-full bg-[#4c8c78]" /><div className="h-24 w-12 rounded-t-full bg-[#6ea674]" /><div className="h-44 w-16 rounded-t-full bg-[#2e705c]" /><div className="absolute bottom-0 h-1 w-[240px] rounded-full bg-[#78a77b]/40" /></div><div className="flex items-center justify-between text-[10px] font-semibold text-[#5f8871]"><span>Measure</span><span>Prioritise</span><span>Act</span></div></div></div>
        </section>

        <section id="calculator" className="scroll-mt-24 rounded-[28px] border border-[#dce8df] bg-white p-5 shadow-[0_10px_35px_rgba(30,60,45,.05)] md:p-8 lg:p-10">
          <div className="flex flex-col justify-between gap-4 border-b border-[#e6eee8] pb-6 md:flex-row md:items-end"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a9488]"><span className="text-[#6caa7a]">01</span> · tell us about your year</div><h2 className="font-serif text-[32px] font-semibold tracking-[-0.04em] text-[#1d3b31]">Your everyday inputs</h2></div><p className="max-w-[290px] text-right text-[12px] leading-5 text-[#8a9d94]">The more honest the input, the more useful the estimate. No judgement, just a starting point.</p></div>
          <div className={`${isCalculatorOpen ? "grid" : "hidden"} mt-7 gap-8 lg:grid-cols-2`}>
            <div className="space-y-7">
              <FieldLabel icon={<CarFront size={15} />} title="How do you usually commute?" helper="Choose your most common mode"><div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{modeOptions.map(({ value, label, icon: Icon }) => <button key={value} onClick={() => updateInput("commuteMode", value)} className={`flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-[13px] border text-[11px] font-bold transition ${inputs.commuteMode === value ? "border-[#7eae8c] bg-[#edf6ef] text-[#2e705c] shadow-[inset_0_0_0_1px_#7eae8c]" : "border-[#e4ece6] text-[#80948b] hover:border-[#b9d3c2] hover:bg-[#f7faf7]"}`}><Icon size={17} /><span>{label}</span></button>)}</div></FieldLabel>
              <FieldLabel title="Weekly commute distance" helper="Round trip, across a typical week"><RangeInput value={inputs.commuteKmPerWeek} min={0} max={300} suffix="km" onChange={(value) => updateInput("commuteKmPerWeek", value)} /></FieldLabel>
              <FieldLabel title="Flights in a year" icon={<Plane size={15} />} helper="Total hours in the air"><RangeInput value={inputs.flightHoursPerYear} min={0} max={60} suffix="hrs" onChange={(value) => updateInput("flightHoursPerYear", value)} /></FieldLabel>
              <FieldLabel title="Home electricity" icon={<Zap size={15} />} helper="Approximate monthly usage"><RangeInput value={inputs.electricityKwhPerMonth} min={20} max={500} suffix="kWh / mo" onChange={(value) => updateInput("electricityKwhPerMonth", value)} /></FieldLabel>
            </div>
            <div className="space-y-7">
              <FieldLabel title="How would you describe your diet?" icon={<Utensils size={15} />} helper="There is no perfect answer"><div className="grid grid-cols-2 gap-2">{dietOptions.map((option) => <button key={option.value} onClick={() => updateInput("diet", option.value)} className={`rounded-[13px] border px-3 py-3 text-left transition ${inputs.diet === option.value ? "border-[#7eae8c] bg-[#edf6ef] shadow-[inset_0_0_0_1px_#7eae8c]" : "border-[#e4ece6] hover:border-[#b9d3c2]"}`}><div className="text-[12px] font-bold text-[#38594d]">{option.label}</div><div className="mt-1 text-[10px] text-[#8a9d94]">{option.description}</div></button>)}</div></FieldLabel>
              <FieldLabel title="Shopping & new stuff" helper="Clothes, electronics, non-essentials"><Segmented value={inputs.shopping} options={["low", "medium", "high"]} labels={["Light", "Average", "Frequent"]} onChange={(value) => updateInput("shopping", value as Level)} /></FieldLabel>
              <FieldLabel title="Waste habits" helper="How much gets reused, sorted or composted?"><Segmented value={inputs.waste} options={["low", "medium", "high"]} labels={["Thoughtful", "Mixed", "Mostly bin"]} onChange={(value) => updateInput("waste", value as Level)} /></FieldLabel>
              <div className="flex flex-col items-start justify-between gap-4 rounded-[16px] bg-[#f5f8f4] p-4 sm:flex-row sm:items-center"><div className="flex gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#6caa7a]"><CircleHelp size={17} /></div><div><div className="text-[12px] font-bold text-[#38594d]">Why do we ask this?</div><div className="mt-1 max-w-[280px] text-[10px] leading-4 text-[#82968d]">These inputs use publicly available averages for India. Your result is a directional estimate, not a verdict.</div></div></div><button onClick={handleCalculate} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#6caa7a] px-4 py-2.5 text-[12px] font-bold text-white shadow-sm transition hover:bg-[#4c8c78]"><RefreshCw size={14} /> Calculate</button></div>
            </div>
          </div>
          <button onClick={() => setCalculatorOpen((open) => !open)} className="mt-6 flex w-full justify-center border-t border-[#e6eee8] pt-4 text-[11px] font-bold uppercase tracking-[0.15em] text-[#87a095] hover:text-[#4c8c78]">{isCalculatorOpen ? "Collapse inputs" : "Edit inputs"}</button>
        </section>

        <section id="results" className="scroll-mt-24 pt-16 lg:pt-20"><div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#7a9488]"><span className="text-[#6caa7a]">02</span> · your footprint at a glance</div><h2 className="font-serif text-[36px] font-semibold tracking-[-0.045em]">The picture, in numbers.</h2></div><div className="flex items-center gap-2 rounded-full bg-[#eef6ed] px-3 py-2 text-[11px] font-bold text-[#527f5e]"><TrendingDown size={14} /> {reductionPercent > 100 ? "Above" : "Within"} the national per-person benchmark</div></div>
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr_1fr]">
            <div className="relative overflow-hidden rounded-[24px] bg-[#1d3b31] p-7 text-white shadow-[0_12px_30px_rgba(29,59,49,.14)]"><div className="absolute -right-8 -top-10 h-32 w-32 rounded-full border-[18px] border-[#2e5848]" /><div className="relative"><div className="flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#a7c3b5]">Estimated annual footprint</span><span className="rounded-full bg-[#d5f078] px-2.5 py-1 text-[10px] font-bold text-[#254537]">approx.</span></div><div className="mt-6 flex items-end gap-2"><span className="font-mono text-[60px] font-semibold leading-none tracking-[-0.08em] text-[#f8fbf2]">{formatKg(result.totalKg)}</span><span className="mb-1.5 text-[13px] text-[#afc6b8]">kg CO₂e</span></div><div className="mt-3 flex items-center gap-2 text-[11px] text-[#a7c3b5]"><span className="h-1.5 w-1.5 rounded-full bg-[#d5f078]" /> India average is around 2,900 kg / year</div><div className="mt-7 h-px bg-white/10" /><div className="mt-5 flex items-center justify-between text-[11px]"><span className="text-[#a7c3b5]">Your largest lever</span><span className="font-bold text-[#f8fbf2]">{CATEGORY_META[result.highestImpact].label} · {result.percentage[result.highestImpact]}%</span></div></div></div>
            <div className="flex items-center justify-center rounded-[24px] border border-[#dce8df] bg-white p-4"><FootprintRing result={result} /></div>
            <div className="rounded-[24px] border border-[#dce8df] bg-white p-6"><div className="flex items-center justify-between"><h3 className="font-serif text-[20px] font-semibold">Where it comes from</h3><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#9aaa9f]">kg CO₂e</span></div><div className="mt-5 space-y-4">{(Object.keys(CATEGORY_META) as (keyof typeof CATEGORY_META)[]).map((key) => { const meta = CATEGORY_META[key]; const Icon = meta.icon; return <div key={key}><div className="flex items-center justify-between text-[12px]"><span className="flex items-center gap-2 font-semibold text-[#547166]"><span className={`grid h-6 w-6 place-items-center rounded-md ${meta.tint}`}><Icon size={13} /></span>{meta.label}</span><span className="font-mono font-semibold text-[#38594d]">{formatKg(result[key])}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf2ee]"><div className="h-full rounded-full" style={{ width: `${result.percentage[key]}%`, background: meta.color }} /></div></div> })}</div></div>
          </div>
          <div className="mt-5 flex flex-col items-start justify-between gap-5 rounded-[22px] border border-[#dce8df] bg-[#f0f7ef] p-5 sm:flex-row sm:items-center sm:p-6"><div className="flex gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#6caa7a]"><RefreshCw size={17} /></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[13px] font-bold text-[#38594d]">What if you changed two things?</h3><span className="rounded-full bg-[#dcecdf] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-[#4c8c78]">simulator</span></div><p className="mt-1 max-w-[520px] text-[11px] leading-5 text-[#728a80]">See the potential of swapping your commute to metro and choosing more plant-forward meals. This is a scenario, not a prediction.</p></div></div><div className="flex w-full shrink-0 items-center justify-between gap-4 sm:w-auto sm:justify-end"><div className="text-right"><div className="font-mono text-[22px] font-semibold tracking-[-0.06em] text-[#2e705c]">−{formatKg(potentialReduction)} kg</div><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7e9b89]">potential / year</div></div><button onClick={() => setWhatIf((value) => !value)} className={`rounded-full px-4 py-2.5 text-[11px] font-bold transition ${isWhatIf ? "bg-[#2e705c] text-white" : "bg-white text-[#527265]"}`}>{isWhatIf ? "Hide scenario" : "Show scenario"}</button></div></div>
          {isWhatIf && <div className="mt-3 grid gap-3 sm:grid-cols-3"><div className="rounded-[14px] bg-white p-4"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a9d94]">Current</div><div className="mt-1 font-mono text-[20px] font-semibold text-[#38594d]">{formatKg(result.totalKg)} kg</div></div><div className="rounded-[14px] bg-white p-4"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8a9d94]">Two swaps</div><div className="mt-1 font-mono text-[20px] font-semibold text-[#2e705c]">{formatKg(whatIfResult.totalKg)} kg</div></div><div className="rounded-[14px] bg-[#d5f078] p-4"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#547166]">That is</div><div className="mt-1 font-mono text-[20px] font-semibold text-[#2e5848]">{Math.round((potentialReduction / Math.max(result.totalKg, 1)) * 100)}% lighter</div></div></div>}
        </section>

        <section id="actions" className="scroll-mt-24 grid gap-5 pt-5 lg:grid-cols-[1.15fr_.85fr] lg:pt-6">
          <div className="rounded-[24px] border border-[#dce8df] bg-white p-7"><div className="flex items-start justify-between gap-5"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#7a9488]"><Sparkles size={14} className="text-[#d69b38]" /> your next best moves</div><h2 className="font-serif text-[29px] font-semibold tracking-[-0.04em]">Reduce what matters most.</h2></div><div className="hidden rounded-full bg-[#fff5df] px-3 py-1.5 text-[10px] font-bold text-[#a86d16] sm:block">AI climate coach</div></div><p className="mt-3 max-w-[590px] text-[13px] leading-6 text-[#728a80]">Based on your answers, <strong className="font-semibold text-[#45675a]">{impactCopy}</strong> is the highest-impact area. We turned that insight into actions that fit real life.</p><div className="mt-6 space-y-3">{displayRecommendations.map((item, index) => <div key={`${item.title}-${index}`} className="group flex gap-4 rounded-[16px] border border-[#edf1ed] p-4 transition hover:border-[#cfe2d6] hover:bg-[#fbfdfb]"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#edf6ef] font-serif text-[15px] font-semibold text-[#4c8c78]">{index + 1}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[13px] font-bold text-[#38594d]">{item.title}</h3><span className="rounded-full bg-[#edf6ef] px-2 py-1 text-[10px] font-bold text-[#4c8c78]">−{formatKg(item.reduction)} kg / yr</span></div><p className="mt-1.5 text-[11px] leading-5 text-[#82968d]">{item.detail}</p></div></div>)}</div>{recommendations.isPending && <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-[#7a9488]"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6caa7a]" /> Personalising your suggestions…</div>}</div>
          <div className="space-y-5"><div className="rounded-[24px] border border-[#dce8df] bg-[#edf6ef] p-7"><div className="flex items-start justify-between"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#5b896c]"><Target size={14} /> one-year goal</div><h2 className="font-serif text-[27px] font-semibold tracking-[-0.04em] text-[#2e5848]">Make it measurable.</h2></div><div className="grid h-10 w-10 place-items-center rounded-full bg-white/75 text-[#6caa7a]"><Target size={19} /></div></div><p className="mt-3 text-[12px] leading-5 text-[#668474]">Choose a reduction target. A smaller footprint is built one repeatable habit at a time.</p><div className="mt-6 flex items-end justify-between"><span className="font-mono text-[38px] font-semibold tracking-[-0.07em] text-[#2e5848]">{goalPercent}%</span><span className="mb-1 text-[11px] font-semibold text-[#668474]">reduction by Dec 2026</span></div><input type="range" min="5" max="50" step="5" value={goalPercent} onChange={(e) => { setGoalPercent(Number(e.target.value)); setGoalSaved(false); }} className="mt-3 w-full accent-[#4c8c78]" /><div className="mt-2 flex justify-between text-[10px] font-semibold text-[#7b9a89]"><span>gentle start</span><span>ambitious</span></div><div className="mt-5 flex items-center justify-between rounded-[14px] bg-white/65 px-4 py-3"><span className="text-[11px] font-semibold text-[#668474]">Target footprint</span><span className="font-mono text-[14px] font-bold text-[#2e5848]">{formatKg(goalTarget)} kg</span></div><button onClick={handleSaveGoal} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#2e5848] py-3 text-[12px] font-bold text-white transition hover:bg-[#1d3b31]">{goalSaved ? <><Check size={15} /> Goal saved</> : <><Save size={15} /> Save my goal</>}</button></div>
          <div className="rounded-[24px] border border-[#dce8df] bg-white p-6"><div className="flex items-center justify-between"><div><div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#8a9d94]">your progress</div><h3 className="mt-1 font-serif text-[21px] font-semibold">Footprint history</h3></div><span className="grid h-8 w-8 place-items-center rounded-full bg-[#f1f6f2] text-[#6caa7a]"><BarChart3 size={16} /></span></div>{history.length ? <div className="mt-5 space-y-2">{history.map((point, index) => <div key={`${point.date}-${index}`} className="flex items-center gap-3"><span className="w-14 text-[10px] font-semibold text-[#91a39b]">{point.date}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf2ee]"><div className="h-full rounded-full bg-[#78ad7b]" style={{ width: `${Math.min(100, (point.totalKg / Math.max(result.totalKg, 1)) * 100)}%` }} /></div><span className="w-14 text-right font-mono text-[11px] font-semibold text-[#527265]">{formatKg(point.totalKg)}</span></div>)}</div> : <div className="mt-5 rounded-[14px] bg-[#f7faf7] p-4 text-[11px] leading-5 text-[#82968d]">Your next calculation will appear here, so you can see the trend rather than chase a perfect number.</div>}<div className="mt-5 flex items-center gap-2 border-t border-[#edf2ee] pt-4 text-[10px] text-[#8a9d94]"><Check size={13} className="text-[#6caa7a]" /> {user ? "Synced to your account" : "Stored on this device"}</div></div></div>
        </section>
        <section className="mt-8 flex flex-col items-start justify-between gap-3 border-t border-[#dce8df] pt-6 text-[11px] text-[#8a9d94] sm:flex-row sm:items-center"><div className="flex items-center gap-2"><Leaf size={14} className="text-[#6caa7a]" /> <span>EcoTrack · estimates for action, not perfection.</span></div><div className="flex items-center gap-4"><a href="#calculator" className="hover:text-[#527265]">Recalculate</a><span>SDG 13 — Climate Action</span></div></section>
      </main>
    </div>
  );
}

function FieldLabel({ title, helper, icon, children }: { title: string; helper: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return <div><div className="mb-3 flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-[13px] font-bold text-[#38594d]">{icon && <span className="text-[#6caa7a]">{icon}</span>}{title}</div><div className="mt-1 text-[10px] text-[#91a39b]">{helper}</div></div></div>{children}</div>;
}

function RangeInput({ value, min, max, suffix, onChange }: { value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return <div className="rounded-[14px] border border-[#e4ece6] px-4 py-3"><div className="flex items-center justify-between"><span className="font-mono text-[18px] font-semibold text-[#38594d]">{value}</span><span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#91a39b]">{suffix}</span></div><input aria-label={suffix} type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-[#6caa7a]" /></div>;
}

function Segmented({ value, options, labels, onChange }: { value: string; options: string[]; labels: string[]; onChange: (value: string) => void }) {
  return <div className="grid grid-cols-3 gap-2">{options.map((option, index) => <button key={option} onClick={() => onChange(option)} className={`rounded-[13px] border px-2 py-3 text-center text-[11px] font-bold transition ${value === option ? "border-[#7eae8c] bg-[#edf6ef] text-[#2e705c] shadow-[inset_0_0_0_1px_#7eae8c]" : "border-[#e4ece6] text-[#80948b] hover:border-[#b9d3c2]"}`}>{labels[index]}</button>)}</div>;
}
