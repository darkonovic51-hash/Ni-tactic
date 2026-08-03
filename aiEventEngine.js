// ============================================================
// aiEventEngine.js
// يستدعي Claude API فعلياً لتوليد أحداث، ردود شخصيات، وقرارات
// بناءً على حالة الدولة الحالية (state من simulationEngine)
// ============================================================

// ---------- 1) بناء سياق مختصر عن حالة الدولة يُرسَل للذكاء الاصطناعي ----------

/**
 * يحوّل الحالة الكاملة (الضخمة) إلى ملخص نصي مضغوط يكفي الذكاء الاصطناعي
 * لفهم السياق دون إرسال آلاف الأسطر في كل طلب (توفير تكلفة + دقة أعلى)
 */
function buildStateContext(state) {
  const eco = state.economy;
  const ind = state.indicators;
  const pop = state.population;
  const mil = state.military;

  const recentDecisions = state.history.decisionsLog.slice(-5).map(d => d.label).join('، ') || 'لا يوجد';
  const recentEvents = state.history.eventsLog.slice(-5).map(e => e.type).join('، ') || 'لا يوجد';

  const lowSegments = Object.entries(state.societySegments)
    .filter(([, seg]) => seg.satisfaction < 35)
    .map(([name]) => name);

  return `
دولة: ${state.meta.name} | التاريخ داخل المحاكاة: ${state.meta.simulationDate} | الجولة رقم: ${state.meta.turnCount}
النظام السياسي: ${state.meta.politicalSystem}

الاقتصاد: الناتج المحلي ${Math.round(eco.gdp / 1e9)} مليار، نمو ${eco.gdpGrowthRate}%، تضخم ${eco.inflationRate.toFixed(1)}%، دين/ناتج ${eco.debtToGdpRatio}%، تصنيف ائتماني ${eco.creditRating}
البطالة: ${pop.unemploymentRate.toFixed(1)}%
المؤشرات: أمن ${ind.security}, فساد ${ind.corruptionIndex}, صحة ${ind.health}, تعليم ${ind.education}, بيئة ${ind.environmentIndex}, شعبية الرئيس ${Math.round(ind.presidentPopularity)}
القوة العسكرية الإجمالية: ${mil.overallMilitaryPower}/100
الفئات المجتمعية غير الراضية حالياً (أقل من 35): ${lowSegments.length ? lowSegments.join('، ') : 'لا يوجد'}

آخر 5 قرارات اتخذها الرئيس: ${recentDecisions}
آخر 5 أحداث وقعت: ${recentEvents}
`.trim();
}

// ---------- 2) الاستدعاء الأساسي لـ Claude API ----------

/**
 * دالة عامة لاستدعاء Claude مع فرض إخراج JSON فقط (بدون أي نص إضافي)
 * @param {string} systemPrompt - تعليمات الدور والسياق
 * @param {string} userPrompt - الطلب المحدد
 */
async function callClaudeForJSON(systemPrompt, userPrompt) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          { role: "user", content: `${systemPrompt}\n\n${userPrompt}\n\nأجب فقط بصيغة JSON صالحة، بدون أي نص أو شرح أو Markdown قبله أو بعده.` }
        ],
      })
    });

    const data = await response.json();
    const rawText = data.content
      .map(block => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n");

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("AI Event Engine error:", err);
    return null; // الفشل يُعالَج بالخارج (fallback ميكانيكي)
  }
}

// ---------- 3) توليد حدث ديناميكي كامل ----------

/**
 * يولّد حدثاً جديداً متوافقاً مع حالة الدولة الحالية، مع خيارات قرار
 * كل خيار يأتي بصيغة "effects" متوافقة مباشرة مع simulationEngine.applyDecision
 */
