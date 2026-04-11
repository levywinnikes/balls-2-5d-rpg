import * as Tone from "tone";

/**
 * AudioManager handles all procedural game sounds using Tone.js.
 * REFACTORED: Now solely focuses on "ASMR / Relaxing" ambient textures.
 * No more "Metal" or "Dark" modes. Pure chill.
 */
export class AudioManager {
    private static instance: AudioManager;
    private initialized: boolean = false;
    private musicEnabled: boolean = false;
    private sfxEnabled: boolean = true;

    // --- SIGNAL CHAIN ---
    // Master FX
    private masterLimiter: Tone.Limiter;
    private masterReverb: Tone.Reverb;
    
    // Buses
    private musicBus: Tone.Gain;
    private sfxBus: Tone.Gain;

    // --- MUSIC INSTRUMENTS (ASMR) ---
    // 1. "Cloud Pad": A very soft, airy poly synth that plays slow chords
    private cloudPad: Tone.PolySynth;
    private cloudFilter: Tone.AutoFilter; // Slowly filters the pad

    // 2. "Wind Chimes": Gentle, random bell-like sounds
    private windChimes: Tone.PolySynth;
    private chimePanner: Tone.Panner;
    private chimeDelay: Tone.PingPongDelay;

    // 3. "Atmosphere": Pink noise floor for "wind/ocean" feel
    private atmosphere: Tone.Noise;
    private atmosphereFilter: Tone.Filter;
    private atmosphereVol: Tone.Volume;

    // --- SFX INSTRUMENTS ---
    private levelUpSynth: Tone.MetalSynth;
    private blockSynth: Tone.MetalSynth;
    private attackSynth: Tone.MembraneSynth;
    private attackWhoosh: Tone.NoiseSynth;
    private pickupSynth: Tone.PluckSynth;
    private clickSynth: Tone.PluckSynth;
    private fireHitSynth: Tone.NoiseSynth;
    private splashSynth: Tone.NoiseSynth;
    private splashThump: Tone.MembraneSynth;

    // Overkill Synths
    private overkillSquish: Tone.NoiseSynth;
    private overkillImpact: Tone.MembraneSynth;
    private overkillFire: Tone.NoiseSynth;

    // Star Rune Synths
    private starHitSynth: Tone.MetalSynth;
    private overkillStarSynth: Tone.PolySynth;

    // Footstep Synths
    private footstepNoise: Tone.NoiseSynth;
    private footstepMembrane: Tone.MembraneSynth;

    // Magic Synths
    private enchantSynth: Tone.PolySynth;

    // Death Synths (New)
    private enemyDeathNoise: Tone.NoiseSynth; // Rats, Dragons (Different settings)
    private enemyDeathMetal: Tone.MetalSynth; // Skeletons, Goblins (Metallic/Bone)
    private enemyDeathMembrane: Tone.MembraneSynth; // Orcs (Thud)
    private heroDeathSynth: Tone.PolySynth; // Melodic sad chord


    // --- STATE ---
    private musicLoop: Tone.Loop | null = null;
    private chimeLoop: Tone.Loop | null = null;
    private currentChordIndex: number = 0;

    // Chords: Bright, upbeat major progressions (C-G-Am-F loop)
    private readonly chords = [
        ["C3", "E3", "G3"],   // C Major
        ["G2", "B2", "D3"],   // G Major
        ["A2", "C3", "E3"],   // A Minor (adds color)
        ["F2", "A2", "C3"],   // F Major
    ];

    // Pentatonic C Major melody scale (fun, no dissonance) - SHIFTED DOWN
    private readonly chimeScale = ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5"];

