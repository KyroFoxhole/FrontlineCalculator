// ============================================================
// SIMULATION ENGINE - Core combat and resource modeling
// ============================================================

/**
 * CombatSimulator: Models realistic combat dynamics
 * - Player ratio affects resource consumption
 * - Combat intensity scales based on numerical advantage
 * - Armor pressure increases over time
 * - Momentum affects morale and efficiency
 */
class CombatSimulator {
    constructor(friendlyCount, enemyCount, armorPresent = false) {
        this.friendlyCount = friendlyCount;
        this.enemyCount = enemyCount;
        this.armorPresent = armorPresent;
        
        // Combat intensity: 0.5 (winning badly) to 2.0 (losing badly)
        this.baseCombatIntensity = this.calculateCombatIntensity();
        this.currentCombatIntensity = this.baseCombatIntensity;
        
        // Momentum: -50 (collapsing morale) to +50 (high morale)
        this.momentumScore = 0;
        
        // Armor pressure: 0 (no threat) to 100 (critical)
        this.armorPressure = armorPresent ? 10 : 0;
    }

    /**
     * Calculate base combat intensity from player ratio
     * 1:1 ratio = 1.0 (baseline)
     * 2:1 friendly advantage = 0.7 (easier)
     * 1:2 friendly disadvantage = 1.5 (harder)
     */
    calculateCombatIntensity() {
        const ratio = this.enemyCount / Math.max(this.friendlyCount, 1);
        
        if (ratio < 0.5) return 0.5;      // Heavily outnumber enemy
        if (ratio < 1.0) return 0.7;      // Slight advantage
        if (ratio === 1.0) return 1.0;    // Even odds
        if (ratio < 2.0) return 1.3;      // Slight disadvantage
        if (ratio < 3.0) return 1.7;      // Heavy pressure
        return 2.0;                       // Completely outnumbered
    }

    /**
     * Update combat intensity based on resource state
     * Low resources = increased desperation and combat intensity
     */
    updateCombatIntensity(shirts, ammo, meds) {
        let desperation = 0;
        
        // Desperation from low shirts
        if (shirts < 20) desperation += (20 - shirts) * 0.02;
        
        // Desperation from low ammo
        if (ammo < 50) desperation += (50 - ammo) * 0.01;
        
        // Desperation from low meds
        if (meds < 10) desperation += (10 - meds) * 0.03;
        
        this.currentCombatIntensity = this.baseCombatIntensity + Math.min(desperation, 1.0);
        return this.currentCombatIntensity;
    }

    /**
     * Update momentum based on combat outcomes
     * Winning = +momentum, losing = -momentum
     * Affects future consumption rates
     */
    updateMomentum(combatSuccess) {
        if (combatSuccess) {
            this.momentumScore = Math.min(this.momentumScore + 5, 50);
        } else {
            this.momentumScore = Math.max(this.momentumScore - 8, -50);
        }
        return this.momentumScore;
    }

    /**
     * Update armor pressure over time
     * Increases as enemies maintain armor pressure
     * Can trigger "Armor Breakthrough" failure
     */
    updateArmorPressure(armorDefeated, timeMinutes) {
        if (!this.armorPresent) return this.armorPressure;
        
        // Base increase: 2 per minute of armor pressure
        let increase = 2;
        
        // If armor defeated this minute, reduce pressure
        if (armorDefeated) {
            this.armorPressure = Math.max(this.armorPressure - 15, 0);
        } else {
            // Armor pressure builds up
            this.armorPressure = Math.min(this.armorPressure + increase, 100);
        }
        
        return this.armorPressure;
    }

    /**
     * Check if armor breakthrough condition met
     * (armor pressure hits 100 without AT support)
     */
    hasArmorBreakthrough() {
        return this.armorPressure >= 100;
    }

    /**
     * Get momentum modifier for consumption
     * Positive momentum reduces consumption, negative increases it
     */
    getMomentumModifier() {
        return 1 + (this.momentumScore * 0.005); // ±0.25% per momentum point
    }
}

// ============================================================
// WEAPON SYSTEM - Models different weapon types and ammo usage
// ============================================================

/**
 * WeaponConfiguration: Represents squad composition
 * - Rifles: baseline soldier equipment
 * - Machine Guns: suppressive fire, higher ammo use
 * - Anti-Tank: against armor, specialized ammo
 * - Explosives: mortars, rpgs, grenades
 */
class WeaponConfiguration {
    constructor(rifles = 0, mgs = 0, at = 0, explosives = 0) {
        this.rifles = rifles;
        this.mgs = mgs;
        this.at = at;
        this.explosives = explosives;
        
        // Ammo consumption rates per minute per weapon
        this.consumptionRates = {
            rifles: 0.15,        // 0.15 mags/minute
            mgs: 0.35,          // 3x rifles (suppression)
            at: 0.05,           // Slower rate (expensive)
            explosives: 0.08    // Sporadic use
        };
    }

