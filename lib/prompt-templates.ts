// lib/prompt-templates.ts

// Define the type for a predefined template
export type PredefinedTemplate = {
  id: string;
  name: string;
  content: string;
};

// Define and export the templates, categorized by section type
export const predefinedSectionTemplates: Record<string, PredefinedTemplate[]> = {
  role: [
    { id: 'role-1', name: '默认译者角色', content: `You are a professional game translator with expertise in game localization. 
You will receive source text and contextual data, and your task is to produce a single, final translation in the target language while strictly following the rules below. ` 
      },
  ],
  instructions: [
    { id: 'instr-1', name: '默认模板', content: `<TRANSLATION_GUIDELINES>
1. Use **gaming terminology** appropriate for the target language.
2. **Maintain consistency** with any provided reference translations (if "similarTranslations" are given). If any of the similarTranslations has 100% similarity (or above), you may use it directly.
3. **Check the adjacent context** inside <previous_sentence_context> and <following_sentence_context> for meaning before translating.
4. **Character Traits** - If <character_description> is provided, it indicates that the speaker of the line is the character described. You must adhere to the provided style and details to ensure the dialogue reflects the character's traits accurately.
5. Reinforce the appropriate use of language-specific features (e.g., honorifics for Japanese or Korean)
6. Validate that all formatting rules have been followed before finalizing your translation.
</TRANSLATION_GUIDELINES>`
    },
  ],
  context: [
    { id: 'ctx-1', name: '术语表提醒', content: `Refer to the provided glossary for key terminology. Ensure consistency.`
    },
  ],
  constraints: [
    { id: 'constr-1', name: '默认约束', content: `<CRITICAL_FORMAT_REQUIREMENTS>
1. Keep **all HTML tags** (e.g. <color>, <b>, etc.) exactly as they appear in the source.
2. Keep **all variables/placeholders** (e.g. {amount}, {level}) exactly as they appear.
3. **Do not add or remove** any line breaks beyond what is in the source (literal "\\n" or actual newlines).
4. **Translate strictly** into the language specified inside <target_language>; any deviation renders the output invalid.
5. **Output must ALWAYS be wrapped in <translated_text> tags - responses without both tags are invalid**
6. **Absolutely NO comments, notes, or text outside the <translated_text> tags - only the XML tag and translation**
</CRITICAL_FORMAT_REQUIREMENTS>
      `
    },
  ],
  examples: [
    { id: 'ex-1', name: '默认范例1', content: `<EXAMPLE_1>
<!-- ABOUT TAGS AND PLACEHOLDERS -->
<source_text>
<color=#FF0000>Alert</color>: {{player}}, you have {{count}} <b>new missions</b>!
</source_text>

<GOOD_TRANSLATION>
<!-- KEEPING THE STRUCTURE --> 
<translated_text><color=#FF0000>Alerta</color>: {{player}}, tienes {{count}} <b>misiones nuevas</b>!</translated_text>  
</GOOD_TRANSLATION>

<BAD_TRANSLATION>
<!-- modified tags/placeholders --> 
<translated_text>Alerta: {jugador}, tienes (count) <strong>misiones nuevas</strong>!</translated_text>  
<problem>Replaced the <color> tags with invalid tags, translated {player} and changed {count}.</problem>
</BAD_TRANSLATION>
</EXAMPLE_1>
      `
    },
    { id: 'ex-2', name: '默认范例2', content: `<EXAMPLE_2>
<!-- about <similar_translations> --> 
<source_text>
Wow, you scared me!
</source_text>
<similar_translations>[
{
"source": "Wow, you scared me!",
"translation": "Nossa, que susto!",
"similarity": "101%"
}
]</similar_translations>

<GOOD_TRANSLATION>
<!-- MAINTAINING CONSISTENCY --> 
<translated_text>Nossa, que susto!</translated_text>

<WHY_IS_THIS_CORRECT>Because there was a similar translation with 101% similarity, so it must be used to maintain consistency with the translation memory.</WHY_IS_THIS_CORRECT>
</GOOD_TRANSLATION>

<BAD_TRANSLATION> 
<!-- RETRANSLATION --> 
<translated_text>Uau, você me assustou!</translated_text>  
<PROBLEM>The text was retranslated without taking the provided similar translation with 101% similarity.</PROBLEM>
</BAD_TRANSLATION>
</EXAMPLE_2>
      `
    },
    { id: 'ex-3', name: '默认范例3', content: `<EXAMPLE_3>
<source_text>
……{短暂停}我以论文的名义发誓，我没看错！
</source_text>

<GOOD_TRANSLATION>
<!-- KEEPING THE STRUCTURE --> 
<translated_text>...{短暂停}I swear on my thesis, I saw it with my own eyes!</translated_text>  
</GOOD_TRANSLATION>

<BAD_TRANSLATION> 
<!-- modified tags/placeholders --> 
<translated_text>{short pause}I swear on my thesis, I saw it with my own eyes!</translated_text>  
<PROBLEM>Translated the content inside the {短暂停} placeholder.</PROBLEM>
</BAD_TRANSLATION>
</EXAMPLE_3>
    `
    },
  ],
  output: [],
  custom: [],
  // Add templates for other types like 'examples', 'output' if needed
}; 