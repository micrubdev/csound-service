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
instr 1
  ifreq = p4
  iamp  = p5
  asig  oscil iamp, ifreq
  aenv  linen asig, 0.5, p3, 0.5
  aenv  = aenv * 0.6   ; headroom for overlapping/stacked sustained notes
  aenv  clip aenv, 0, 0.95
  outs  aenv, aenv
  ga_dlL += aenv
  ga_dlR += aenv
endin

; tempo-synced stereo delay, feeding off everything written to ga_dlL/ga_dlR
instr 99
  idelay  = 0.375   ; echo time
  ifback  = 0.45    ; feedback
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

  aoutL   = atapL * 0.5
  aoutR   = atapR * 0.5
  aoutL   clip aoutL, 0, 0.95
  aoutR   clip aoutR, 0, 0.95
  outs    aoutL, aoutR
endin
</CsInstruments>
<CsScore>
; TEMPLATE_EVENTS
; TEMPLATE_EFFECTS_TAIL
</CsScore>
</CsoundSynthesizer>
