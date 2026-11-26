"""Copies the table and result line of docs/SCENARIOS.md into the scenario section of HANDOFF.md."""
import re
sc=open('docs/SCENARIOS.md',encoding='utf8').read()
block=sc[sc.index('| # | Step'):sc.index('Notes and gaps')].strip()
h=open('HANDOFF.md',encoding='utf8').read()
if '<!--SC-->' not in h:
    a=h.index('| # | Step'); b=h.index('الثغرات بصراحة')
    h=h[:a]+'<!--SC-->\n'+block+'\n<!--/SC-->\n\n'+h[b:]
else:
    h=re.sub(r'<!--SC-->.*<!--/SC-->','<!--SC-->\n'+block.replace('\\','\\\\')+'\n<!--/SC-->',h,flags=re.S)
open('HANDOFF.md','w',encoding='utf8').write(h)
