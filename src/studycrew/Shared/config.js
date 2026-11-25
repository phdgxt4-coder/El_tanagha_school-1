/* Central configuration. Every limit, key and name the framework uses lives here (or in Themes/tokens.js for visuals). */
export const CONFIG={
  storageKey:'sc.prefs',
  logPrefix:'[study-crew]',
  logLevel:'warn',              /* 'debug' | 'info' | 'warn' | 'error' | 'silent' */
  slots:{main:'main',popup:'popup',notification:'notification',loading:'loading'},
  /* Performance and size budget (proposals, tune after measuring on real devices). Bytes. */
  budget:{characterFile:400*1024,firstLoadCharacter:150*1024,frameworkJsGzip:12*1024,soundFile:30*1024,maxLiveCharacters:2,maxParticles:40},
  assetExtensions:['.riv','.json','.lottie','.svg','.webp','.mp3','.ogg'],
  preload:{important:['alex'],onIdle:true},   /* only characters on the first screen */
  cache:{maxEntries:12},
  idle:{minGapMs:2500,maxGapMs:7000,recent:5,bigCooldownMs:90000,escalationMs:[30000,60000,90000]},
  tracking:{maxTravel:1,touchHoldMs:1200,minRange:260},
  audio:{minGapMs:450,volume:0.06},
  haptics:{success:[18],error:[12,40,12],tap:[8]},
  defaults:{sound:false,haptics:false,motion:'auto',theme:'dark'}
};
