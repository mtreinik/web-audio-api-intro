let canvas, ctx
let animationHandle = null
const FONT_SIZE = 32

const len = 32
const real = new Float32Array(len)
const imag = new Float32Array(len)
const ac = new AudioContext()
const osc = ac.createOscillator()

for (let i = 0; i < len; i++) {
  real[i] = 0
  imag[i] = 0
}
pos = 0
real[1] = 1
real[2] = 0.5
real[3] = 0.4
real[12] = 1
const wave = ac.createPeriodicWave(real, imag)
osc.setPeriodicWave(wave)
osc.frequency.value = 40

let mouseX
let mouseY

const bandpass = ac.createBiquadFilter()
bandpass.type = 'bandpass'
bandpass.Q.value = 10
bandpass.frequency.value = 50

const output = ac.createGain()
output.gain.value = 0.5

const NOISE_LENGTH = 44100

const buffer = ac.createBuffer(2, NOISE_LENGTH, 44100)
for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
  const channelData = buffer.getChannelData(channel)
  for (let i = 0; i < buffer.length; i++) {
    channelData[i] = Math.random() * 2 - 1
  }
}

function playNoise() {
  const source = ac.createBufferSource()
  source.buffer = buffer
  source.connect(bandpass)
  source.start()
}


function playCurvedNoise(volume, startFreq, endFreq, duration) {
  const source = ac.createBufferSource()
  source.buffer = buffer
  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.Q.value = 10
  bandpass.frequency.value = startFreq
  bandpass.frequency.linearRampToValueAtTime(endFreq, ac.currentTime + duration)
  const envelope = ac.createGain()
  envelope.gain.setValueAtTime(volume, ac.currentTime)
  envelope.gain.linearRampToValueAtTime(0, ac.currentTime + duration)
  bandpass.connect(envelope)
  envelope.connect(output)

  source.connect(bandpass)
  source.start()
}

function getEnvelope(volume, duration, attack, decay, sustain, release) {
  const envelope = ac.createGain()
  envelope.gain.value = 0
  envelope.gain.linearRampToValueAtTime(volume, ac.currentTime + attack)
  envelope.gain.linearRampToValueAtTime(volume * sustain, ac.currentTime + attack + decay)
  envelope.gain.linearRampToValueAtTime(volume * sustain, ac.currentTime + attack + decay + duration)
  envelope.gain.linearRampToValueAtTime(0, ac.currentTime + attack + decay + duration + release)
  return envelope
}

function playTone(volume, startFreq, endFreq, duration, attack, decay, sustain, release) {
  const osc = ac.createOscillator()
  const wave = ac.createPeriodicWave([0, 1], [0, 0])
  osc.setPeriodicWave(wave)
  osc.frequency.value = startFreq
  osc.frequency.linearRampToValueAtTime(endFreq, ac.currentTime + attack + decay + duration + release)

  const envelope = getEnvelope(volume, duration, attack, decay, sustain, release)
  osc.connect(envelope)
  envelope.connect(output)
  osc.start()
}

function getReverb(duration) {
  const SAMPLE_RATE = 48000
  const convolver = ac.createConvolver()

  const buffer = ac.createBuffer(2, duration*SAMPLE_RATE, SAMPLE_RATE)
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const channelData = buffer.getChannelData(channel)
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = (Math.random() * buffer.length) < (buffer.length / (i+1)) ? Math.random() : 0
    }
  }

  convolver.buffer = buffer
  return convolver
}

function getDistortion() {
  const distortion = ac.createWaveShaper()
  let curve = new Float32Array(3)
  const values = [-1, -.5, 1]
  values.forEach((val, index) => curve[index] = val)
  distortion.curve = curve
  distortion.oversample = '2x'
  return distortion
}

function playBass(volume, startFreq, endFreq, duration, attack, decay, sustain, release) {
  const osc = ac.createOscillator()
  const wave = ac.createPeriodicWave([0, 1], [0, 0])
  osc.setPeriodicWave(wave)
  osc.frequency.value = startFreq
  osc.frequency.linearRampToValueAtTime(endFreq, ac.currentTime + attack + decay + duration + release)

  const envelope = getEnvelope(volume, duration, attack, decay, sustain, release)
  osc.connect(envelope)

  const distortion = getDistortion()
  envelope.connect(distortion)
  distortion.connect(output)

  osc.start()
}

function updateAnimation() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)
//  console.log('updateAnimation')

//   for (let i = 0; i < len; i++) {
//     real[i] = (i) > pos ? 1 : 0
//     imag[i] = (i ^ 1) < pos ? 0 : 1
//   }
//   pos = (pos + 1) % len
//   const wave = ac.createPeriodicWave(real, imag)
//   osc.setPeriodicWave(wave)
//
// //  osc.connect(output)
//   osc.connect(bandpass)
//   bandpass.connect(output)
//
//   output.connect(ac.destination)
//
//
//   console.log('freq', osc.frequency.value)

  animationHandle = window.requestAnimationFrame(updateAnimation)
}

function run() {
  canvas = document.getElementById('canvas')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  ctx = canvas.getContext('2d')
  ctx.font = FONT_SIZE + 'px Times New Roman'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'

  output.connect(ac.destination)

  animationHandle = window.requestAnimationFrame(updateAnimation)
}

function toggleAnimation() {
  if (animationHandle) {
    output.disconnect(ac.destination)
    window.cancelAnimationFrame(animationHandle)
    ctx.fillText('Paused', Math.floor(canvas.width / 2), 100)
    animationHandle = null
  } else {
    output.connect(ac.destination)
    animationHandle = window.requestAnimationFrame(updateAnimation)
  }
}

function playTom(startFreq, endFreq) {
  playCurvedNoise(2, startFreq*2, endFreq*2, 0.1)
  playTone(1, startFreq, endFreq, 0, 0.02, 0, 1, 0.2)

}

document.onkeydown = function (e) {
  console.log('e.key', e.key)
  switch (e.key) {
    case ' ':
      output.connect(ac.destination)
      osc.start()
      break
    case 'n':
      playNoise()
      break
    case 'a':
      playCurvedNoise(10, 150, 30, 0.14)
      playTone(1, 35, 35, 0, 0.02, 0, 1, 0.2)
      break
    case 's':
      playCurvedNoise(10, 350, 70, 0.18)
      //playCurvedNoise(250, 200, 0.05)
      break
    case 'r':
      playCurvedNoise(1, 8000, 7500, 0.1)
      break
    case 't':
      playCurvedNoise(1, 8000, 7500, 0.2)
      break
    case 'y':
      playCurvedNoise(1, 8000, 7500, 0.3)
      break
    case 'j':
      playTom(250, 210)
      break
    case 'h':
      playTom(210, 177)
      break
    case 'g':
      playTom(177, 149)
      break
    case 'f':
      playTom(149, 125)
      break
    case 'i':
      playCurvedNoise(0.5, 2500, 2500, 0.5)
      playCurvedNoise(1, 5000, 5000, 0.5)
      playCurvedNoise(1, 10000, 10000, 0.5)
      playCurvedNoise(2, 15000, 15000, 0.5)
      break
    case 'q':
      //playCurvedNoise(10, 35, 35, 0.02)
      playBass(1, 170, 170, 0.356, 0.03, 0.03, .7, 0.05)
      break
    case 'p':
      toggleAnimation()
      break
    case 'Enter':
      output.frequency.value = 600-osc.frequency.value
      break
  }
}

window.addEventListener('load', () => {
  run()
  document.onmousemove = (event) => {
    bandpass.frequency.value = event.pageX + 0
  }
})