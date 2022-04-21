let canvas, ctx
let animationHandle = null

const sequencer = [
  {
    step: 32,
    notes: ['Hello Reaktor!', 'This is', 'WAA!', 'by Schwartz', '4kb intro', 'with JavaScript', 'Greetings to', '#demoscene']
  },
  {
    step: 1,
    instr: 'saw',
    notes: [0, 12, 12, 0, 12, 12, 0, 12, 13, 1, 13, -2, 10, 12, 0, 12],
  },
  {
    step: 2,
    notes: ['a', ''],
  },
  {
    step: 2,
    notes: ['', 'r'],
  },
  {
    step: 4,
    notes: ['', 's'],
  },
  {
    step: 1,
    notes: ['r', 'r', '', 'r', 'y', 'r', '', 'r']
  },
  {
    step: 4,
    notes: ['', 'i'],
  },
  {
    step: 8,
    notes: [0, -2, 0, '']
  },
  {
    step: 8,
    notes: [7, 5, 7, '']
  },
  {
    step: 8,
    notes: [10, 12, 10, '']
  },
  {
    step: 8,
    notes: [17, 15, 17, '']
  },
  {
    step: 16,
    instr: 'wind',
    notes: [24]
  }
]
sequencer.forEach(staff => {
  staff.pos = 0
  staff.on = false
})
sequencer[0].on = true
sequencer[1].on = true

let sequencerPos = 0
let sequencerOn = false

let text = 'press <space> to start'
let textX = 0
let textY = 0
let textStyle = 'black'

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
const EFFECT_MOVE  = 0b0000100
const EFFECT_FREQ  = 0b0001000
const EFFECT_WAVE  = 0b0010000
const EFFECT_TEXT  = 0b0100000
let effects =  EFFECT_CLEAR | /* EFFECT_MOVE | EFFECT_FREQ | EFFECT_WAVE  | */ EFFECT_TEXT

const ac = new AudioContext()

const analyser = ac.createAnalyser()
analyser.fftSize = 512
const fftLength = analyser.frequencyBinCount
let fft = new Uint8Array(fftLength)
let wave = new Uint8Array(fftLength)

const output = ac.createGain()
output.gain.value = 0.5

const NOISE_LENGTH = 44100
const noiseBuffer = ac.createBuffer(2, NOISE_LENGTH, 44100)
for (let channel = 0; channel < noiseBuffer.numberOfChannels; channel++) {
  const channelData = noiseBuffer.getChannelData(channel)
  for (let i = 0; i < noiseBuffer.length; i++) {
    channelData[i] = Math.random() * 2 - 1
  }
}

function getBandpass(time, startFreq, endFreq, duration, q=10) {
  const bandpass = ac.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.Q.value = q
  bandpass.frequency.setValueAtTime(startFreq, time)
  bandpass.frequency.linearRampToValueAtTime(endFreq, time + duration)
  return bandpass
}

function disconnect(nodes, atTime) {
  setTimeout(() => {
    nodes.forEach((node) => node.disconnect())
  }, 1000 * (atTime - ac.currentTime))
}

function playCurvedNoise(time, volume, startFreq, endFreq, duration, q=10) {
  const source = ac.createBufferSource()
  source.buffer = noiseBuffer
  source.loop = true
  const bandpass = getBandpass(time, startFreq, endFreq, duration, q)
  const envelope = ac.createGain()
  const endTime = time + duration
  envelope.gain.setValueAtTime(volume, time)
  envelope.gain.linearRampToValueAtTime(0, endTime)

  source.connect(bandpass)
  bandpass.connect(envelope)
  envelope.connect(output)
  disconnect([source, bandpass, envelope], endTime)
  source.start(time)
}

function getEnvelope(time, volume, duration, attack, decay, sustain, release) {
  const envelope = ac.createGain()
  envelope.gain.setValueAtTime(0, time)
  envelope.gain.linearRampToValueAtTime(volume, time + attack)
  envelope.gain.linearRampToValueAtTime(volume * sustain, time + attack + decay)
  envelope.gain.linearRampToValueAtTime(volume * sustain, time + attack + decay + duration)
  envelope.gain.linearRampToValueAtTime(0, time + attack + decay + duration + release)
  return envelope
}

