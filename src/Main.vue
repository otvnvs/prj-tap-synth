<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AudioUtils from './components/AudioUtils.vue'
import { Keyboard } from './utils/keyboard.js'

let pianoController = null 

onMounted(() => {
  pianoController = new Keyboard({})
  pianoController.init()
})

onUnmounted(() => {
  if (pianoController) {
    pianoController.destroy()
  }
})

let audioCtx = null 
let reverbNode = null 
const activeVoices = new Map()

const padStates = ref({
  pad1: { detune: 0, filterFreq: 3000, pressed: false },
  pad2: { detune: 0, filterFreq: 3000, pressed: false },
  pad3: { detune: 0, filterFreq: 3000, pressed: false },
  pad4: { detune: 0, filterFreq: 3000, pressed: false }
})

const waveTypes = {
  pad1: 'triangle',
  pad2: 'sawtooth',
  pad3: 'square',
  pad4: 'sawtooth'
}

const reverbMixLevel = ref(0.3)
const reverbPressed = ref(false)
const activeGlows = ref([])

const createReverbBuffer = () => {
  const sampleRate = audioCtx.sampleRate 
  const length = sampleRate * 4.5 
  const buffer = audioCtx.createBuffer(2, length, sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const channelData = buffer.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5)
    }
  }
  return buffer
}

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    reverbNode = audioCtx.createConvolver()
    reverbNode.buffer = createReverbBuffer()
    reverbNode.connect(audioCtx.destination)
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
}

const calculateMainPadTimbre = (x, y, rect) => {
  const normX = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
  const normY = Math.max(0, Math.min(1, (y - rect.top) / rect.height))
  return { detune: (0.5 - normY) * 80, filterFreq: 400 + normX * 5500 }
}

const updateReverbTimbre = (x, rect) => {
  const normX = Math.max(0, Math.min(1, (x - rect.left) / rect.width))
  reverbMixLevel.value = parseFloat(normX.toFixed(2))
}

const getPadStyle = (padKey) => {
  const state = padStates.value[padKey]
  const hue = 180 + (state.detune / 200) * 120 
  const saturation = 30 + ((state.filterFreq - 400) / 5500) * 60 
  const lightness = state.pressed ? 24 : 12 
  return {
    backgroundColor: `hsl(${hue},${saturation}%,${lightness}%)`,
    borderColor: state.pressed ? `hsl(${hue},${saturation}%,60%)` : '#222'
  }
}

const getGlowColor = (padKey) => {
  if (padKey === 'pad1') return 'rgba(0, 229, 255, 0.4)'
  if (padKey === 'pad2') return 'rgba(80, 250, 123, 0.4)'
  if (padKey === 'pad3') return 'rgba(255, 184, 108, 0.4)'
  if (padKey === 'pad4') return 'rgba(255, 85, 85, 0.4)'
  return 'rgba(255, 255, 255, 0.25)'
}

const handleTouchStart = (e) => {
  e.preventDefault()
  initAudio()
  const changedTouches = e.changedTouches || [e]
  for (const touch of changedTouches) {
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    if (!el) continue 
    const id = touch.identifier ?? 'mouse'
    if (activeVoices.has(id)) continue 
    const rect = el.getBoundingClientRect()
    if (el.dataset.pad) {
      const padKey = el.dataset.pad 
      const timbre = calculateMainPadTimbre(touch.clientX, touch.clientY, rect)
      padStates.value[padKey].detune = timbre.detune 
      padStates.value[padKey].filterFreq = timbre.filterFreq 
      padStates.value[padKey].pressed = true 
      const instNum = parseInt(padKey.replace('pad', ''))
      let baseFreq = 440 
      if (window.AudioUtils) {
        baseFreq = window.AudioUtils.getInstrumentFrequency(instNum)
      }
      const osc = audioCtx.createOscillator()
      const oscSub = audioCtx.createOscillator()
      const filter = audioCtx.createBiquadFilter()
      const dryGain = audioCtx.createGain()
      const wetGain = audioCtx.createGain()
      if (padKey === 'pad1') {
        osc.type = 'square'
        oscSub.type = 'square'
        oscSub.frequency.setValueAtTime(baseFreq * 0.5, audioCtx.currentTime)
      } else {
        osc.type = waveTypes[padKey]
        oscSub.type = waveTypes[padKey]
        oscSub.frequency.setValueAtTime(baseFreq, audioCtx.currentTime)
      }
      osc.frequency.setValueAtTime(baseFreq, audioCtx.currentTime)
      osc.detune.setValueAtTime(padStates.value[padKey].detune, audioCtx.currentTime)
      oscSub.detune.setValueAtTime(padStates.value[padKey].detune + 8, audioCtx.currentTime)
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(padStates.value[padKey].filterFreq, audioCtx.currentTime)
      dryGain.gain.setValueAtTime(0, audioCtx.currentTime)
      dryGain.gain.linearRampToValueAtTime(0.20, audioCtx.currentTime + 0.03)
      wetGain.gain.setValueAtTime(0, audioCtx.currentTime)
      wetGain.gain.linearRampToValueAtTime(reverbMixLevel.value * 0.4, audioCtx.currentTime + 0.03)
      osc.connect(filter)
      oscSub.connect(filter)
      filter.connect(dryGain).connect(audioCtx.destination)
      filter.connect(wetGain).connect(reverbNode)
      osc.start()
      oscSub.start()
      activeVoices.set(id, { isReverbPad: false, osc, oscSub, filter, dryGain, wetGain, padKey })
      activeGlows.value.push({ id, x: touch.clientX, y: touch.clientY, color: getGlowColor(padKey) })
    } else if (el.classList.contains('reverb-pad')) {
      updateReverbTimbre(touch.clientX, rect)
      reverbPressed.value = true 
      activeVoices.forEach((voice) => {
        if (!voice.isReverbPad) {
          voice.wetGain.gain.setValueAtTime(reverbMixLevel.value * 0.4, audioCtx.currentTime)
        }
      })
      activeVoices.set(id, { isReverbPad: true, el })
      activeGlows.value.push({ id, x: touch.clientX, y: touch.clientY, color: getGlowColor('reverb') })
    }
  }
}

