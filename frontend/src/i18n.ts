export type Lang = "te" | "hi" | "en";
export type Status = "verified" | "issue" | "maintenance" | "unavailable" | "overdue";

/** Six big tiles first; the last two are shown smaller. */
export const BIG_TILES = ["water", "dirty", "blocked", "door", "light", "unsafe"] as const;
export const SMALL_TILES = ["smell", "other"] as const;
export const TILE_ICON: Record<string, string> = {
  water: "dropOff", dirty: "broom", blocked: "blocked", door: "door", light: "bulb", unsafe: "unsafe", smell: "smell", other: "dots",
};
export const SPEECH_LANG: Record<Lang, string> = { te: "te-IN", hi: "hi-IN", en: "en-IN" };

type Pub = {
  name: string; demo: string; listen: string; noVoice: string; bigText: string;
  status: Record<Status, string>; advice: Record<Status, string>;
  checked: (m: string) => string; notChecked: (m: string) => string; neverChecked: string; waterOff: string;
  tapProblem: string; cat: Record<string, string>;
  sent: string; sentSub: string; merged: string; ref: string; addPhoto: string; addComment: string; addPhone: string;
  save: string; saved: string; share: string; nearbyTitle: string; nearbyNone: string; directions: string; away: string;
  dirs: string[]; fixedQ: string; yes: string; no: string; thanks: string; offline: string; helpline: string;
  unsafeTitle: string; police: string; women: string; back: string; inactive: string;
  minutes: (m: number) => string;
  speak: string; speakHint: string; recording: string; micDenied: string; voiceCat: string;
  queue: Record<"short" | "long" | "full", string>; queueAgo: (m: string) => string;
  hold: string; holdHint: string; release: string; tooShort: string; undo: (s: number) => string; undone: string;
  addMore: string; next: string; start: string; skip: string; guide: { icon: string; title: string; text: string }[];
};