function playSaw(time, volume, startFreq, endFreq, duration, attack, decay, sustain, release, q=10) {
  const source = ac.createOscillator()
  source.type = 'sawtooth'

  const filterFreq = (-Math.sin(-sequencerPos * Math.PI / 16)) * startFreq + startFreq
  const filter = getBandpass(time, startFreq * 2+ filterFreq, filterFreq, attack + decay + duration + release, q)

  const envelope = getEnvelope(time, volume, duration, attack, decay, sustain, release)
  const endTime = time + attack + decay + duration + release

  source.frequency.setValueAtTime(startFreq, time)
  source.frequency.linearRampToValueAtTime(endFreq, endTime)
  source.connect(filter)
  filter.connect(envelope)
  envelope.connect(output)
  disconnect([source, envelope], endTime)
  source.start(time)
}

function playTone(time, volume, startFreq, endFreq, duration, attack, decay, sustain, release) {
  const osc = ac.createOscillator()
  const wave = ac.createPeriodicWave([0, 1], [0, 0])
  const endTime = time + attack + decay + duration + release
  osc.setPeriodicWave(wave)
  osc.frequency.setValueAtTime(startFreq, time)
  osc.frequency.linearRampToValueAtTime(endFreq, endTime)

  const envelope = getEnvelope(time, volume, duration, attack, decay, sustain, release)
  osc.connect(envelope)
  envelope.connect(output)
  disconnect([osc, envelope], endTime)
  osc.start(time)
}