const handleTouchMove = (e) => {
  e.preventDefault()
  const changedTouches = e.changedTouches || [e]
  for (const touch of changedTouches) {
    const id = touch.identifier ?? 'mouse'
    const voice = activeVoices.get(id)
    if (!voice) continue 
    const glowIndex = activeGlows.value.findIndex(g => g.id === id)
    if (glowIndex !== -1) {
      activeGlows.value[glowIndex].x = touch.clientX 
      activeGlows.value[glowIndex].y = touch.clientY
    }
    if (!voice.isReverbPad) {
      const el = document.querySelector(`[data-pad="${voice.padKey}"]`)
      if (!el) continue 
      const rect = el.getBoundingClientRect()
      const timbre = calculateMainPadTimbre(touch.clientX, touch.clientY, rect)
      padStates.value[voice.padKey].detune = timbre.detune 
      padStates.value[voice.padKey].filterFreq = timbre.filterFreq 
      voice.osc.detune.setValueAtTime(timbre.detune, audioCtx.currentTime)
      voice.oscSub.detune.setValueAtTime(timbre.detune + 8, audioCtx.currentTime)
      voice.filter.frequency.setValueAtTime(timbre.filterFreq, audioCtx.currentTime)
    } else {
      const rect = voice.el.getBoundingClientRect()
      updateReverbTimbre(touch.clientX, rect)
      activeVoices.forEach((v) => {
        if (!v.isReverbPad) {
          v.wetGain.gain.setValueAtTime(reverbMixLevel.value * 0.4, audioCtx.currentTime)
        }
      })
    }
  }
}

