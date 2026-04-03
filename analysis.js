// ============================================================
// FRONTLINE ANALYZER - State classification and assessment
// ============================================================

/**
 * FrontlineAnalyzer: Determines frontline state and stability
 * - Classifies state: COLLAPSING, LOSING, HOLDING, STABLE
 * - Calculates stability score
 * - Provides strategic recommendations
 */
class FrontlineAnalyzer {
    /**
     * Classify frontline state based on simulation
     */
    static classify(simulation) {
        const timeToFailure = simulation.getTimeToFailure();
        const failures = simulation.failures;
        const resources = simulation.state;
        const combat = simulation.combat;
        
        // Critical conditions
        if (failures.collapse || failures.armorBreakthrough) {
            return {
                state: 'COLLAPSING',
                color: '#f44336',
                urgency: 'CATASTROPHIC',
                icon: '🔥'
            };
        }
        
        if (timeToFailure && timeToFailure <= 5) {
            return {
                state: 'COLLAPSING',
                color: '#f44336',
                urgency: 'CRITICAL',
                icon: '⚠️'
            };
        }
        
        if (timeToFailure && timeToFailure <= 15) {
            return {
                state: 'LOSING',
                color: '#ff9800',
                urgency: 'HIGH',
                icon: '📉'
            };
        }
        
        if (timeToFailure && timeToFailure <= 25) {
            return {
                state: 'HOLDING',
                color: '#ffc107',
                urgency: 'MEDIUM',
                icon: '⚔️'
            };
        }
        
        return {
            state: 'STABLE',
            color: '#4CAF50',
            urgency: 'LOW',
            icon: '✅'
        };
    }

    /**
     * Calculate comprehensive stability score (0-100)
     */
    static getStabilityScore(simulation) {
        let score = 100;
        
        const timeToFailure = simulation.getTimeToFailure();
        const resources = simulation.state;
        const friendly = simulation.state.friendly;
        
        // Penalty for imminent failures
        if (timeToFailure) {
            if (timeToFailure <= 5) score -= 50;
            else if (timeToFailure <= 10) score -= 35;
            else if (timeToFailure <= 20) score -= 20;
            else if (timeToFailure <= 30) score -= 10;
        }
        
        // Penalty for low resource ratios
        const shirtsPerPlayer = resources.shirts / Math.max(friendly, 1);
        if (shirtsPerPlayer < 1) score -= 20;
        else if (shirtsPerPlayer < 2) score -= 10;
        
        const ammoPerRifle = resources.ammo / Math.max(resources.rifles || 1, 1);
        if (ammoPerRifle < 1) score -= 15;
        else if (ammoPerRifle < 2) score -= 8;
        
        // Armor pressure penalty
        if (simulation.combat.armorPressure > 75) score -= 15;
        else if (simulation.combat.armorPressure > 50) score -= 8;
        
        // Morale bonus/penalty
        if (simulation.combat.momentumScore > 20) score += 5;
        else if (simulation.combat.momentumScore < -20) score -= 10;
        
        return Math.max(0, Math.min(100, score));
    }

    /**
     * Assess if frontline can be saved
     */
    static assessSaveability(simulation) {
        const saveability = simulation.estimateSaveability();
        
        if (saveability === 1.0) {
            return {
                verdict: 'STABLE',
                action: 'REINFORCE',
                description: 'Frontline is stable. Send support supplies.'
            };
        } else if (saveability >= 0.7) {
            return {
                verdict: 'SAVEABLE',
                action: 'URGENT_RESUPPLY',
                description: 'Frontline can be held with rapid logistics.'
            };
        } else if (saveability >= 0.4) {
            return {
                verdict: 'CRITICAL',
                action: 'EMERGENCY_SUPPLIES',
                description: 'Frontline is critical. Focus only on essential supplies.'
            };
        } else if (saveability > 0) {
            return {
                verdict: 'FAILING',
                action: 'EVACUATION',
                description: 'Recommend strategic retreat and consolidation.'
            };
        } else {
            return {
                verdict: 'LOST',
                action: 'HOLD_FALLBACK',
                description: 'Frontline is already lost. Defend fallback position.'
            };
        }
    }

    /**
     * Generate strategic recommendations
     */
    static getRecommendations(simulation) {
        const recommendations = [];
        const failures = simulation.failures;
        const resources = simulation.state;
        const combat = simulation.combat;
        
        // Critical shortage warnings
        if (resources.shirts < 20) {
            recommendations.push({
                priority: 'CRITICAL',
                message: 'SHIRTS CRITICAL - Squad cannot sustain casualties'
            });
        }
        
        if (resources.ammo < 30) {
            recommendations.push({
                priority: 'CRITICAL',
                message: 'AMMO CRITICAL - Cannot defend position'
            });
        }
        
        // Armor specific
        if (combat.armorPressure > 70) {
            recommendations.push({
                priority: 'CRITICAL',
                message: 'ARMOR PRESSURE CRITICAL - AT support needed NOW'
            });
        }
        
        // Morale
        if (combat.momentumScore < -30) {
            recommendations.push({
                priority: 'HIGH',
                message: 'Morale is collapsing - rotate fresh troops if possible'
            });
        }
        
        // Strategic
        if (combat.currentCombatIntensity > 1.5) {
            recommendations.push({
                priority: 'HIGH',
                message: 'Heavily outnumbered - consider consolidating positions'
            });
        }
        
        return recommendations;
    }
}

