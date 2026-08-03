// ============================================================
// simulationEngine.js
// المحرك الحسابي: يطبّق القرارات، يحسب الترابطات، ويُشغّل الجولات
// ============================================================

// ---------- أدوات مساعدة عامة ----------

/** يُبقي أي قيمة بين حد أدنى وأقصى (عادة 0-100) */
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

/** يُطبّق تغييراً تدريجياً بدل قفزة حادة، لواقعية أكبر */
function applyGradualChange(current, target, speed = 0.3) {
  return current + (target - current) * speed;
}

// ---------- حسابات القيم المشتقة (Derived Values) ----------

/**
 * يُعيد حساب كل القيم المشتقة (التي لا تُدخل مباشرة بل تُحسب من غيرها)
 * يجب استدعاؤها بعد أي تعديل على الحالة
 */
function recalculateDerivedValues(state) {
  const eco = state.economy;

  // نسبة الدين إلى الناتج المحلي
  eco.debtToGdpRatio = +((eco.publicDebt / eco.gdp) * 100).toFixed(2);

  // عجز/فائض الميزانية
  eco.budget.deficit = eco.budget.expenditure - eco.budget.revenue;

  // الميزان التجاري
  eco.foreignTrade.tradeBalance = eco.foreignTrade.exports - eco.foreignTrade.imports;

  // القوة العسكرية الإجمالية (مؤشر مركّب من كل الأفرع)
  const mil = state.military;
  mil.overallMilitaryPower = Math.round(
    (mil.landForces.strength * 0.3) +
    (mil.airForces.strength * 0.25) +
    (mil.navalForces.strength * 0.2) +
    (mil.airDefense.strength * 0.15) +
    (mil.militaryIntelligence.strength * 0.1)
  );

  // التصنيف الائتماني المبسط بناءً على الدين والتضخم والاحتياطي
  eco.creditRating = computeCreditRating(eco);

  return state;
}

function computeCreditRating(eco) {
  let score = 100;
  score -= eco.debtToGdpRatio * 0.5;
  score -= eco.inflationRate * 2;
  score += (eco.currencyReserves / eco.gdp) * 100 * 0.3;

  if (score >= 85) return 'AAA';
  if (score >= 70) return 'AA';
  if (score >= 55) return 'A';
  if (score >= 40) return 'BBB';
  if (score >= 25) return 'BB';
  if (score >= 10) return 'B';
  return 'CCC';
}

// ---------- محرك تأثير القرارات (Decision Impact Engine) ----------

/**
 * كل قرار مُعرَّف كـ "تأثيرات" على حقول محددة من الحالة.
 * هذا يسمح بإضافة قرارات جديدة بسهولة دون تعديل المحرك نفسه.
 *
 * مثال بنية القرار:
 * {
 *   id: 'raise_taxes',
 *   label: 'رفع الضرائب',
 *   category: 'economy',
 *   effects: [
 *     { path: 'economy.taxRate', delta: +5 },
 *     { path: 'economy.budget.revenue', deltaPercent: +8 },
 *     { path: 'societySegments.businessOwners.satisfaction', delta: -12 },
 *     { path: 'societySegments.workers.satisfaction', delta: -6 },
 *     { path: 'indicators.presidentPopularity', delta: -4 },
 *   ]
 * }
 */
function applyDecision(state, decision) {
  decision.effects.forEach(effect => {
    const currentValue = getValueByPath(state, effect.path);
    let newValue;

    if (typeof effect.delta === 'number') {
      newValue = currentValue + effect.delta;
    } else if (typeof effect.deltaPercent === 'number') {
      newValue = currentValue * (1 + effect.deltaPercent / 100);
    } else if (typeof effect.setValue !== 'undefined') {
      newValue = effect.setValue;
    } else {
      return;
    }

    // القيم من نوع "مؤشر" (0-100) تُقيَّد تلقائياً
    if (effect.path.includes('satisfaction') ||
        effect.path.includes('indicators.') ||
        effect.path.includes('.strength') ||
        effect.path.includes('equipmentLevel')) {
      newValue = clamp(newValue, 0, 100);
    }

    setValueByPath(state, effect.path, newValue);
  });

  // تسجيل القرار في السجل التاريخي
  state.history.decisionsLog.push({
    turn: state.meta.turnCount,
    decisionId: decision.id,
    label: decision.label,
    date: state.meta.simulationDate,
  });

  // تطبيق التأثيرات المترابطة غير المباشرة (Second-order effects)
  applySecondOrderEffects(state, decision);

  recalculateDerivedValues(state);
  return state;
}

/**
 * تأثيرات غير مباشرة لا تُذكر صراحة في كل قرار، بل تُشتق تلقائياً
 * من نوع القرار وفئته — تضمن الترابط الواقعي بين الأنظمة
 */
function applySecondOrderEffects(state, decision) {
  const eco = state.economy;
  const ind = state.indicators;

  // الفساد المرتفع يُبطئ النمو الاقتصادي ويُضعف الثقة الاستثمارية تلقائياً
  if (ind.corruptionIndex > 60) {
    eco.investmentLevel = clamp(eco.investmentLevel - 1, 0, 100);
  }

  // التضخم المرتفع جداً يضغط تلقائياً على رضا كل الفئات محدودة الدخل
  if (eco.inflationRate > 15) {
    state.societySegments.workers.satisfaction = clamp(state.societySegments.workers.satisfaction - 2);
    state.societySegments.retirees.satisfaction = clamp(state.societySegments.retirees.satisfaction - 2);
  }

  // البطالة المرتفعة تزيد الجريمة تلقائياً
  if (state.population.unemploymentRate > 20) {
    ind.crimeRate = clamp(ind.crimeRate + 1);
  }

  // شعبية الرئيس تتأثر تلقائياً بمتوسط رضا كل الفئات المجتمعية (موزون بحجم كل فئة)
  ind.presidentPopularity = clamp(computeWeightedPopularity(state));
}

