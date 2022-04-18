let canvas, ctx
let animationHandle = null
const FONT_SIZE = 32

const sequencer = [
  {
    step: 1,
    notes: [0, 12, 12, 0, 12, 12, 0, 12, 13, 1, 13, -2, 10, 12, 0, 12],
  },
  {
    step: 2,
    notes: ['', 'r'],
  },
  {
    step: 2,
    notes: ['a', ''],
  },
  {
    step: 4,
    notes: ['', 's'],
  },
  {
    step: 1,
    notes: ['r', 'r', '', 'r', 'y', 'r', '', 'r']
  }
]
sequencer.forEach(staff => {
  staff.pos = 0
  staff.on = false
})
let sequencerPos = 0
let sequencerOn = false

const chords = [
  [0, 7, 10, 15],
  [0, 6, 9, 14],
  [-2, 7, 9, 14],
  [-2, 5, 9, 14],
  [-3, 7, 9, 12],
  [-3, 6, 10, 12],
  [-5, 5, 10, 14],
  [-2, 5, 9, 14],
]
let chordNum = 0
let direction = 0

const EFFECT_CLEAR = 0b0000010
const EFFECT_MOVE = 0b0000100
const EFFECT_FREQ = 0b0001000
const EFFECT_WAVE = 0b0010000
let effects = EFFECT_MOVE | EFFECT_FREQ | EFFECT_WAVE

const ac = new AudioContext()

let mouseX
let mouseY

const bandpass = ac.createBiquadFilter()
bandpass.type = 'bandpass'
bandpass.Q.value = 10
bandpass.frequency.value = 50

const analyser = ac.createAnalyser()
analyser.fftSize = 128
const fftLength = analyser.frequencyBinCount
let fft = new Uint8Array(fftLength)
let wave = new Uint8Array(fftLength)

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

function getBandpass(startFreq, endFreq, duration, q=10) {
  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.Q.value = q
  bandpass.frequency.value = startFreq
  bandpass.frequency.linearRampToValueAtTime(endFreq, ac.currentTime + duration)
  return bandpass
}

function disconnect(nodes, atTime) {
  setTimeout(() => {
    console.log('disconnecting')
    nodes.forEach((node) => node.disconnect())
  }, 1000 * (atTime - ac.currentTime))
}

function playCurvedNoise(volume, startFreq, endFreq, duration, q=10) {
  const source = ac.createBufferSource()
  source.buffer = buffer
  const bandpass = getBandpass(startFreq, endFreq, duration, q)
  const envelope = ac.createGain()
  const endTime = ac.currentTime + duration
  envelope.gain.setValueAtTime(volume, ac.currentTime)
  envelope.gain.linearRampToValueAtTime(0, endTime)

  source.connect(bandpass)
  bandpass.connect(envelope)
  envelope.connect(output)
  disconnect([source, bandpass, envelope], endTime)
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
  const endTime = ac.currentTime + attack + decay + duration + release
  osc.setPeriodicWave(wave)
  osc.frequency.value = startFreq
  osc.frequency.linearRampToValueAtTime(endFreq, endTime)

  const envelope = getEnvelope(volume, duration, attack, decay, sustain, release)
  osc.connect(envelope)
  envelope.connect(output)
  disconnect([osc, envelope], endTime)
  osc.start()
}

function playOrgan(volume, startFreq, endFreq, duration, attack, decay, sustain, release) {
  const osc = ac.createOscillator()
  const wave = ac.createPeriodicWave([0, 1, 0.1, 0.55], [0, 0, 0, 0])
  const endTime = ac.currentTime + attack + decay + duration + release
  osc.setPeriodicWave(wave)
  osc.frequency.value = startFreq
  osc.frequency.linearRampToValueAtTime(endFreq, endTime)

  const envelope = getEnvelope(volume, duration, attack, decay, sustain, release)
  osc.connect(envelope)
  envelope.connect(output)
  disconnect([osc, envelope], endTime)
  osc.start()
}

function getReverb(duration) {
  const SAMPLE_RATE = 44100
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
  const values = [-1, -.2, 0, .9, 1]
  values.forEach((val, index) => curve[index] = val)
  distortion.curve = curve
  distortion.oversample = '2x'
  return distortion
}

function playBass(volume, startFreq, endFreq, duration, attack, decay, sustain, release) {
  const osc = ac.createOscillator()
  const wave = ac.createPeriodicWave([0, 1, 1], [0, 0, 0])
  const endTime = ac.currentTime + attack + decay + duration + release
  osc.setPeriodicWave(wave)
  osc.frequency.value = startFreq
  //osc.frequency.linearRampToValueAtTime(endFreq, ac.currentTime + attack + decay + duration + release)

  const envelope = getEnvelope(volume, duration, attack, decay, sustain, release)
  const distortion = getDistortion()

  osc.connect(distortion)
  distortion.connect(envelope)
  envelope.connect(output)
  disconnect([osc, distortion, envelope], endTime)

  osc.start()
}

function getHsl(r, g, b) {
  return `hsl(${r},${g}%,${b}%)`
}

