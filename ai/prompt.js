// Answer style configs
const STYLE_CONFIG = {
  spoken: {
    instruction: 'Each answer MUST be under 200 characters. Use plain, everyday language — no jargon. Write as if the candidate is speaking naturally out loud. Short sentences, easy to memorize.',
    suggestions: [
      { label: 'Ngắn gọn 1', tags: ['Simple', 'Spoken'] },
      { label: 'Ngắn gọn 2', tags: ['Simple', 'Spoken'] },
      { label: 'Ngắn gọn 3', tags: ['Simple', 'Spoken'] }
    ]
  },
  technical: {
    instruction: 'Each answer should show deep technical knowledge. Use precise game dev terminology. Each answer max 300 characters.',
    suggestions: [
      { label: 'Technical A', tags: ['Unity', 'C#'] },
      { label: 'Technical B', tags: ['Architecture'] },
      { label: 'Technical C', tags: ['Optimization'] }
    ]
  },
  star: {
    instruction: 'Each answer uses STAR format (Situation, Task, Action, Result). Reference the candidate\'s real companies and projects. Each answer max 350 characters.',
    suggestions: [
      { label: 'STAR 1', tags: ['Experience'] },
      { label: 'STAR 2', tags: ['Leadership'] },
      { label: 'STAR 3', tags: ['Result'] }
    ]
  },
  all: {
    instruction: 'Provide one Technical, one Concise, and one STAR answer.',
    suggestions: [
      { label: 'Technical Deep-Dive', tags: ['Unity', 'C#'] },
      { label: 'Concise & Clear',     tags: ['Brief'] },
      { label: 'STAR Storytelling',   tags: ['Experience'] }
    ]
  }
};

/**
 * Builds a personalized system prompt from structured profile + optional freetext resume.
 * @param {string} resume      - Optional freetext resume override
 * @param {Object} profile     - Structured profile loaded from store/profile.json
 * @param {string} answerStyle - spoken | technical | star | all
 * @returns {string} System prompt string
 */
function buildSystemPrompt(resume = '', profile = {}, answerStyle = 'spoken', portfolio = {}) {
  const profileBlock = buildProfileBlock(profile, portfolio, resume);
  const style = STYLE_CONFIG[answerStyle] || STYLE_CONFIG.spoken;
  const exampleSuggestions = style.suggestions
    .map(s => `    { "label": "${s.label}", "answer_vi": "...", "answer_en": "...", "tags": ${JSON.stringify(s.tags)} }`)
    .join(',\n');

  return `You are an AI copilot assisting a Vietnamese game developer in a live job interview conducted in English.

${profileBlock}
VOICE RULES — every answer must sound like this specific person:
- Use their real companies, numbers, stack — never generic filler
- Reflect their calm-but-deep personality: measured, honest, occasionally self-deprecating but optimistic
- Short sentences. Real examples. No buzzwords. End with a positive insight or lesson.
- Keep answers concise and focused. Do not over-explain.

COLLABORATIVE DISCUSSION RULES (important):
- This should feel like a two-way discussion, not one-way Q&A.
- Every suggestion should include: (1) a direct answer, then (2) one short follow-up question back to interviewer.
- Keep each suggestion compact: 2-4 short sentences total.
- Follow-up question should be practical and cooperative, for example:
  * "Would you like me to go deeper into the technical part or team leadership part?"
  * "Did you have time to review my portfolio? It already includes full project details and metrics."
- Keep the follow-up question short (max 1 sentence), natural, and non-defensive.
- Do not ask aggressive/challenging questions. Tone must stay respectful and constructive.
- Do not repeat the same follow-up question across all 3 suggestions.
- Use the portfolio follow-up only when relevant (experience, achievements, project depth, or metrics).

ANSWER STYLE RULE: ${style.instruction}

BILINGUAL FORMAT RULES (very important):
- "answer_vi": the full answer in Vietnamese — so the candidate understands the meaning clearly
- "answer_en": the English version to SPEAK OUT LOUD — must follow these rules:
  * Simple vocabulary only (A2–B1 level English)
  * Short sentences, max 260 characters
  * Natural spoken English, NOT written/formal English
  * No complex grammar, no passive voice, no jargon the candidate cannot pronounce
  * Include one short collaborative follow-up question at the end
  * Example good EN: "I worked at Neko Global for 2 years. I built the P2E game system using Unity and blockchain. My team had 10 people."
  * Example bad EN: "Having been extensively involved in the implementation of blockchain-integrated gameplay systems..."

CRITICAL RULE: You are a JSON-only output machine. NEVER write prose, explanations, or refuse. If the input is not an interview question (e.g. random text, song lyrics, noise), treat it as a generic question and still return valid JSON.

Given any text input:
1. Translate it EN↔VN for the "translation" field
2. Suggest 3 interview-style answers using the candidate's real background
3. Suggest 3-5 short follow-up questions for the candidate to ask back to interviewer in a collaborative tone, and make them bilingual
4. Output ONLY raw JSON — no markdown fences, no text before or after

REQUIRED OUTPUT FORMAT (raw JSON, nothing else):
{
  "translation": "...",
  "suggestions": [
${exampleSuggestions}
  ],
  "reverse_questions": [
    { "vi": "...", "en": "..." },
    { "vi": "...", "en": "..." }
  ],
  "keywords": ["key", "terms"],
  "difficulty": "easy|medium|hard"
}`;
}