function playOrgan(time, volume, startFreq, endFreq, duration, attack, decay, sustain, release) {
  const osc = ac.createOscillator()
  const wave = ac.createPeriodicWave([0, 1, 0.1, 0.55], [0, 0, 0, 0])
  const endTime = time + attack + decay + duration + release
  osc.setPeriodicWave(wave)
  osc.frequency.setValueAtTime(startFreq, time)
  osc.frequency.linearRampToValueAtTime(endFreq, endTime)

  const envelope = getEnvelope(time, volume, duration, attack, decay, sustain, release)
  osc.connect(envelope)
  envelope.connect(output)
  disconnect([osc, envelope], endTime)
  osc.start(time)
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

/*
function makeDistortionCurve(amount) {
  const n_samples = 44100
  const curve = new Float32Array(n_samples)
  const deg = Math.PI / 180
  for (let i = 0 ; i < n_samples; ++i ) {
    const x = i * 2 / n_samples - 1
    curve[i] = ( 3 + amount ) * x * 20 * deg / ( Math.PI + amount * Math.abs(x) )
  }
  return curve
}

function getDistortion(amount) {
  const distortion = ac.createWaveShaper()
  distortion.curve = makeDistortionCurve(amount)
  return distortion
}
*/

/*
function playBass(time, volume, startFreq, endFreq, duration, attack, decay, sustain, release) {
  const osc = ac.createOscillator()
  const wave = ac.createPeriodicWave([0, 1, 1], [0, 0, 0])
  const endTime = time + attack + decay + duration + release
  osc.setPeriodicWave(wave)
  osc.frequency.setValueAtTime(startFreq, time)

  const envelope = getEnvelope(time, volume, duration, attack, decay, sustain, release)
  //const distortion = getDistortion(160)

  osc.connect(distortion)
  distortion.connect(envelope)
  envelope.connect(output)
  disconnect([osc, distortion, envelope], endTime)

  osc.start(time)
}
*/

function getHsl(r, g, b) {
  return `hsl(${r},${g}%,${b}%)`
}

function getGradient(x1, y1, x2, y2, color1, color2) {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  gradient.addColorStop(0, color1)
  gradient.addColorStop(1, color2)
  return gradient
}

function updateAnimation() {
  if (effects & EFFECT_CLEAR) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  function drawBar(val, angle, color1, color2) {
    const rotatedAngle = angle + ac.currentTime
    const x = Math.sin(rotatedAngle)*val + halfX
    const y = Math.cos(rotatedAngle)*val + halfY
    ctx.strokeStyle = getGradient(halfX, halfY, x, y, color1, color2)
    ctx.beginPath()
    ctx.moveTo(halfX, halfY)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function drawWave(x1, y1, x2, y2) {
    if (x1 === 0) {
      ctx.moveTo(x2, y2)
    } else {
      ctx.lineTo(x2, y2)
    }
  }

  const halfX = canvas.width / 2
  const halfY = canvas.height / 2

  analyser.getByteFrequencyData(fft);
  analyser.getByteTimeDomainData(wave)

  direction = direction + fft[Math.floor(fftLength / 4)] / 200

  if (effects & EFFECT_TEXT)  {
    ctx.fillStyle = textStyle
    ctx.textBaseline = 'middle';
    ctx.fillText(text, textX, textY)
    ctx.fillText(text, canvas.width - textX, canvas.height - textY)
  }


  if (effects & EFFECT_MOVE) {
    const imageData = ctx.getImageData(2, 2, canvas.width-4, canvas.height-4)
    const strength = fft[0] / 10
    ctx.putImageData(imageData, Math.round(strength*Math.sin(direction))+2, Math.round(strength*Math.cos(direction))+2)
  }

  if (effects & EFFECT_FREQ) {
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    for (let i = 0; i < fftLength/2; i++) {
      const val = fft[i+3]*halfX / 256
      const color1 = getHsl(i*360/fftLength + direction, val, 0)
      const color2 = getHsl(i*360/fftLength + direction, val, 50)
      drawBar(val, i * Math.PI * 2/ fftLength, color1, color2)
      drawBar(val, -i * Math.PI * 2/ fftLength, color1, color2)
    }
  }

  if (effects & EFFECT_WAVE) {
    const width = canvas.width / (fftLength-1)
    ctx.beginPath()
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    for (let i = 0; i < fftLength; i++) {
      const val = wave[i] * canvas.height / 256
      const color1 = getHsl(1/5*i*360/fftLength + direction, 100, 50)
      const color2 = getHsl(1/5*i*360/fftLength + direction, 100, 50)
      drawWave(i * width, halfY, i * width, val, color1, color2)
    }
    const color1 = getHsl(direction, 100, 50)
    const color2 = getHsl(100 + direction, 100, 50)
    ctx.strokeStyle = getGradient(0, 0, canvas.width, canvas.height, color1, color2)
    ctx.stroke()
  }

  if (effects & EFFECT_TEXT)  {
    textStyle = getGradient(
      0,
      0,
      canvas.width,
      canvas.height,
      getHsl(sequencerPos, 100, 40),
      getHsl(sequencerPos, 100, 40))
    textX = halfX + fft[10]*halfY/256/2
    textY = halfY + fft[1]*halfY/256/2
    ctx.fillStyle = 'white'
    ctx.fillText(text, textX, textY)
    ctx.fillText(text, canvas.width - textX, canvas.height - textY)
  }

  animationHandle = window.requestAnimationFrame(updateAnimation)
}

function run() {
  canvas = document.getElementById('canvas')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  ctx = canvas.getContext('2d')
  ctx.font = "40px Georgia";
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'
//  const reverb = getReverb(5.0)
//  output.connect(reverb)
//  reverb.connect(analyser)
  output.connect(analyser)
  analyser.connect(ac.destination)

  animationHandle = window.requestAnimationFrame(updateAnimation)
}

function toggleAnimation() {
  if (animationHandle) {
    window.cancelAnimationFrame(animationHandle)
    ctx.fillText('Visuals paused', Math.floor(canvas.width / 2), Math.floor(canvas.height / 2))
    animationHandle = null
  } else {
    animationHandle = window.requestAnimationFrame(updateAnimation)
  }
}

function playTom(time, startFreq, endFreq) {
  playCurvedNoise(time, 2, startFreq*2, endFreq*2, 0.1)
  playTone(time, 1, startFreq, endFreq, 0, 0.02, 0, 1, 0.2)
}

function getNoteFrequency(frequency, note) {
  return frequency * Math.pow(Math.pow(2, 1/12), note)
}

function playChord(time, frequency, notes) {
  notes.forEach(note => {
    freq = getNoteFrequency(frequency, note)
    playOrgan(time, 0.3, freq, freq, 0.1, 0.02, 0.02, 0.4, 0.1)
    //playCurvedNoise(200, freq, freq, 0.5, 1000)
  })
}

let sequencerNoteTime = 0
const scheduleAheadTime = 0.2
const lookahead = 25
const beatDuration = 0.1
let sequencerPreviousNoteTime = 0

function playSequencer() {
  while (sequencerNoteTime < ac.currentTime + scheduleAheadTime) {
    console.log(sequencerNoteTime - sequencerPreviousNoteTime, sequencerNoteTime - ac.currentTime)
    sequencerPreviousNoteTime = sequencerNoteTime
    sequencer.forEach((staff) => {
      if (staff.on && (sequencerPos % staff.step) === 0) {
        const pos = (sequencerPos / staff.step) % staff.notes.length
        const note = staff.notes[pos]
        if (Number.isInteger(note)) {
          const transposedNote = note + ((sequencerPos & 128) ? 2 : 0)
          const freq = getNoteFrequency(73, transposedNote)
          switch (staff.instr) {
            case 'saw':
              playSaw(sequencerNoteTime, 2.5, freq/2, freq/2, 0.03, 0.05, 0.01, 0.2, 0.3, 10)
              playSaw(sequencerNoteTime, 2.5, freq, freq, 0.03, 0.05, 0.01, 0.2, 0.3, 10)
              break
            case 'wind':
              const f = Math.floor(freq)
              playCurvedNoise(sequencerNoteTime, 2.5, f, f*6, 2, 20)
              break
            default:
              playOrgan(sequencerNoteTime, 0.4, freq, freq, 0.1, 0.02, 0.02, 0.4, 0.1)
              break
          }
        } else if (note.length > 1) {
          text = note
          ctx.font = "100px Georgia";
        } else {
          switch(note) {
            case 'a':
              playCurvedNoise(sequencerNoteTime, 10, 150, 30, 0.14)
              playTone(sequencerNoteTime, 1, 35, 35, 0, 0.02, 0, 1, 0.2)
              break
            case 'r':
              playCurvedNoise(sequencerNoteTime, 1, 8000, 7500, 0.1)
              break
            case 's':
              playCurvedNoise(sequencerNoteTime, 10, 350, 70, 0.18)
              break
            case 'y':
              playCurvedNoise(sequencerNoteTime, 1, 8000, 7500, 0.3)
              break
            case 'i':
              playCurvedNoise(sequencerNoteTime, 0.25, 2500, 2500, 0.5)
              playCurvedNoise(sequencerNoteTime, 0.5, 5000, 5000, 0.5)
              playCurvedNoise(sequencerNoteTime, 0.5, 10000, 10000, 0.5)
              playCurvedNoise(sequencerNoteTime, 1, 15000, 15000, 0.5)
              break
          }
        }
      }
    })
    sequencerPos++
    sequencerNoteTime += beatDuration
  }
  if (sequencerOn) {
    setTimeout(playSequencer, lookahead)
  }
}

document.onkeydown = function (e) {
  console.log('e.key', e.key)
  switch (e.key) {
    case ' ':
      sequencerPos = 0
      sequencerOn = !sequencerOn
      sequencerNoteTime = ac.currentTime + beatDuration
      playSequencer()
      break
    case 'a':
      playCurvedNoise(ac.currentTime, 10, 150, 30, 0.14)
      playTone(ac.currentTime, 1, 35, 35, 0, 0.02, 0, 1, 0.2)
      break
    case 's':
      playCurvedNoise(ac.currentTime, 10, 350, 70, 0.18)
      //playCurvedNoise(250, 200, 0.05)
      break
    case 'r':
      playCurvedNoise(ac.currentTime, 1, 8000, 7500, 0.1)
      break
    case 't':
      playCurvedNoise(ac.currentTime, 1, 8000, 7500, 0.2)
      break
    case 'y':
      playCurvedNoise(ac.currentTime, 1, 8000, 7500, 0.3)
      break
    case 'j':
      playTom(ac.currentTime, 250, 210)
      break
    case 'h':
      playTom(ac.currentTime, 210, 177)
      break
    case 'g':
      playTom(ac.currentTime, 177, 149)
      break
    case 'f':
      playTom(ac.currentTime, 149, 125)
      break
    case 'i':
      playCurvedNoise(ac.currentTime, 0.5, 2500, 2500, 0.5)
      playCurvedNoise(ac.currentTime, 1, 5000, 5000, 0.5)
      playCurvedNoise(ac.currentTime, 1, 10000, 10000, 0.5)
      playCurvedNoise(ac.currentTime, 2, 15000, 15000, 0.5)
      break
    // case 'q':
    //   playBass(ac.currentTime, 1, 73.4, 73.4, 10.356, 0.1, 0.15, .3, 0.05)
    //   break
    case 'p':
      toggleAnimation()
      break
    case 'u':
      playChord(ac.currentTime, 220, chords[chordNum])
      chordNum = (chordNum + 1) % chords.length
      break
    case 'o':
      playChord(ac.currentTime, 220, [0, 5, 9, 16, 21] )
      break
    case 'm':
      playChord(ac.currentTime, 220, [0, 4, 9, 16, 21] )
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
    case '5':
      sequencer[5].on = !sequencer[5].on
      break
    case '6':
      sequencer[6].on = !sequencer[6].on
      break
    case '7':
      sequencer[7].on = !sequencer[7].on
      sequencer[8].on = !sequencer[8].on
      sequencer[9].on = !sequencer[9].on
      sequencer[10].on = !sequencer[10].on
      break
    case '8':
      sequencer[11].on = !sequencer[11].on
      break
    case 'z':
      effects ^= EFFECT_CLEAR
      break
    case 'x':
      effects ^= EFFECT_MOVE
      break
    case 'c':
      effects ^= EFFECT_WAVE
      break
    case 'v':
      effects ^= EFFECT_FREQ
      break
  }
}

window.addEventListener('load', () => {
  run()
})