function computeWeightedPopularity(state) {
  const segments = state.societySegments;
  let totalWeight = 0;
  let weightedSum = 0;

  Object.values(segments).forEach(seg => {
    weightedSum += seg.satisfaction * seg.populationShare;
    totalWeight += seg.populationShare;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 50;
}

// ---------- محرك الجولة الزمنية (Turn / Tick Engine) ----------

/**
 * يُشغّل جولة زمنية واحدة (مثلاً: شهر واحد داخل المحاكاة)
 * يُطبّق التطور الطبيعي للمؤشرات + يفحص احتمالات الأحداث الميكانيكية
 */
function runSimulationTurn(state, options = {}) {
  state.meta.turnCount += 1;
  state.meta.simulationDate = advanceDate(state.meta.simulationDate, options.turnLengthDays || 30);

  applyNaturalEconomicDrift(state);
  applyNaturalSocialDrift(state);
  const triggeredEvents = checkMechanicalEventTriggers(state);

  recalculateDerivedValues(state);
  saveTurnSnapshot(state);

  return { state, triggeredEvents };
}

/** التطور الطبيعي للاقتصاد دون تدخل اللاعب (نمو، تضخم تراكمي...) */
function applyNaturalEconomicDrift(state) {
  const eco = state.economy;

  eco.gdp *= (1 + eco.gdpGrowthRate / 100 / 12); // نمو شهري تقريبي
  eco.publicDebt += eco.budget.deficit / 12;
  eco.inflationRate = applyGradualChange(eco.inflationRate, computeTargetInflation(state), 0.15);
  state.population.unemploymentRate = applyGradualChange(
    state.population.unemploymentRate,
    computeTargetUnemployment(state),
    0.1
  );
}

function computeTargetInflation(state) {
  // تضخم مستهدف يرتفع مع زيادة عرض النقد الضمني (تبسيط: يرتبط بعجز الميزانية والدين)
  const debtPressure = state.economy.debtToGdpRatio > 80 ? 3 : 0;
  return 3 + debtPressure;
}

function computeTargetUnemployment(state) {
  const investment = state.economy.investmentLevel;
  return clamp(20 - (investment / 100) * 10, 3, 30);
}

/** التطور الطبيعي لرضا المجتمع بمرور الوقت دون قرارات (تلاشي التأثيرات القديمة تدريجياً نحو التوازن) */
function applyNaturalSocialDrift(state) {
  Object.values(state.societySegments).forEach(seg => {
    seg.satisfaction = applyGradualChange(seg.satisfaction, 50, 0.03); // ميل بطيء نحو الحياد
  });
}

/**
 * فحص احتمالات وقوع أحداث "ميكانيكية" (غير مولّدة بالـ AI بعد — سيُستبدل/يُدمج
 * لاحقاً بمحرك الذكاء الاصطناعي الذي يضيف السياق والسرد لهذه الأحداث)
 */
function checkMechanicalEventTriggers(state) {
  const triggered = [];

  // احتجاجات: تُحتمل عند انخفاض الشعبية وارتفاع البطالة معاً
  if (state.indicators.presidentPopularity < 30 && state.population.unemploymentRate > 18) {
    if (Math.random() < 0.35) triggered.push({ type: 'protests', severity: 'medium' });
  }

  // أزمة اقتصادية: تُحتمل عند تضخم مرتفع جداً + دين مرتفع جداً معاً
  if (state.economy.inflationRate > 20 && state.economy.debtToGdpRatio > 100) {
    if (Math.random() < 0.2) triggered.push({ type: 'economic_crisis', severity: 'high' });
  }

  // كارثة طبيعية: احتمال أساسي ثابت صغير كل جولة (يمكن ربطه بالمناخ لاحقاً)
  if (Math.random() < 0.05) {
    const disasters = ['flood', 'earthquake', 'wildfire'];
    triggered.push({ type: disasters[Math.floor(Math.random() * disasters.length)], severity: 'random' });
  }

  triggered.forEach(evt => {
    state.history.eventsLog.push({ turn: state.meta.turnCount, ...evt, date: state.meta.simulationDate });
  });

  return triggered;
}

/** يحفظ لقطة من أهم المؤشرات لهذه الجولة (لرسم بياني عبر الزمن في الواجهة لاحقاً) */
function saveTurnSnapshot(state) {
  state.history.turnSnapshots.push({
    turn: state.meta.turnCount,
    date: state.meta.simulationDate,
    gdp: state.economy.gdp,
    inflation: state.economy.inflationRate,
    unemployment: state.population.unemploymentRate,
    popularity: state.indicators.presidentPopularity,
    security: state.indicators.security,
    corruption: state.indicators.corruptionIndex,
  });
}

function advanceDate(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------- أدوات الوصول للمسارات المتداخلة (path-based get/set) ----------

function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setValueByPath(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((acc, key) => acc[key], obj);
  target[lastKey] = typeof value === 'number' ? +value.toFixed(4) : value;
}

// ============================================================
module.exports = {
  applyDecision,
  runSimulationTurn,
  recalculateDerivedValues,
  computeWeightedPopularity,
  clamp,
};
