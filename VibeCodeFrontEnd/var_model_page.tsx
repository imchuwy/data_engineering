'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sidebar, SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppHeader } from './app-header';
import { MainDashboard } from './main-dashboard';
import { SidebarContent } from './sidebar-content';
import { calculateVaR } from '@/lib/var-calculator';
import { getHistoricalData } from '@/lib/financial-data';
import type { Instrument, VaRResult } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// This is a wrapper to call server-side getHistoricalData from the client
async function getHistoricalDataOnClient(instruments: Instrument[]) {
    const data = await getHistoricalData(instruments);
    // The Map object is not directly serializable, so we convert it to an array of arrays
    return Array.from(data.entries());
}


export default function VarModelPage() {
    const { toast } = useToast();
    // State for Simulation & Portfolio
    const [simulationMethod, setSimulationMethod] = useState('parametric');
    const [instruments, setInstruments] = useState<Instrument[]>([]);
    const [varResults, setVarResults] = useState<VaRResult | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Handle instrument management
    const addInstrument = (instrument: Omit<Instrument, 'id' | 'included'>) => {
        // Check if instrument with same symbol already exists
        const existingInstrument = instruments.find(inst => inst.symbol === instrument.symbol);
        if (existingInstrument) {
            toast({
                title: 'Instrument Exists',
                description: `An instrument with the symbol ${instrument.symbol} is already in the portfolio.`,
                variant: 'destructive',
            });
            return;
        }
        setInstruments((prev) => [
            ...prev,
            { ...instrument, id: crypto.randomUUID(), included: true },
        ]);
    };

    const removeInstrument = (id: string) => {
        setInstruments((prev) => prev.filter((inst) => inst.id !== id));
    };

    const toggleInstrument = (id: string) => {
        setInstruments(prev =>
            prev.map(inst =>
                inst.id === id ? { ...inst, included: !inst.included } : inst
            )
        );
    };

    // Memoized callback for VaR calculation
    const runCalculation = useCallback(async () => {
        setIsCalculating(true);
        try {
            const activeInstruments = instruments.filter(inst => inst.included);
            if (activeInstruments.length === 0) {
                setVarResults(null);
                return;
            }

            // We are now calling the server function from the client.
            const historicalDataArray = await getHistoricalDataOnClient(activeInstruments);
            // We convert the array back to a Map
            const historicalData = new Map(historicalDataArray);

            const results = calculateVaR(activeInstruments, historicalData, simulationMethod as 'parametric' | 'historical');
            setVarResults(results);
        } catch (error) {
            console.error("Failed to calculate VaR", error);
            toast({
                title: 'Calculation Error',
                description: 'Could not complete the VaR calculation. Check if the data file is present and correctly formatted.',
                variant: 'destructive',
            });
        } finally {
            setIsCalculating(false);
        }
    }, [instruments, simulationMethod, toast]);

    // Effect to recalculate VaR when portfolio or method changes
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            runCalculation();
        }, 500); // Debounce to avoid rapid recalculations

        return () => clearTimeout(debounceTimer);
    }, [runCalculation]);

    return (
        <SidebarProvider>
            <div className="flex min-h-screen w-full flex-col">
                <AppHeader />
                <div className="flex flex-1">
                    <Sidebar collapsible="icon" className="border-r">
                        <SidebarContent
                            simulationMethod={simulationMethod}
                            setSimulationMethod={setSimulationMethod}
                            instruments={instruments}
                            addInstrument={addInstrument}
                            removeInstrument={removeInstrument}
                        />
                    </Sidebar>
                    <SidebarInset>
                        <MainDashboard
                            varResults={varResults}
                            isCalculating={isCalculating}
                            instruments={instruments}
                            toggleInstrument={toggleInstrument}
                            removeInstrument={removeInstrument}
                        />
                    </SidebarInset>
                </div>
            </div>
        </SidebarProvider>
    );
}
