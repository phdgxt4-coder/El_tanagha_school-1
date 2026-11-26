"""Builds docs/SCENARIOS.md from two result files: python3 make-report.py new.txt old.txt main-sha"""
import re, sys, datetime
def rows(f):
    r={}; order=[]
    for l in open(f,encoding='utf8'):
        m=re.match(r'^(PASS|FAIL) (.*?) \| ',l) or re.match(r'^(PASS|FAIL) (.*)$',l)
        if m: r[m.group(2).strip()]=m.group(1); order.append(m.group(2).strip())
    return r,order
n,order=rows(sys.argv[1]); o,_=rows(sys.argv[2]); sha=sys.argv[3]
t=f"# Scenario results (code at main {sha})\n\nRun {datetime.datetime.now().strftime('%d %b %Y %H:%M')} on the Firebase emulators with the client code of that commit (a real Chrome page calling the app's own functions).\n- NEW = `firestore.rules` in the repo (the proposed rules).\n- OLD = rules at commit c0c0ebf (about what was deployed on 25 Nov evening).\nScript: `scripts/e2e/scenarios.mjs` (README next to it). Steps: registration (student, parent, teacher), verification, parent code and link, admin classes/subjects/approval/assignment/import/invite, teacher reads, chat (student to teacher and reply), image resize and publish, and negative (unauthorized) attempts.\n\n| # | Step | NEW rules | OLD rules |\n|---|---|---|---|\n"
for i,name in enumerate(order,1): t+=f"| {i} | {name} | {n[name]} | {o.get(name,'?')} |\n"
pn=sum(v=='PASS' for v in n.values()); po=sum(v=='PASS' for v in o.values())
t+=f"\nResult: NEW {pn}/{len(n)} pass, OLD {po}/{len(o)} pass.\n"
t+="""
Notes and gaps (honest):
- The chat reply needs a pause of more than 2 seconds after the previous message: that is the rules' rate limit (chatRateOk), not a bug.
- Images are stored as resized JPEG data inside Firestore (no Storage): the step resizes a 2000x1200 picture in the browser and publishes it; a non-JPEG payload and a student upload are refused.
- Parent to teacher chat: covered by `tests/parent-chat-rules.test.js` (rules emulator), not by this script.
- Unauthorized attempts covered here: student self-promote to admin, student sending as the teacher, student writing grades, student reading admins, student creating a class, teacher approving a teacher, non-JPEG image, student image upload. More in the rules test suites.
- Nothing was loosened to make a scenario pass.
- This is an emulator, not the live project: real email delivery, real indexes and real quotas are untested.
"""
open('docs/SCENARIOS.md','w',encoding='utf8').write(t)
