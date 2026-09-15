let ctx, stream, source, gain, lowCut, speechLow, speechHigh, presence, highCut, compressor, limiter, panner;
let wakeLock, selectedSinkId = "";
const $ = id => document.getElementById(id);
const setText = (id, text) => $(id).textContent = text;
const label = value => value < 25 ? "Low" : value < 70 ? "Medium" : "High";

async function requestWakeLock() {
  try { if ("wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen"); } catch (_) {}
}

async function chooseOutput() {
  const status = $("outputStatus");
  try {
    if (!navigator.mediaDevices?.selectAudioOutput || !(ctx?.setSinkId || window.AudioContext?.prototype?.setSinkId || window.webkitAudioContext?.prototype?.setSinkId)) {
      status.textContent = "Your browser uses the phone's current audio output. Connect Bluetooth earphones in system settings.";
      return;
    }
    const device = await navigator.mediaDevices.selectAudioOutput();
    selectedSinkId = device.deviceId;
    if (ctx) await ctx.setSinkId(device.deviceId);
    status.textContent = ctx ? `Output: ${device.label || "selected Bluetooth/audio device"}` : `Will use: ${device.label || "selected Bluetooth/audio device"}`;
  } catch (error) { if (error.name !== "NotAllowedError") status.textContent = `Could not change output: ${error.message}`; }
}

async function start() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported by this browser.");
    $("err").style.display = "none";
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true, latency: { ideal: 0.01 } } });
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
    if (selectedSinkId && ctx.setSinkId) await ctx.setSinkId(selectedSinkId);
    await ctx.resume();
    source = ctx.createMediaStreamSource(stream);
    lowCut = ctx.createBiquadFilter(); lowCut.type = "highpass"; lowCut.frequency.value = 120; lowCut.Q.value = 0.7;
    speechLow = ctx.createBiquadFilter(); speechLow.type = "peaking"; speechLow.frequency.value = 1200; speechLow.Q.value = 0.9;
    speechHigh = ctx.createBiquadFilter(); speechHigh.type = "peaking"; speechHigh.frequency.value = 2600; speechHigh.Q.value = 1.1;
    presence = ctx.createBiquadFilter(); presence.type = "peaking"; presence.frequency.value = 4200; presence.Q.value = 1.2;
    highCut = ctx.createBiquadFilter(); highCut.type = "lowpass"; highCut.frequency.value = 7600; highCut.Q.value = 0.7;
    gain = ctx.createGain();
    compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -30; compressor.knee.value = 12; compressor.ratio.value = 6; compressor.attack.value = 0.004; compressor.release.value = 0.15;
    limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -4; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.05;
    panner = ctx.createStereoPanner();
    source.connect(lowCut).connect(speechLow).connect(speechHigh).connect(presence).connect(highCut).connect(gain).connect(compressor).connect(limiter).connect(panner).connect(ctx.destination);
    updateAll(); await requestWakeLock();
    $("start").style.display = "none"; $("stop").style.display = "block";
    $("dot").classList.add("on"); setText("status", "Listening — voice focus on");
  } catch (error) {
    await stop(); $("err").style.display = "block"; $("err").textContent = "Could not start microphone: " + error.message;
  }
}

async function stop() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (ctx && ctx.state !== "closed") await ctx.close();
  if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  stream = ctx = null;
  $("start").style.display = "block"; $("stop").style.display = "none";
  $("dot").classList.remove("on"); setText("status", "Not listening");
}

function updateAll() {
  if (!ctx) return;
  const voiceFocus = +$("clarity").value / 100;
  gain.gain.value = +$("gain").value;
  speechLow.gain.value = voiceFocus * 7; speechHigh.gain.value = voiceFocus * 11; presence.gain.value = voiceFocus * 6;
  lowCut.frequency.value = 80 + (+$("noise").value * 1.2);
  highCut.frequency.value = 9000 - (+$("noise").value * 22);
  compressor.ratio.value = 3 + (+$("noise").value / 100) * 7;
  panner.pan.value = +$("balance").value;
  setText("gainVal", (+$("gain").value).toFixed(1) + "×"); setText("clarityVal", label(+$("clarity").value)); setText("noiseVal", label(+$("noise").value));
  setText("balanceVal", Math.abs(+$("balance").value) < .05 ? "Center" : +$("balance").value < 0 ? "Left" : "Right");
}

["gain", "clarity", "noise", "balance"].forEach(id => $(id).addEventListener("input", updateAll));
$("start").onclick = start; $("stop").onclick = stop; $("chooseOutput").onclick = chooseOutput;
document.addEventListener("visibilitychange", async () => { if (!document.hidden && ctx) { await ctx.resume(); await requestWakeLock(); } });
let deferred;
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); deferred = event; $("install").style.display = "block"; });
$("install").onclick = async () => { if (deferred) { await deferred.prompt(); deferred = null; } };
