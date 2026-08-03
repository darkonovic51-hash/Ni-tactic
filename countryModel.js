// ============================================================
// countryModel.js
// نموذج البيانات الأساسي لأي دولة داخل المحاكاة
// ============================================================

/**
 * ينشئ حالة ابتدائية لدولة بناءً على بيانات واقعية أولية
 * @param {Object} baseData - بيانات حقيقية أولية (اسم الدولة، السكان، إلخ)
 */
function createInitialCountryState(baseData) {
  return {
    // ===== الهوية الأساسية =====
    meta: {
      name: baseData.name,
      capital: baseData.capital || '',
      flag: baseData.flag || '',
      politicalSystem: baseData.politicalSystem || 'جمهورية', // جمهورية / ملكية / برلمانية...
      currency: baseData.currency || 'وحدة نقدية محلية',
      language: baseData.language || '',
      foundedYear: baseData.foundedYear || null,
      turnCount: 0,               // عدد الجولات الزمنية المنقضية منذ بدء اللعب
      simulationDate: baseData.startDate || '2026-01-01', // التاريخ داخل المحاكاة
    },

    // ===== الجغرافيا والموارد =====
    geography: {
      areaKm2: baseData.areaKm2 || 0,
      climate: baseData.climate || 'معتدل',
      naturalResources: baseData.naturalResources || [], // ['نفط', 'غاز', 'ذهب'...]
      arableLandPercent: baseData.arableLandPercent || 20,
      coastline: baseData.coastline || false,
    },

    // ===== السكان =====
    population: {
      total: baseData.population || 10000000,
      growthRate: baseData.growthRate || 1.5,     // % سنوياً
      urbanPercent: baseData.urbanPercent || 60,
      literacyRate: baseData.literacyRate || 80,   // %
      lifeExpectancy: baseData.lifeExpectancy || 72,
      unemploymentRate: baseData.unemploymentRate || 12, // %
    },

    // ===== الاقتصاد =====
    economy: {
      gdp: baseData.gdp || 50000000000,           // الناتج المحلي الإجمالي (بالعملة المحلية أو USD)
      gdpGrowthRate: 2.0,                          // % سنوياً
      inflationRate: baseData.inflationRate || 5.0,
      publicDebt: baseData.publicDebt || 20000000000,
      debtToGdpRatio: null,                        // يُحسب تلقائياً
      currencyReserves: baseData.currencyReserves || 5000000000,
      exchangeRate: baseData.exchangeRate || 1.0,   // مقابل الدولار
      taxRate: baseData.taxRate || 20,              // % متوسط الضريبة
      budget: {
        revenue: baseData.budgetRevenue || 10000000000,
        expenditure: baseData.budgetExpenditure || 11000000000,
        deficit: null,                              // يُحسب تلقائياً
      },
      interestRate: baseData.interestRate || 4.0,
      stockMarketIndex: 1000,                       // مؤشر افتراضي يبدأ من 1000
      creditRating: 'BBB',                           // AAA...D
      sectors: {
        industry: 30,     // % مساهمة في الناتج المحلي
        agriculture: 15,
        services: 45,
        energy: 10,
      },
      foreignTrade: {
        exports: baseData.exports || 8000000000,
        imports: baseData.imports || 9000000000,
        tradeBalance: null, // يُحسب تلقائياً
      },
      investmentLevel: 50, // مؤشر 0-100 لجاذبية الاستثمار
    },

    // ===== المؤشرات الاجتماعية والأمنية =====
    indicators: {
      health: 60,           // 0-100
      education: 55,        // 0-100
      security: 65,         // 0-100
      crimeRate: 30,         // 0-100 (كلما زاد، ساء)
      terrorismThreat: 15,   // 0-100
      corruptionIndex: 45,   // 0-100 (كلما زاد، ساء الفساد)
      environmentIndex: 50,  // 0-100
      democracyIndex: 55,    // 0-100
      developmentIndex: 58,  // 0-100 (HDI مبسط)
      presidentPopularity: 50, // 0-100
    },

    // ===== الفئات المجتمعية ورضاها =====
    societySegments: {
      youth:         { populationShare: 30, satisfaction: 50 },
      retirees:      { populationShare: 10, satisfaction: 50 },
      businessOwners:{ populationShare: 5,  satisfaction: 50 },
      workers:       { populationShare: 25, satisfaction: 50 },
      students:      { populationShare: 15, satisfaction: 50 },
      farmers:       { populationShare: 8,  satisfaction: 50 },
      mediaFigures:  { populationShare: 1,  satisfaction: 50 },
      unions:        { populationShare: 3,  satisfaction: 50 },
      minorities:    { populationShare: 3,  satisfaction: 50 },
    },

    // ===== الجيش =====
    military: {
      budget: baseData.militaryBudget || 3000000000,
      personnelActive: baseData.militaryPersonnel || 100000,
      personnelReserve: baseData.militaryReserve || 50000,
      landForces:   { strength: 60, equipmentLevel: 55 },  // 0-100
      airForces:    { strength: 50, equipmentLevel: 50 },
      navalForces:  { strength: 40, equipmentLevel: 45 },
      airDefense:   { strength: 45 },
      militaryIntelligence: { strength: 50 },
      armsIndustryLevel: 30,     // 0-100: قدرة تصنيع السلاح محلياً
      nuclearCapability: baseData.nuclearCapability || false,
      conscriptionActive: baseData.conscriptionActive || false,
      overallMilitaryPower: null, // يُحسب تلقائياً (مؤشر مركّب)
    },

    // ===== العلاقات الدولية =====
    internationalRelations: {
      // خريطة علاقات مع كل دولة أخرى: { countryId: { relationScore, status, treaties: [] } }
      relations: {},
      alliances: [],       // ['NATO', 'دولة كذا'...]
      sanctions: [],        // عقوبات مفروضة على الدولة أو منها
      tradeAgreements: [],
      diplomaticIncidents: [],
    },

    // ===== الإعلام =====
    media: {
      pressFreedomIndex: 50,     // 0-100
      publicOpinionTrend: 'مستقر', // مستقر / متصاعد / متراجع
      activeCampaigns: [],
    },

    // ===== السجلات والتاريخ =====
    history: {
      decisionsLog: [],   // كل قرار اتخذه اللاعب مع تأثيره
      eventsLog: [],       // كل حدث وقع (طبيعي/AI)
      turnSnapshots: [],   // لقطة من المؤشرات الرئيسية كل جولة (لرسم بياني عبر الزمن)
    },
  };
}

module.exports = { createInitialCountryState };