// ============================================================
// PRIORITY ENGINE - Smart resource prioritization
// ============================================================

/**
 * PriorityEngine: Determines what to send based on analysis
 */
class PriorityEngine {
    /**
     * Determine priorities dynamically based on failure analysis
     */
    static determinePriorities(simulation) {
        const failures = simulation.failures;
        const timeToFailure = simulation.getTimeToFailure();
        const combat = simulation.combat;
        
        let priorities = [];
        
        // Immediate failures get highest priority
        if (timeToFailure && timeToFailure <= 5) {
            // ONLY send the failing resource
            if (failures.shirts) return ['shirts'];
            if (failures.ammo) return ['ammo'];
            if (failures.armorBreakthrough) return ['at'];
        }
        
        // Build priority list
        if (failures.shirts) priorities.push('shirts');
        if (failures.ammo) priorities.push('ammo');
        if (failures.armorBreakthrough) priorities.push('at');
        
        // Add supporting resources
        if (!priorities.includes('shirts')) priorities.push('shirts');
        if (!priorities.includes('ammo')) priorities.push('ammo');
        if (combat.armorPressure > 30) priorities.push('at');
        if (!priorities.includes('meds')) priorities.push('meds');
        if (!priorities.includes('bmats')) priorities.push('bmats');
        
        return priorities;
    }

    /**
     * Calculate exact needs for each priority
     */
    static calculateNeeds(simulation, priorities) {
        const needs = {};
        const state = simulation.state;
        const friendly = state.friendly;
        const THRESHOLDS = {
            shirts: 8,
            ammo: 3,
            meds: 40,
            at: 60,
            bmats: 600
        };
        
        for (let resource of priorities) {
            switch (resource) {
                case 'shirts':
                    needs.shirts = Math.max(0, THRESHOLDS.shirts * friendly - state.shirts);
                    break;
                case 'ammo':
                    let targetAmmo = THRESHOLDS.ammo * Math.max(state.rifles || 1, 1);
                    needs.ammo = Math.max(0, targetAmmo - state.ammo);
                    break;
                case 'meds':
                    needs.meds = Math.max(0, THRESHOLDS.meds - state.meds);
                    break;
                case 'at':
                    needs.at = Math.max(0, THRESHOLDS.at - (state.throwAT + state.rangedAT));
                    break;
                case 'bmats':
                    needs.bmats = Math.max(0, THRESHOLDS.bmats - state.bmats);
                    break;
            }
        }
        
        return needs;
    }
}

// ============================================================
// EFFICIENCY CALCULATOR - Rates trip quality
// ============================================================

/**
 * EfficiencyCalculator: Scores logistics efficiency
 */
class EfficiencyCalculator {
    /**
     * Calculate efficiency score for a trip
     * Considers: capacity utilization, urgency matching, impact
     */
    static scoreTrip(loadout, capacity, timeToFailure, resources) {
        let score = 0;
        let totalCrates = 0;
        
        // Utilization: 25% per 25% of capacity used
        for (let item in loadout) {
            totalCrates += loadout[item];
        }
        const utilization = (totalCrates / capacity);
        score += utilization * 25;
        
        // Urgency matching: bonus if sending what's needed most
        let urgencyBonus = 0;
        if (loadout['Shirts'] && resources.shirts < 20) urgencyBonus += 10;
        if (loadout['Ammo'] && resources.ammo < 30) urgencyBonus += 10;
        if (loadout['Stickies'] && resources.throwAT < 30) urgencyBonus += 8;
        
        score += urgencyBonus;
        
        // Timeliness: bonus if arriving before critical failure
        if (timeToFailure && timeToFailure > 15) {
            score += 15;
        } else if (timeToFailure && timeToFailure > 10) {
            score += 10;
        }
        
        return Math.min(100, Math.round(score));
    }

    /**
     * Generate efficiency report
     */
    static generateReport(trips) {
        const report = {
            totalEfficiency: 0,
            averageUtilization: 0,
            tripReports: []
        };
        
        let totalUtil = 0;
        for (let trip of trips) {
            const crates = Object.values(trip.loadout).reduce((a, b) => a + b, 0);
            const util = crates / trip.capacity;
            totalUtil += util;
            
            report.tripReports.push({
                tripNumber: trip.number,
                utilization: (util * 100).toFixed(1) + '%',
                efficiency: trip.efficiency
            });
        }
        
        report.averageUtilization = ((totalUtil / trips.length) * 100).toFixed(1) + '%';
        report.totalEfficiency = Math.round(
            trips.reduce((sum, t) => sum + t.efficiency, 0) / trips.length
        );
        
        return report;
    }
}

// ============================================================
// EXPORTS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        FrontlineAnalyzer,
        PriorityEngine,
        EfficiencyCalculator
    };
}
