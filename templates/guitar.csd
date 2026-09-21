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

  asig   pluck iamp, ifreq, ifreq, 0, 1

  adrive distort1 asig, 6, 0.6, 0, 0
  aenv   linen adrive, 0.01, p3, 0.15

  kvibhz = 5.5
  kvib   oscil 0.006, kvibhz          ; subtle pitch vibrato via resonant sweep
  afilt  reson aenv, ifreq * (2.5 + kvib), ifreq * 1.5
  afilt  balance afilt, aenv

  aout   = afilt * 0.32
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
