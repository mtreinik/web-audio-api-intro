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

