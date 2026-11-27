const {
  playBeat,
  playCue,
  scores,
  cues,
} = require("../src/client/audio/score.cjs");
async function measure(render) {
  const context = new OfflineAudioContext(1, 44100, 44100);
  render(context);
  const data = (await context.startRendering()).getChannelData(0);
  let energy = 0,
    peak = 0;
  for (const sample of data) {
    energy += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  if (!(energy > 0.01 && peak < 1))
    throw Error(`Invalid rendered audio energy=${energy} peak=${peak}`);
}
async function test() {
  for (const name of Object.keys(scores))
    await measure((context) =>
      playBeat(context, context.destination, name, 0, 0.01),
    );
  for (const name of Object.keys(cues))
    await measure((context) => playCue(context, context.destination, name));
  const frame = document.querySelector("iframe");
  await new Promise((resolve) => {
    frame.onload = resolve;
    frame.src = "../Lantern-Below.html";
  });
  const child = frame.contentDocument,
    control = (channel) => child.getElementById(`audio-${channel}`),
    turn = child.getElementById("floor").textContent;
  for (const channel of ["music", "effects", "music", "effects"]) {
    const button = control(channel),
      was = button.getAttribute("aria-pressed");
    button.click();
    for (let i = 0; i < 100 && button.disabled; i++)
      await new Promise((resolve) => setTimeout(resolve, 10));
    if (button.getAttribute("aria-pressed") === was)
      throw Error(`Toggle failed: ${channel}`);
  }
  if (child.getElementById("floor").textContent !== turn)
    throw Error("Audio controls spent a game turn");
}
test()
  .then(() => (document.getElementById("status").textContent = "AUDIO_OK"))
  .catch(
    (error) => (document.getElementById("status").textContent = String(error)),
  );