function updateAnimation() {
  if (effects & EFFECT_CLEAR) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function drawBar(val, angle, color1, color2) {
    const rotatedAngle = angle + ac.currentTime
    const x = Math.sin(rotatedAngle)*val + halfX
    const y = Math.cos(rotatedAngle)*val + halfY
    const gradient = ctx.createLinearGradient(halfX, halfY, x, y)

    gradient.addColorStop(0, color1)
    gradient.addColorStop(1, color2)
    ctx.strokeStyle = gradient
    ctx.beginPath()
    ctx.moveTo(halfX, halfY)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function drawWave(x1, y1, x2, y2, color1, color2) {
    const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
    gradient.addColorStop(0, color1)
    gradient.addColorStop(1, color2)
    ctx.strokeStyle = gradient
    ctx.lineTo(x2, y2)

  }

  const halfX = canvas.width / 2
  const halfY = canvas.height / 2

  analyser.getByteFrequencyData(fft);
  analyser.getByteTimeDomainData(wave)

  if (effects & EFFECT_MOVE) {
    const imageData = ctx.getImageData(2, 2, canvas.width-4, canvas.height-4)
    const strength = fft[0] / 10
    direction = direction + fft[fftLength / 2] / 100
    ctx.putImageData(imageData, Math.round(strength*Math.sin(direction))+2, Math.round(strength*Math.cos(direction))+2)
  }

  if (effects & EFFECT_FREQ) {
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    for (let i = 0; i < fftLength/2; i++) {
      const val = fft[i+3]*halfX / 256
      const r = fft[0]+1
      const g = fft[fftLength/2]+1
      const b = fft[fftLength-1]+1

      color1 = getHsl(i*360/fftLength + direction, val, 0)
      color2 = getHsl(i*360/fftLength + direction, val, 50)
      drawBar(val, i * Math.PI * 2/ fftLength, color1, color2)
      drawBar(val, -i * Math.PI * 2/ fftLength, color1, color2)
    }
  }

  if (effects & EFFECT_WAVE) {
    const width = canvas.width / fftLength
    ctx.beginPath()
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(0, halfY)
    for (let i = 0; i < fftLength; i++) {
      const val = wave[i] * canvas.height / 256
      color1 = getHsl(i*360/fftLength + direction, 100, 100)
      color2 = getHsl(i*360/fftLength + direction, 100, 50)
      drawWave(i * canvas.width / fftLength, halfY, i * canvas.width / fftLength, val, color1, color2)
    }
    ctx.stroke()
  }

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
  output.connect(analyser)
  analyser.connect(ac.destination)

  animationHandle = window.requestAnimationFrame(updateAnimation)
}

function toggleAnimation() {
  if (animationHandle) {
    window.cancelAnimationFrame(animationHandle)
    ctx.fillText('Paused', Math.floor(canvas.width / 2), 100)
    animationHandle = null
  } else {
    animationHandle = window.requestAnimationFrame(updateAnimation)
  }
}

function playTom(startFreq, endFreq) {
  playCurvedNoise(2, startFreq*2, endFreq*2, 0.1)
  playTone(1, startFreq, endFreq, 0, 0.02, 0, 1, 0.2)
}

function getNoteFrequency(frequency, note) {
  return frequency * Math.pow(Math.pow(2, 1/12), note)
}

function playChord(frequency, notes) {
  console.log('playChord', frequency, notes)
  notes.forEach(note => {
    freq = getNoteFrequency(freqency, note)
    console.log('freq', freq)
    playOrgan(0.3, freq, freq, 0.1, 0.02, 0.02, 0.4, 0.1)
    //playCurvedNoise(200, freq, freq, 0.5, 1000)
  })
}

function playSequencer() {
  sequencer.forEach(staff => {
    if (staff.on && (sequencerPos % staff.step) === 0) {
      const pos = (sequencerPos / staff.step) % staff.notes.length
      const note = staff.notes[pos]
      console.log(pos, note)
      if (Number.isInteger(note)) {
        const transposedNote = note + ((sequencerPos & 128) ? 2 : 0)
        const freq = getNoteFrequency(73, transposedNote)
        playBass(2.3, freq, freq, 0.1, 0.02, 0.02, 0.4, 0.1)
        playBass(1.3, freq/2, freq/2, 0.1, 0.02, 0.02, 0.4, 0.1)
      } else switch(note) {
        case 'a':
          playCurvedNoise(10, 150, 30, 0.14)
          playTone(1, 35, 35, 0, 0.02, 0, 1, 0.2)
          break
        case 'r':
          playCurvedNoise(1, 8000, 7500, 0.1)
          break
        case 's':
          playCurvedNoise(10, 350, 70, 0.18)
          break
        case 'y':
          playCurvedNoise(1, 8000, 7500, 0.3)
          break
      }
    }
  })
  sequencerPos++
  if (sequencerOn) {
    setTimeout(playSequencer, 100)
  }
}

document.onkeydown = function (e) {
  console.log('e.key', e.key)
  switch (e.key) {
    case ' ':
      sequencerPos = 0
      sequencerOn = !sequencerOn
      playSequencer()
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
      playBass(1, 73.4, 73.4, 10.356, 0.1, 0.15, .3, 0.05)
      break
    case 'p':
      toggleAnimation()
      break
    case 'u':
      playChord(220, chords[chordNum])
      chordNum = (chordNum + 1) % chords.length
      break
    case 'o':
      playChord(220, [0, 5, 9, 16, 21] )
      break
    case 'm':
      playChord(220, [0, 4, 9, 16, 21] )
      break
    case '0':
      sequencer[0].on = !sequencer[0].on
      break
    case '1':
      sequencer[1].on = !sequencer[1].on
      break
    case '2':
      sequencer[2].on = !sequencer[2].on
      break
    case '3':
      sequencer[3].on = !sequencer[3].on
      break
    case '4':
      sequencer[4].on = !sequencer[4].on
      break
  }
}

window.addEventListener('load', () => {
  run()
})
