// ============================================================
// LOADOUT OPTIMIZER - Intelligent crate packing
// ============================================================

/**
 * LoadoutOptimizer: Builds optimal loadouts that:
 * - Fully utilize transport capacity
 * - Match resource priorities
 * - Consider realistic crate sizes
 * - Avoid over-sending non-urgent supplies
 */
class LoadoutOptimizer {
    static CRATE_SIZES = {
        'Shirts': 10,
        'Rifles': 10,
        'Ammo': 30,
        'Meds': 10,
        'Stickies': 6,
        'RPG Rockets': 4,
        'BMATs': 50
    };

    /**
     * Build optimized loadout for current situation
     */
    static buildLoadout(capacity, needs, currentResources) {
        const loadout = {};
        let remainingCapacity = capacity;
        
        // Priority order: critical needs first, then supporting
        const priorityItems = [
            { name: 'Shirts', need: needs.shirts || 0 },
            { name: 'Ammo', need: needs.ammo || 0 },
            { name: 'Meds', need: needs.meds || 0 },
            { name: 'Stickies', need: (needs.at || 0) * 0.6 },
            { name: 'RPG Rockets', need: (needs.at || 0) * 0.4 },
            { name: 'BMATs', need: needs.bmats || 0 }
        ];
        
        // First pass: fill critical needs
        for (let item of priorityItems) {
            if (item.need <= 0 || remainingCapacity <= 0) continue;
            
            const cratesNeeded = Math.ceil(item.need / this.CRATE_SIZES[item.name]);
            const crates = Math.min(remainingCapacity, cratesNeeded);
            
            if (crates > 0) {
                loadout[item.name] = crates;
                remainingCapacity -= crates;
            }
        }
        
        // Second pass: fill remaining capacity with non-urgent items
        // (if we haven't filled critical needs yet)
        if (remainingCapacity > 0 && Object.keys(loadout).length < 3) {
            for (let item of priorityItems) {
                if (remainingCapacity <= 0) break;
                if (loadout[item.name]) continue; // Already added
                
                const surplus = Math.max(0, 
                    (this.CRATE_SIZES[item.name] * 5) - currentResources[item.name.toLowerCase()]
                );
                
                if (surplus > 0) {
                    const cratesNeeded = Math.ceil(surplus / this.CRATE_SIZES[item.name]);
                    const crates = Math.min(remainingCapacity, cratesNeeded);
                    
                    if (crates > 0) {
                        loadout[item.name] = crates;
                        remainingCapacity -= crates;
                    }
                }
            }
        }
        
        return {
            loadout,
            utilizationPercent: ((capacity - remainingCapacity) / capacity) * 100,
            remainingCapacity
        };
    }

    /**
     * Suggest alternative loadouts for comparison
     */
    static suggestAlternatives(capacity, needs, currentResources, numAlternatives = 2) {
        const alternatives = [];
        
        // Alternative 1: Maximum capacity utilization (fill completely)
        const maxUtil = this.buildLoadout(capacity, 
            { ...needs, bmats: needs.bmats * 2 }, // Prioritize fill
            currentResources
        );
        alternatives.push({
            name: 'Max Utilization',
            ...maxUtil,
            pros: 'Uses all transport capacity',
            cons: 'May over-send non-essential items'
        });
        
        // Alternative 2: Minimum, essentials only
        const minNeeds = {};
        for (let key in needs) {
            minNeeds[key] = needs[key] * 0.5; // Half the need
        }
        const minUtil = this.buildLoadout(capacity, minNeeds, currentResources);
        alternatives.push({
            name: 'Essentials Only',
            ...minUtil,
            pros: 'Focuses on critical items',
            cons: 'May not address secondary needs'
        });
        
        return alternatives;
    }
}

// ============================================================
// TRIP PLANNER - Multi-trip logistics planning
// ============================================================

/**
 * TripPlanner: Plans multi-trip supply runs
 * - Simulates each delivery
 * - Recalculates priorities after each trip
 * - Includes travel time delays
 * - Scores efficiency of each trip
 */
class TripPlanner {
    /**
     * Plan multi-trip logistics campaign
     */
    static planTrips(initialState, numTrips = 3, transportType = 'truck') {
        const transport = new LogisticsTransport(transportType);
        const trips = [];
        let currentState = JSON.parse(JSON.stringify(initialState));
        
        for (let tripNum = 1; tripNum <= numTrips; tripNum++) {
            // Simulate current frontline
            const simulation = new ResourceSimulation(currentState);
            simulation.simulate(30);
            
            // Determine what to send
            const priorities = PriorityEngine.determinePriorities(simulation);
            const needs = PriorityEngine.calculateNeeds(simulation, priorities);
            const { loadout, utilizationPercent, remainingCapacity } = 
                LoadoutOptimizer.buildLoadout(transport.capacity, needs, currentState);
            
            // Simulate transport and delivery
            const stateOnArrival = transport.simulateTransport(
                loadout,
                currentState,
                simulation.combat,
                transport.travelTime
            );
            
            // Score efficiency
            const efficiency = EfficiencyCalculator.scoreTrip(
                loadout,
                transport.capacity,
                simulation.getTimeToFailure(),
                currentState
            );
            
            trips.push({
                number: tripNum,
                loadout,
                utilization: utilizationPercent,
                remainingCapacity,
                efficiency,
                priorities,
                estimatedArrivalMinute: transport.travelTime,
                stateOnArrival
            });
            
            // Update state for next trip
            currentState = stateOnArrival;
            
            // Stop if frontline is stable
            const nextSim = new ResourceSimulation(currentState);
            nextSim.simulate(30);
            if (!nextSim.getTimeToFailure() || nextSim.getTimeToFailure() > 30) {
                break;
            }
        }
        
        return trips;
    }
}

// ============================================================
// EXPORTS
// ============================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LoadoutOptimizer,
        TripPlanner
    };
}
