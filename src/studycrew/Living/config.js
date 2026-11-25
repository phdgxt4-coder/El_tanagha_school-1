/* Living layer config: every threshold, window and tier in one place. */
export const LIVING={
  storageKey:'sc.living',
  /* Contexts where the crew must stay quiet. 'exam' is absolute: no motion, sound, bubbles or confetti. */
  focus:{
    exam:{motion:false,sound:false,bubbles:false,celebrate:'none',haptics:false},
    reading:{motion:false,sound:false,bubbles:false,celebrate:'glow',haptics:false},
    typing:{motion:false,sound:false,bubbles:false,celebrate:'glow',haptics:false},
    searching:{motion:true,sound:false,bubbles:true,celebrate:'sparkles',haptics:false},
    browsing:{motion:true,sound:true,bubbles:true,celebrate:'full',haptics:true}
  },
  tiers:['none','glow','sparkles','confetti','full'],
  eventTier:{tap:'none',save:'glow',goodScore:'sparkles',perfectScore:'confetti',achievement:'confetti',firstExam:'confetti',weekStreak:'full',longStreak:'full'},
  delight:{minGapMs:20*60*1000,chance:0.15,maxPerDay:3},
  frustration:{repeatToHelp:2,windowMs:60000},
  welcomeBackMs:3*24*3600*1000,
  streak:{week:7,long:30},
  quality:{lowMemoryGb:2,lowCores:4,frameBudgetMs:34,badFramesToDowngrade:8},
  memory:{maxItems:20,maxAgeMs:30*24*3600*1000},
  /* Hijri month numbers (Umm al-Qura via Intl). */
  seasons:{ramadan:{month:9},eidFitr:{month:10,fromDay:1,toDay:3},eidAdha:{month:12,fromDay:10,toDay:13}},
  dayparts:{night:[22,5],morning:[5,12],afternoon:[12,18],evening:[18,22]},
  schoolYearStart:{month:9,days:7}, /* first week of September: estimate, edit per year */
  summer:{months:[6,7,8]},winter:{months:[12,1,2]}
};
