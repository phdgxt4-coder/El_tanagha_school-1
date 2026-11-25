/* Public API of the Study Crew framework. Import from here; everything else is internal. */
export {CONFIG} from './config.js';
export {log,getLog,setLogSink} from './logger.js';
export {tokens,applyTokens,setTheme,registerTheme,themeNames} from '../Themes/index.js';
export {mountCharacter,loadManifest} from './characterManager.js';
export {characterIds} from '../Characters/registry.js';
export {STATES,PRIORITY} from './stateMachine.js';
export {getPrefs,setPrefs,onPrefs,reducedMotion} from './prefs.js';
export {playSound,stopSound} from './audio.js';
export {haptic} from './haptics.js';
export {watchConnection} from './connection.js';
export {preloadAssets,loadAsset} from './assetLoader.js';
export {CharacterCard,MascotBubble,SuccessAnimation,ErrorAnimation,LoadingScene,NotificationCharacter,AchievementBanner,CelebrationOverlay,makeScene} from './components.js';
