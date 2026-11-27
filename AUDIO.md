# Lantern Below: synth audio

Use **Music: off** or **Sound effects: off** in the header to turn either channel on. Both start off on page load. Toggles cost no turns. Background playback pauses when the page is hidden. Browsers without Web Audio can still play silently.

The Salt Archive has a sparse sine melody; the Ember Foundry uses a faster, repeating triangle pulse; the Crown Vault has a higher, more unsettled motif. The surface market uses a bright major arpeggio. Steps, strikes, damage, flares, healing, loot, chests, purchases, lift travel and the expedition ending have short synthesized cues. No recordings, external audio files or runtime downloads.

For contributors: `src/client/audio/score.cjs` defines the motifs and envelopes, `player.cjs` manages the audio clock and channel gains, `events.cjs` maps accepted game actions to cues, and `controls.cjs` handles opt-in and page visibility. The audio CI job renders samples with OfflineAudioContext and checks the controls against the packaged HTML. It is not a subjective listening test.
