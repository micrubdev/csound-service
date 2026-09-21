<CsoundSynthesizer>
<CsOptions>
-o out.wav -W
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

ga_dlL init 0
ga_dlR init 0

; p4 = freq, p5 = amp
; Overdriven lead guitar: Karplus-Strong string (bright impulse
; excitation) driven into soft-clip distortion, with pitch vibrato
; and a resonant bandpass to bring out a "wah"-ish formant.
instr 1
  ifreq  = p4
  iamp   = p5

  ; Bandlimited sawtooth (not Karplus-Strong, so it sustains and drives
  ; distortion like a real electric guitar/synth-lead, instead of decaying
  ; like the pluck instrument) into hard overdrive and a resonant filter
  ; with pitch vibrato.
  kvibhz = 6
  kvib   oscil 3, kvibhz              ; vibrato depth in Hz
  asaw   vco2 iamp, ifreq + kvib, 0

  adrive distort1 asaw, 12, 3, 0, 0
  aenv   linen adrive, 0.02, p3, 0.2

  afilt  reson aenv, ifreq * 3, ifreq * 1.2
  afilt  balance afilt, aenv

  aout   = afilt * 0.3
  aout   limit aout, -0.6, 0.6
  outs   aout, aout
  ga_dlL += aout
  ga_dlR += aout
endin

; tempo-synced stereo delay, feeding off everything written to ga_dlL/ga_dlR
instr 99
  idelay  = 0.375
  ifback  = 0.35
  awetL   delayr 2
  atapL   deltap idelay
  awetR   delayr 2
  atapR   deltap idelay

  ainL    = ga_dlL + atapR * ifback
  ainR    = ga_dlR + atapL * ifback
            delayw ainL
            delayw ainR
  ga_dlL  = 0
  ga_dlR  = 0

  aoutL   = atapL * 0.25
  aoutR   = atapR * 0.25
  aoutL   limit aoutL, -0.35, 0.35
  aoutR   limit aoutR, -0.35, 0.35
  outs    aoutL, aoutR
endin
</CsInstruments>
<CsScore>
; TEMPLATE_EVENTS
; TEMPLATE_EFFECTS_TAIL
</CsScore>
</CsoundSynthesizer>