    /**
     * Calculate total ammo consumption per minute
     * Scales with combat intensity
     */
    getAmmoConsumption(combatIntensity = 1.0) {
        const baseConsumption = 
            (this.rifles * this.consumptionRates.rifles) +
            (this.mgs * this.consumptionRates.mgs) +
            (this.at * this.consumptionRates.at) +
            (this.explosives * this.consumptionRates.explosives);
        
        return baseConsumption * combatIntensity;
    }

    /**
     * Get breakdown of ammo needed for each weapon type
     */
    getAmmoBreakdown() {
        return {
            rifles: this.rifles * this.consumptionRates.rifles,
            mgs: this.mgs * this.consumptionRates.mgs,
            at: this.at * this.consumptionRates.at,
            explosives: this.explosives * this.consumptionRates.explosives
        };
    }

    /**
     * Suggest weapon mix based on situation
     */
    static suggestWeaponMix(friendlyCount, hasArmor) {
        const rifleRatio = 0.6;
        const mgRatio = hasArmor ? 0.1 : 0.15;
        const atRatio = hasArmor ? 0.2 : 0.05;
        const explosiveRatio = hasArmor ? 0.1 : 0.05;
        
        return new WeaponConfiguration(
            Math.floor(friendlyCount * rifleRatio),
            Math.floor(friendlyCount * mgRatio),
            Math.floor(friendlyCount * atRatio),
            Math.floor(friendlyCount * explosiveRatio)
        );
    }
}

// ============================================================
// RESOURCE CONSUMPTION MODEL - Detailed depletion calculations
// ============================================================

/**
 * ResourceConsumptionModel: Calculates per-minute consumption
 * of all resources based on combat state and squad composition
 */
class ResourceConsumptionModel {
    constructor() {
        this.consumptionRates = {
            shirts: 0.08,      // Per friendly player per minute
            meds: 0.05,        // Per friendly player per minute
            bmats: 2,          // Per friendly player per engagement
            bandages: 0.03     // Per player per minute
        };
    }

    /**
     * Calculate resource consumption for one minute
     */
    consumeResources(minute, state, combat) {
        const intensity = combat.currentCombatIntensity;
        const momentum = combat.getMomentumModifier();
        
        return {
            shirts: state.friendly * this.consumptionRates.shirts * intensity * momentum,
            ammo: state.weapons.getAmmoConsumption(intensity * momentum),
            meds: state.friendly * this.consumptionRates.meds * intensity * momentum,
            bmats: state.friendly * this.consumptionRates.bmats * (intensity > 1 ? 1 : 0.5)
        };
    }

    /**
     * Calculate casualty/replacement rates
     */
    calculateCasualties(shirts, friendlyCount, intensity) {
        const casualtyRate = intensity * 0.05; // Base 5% casualty rate
        return Math.min(friendlyCount * casualtyRate, shirts);
    }
}

// ============================================================
// RESOURCE SIMULATION - Main simulation loop
// ============================================================

/**
 * ResourceSimulation: Runs minute-by-minute simulation
 * - Depletes all resources realistically
 * - Tracks failure conditions
 * - Records timeline of events
 * - Handles armor pressure and momentum
 */
class ResourceSimulation {
    constructor(initialState) {
        this.state = JSON.parse(JSON.stringify(initialState));
        this.combat = new CombatSimulator(
            initialState.friendly,
            initialState.enemy,
            initialState.enemyArmor === 'yes'
        );
        this.weapons = initialState.weapons || WeaponConfiguration.suggestWeaponMix(
            initialState.friendly,
            initialState.enemyArmor === 'yes'
        );
        this.consumption = new ResourceConsumptionModel();
        
        this.timeline = [];
        this.failures = {};
        this.events = [];
    }

    /**
     * Run simulation for N minutes
     * Returns detailed timeline and failure analysis
     */
    simulate(duration = 30) {
        for (let minute = 1; minute <= duration; minute++) {
            let snapshot = {
                minute,
                resources: JSON.parse(JSON.stringify(this.state)),
                combat: {
                    intensity: this.combat.currentCombatIntensity,
                    momentum: this.combat.momentumScore,
                    armorPressure: this.combat.armorPressure
                },
                events: []
            };

            // Update combat state
            this.combat.updateCombatIntensity(
                this.state.shirts,
                this.state.ammo,
                this.state.meds
            );

            // Determine if winning or losing this minute
            const isWinning = this.combat.currentCombatIntensity < 0.8;
            this.combat.updateMomentum(isWinning);

            // Calculate consumption
            const consumption = this.consumption.consumeResources(
                minute,
                { friendly: this.state.friendly, weapons: this.weapons },
                this.combat
            );

            // Deplete resources
            this.state.shirts = Math.max(0, this.state.shirts - consumption.shirts);
            this.state.ammo = Math.max(0, this.state.ammo - consumption.ammo);
            this.state.meds = Math.max(0, this.state.meds - consumption.meds);
            this.state.bmats = Math.max(0, this.state.bmats - consumption.bmats);

            // Update armor pressure
            let armorDefeated = false;
            if (this.state.throwAT + this.state.rangedAT > 0) {
                armorDefeated = Math.random() < 0.3; // 30% chance to damage armor
            }
            this.combat.updateArmorPressure(armorDefeated, minute);

            // Detect failure conditions
            this.detectFailures(minute, snapshot);

            // Record timeline
            this.timeline.push(snapshot);

            // Early exit if critical failure
            if (this.failures.collapse) break;
        }

        return this;
    }

