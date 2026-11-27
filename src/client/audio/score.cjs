// Original ostinatos. Pitches are semitone offsets from the scene's root;
// null is a rest. Bass and melody run on the same eight-step clock.
const scores = {
  salt: {
    root: 50,
    bpm: 76,
    voice: "sine",
    bass: [0, -5, -2, -7],
    tune: [12, null, 19, 17, null, 14, 10, null],
  },
  ember: {
    root: 45,
    bpm: 106,
    voice: "triangle",
    bass: [0, 0, -2, -5],
    tune: [12, 12, null, 15, 10, null, 7, 10],
  },
  crown: {
    root: 47,
    bpm: 88,
    voice: "sine",
    bass: [0, -4, -7, -2],
    tune: [19, null, 15, 22, null, 18, 14, null],
  },
  harbor: {
    root: 55,
    bpm: 98,
    voice: "triangle",
    bass: [0, -5, 2, -7],
    tune: [12, 16, 19, null, 21, 19, 14, null],
  },
};
// Earcons are intentionally shorter and brighter than the ambient score.
const cues = {
  step: [43],
  strike: [54, 38],
  hurt: [49, 42],
  flare: [64, 71, 78],
  loot: [79, 86],
  chest: [60, 67, 72, 76],
  mend: [65, 69, 72],
  trade: [74, 81, 78],
  lift: [55, 62, 69],
  descend: [67, 62, 55],
  victory: [60, 64, 67, 72, 76],
  defeat: [59, 54, 47, 35],
};
function playTone(context, output, midi, when, length, level, wave = "sine") {
  const oscillator = context.createOscillator(),
    envelope = context.createGain();
  oscillator.type = wave;
  oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.exponentialRampToValueAtTime(level, when + 0.009);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + length);
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
  oscillator.start(when);
  oscillator.stop(when + length + 0.01);
}
function playBeat(context, output, scene, beat, when) {
  const score = scores[scene],
    duration = 30 / score.bpm;
  const index = beat % score.tune.length,
    phrase = Math.floor(beat / score.tune.length) % 4;
  if (index % 4 === 0)
    playTone(
      context,
      output,
      score.root - 12 + score.bass[phrase],
      when,
      2.4 * duration,
      0.12,
      "triangle",
    );
  if (score.tune[index] !== null)
    playTone(
      context,
      output,
      score.root + score.tune[index] + (phrase === 3 && index === 0 ? 5 : 0),
      when,
      duration * 0.87,
      0.1,
      score.voice,
    );
  return duration;
}
function playCue(context, output, name) {
  const notes = cues[name];
  if (!notes) return;
  const now = context.currentTime + 0.005;
  notes.forEach((note, i) =>
    playTone(
      context,
      output,
      note,
      now + i * 0.065,
      name === "step" ? 0.055 : 0.18,
      name === "step" ? 0.045 : 0.19,
      name === "strike" || name === "hurt" ? "triangle" : "sine",
    ),
  );
}
module.exports = { scores, cues, playBeat, playCue };