const en: Pub = {
  name: "English", demo: "Demo — synthetic data", listen: "Listen", noVoice: "This phone has no voice for this language.", bigText: "Bigger text",
  status: { verified: "Usable", issue: "Problem reported", maintenance: "Being repaired", unavailable: "Closed", overdue: "Not checked recently" },
  advice: {
    verified: "You can use this toilet.", issue: "A problem has been reported here.",
    maintenance: "Being repaired. Please use another toilet.", unavailable: "Closed. Please use another toilet.",
    overdue: "Not checked recently. Condition unknown.",
  },
  checked: (m) => `Checked by RMC staff ${m} ago`, notChecked: (m) => `Not checked for ${m}`, neverChecked: "Not checked yet",
  waterOff: "No water right now", tapProblem: "Problem here? Tap the picture.",
  cat: { water: "No water", dirty: "Dirty", blocked: "Blocked", door: "Door or lock broken", light: "No light", unsafe: "Feels unsafe", smell: "Bad smell", other: "Other" },
  sent: "Report sent", sentSub: "RMC staff have been told.", merged: "Others reported this too. Your report was added.", ref: "Reference",
  addPhoto: "Add a photo", addComment: "Write something", addPhone: "Phone number for SMS", save: "Send", saved: "Added",
  share: "Share on WhatsApp", nearbyTitle: "Usable toilets nearby", nearbyNone: "No checked toilet nearby right now.",
  directions: "Directions", away: "away", dirs: ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"],
  fixedQ: "This was repaired recently. Is it fixed?", yes: "Yes, fixed", no: "No, still a problem", thanks: "Thank you. Your answer is recorded.",
  offline: "No network. Your report will be sent when the signal returns.", helpline: "Or call the RMC helpline (number to be added) and say code",
  unsafeTitle: "Feel unsafe? Call now", police: "Police", women: "Women's helpline", back: "Back", inactive: "This code is not active.",
  minutes: (m) => (m < 1 ? "moments" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`),
  speak: "Speak your complaint", speakHint: "Tap, speak in any language, tap again to send", recording: "Listening… tap to send",
  micDenied: "The microphone is blocked. Allow it in the browser, or tap a picture below.", voiceCat: "Voice complaint",
  queue: { short: "Short queue", long: "Long queue", full: "Very crowded" }, queueAgo: (m) => `reported ${m} ago`,
  hold: "Hold to speak", holdHint: "Hold the button, speak, then let go. Like a WhatsApp voice message.", release: "Speaking… let go to send",
  tooShort: "Keep holding the button while you speak.", undo: (s) => `Wrong picture? Undo (${s})`, undone: "Report cancelled.",
  addMore: "Add a photo, comment or phone number (optional)", next: "Next", start: "Start", skip: "Skip",
  guide: [
    { icon: "tick", title: "Green tick means you can use it", text: "The colour at the top shows if this toilet is usable now." },
    { icon: "hand", title: "Problem? Tap its picture", text: "One tap sends it to RMC staff. No typing needed." },
    { icon: "mic", title: "Or hold and speak", text: "Hold the microphone and say the problem in any language." },
  ],
};

const te: Pub = {
  name: "తెలుగు", demo: "డెమో — కల్పిత సమాచారం", listen: "వినండి", noVoice: "ఈ ఫోన్‌లో ఈ భాషకు వాయిస్ లేదు.", bigText: "పెద్ద అక్షరాలు",
  status: { verified: "వాడుకకు సిద్ధం", issue: "సమస్య నమోదైంది", maintenance: "మరమ్మతు జరుగుతోంది", unavailable: "మూసివేశారు", overdue: "ఇటీవల తనిఖీ చేయలేదు" },
  advice: {
    verified: "ఈ మరుగుదొడ్డిని వాడుకోవచ్చు.", issue: "ఇక్కడ సమస్య నమోదైంది.",
    maintenance: "మరమ్మతు జరుగుతోంది. దయచేసి వేరే మరుగుదొడ్డి వాడండి.", unavailable: "మూసివేశారు. దయచేసి వేరే మరుగుదొడ్డి వాడండి.",
    overdue: "ఇటీవల తనిఖీ చేయలేదు. పరిస్థితి తెలియదు.",
  },
  checked: (m) => `RMC సిబ్బంది ${m} క్రితం తనిఖీ చేశారు`, notChecked: (m) => `${m} నుండి తనిఖీ చేయలేదు`, neverChecked: "ఇంకా తనిఖీ చేయలేదు",
  waterOff: "ప్రస్తుతం నీళ్లు లేవు", tapProblem: "సమస్య ఉందా? బొమ్మను నొక్కండి.",
  cat: { water: "నీళ్లు లేవు", dirty: "అపరిశుభ్రం", blocked: "మూసుకుపోయింది", door: "తలుపు / గడియ పాడైంది", light: "లైట్ లేదు", unsafe: "సురక్షితంగా లేదు", smell: "దుర్వాసన", other: "ఇతర" },
  sent: "ఫిర్యాదు పంపబడింది", sentSub: "RMC సిబ్బందికి తెలియజేశాం.", merged: "ఇతరులు కూడా ఇదే తెలిపారు. మీ ఫిర్యాదు జోడించబడింది.", ref: "రిఫరెన్స్",
  addPhoto: "ఫోటో జోడించండి", addComment: "ఏదైనా రాయండి", addPhone: "SMS కోసం ఫోన్ నంబర్", save: "పంపండి", saved: "జోడించబడింది",
  share: "WhatsApp లో పంపండి", nearbyTitle: "దగ్గరలో వాడుకోదగిన మరుగుదొడ్లు", nearbyNone: "దగ్గరలో తనిఖీ చేసిన మరుగుదొడ్డి లేదు.",
  directions: "దారి", away: "దూరం", dirs: ["ఉత్తరం", "ఈశాన్యం", "తూర్పు", "ఆగ్నేయం", "దక్షిణం", "నైరుతి", "పడమర", "వాయువ్యం"],
  fixedQ: "ఇటీవల మరమ్మతు చేశారు. సరిచేశారా?", yes: "అవును, సరైంది", no: "లేదు, ఇంకా సమస్య ఉంది", thanks: "ధన్యవాదాలు. మీ సమాధానం నమోదైంది.",
  offline: "నెట్‌వర్క్ లేదు. సిగ్నల్ వచ్చాక మీ ఫిర్యాదు పంపబడుతుంది.", helpline: "లేదా RMC హెల్ప్‌లైన్‌కు (నంబర్ జోడించాలి) ఫోన్ చేసి ఈ కోడ్ చెప్పండి",
  unsafeTitle: "సురక్షితంగా లేదా? వెంటనే కాల్ చేయండి", police: "పోలీస్", women: "మహిళా హెల్ప్‌లైన్", back: "వెనక్కి", inactive: "ఈ కోడ్ పనిచేయడం లేదు.",
  minutes: (m) => (m < 1 ? "కొద్ది క్షణాల" : m < 60 ? `${m} నిమిషాల` : `${Math.floor(m / 60)} గం ${m % 60} ని`),
  speak: "మాటల్లో ఫిర్యాదు చెప్పండి", speakHint: "నొక్కి, ఏ భాషలోనైనా మాట్లాడి, మళ్లీ నొక్కండి", recording: "వింటున్నాం… పంపడానికి నొక్కండి",
  micDenied: "మైక్ అనుమతి లేదు. బ్రౌజర్‌లో అనుమతించండి లేదా కింద బొమ్మను నొక్కండి.", voiceCat: "మాటల ఫిర్యాదు",
  queue: { short: "తక్కువ వరుస", long: "పొడవైన వరుస", full: "చాలా రద్దీ" }, queueAgo: (m) => `${m} క్రితం తెలిపారు`,
  hold: "నొక్కి పట్టి మాట్లాడండి", holdHint: "బటన్ నొక్కి పట్టి మాట్లాడి, వదలండి. WhatsApp వాయిస్ మెసేజ్ లాగా.", release: "మాట్లాడుతున్నారు… పంపడానికి వదలండి",
  tooShort: "మాట్లాడుతున్నంత సేపు బటన్ నొక్కి పట్టండి.", undo: (s) => `తప్పు బొమ్మా? రద్దు చేయండి (${s})`, undone: "ఫిర్యాదు రద్దయింది.",
  addMore: "ఫోటో, వ్యాఖ్య లేదా ఫోన్ నంబర్ జోడించండి (ఐచ్ఛికం)", next: "తర్వాత", start: "మొదలు", skip: "వదిలేయండి",
  guide: [
    { icon: "tick", title: "ఆకుపచ్చ టిక్ అంటే వాడుకోవచ్చు", text: "పైన ఉన్న రంగు ఈ మరుగుదొడ్డి ఇప్పుడు వాడుకోవచ్చో చూపిస్తుంది." },
    { icon: "hand", title: "సమస్యా? దాని బొమ్మను నొక్కండి", text: "ఒక్క నొక్కుతో RMC సిబ్బందికి వెళ్తుంది. టైప్ చేయక్కర్లేదు." },
    { icon: "mic", title: "లేదా నొక్కి పట్టి మాట్లాడండి", text: "మైక్ నొక్కి పట్టి ఏ భాషలోనైనా సమస్య చెప్పండి." },
  ],
};

const hi: Pub = {
  name: "हिन्दी", demo: "डेमो — काल्पनिक डेटा", listen: "सुनें", noVoice: "इस फ़ोन में इस भाषा की आवाज़ नहीं है।", bigText: "बड़े अक्षर",
  status: { verified: "उपयोग योग्य", issue: "समस्या दर्ज", maintenance: "मरम्मत चल रही है", unavailable: "बंद है", overdue: "हाल में जाँच नहीं हुई" },
  advice: {
    verified: "आप इस शौचालय का उपयोग कर सकते हैं।", issue: "यहाँ समस्या दर्ज की गई है।",
    maintenance: "मरम्मत चल रही है। कृपया दूसरा शौचालय उपयोग करें।", unavailable: "बंद है। कृपया दूसरा शौचालय उपयोग करें।",
    overdue: "हाल में जाँच नहीं हुई। हालत पता नहीं।",
  },
  checked: (m) => `RMC कर्मचारियों ने ${m} पहले जाँच की`, notChecked: (m) => `${m} से जाँच नहीं हुई`, neverChecked: "अभी तक जाँच नहीं हुई",
  waterOff: "अभी पानी नहीं है", tapProblem: "यहाँ समस्या है? तस्वीर दबाएँ।",
  cat: { water: "पानी नहीं", dirty: "गंदा", blocked: "जाम है", door: "दरवाज़ा / कुंडी टूटी", light: "बत्ती नहीं", unsafe: "असुरक्षित लगता है", smell: "बदबू", other: "अन्य" },
  sent: "शिकायत भेज दी गई", sentSub: "RMC कर्मचारियों को बता दिया गया है।", merged: "दूसरों ने भी यही बताया है। आपकी शिकायत जोड़ दी गई।", ref: "संदर्भ",
  addPhoto: "फ़ोटो जोड़ें", addComment: "कुछ लिखें", addPhone: "SMS के लिए फ़ोन नंबर", save: "भेजें", saved: "जोड़ दिया गया",
  share: "WhatsApp पर भेजें", nearbyTitle: "पास के उपयोग योग्य शौचालय", nearbyNone: "अभी पास में कोई जाँचा हुआ शौचालय नहीं।",
  directions: "रास्ता", away: "दूर", dirs: ["उत्तर", "उत्तर-पूर्व", "पूर्व", "दक्षिण-पूर्व", "दक्षिण", "दक्षिण-पश्चिम", "पश्चिम", "उत्तर-पश्चिम"],
  fixedQ: "हाल में मरम्मत हुई। क्या ठीक है?", yes: "हाँ, ठीक है", no: "नहीं, अभी भी समस्या है", thanks: "धन्यवाद। आपका जवाब दर्ज हुआ।",
  offline: "नेटवर्क नहीं है। सिग्नल आने पर शिकायत भेजी जाएगी।", helpline: "या RMC हेल्पलाइन पर कॉल करें (नंबर जोड़ना है) और यह कोड बताएँ",
  unsafeTitle: "असुरक्षित महसूस हो रहा है? अभी कॉल करें", police: "पुलिस", women: "महिला हेल्पलाइन", back: "वापस", inactive: "यह कोड सक्रिय नहीं है।",
  minutes: (m) => (m < 1 ? "कुछ पल" : m < 60 ? `${m} मिनट` : `${Math.floor(m / 60)} घंटे ${m % 60} मिनट`),
  speak: "बोलकर शिकायत करें", speakHint: "दबाएँ, किसी भी भाषा में बोलें, फिर दबाकर भेजें", recording: "सुन रहे हैं… भेजने के लिए दबाएँ",
  micDenied: "माइक की अनुमति नहीं है। ब्राउज़र में अनुमति दें या नीचे तस्वीर दबाएँ।", voiceCat: "बोली गई शिकायत",
  queue: { short: "छोटी कतार", long: "लंबी कतार", full: "बहुत भीड़" }, queueAgo: (m) => `${m} पहले बताया`,
  hold: "दबाकर रखें और बोलें", holdHint: "बटन दबाकर रखें, बोलें, फिर छोड़ दें। WhatsApp वॉइस मैसेज की तरह।", release: "बोल रहे हैं… भेजने के लिए छोड़ें",
  tooShort: "बोलते समय बटन दबाकर रखें।", undo: (s) => `गलत तस्वीर? रद्द करें (${s})`, undone: "शिकायत रद्द हो गई।",
  addMore: "फ़ोटो, टिप्पणी या फ़ोन नंबर जोड़ें (वैकल्पिक)", next: "आगे", start: "शुरू करें", skip: "छोड़ें",
  guide: [
    { icon: "tick", title: "हरा निशान मतलब उपयोग कर सकते हैं", text: "ऊपर का रंग बताता है कि यह शौचालय अभी उपयोग योग्य है या नहीं।" },
    { icon: "hand", title: "समस्या? उसकी तस्वीर दबाएँ", text: "एक बार दबाने से RMC कर्मचारियों तक पहुँचती है। लिखना ज़रूरी नहीं।" },
    { icon: "mic", title: "या दबाकर बोलें", text: "माइक दबाकर रखें और किसी भी भाषा में समस्या बताएँ।" },
  ],
};

export const PUB: Record<Lang, Pub> = { te, hi, en };

// ---------------------------------------------------------------- field app (Telugu first)

export type WLang = "te" | "en";
type Work = {
  scan: string; scanHint: string; typeCode: string; open: string; repairs: string; noRepairs: string; toVerify: string;
  fixedBy: (n: string) => string; due: string; never: string; allOk: string; wrong: string; needHelp: string;
  help: Record<string, string>; helpSent: string; start: string; fixed: string; fixNote: string; photo: string;
  confirm: string; notFixed: string; checkFix: string; you: string; submit: string; savedPhone: string; sent: string;
  offlineBanner: string; online: string; offline: string; tasks: string; outbox: string; back: string; waiting: string;
  noProblemNote: string; eachNo: string; scanCamera: string; scanNoCamera: string; cancel: string; pending: (n: number) => string;
  inspectDone: string; repairStarted: string; fixRecorded: string; verifyNeedsNet: string; confirmed: string; sentBack: string;
  allSent: string; recent: string; received: string; dup: string; late: string; refused: string; sendNow: string; unknownCode: (c: string) => string;
  due_in: (m: number) => string; late_by: (m: number) => string; typedFlag: string; selfBlocked: string;
  queueQ: string; queue: Record<"short" | "long" | "full", string>; queueSaved: string;
  nextTask: string; goScan: string; nothingNext: string; tapConfirm: string; finishRepair: string; signOut: string;
  statusLabel: Record<string, string>; gNext: string; gStart: string; gSkip: string; guide: { icon: string; title: string; text: string }[];
};

const wte: Work = {
  scan: "స్కాన్ చేయండి", scanHint: "మరుగుదొడ్డి లోపల ఉన్న సిబ్బంది QR కోడ్‌ను స్కాన్ చేయండి", typeCode: "కెమెరా లేదా? కోడ్ టైప్ చేయండి", open: "తెరవండి",
  repairs: "మీకు అప్పగించిన మరమ్మతులు", noRepairs: "మరమ్మతులు లేవు. కింద తనిఖీలు ఉన్నాయి.", toVerify: "రెండో వ్యక్తి తనిఖీ చేయాల్సినవి",
  fixedBy: (n) => `${n} సరిచేశారు. చూసి నిర్ధారించండి.`, due: "తనిఖీ చేయాల్సినవి (పాతవి ముందు)", never: "ఎప్పుడూ లేదు",
  allOk: "అన్నీ బాగున్నాయి", wrong: "ఏదో సమస్య ఉంది", needHelp: "సహాయం కావాలి",
  help: { tanker: "నీటి ట్యాంకర్", plumber: "ప్లంబర్", supplies: "శుభ్రత సామగ్రి", crowd: "జనం ఎక్కువ", other: "ఇతర సహాయం" },
  helpSent: "సహాయ అభ్యర్థన సూపర్‌వైజర్‌కు చేరుతుంది.", start: "మరమ్మతు ప్రారంభించండి", fixed: "సరిచేశాను", fixNote: "ఏం చేశారు? (ఐచ్ఛికం)",
  photo: "ఫోటో (వ్యక్తులు వద్దు)", confirm: "సరైందని నిర్ధారించండి", notFixed: "సరికాలేదు", checkFix: "మరమ్మతు తనిఖీ", you: "(మీరు)",
  submit: "తనిఖీ పంపండి", savedPhone: "ఫోన్‌లో భద్రపరిచాం. సిగ్నల్ వచ్చాక పంపబడుతుంది.", sent: "పంపబడింది.",
  offlineBanner: "నెట్‌వర్క్ లేదు. మీ పని ఈ ఫోన్‌లో భద్రంగా ఉంది, తర్వాత పంపబడుతుంది.", online: "ఆన్‌లైన్", offline: "ఆఫ్‌లైన్",
  tasks: "పనులు", outbox: "పంపాల్సినవి", back: "పనులకు వెనక్కి", waiting: "ఫోన్‌లో నమోదైంది. రెండో వ్యక్తి తనిఖీ కోసం వేచి ఉంది.",
  noProblemNote: "సూపర్‌వైజర్‌కు గమనిక", eachNo: "ప్రతి 'కాదు' సూపర్‌వైజర్‌కు సమస్యగా వెళ్తుంది.",
  scanCamera: "కోడ్‌ను చతురస్రంలో పెట్టండి", scanNoCamera: "కెమెరా తెరవలేకపోయాం. కోడ్ టైప్ చేయండి.", cancel: "రద్దు",
  pending: (n) => `${n} పనులు ఫోన్‌లో ఉన్నాయి, పంపాలి`, inspectDone: "తనిఖీ నమోదైంది.", repairStarted: "మరమ్మతు ప్రారంభమైంది.",
  fixRecorded: "మరమ్మతు నమోదైంది. ఇప్పుడు వేరే వ్యక్తి నిర్ధారించాలి.", verifyNeedsNet: "నిర్ధారణకు నెట్‌వర్క్ కావాలి.",
  confirmed: "నిర్ధారించబడింది. సమస్య మూసివేయబడింది.", sentBack: "మళ్లీ పనివారికి పంపబడింది.", allSent: "అన్నీ పంపబడ్డాయి.",
  recent: "ఇటీవల పంపినవి", received: "అందింది", dup: "ముందే అందింది", late: "ఆలస్యం: సూపర్‌వైజర్‌కు తెలిపాం", refused: "తిరస్కరించబడింది",
  sendNow: "ఇప్పుడే పంపండి", unknownCode: (c) => `కోడ్ ${c} గుర్తించలేదు. సూపర్‌వైజర్‌ను అడగండి.`,
  due_in: (m) => `${m} ని లోపు`, late_by: (m) => `${m} ని ఆలస్యం`, typedFlag: "టైప్ చేసిన కోడ్‌లు సూపర్‌వైజర్‌కు తెలుస్తాయి.", selfBlocked: "ఈ మరమ్మతు మీరే చేశారు. వేరే వ్యక్తి నిర్ధారించాలి.",
  queueQ: "ఇప్పుడు వరుస ఎంత ఉంది?", queue: { short: "తక్కువ", long: "పొడవు", full: "చాలా రద్దీ" }, queueSaved: "వరుస సమాచారం నమోదైంది.",
  nextTask: "తర్వాతి పని", goScan: "అక్కడికి వెళ్లి లోపలి కోడ్‌ను స్కాన్ చేయండి", nothingNext: "ఇప్పుడు అత్యవసర పని లేదు.",
  tapConfirm: "నిర్ధారించడానికి మళ్లీ నొక్కండి", finishRepair: "ముందు ఈ మరమ్మతు పూర్తి చేయండి. తర్వాత తనిఖీ.", signOut: "బయటకు",
  statusLabel: { verified: "వాడుకకు సిద్ధం", issue: "సమస్య నమోదైంది", maintenance: "మరమ్మతు జరుగుతోంది", unavailable: "మూసివేశారు", overdue: "తనిఖీ ఆలస్యం" },
  gNext: "తర్వాత", gStart: "మొదలు", gSkip: "వదిలేయండి",
  guide: [
    { icon: "scan", title: "1. లోపలి కోడ్‌ను స్కాన్ చేయండి", text: "మరుగుదొడ్డి లోపల ఉన్న సిబ్బంది QR కోడ్‌ను స్కాన్ బటన్‌తో స్కాన్ చేయండి." },
    { icon: "tick", title: "2. బాగుందా? ఒక్క నొక్కు", text: "అన్నీ బాగుంటే ఆకుపచ్చ బటన్. ఏదైనా సమస్య ఉంటే ఎరుపు బటన్." },
    { icon: "clock", title: "3. సిగ్నల్ లేకపోయినా పరవాలేదు", text: "మీ పని ఫోన్‌లో భద్రంగా ఉంటుంది, సిగ్నల్ వచ్చాక తానే వెళ్తుంది." },
  ],
};

const wen: Work = {
  scan: "Scan", scanHint: "Scan the staff QR code inside the toilet", typeCode: "No camera? Type the code", open: "Open",
  repairs: "Repairs for you", noRepairs: "No repairs assigned. Inspections are below.", toVerify: "Fixes to check",
  fixedBy: (n) => `Fixed by ${n}. Look at it and confirm.`, due: "Inspections due, oldest first", never: "never",
  allOk: "Everything is OK", wrong: "Something is wrong", needHelp: "I need help",
  help: { tanker: "Water tanker", plumber: "Plumber", supplies: "Cleaning supplies", crowd: "Too crowded", other: "Other help" },
  helpSent: "Your request goes to the supervisor.", start: "Start repair", fixed: "Mark as fixed", fixNote: "What did you do? (optional)",
  photo: "Photo (no people)", confirm: "Confirm fix", notFixed: "Not fixed", checkFix: "Check a fix", you: "(you)",
  submit: "Submit inspection", savedPhone: "Saved on phone. It will send when the signal returns.", sent: "Sent.",
  offlineBanner: "No network. Your work is saved on this phone and sends later.", online: "Online", offline: "Offline",
  tasks: "Tasks", outbox: "Outbox", back: "Back to tasks", waiting: "Recorded on this phone. Waiting for a second person to check.",
  noProblemNote: "Note for the supervisor", eachNo: "Each “No” goes to the supervisor as an issue.",
  scanCamera: "Hold the code inside the square", scanNoCamera: "Could not open the camera. Type the code instead.", cancel: "Cancel",
  pending: (n) => `${n} record(s) saved on phone, waiting to send`, inspectDone: "Inspection recorded.", repairStarted: "Repair started.",
  fixRecorded: "Fix recorded. Another person must now confirm it.", verifyNeedsNet: "Confirming a fix needs a network connection.",
  confirmed: "Fix confirmed. The issue is closed.", sentBack: "Sent back to the worker.", allSent: "Everything has been sent.",
  recent: "Recently sent", received: "Received", dup: "Already received", late: "Late: supervisor told", refused: "Refused",
  sendNow: "Send now", unknownCode: (c) => `Staff code ${c} is not recognised. Ask your supervisor.`,
  due_in: (m) => `due in ${m} min`, late_by: (m) => `late by ${m} min`, typedFlag: "Typed codes are flagged for the supervisor.", selfBlocked: "You made this fix. Another person must confirm it.",
  queueQ: "How long is the queue now?", queue: { short: "Short", long: "Long", full: "Very crowded" }, queueSaved: "Queue recorded.",
  nextTask: "Next task", goScan: "Go there and scan the code inside", nothingNext: "Nothing urgent right now.",
  tapConfirm: "Tap again to confirm", finishRepair: "Finish this repair first. Then inspect.", signOut: "Sign out",
  statusLabel: { verified: "Usable", issue: "Problem reported", maintenance: "Being repaired", unavailable: "Closed", overdue: "Check overdue" },
  gNext: "Next", gStart: "Start", gSkip: "Skip",
  guide: [
    { icon: "scan", title: "1. Scan the code inside", text: "Use the Scan button on the staff QR code inside the toilet." },
    { icon: "tick", title: "2. All good? One tap", text: "Green button if everything is fine. Red button if something is wrong." },
    { icon: "clock", title: "3. No signal is fine", text: "Your work stays safe on the phone and sends itself when the signal returns." },
  ],
};

export const WORK: Record<WLang, Work> = { te: wte, en: wen };

export const CHECKLIST: { key: string; icon: string; te: string; en: string }[] = [
  { key: "floor", icon: "broom", te: "నేల శుభ్రం", en: "Floor clean" },
  { key: "pans", icon: "toilet", te: "పాన్‌లు శుభ్రం", en: "Pans clean" },
  { key: "water", icon: "drop", te: "నీళ్లు ఉన్నాయి", en: "Water available" },
  { key: "door", icon: "door", te: "తలుపులు, గడియలు సరిగా ఉన్నాయి", en: "Doors and latches work" },
  { key: "lights", icon: "bulb", te: "లైట్లు వెలుగుతున్నాయి", en: "Lights work" },
  { key: "handwash", icon: "hand", te: "చేతులు కడుక్కునే సౌకర్యం", en: "Handwash available" },
];

export const HELP_ICON: Record<string, string> = { tanker: "truck", plumber: "wrench", supplies: "box", crowd: "crowd", other: "help" };

export const CATEGORY_EN: Record<string, string> = en.cat;
