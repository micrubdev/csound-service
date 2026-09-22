<CsoundSynthesizer>
<CsOptions>
-o out.wav -W
</CsOptions>
<CsInstruments>
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

; p4 = tone freq (body pitch), p5 = amp
; Synthesized snare: a short pitched body (like the kick's, but higher
; and shorter) layered with bandpassed noise for the "snap".
instr 1
  ifreq  = p4
  iamp   = p5

  abody  oscil iamp * 0.5, ifreq
  abenv  expseg 1, 0.008, 1, p3 - 0.008, 0.001
  abody  = abody * abenv

  anoise rand iamp
  anoise butterbp anoise, 1800, 1600
  anenv  expseg 1, 0.004, 1, p3 - 0.004, 0.0005
  anoise = anoise * anenv

  aout   = abody + anoise
  aout   limit aout, -0.9, 0.9
  outs   aout, aout
endin
</CsInstruments>
<CsScore>
; TEMPLATE_EVENTS
</CsScore>
</CsoundSynthesizer>