async function generateDynamicEvent(state, options = {}) {
  const context = buildStateContext(state);
  const forcedType = options.eventType ? `يجب أن يكون نوع الحدث تحديداً: ${options.eventType}.` : '';

  const systemPrompt = `
أنت محرك سردي لمحاكاة سياسية-اقتصادية-عسكرية واقعية جداً لقيادة دولة.
مهمتك: توليد حدث جديد واقعي ومترابط منطقياً مع حالة الدولة الحالية أدناه، وليس حدثاً عشوائياً منفصلاً عن السياق.
لا تكرر نفس نوع الأحداث الأخيرة إلا إذا كان منطقياً (مثال: لا تُصعّد لحرب مباشرة إذا كانت العلاقات مستقرة).
${forcedType}

حالة الدولة الحالية:
${context}
`.trim();

  const userPrompt = `
ولّد حدثاً واحداً بصيغة JSON بالضبط بهذا الشكل:
{
  "type": "protests | economic_crisis | natural_disaster | coup_attempt | corruption_scandal | diplomatic_crisis | terror_attack | oil_discovery | epidemic | election | other",
  "title": "عنوان قصير للحدث بالعربية",
  "narrative": "وصف سردي غني بالعربية (3-5 جمل) يشرح ما يحدث وسياقه ولماذا يحدث الآن تحديداً بناءً على حالة الدولة",
  "severity": "low | medium | high | critical",
  "affectedSegments": ["أسماء الفئات المجتمعية المتأثرة إن وجدت"],
  "choices": [
    {
      "id": "معرف فريد قصير بالإنجليزية",
      "label": "نص الخيار بالعربية",
      "effects": [
        { "path": "مسار الحقل داخل state مثل economy.inflationRate أو indicators.security", "delta": رقم موجب أو سالب }
      ]
    }
  ]
}
قدّم بين 2 و4 خيارات مختلفة استراتيجياً (بعضها حازم، بعضها دبلوماسي، بعضها اقتصادي حسب طبيعة الحدث).
`.trim();

  const result = await callClaudeForJSON(systemPrompt, userPrompt);
  if (!result) return buildFallbackEvent(state); // احتياط في حال فشل الاتصال

  return {
    id: `evt_${Date.now()}`,
    turn: state.meta.turnCount,
    date: state.meta.simulationDate,
    source: 'ai',
    ...result,
  };
}

/** حدث احتياطي بسيط في حال تعذّر الوصول لـ Claude API (لا يعطل اللعبة) */
function buildFallbackEvent(state) {
  return {
    id: `evt_fallback_${Date.now()}`,
    turn: state.meta.turnCount,
    date: state.meta.simulationDate,
    source: 'mechanical',
    type: 'other',
    title: 'هدوء نسبي',
    narrative: 'مرت هذه الفترة دون مستجدات كبرى تستدعي تدخلاً مباشراً.',
    severity: 'low',
    affectedSegments: [],
    choices: [
      { id: 'acknowledge', label: 'الاستمرار في المتابعة الاعتيادية', effects: [] }
    ],
  };
}

// ---------- 4) توليد رد شخصية معينة (وزير، معارضة، إعلام، قائد دولة أخرى) ----------

const CHARACTER_PROFILES = {
  primeMinister: 'رئيس الحكومة، عملي وحذر، يوازن بين تنفيذ رغبات الرئيس والواقعية الإدارية',
  financeMinister: 'وزير المالية، متحفظ اقتصادياً، يركز دوماً على الأرقام والمخاطر المالية',
  defenseMinister: 'وزير الدفاع، حازم، يميل لتقوية الجيش ويحذر من التهديدات الأمنية',
  opposition: 'زعيم المعارضة، ناقد دائم لقرارات الرئيس، يبحث عن أي ثغرة سياسية',
  media: 'محلل إعلامي مستقل، يعكس الرأي العام ويصيغ الأخبار بأسلوب صحفي',
  intelligenceChief: 'رئيس الاستخبارات، غامض ومقتضب، يقدم تقييمات أمنية مباشرة',
  foreignLeader: 'رئيس دولة أخرى، يتحدث بأسلوب دبلوماسي رسمي',
};

/**
 * يولّد رد شخصية واحدة بأسلوبها المميز على قرار أو حدث معين
 */
async function generateCharacterResponse(state, characterKey, topic) {
  const profile = CHARACTER_PROFILES[characterKey] || 'شخصية عامة في الدولة';
  const context = buildStateContext(state);

  const systemPrompt = `
أنت تجسّد الشخصية التالية داخل محاكاة سياسية: ${profile}
حالة الدولة الحالية:
${context}
`.trim();

  const userPrompt = `
الموضوع المطروح: "${topic}"
أجب بصيغة JSON بالضبط:
{
  "speaker": "اسم/منصب الشخصية بالعربية",
  "tone": "supportive | critical | neutral | alarmed | cautious",
  "statement": "تصريح الشخصية بالعربية (2-4 جمل)، بأسلوبها المميز المذكور أعلاه"
}
`.trim();

  const result = await callClaudeForJSON(systemPrompt, userPrompt);
  return result || {
    speaker: characterKey,
    tone: 'neutral',
    statement: 'لم يصدر تعليق في الوقت الحالي.',
  };
}