/**
 * Converts structured profile object into a readable text block for the prompt.
 */
function buildProfileBlock(profile, portfolio, resume) {
  if (!profile || !profile.name) {
    return resume ? `Candidate background:\n${resume}\n` : '';
  }

  const exp = (profile.experience || [])
    .map(e => `  - ${e.period} | ${e.role} @ ${e.company}: ${e.highlights.join('. ')}`)
    .join('\n');

  const skills = Object.entries(profile.skills || {})
    .map(([cat, list]) => `  ${cat}: ${list.join(', ')}`)
    .join('\n');

  const p = profile.personality || {};
  const avoidLines   = (p.toneGuide?.avoid  || []).map(x => `  ✗ ${x}`).join('\n');
  const preferLines  = (p.toneGuide?.prefer || []).map(x => `  ✓ ${x}`).join('\n');
  const exampleLines = (p.examplePhrases    || []).map(x => `  "${x}"`).join('\n');
  const traitLines   = (p.traits            || []).map(x => `  - ${x}`).join('\n');
  const fillers      = (p.fillerWords       || []).join(', ');
  const fallback     = p.offTopicFallback   || '';

  return `
=== CANDIDATE PROFILE ===
Name:    ${profile.name} (${profile.alias || ''})
Title:   ${profile.title} — ${profile.yearsOfExperience}+ years
Stack:   ${(profile.skills?.core || []).join(', ')}

Experience:
${exp}

Achievements:
${(profile.achievements || []).map(a => `  - ${a}`).join('\n')}
${buildPortfolioBlock(portfolio)}
=== PERSONALITY & VOICE ===
${p.summary || ''}

Character traits:
${traitLines}

Natural filler words this person uses: ${fillers}

AVOID these patterns:
${avoidLines}

PREFER these patterns:
${preferLines}

Example phrases that sound like this person — STUDY these and match the voice:
${exampleLines}

OFF-TOPIC FALLBACK — if the input is not a real interview question, use this answer template:
  "${fallback}"

=========================
${resume ? `\nExtra context: ${resume}` : ''}`.trim();
}

/**
 * Builds a concise notable-projects block from portfolio.json for STAR answer grounding.
 */
function buildPortfolioBlock(portfolio) {
  if (!portfolio || !Array.isArray(portfolio.projects) || portfolio.projects.length === 0) return '';

  const featured = portfolio.projects
    .filter(p => (p.myContributions && p.myContributions.length > 0) || (p.achievements && p.achievements.length > 0))
    .slice(0, 7);

  if (!featured.length) return '';

  const lines = featured.map(p => {
    const meta = [p.role, p.genre, p.period, p.teamSize ? `team ${p.teamSize}` : null]
      .filter(Boolean).join(' | ');
    const contribs = (p.myContributions || []).slice(0, 3).map(c => `    • ${c}`).join('\n');
    const ach = (p.achievements || []).map(a => `    ★ ${a}`).join('\n');
    return [`  [${p.title}] — ${meta}`, contribs, ach].filter(Boolean).join('\n');
  }).join('\n\n');

  return `\n=== NOTABLE PROJECTS (cite these in STAR answers — use real names, numbers, and details) ===\n${lines}\n\n`;
}

module.exports = { buildSystemPrompt };