const handleTouchEnd = (e) => {
  e.preventDefault()
  const changedTouches = e.changedTouches || [e]
  for (const touch of changedTouches) {
    const id = touch.identifier ?? 'mouse'
    activeGlows.value = activeGlows.value.filter(g => g.id !== id)
    const voice = activeVoices.get(id)
    if (!voice) continue 
    if (!voice.isReverbPad) {
      voice.dryGain.gain.setValueAtTime(voice.dryGain.gain.value, audioCtx.currentTime)
      voice.dryGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08)
      voice.wetGain.gain.setValueAtTime(voice.wetGain.gain.value, audioCtx.currentTime)
      voice.wetGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08)
      voice.osc.stop(audioCtx.currentTime + 0.08)
      voice.oscSub.stop(audioCtx.currentTime + 0.08)
      padStates.value[voice.padKey].pressed = false
    } else {
      reverbPressed.value = false
    }
    activeVoices.delete(id)
  }
}
</script>
<template>
  <div class="mobile-container">
    <AudioUtils />

    <!-- DYNAMIC OVERLAY CONTAINER FOR RENDERING LIVE UNDER-FINGER GLOW LAYER -->
    <div 
      v-for="glow in activeGlows" 
      :key="glow.id" 
      class="finger-glow-node" 
      :style="{
        left: `${glow.x}px`,
        top: `${glow.y}px`,
        background: `radial-gradient(circle, ${glow.color} 0%, rgba(0,0,0,0) 70%)`
      }"
    ></div>

    <!-- MAIN INTERFACE (TOUCH & MOUSE TARGET AREA ONLY) -->
    <div 
      class="interface-wrapper"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd"
      @mousedown="handleTouchStart"
      @mousemove="handleTouchMove"
      @mouseup="handleTouchEnd"
      @mouseleave="handleTouchEnd"
    >
      <div class="button-grid">
        <div data-pad="pad1" class="pad-btn" :style="getPadStyle('pad1')">
          Pulse
          <span class="key-hint">Q</span>
        </div>
        <div data-pad="pad2" class="pad-btn" :style="getPadStyle('pad2')">
          Triangle
          <span class="key-hint">W</span>
        </div>
        <div data-pad="pad3" class="pad-btn" :style="getPadStyle('pad3')">
          Square
          <span class="key-hint">E</span>
        </div>
        <div data-pad="pad4" class="pad-btn" :style="getPadStyle('pad4')">
          Sawtooth
          <span class="key-hint">R</span>
        </div>
      </div>

      <div class="reverb-pad" :class="{ pressed: reverbPressed }">
        Reverb Mix: {{ Math.round(reverbMixLevel * 100) }}%
      </div>
    </div>

    <!-- DESKTOP KEYBOARD GUIDANCE BANNER (SITS OUTSIDE THE INTERFACE CONTAINER) -->
    <div class="keyboard-guide-banner">
      <span class="hint-icon">Use Keys:</span>
      <div class="key-badge-row">
        <span class="key-badge">Q</span>
        <span class="key-badge">W</span>
        <span class="key-badge">E</span>
        <span class="key-badge">R</span>
      </div>
      <span class="hint-action">to play notes</span>
    </div>
  </div>
</template>

<style scoped>
.mobile-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #050505;
  font-family: monospace;
  user-select: none;
  -webkit-user-select: none;
  box-sizing: border-box;
  overflow: hidden;
  padding: 16px;
}

.finger-glow-node {
  position: fixed;
  width: 130px;
  height: 130px;
  border-radius: 50%;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 9999;
  mix-blend-mode: screen;
}

.interface-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 90vw;
  max-width: 440px;
  height: 70vh;
  z-index: 10;
}

.button-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 4;
}

.pad-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #222;
  border-radius: 6px;
  font-size: 1rem;
  color: #777;
  touch-action: none;
  transition: background-color 0.05s, border-color 0.05s;
}

/* Embedded shortcut hint labels inside the pads */
.key-hint {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 0.75rem;
  font-weight: bold;
  color: #444;
  border: 1px solid #222;
  padding: 2px 5px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.3);
}

.pad-btn[style*="lightness(24%)"] .key-hint {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.4);
}

.reverb-pad {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #222;
  border-radius: 6px;
  font-size: 0.9rem;
  background-color: #0f0f0f;
  color: #555;
  flex: 1;
  touch-action: none;
}

.pad-btn[style*="lightness(24%)"],
.reverb-pad.pressed {
  color: #fff;
  border-color: #555;
}

/* Bottom desktop keyboard hint block */
.keyboard-guide-banner {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 10;
  color: #666;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
}

.key-badge-row {
  display: flex;
  gap: 6px;
}

.key-badge {
  display: inline-block;
  border: 1px solid #333;
  border-bottom: 2px solid #444;
  border-radius: 4px;
  padding: 4px 10px;
  background-color: #111;
  color: #aaa;
  font-weight: bold;
  text-transform: uppercase;
}

/* --- Desktop Only Key Hints Sizing & Layout --- */
.keyboard-guide-banner {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 10;
  color: #666;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
}

.key-badge-row {
  display: flex;
  gap: 6px;
}

.key-badge {
  display: inline-block;
  border: 1px solid #333;
  border-bottom: 2px solid #444;
  border-radius: 4px;
  padding: 4px 10px;
  background-color: #111;
  color: #aaa;
  font-weight: bold;
  text-transform: uppercase;
}

.key-hint {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 0.75rem;
  font-weight: bold;
  color: #444;
  border: 1px solid #222;
  padding: 2px 5px;
  border-radius: 4px;
  background-color: rgba(0, 0, 0, 0.3);
}

.pad-btn[style*="lightness(24%)"] .key-hint {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.4);
}


/* =========================================================================
   MOBILE & TABLET MEDIA QUERY (HIDES KEYBOARD HINTS ON SMALL SCREENS)
   ========================================================================= */
@media (max-width: 768px) {
  /* Hides the bottom instructional banner */
  .keyboard-guide-banner {
    display: none !important;
  }
  
  /* Hides the small individual letters inside each synth pad button */
  .key-hint {
    display: none !important;
  }
}

</style>