    /**
     * Detect and record failure conditions
     */
    detectFailures(minute, snapshot) {
        // Shirt failure: squad collapses
        if (this.state.shirts === 0 && !this.failures.shirts) {
            this.failures.shirts = minute;
            this.events.push({
                minute,
                type: 'CRITICAL',
                message: 'Shirts depleted - squad collapse imminent'
            });
        }

        // Ammo failure: unable to engage enemy
        if (this.state.ammo === 0 && !this.failures.ammo) {
            this.failures.ammo = minute;
            this.events.push({
                minute,
                type: 'CRITICAL',
                message: 'Ammo depleted - unable to engage'
            });
        }

        // Armor breakthrough: undefended against enemy armor
        if (this.combat.hasArmorBreakthrough() && !this.failures.armorBreakthrough) {
            this.failures.armorBreakthrough = minute;
            this.events.push({
                minute,
                type: 'CRITICAL',
                message: 'Armor breakthrough - defensive line broken'
            });
        }

        // Cascade failure: multiple critical issues
        const criticalCount = Object.keys(this.failures).length;
        if (criticalCount >= 2 && !this.failures.collapse) {
            this.failures.collapse = minute;
            this.events.push({
                minute,
                type: 'CATASTROPHIC',
                message: 'Frontline collapse'
            });
        }
    }

    /**
     * Get the first failure point
     */
    getFirstFailure() {
        if (Object.keys(this.failures).length === 0) return null;
        
        let failures = Object.entries(this.failures)
            .sort((a, b) => a[1] - b[1]);
        
        return {
            type: failures[0][0],
            minute: failures[0][1]
        };
    }

    /**
     * Get time until first critical failure
     */
    getTimeToFailure() {
        const first = this.getFirstFailure();
        return first ? first.minute : null;
    }

    /**
     * Get all critical events during simulation
     */
    getEvents() {
        return this.events;
    }

    /**
     * Estimate if frontline can be saved
     * Returns success probability 0-1
     */
    estimateSaveability() {
        const timeToFailure = this.getTimeToFailure();
        
        if (!timeToFailure || timeToFailure > 30) return 1.0; // Stable
        if (timeToFailure > 20) return 0.8;  // Likely saveable
        if (timeToFailure > 15) return 0.6;  // Possible with good logistics
        if (timeToFailure > 10) return 0.4;  // Difficult
        if (timeToFailure > 5) return 0.2;   // Very difficult
        return 0.0; // Already lost
    }
}

// ============================================================
// LOGISTICS TRAVEL TIME - Models supply delivery delays
// ============================================================

/**
 * LogisticsTransport: Models truck/flatbed travel and delays
 */
class LogisticsTransport {
    constructor(transportType = 'truck') {
        this.transportType = transportType;
        this.capacity = transportType === 'flatbed' ? 60 : 15;
        
        // Travel time in minutes (one way)
        this.travelTime = transportType === 'flatbed' ? 8 : 5;
        
        // Resources continue depleting during travel
        this.consumption = new ResourceConsumptionModel();
    }

    /**
     * Simulate resources depleting during transport
     * Returns the state when supplies arrive
     */
    simulateTransport(loadout, currentState, combat, durationMinutes) {
        const stateOnArrival = JSON.parse(JSON.stringify(currentState));
        
        // Resources deplete during travel
        for (let minute = 0; minute < durationMinutes; minute++) {
            const consumption = this.consumption.consumeResources(
                minute,
                { friendly: currentState.friendly, weapons: new WeaponConfiguration() },
                combat
            );
            
            stateOnArrival.shirts = Math.max(0, stateOnArrival.shirts - consumption.shirts);
            stateOnArrival.ammo = Math.max(0, stateOnArrival.ammo - consumption.ammo);
            stateOnArrival.meds = Math.max(0, stateOnArrival.meds - consumption.meds);
        }
        
        // Add loadout on arrival
        for (let item in loadout) {
            const crates = loadout[item];
            const crateSize = {
                'Shirts': 10,
                'Ammo': 30,
                'Meds': 10,
                'BMATs': 50,
                'Stickies': 6,
                'RPG Rockets': 4
            }[item] || 10;
            
            const resourceName = item.toLowerCase().replace(' ', '');
            if (stateOnArrival[resourceName] !== undefined) {
                stateOnArrival[resourceName] += crates * crateSize;
            }
        }
        
        return stateOnArrival;
    }
}

// ============================================================
// EXPORTS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CombatSimulator,
        WeaponConfiguration,
        ResourceConsumptionModel,
        ResourceSimulation,
        LogisticsTransport
    };
}
