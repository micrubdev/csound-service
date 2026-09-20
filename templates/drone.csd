<CsoundSynthesizer>
<CsOptions>
-o out.wav -W
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 1
0dbfs = 1

; p4 = freq, p5 = amp
instr 1
  ifreq = p4
  iamp  = p5
  asig  oscil iamp, ifreq
  aenv  linen asig, 0.5, p3, 0.5
  out   aenv
endin
</CsInstruments>
<CsScore>
; TEMPLATE_EVENTS
</CsScore>
</CsoundSynthesizer>
