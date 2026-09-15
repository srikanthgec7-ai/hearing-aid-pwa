let ctx,stream,source,gain,low,high,clarity,compressor,split,merger;
const $=id=>document.getElementById(id);
const setText=(id,t)=>$(id).textContent=t;
function label(v){return v<25?"Low":v<70?"Medium":"High"}

async function start(){
 try{
  if(!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is not supported by this browser.");
  stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}});
  ctx=new (window.AudioContext||window.webkitAudioContext)();
  await ctx.resume();
  source=ctx.createMediaStreamSource(stream);

  gain=ctx.createGain();
  low=ctx.createBiquadFilter(); low.type="lowshelf"; low.frequency.value=250;
  high=ctx.createBiquadFilter(); high.type="highshelf"; high.frequency.value=2200;
  clarity=ctx.createBiquadFilter(); clarity.type="peaking"; clarity.frequency.value=1800; clarity.Q.value=0.8;
  compressor=ctx.createDynamicsCompressor();
  compressor.threshold.value=-18; compressor.knee.value=18; compressor.ratio.value=3; compressor.attack.value=.005; compressor.release.value=.12;

  source.connect(low).connect(clarity).connect(high).connect(gain).connect(compressor).connect(ctx.destination);
  updateAll();

  $("start").style.display="none"; $("stop").style.display="block";
  $("dot").classList.add("on"); setText("status","Listening");
 }catch(e){
  $("err").style.display="block"; $("err").textContent="Could not start microphone: "+e.message;
 }
}
function stop(){
 if(stream) stream.getTracks().forEach(t=>t.stop());
 if(ctx) ctx.close();
 stream=null;ctx=null;
 $("start").style.display="block"; $("stop").style.display="none";
 $("dot").classList.remove("on");setText("status","Not listening");
}
function updateAll(){
 if(!ctx)return;
 gain.gain.value=+$("gain").value;
 low.gain.value=+$("bass").value;
 high.gain.value=+$("treble").value;
 clarity.gain.value=(+$("clarity").value/100)*8;
 compressor.ratio.value=2+(+$("noise").value/100)*5;
 setText("gainVal",(+$("gain").value).toFixed(1)+"×");
 setText("clarityVal",label(+$("clarity").value));
 setText("noiseVal",label(+$("noise").value));
 setText("bassVal",+$("bass").value+" dB");
 setText("trebleVal",+$("treble").value+" dB");
 let b=+$("balance").value; setText("balanceVal",Math.abs(b)<.05?"Center":b<0?"Left":"Right");
}
["gain","clarity","noise","bass","treble","balance"].forEach(id=>$(id).addEventListener("input",updateAll));
$("start").onclick=start;$("stop").onclick=stop;

let deferred;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferred=e;$("install").style.display="block"});
$("install").onclick=async()=>{if(deferred){deferred.prompt();deferred=null}};
window.addEventListener("pagehide",stop);