/**
 * يولّد ردود فعل عدة شخصيات دفعة واحدة على قرار أُقرّ للتو (أوفر من استدعاءات منفصلة)
 */
async function generateMultiCharacterReactions(state, decisionLabel, characterKeys = []) {
  const context = buildStateContext(state);
  const profilesText = characterKeys
    .map(key => `- ${key}: ${CHARACTER_PROFILES[key] || 'شخصية عامة'}`)
    .join('\n');

  const systemPrompt = `
أنت تُدير عدة شخصيات داخل محاكاة سياسية واقعية. حالة الدولة الحالية:
${context}

الشخصيات المطلوب توليد ردودها:
${profilesText}
`.trim();

  const userPrompt = `
القرار الذي اتخذه الرئيس للتو: "${decisionLabel}"
ولّد رد فعل كل شخصية من الشخصيات المذكورة أعلاه، بصيغة JSON بالضبط:
{
  "reactions": [
    { "characterKey": "المعرف كما ورد أعلاه", "speaker": "اسم/منصب بالعربية", "tone": "supportive | critical | neutral | alarmed | cautious", "statement": "تصريح بالعربية (2-3 جمل)" }
  ]
}
`.trim();

  const result = await callClaudeForJSON(systemPrompt, userPrompt);
  return result?.reactions || [];
}

// ---------- 5) توليد رد فعل دبلوماسي من دولة أخرى ----------

async function generateForeignReaction(state, foreignCountryName, playerDecisionLabel) {
  const context = buildStateContext(state);

  const systemPrompt = `
أنت تجسّد رئيس/حكومة دولة "${foreignCountryName}" في محاكاة سياسية دولية واقعية.
حالة الدولة اللاعبة (${state.meta.name}) الحالية:
${context}
العلاقة الحالية بين الدولتين: ${JSON.stringify(state.internationalRelations.relations[foreignCountryName] || { relationScore: 50, status: 'محايدة' })}
`.trim();

  const userPrompt = `
القرار الذي اتخذه رئيس ${state.meta.name}: "${playerDecisionLabel}"
كيف تتفاعل دولة ${foreignCountryName} مع هذا القرار؟ أجب بصيغة JSON بالضبط:
{
  "statement": "تصريح رسمي دبلوماسي بالعربية (2-3 جمل)",
  "relationChange": رقم بين -20 و 20 يمثل تأثير هذا الموقف على درجة العلاقة بين الدولتين,
  "possibleAction": "لا شيء | مفاوضات | عقوبات | دعم عسكري | قطع علاقات | تحالف مقترح"
}
`.trim();

  const result = await callClaudeForJSON(systemPrompt, userPrompt);
  if (!result) return null;

  // تحديث درجة العلاقة تلقائياً داخل الحالة
  const rel = state.internationalRelations.relations[foreignCountryName] || { relationScore: 50, status: 'محايدة', treaties: [] };
  rel.relationScore = Math.max(0, Math.min(100, rel.relationScore + result.relationChange));
  state.internationalRelations.relations[foreignCountryName] = rel;

  return result;
}

// ---------- 6) تطبيق خيار الحدث المُختار داخل المحاكاة ----------

/**
 * بعد أن يختار اللاعب أحد "choices" في الحدث المولَّد، هذه الدالة تُطبّقه
 * فعلياً على state باستخدام applyDecision من simulationEngine
 */
function applyEventChoice(state, event, choiceId, applyDecisionFn) {
  const choice = event.choices.find(c => c.id === choiceId);
  if (!choice) return state;

  return applyDecisionFn(state, {
    id: `event_${event.id}_${choiceId}`,
    label: `${event.title} — ${choice.label}`,
    effects: choice.effects || [],
  });
}

// ============================================================
module.exports = {
  buildStateContext,
  generateDynamicEvent,
  generateCharacterResponse,
  generateMultiCharacterReactions,
  generateForeignReaction,
  applyEventChoice,
  CHARACTER_PROFILES,
};
