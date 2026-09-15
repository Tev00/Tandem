// scoreDialogue(app, dialogueId) — the single scoring seam.
// PHASE 0/1: STUB returning fixed, neutral scores with proper structure.
// PHASE 2: replace with ONE Anthropic API call (Haiku) over the full transcript.
module.exports = {
  async scoreDialogue(app, dialogueId) {
    try {
      const dialogue = app.findRecordById('dialogues', dialogueId)
      const messages = app.findRecordsByFilter('messages', 'dialogue = {:d}', '', 500, 0, { d: dialogueId })
      
      // PHASE 0: STUB returns proper structure with fixed scores (3.0 = neutral)
      const stubScore = {
        score: 3.0,
        justification: '[Phase 0 stub - real scoring in Phase 2]',
        confidence: 0.5
      }
      
      return {
        participantA: {
          respect: stubScore,
          clarte: stubScore,
          argumentation: stubScore,
          nuance: stubScore,
          ecoute_active: stubScore,
          fair_play: stubScore,
        },
        participantB: {
          respect: stubScore,
          clarte: stubScore,
          argumentation: stubScore,
          nuance: stubScore,
          ecoute_active: stubScore,
          fair_play: stubScore,
        },
        collective: {
          clarification_mutuelle: stubScore,
          construction_dialogue: stubScore,
        }
      }
      
      // TODO PHASE 2: Implement Anthropic Haiku API call here
      // const anthropic = require('https://api.anthropic.com/v1')
      // const response = await anthropic.messages.create({
      //   model: 'claude-3-5-haiku-20241022',
      //   max_tokens: 1024,
      //   messages: [{\n      //     role: 'user',
      //     content: `Score this dialogue transcript on 8 criteria...`
      //   }]
      // })
    } catch (err) {
      console.log('[scoring] error:', err)
      return null
    }
  },
}
