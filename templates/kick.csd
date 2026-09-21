<CsoundSynthesizer>
<CsOptions>
-o out.wav -W
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

; p4 = pitch (Hz, start of the pitch sweep), p5 = amp
; Synthesized 909-style kick: a fast pitch sweep from p4*6 down to p4,
; a punchy amp envelope, and a short high-passed click transient on top.
instr 1
  ifreq  = p4
  iamp   = p5

  kpitch expseg ifreq * 6, 0.045, ifreq, p3 - 0.045, ifreq
  abody  oscil iamp, kpitch
  aenv   expseg 1, 0.01, 1, p3 - 0.01, 0.001
  abody  = abody * aenv

  aclick oscil iamp * 0.25, 1800
  aclick butterhp aclick, 800
  aclickenv expseg 1, 0.003, 0.001, 0.05, 0.0001
  aclick = aclick * aclickenv

  aout   = abody + aclick
  outs   aout, aout
endin
</CsInstruments>
<CsScore>
; TEMPLATE_EVENTS
</CsScore>
</CsoundSynthesizer>
