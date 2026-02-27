import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface QuizQuestion {
  id: string;
  type: string;
  question: string;
  correctAnswer?: string;
  options?: string[];
  correctAnswers?: string[];
  jumbledWords?: string[];
  correctOrder?: string[];
  pairs?: { word: string; meaning: string }[];
  targetText?: string;
  targetLanguage?: string;
  audioText?: string;
  originalText?: string;
  sourceWord?: string;
  difficulty?: string;
}

interface LearningUnitData {
  title: string;
  description: string;
  difficulty: string;
  questions: QuizQuestion[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Get user from JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate input
    const requestSchema = z.object({
      projectId: z.string().uuid(),
    });
    const { projectId } = requestSchema.parse(await req.json());

    // Fetch project data using service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, vocabulary, grammar, practice_sentences, detected_language, script, title')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vocabulary = Array.isArray(project.vocabulary) ? project.vocabulary : [];
    const grammar = Array.isArray(project.grammar) ? project.grammar : [];
    const practiceSentences = Array.isArray(project.practice_sentences) ? project.practice_sentences : [];
    const script = project.script || '';
    const detectedLanguage = project.detected_language || 'Unknown';

    // Calculate unit count: 10-40 based on content richness
    const vocabCount = vocabulary.length;
    const grammarCount = grammar.length;
    const scriptLength = script.length;
    const rawCount = 10 + Math.floor(vocabCount / 5) + Math.floor(grammarCount / 3) + Math.floor(scriptLength / 1000);
    const unitCount = Math.min(40, Math.max(10, rawCount));

    console.log(`Generating ${unitCount} units for project ${projectId}, language: ${detectedLanguage}`);
    console.log(`Content: ${vocabCount} vocab, ${grammarCount} grammar, ${scriptLength} chars script`);

    // Generate units in batches of 5
    const batchSize = 5;
    const allUnits: LearningUnitData[] = [];

    for (let batchStart = 0; batchStart < unitCount; batchStart += batchSize * 2) {
      // Process up to 2 batches in parallel
      const batchPromises: Promise<LearningUnitData[]>[] = [];

      for (let b = 0; b < 2 && batchStart + b * batchSize < unitCount; b++) {
        const start = batchStart + b * batchSize;
        const end = Math.min(start + batchSize, unitCount);
        const batchUnitNumbers = Array.from({ length: end - start }, (_, i) => start + i + 1);

        // Determine difficulty for this batch
        const thirdMark = Math.ceil(unitCount / 3);
        const difficulties = batchUnitNumbers.map(n =>
          n <= thirdMark ? 'beginner' : n <= thirdMark * 2 ? 'intermediate' : 'advanced'
        );

        // Rotate vocab/grammar coverage across batches
        const vocabSliceStart = (start * 10) % Math.max(vocabCount, 1);
        const vocabSlice = vocabulary.slice(vocabSliceStart, vocabSliceStart + 50);
        const grammarSliceStart = (start * 5) % Math.max(grammarCount, 1);
        const grammarSlice = grammar.slice(grammarSliceStart, grammarSliceStart + 30);

        // Sample from practice sentences
        const sentenceSlice = practiceSentences.slice(0, 20);

        // Truncate script for context
        const scriptExcerpt = script.substring(0, 2000);

        batchPromises.push(
          generateBatch(
            LOVABLE_API_KEY,
            batchUnitNumbers,
            difficulties,
            detectedLanguage,
            vocabSlice,
            grammarSlice,
            sentenceSlice,
            scriptExcerpt,
            project.title || 'Video Lesson'
          )
        );
      }

      const batchResults = await Promise.all(batchPromises);
      for (const result of batchResults) {
        allUnits.push(...result);
      }
    }

    console.log(`Generated ${allUnits.length} units total`);

    // Delete existing units for this project+user (idempotent regeneration)
    await adminClient
      .from('learning_units')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', user.id);

    // Bulk insert all units
    const rows = allUnits.map((unit, index) => ({
      project_id: projectId,
      user_id: user.id,
      unit_number: index + 1,
      title: unit.title,
      description: unit.description,
      difficulty: unit.difficulty,
      questions: unit.questions,
    }));

    const { error: insertError } = await adminClient
      .from('learning_units')
      .insert(rows);

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to save units: ${insertError.message}`);
    }

    console.log(`Successfully inserted ${rows.length} learning units`);

    return new Response(
      JSON.stringify({ success: true, unitCount: rows.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-learning-units:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateBatch(
  apiKey: string,
  unitNumbers: number[],
  difficulties: string[],
  language: string,
  vocabulary: unknown[],
  grammar: unknown[],
  practiceSentences: unknown[],
  scriptExcerpt: string,
  projectTitle: string
): Promise<LearningUnitData[]> {
  const vocabSummary = vocabulary.map((v: any) => `${v.word}: ${v.definition || v.meaning || ''}`).join('\n');
  const grammarSummary = grammar.map((g: any) => `${g.rule}: ${g.example || ''}`).join('\n');
  const sentenceSummary = practiceSentences.map((s: any) => `${s.text} → ${s.translation || ''}`).join('\n');

  const unitDescriptions = unitNumbers.map((n, i) =>
    `Unit ${n}: difficulty="${difficulties[i]}"`
  ).join(', ');

  const systemPrompt = `You are an expert language education content creator specializing in ${language}. You create engaging, Duolingo-style learning units with diverse question types.

QUESTION TYPES (use ALL 9 types, at least 5 different types per unit):
1. multiple_choice: "What does X mean?" — MUST have "correctAnswer" (one of the options) and "options" (array of exactly 4 strings)
2. translation: Show sentence in target language — MUST have "correctAnswer" and "options" (4 strings)
3. fill_blank: "Fill in ___" — MUST have "correctAnswer" and "options" (4 strings)
4. read_after_me: Show text for user to read aloud — MUST have "targetText" and "targetLanguage" set to "${language}"
5. tell_meaning: Show word, pick meaning — MUST have "correctAnswer" and "options" (4 strings)
6. multiple_select: "Select ALL correct" — MUST have "correctAnswers" (array of 2-3 strings) and "options" (4-6 strings)
7. word_arrange: Arrange words into sentence — MUST have "jumbledWords" and "correctOrder" arrays
8. listening: Listen and pick what was said — MUST have "audioText", "correctAnswer", and "options" (4 strings)
9. match_pairs: Match word↔meaning — MUST have "pairs" array of {word, meaning} objects (4-5 pairs)

CRITICAL — REQUIRED FIELDS:
- For types multiple_choice, translation, fill_blank, tell_meaning, listening: you MUST ALWAYS include BOTH "correctAnswer" (string, must exactly match one of the options) AND "options" (array of 4 strings that includes the correctAnswer). NEVER omit correctAnswer.
- For multiple_select: you MUST include "correctAnswers" (array) and "options" (array). Each value in correctAnswers must exactly match one value in options.
- For word_arrange: you MUST include "jumbledWords" and "correctOrder" arrays.
- For match_pairs: you MUST include "pairs" array with {word, meaning} objects.
- For read_after_me: you MUST include "targetText" and "targetLanguage".
- For listening: you MUST include "audioText" in addition to "correctAnswer" and "options".

EXAMPLE of a correct multiple_choice question:
{"id":"q1-1","type":"multiple_choice","question":"What does 猫 (māo) mean?","correctAnswer":"Cat","options":["Cat","Dog","Fish","Bird"]}

EXAMPLE of a correct tell_meaning question:
{"id":"q1-2","type":"tell_meaning","question":"Choose the meaning of 食べる (taberu):","correctAnswer":"To eat","options":["To eat","To drink","To sleep","To walk"]}

EXAMPLE of a correct translation question:
{"id":"q1-3","type":"translation","question":"Translate: 私は学生です","correctAnswer":"I am a student","options":["I am a student","You are a teacher","He is a doctor","She is a nurse"]}

RULES:
- Each unit must have EXACTLY 10 questions — no more, no fewer
- Randomly vary the question types across all 9 types; use at least 5 different types per unit
- Questions should test the provided vocabulary, grammar, and sentence patterns
- Every question needs a unique id (use format "q{unitNumber}-{index}")
- Make questions progressively harder within advanced units
- Use natural, conversational examples
- The correctAnswer value MUST be an exact string match with one of the items in the options array
- NEVER omit the correctAnswer field for multiple_choice, translation, fill_blank, tell_meaning, or listening questions`;

  const userPrompt = `Generate ${unitNumbers.length} learning units for: "${projectTitle}"

Units to generate: ${unitDescriptions}

VOCABULARY (${language}):
${vocabSummary || 'No vocabulary available - create basic vocabulary questions'}

GRAMMAR PATTERNS:
${grammarSummary || 'No grammar available - create basic grammar questions'}

EXAMPLE SENTENCES:
${sentenceSummary || 'No sentences available'}

ORIGINAL TRANSCRIPT EXCERPT:
${scriptExcerpt.substring(0, 1000) || 'No transcript available'}

Generate each unit with a creative title, brief description, and EXACTLY 10 questions using the function. Randomly mix all 9 question types.
REMINDER: Every multiple_choice, tell_meaning, translation, fill_blank, and listening question MUST have both "correctAnswer" and "options" fields. The correctAnswer must be factually correct and match one of the options exactly.`;

  const toolSchema = {
    type: "function" as const,
    function: {
      name: "generate_units",
      description: "Generate learning units, each with EXACTLY 10 quiz questions of randomly varied types. For every multiple_choice, translation, fill_blank, tell_meaning, and listening question, you MUST set correctAnswer to the exact correct option string.",
      parameters: {
        type: "object",
        properties: {
          units: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Unit title" },
                description: { type: "string", description: "Brief unit description" },
                difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                questions: {
                  type: "array",
                  minItems: 10,
                  maxItems: 10,
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      type: {
                        type: "string",
                        enum: ["multiple_choice", "translation", "fill_blank", "read_after_me", "tell_meaning", "multiple_select", "word_arrange", "listening", "match_pairs"]
                      },
                      question: { type: "string" },
                      correctAnswer: { type: "string", description: "MANDATORY for multiple_choice, translation, fill_blank, tell_meaning, listening. Must be the exact correct answer string that matches one of the options." },
                      options: { type: "array", items: { type: "string" }, description: "MANDATORY for multiple_choice, translation, fill_blank, tell_meaning, listening, multiple_select. Array of answer choices." },
                      correctAnswers: { type: "array", items: { type: "string" }, description: "MANDATORY for multiple_select. Array of 2-3 correct answers." },
                      jumbledWords: { type: "array", items: { type: "string" }, description: "MANDATORY for word_arrange." },
                      correctOrder: { type: "array", items: { type: "string" }, description: "MANDATORY for word_arrange." },
                      pairs: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            word: { type: "string" },
                            meaning: { type: "string" }
                          },
                          required: ["word", "meaning"]
                        }
                      },
                      targetText: { type: "string" },
                      targetLanguage: { type: "string" },
                      audioText: { type: "string" },
                      originalText: { type: "string" },
                      sourceWord: { type: "string" },
                      difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] }
                    },
                    required: ["id", "type", "question"]
                  }
                }
              },
              required: ["title", "description", "difficulty", "questions"]
            }
          }
        },
        required: ["units"]
      }
    }
  };

  // Retry up to 2 times if AI fails to produce valid tool call
  let result: { units: LearningUnitData[] } | null = null;
  let lastError = '';

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      console.log(`Retry attempt ${attempt + 1}...`);
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [toolSchema],
        tool_choice: { type: "function", function: { name: "generate_units" } },
        max_tokens: 16000,
      }),
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded, please try again later.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted.');
    }
    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      lastError = `AI Gateway error: ${response.status}`;
      continue;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== 'generate_units') {
      // Log what we got for debugging
      const content = data.choices?.[0]?.message?.content;
      console.error(`Attempt ${attempt + 1}: No valid tool call. Content:`, content?.substring(0, 200));
      lastError = 'No valid tool call response from AI';
      continue;
    }

    try {
      result = JSON.parse(toolCall.function.arguments);
      break; // Success
    } catch (parseError: unknown) {
      const msg = parseError instanceof Error ? parseError.message : 'Unknown parse error';
      console.error(`Attempt ${attempt + 1} JSON parse error:`, msg);
      lastError = `Failed to parse AI response: ${msg}`;
    }
  }

  if (!result) {
    throw new Error(lastError || 'Failed to generate units after retries');
  }

  const units = result.units || [];

  // Post-process: strictly validate questions — remove any with missing required data
  for (const unit of units) {
    const before = unit.questions.length;
    unit.questions = (unit.questions || []).filter(q => {
      // Types that require correctAnswer + options
      if (['multiple_choice', 'translation', 'fill_blank', 'tell_meaning', 'listening'].includes(q.type)) {
        if (!q.correctAnswer || !q.options || q.options.length === 0) {
          console.warn(`Removing ${q.type} question ${q.id}: missing correctAnswer or options`);
          return false;
        }
        // Ensure correctAnswer exactly matches one of the options
        if (!q.options.includes(q.correctAnswer)) {
          console.warn(`Removing ${q.type} question ${q.id}: correctAnswer "${q.correctAnswer}" not found in options`);
          return false;
        }
      }
      // multiple_select: require correctAnswers + options
      if (q.type === 'multiple_select') {
        if (!q.correctAnswers || q.correctAnswers.length === 0 || !q.options || q.options.length === 0) {
          console.warn(`Removing multiple_select question ${q.id}: missing correctAnswers or options`);
          return false;
        }
        // Ensure all correctAnswers are in options
        if (!q.correctAnswers.every(a => q.options!.includes(a))) {
          console.warn(`Removing multiple_select question ${q.id}: correctAnswers not in options`);
          return false;
        }
      }
      // word_arrange: require both arrays
      if (q.type === 'word_arrange') {
        if (!q.jumbledWords || !q.correctOrder || q.correctOrder.length === 0) {
          console.warn(`Removing word_arrange question ${q.id}: missing jumbledWords or correctOrder`);
          return false;
        }
      }
      // match_pairs: require pairs
      if (q.type === 'match_pairs') {
        if (!q.pairs || q.pairs.length === 0) {
          console.warn(`Removing match_pairs question ${q.id}: missing pairs`);
          return false;
        }
      }
      // read_after_me: require targetText
      if (q.type === 'read_after_me') {
        if (!q.targetText) {
          console.warn(`Removing read_after_me question ${q.id}: missing targetText`);
          return false;
        }
      }
      // listening: require audioText
      if (q.type === 'listening') {
        if (!q.audioText) {
          q.audioText = q.correctAnswer || q.question;
        }
      }
      return true;
    });
    if (unit.questions.length < before) {
      console.warn(`Unit "${unit.title}": removed ${before - unit.questions.length} invalid questions, ${unit.questions.length} remaining`);
    }
  }

  // Enforce exactly 10 questions per unit
  const QUESTIONS_PER_UNIT = 10;
  for (const unit of units) {
    if (unit.questions.length > QUESTIONS_PER_UNIT) {
      console.log(`Unit "${unit.title}": trimming from ${unit.questions.length} to ${QUESTIONS_PER_UNIT} questions`);
      unit.questions = unit.questions.slice(0, QUESTIONS_PER_UNIT);
    } else if (unit.questions.length < QUESTIONS_PER_UNIT) {
      console.warn(`Unit "${unit.title}": only ${unit.questions.length}/${QUESTIONS_PER_UNIT} valid questions after validation`);
    }
    // Re-number question IDs for consistency
    unit.questions.forEach((q, idx) => {
      q.id = `q${unitNumbers[units.indexOf(unit)] ?? 0}-${idx + 1}`;
    });
  }

  console.log(`Batch generated ${units.length} units (post-validated)`);
  return units;
}