    private startGenerativeMusic() {
        if (!this.initialized) return;

        // Fast, bouncy BPM
        Tone.Transport.bpm.value = 95;

        // --- BASS KICK Pattern (every beat) ---
        this.musicLoop = new Tone.Loop((time) => {
            const chord = this.chords[this.currentChordIndex % this.chords.length];

            // Light staccato chord stab on beat 1 & 3
            this.cloudPad.triggerAttackRelease(chord, "8n", time, 0.5);
            this.cloudPad.triggerAttackRelease(chord, "8n", time + Tone.Time("2n").toSeconds(), 0.35);

            // Advance chord every 2 measures
            if (this.currentChordIndex % 2 === 1) {
                this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
            } else {
                this.currentChordIndex++;
            }
        }, "1m").start(0);

        // --- MELODY (Plucky xylophone-style chimes) ---
        let melodyStep = 0;
        const melodyPattern = [0, 2, 4, 2, 5, 4, 7, 5, 4, 2, 0, 4, 2, 0, 4, 7];
        this.chimeLoop = new Tone.Loop((time) => {
            const idx = melodyPattern[melodyStep % melodyPattern.length];
            const note = this.chimeScale[idx % this.chimeScale.length];

            // Random slight pan for liveliness
            this.chimePanner.pan.value = (Math.random() * 0.4) - 0.2;

            // RANDOMNESS: Skip note 30% of the time for rhythmic air
            if (Math.random() < 0.3) {
                melodyStep++;
                return;
            }

            // Play note (bright, short)
            this.windChimes.triggerAttackRelease(note, "16n", time, 0.4 + Math.random() * 0.2);
            melodyStep++;
        }, "8n").start("4n"); // Offset so melody comes in slightly after bass

        // Subtle pink noise atmosphere (very quiet - just air)
        this.atmosphere.start();
        this.atmosphereVol.volume.rampTo(-35, 2);

        Tone.Transport.start();
    }

    private stopGenerativeMusic() {
        this.atmosphereVol.volume.rampTo(-60, 1);
        setTimeout(() => this.atmosphere.stop(), 1200);

        if (this.musicLoop) {
            this.musicLoop.cancel();
            this.musicLoop.dispose();
            this.musicLoop = null;
        }
        if (this.chimeLoop) {
            this.chimeLoop.cancel();
            this.chimeLoop.dispose();
            this.chimeLoop = null;
        }

        this.cloudPad.releaseAll();
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }

    private constructor() {
        // 1. Master Chain
        this.masterLimiter = new Tone.Limiter(-1).toDestination();
        
        // Bright EQ for casual/upbeat feel
        const masterEQ = new Tone.EQ3({
            low: 1,
            mid: 2,
            high: 5,
            lowFrequency: 120,
            highFrequency: 6000
        }).connect(this.masterLimiter);

        this.masterReverb = new Tone.Reverb({
            decay: 2.5,      // Short, punchy reverb
            preDelay: 0.05,
            wet: 0.2
        }).connect(masterEQ);

        // 2. Buses
        this.musicBus = new Tone.Gain(1.2).connect(this.masterReverb);
        this.sfxBus = new Tone.Gain(1).connect(this.masterReverb);

        // 3. Music Setup (Casual/Adventure)
        
        // A) Chord Pad — Bright square wave, punchy envelope
        const padPanner = new Tone.AutoPanner({
            frequency: 0.3,
            depth: 0.3,
            type: "sine"
        }).connect(this.musicBus).start();

        this.cloudPad = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "square" }, // Brighter timbre
            envelope: {
                attack: 0.02,  // Fast attack — punchy
                decay: 0.3,
                sustain: 0.4,
                release: 0.5
            },
            volume: -14
        });
        
        this.cloudFilter = new Tone.AutoFilter({
            frequency: 0.3,
            baseFrequency: 800,
            octaves: 1,
            depth: 0.2,
            type: "sine"
        }).connect(padPanner).start();

        this.cloudPad.connect(this.cloudFilter);

        // B) Wind Chimes - Bright Sparkles
        this.chimeDelay = new Tone.PingPongDelay({
            delayTime: "4n",
            feedback: 0.2,
            wet: 0.2
        }).connect(this.musicBus);

        this.chimePanner = new Tone.Panner(0).connect(this.chimeDelay);

        this.windChimes = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" }, // Bright but not harsh
            envelope: {
                attack: 0.005, // Instant attack — percussive
                decay: 0.15,   // Short decay — marimba/xylophone feel
                sustain: 0,
                release: 0.3
            },
            volume: -8 // Louder melody
        }).connect(this.chimePanner);

        // C) Atmosphere (Air) - High frequency focus for "tingles"
        // Switched to HighPass to keep the "air/hiss" instead of the rumble
        this.atmosphereFilter = new Tone.Filter(2000, "highpass"); // Hiss only
        this.atmosphereVol = new Tone.Volume(-25).connect(this.musicBus); // Audible but quiet
        this.atmosphere = new Tone.Noise("pink").connect(this.atmosphereFilter);
        
        // --- SFX Setup (Short, punchy) ---
        this.levelUpSynth = new Tone.MetalSynth({
            envelope: { attack: 0.01, decay: 4, release: 4 },
            harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
            volume: -6
        }).connect(this.sfxBus);

        this.blockSynth = new Tone.MetalSynth({
            envelope: { attack: 0.005, decay: 0.2, release: 0.2 },
            harmonicity: 8, modulationIndex: 16, resonance: 6000, octaves: 1,
            volume: -8
        }).connect(this.sfxBus);

        this.attackSynth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 10, volume: -6 }).connect(this.sfxBus);
        this.attackWhoosh = new Tone.NoiseSynth({ envelope: { attack: 0.005, decay: 0.1, release: 0.1 }, volume: -15 }).connect(this.sfxBus);
        this.pickupSynth = new Tone.PluckSynth({ attackNoise: 0.2, dampening: 3000, resonance: 0.9, volume: -6 }).connect(this.sfxBus);
        this.clickSynth = new Tone.PluckSynth({ attackNoise: 0.1, dampening: 4000, resonance: 0.5, volume: -6 }).connect(this.sfxBus);

        this.fireHitSynth = new Tone.NoiseSynth({ envelope: { attack: 0.001, decay: 0.3, release: 0.2 }, volume: -10 }).connect(new Tone.Filter(2000, "bandpass").connect(this.sfxBus));
        this.splashSynth = new Tone.NoiseSynth({ noise: { type: "brown" }, envelope: { attack: 0.01, decay: 0.8, release: 0.5 }, volume: -8 }).connect(new Tone.Filter(400, "lowpass").connect(this.sfxBus));
        this.splashThump = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 2, volume: -6 }).connect(this.sfxBus);

        // --- OVERKILL SYNTHS ---
        // 1. Physical Overkill (Wet/Squishy/Heavy)
        this.overkillSquish = new Tone.NoiseSynth({
            noise: { type: "brown" },
            envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.2 },
            volume: -2 // Loud!
        }).connect(new Tone.Filter(800, "lowpass").connect(this.sfxBus));
        
        this.overkillImpact = new Tone.MembraneSynth({
            pitchDecay: 0.2,
            octaves: 4,
            oscillator: { type: "sine" },
            volume: 0 // Max volume impact
        }).connect(this.sfxBus);

        // 2. Fire Overkill (Explosive Sizzle)
        this.overkillFire = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.005, decay: 1.2, sustain: 0, release: 0.5 }, // Long searing tail
            volume: -2
        }).connect(this.sfxBus); // Connects to bus

        // 3. Star Overkill (Magical sparkle cascade)
        this.overkillStarSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 1.5 },
            volume: -4
        }).connect(this.sfxBus);

        // Star Hit (High metallic sparkle)
        this.starHitSynth = new Tone.MetalSynth({
            envelope: { attack: 0.001, decay: 0.4, release: 0.6 },
            harmonicity: 12, modulationIndex: 40, resonance: 8000, octaves: 2,
            volume: -6
        }).connect(this.sfxBus);

        // --- FOOTSTEP SFX ---
        this.footstepNoise = new Tone.NoiseSynth({
            noise: { type: "pink" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0 }
        }).toDestination();
        this.footstepNoise.volume.value = -15;

        this.footstepMembrane = new Tone.MembraneSynth().toDestination();
        this.footstepMembrane.volume.value = -20;
        
        // --- MAGIC SYNTHS ---
        this.enchantSynth = new Tone.PolySynth(Tone.Synth, {
             oscillator: { type: "sine" },
             envelope: { attack: 0.05, decay: 0.5, sustain: 0.2, release: 2 },
             volume: -5
        }).connect(this.sfxBus);

        // --- DEATH SYNTHS ---
        // 1. Noise (Rats/Dragons) - Versatile filtered noise
        this.enemyDeathNoise = new Tone.NoiseSynth({
            noise: { type: "white" },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
            volume: -5
        }).connect(this.sfxBus);

        // 2. Metal (Skeletons/Goblins) - Metallic click/clatter
        this.enemyDeathMetal = new Tone.MetalSynth({
             envelope: { attack: 0.001, decay: 0.2, release: 0.2 },
             harmonicity: 8.1, modulationIndex: 20, resonance: 3000, octaves: 1, // Bone-like
             volume: -8
        }).connect(this.sfxBus);

        // 3. Membrane (Orcs) - Low Thud
        this.enemyDeathMembrane = new Tone.MembraneSynth({
            pitchDecay: 0.1,
            octaves: 4,
            volume: -2
        }).connect(this.sfxBus);

        // 4. Hero Death - Sad / Melodic
        this.heroDeathSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" }, // Softer than Sawtooth
            envelope: { attack: 0.2, decay: 1, sustain: 0.4, release: 3 },
            volume: -4
        }).connect(this.musicBus); // Connect to Music bus for more reverb/emotion
    }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public async init() {
        if (this.initialized) return;
        await Tone.start();
        await this.masterReverb.generate();
        
        // Load settings from localStorage
        const mVol = localStorage.getItem("tgs_audio_music_vol");
        const sVol = localStorage.getItem("tgs_audio_sfx_vol");
        const mOff = localStorage.getItem("tgs_audio_music_off");
        const sOff = localStorage.getItem("tgs_audio_sfx_off");

        if (mVol !== null) this.setMusicVolume(parseFloat(mVol));
        if (sVol !== null) this.setSfxVolume(parseFloat(sVol));
        if (mOff === "true") this.setMusicEnabled(false);
        if (sOff === "true") this.setSfxEnabled(false);

        this.initialized = true;
        console.log("Audio System Initialized (Casual/Upbeat Mode — BPM 120)");
    }

    public setMusicVolume(val: number) {
        // Ramp to avoid clicks
        this.musicBus.gain.rampTo(val, 0.5); 
        localStorage.setItem("tgs_audio_music_vol", val.toString());
    }

    public setSfxVolume(val: number) {
        this.sfxBus.gain.rampTo(val, 0.1);
        localStorage.setItem("tgs_audio_sfx_vol", val.toString());
    }

    public setMusicEnabled(enabled: boolean) {
        this.musicEnabled = enabled;
        if (!enabled) {
            this.stopGenerativeMusic();
        } else {
            const vol = parseFloat(localStorage.getItem("tgs_audio_music_vol") || "1");
            this.musicBus.gain.value = vol; // Reset gain
            this.startGenerativeMusic();
        }
        localStorage.setItem("tgs_audio_music_off", (!enabled).toString());
    }

    public setSfxEnabled(enabled: boolean) {
        this.sfxEnabled = enabled;
        if (!enabled) {
            this.sfxBus.gain.rampTo(0, 0.1);
        } else {
            const vol = parseFloat(localStorage.getItem("tgs_audio_sfx_vol") || "1");
            this.sfxBus.gain.rampTo(vol, 0.1);
        }
        localStorage.setItem("tgs_audio_sfx_off", (!enabled).toString());
    }

    // --- EXTERNAL CONTROLS (ALIASES) ---
    public startTitleMusic() { this.startGenerativeMusic(); }
    public stopTitleMusic() { this.stopGenerativeMusic(); }



    // --- FOOTSTEPS ---
    private lastStepTime: number = 0;
    private stepDuration: number = 380; // ms (adjust for pace)

    public playFootstep(terrain: string = "floor") {
        if (!this.sfxEnabled) return;
        
        const now = Date.now();
        if (now - this.lastStepTime < this.stepDuration) return;

        this.lastStepTime = now;

        // Randomize timing slightly for humanity
        const time = Tone.now() + (Math.random() * 0.02);

        switch (terrain) {
            case "grass":
                // Soft crunch
                this.footstepNoise.noise.type = "pink";
                this.footstepNoise.envelope.decay = 0.1;
                this.footstepNoise.triggerAttackRelease("16n", time, 0.4); // Quiet
                break;
                
            case "sand":
            case "dirty":
                // Gritty, longer crunch
                this.footstepNoise.noise.type = "white"; // More high freq
                this.footstepNoise.envelope.decay = 0.15;
                this.footstepNoise.triggerAttackRelease("16n", time, 0.3);
                break;

            case "water":
                // Splash (Membrane pitch sweep + Noise)
                this.footstepMembrane.triggerAttackRelease("C2", "32n", time, 0.5);
                this.footstepNoise.noise.type = "brown";
                this.footstepNoise.envelope.decay = 0.2;
                this.footstepNoise.triggerAttackRelease("16n", time, 0.5);
                break;

            case "mountain":
                // Hard tap
                this.footstepMembrane.triggerAttackRelease("G2", "32n", time, 0.6);
                break;

            case "floor":
            default:
                // Standard tap (Wood/Stone)
                this.footstepMembrane.triggerAttackRelease("C1", "32n", time, 0.3); // Low thud
                this.footstepNoise.noise.type = "pink";
                this.footstepNoise.envelope.decay = 0.05;
                this.footstepNoise.triggerAttackRelease("32n", time, 0.2); // Click
                break;
        }
    }

    // --- SFX METHODS (Safe helpers) ---
    public playLevelUp() { if (this.initialized && this.sfxEnabled) this.levelUpSynth.triggerAttackRelease("E2", "2n"); }
    public playBlock() { if (this.initialized && this.sfxEnabled) this.blockSynth.triggerAttackRelease("C4", "16n", undefined, 0.4); }

    public playEnchantSound() {
        if (!this.sfxEnabled) return;
        // Sparkly major chord arpeggio
        const now = Tone.now();
        this.enchantSynth.triggerAttackRelease(["C5", "E5", "G5", "C6"], 0.2, now);
        this.enchantSynth.triggerAttackRelease(["D5", "F#5", "A5", "D6"], 0.2, now + 0.1);
    }
    
    // --- DEATH SOUNDS ---
    public playEnemyDeath(enemyId: string) {
        console.log(`[AudioManager] playEnemyDeath called for: ${enemyId}. Init=${this.initialized}, SFX=${this.sfxEnabled}, Context=${Tone.context.state}`);
        if (!this.sfxEnabled) return;
        
        const now = Tone.now();

        switch (enemyId) {
            case "rat":
                // High pitch squeak
                // Using Pink noise for better visibility + longer duration
                this.enemyDeathNoise.noise.type = "pink";
                this.enemyDeathNoise.triggerAttackRelease("8n", now);
                break;
            
            case "spider":
                 // Hiss / Skitter
                 this.enemyDeathNoise.noise.type = "pink";
                 this.enemyDeathNoise.triggerAttackRelease("8n", now);
                 break;

            case "skeleton":
                // Bone clatter
                this.enemyDeathMetal.harmonicity = 8;
                this.enemyDeathMetal.modulationIndex = 20;
                this.enemyDeathMetal.triggerAttackRelease("32n", now);
                this.enemyDeathMetal.triggerAttackRelease("32n", now + 0.1); // Double click
                break;
            
            case "goblin":
                // Weird vocal grunt (simulated with MetalSynth lower pitch)
                this.enemyDeathMetal.harmonicity = 2;
                this.enemyDeathMetal.modulationIndex = 10;
                this.enemyDeathMetal.triggerAttackRelease("16n", now, 20); // Low velocity
                break;

            case "orc":
                // Heavy Thud
                this.enemyDeathMembrane.triggerAttackRelease("C1", "8n", now);
                break;
            
            case "demon":
                // Distorted low roar
                // Combine Membrane + Noise
                this.enemyDeathMembrane.triggerAttackRelease("A0", "2n", now);
                this.enemyDeathNoise.noise.type = "brown";
                this.enemyDeathNoise.triggerAttackRelease("4n", now);
                break;

            case "dragon":
                // Long deep rumble fade
                this.enemyDeathNoise.noise.type = "brown";
                // Ramping volume for "fade out" effect is hard on trigger, but synth envelope handles it.
                // Set envelope for this specifically? 
                // Creating a specific Dragon instance might be better but for now let's reuse
                this.enemyDeathNoise.triggerAttackRelease("1n", now); // Long release
                break;

            default:
                // Generic thud
                this.footstepMembrane.triggerAttackRelease("C2", "16n", now);
                break;
        }
    }

    public playHeroDeath() {
        if (!this.sfxEnabled) return;
        const now = Tone.now();
        
        // Sad Minor Descent
        // A Minor: A4 -> G4 -> E4 -> C4 -> A3
        this.heroDeathSynth.triggerAttackRelease("A4", "4n", now);
        this.heroDeathSynth.triggerAttackRelease("G4", "4n", now + 0.4);
        this.heroDeathSynth.triggerAttackRelease("E4", "4n", now + 0.8);
        this.heroDeathSynth.triggerAttackRelease("C4", "2n", now + 1.2);
        this.heroDeathSynth.triggerAttackRelease("A3", "1n", now + 1.8);
        
        // Final Thud
        this.enemyDeathMembrane.triggerAttackRelease("C1", "1n", now + 2.0);
    }


    public playAttack() { if (this.initialized && this.sfxEnabled) { this.attackWhoosh.triggerAttackRelease("16n", undefined, 0.1); this.attackSynth.triggerAttackRelease("G2", "16n", undefined, 0.6); } }
    public playPickup() { if (this.initialized && this.sfxEnabled) this.pickupSynth.triggerAttackRelease("C5", "16n", undefined, 0.3); }
    public playClick() { if (this.initialized && this.sfxEnabled) this.clickSynth.triggerAttackRelease("G5", "32n", undefined, 0.2); }
    public playFireHit() { if (this.initialized && this.sfxEnabled) this.fireHitSynth.triggerAttackRelease("16n", undefined, 0.5); }
    public playSplash() { if (this.initialized && this.sfxEnabled) { this.splashSynth.triggerAttackRelease("4n", undefined, 0.6); this.splashThump.triggerAttackRelease("G1", "8n", undefined, 0.8); } }
    
    // Critical Hit: Sharp, higher pitched impact
    public playCritical() { 
        if (this.initialized && this.sfxEnabled) { 
            // Sharp metallic ping
            this.blockSynth.triggerAttackRelease("E5", "32n", undefined, 0.6);
            // Heavy impact
            this.attackSynth.triggerAttackRelease("E3", "16n", undefined, 0.8); 
        } 
    }

    /**
     * Physical Overkill: A heavy, squishy, messy splash.
     */
    public playOverkillPhysical() {
        if (this.initialized && this.sfxEnabled) {
            // Squishy brown noise (flesh)
            this.overkillSquish.triggerAttackRelease("8n");
            // Heavy bone thud
            this.overkillImpact.triggerAttackRelease("A1", "8n");
        }
    }

    /**
     * Fire Overkill: A loud, searing explosion.
     */
    public playOverkillFire() {
        if (this.initialized && this.sfxEnabled) {
            this.overkillFire.triggerAttackRelease("4n", undefined, 1);
        }
    }

    /**
     * Star Rune Hit: Bright metallic sparkle chime.
     */
    public playStarHit() {
        if (this.initialized && this.sfxEnabled) {
            const now = Tone.now();
            this.starHitSynth.triggerAttackRelease("32n", now, 0.5);
            // Tiny ascending sparkle
            this.enchantSynth.triggerAttackRelease(["E6"], "32n", now + 0.05, 0.15);
            this.enchantSynth.triggerAttackRelease(["G6"], "32n", now + 0.1, 0.1);
        }
    }

    /**
     * Star Overkill: Cascade of sparkly descending chimes — glitter explosion.
     */
    public playOverkillStar() {
        if (this.initialized && this.sfxEnabled) {
            const now = Tone.now();
            this.overkillStarSynth.triggerAttackRelease(["C6", "E6", "G6"], "8n", now, 0.4);
            this.overkillStarSynth.triggerAttackRelease(["A5", "C6", "E6"], "8n", now + 0.12, 0.3);
            this.overkillStarSynth.triggerAttackRelease(["F5", "A5", "C6"], "8n", now + 0.24, 0.2);
            this.starHitSynth.triggerAttackRelease("16n", now + 0.05, 0.6);
        }
    }

    public playEnchant(type: string = "default") {
        if (this.initialized && this.sfxEnabled) {
             // Base Magical Ascending Triad
             const now = Tone.now();
             
             if (type === "fire") {
                 this.fireHitSynth.triggerAttackRelease("8n", now);
                 this.enchantSynth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "8n", now, 0.2); // Chord + Fire
             } 
             else if (type === "ice" || type === "water") {
                 this.splashSynth.triggerAttackRelease("4n", now);
                 this.enchantSynth.triggerAttackRelease(["D4", "F4", "A4", "D5"], "8n", now, 0.2); // Minor Chord + Splash
             }
             else if (type === "energy") {
                 this.clickSynth.triggerAttackRelease("C6", "16n", now);
                 this.enchantSynth.triggerAttackRelease(["E4", "G#4", "B4", "E5"], "8n", now, 0.2); // Augmented/Bright
             }
             else if (type === "star") {
                 // Star: Sparkly ascending arpeggio
                 this.starHitSynth.triggerAttackRelease("32n", now, 0.3);
                 this.enchantSynth.triggerAttackRelease(["E5", "G#5", "B5", "E6"], "8n", now + 0.05, 0.2);
             }
             else {
                 // Default
                 this.enchantSynth.triggerAttackRelease(["C4", "E4", "G4", "C5"], "8n", now, 0.2);
             }
        }
    }
}
