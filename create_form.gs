/**
 * Creates the "How do you use AI? (Internal)" Google Form.
 * Run createAIUsageForm() from the Apps Script editor (or via clasp).
 * After it runs, check the Logs/Execution log for the shareable + edit URLs.
 */
function createAIUsageForm() {
  var form = FormApp.create('How do you use AI? (Internal)')
    .setDescription('Quick internal pulse check — 4 minutes, no right answers. The weirder, the better.');

  // 1. Which AI tools do you actually use? (Checkboxes)
  form.addCheckboxItem()
    .setTitle('Which AI tools do you actually use?')
    .setChoiceValues([
      'ChatGPT', 'Claude', 'Gemini', 'Copilot', 'Deep Research',
      'Image Gen', 'Voice Mode', 'Codex', 'Other'
    ]);

  // 2. Which tool are you using the most right now? (MCQ)
  form.addMultipleChoiceItem()
    .setTitle('Which tool are you using the most right now?')
    .setChoiceValues([
      'ChatGPT', 'Claude', 'Gemini', 'Copilot',
      'Depends on the task', 'Something else'
    ]);

  // 3. How often do you open an AI tool on a typical workday? (MCQ)
  form.addMultipleChoiceItem()
    .setTitle('How often do you open an AI tool on a typical workday?')
    .setChoiceValues([
      'Always open', 'Once a day', 'Few times a week', 'Rarely'
    ]);

  // 4. What do you mainly use AI for at work? (Checkboxes)
  form.addCheckboxItem()
    .setTitle('What do you mainly use AI for at work?')
    .setChoiceValues([
      'Writing/editing', 'Research', 'Summarizing', 'Brainstorming',
      'Making images', 'Code/scripts', 'Planning', 'Emails', 'Decks & docs'
    ]);

  // 5. Describe one moment where AI genuinely saved your day at work (Long answer)
  form.addParagraphTextItem()
    .setTitle('Describe one moment where AI genuinely saved your day at work');

  // 6. What do you use it for that you'd never put in a work update? (Long answer)
  form.addParagraphTextItem()
    .setTitle("What do you use it for that you'd never put in a work update?");

  // 7. Do you feel like you're falling behind when you haven't used AI? (MCQ)
  form.addMultipleChoiceItem()
    .setTitle("Do you feel like you're falling behind when you haven't used AI?")
    .setChoiceValues([
      'Yes anxious', 'Sometimes', 'Not really', "No it's just a tool"
    ]);

  // 8. Has AI ever made you look smarter than you are in a meeting? (MCQ)
  form.addMultipleChoiceItem()
    .setTitle('Has AI ever made you look smarter than you are in a meeting?')
    .setChoiceValues([
      'Yes often', 'Once', "No I'm transparent", 'Made me look dumber'
    ]);

  // 9. Does your manager or team know how much you actually use AI? (MCQ)
  form.addMultipleChoiceItem()
    .setTitle('Does your manager or team know how much you actually use AI?')
    .setChoiceValues([
      'Very open about it', 'They know partially', 'Keep it to myself'
    ]);

  // 10. Have you ever used AI to do something a colleague assumed you did yourself? (MCQ)
  form.addMultipleChoiceItem()
    .setTitle('Have you ever used AI to do something a colleague assumed you did yourself?')
    .setChoiceValues([
      'Yes and let them think it', 'Yes but clarified', 'No'
    ]);

  // 11. Have you ever used AI in a way that surprised even you? (Long answer)
  form.addParagraphTextItem()
    .setTitle('Have you ever used AI in a way that surprised even you?');

  // 12. How dependent are you on AI tools right now? (Scale 1–5)
  form.addScaleItem()
    .setTitle('How dependent are you on AI tools right now?')
    .setBounds(1, 5)
    .setLabels('Could live without', "Can't function without");

  // 13. Finish this: "I wish AI could just..." (Short answer)
  form.addTextItem()
    .setTitle('Finish this: "I wish AI could just..."');

  var editUrl = form.getEditUrl();
  var shareUrl = form.getPublishedUrl();

  Logger.log('Shareable (published) URL: ' + shareUrl);
  Logger.log('Edit URL: ' + editUrl);

  // Also surface to console for clasp/V8 runtime runs.
  console.log('Shareable (published) URL: ' + shareUrl);
  console.log('Edit URL: ' + editUrl);

  return { shareUrl: shareUrl, editUrl: editUrl };
}
